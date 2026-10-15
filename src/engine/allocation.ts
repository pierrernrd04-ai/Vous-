/**
 * Répartition du volume hebdomadaire entre les séances (SPEC section 2).
 *
 * Semaine d'entraînement (volume cible K, en hm) :
 * 1. sortie longue = min(plafond, part de K selon la phase) : 40 % en base, 45 % en
 *    développement, 50 % en spécifique, 40 % en affûtage. Le plafond combine le maximum
 *    du niveau, 3 h à l'allure EF, +2 km par rapport à la sortie longue de la dernière
 *    semaine non allégée, et le raccourcissement des semaines allégées et de l'affûtage
 *    (calculé par `generatePlan`) ;
 * 2. séance de qualité calibrée par la phase, au plus 30 % de la semaine, jamais plus
 *    longue que la sortie longue ;
 * 3. le reste est réparti entre les footings, chacun ≤ 75 % de la sortie longue et ≤ 90 min
 *    (60 min pour le footing court). Si le reste ne permet pas des footings d'au moins 4 km,
 *    les footings en trop deviennent du renforcement (le nombre de séances par semaine est
 *    toujours respecté). Ce que les footings ne peuvent pas prendre va à la séance de
 *    qualité (jusqu'à la longueur de la sortie longue), le reste éventuel est abandonné :
 *    la semaine peut alors être un peu plus courte que la cible, jamais plus longue.
 */
import {
  EF_MAX_MINUTES,
  EF_MAX_SHARE_OF_LONG,
  EF_SHORT_MAX_MINUTES,
  PRE_RACE_LONG_RUN_FACTOR,
  PRE_RACE_NO_LONG_RUN_DAYS,
  QUALITY_MAX_SHARE,
  QUALITY_ROUNDING_SLACK_HM,
  RACE_WEEK_ACTIVATION_MAX_HM,
  RACE_WEEK_ACTIVATION_MAX_MINUTES,
  RACE_WEEK_FOOTING_MAX_MINUTES,
  RACE_WEEK_FOOTING_MAX_SHARE,
  RACE_WEEK_RECUP_MAX_MINUTES,
  RACE_WEEK_RECUP_MAX_SHARE,
} from './constants';
import { floorHalfKmHm, hmForMinutes } from './structure';
import {
  type DraftSession,
  type PreparedQuality,
  type SlotRole,
  type WorkoutContext,
  longRunHasRacePace,
  prepareQuality,
  raceWeekRappel,
  renderEasyRun,
  renderLongRun,
  renderQuality,
  renderRaceDay,
  renderRaceWeekRun,
  renderStrength,
  selectQuality,
  weekTemplate,
} from './workouts';
import type { Phase } from './types';

const EPSILON = 1e-9;
/** Footing principal (mardi) : au moins 3 km. */
const MIN_EF_MAIN_HM = 30;
/**
 * En dessous de 4 km de moyenne (ou de 30 min pour un coureur lent), un footing secondaire
 * devient du renforcement.
 */
const MIN_EF_HM = 40;
const MIN_EF_MINUTES = 30;
/** Plancher absolu d'un footing, quand la semaine est très légère. */
const MIN_EF_FLOOR_HM = 20;

const RUN_PRIORITY: readonly SlotRole[] = ['ef_main', 'ef_short', 'ef_mid'];
const EF_WEIGHTS: Readonly<Record<SlotRole, number>> = { ef_main: 1, ef_mid: 0.8, ef_short: 0.7, qualite: 0, sl: 0 };

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Répartit `total` (entier) selon `weights`, chaque part ≤ `cap` si possible, en entiers.
 * Chaque part reçoit d'abord `floor` quand le total le permet.
 * Déterministe : à reste égal, la première part l'emporte.
 */
export function distribute(total: number, weights: readonly number[], cap: number, floor = 0): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const ints = fillCapped(total, weights, new Array<number>(count).fill(cap), floor);
  const left = total - sum(ints);
  // Impossible de rester sous le plafond : le surplus va à la première part.
  if (left > 0) ints[0] = (ints[0] ?? 0) + left;
  return ints;
}

