import { describe, expect, it } from 'vitest';
import { PlanError, computePaces, generatePlan } from '../../src/engine';
import type { Level, RaceKind } from '../../src/engine';
import { LEVELS, RACES, TODAY } from './helpers';

const MARATHON = 42.195;
const SEMI = 21.0975;
const riegel = (t10: number, km: number): number => t10 * (km / 10) ** 1.06;

describe('computePaces', () => {
  it('prédiction de Riegel : semi ≈ 2,21 × T10, marathon ≈ 4,60 × T10', () => {
    for (const t10 of [1800, 2400, 3000, 3600, 5400]) {
      const marathon = computePaces({ race: 'marathon', level: 'finisher', t10 }).predicted.raceSec;
      const semi = computePaces({ race: 'semi', level: 'finisher', t10 }).predicted.raceSec;
      expect(marathon / t10).toBeCloseTo(4.6, 2);
      expect(semi / t10).toBeCloseTo(2.21, 2);
      expect(marathon).toBe(Math.round(riegel(t10, MARATHON)));
      expect(semi).toBe(Math.round(riegel(t10, SEMI)));
    }
  });

  it('allures dérivées : EF = allure marathon prédite × 1,20, récup = EF × 1,08, seuil = AS10 × 1,06', () => {
    for (const race of RACES) {
      const { paces } = computePaces({ race, level: 'l2', t10: 3000 });
      const ef = Math.round((riegel(3000, MARATHON) / MARATHON) * 1.2);
      expect(paces.ef).toBe(ef);
      expect(paces.recup).toBe(Math.round(ef * 1.08));
      expect(paces.as10).toBe(300);
      expect(paces.seuil).toBe(318);
    }
  });

  it('Finisher : +5 % de marge sur l\'allure course prédite, sans note', () => {
    for (const [race, km] of [
      ['marathon', MARATHON],
      ['semi', SEMI],
    ] as const) {
      const result = computePaces({ race, level: 'finisher', t10: 3300 });
      expect(result.paces.allure_course).toBe(Math.round((riegel(3300, km) / km) * 1.05));
      expect(result.note).toBeUndefined();
    }
  });

  it('objectif atteignable : allure de l\'objectif (moins de 4 h 30 avec 60 min au 10 km)', () => {
    const result = computePaces({ race: 'marathon', level: 'l2', t10: 3600 });
    expect(result.paces.allure_course).toBe(Math.round(16200 / MARATHON));
    expect(result.effectiveLevel).toBe('l2');
    expect(result.note).toBeUndefined();
  });

  it.each([
    ['marathon', 'l3', 3600, 'moins de 4 h', 'l2'],
    ['marathon', 'l3', 4500, 'moins de 4 h', 'finisher'],
    ['semi', 'l2', 3600, 'moins de 2 h', 'finisher'],
    ['semi', 'l3', 3000, 'moins de 1 h 45', 'l2'],
  ] as const)(
    'objectif irréaliste (%s %s, T10 = %i s) : le plan suit le plus haut niveau atteignable, avec une note',
    (race, level, t10, goal, followed) => {
      const km = race === 'marathon' ? MARATHON : SEMI;
      const result = computePaces({ race, level, t10 });
      expect(result.effectiveLevel).toBe(followed);
      const ceiling = Math.round((riegel(t10, km) / km) * 1.05);
      if (followed === 'finisher') {
        // Jamais plus rapide que ce que recevrait le même coureur en Finisher.
        expect(result.paces.allure_course).toBe(ceiling);
        expect(result.paces.allure_course).toBe(computePaces({ race, level: 'finisher', t10 }).paces.allure_course);
      } else {
        expect(result.paces.allure_course).toBe(computePaces({ race, level: followed, t10 }).paces.allure_course);
        expect(result.paces.allure_course).toBeLessThanOrEqual(ceiling);
      }
      const note = (result.note ?? '').replace(/\u00a0/g, ' ');
      expect(note).toMatch(new RegExp(`objectif « ${goal} » est trop ambitieux`));
      expect(note).toMatch(followed === 'finisher' ? /suit donc le niveau Finisher/ : /suit donc le niveau « moins de/);
      expect(note).toMatch(/\d:\d\d\/km/);
    },
  );

  it('prépa prudente : 5 % de marge en plus sur l\'allure course, avec une note', () => {
    const normal = computePaces({ race: 'marathon', level: 'l2', t10: 3000 });
    const cautious = computePaces({ race: 'marathon', level: 'l2', t10: 3000 }, { cautious: { longestLongRunKm: 19.2 } });
    const predictedPace = riegel(3000, MARATHON) / MARATHON;
    expect(cautious.paces.allure_course).toBe(Math.round(predictedPace * 1.05 * 1.05));
    expect(cautious.paces.allure_course).toBeGreaterThan(normal.paces.allure_course);
    expect(cautious.paces.ef).toBe(normal.paces.ef);
    expect(cautious.note).toMatch(/19,2/);
    expect(cautious.note).toMatch(/prudence/);
    expect(cautious.note).not.toMatch(/largement/);
  });

  it('objectif bien en deçà du potentiel : allure plafonnée à prédiction + 5 %, avec une note', () => {
    const result = computePaces({ race: 'marathon', level: 'l2', t10: 2400 });
    expect(result.paces.allure_course).toBe(Math.round((riegel(2400, MARATHON) / MARATHON) * 1.05));
    expect(result.note).toMatch(/largement à ta portée/);
  });

  it('ordre des allures sur toute la plage de T10 : récup > EF > allure course > AS10 ; marathon > seuil', () => {
    for (let t10 = 1800; t10 <= 5400; t10 += 30) {
      for (const race of RACES as RaceKind[]) {
        for (const level of LEVELS as Level[]) {
          const { paces } = computePaces({ race, level, t10 });
          const ctx = `${race} ${level} ${t10}`;
          expect(paces.recup, ctx).toBeGreaterThan(paces.ef);
          expect(paces.ef, ctx).toBeGreaterThan(paces.allure_course);
          expect(paces.allure_course, ctx).toBeGreaterThan(paces.as10);
          expect(paces.seuil, ctx).toBeGreaterThan(paces.as10);
          if (race === 'marathon') expect(paces.allure_course, ctx).toBeGreaterThan(paces.seuil);
          for (const value of Object.values(paces)) expect(Number.isInteger(value), ctx).toBe(true);
        }
      }
    }
  });

  it('la note d\'allure apparaît dans la semaine 1 du plan', () => {
    const plan = generatePlan(
      { race: 'marathon', raceDate: '2027-04-04', level: 'l3', t10: 3600, weeklyKm: 30, sessions: 4, longRunDay: 'sun' },
      TODAY,
    );
    expect(plan.weeks[0]!.note).toMatch(/trop ambitieux/);
    expect(plan.paces).toEqual(computePaces({ race: 'marathon', level: 'l3', t10: 3600 }).paces);
  });

  it('prépa courte (9 semaines, sortie longue < 26 km) : marge de prudence et note, sans « largement à ta portée »', () => {
    const plan = generatePlan(
      { race: 'marathon', raceDate: '2027-04-04', level: 'l2', t10: 3000, weeklyKm: 30, sessions: 4, longRunDay: 'sun', startDate: '2027-02-01' },
      TODAY,
    );
    const longest = Math.max(...plan.weeks.flatMap((w) => w.sessions.filter((s) => s.type === 'sl').map((s) => s.km)));
    expect(longest).toBeLessThan(26);
    expect(plan.paces.allure_course).toBe(Math.round((riegel(3000, MARATHON) / MARATHON) * 1.05 * 1.05));
    expect(plan.weeks[0]!.note).toMatch(/prudence/);
    expect(plan.weeks[0]!.note).not.toMatch(/largement/);
    const raceDay = plan.weeks[plan.weeks.length - 1]!.sessions.at(-1)!;
    expect(raceDay.paces[0]!.secPerKm).toBe(plan.paces.allure_course);
  });

  it('entrée invalide : PlanError INVALID_INPUT', () => {
    expect(() => computePaces({ race: 'marathon', level: 'l2', t10: 100 })).toThrow(PlanError);
    expect(() => computePaces({ race: 'trail' as RaceKind, level: 'l2', t10: 3000 })).toThrow(/marathon ou semi/);
  });
});
