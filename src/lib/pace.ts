/**
 * Calculs d'allure (fonctions pures) pour le calculateur de la page gratuite.
 * Équivalences par la formule de Riegel, exposant 1,06 (SPEC section 2).
 */

export const RIEGEL_EXPONENT = 1.06;

export interface Distance {
  id: string;
  label: string;
  km: number;
}

export const STANDARD_DISTANCES: readonly Distance[] = [
  { id: '5k', label: '5 km', km: 5 },
  { id: '10k', label: '10 km', km: 10 },
  { id: 'semi', label: 'Semi-marathon', km: 21.0975 },
  { id: 'marathon', label: 'Marathon', km: 42.195 },
];

/** Temps prédit sur `toKm` à partir d'un temps `timeSec` sur `fromKm`. */
export function riegel(timeSec: number, fromKm: number, toKm: number, exponent = RIEGEL_EXPONENT): number {
  if (!(timeSec > 0) || !(fromKm > 0) || !(toKm > 0)) return Number.NaN;
  return timeSec * (toKm / fromKm) ** exponent;
}

/** Allure en secondes par km. */
export function pacePerKm(timeSec: number, km: number): number {
  if (!(timeSec > 0) || !(km > 0)) return Number.NaN;
  return timeSec / km;
}

/** Vitesse en km/h. */
export function speedKmh(timeSec: number, km: number): number {
  if (!(timeSec > 0) || !(km > 0)) return Number.NaN;
  return km / (timeSec / 3600);
}

export interface TimeParts {
  h: number;
  m: number;
  s: number;
}

/** Heures, minutes, secondes → secondes ; `null` si une valeur est invalide. */
export function partsToSeconds(parts: TimeParts): number | null {
  const { h, m, s } = parts;
  if (![h, m, s].every((v) => Number.isFinite(v) && v >= 0)) return null;
  if (m >= 60 || s >= 60) return null;
  const total = Math.round(h * 3600 + m * 60 + s);
  return total > 0 ? total : null;
}

/** Secondes → heures, minutes, secondes. */
export function secondsToParts(totalSec: number): TimeParts {
  const sec = Math.max(0, Math.round(totalSec));
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

/** Allures d'entraînement en s/km, mêmes règles que le moteur (SPEC section 2). */
export interface TrainingPaces {
  /** Endurance fondamentale : allure marathon × 1,20. */
  ef: number;
  /** Récupération : EF × 1,08. */
  recup: number;
  /** Seuil : allure 10 km × 1,06. */
  seuil: number;
  /** Allure 10 km. */
  as10: number;
  /** Allure semi-marathon prédite. */
  semi: number;
  /** Allure marathon prédite. */
  marathon: number;
}

/** Allures d'entraînement à partir d'un chrono `timeSec` sur `km`, ou `null` si invalide. */
export function trainingPaces(timeSec: number, km: number): TrainingPaces | null {
  const t10 = riegel(timeSec, km, 10);
  if (!Number.isFinite(t10)) return null;
  const marathonPace = riegel(t10, 10, 42.195) / 42.195;
  const semiPace = riegel(t10, 10, 21.0975) / 21.0975;
  const ef = marathonPace * 1.2;
  return {
    ef,
    recup: ef * 1.08,
    seuil: (t10 / 10) * 1.06,
    as10: t10 / 10,
    semi: semiPace,
    marathon: marathonPace,
  };
}
