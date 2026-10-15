/**
 * Ossature du plan : nombre de semaines, phases, semaines allégées et volumes (SPEC section 2).
 * Les volumes sont manipulés en hectomètres entiers (1 hm = 100 m) pour éviter les
 * erreurs d'arrondi des flottants ; les cibles hebdomadaires sont des multiples de 0,5 km.
 */
import {
  DELOAD_FACTOR,
  MAX_WEEKLY_INCREASE,
  MIN_START_KM,
  NOMINAL_DELOADS,
  NOMINAL_PHASES,
  NOMINAL_WEEKS,
  PEAK_KM,
  RACE_SESSION_KM,
  RACE_WEEK_TRAINING_SHARE,
  TAPER_FACTORS,
  THREE_SESSIONS_PEAK_FACTOR,
} from './constants';
import type { Level, Phase, PlanInput, RaceKind } from './types';

const EPSILON = 1e-9;

/** Arrondi au 0,5 km le plus proche, en hm. */
export function roundHalfKmHm(hm: number): number {
  return Math.round(hm / 5 + EPSILON) * 5;
}

/** Arrondi au 0,5 km inférieur, en hm. */
export function floorHalfKmHm(hm: number): number {
  return Math.floor(hm / 5 + EPSILON) * 5;
}

/* ------------------------------------------------------------------ */
/* Phases                                                             */
/* ------------------------------------------------------------------ */

export type PhaseLengths = Record<Phase, number>;

/**
 * Durée des phases pour un plan de `weeks` semaines (8 ≤ weeks ≤ nominal).
 * Durée nominale : valeurs de la SPEC. Plan plus court : l'affûtage est conservé,
 * la base est raccourcie en premier (jusqu'à 25 % des semaines hors affûtage),
 * puis développement et spécifique sont réduits proportionnellement.
 */
export function phaseLengths(race: RaceKind, weeks: number): PhaseLengths {
  const nominal = NOMINAL_PHASES[race];
  const taper = nominal.affutage;
  const available = weeks - taper;
  const devSpec = nominal.developpement + nominal.specifique;
  const nominalTotal = nominal.base + devSpec;
  if (available >= nominalTotal) {
    return { ...nominal, base: nominal.base + (available - nominalTotal) };
  }
  const base = Math.max(Math.max(1, Math.round(available * 0.25)), available - devSpec);
  const rest = available - base;
  let specifique = Math.min(nominal.specifique, Math.max(1, Math.round((rest * nominal.specifique) / devSpec)));
  let developpement = rest - specifique;
  if (developpement < 1) {
    developpement = 1;
    specifique = rest - 1;
  }
  return { base, developpement, specifique, affutage: taper };
}

/** Phase de la semaine `index` (1-based). */
export function phaseOf(lengths: PhaseLengths, index: number): Phase {
  if (index <= lengths.base) return 'base';
  if (index <= lengths.base + lengths.developpement) return 'developpement';
  if (index <= lengths.base + lengths.developpement + lengths.specifique) return 'specifique';
  return 'affutage';
}

/* ------------------------------------------------------------------ */
/* Semaines allégées                                                   */
/* ------------------------------------------------------------------ */

/** Coût d'un écart entre deux semaines allégées (ou depuis le début du plan). */
function interiorGapCost(gap: number): number | null {
  switch (gap) {
    case 4:
      return 0;
    case 3:
      return 2;
    case 5:
      return 6;
    case 2:
      return 12;
    case 6:
      return 20;
    default:
      return null;
  }
}

/** Coût de l'écart entre la dernière semaine allégée et le début de l'affûtage. */
function finalGapCost(gap: number): number | null {
  switch (gap) {
    case 4:
      return 0;
    case 3:
      return 1;
    case 5:
      return 2;
    case 2:
      return 4;
    case 6:
      return 10;
    case 1:
      return 16;
    default:
      return null;
  }
}

/**
 * Semaines allégées (indices 1-based, triés).
 * - Durée nominale (24 sem. marathon, 20 sem. semi) : liste fixe de la SPEC.
 * - Autre durée : une semaine allégée toutes les 3-4 semaines, plus la semaine de Noël
 *   si elle tombe hors affûtage (et n'est pas la première semaine). Le placement est
 *   optimal au sens d'un coût simple (écart idéal : 3 semaines chargées puis 1 allégée).
 */
