/**
 * Répartition du volume hebdomadaire entre les séances (SPEC section 2).
 *
 * Semaine d'entraînement (volume cible K, en hm) :
 * 1. sortie longue = min(plafond du niveau, 35 % de K) — 45 % pour les 3 dernières
 *    sorties longues du spécifique marathon ;
 * 2. séance de qualité calibrée par la phase, jamais plus longue que la sortie longue ;
 * 3. le reste est réparti entre les footings, chacun ≤ sortie longue. Si le reste ne permet
 *    pas des footings d'au moins 4 km, les footings en trop deviennent du renforcement
 *    (le nombre de séances par semaine est toujours respecté).
 * La somme des séances est exactement K.
 */
import { floorHalfKmHm } from './structure';
import {
  type DraftSession,
  type PreparedQuality,
  type SlotRole,
  type WorkoutContext,
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
/** En dessous de 4 km de moyenne, un footing secondaire devient du renforcement. */
const MIN_EF_HM = 40;
/** Plancher absolu d'un footing, quand la semaine est très légère. */
const MIN_EF_FLOOR_HM = 20;

const RUN_PRIORITY: readonly SlotRole[] = ['ef_main', 'ef_short', 'ef_mid'];
const EF_WEIGHTS: Readonly<Record<SlotRole, number>> = { ef_main: 1, ef_mid: 0.8, ef_short: 0.7, qualite: 0, sl: 0 };

/**
 * Répartit `total` (entier) selon `weights`, chaque part ≤ `cap` si possible, en entiers.
 * Chaque part reçoit d'abord `floor` quand le total le permet.
 * Déterministe : à reste égal, la première part l'emporte.
 */
export function distribute(total: number, weights: readonly number[], cap: number, floor = 0): number[] {
  const count = weights.length;
  if (count === 0) return [];
  if (floor > 0 && total >= count * floor && cap >= floor) {
    return distribute(total - count * floor, weights, cap - floor).map((x) => x + floor);
  }
  const shares = new Array<number>(count).fill(0);
  const capped = new Array<boolean>(count).fill(false);
  let remaining = total;
  for (let guard = 0; guard <= count; guard += 1) {
    const active = weights.map((w, i) => (capped[i] ? 0 : w));
    const sum = active.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let changed = false;
    for (let i = 0; i < count; i += 1) {
      if (capped[i]) continue;
      const share = (remaining * (active[i] ?? 0)) / sum;
      if (share > cap) {
        capped[i] = true;
        shares[i] = cap;
        changed = true;
      } else {
        shares[i] = share;
      }
    }
    if (!changed) break;
    remaining = total - shares.reduce((acc, s, i) => acc + (capped[i] ? s : 0), 0);
  }

  const ints = shares.map((s) => Math.floor(s + EPSILON));
  let left = total - ints.reduce((a, b) => a + b, 0);
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s + EPSILON) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .map((x) => x.i);
  for (let pass = 0; left > 0 && pass < 1000; pass += 1) {
    let given = false;
    for (const i of order) {
      if (left <= 0) break;
      if ((ints[i] ?? 0) < cap) {
        ints[i] = (ints[i] ?? 0) + 1;
        left -= 1;
        given = true;
      }
    }
    if (!given) {
      // Impossible de rester sous le plafond : le surplus va à la première part.
      ints[0] = (ints[0] ?? 0) + left;
      left = 0;
    }
  }
  return ints;
}

export interface TrainingWeekSpec {
  phase: Phase;
  deload: boolean;
  /** Volume cible de la semaine (hm). */
  targetHm: number;
  longRunShare: number;
  longRunCapHm: number;
  /** Semaines chargées déjà passées dans la phase (rotation des séances). */
  progress: number;
  /** Rang dans l'affûtage (0-based), 0 hors affûtage. */
  taperStep: number;
  /** Rang de la semaine chargée dans le spécifique, sinon null. */
  specificRank: number | null;
}

export function buildTrainingWeek(ctx: WorkoutContext, spec: TrainingWeekSpec): DraftSession[] {
  const slots = weekTemplate(ctx.sessions, ctx.longRunDay);
  const total = spec.targetHm;
  let longHm = Math.min(spec.longRunCapHm, Math.floor(spec.longRunShare * total + EPSILON));
  const easySlots = RUN_PRIORITY.flatMap((role) => slots.filter((s) => s.role === role));
  const easyCount = easySlots.length;

  const qualityMax = Math.max(0, Math.min(longHm, total - longHm - MIN_EF_MAIN_HM));
  const qualityLow = Math.max(0, total - longHm - easyCount * longHm);
  const choice = selectQuality(ctx, spec.phase, spec.deload, spec.progress, spec.taperStep, total);
  const prepared = prepareQuality(ctx, choice, total, qualityMax);
  const lo = Math.max(prepared.minHm, qualityLow);
  const hi = Math.max(lo, qualityMax);
  const qualityHm = Math.min(hi, Math.max(lo, prepared.naturalHm));

  let rest = total - longHm - qualityHm;
  if (rest < MIN_EF_FLOOR_HM) {
    // Semaine minuscule : la sortie longue cède ce qu'il faut au footing.
    longHm -= MIN_EF_FLOOR_HM - rest;
    rest = MIN_EF_FLOOR_HM;
  }

  let runs = easyCount;
  while (runs > 1 && rest / runs < MIN_EF_HM) runs -= 1;
  while (runs < easyCount && rest > runs * longHm) runs += 1;
  const runSlots = easySlots.slice(0, runs);
  const amounts = distribute(
    rest,
    runSlots.map((s) => EF_WEIGHTS[s.role]),
    longHm,
    MIN_EF_MAIN_HM,
  );
  const easyHm = new Map<number, number>();
  runSlots.forEach((slot, i) => easyHm.set(slot.dowIdx, amounts[i] ?? 0));

  const options = { phase: spec.phase, deload: spec.deload };
  return slots.map((slot): DraftSession => {
    switch (slot.role) {
      case 'sl':
        return renderLongRun(ctx, longHm, slot.dowIdx, {
          phase: spec.phase,
          deload: spec.deload,
          specificRank: spec.specificRank,
        });
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

/**
 * Semaine de course : on garde la fréquence (mêmes jours que d'habitude avant la course,
 * complétés au besoin par les jours précédant la course), avec des footings courts,
 * un rappel d'allure au moins 2 jours avant, une activation la veille ou l'avant-veille.
 * La course est la dernière séance du plan.
 */
/**
 * Semaine de course : on garde la fréquence (mêmes jours que d'habitude avant la course,
 * complétés au besoin par les jours précédant la course), avec des footings courts,
 * un rappel d'allure au moins 2 jours avant et une activation la veille ou l'avant-veille.
 * L'entraînement hors course ne dépasse jamais `maxShare` × référence : pour un très petit
 * volume, les footings de récupération sont retirés plutôt que réduits à rien.
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

  const others = plan.map((x, i) => ({ r: x.role, i })).filter((x) => x.r !== 'rw_rappel');
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
  const extra = distribute(
    free,
    others.map((x) => RACE_WEEK_WEIGHTS[x.r]),
    Number.POSITIVE_INFINITY,
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
