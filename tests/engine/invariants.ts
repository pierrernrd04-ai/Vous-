/**
 * Invariants vérifiés sur TOUS les plans générés (durée nominale, date libre, plan tardif).
 */
import { expect } from 'vitest';
import type { Plan, PlanInput, Week } from '../../src/engine';
import {
  DOW_NAMES,
  EPS,
  LONG_RUN_MAX_GAIN_KM,
  LONG_RUN_MAX_KM,
  LONG_RUN_SHARE,
  NOMINAL_WEEKS,
  PEAK_KM,
  RACE_KM,
  RACE_WEEK_MAX_SHARE,
  ROUNDING_KM,
  TAPER,
  dayNumber,
  dowIdx,
  effectivePeak,
  isoOf,
  label,
  trainingKm,
  walk,
} from './helpers';

const PHASE_ORDER: Week['phase'][] = ['base', 'developpement', 'specifique', 'affutage'];

function containsChristmas(week: Week): boolean {
  const first = dayNumber(week.start);
  for (let d = first; d <= first + 6; d += 1) if (isoOf(d).slice(5) === '12-25') return true;
  return false;
}

/** Dernière semaine non allégée avant l'affûtage : référence de l'affûtage. */
export function taperReference(plan: Plan): Week {
  const taperLength = plan.input.race === 'marathon' ? 3 : 2;
  const loading = plan.weeks.slice(0, plan.weeks.length - taperLength).filter((w) => !w.deload);
  const ref = loading[loading.length - 1];
  if (!ref) throw new Error('aucune semaine chargée');
  return ref;
}

interface SoftMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeNull(): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, digits?: number): void;
  toHaveLength(expected: number): void;
  toMatch(pattern: RegExp): void;
  not: { toBe(expected: unknown): void; toMatch(pattern: RegExp): void };
}

/**
 * `expect` « doux » : enregistre les écarts au lieu de lever une exception. Des milliers de
 * vérifications par plan restent ainsi rapides ; un seul `expect` final les rapporte toutes.
 */
function softExpect(failures: string[]): (actual: unknown, message?: string) => SoftMatchers {
  return (actual, message = '') => {
    const check = (ok: boolean, what: string): void => {
      if (!ok) failures.push(`${message} — attendu ${what}, reçu ${JSON.stringify(actual)}`);
    };
    const num = actual as number;
    return {
      toBe: (e) => check(Object.is(actual, e), `${JSON.stringify(e)}`),
      toEqual: (e) => check(JSON.stringify(actual) === JSON.stringify(e), `${JSON.stringify(e)}`),
      toBeNull: () => check(actual === null, 'null'),
      toBeGreaterThan: (e) => check(num > e, `> ${e}`),
      toBeGreaterThanOrEqual: (e) => check(num >= e, `≥ ${e}`),
      toBeLessThan: (e) => check(num < e, `< ${e}`),
      toBeLessThanOrEqual: (e) => check(num <= e, `≤ ${e}`),
      toBeCloseTo: (e, digits = 2) => check(Math.abs(num - e) < 10 ** -digits / 2, `≈ ${e}`),
      toHaveLength: (e) => check((actual as { length: number }).length === e, `longueur ${e}`),
      toMatch: (re) => check(re.test(String(actual)), `${re}`),
      not: {
        toBe: (e) => check(!Object.is(actual, e), `≠ ${JSON.stringify(e)}`),
        toMatch: (re) => check(!re.test(String(actual)), `sans ${re}`),
      },
    };
  };
}

