/**
 * Aides partagées des tests du moteur. Les valeurs de la SPEC (section 2) sont recopiées ici
 * volontairement, sans importer les constantes du moteur : les tests vérifient la SPEC,
 * pas l'implémentation.
 */
import type { Level, Plan, PlanInput, RaceKind, Week } from '../../src/engine';

export const TODAY = '2026-10-14';
export const PLAN_START = '2026-10-19';
export const RACE_DATE: Record<RaceKind, string> = { marathon: '2027-04-04', semi: '2027-03-07' };
export const NOMINAL_WEEKS: Record<RaceKind, number> = { marathon: 24, semi: 20 };
export const RACE_KM: Record<RaceKind, number> = { marathon: 42.195, semi: 21.1 };
export const PEAK_KM: Record<RaceKind, Record<Level, number>> = {
  marathon: { finisher: 48, l2: 58, l3: 68 },
  semi: { finisher: 33, l2: 42, l3: 50 },
};
export const LONG_RUN_MAX_KM: Record<RaceKind, Record<Level, number>> = {
  marathon: { finisher: 28, l2: 30, l3: 32 },
  semi: { finisher: 16, l2: 18, l3: 20 },
};
/** Part maximale de la sortie longue dans la semaine, selon la phase (décision du 14/10/2026). */
export const LONG_RUN_SHARE: Record<Week['phase'], number> = {
  base: 0.4,
  developpement: 0.45,
  specifique: 0.5,
  affutage: 0.4,
};
/** Hausse maximale d'une sortie longue par rapport à la dernière semaine non allégée (km). */
export const LONG_RUN_MAX_GAIN_KM = 2;
export const DELOADS: Record<RaceKind, number[]> = {
  marathon: [4, 7, 10, 14, 18],
  semi: [4, 7, 10, 14],
};
export const PHASE_RANGES: Record<RaceKind, Record<Week['phase'], [number, number]>> = {
  marathon: { base: [1, 8], developpement: [9, 16], specifique: [17, 21], affutage: [22, 24] },
  semi: { base: [1, 6], developpement: [7, 13], specifique: [14, 18], affutage: [19, 20] },
};
export const TAPER: Record<RaceKind, number[]> = { marathon: [0.8, 0.65], semi: [0.75] };
export const RACE_WEEK_MAX_SHARE: Record<RaceKind, number> = { marathon: 0.45, semi: 0.5 };

export const RACES: RaceKind[] = ['marathon', 'semi'];
export const LEVELS: Level[] = ['finisher', 'l2', 'l3'];
export const SESSIONS: PlanInput['sessions'][] = [3, 4, 5];
export const LONG_RUN_DAYS: PlanInput['longRunDay'][] = ['sat', 'sun'];
export const T10S = [40 * 60, 50 * 60, 60 * 60];
export const WEEKLY_KMS = [15, 30, 50];

/** Tolérance d'arrondi admise par la SPEC de test (0,5 km). */
export const ROUNDING_KM = 0.5;
export const EPS = 1e-6;

/** Toutes les combinaisons de la SPEC section 5 (324 entrées). */
export function specGrid(): PlanInput[] {
  const grid: PlanInput[] = [];
  for (const race of RACES)
    for (const level of LEVELS)
      for (const sessions of SESSIONS)
        for (const longRunDay of LONG_RUN_DAYS)
          for (const t10 of T10S)
            for (const weeklyKm of WEEKLY_KMS)
              grid.push({ race, raceDate: RACE_DATE[race], level, t10, weeklyKm, sessions, longRunDay });
  return grid;
}

export function label(input: PlanInput): string {
  return `${input.race}/${input.level}/${input.sessions}s/${input.longRunDay}/T10=${input.t10 / 60}min/${input.weeklyKm}km/${input.raceDate}`;
}

/** Kilométrage d'entraînement de la semaine (la course exclue). */
export function trainingKm(week: Week): number {
  return week.sessions.filter((s) => s.type !== 'course').reduce((acc, s) => acc + s.km, 0);
}

const DAY_MS = 86_400_000;

