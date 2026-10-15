/**
 * Allures d'entraînement et prédiction (SPEC section 2, « Allures »).
 *
 * - Prédiction de Riegel : T(D) = T10 × (D / 10)^1,06.
 * - Allure course : Finisher = prédiction + 5 % ; l2 / l3 = allure de l'objectif du niveau.
 *   Si l'objectif est plus rapide que la prédiction améliorée de 3 %, il est irréaliste : le
 *   plan suit alors le plus haut niveau atteignable (Finisher au besoin), allure et volumes
 *   compris, et l'explique dans une note (revue du 15/10/2026 : un objectif trop ambitieux
 *   ne doit donner ni l'allure la plus agressive ni la charge la plus lourde). Si l'objectif
 *   est au contraire bien plus lent que le potentiel, l'allure course est plafonnée à
 *   prédiction + 5 % (comme Finisher) pour rester cohérente avec l'endurance fondamentale.
 * - Prépa prudente (option `cautious`, sortie longue la plus longue sous le seuil) : 5 % de
 *   marge en plus sur l'allure course, avec une note de prudence.
 * - EF = allure marathon prédite × 1,20 ; récup = EF × 1,08 ; seuil = allure 10 km × 1,06 ;
 *   AS10 = allure 10 km. Toutes les allures sont arrondies à la seconde par km.
 */
import {
  EF_FACTOR,
  FINISHER_MARGIN,
  GOAL_TOLERANCE,
  LEVEL_GOAL_SEC,
  LEVEL_LABEL,
  RECUP_FACTOR,
  RIEGEL_DISTANCE_KM,
  RIEGEL_EXPONENT,
  SEUIL_FACTOR,
  SHORT_PREP_EXTRA_MARGIN,
  T10_MAX_SEC,
  T10_MIN_SEC,
} from './constants';
import { formatChrono, formatDecimal, formatPace, formatRaceTime, frenchTypography } from './format';
import { PlanError } from './types';
import type { Level, PaceComputation, PlanInput, RaceKind } from './types';

/** Temps prédit (s) sur `distanceKm` à partir du temps sur 10 km (Riegel, exposant 1,06). */
export function riegelTime(t10: number, distanceKm: number): number {
  return t10 * Math.pow(distanceKm / 10, RIEGEL_EXPONENT);
}

function assertPaceInput(input: Pick<PlanInput, 'race' | 'level' | 't10'>): void {
  const errors: string[] = [];
  if (input.race !== 'marathon' && input.race !== 'semi') {
    errors.push('Choisis la course : marathon ou semi-marathon.');
  }
  if (input.level !== 'finisher' && input.level !== 'l2' && input.level !== 'l3') {
    errors.push('Choisis un niveau : Finisher, l2 ou l3.');
  }
  if (typeof input.t10 !== 'number' || !Number.isFinite(input.t10) || input.t10 < T10_MIN_SEC || input.t10 > T10_MAX_SEC) {
    errors.push('Ton temps sur 10 km doit être compris entre 30 min et 1 h 30.');
  }
  if (errors.length > 0) throw new PlanError('INVALID_INPUT', errors.map(frenchTypography));
}

function raceNoun(race: RaceKind): string {
  return race === 'marathon' ? 'le marathon' : 'le semi';
}

function paceNoun(race: RaceKind): string {
  return race === 'marathon' ? 'allure marathon' : 'allure semi';
}

/** « « moins de 4 h » », avec espaces insécables. */
function quoted(text: string): string {
  return `« ${text} »`;
}

/** Niveau dont l'objectif est irréaliste au vu du T10 (Finisher ne l'est jamais). */
export function isGoalTooFast(race: RaceKind, level: Level, t10: number): boolean {
  if (level === 'finisher') return false;
  const raceKm = RIEGEL_DISTANCE_KM[race];
  const predictedRaceSec = riegelTime(t10, raceKm);
  const goalSec = LEVEL_GOAL_SEC[race][level];
  const goalPace = Math.round(goalSec / raceKm);
  const seuil = Math.round((t10 / 10) * SEUIL_FACTOR);
  // Objectif plus rapide que la prédiction améliorée de 3 % : irréaliste.
  // Garde-fou physiologique : une allure marathon ne peut pas être plus rapide que le seuil.
  return goalSec < predictedRaceSec * (1 - GOAL_TOLERANCE) || (race === 'marathon' && goalPace <= seuil);
}

