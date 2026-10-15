/**
 * Allures d'entraînement et prédiction (SPEC section 2, « Allures »).
 *
 * - Prédiction de Riegel : T(D) = T10 × (D / 10)^1,06.
 * - Allure course : Finisher = prédiction + 5 % ; l2 / l3 = allure de l'objectif du niveau,
 *   sauf si l'objectif est plus rapide que la prédiction améliorée de 3 % : on garde alors
 *   l'allure prédite et on l'explique dans une note. Si l'objectif est au contraire bien plus
 *   lent que le potentiel, l'allure course est plafonnée à prédiction + 5 % (comme Finisher)
 *   pour que les blocs spécifiques restent cohérents avec l'endurance fondamentale.
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
  T10_MAX_SEC,
  T10_MIN_SEC,
} from './constants';
import { formatChrono, formatPace, formatRaceTime, frenchTypography } from './format';
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

export function computePaces(input: Pick<PlanInput, 'race' | 'level' | 't10'>): PaceComputation {
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

  let course: number;
  let note: string | undefined;
  if (level === 'finisher') {
    course = Math.round(predictedPace * FINISHER_MARGIN);
  } else {
    course = goalBasedPace(race, level, t10, predictedRaceSec, seuil, (n) => {
      note = n;
    });
  }

  const computation: PaceComputation = {
    paces: { ef, seuil, as10: Math.round(as10), allure_course: course, recup },
    predicted: { raceSec: Math.round(predictedRaceSec) },
  };
  if (note !== undefined) computation.note = frenchTypography(note);
  return computation;
}

function goalBasedPace(
  race: RaceKind,
  level: Exclude<Level, 'finisher'>,
  t10: number,
  predictedRaceSec: number,
  seuil: number,
  setNote: (note: string) => void,
): number {
  const raceKm = RIEGEL_DISTANCE_KM[race];
  const predictedPace = predictedRaceSec / raceKm;
  const goalSec = LEVEL_GOAL_SEC[race][level];
  const goalPace = Math.round(goalSec / raceKm);
  const label = LEVEL_LABEL[race][level];
  const chrono10 = formatChrono(t10);

  // Objectif plus rapide que la prédiction améliorée de 3 % : irréaliste.
  // Garde-fou physiologique : une allure marathon ne peut pas être plus rapide que le seuil.
  const tooFast = goalSec < predictedRaceSec * (1 - GOAL_TOLERANCE) || (race === 'marathon' && goalPace <= seuil);
  if (tooFast) {
    const pace = Math.round(predictedPace);
    setNote(
      `L'objectif ${label} est trop ambitieux pour l'instant : avec ${chrono10} sur 10 km, ` +
        `ton temps prédit sur ${raceNoun(race)} est d'environ ${formatRaceTime(predictedRaceSec)}. ` +
        `Tes séances sont donc calées sur ton allure prédite (${formatPace(pace)}) plutôt que sur une allure irréaliste. ` +
        `Refais le calcul avec un nouveau chrono quand tu auras progressé.`,
    );
    return pace;
  }

  const ceiling = Math.round(predictedPace * FINISHER_MARGIN);
  if (goalPace > ceiling) {
    setNote(
      `Avec ${chrono10} sur 10 km, l'objectif ${label} est largement à ta portée ` +
        `(temps prédit : environ ${formatRaceTime(predictedRaceSec)}). ` +
        `Tes blocs à allure course sont calés sur ton potentiel avec 5 % de marge ` +
        `(${formatPace(ceiling)}, soit environ ${formatRaceTime(ceiling * raceKm)}). ` +
        `Le jour J, rien ne t'empêche de courir plus tranquillement.`,
    );
    return ceiling;
  }
  return goalPace;
}