/**
 * Répartit au plus `total` (entier) selon `weights`, chaque part ≤ son plafond `caps[i]`.
 * Chaque part reçoit d'abord `floor` (sans dépasser son plafond) quand le total le permet.
 * Ce qui ne tient pas sous les plafonds n'est pas distribué : la somme peut être < `total`.
 * Déterministe : à reste égal, la première part l'emporte.
 */
export function fillCapped(total: number, weights: readonly number[], caps: readonly number[], floor = 0): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const capOf = (i: number): number => Math.max(0, caps[i] ?? 0);
  if (floor > 0) {
    const floors = weights.map((_, i) => Math.min(floor, capOf(i)));
    const floorSum = sum(floors);
    if (total >= floorSum && floorSum > 0) {
      const extra = fillCapped(total - floorSum, weights, weights.map((_, i) => capOf(i) - (floors[i] ?? 0)));
      return extra.map((x, i) => x + (floors[i] ?? 0));
    }
  }
  const shares = new Array<number>(count).fill(0);
  const capped = new Array<boolean>(count).fill(false);
  let remaining = total;
  for (let guard = 0; guard <= count; guard += 1) {
    const active = weights.map((w, i) => (capped[i] ? 0 : w));
    const weightSum = sum(active);
    if (weightSum <= 0) break;
    let changed = false;
    for (let i = 0; i < count; i += 1) {
      if (capped[i]) continue;
      const share = (remaining * (active[i] ?? 0)) / weightSum;
      if (share > capOf(i)) {
        capped[i] = true;
        shares[i] = capOf(i);
        changed = true;
      } else {
        shares[i] = share;
      }
    }
    if (!changed) break;
    remaining = total - shares.reduce((acc, s, i) => acc + (capped[i] ? s : 0), 0);
  }

  const ints = shares.map((s) => Math.floor(s + EPSILON));
  let left = Math.min(total, sum(weights.map((_, i) => capOf(i)))) - sum(ints);
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s + EPSILON) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .map((x) => x.i);
  for (let pass = 0; left > 0 && pass < 1000; pass += 1) {
    let given = false;
    for (const i of order) {
      if (left <= 0) break;
      if ((ints[i] ?? 0) < capOf(i)) {
        ints[i] = (ints[i] ?? 0) + 1;
        left -= 1;
        given = true;
      }
    }
    if (!given) break;
  }
  return ints;
}

/** Plafond d'un footing (hm) : 75 % de la sortie longue, 90 min (60 min pour le footing court). */
export function easyRunCapHm(ctx: WorkoutContext, role: SlotRole, longHm: number): number {
  const minutes = role === 'ef_short' ? EF_SHORT_MAX_MINUTES : EF_MAX_MINUTES;
  return Math.max(0, Math.min(Math.floor(EF_MAX_SHARE_OF_LONG * longHm + EPSILON), hmForMinutes(minutes, ctx.paces.ef)));
}

export interface TrainingWeekSpec {
  phase: Phase;
  deload: boolean;
  /** Volume cible de la semaine (hm). */
  targetHm: number;
  /** Part maximale de la sortie longue dans `targetHm` (selon la phase). */
  longRunShare: number;
  /** Plafond de la sortie longue (hm) : niveau, 3 h à l'allure EF et +2 km au plus. */
  longRunCapHm: number;
  /** Semaines chargées déjà passées dans la phase (rotation des séances). */
  progress: number;
  /** Rang dans l'affûtage (0-based), 0 hors affûtage. */
  taperStep: number;
  /** Rang de la semaine chargée dans le spécifique, sinon null. */
  specificRank: number | null;
  /** Index de la semaine dans le plan (1-based). */
  weekIndex?: number;
}

interface TrainingAllocation {
  longHm: number;
  prepared: PreparedQuality;
  qualityHm: number;
  /** Footings par jour (dowIdx → hm) ; les jours absents deviennent du renforcement. */
  easyHm: Map<number, number>;
  /** Volume que les séances n'ont pas pu prendre sous leurs plafonds (hm). */
  unplaced: number;
}