export function dayNumber(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY_MS;
}

export function isoOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = lundi … 6 = dimanche. */
export function dowIdx(iso: string): number {
  return (new Date(dayNumber(iso) * DAY_MS).getUTCDay() + 6) % 7;
}

export const DOW_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function lastSession(plan: Plan) {
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  return lastWeek?.sessions[lastWeek.sessions.length - 1];
}

const floorHalf = (km: number): number => Math.floor(km * 2 + 1e-9) / 2;

/** Budget de temps hebdomadaire au pic (minutes à l'allure EF), revue du 15/10/2026. */
export const WEEKLY_MAX_MINUTES: Record<RaceKind, Record<Level, number>> = {
  marathon: { finisher: 330, l2: 390, l3: 450 },
  semi: { finisher: 270, l2: 300, l3: 330 },
};
const GOAL_SEC: Record<RaceKind, Record<'l2' | 'l3', number>> = {
  marathon: { l2: 4.5 * 3600, l3: 4 * 3600 },
  semi: { l2: 2 * 3600, l3: 1.75 * 3600 },
};
const RIEGEL_KM: Record<RaceKind, number> = { marathon: 42.195, semi: 21.0975 };

/**
 * Niveau suivi pour les volumes : le niveau choisi, ou le plus haut niveau atteignable si
 * l'objectif est plus rapide que la prédiction améliorée de 3 % (ou, au marathon, que le seuil).
 */
export function effectiveLevel(input: Pick<PlanInput, 'race' | 'level' | 't10'>): Level {
  const tooFast = (level: Level): boolean => {
    if (level === 'finisher') return false;
    const km = RIEGEL_KM[input.race];
    const predicted = input.t10 * (km / 10) ** 1.06;
    const goal = GOAL_SEC[input.race][level];
    const seuil = Math.round((input.t10 / 10) * 1.06);
    return goal < predicted * 0.97 || (input.race === 'marathon' && Math.round(goal / km) <= seuil);
  };
  const order: Level[] = input.level === 'l3' ? ['l3', 'l2', 'finisher'] : input.level === 'l2' ? ['l2', 'finisher'] : ['finisher'];
  return order.find((l) => !tooFast(l)) ?? 'finisher';
}

/** Sortie longue maximale : plafond de la SPEC (niveau suivi), et 3 h à l'allure EF (choix du moteur). */
export function longRunCap(input: PlanInput, ef: number): number {
  return Math.min(LONG_RUN_MAX_KM[input.race][effectiveLevel(input)], Math.floor((180 * 60 * 10) / ef) / 10);
}

/**
 * Volume au pic effectif (toujours ≤ pic de la SPEC) : pic du niveau suivi, borné par son budget
 * de temps à l'allure EF, -15 % avec 3 séances, et au plus 90 % de « séances × sortie longue
 * maximale » (coureurs très lents).
 */
export function effectivePeak(input: PlanInput, ef: number): number {
  const level = effectiveLevel(input);
  const byTime = floorHalf(Math.floor((WEEKLY_MAX_MINUTES[input.race][level] * 60 * 10) / ef + 1e-9) / 10);
  const peak = Math.min(PEAK_KM[input.race][level], byTime);
  const bySessions = input.sessions === 3 ? floorHalf(peak * 0.85) : peak;
  return Math.min(bySessions, floorHalf(input.sessions * longRunCap(input, ef) * 0.9));
}

/** Volume de la semaine 1 : max(weeklyKm, min(15 km, 90 min à l'allure EF)), plafonné au pic effectif. */
export function expectedStartKm(input: PlanInput, ef: number): number {
  const floor = Math.min(15, floorHalf(Math.floor((90 * 60 * 10) / ef + 1e-9) / 10));
  return Math.min(floorHalf(Math.max(input.weeklyKm, floor)), effectivePeak(input, ef));
}

/** Collecte toutes les valeurs numériques et textuelles d'un objet (contrôle NaN / undefined). */
export function walk(value: unknown, visit: (v: unknown, path: string) => void, path = '$'): void {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, visit, `${path}.${k}`);
  }
}