/** Plus haut niveau atteignable, en partant du niveau choisi et en descendant. */
export function reachableLevel(race: RaceKind, level: Level, t10: number): Level {
  const order: Level[] = level === 'l3' ? ['l3', 'l2', 'finisher'] : level === 'l2' ? ['l2', 'finisher'] : ['finisher'];
  return order.find((l) => !isGoalTooFast(race, l, t10)) ?? 'finisher';
}

export interface PaceOptions {
  /**
   * Prépa prudente : la plus longue sortie du plan (km) reste sous le seuil de confiance.
   * L'allure course prend alors 5 % de marge en plus et la note invite à partir prudemment.
   */
  cautious?: { longestLongRunKm: number };
}

export function computePaces(input: Pick<PlanInput, 'race' | 'level' | 't10'>, options: PaceOptions = {}): PaceComputation {
  assertPaceInput(input);
  const { race, level, t10 } = input;
  const raceKm = RIEGEL_DISTANCE_KM[race];
  const marathonKm = RIEGEL_DISTANCE_KM.marathon;

  const as10 = t10 / 10;
  const seuil = Math.round(as10 * SEUIL_FACTOR);
  const predictedRaceSec = riegelTime(t10, raceKm);
  const predictedPace = predictedRaceSec / raceKm;
  const predictedMarathonPace = riegelTime(t10, marathonKm) / marathonKm;
  const ef = Math.round(predictedMarathonPace * EF_FACTOR);
  const recup = Math.round(ef * RECUP_FACTOR);
  const ceiling = Math.round(predictedPace * FINISHER_MARGIN);
  const chrono10 = formatChrono(t10);

  const effectiveLevel = reachableLevel(race, level, t10);
  let course: number;
  const notes: string[] = [];
  if (effectiveLevel === 'finisher') {
    course = ceiling;
  } else {
    const goalPace = Math.round(LEVEL_GOAL_SEC[race][effectiveLevel] / raceKm);
    course = Math.min(goalPace, ceiling);
  }

  const cautious = options.cautious;
  if (cautious) course = Math.max(course, Math.round(predictedPace * FINISHER_MARGIN * SHORT_PREP_EXTRA_MARGIN));
  const courseTxt = `${formatPace(course)}, soit environ ${formatRaceTime(course * raceKm)}`;

  if (effectiveLevel !== level) {
    const followed = effectiveLevel === 'finisher' ? 'le niveau Finisher' : `le niveau ${quoted(LEVEL_LABEL[race][effectiveLevel])}`;
    notes.push(
      `L'objectif ${quoted(LEVEL_LABEL[race][level])} est trop ambitieux pour l'instant : avec ${chrono10} sur 10 km, ` +
        `ton temps prédit sur ${raceNoun(race)} est d'environ ${formatRaceTime(predictedRaceSec)}. ` +
        `Ton programme suit donc ${followed}, avec le volume prévu pour ce niveau` +
        (cautious ? '. ' : ` et une ${paceNoun(race)} de ${courseTxt}. `) +
        'Refais le calcul avec un nouveau chrono quand tu auras progressé.',
    );
  } else if (effectiveLevel !== 'finisher' && !cautious && course === ceiling && course < Math.round(LEVEL_GOAL_SEC[race][effectiveLevel] / raceKm)) {
    notes.push(
      `Avec ${chrono10} sur 10 km, l'objectif ${quoted(LEVEL_LABEL[race][effectiveLevel])} est largement à ta portée ` +
        `(temps prédit : environ ${formatRaceTime(predictedRaceSec)}). ` +
        `Tes blocs à allure course sont calés sur ton potentiel avec 5 % de marge (${courseTxt}). ` +
        `Le jour J, rien ne t'empêche de courir plus tranquillement.`,
    );
  }
  if (cautious) {
    notes.push(
      `Ta plus longue sortie du programme fait ${formatDecimal(cautious.longestLongRunKm)} km : ` +
        `pour le jour J, ton ${paceNoun(race)} garde donc une marge de prudence (${courseTxt}). ` +
        'Pars même 10 à 15 s/km plus lentement les premiers kilomètres, et n\'accélère qu\'en fin de course si tout va bien.',
    );
  }

  const computation: PaceComputation = {
    paces: { ef, seuil, as10: Math.round(as10), allure_course: course, recup },
    predicted: { raceSec: Math.round(predictedRaceSec) },
    effectiveLevel,
  };
  if (notes.length > 0) computation.note = frenchTypography(notes.join(' '));
  return computation;
}