function allocateTrainingWeek(ctx: WorkoutContext, spec: TrainingWeekSpec, total: number): TrainingAllocation {
  const slots = weekTemplate(ctx.sessions, ctx.longRunDay);
  let longHm = Math.min(spec.longRunCapHm, Math.floor(spec.longRunShare * total + EPSILON));
  const easySlots = RUN_PRIORITY.flatMap((role) => slots.filter((s) => s.role === role));
  const easyCount = easySlots.length;
  const capsFor = (count: number, lr: number): number[] =>
    easySlots.slice(0, count).map((slot) => easyRunCapHm(ctx, slot.role, lr));

  // Séance de qualité : 30 % de la semaine au plus (à l'arrondi près), jamais plus que la sortie longue.
  const qualityShareHm = Math.ceil(QUALITY_MAX_SHARE * total - EPSILON) + QUALITY_ROUNDING_SLACK_HM;
  const overflow = total - longHm - sum(capsFor(easyCount, longHm));
  const softMax = Math.max(
    0,
    Math.min(
      longHm,
      Math.max(Math.floor(QUALITY_MAX_SHARE * total + EPSILON), Math.min(overflow, qualityShareHm)),
      total - longHm - MIN_EF_MAIN_HM,
    ),
  );
  const longOptions = { phase: spec.phase, deload: spec.deload, specificRank: spec.specificRank };
  const choice = selectQuality(ctx, spec.phase, spec.deload, spec.progress, spec.taperStep, total, {
    longRunRacePace: longRunHasRacePace(ctx, longHm, longOptions),
    weekIndex: spec.weekIndex,
  });
  const prepared = prepareQuality(ctx, choice, total, softMax);
  // Très petite semaine (affûtage d'un tout petit volume) : la sortie longue reste au moins
  // aussi longue que la plus courte séance de qualité, dans la limite de sa part de la semaine.
  if (prepared.minHm > longHm) longHm = Math.max(longHm, Math.min(Math.floor(spec.longRunShare * total + EPSILON), prepared.minHm));
  const hardMax = Math.max(prepared.minHm, Math.min(longHm, Math.max(softMax, qualityShareHm)));
  let qualityHm = Math.max(prepared.minHm, Math.min(Math.max(prepared.minHm, softMax), prepared.naturalHm));

  let rest = total - longHm - qualityHm;
  if (rest < MIN_EF_FLOOR_HM) {
    // Semaine minuscule : la sortie longue cède ce qu'il faut au footing, sans devenir plus
    // courte que la séance de qualité.
    const given = Math.min(MIN_EF_FLOOR_HM - rest, Math.max(0, longHm - qualityHm));
    longHm -= given;
    rest += given;
  }

  const minEfHm = Math.min(MIN_EF_HM, hmForMinutes(MIN_EF_MINUTES, ctx.paces.ef));
  let runs = easyCount;
  while (runs > 1 && rest / runs < minEfHm) runs -= 1;
  while (runs < easyCount && rest > sum(capsFor(runs, longHm))) runs += 1;
  const runSlots = easySlots.slice(0, runs);
  const amounts = fillCapped(
    rest,
    runSlots.map((s) => EF_WEIGHTS[s.role]),
    capsFor(runs, longHm),
    MIN_EF_MAIN_HM,
  );
  // Ce que les footings ne peuvent pas prendre va à la qualité (dans ses plafonds).
  let unplaced = rest - sum(amounts);
  if (unplaced > 0) {
    const absorbed = Math.min(unplaced, Math.max(0, hardMax - qualityHm));
    qualityHm += absorbed;
    unplaced -= absorbed;
  }
  const easyHm = new Map<number, number>();
  runSlots.forEach((slot, i) => {
    const hm = amounts[i] ?? 0;
    if (hm > 0) easyHm.set(slot.dowIdx, hm);
  });
  return { longHm, prepared, qualityHm, easyHm, unplaced: Math.max(0, unplaced) };
}

