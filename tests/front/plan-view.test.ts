/**
 * Volume affiché par semaine : la semaine de course compte la course dans `km`
 * (décision du 14/10/2026) ; graphiques et « au plus fort » montrent l'entraînement seul.
 */
import { describe, expect, it } from 'vitest';
import { generatePlan, previewPlan } from '../../src/engine/index';
import { formatKm, formatRaceKm } from '../../src/lib/format';
import { trainingKmByWeek } from '../../src/lib/plan-view';
import type { PlanInput } from '../../src/shared/api-types';

const TODAY = '2026-10-14';
const MARATHON: PlanInput = {
  race: 'marathon',
  raceDate: '2027-04-04',
  level: 'l2',
  t10: 50 * 60,
  weeklyKm: 30,
  sessions: 4,
  longRunDay: 'sun',
};
const SEMI: PlanInput = { ...MARATHON, race: 'semi', raceDate: '2027-03-07', level: 'finisher' };

describe('trainingKmByWeek', () => {
  for (const input of [MARATHON, SEMI]) {
    it(`${input.race} : la course est retirée de la dernière semaine, rien d'autre ne change`, () => {
      const plan = generatePlan(input, TODAY);
      const km = trainingKmByWeek(plan.weeks, input.race);
      const last = plan.weeks[plan.weeks.length - 1]!;
      const race = last.sessions.find((s) => s.type === 'course')!;
      expect(km.slice(0, -1)).toEqual(plan.weeks.slice(0, -1).map((w) => w.km));
      expect(km[km.length - 1]).toBeCloseTo(last.km - race.km, 6);
      // Le pic affiché est celui de l'entraînement, jamais la semaine de course.
      expect(Math.max(...km)).toBe(Math.max(...plan.weeks.slice(0, -1).map((w) => w.km)));
    });

    it(`${input.race} : même résultat depuis l'aperçu (sans le détail des séances)`, () => {
      const plan = generatePlan(input, TODAY);
      const preview = previewPlan(input, TODAY);
      const fromPlan = trainingKmByWeek(plan.weeks, input.race);
      const fromOverview = trainingKmByWeek(preview.overview, input.race);
      fromOverview.forEach((km, i) => expect(km).toBeCloseTo(fromPlan[i]!, 6));
    });
  }
});

describe('formatRaceKm', () => {
  it('garde la distance officielle, contrairement à formatKm', () => {
    expect(formatRaceKm(42.195)).toBe('42,195 km');
    expect(formatRaceKm(21.1)).toBe('21,1 km');
    expect(formatKm(42.195)).toBe('42,2 km');
  });
});