export function checkPlanInvariants(plan: Plan, input: PlanInput): void {
  const failures: string[] = [];
  const soft = softExpect(failures);
  const ctx = label(input);
  const { weeks } = plan;
  const n = weeks.length;
  const race = input.race;
  const taperLength = race === 'marathon' ? 3 : 2;

  // Pas de NaN, d'Infinity ni de texte « undefined »
  walk(plan, (v, path) => {
    if (typeof v === 'number') soft(Number.isFinite(v), `${ctx} ${path}`).toBe(true);
    if (typeof v === 'string') soft(v, `${ctx} ${path}`).not.toMatch(/undefined|NaN|null|Infinity/);
  });

  // Durée
  soft(n, ctx).toBeGreaterThanOrEqual(8);
  soft(n, ctx).toBeLessThanOrEqual(NOMINAL_WEEKS[race]);

  // Semaines contiguës, du lundi au dimanche
  weeks.forEach((week, i) => {
    soft(week.index, ctx).toBe(i + 1);
    soft(dowIdx(week.start), `${ctx} S${week.index} commence un lundi`).toBe(0);
    soft(dayNumber(week.end) - dayNumber(week.start), ctx).toBe(6);
    if (i > 0) soft(dayNumber(week.start), ctx).toBe(dayNumber(weeks[i - 1]!.end) + 1);
  });

  // Course : dernière séance, à la date de course, distance officielle, unique
  const all = weeks.flatMap((w) => w.sessions);
  const races = all.filter((s) => s.type === 'course');
  soft(races, ctx).toHaveLength(1);
  const last = all[all.length - 1]!;
  soft(last.type, ctx).toBe('course');
  soft(last.date, ctx).toBe(input.raceDate);
  soft(last.km, ctx).toBe(RACE_KM[race]);
  soft(last.loopKm, ctx).toBeNull();
  soft(dayNumber(weeks[n - 1]!.start) <= dayNumber(input.raceDate), ctx).toBe(true);
  soft(dayNumber(weeks[n - 1]!.end) >= dayNumber(input.raceDate), ctx).toBe(true);

  // Phases dans l'ordre, chacune présente, affûtage = 3 / 2 dernières semaines
  const phases = weeks.map((w) => w.phase);
  let cursor = 0;
  for (const phase of phases) {
    const idx = PHASE_ORDER.indexOf(phase);
    soft(idx >= cursor, `${ctx} ordre des phases`).toBe(true);
    cursor = idx;
  }
  for (const phase of PHASE_ORDER) soft(phases.includes(phase), `${ctx} phase ${phase}`).toBe(true);
  soft(phases.slice(-taperLength).every((p) => p === 'affutage'), ctx).toBe(true);
  soft(phases.filter((p) => p === 'affutage'), ctx).toHaveLength(taperLength);

  // Séances : dates dans la semaine, triées, une par jour, jour cohérent
  for (const week of weeks) {
    const wctx = `${ctx} S${week.index}`;
    let previous = -1;
    for (const s of week.sessions) {
      const d = dayNumber(s.date);
      soft(d >= dayNumber(week.start) && d <= dayNumber(week.end), wctx).toBe(true);
      soft(d > previous, `${wctx} tri / unicité`).toBe(true);
      previous = d;
      soft(s.dow, wctx).toBe(DOW_NAMES[dowIdx(s.date)]);
      soft(s.title.length, wctx).toBeGreaterThan(0);
      soft(s.steps.length, wctx).toBeGreaterThan(0);
      soft(s.durationMin, wctx).toBeGreaterThan(0);
      for (const p of s.paces) {
        soft(p.label.length, wctx).toBeGreaterThan(0);
        soft(p.secPerKm, wctx).toBeGreaterThan(0);
      }
      if (s.type === 'renfo') {
        soft(s.km, wctx).toBe(0);
        soft(s.loopKm, wctx).toBeNull();
      } else if (s.type !== 'course') {
        soft(s.km, wctx).toBeGreaterThan(0);
        soft(s.loopKm, wctx).toBe(Math.round(s.km * 2) / 2);
        soft(s.paces.length, wctx).toBeGreaterThan(0);
      }
      soft(d <= dayNumber(input.raceDate), `${wctx} aucune séance après la course`).toBe(true);
    }
    // Kilométrage de la semaine = somme des séances
    soft(Math.abs(week.km - week.sessions.reduce((a, s) => a + s.km, 0)), wctx).toBeLessThan(EPS);
  }

  // Nombre de séances par semaine
  weeks.forEach((week, i) => {
    if (i < n - 1) soft(week.sessions, `${ctx} S${week.index}`).toHaveLength(input.sessions);
  });
  // Semaine de course : autant de séances que d'habitude si les jours le permettent ;
  // pour un très petit volume, des footings de récupération peuvent être retirés.
  const raceDow = dowIdx(input.raceDate);
  const raceWeekCount = weeks[n - 1]!.sessions.length;
  soft(raceWeekCount, `${ctx} semaine de course`).toBeLessThanOrEqual(Math.min(input.sessions, raceDow + 1));
  soft(raceWeekCount, `${ctx} semaine de course`).toBeGreaterThanOrEqual(Math.min(input.sessions, raceDow + 1, 3));

  // Volumes : jamais au-dessus du pic, départ à max(weeklyKm, 15)
  const peak = PEAK_KM[race][input.level];
  for (const week of weeks) {
    soft(trainingKm(week), `${ctx} S${week.index} ≤ pic`).toBeLessThanOrEqual(peak + EPS);
    soft(trainingKm(week), `${ctx} S${week.index} ≤ pic effectif`).toBeLessThanOrEqual(effectivePeak(input, plan.paces.ef) + EPS);
  }
  const expectedStart = Math.min(Math.floor(Math.max(input.weeklyKm, 15) * 2) / 2, effectivePeak(input, plan.paces.ef));
  soft(weeks[0]!.km, `${ctx} S1`).toBeCloseTo(expectedStart, 6);

  // +10 % maximum par rapport à la dernière semaine non allégée
  let lastLoad = trainingKm(weeks[0]!);
  for (const week of weeks.slice(1)) {
    if (week.deload) continue;
    const km = trainingKm(week);
    soft(km, `${ctx} S${week.index} +10 %`).toBeLessThanOrEqual(lastLoad * 1.1 + ROUNDING_KM);
    lastLoad = km;
  }

  // Semaines allégées : ni S1, ni affûtage, jamais deux de suite, -25 à -30 %
  let lastLoaded = weeks[0]!;
  weeks.forEach((week, i) => {
    if (!week.deload) {
      lastLoaded = week;
      return;
    }
    const wctx = `${ctx} S${week.index} allégée`;
    soft(i, wctx).toBeGreaterThan(0);
    soft(week.phase, wctx).not.toBe('affutage');
    soft(weeks[i - 1]!.deload, wctx).toBe(false);
    const ref = trainingKm(lastLoaded);
    soft(week.km, wctx).toBeGreaterThanOrEqual(ref * 0.7 - 0.25);
    soft(week.km, wctx).toBeLessThanOrEqual(ref * 0.75 + 0.25);
    soft(week.note ?? '', wctx).toMatch(/Semaine allégée/);
  });
  const deloadCount = weeks.filter((w) => w.deload).length;
  soft(deloadCount, `${ctx} au moins une semaine allégée`).toBeGreaterThanOrEqual(1);

  // Affûtage
  const ref = taperReference(plan);
  const refKm = trainingKm(ref);
  TAPER[race].forEach((factor, k) => {
    const week = weeks[n - taperLength + k]!;
    soft(Math.abs(week.km - refKm * factor), `${ctx} affûtage S${week.index}`).toBeLessThanOrEqual(0.25 + EPS);
  });
  const raceWeek = weeks[n - 1]!;
  const raceWeekTraining = trainingKm(raceWeek);
  soft(raceWeekTraining, `${ctx} semaine de course`).toBeLessThanOrEqual(refKm * RACE_WEEK_MAX_SHARE[race] + EPS);
  soft(raceWeekTraining, `${ctx} semaine de course`).toBeLessThan(trainingKm(weeks[n - 2]!));
  if (raceDow > 0) soft(raceWeekTraining, `${ctx} semaine de course`).toBeGreaterThan(0);
  for (let i = n - taperLength; i < n - 1; i += 1) {
    soft(weeks[i]!.km, `${ctx} affûtage décroissant`).toBeLessThan(i === n - taperLength ? refKm : weeks[i - 1]!.km);
  }

  // Sorties longues : plafond du niveau, 3 h à l'allure EF, part selon la phase,
  // +2 km au plus par rapport à la sortie longue de la dernière semaine non allégée.
  const cap = LONG_RUN_MAX_KM[race][input.level];
  let previousLoadLong: number | null = null;
  for (const week of weeks.slice(0, n - 1)) {
    const wctx = `${ctx} S${week.index}`;
    const longRuns = week.sessions.filter((s) => s.type === 'sl');
    soft(longRuns, wctx).toHaveLength(1);
    const sl = longRuns[0]!;
    soft(sl.dow, wctx).toBe(input.longRunDay);
    soft(sl.km, wctx).toBeLessThanOrEqual(cap + EPS);
    soft(sl.km * plan.paces.ef, `${wctx} SL ≤ 3 h`).toBeLessThanOrEqual(180 * 60 + EPS);
    const share = LONG_RUN_SHARE[week.phase];
    soft(sl.km, `${wctx} SL ≤ ${share * 100} %`).toBeLessThanOrEqual(share * week.km + EPS);
    if (previousLoadLong !== null) {
      soft(sl.km, `${wctx} SL +2 km max`).toBeLessThanOrEqual(previousLoadLong + LONG_RUN_MAX_GAIN_KM + EPS);
    }
    if (!week.deload) previousLoadLong = sl.km;
    for (const s of week.sessions) {
      if (s.type === 'ef' || s.type === 'recup') soft(s.km, `${wctx} footing ≤ SL`).toBeLessThanOrEqual(sl.km + EPS);
    }
    const qualities = week.sessions.filter((s) => s.type === 'qualite');
    soft(qualities, wctx).toHaveLength(1);
    soft(qualities[0]!.dow, wctx).toBe('thu');
    soft(qualities[0]!.km, `${wctx} qualité ≤ SL`).toBeLessThanOrEqual(sl.km + EPS);
  }
  soft(raceWeek.sessions.filter((s) => s.type === 'sl'), ctx).toHaveLength(0);

  // Semaine type
  for (const week of weeks.slice(0, n - 1)) {
    const days = week.sessions.map((s) => s.dow);
    const expected = ['tue', 'thu', input.longRunDay];
    if (input.sessions >= 4) expected.push(input.longRunDay === 'sun' ? 'sat' : 'sun');
    if (input.sessions === 5) expected.push('wed');
    soft([...days].sort(), `${ctx} S${week.index} jours`).toEqual([...expected].sort());
  }

  // Noël : semaine allégée si hors affûtage (et pas S1) pour une durée non nominale
  if (n !== NOMINAL_WEEKS[race]) {
    weeks.forEach((week, i) => {
      if (containsChristmas(week) && i >= 1 && week.phase !== 'affutage') {
        soft(week.deload, `${ctx} S${week.index} Noël`).toBe(true);
      }
    });
  }

  // Les allures citées dans les consignes sont celles du plan (min:ss/km)
  const fmt = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km`;
  const known = new Set(Object.values(plan.paces).map(fmt));
  for (const s of all) {
    for (const match of s.steps.join(' ').matchAll(/\d+:\d\d\/km/g)) {
      soft(known.has(match[0]), `${ctx} ${s.date} allure ${match[0]}`).toBe(true);
    }
    for (const pace of s.paces) soft(known.has(fmt(pace.secPerKm)), `${ctx} ${s.date} ${pace.label}`).toBe(true);
  }

  // Allures
  const p = plan.paces;
  soft(p.recup, ctx).toBeGreaterThan(p.ef);
  soft(p.ef, ctx).toBeGreaterThan(p.allure_course);
  soft(p.allure_course, ctx).toBeGreaterThan(p.as10);
  soft(p.seuil, ctx).toBeGreaterThan(p.as10);
  if (race === 'marathon') soft(p.allure_course, ctx).toBeGreaterThan(p.seuil);

  // Total
  soft(Math.abs(plan.totalKm - weeks.reduce((a, w) => a + w.km, 0)), ctx).toBeLessThan(EPS);

  expect(failures.slice(0, 20), `${ctx} : ${failures.length} écart(s)`).toEqual([]);
}
