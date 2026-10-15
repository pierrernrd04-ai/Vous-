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

  it('objectif atteignable : allure de l\'objectif (sub-4h30 avec 60 min au 10 km)', () => {
    const result = computePaces({ race: 'marathon', level: 'l2', t10: 3600 });
    expect(result.paces.allure_course).toBe(Math.round(16200 / MARATHON));
    expect(result.note).toBeUndefined();
  });

  it.each([
    ['marathon', 'l3', 3600, 'sub-4h'],
    ['semi', 'l2', 3600, 'sub-2h'],
    ['semi', 'l3', 3000, 'sub-1h45'],
  ] as const)('objectif irréaliste (%s %s, T10 = %i s) : allure prédite et note', (race, level, t10, goal) => {
    const km = race === 'marathon' ? MARATHON : SEMI;
    const result = computePaces({ race, level, t10 });
    expect(result.paces.allure_course).toBe(Math.round(riegel(t10, km) / km));
    expect(result.note).toMatch(new RegExp(`objectif ${goal} est trop ambitieux`));
    expect(result.note).toMatch(/\d:\d\d\/km/);
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

  it('entrée invalide : PlanError INVALID_INPUT', () => {
    expect(() => computePaces({ race: 'marathon', level: 'l2', t10: 100 })).toThrow(PlanError);
    expect(() => computePaces({ race: 'trail' as RaceKind, level: 'l2', t10: 3000 })).toThrow(/marathon ou semi/);
  });
});