export function deloadWeeks(race: RaceKind, weeks: number, christmasIndex: number | null): number[] {
  if (weeks === NOMINAL_WEEKS[race]) return [...NOMINAL_DELOADS[race]];

  const lastLoad = weeks - NOMINAL_PHASES[race].affutage;
  const mandatory = christmasIndex !== null && christmasIndex >= 2 && christmasIndex <= lastLoad ? christmasIndex : null;
  const end = lastLoad + 1; // début (virtuel) de l'affûtage
  const cost: number[] = new Array<number>(end + 1).fill(Number.POSITIVE_INFINITY);
  const prev: number[] = new Array<number>(end + 1).fill(-1);
  cost[0] = 0;

  for (let j = 2; j <= end; j += 1) {
    for (let i = 0; i < j; i += 1) {
      const base = cost[i] ?? Number.POSITIVE_INFINITY;
      if (!Number.isFinite(base)) continue;
      if (mandatory !== null && i < mandatory && mandatory < j) continue; // on ne saute pas Noël
      const gapCost = j === end ? finalGapCost(j - i) : interiorGapCost(j - i);
      if (gapCost === null) continue;
      const total = base + gapCost;
      if (total < (cost[j] ?? Number.POSITIVE_INFINITY)) {
        cost[j] = total;
        prev[j] = i;
      }
    }
  }

  const result: number[] = [];
  let cursor = prev[end] ?? -1;
  while (cursor > 0) {
    result.push(cursor);
    cursor = prev[cursor] ?? -1;
  }
  return result.reverse();
}

/* ------------------------------------------------------------------ */
/* Volumes                                                            */
/* ------------------------------------------------------------------ */

/**
 * Volume au pic effectif (hm) : pic de la SPEC, réduit de 15 % avec 3 séances, et borné
 * pour que chaque séance reste plus courte que la sortie longue maximale (`longRunCapHm`,
 * qui tient compte de la limite de 3 h) : sans effet sauf pour les coureurs les plus lents.
 */
export function effectivePeakHm(
  race: RaceKind,
  level: Level,
  sessions: PlanInput['sessions'],
  longRunCapHm: number,
): number {
  const peakHm = PEAK_KM[race][level] * 10;
  const bySessions = sessions === 3 ? floorHalfKmHm(peakHm * THREE_SESSIONS_PEAK_FACTOR) : peakHm;
  return Math.min(bySessions, floorHalfKmHm(sessions * longRunCapHm * 0.9));
}

export interface VolumePlan {
  /** Volume cible d'entraînement par semaine (hm, hors course pour la dernière semaine). */
  weekHm: number[];
  /** Dernière semaine chargée avant l'affûtage (référence de l'affûtage), en hm. */
  referenceHm: number;
  peakHm: number;
  startHm: number;
}

export interface VolumeOptions {
  race: RaceKind;
  weeks: number;
  weeklyKm: number;
  peakHm: number;
  deloads: readonly number[];
  /** Index de la première semaine du spécifique : le pic est visé à cette date. */
  specificStart: number;
}

/**
 * Progression : départ à max(weeklyKm, 15) (plafonné au pic) ; chaque semaine non allégée
 * augmente d'au plus 10 % par rapport à la dernière semaine non allégée, sans dépasser le pic.
 * La pente est lissée pour atteindre le pic au début du spécifique (jamais plus de +10 %).
 * Semaine allégée : -27,5 % de la dernière semaine chargée. Affûtage : facteurs de la SPEC.
 * La valeur de la semaine de course est le plancher d'entraînement hors course.
 */
export function weeklyVolumes(options: VolumeOptions): VolumePlan {
  const { race, weeks, weeklyKm, peakHm, deloads, specificStart } = options;
  const deloadSet = new Set(deloads);
  const taper = TAPER_FACTORS[race];
  const lastLoad = weeks - taper.length;

  const startHm = Math.min(floorHalfKmHm(Math.max(weeklyKm, MIN_START_KM) * 10), peakHm);
  let increments = 0;
  for (let i = 2; i <= Math.min(specificStart, lastLoad); i += 1) {
    if (!deloadSet.has(i)) increments += 1;
  }
  const growth =
    startHm >= peakHm
      ? 1
      : Math.min(1 + MAX_WEEKLY_INCREASE, Math.pow(peakHm / startHm, 1 / Math.max(1, increments)));

  const weekHm: number[] = [startHm];
  let lastLoadHm = startHm;
  let loadCount = 0;
  for (let i = 2; i <= lastLoad; i += 1) {
    if (deloadSet.has(i)) {
      weekHm.push(roundHalfKmHm(lastLoadHm * DELOAD_FACTOR));
      continue;
    }
    loadCount += 1;
    const ideal = roundHalfKmHm(startHm * Math.pow(growth, loadCount));
    const capped = Math.min(peakHm, ideal, floorHalfKmHm(lastLoadHm * (1 + MAX_WEEKLY_INCREASE)));
    const hm = Math.max(lastLoadHm, capped);
    weekHm.push(hm);
    lastLoadHm = hm;
  }

  taper.forEach((factor, step) => {
    if (step < taper.length - 1) {
      weekHm.push(roundHalfKmHm(lastLoadHm * factor));
      return;
    }
    // Semaine de course : cible « course incluse » de la SPEC si elle laisse de la place,
    // sinon plancher de footings courts (cas de tous les volumes de la SPEC).
    const raceHm = Math.round(RACE_SESSION_KM[race] * 10);
    const specTarget = roundHalfKmHm(lastLoadHm * factor) - raceHm;
    const floor = roundHalfKmHm(lastLoadHm * RACE_WEEK_TRAINING_SHARE[race]);
    weekHm.push(Math.max(specTarget, floor));
  });

  return { weekHm, referenceHm: lastLoadHm, peakHm, startHm };
}