/**
 * Semaine d'entraînement. Si la cible ne tient pas sous les plafonds des séances (sortie longue
 * limitée, footings pleins, qualité à 30 %), la semaine est réduite par pas de 0,5 km jusqu'à
 * une répartition qui respecte toutes les parts : elle n'est jamais gonflée artificiellement.
 */
export function buildTrainingWeek(ctx: WorkoutContext, spec: TrainingWeekSpec): DraftSession[] {
  const slots = weekTemplate(ctx.sessions, ctx.longRunDay);
  let total = spec.targetHm;
  let allocation = allocateTrainingWeek(ctx, spec, total);
  for (let guard = 0; allocation.unplaced > 0 && total > 5 && guard < 400; guard += 1) {
    total = Math.min(total - 5, Math.max(5, floorHalfKmHm(total - allocation.unplaced)));
    allocation = allocateTrainingWeek(ctx, spec, total);
  }
  const { longHm, prepared, qualityHm, easyHm } = allocation;

  const longOptions = { phase: spec.phase, deload: spec.deload, specificRank: spec.specificRank };
  const options = { phase: spec.phase, deload: spec.deload };
  return slots.map((slot): DraftSession => {
    switch (slot.role) {
      case 'sl':
        return renderLongRun(ctx, longHm, slot.dowIdx, longOptions);
      case 'qualite':
        return renderQuality(ctx, prepared, qualityHm, slot.dowIdx);
      case 'ef_main':
      case 'ef_mid':
      case 'ef_short': {
        const hm = easyHm.get(slot.dowIdx);
        return hm === undefined ? renderStrength(slot.dowIdx, spec.phase) : renderEasyRun(ctx, slot.role, hm, slot.dowIdx, options);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Semaine de course                                                  */
/* ------------------------------------------------------------------ */

export interface RaceWeekSpec {
  /** Volume d'entraînement hors course visé (hm). */
  trainingHm: number;
  /** Dernière semaine chargée avant l'affûtage (hm). */
  referenceHm: number;
  /** Part maximale de la référence pour l'entraînement hors course (0,45 marathon, 0,5 semi). */
  maxShare: number;
  /** Jour de la course dans la semaine (0 = lundi). */
  raceDowIdx: number;
}

type PreRaceRole = 'rw_footing' | 'rw_rappel' | 'rw_recup' | 'rw_activation';

const RACE_WEEK_WEIGHTS: Readonly<Record<PreRaceRole, number>> = {
  rw_footing: 1,
  rw_rappel: 1.1,
  rw_recup: 0.7,
  rw_activation: 0.6,
};
const RACE_WEEK_MIN_HM: Readonly<Record<PreRaceRole, number>> = {
  rw_footing: 25,
  rw_rappel: 0,
  rw_recup: 25,
  rw_activation: 20,
};

/** Plafond d'une séance d'avant-course (hm), jamais sous son minimum. */
export function raceWeekCapHm(ctx: WorkoutContext, role: Exclude<PreRaceRole, 'rw_rappel'>, referenceHm: number): number {
  let cap: number;
  switch (role) {
    case 'rw_activation':
      cap = Math.min(RACE_WEEK_ACTIVATION_MAX_HM, hmForMinutes(RACE_WEEK_ACTIVATION_MAX_MINUTES, ctx.paces.ef));
      break;
    case 'rw_footing':
      cap = Math.min(floorHalfKmHm(referenceHm * RACE_WEEK_FOOTING_MAX_SHARE), hmForMinutes(RACE_WEEK_FOOTING_MAX_MINUTES, ctx.paces.ef));
      break;
    case 'rw_recup':
      cap = Math.min(floorHalfKmHm(referenceHm * RACE_WEEK_RECUP_MAX_SHARE), hmForMinutes(RACE_WEEK_RECUP_MAX_MINUTES, ctx.paces.recup));
      break;
  }
  return Math.max(RACE_WEEK_MIN_HM[role], cap);
}

/**
 * Semaine de course : on garde la fréquence (mêmes jours que d'habitude avant la course,
 * complétés au besoin par les jours précédant la course), avec des footings courts,
 * un rappel d'allure au moins 2 jours avant et une activation la veille ou l'avant-veille.
 * L'entraînement hors course ne dépasse jamais `maxShare` × référence : pour un très petit
 * volume, les footings de récupération sont retirés plutôt que réduits à rien.
 * Chaque séance a son plafond (activation ≤ 30 min et 5 km, footing ≤ 50 min et 15 % de la
 * référence, récupération ≤ 45 min et 12 %) : quand la course tombe en début de semaine,
 * le budget restant est abandonné plutôt que concentré sur les un ou deux jours restants.
 * La course est la dernière séance du plan.
 */
export function buildRaceWeek(ctx: WorkoutContext, spec: RaceWeekSpec): DraftSession[] {
  const template = weekTemplate(ctx.sessions, ctx.longRunDay);
  const raceIdx = spec.raceDowIdx;
  const needed = Math.min(ctx.sessions - 1, raceIdx);
  const hardCap = floorHalfKmHm(spec.referenceHm * spec.maxShare);

  const days: { dowIdx: number; role: SlotRole | 'extra' }[] = template
    .filter((s) => s.dowIdx < raceIdx)
    .slice(0, needed)
    .map((s) => ({ dowIdx: s.dowIdx, role: s.role }));
  for (let d = raceIdx - 1; d >= 0 && days.length < needed; d -= 1) {
    if (!days.some((x) => x.dowIdx === d)) days.push({ dowIdx: d, role: 'extra' });
  }
  days.sort((a, b) => a.dowIdx - b.dowIdx);

  let plan = days.map((day, i) => {
    const gap = raceIdx - day.dowIdx;
    let role: PreRaceRole = 'rw_recup';
    if (day.role === 'qualite' && gap >= 2) role = 'rw_rappel';
    else if (i === days.length - 1 && gap <= 2) role = 'rw_activation';
    else if (day.role === 'ef_main') role = 'rw_footing';
    return { dowIdx: day.dowIdx, role };
  });

  const rappelChoice = raceWeekRappel(ctx, spec.referenceHm);
  let prepared: PreparedQuality | null = null;
  let minimal = 0;
  for (;;) {
    const minsOthers = plan.reduce((acc, x) => acc + (x.role === 'rw_rappel' ? 0 : RACE_WEEK_MIN_HM[x.role]), 0);
    prepared = plan.some((x) => x.role === 'rw_rappel')
      ? prepareQuality(ctx, rappelChoice, spec.trainingHm, hardCap - minsOthers)
      : null;
    minimal = minsOthers + (prepared?.minHm ?? 0);
    if (minimal <= hardCap) break;
    const drop = plan.findIndex((x) => x.role === 'rw_recup');
    const dropIndex = drop >= 0 ? drop : plan.findIndex((x) => x.role === 'rw_footing');
    if (dropIndex < 0) break;
    plan = plan.filter((_, i) => i !== dropIndex);
  }
  // Volume visé (plancher hors course), relevé au minimum des séances gardées, jamais au-dessus du plafond.
  const budget = Math.min(hardCap, Math.max(spec.trainingHm, minimal));

  const others = plan
    .map((x, i) => ({ r: x.role, i }))
    .filter((x): x is { r: Exclude<PreRaceRole, 'rw_rappel'>; i: number } => x.r !== 'rw_rappel');
  const mins = others.reduce((acc, x) => acc + RACE_WEEK_MIN_HM[x.r], 0);
  const weightSum = plan.reduce((acc, x) => acc + RACE_WEEK_WEIGHTS[x.role], 0);
  let rappelHm = 0;
  if (prepared) {
    const share = Math.round((budget * RACE_WEEK_WEIGHTS.rw_rappel) / Math.max(EPSILON, weightSum));
    rappelHm = Math.min(Math.max(share, prepared.minHm), Math.max(prepared.minHm, prepared.naturalHm));
    // Le rappel laisse toujours aux autres séances leur minimum.
    rappelHm = Math.min(rappelHm, Math.max(prepared.minHm, budget - mins));
  }
  const free = Math.max(0, budget - rappelHm - mins);
  const extra = fillCapped(
    free,
    others.map((x) => RACE_WEEK_WEIGHTS[x.r]),
    others.map((x) => raceWeekCapHm(ctx, x.r, spec.referenceHm) - RACE_WEEK_MIN_HM[x.r]),
  );
  const hmByIndex = new Map<number, number>();
  others.forEach((x, k) => hmByIndex.set(x.i, RACE_WEEK_MIN_HM[x.r] + (extra[k] ?? 0)));

  const drafts: DraftSession[] = plan.map((day, i) => {
    if (day.role === 'rw_rappel' && prepared) return renderQuality(ctx, prepared, rappelHm, day.dowIdx);
    const runRole = day.role === 'rw_rappel' ? 'rw_recup' : day.role;
    return renderRaceWeekRun(ctx, runRole, hmByIndex.get(i) ?? RACE_WEEK_MIN_HM.rw_recup, day.dowIdx, raceIdx - day.dowIdx);
  });
  drafts.push(renderRaceDay(ctx, raceIdx));
  return drafts;
}

/* ------------------------------------------------------------------ */
/* Semaine qui précède la semaine de course                           */
/* ------------------------------------------------------------------ */

const DOW_NAMES_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/**
 * Semaine qui précède la semaine de course, quand la course tombe en début de semaine
 * suivante : aucune sortie longue à 5 jours ou moins de la course (elle devient un footing
 * court, ≤ 40 % de la sortie longue prévue), la veille un footing d'activation et
 * l'avant-veille un footing très facile sans renforcement.
 * `raceOffsetDays` = numéro du jour de la course compté depuis le lundi de cette semaine (7 = lundi suivant).
 */
export function softenBeforeRace(
  ctx: WorkoutContext,
  drafts: readonly DraftSession[],
  raceOffsetDays: number,
  referenceHm: number,
): { drafts: DraftSession[]; changed: boolean } {
  const raceDay = DOW_NAMES_FR[((raceOffsetDays % 7) + 7) % 7] ?? 'lundi';
  let changed = false;
  const result = drafts.map((draft): DraftSession => {
    const gap = raceOffsetDays - draft.dowIdx;
    if (gap > PRE_RACE_NO_LONG_RUN_DAYS || draft.type === 'course') return draft;
    if (gap <= 1) {
      changed = true;
      const hm = Math.min(Math.max(draft.hm, RACE_WEEK_MIN_HM.rw_activation), raceWeekCapHm(ctx, 'rw_activation', referenceHm));
      return renderRaceWeekRun(ctx, 'rw_activation', hm, draft.dowIdx, gap);
    }
    if (draft.type === 'sl') {
      changed = true;
      const shortened = floorHalfKmHm(draft.hm * PRE_RACE_LONG_RUN_FACTOR);
      const hm = Math.max(RACE_WEEK_MIN_HM.rw_footing, Math.min(shortened, raceWeekCapHm(ctx, 'rw_footing', referenceHm)));
      return renderRaceWeekRun(
        ctx,
        'rw_footing',
        hm,
        draft.dowIdx,
        gap,
        `Ta course a lieu ${raceDay} : pas de sortie longue cette semaine, ce footing court suffit pour arriver frais.`,
      );
    }
    if (gap <= 2 && (draft.type === 'ef' || draft.type === 'renfo')) {
      changed = true;
      const hm = Math.min(Math.max(draft.hm, RACE_WEEK_MIN_HM.rw_recup), raceWeekCapHm(ctx, 'rw_recup', referenceHm));
      return renderRaceWeekRun(ctx, 'rw_recup', hm, draft.dowIdx, gap);
    }
    return draft;
  });
  return { drafts: result, changed };
}
