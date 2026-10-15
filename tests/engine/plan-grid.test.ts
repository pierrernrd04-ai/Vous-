/**
 * Invariants sur toute la grille de la SPEC section 5 :
 * 2 courses × 3 niveaux × 3/4/5 séances × samedi/dimanche × T10 {40, 50, 60 min} × km {15, 30, 50}.
 */
import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../src/engine';
import type { Plan, PlanInput } from '../../src/engine';
import {
  DELOADS,
  NOMINAL_WEEKS,
  PHASE_RANGES,
  PLAN_START,
  TODAY,
  effectivePeak,
  label,
  longRunCap,
  specGrid,
  trainingKm,
} from './helpers';
import { checkPlanInvariants } from './invariants';

const grid = specGrid();
const plans: { input: PlanInput; plan: Plan }[] = grid.map((input) => ({ input, plan: generatePlan(input, TODAY) }));

describe('grille complète de la SPEC (324 plans)', () => {
  it('couvre bien toutes les combinaisons', () => {
    expect(grid).toHaveLength(2 * 3 * 3 * 2 * 3 * 3);
    expect(new Set(grid.map(label)).size).toBe(grid.length);
  });

  it.each(plans.map((p) => [label(p.input), p] as const))('%s : invariants', (_name, { input, plan }) => {
    checkPlanInvariants(plan, input);
  });

  it('durée nominale : 24 semaines (marathon) / 20 semaines (semi), départ le lundi 19/10/2026', () => {
    for (const { input, plan } of plans) {
      expect(plan.weeks, label(input)).toHaveLength(NOMINAL_WEEKS[input.race]);
      expect(plan.weeks[0]!.start, label(input)).toBe(PLAN_START);
      expect(plan.weeks[plan.weeks.length - 1]!.end, label(input)).toBe(input.raceDate);
    }
  });

  it('nombre de séances = séances choisies, chaque semaine, semaine de course comprise', () => {
    for (const { input, plan } of plans) {
      for (const week of plan.weeks) expect(week.sessions, `${label(input)} S${week.index}`).toHaveLength(input.sessions);
    }
  });

  it('semaines allégées aux indices de la SPEC', () => {
    for (const { input, plan } of plans) {
      const deloads = plan.weeks.filter((w) => w.deload).map((w) => w.index);
      expect(deloads, label(input)).toEqual(DELOADS[input.race]);
    }
  });

  it('S10 = semaine de Noël (21 au 27/12/2026), allégée, avec une note', () => {
    for (const { input, plan } of plans) {
      const s10 = plan.weeks[9]!;
      expect(s10.start, label(input)).toBe('2026-12-21');
      expect(s10.end, label(input)).toBe('2026-12-27');
      expect(s10.deload, label(input)).toBe(true);
      expect(s10.note, label(input)).toMatch(/Noël/);
    }
  });

  it('phases aux semaines de la SPEC', () => {
    for (const { input, plan } of plans) {
      for (const [phase, [from, to]] of Object.entries(PHASE_RANGES[input.race])) {
        const indices = plan.weeks.filter((w) => w.phase === phase).map((w) => w.index);
        expect(indices, `${label(input)} ${phase}`).toEqual(Array.from({ length: to - from + 1 }, (_, k) => from + k));
      }
    }
  });

  it('le volume atteint le pic effectif quand la progression le permet, sans jamais le dépasser', () => {
    for (const { input, plan } of plans) {
      const max = Math.max(...plan.weeks.map(trainingKm));
      expect(max, label(input)).toBeLessThanOrEqual(effectivePeak(input, plan.paces.ef) + 1e-9);
      if (input.weeklyKm >= 30) expect(max, label(input)).toBeCloseTo(effectivePeak(input, plan.paces.ef), 6);
    }
  });

  it('sortie longue la plus longue : proche du maximum du niveau, sauf limite de 3 h', () => {
    for (const { input, plan } of plans.filter((p) => p.input.weeklyKm >= 30 && p.input.sessions >= 4)) {
      const longest = Math.max(...plan.weeks.flatMap((w) => w.sessions.filter((s) => s.type === 'sl').map((s) => s.km)));
      const reachable = Math.min(longRunCap(input, plan.paces.ef), effectivePeak(input, plan.paces.ef) * 0.5);
      expect(longest, label(input)).toBeLessThanOrEqual(longRunCap(input, plan.paces.ef) + 1e-9);
      expect(longest, label(input)).toBeGreaterThanOrEqual(reachable - 0.5);
    }
  });

  it('objectifs de la décision du 14/10/2026 : marathon l2 ≈ 28-30 km, semi Finisher ≈ 15-16 km', () => {
    const longest = (p: Plan): number =>
      Math.max(...p.weeks.flatMap((w) => w.sessions.filter((s) => s.type === 'sl').map((s) => s.km)));
    for (const { input, plan } of plans.filter((p) => p.input.weeklyKm >= 30 && p.input.sessions >= 4)) {
      if (input.race === 'marathon' && input.level === 'l2' && input.t10 <= 50 * 60) {
        expect(longest(plan), label(input)).toBeGreaterThanOrEqual(27.5);
        expect(longest(plan), label(input)).toBeLessThanOrEqual(30);
      }
      if (input.race === 'semi' && input.level === 'finisher') {
        expect(longest(plan), label(input)).toBeGreaterThanOrEqual(15);
        expect(longest(plan), label(input)).toBeLessThanOrEqual(16);
      }
    }
  });

  it('chaque séance de qualité suit la phase (fartlek/côtes, fractionné/seuil, allure course)', () => {
    for (const { input, plan } of plans) {
      for (const week of plan.weeks.slice(0, -1)) {
        const q = week.sessions.find((s) => s.type === 'qualite')!;
        const ctx = `${label(input)} S${week.index}`;
        if (week.phase === 'base' && !week.deload) expect(q.title, ctx).toMatch(/^(Fartlek|Côtes)/);
        if (week.phase === 'developpement' && !week.deload) expect(q.title, ctx).toMatch(/^(Fractionné|Seuil)/);
        if (week.phase === 'specifique' || week.phase === 'affutage') expect(q.title, ctx).toMatch(/allure (marathon|semi)/);
        expect(q.steps[0], ctx).toMatch(/^Échauffement/);
        expect(q.steps[q.steps.length - 1] + q.steps.join(' '), ctx).toMatch(/Retour au calme/);
        expect(q.steps.join(' '), ctx).toMatch(/\d:\d\d\/km/);
      }
    }
  });
});
