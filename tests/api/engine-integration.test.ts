/**
 * Parcours de bout en bout des Functions avec le VRAI moteur (src/engine).
 * Ignoré tant que le moteur répond « not implemented » (développement en parallèle) ;
 * s'active de lui-même dès qu'il est livré.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as planPost } from '../../functions/api/plan';
import { onRequestGet as previewGet } from '../../functions/api/preview';
import {
  generatePlan,
  parseInputFromQuery,
  previewPlan,
  validateInput,
} from '../../src/engine/index';
import type { Plan, PlanInput, PlanPreview } from '../../src/engine/types';
import { isApiError } from '../../src/shared/api-types';
import { planInputToSearchParams } from '../../src/shared/query';
import { buildTokenPayload, signToken } from '../../src/shared/token';
import { NOW, NOW_SEC, ORIGIN, TEST_SECRET, call, captureConsole } from './helpers';

/** Entrée de référence de la SPEC : marathon de Paris, jour 1 = lundi 19/10/2026, 24 semaines. */
const PARIS_MARATHON: PlanInput = {
  race: 'marathon',
  raceDate: '2027-04-04',
  raceName: 'Marathon de Paris',
  level: 'l2',
  t10: 3000,
  weeklyKm: 30,
  sessions: 4,
  longRunDay: 'sun',
  startDate: '2026-10-19',
};

function isNotImplemented(error: unknown): boolean {
  return error instanceof Error && /not implemented/i.test(error.message);
}

/** Vrai si aucune fonction du moteur utilisée par l'API n'est encore un bouchon. */
function engineIsImplemented(): boolean {
  const probes = [
    () => validateInput(PARIS_MARATHON),
    () => parseInputFromQuery(planInputToSearchParams(PARIS_MARATHON)),
    () => previewPlan(PARIS_MARATHON, '2026-10-14'),
    () => generatePlan(PARIS_MARATHON, '2026-10-14'),
  ];
  return probes.every((probe) => {
    try {
      probe();
      return true;
    } catch (error) {
      return !isNotImplemented(error);
    }
  });
}

const ready = engineIsImplemented();

describe.skipIf(!ready)('API + moteur réel', () => {
  let consoleCapture: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    consoleCapture = captureConsole();
  });

  afterEach(() => {
    consoleCapture.restore();
    vi.useRealTimers();
  });

  async function postPlan(body: unknown): Promise<Response> {
    return call(
      planPost,
      new Request(new URL('/api/plan', ORIGIN), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  const token = () =>
    signToken(buildTokenPayload({ email: 'a@b.fr', sid: 'cs_live_abc', nowSec: NOW_SEC }), TEST_SECRET);

  it('GET /api/preview renvoie la semaine 1 et la vue d’ensemble', async () => {
    const url = new URL('/api/preview', ORIGIN);
    url.search = planInputToSearchParams(PARIS_MARATHON).toString();
    const response = await call(previewGet, new Request(url));
    expect(response.status, await response.clone().text()).toBe(200);
    const preview = (await response.json()) as PlanPreview;
    expect(preview.week1.index).toBe(1);
    expect(preview.week1.start).toBe('2026-10-19');
    expect(preview.overview).toHaveLength(24);
  });

  it('POST /api/plan renvoie les 24 semaines, la course en dernière séance', async () => {
    const response = await postPlan({ token: await token(), input: PARIS_MARATHON });
    expect(response.status, await response.clone().text()).toBe(200);
    const plan = (await response.json()) as Plan;
    expect(plan.weeks).toHaveLength(24);
    const lastWeek = plan.weeks.at(-1);
    expect(lastWeek?.sessions.some((s) => s.type === 'course' && s.date === '2027-04-04')).toBe(true);
  });

  it('POST /api/plan : entrée invalide → 422 avec des messages', async () => {
    const response = await postPlan({ token: await token(), input: { ...PARIS_MARATHON, t10: 60 } });
    expect(response.status).toBe(422);
    const body: unknown = await response.json();
    expect(isApiError(body)).toBe(true);
    if (isApiError(body)) {
      expect(body.error).toBe('invalid_input');
      expect(body.details?.length).toBeGreaterThan(0);
    }
  });

  it('POST /api/plan : course dans moins de 8 semaines → 422', async () => {
    // Sans startDate : le plan démarrerait cette semaine, à 5 semaines de la course.
    const tooClose: PlanInput = {
      race: 'marathon',
      raceDate: '2026-11-15',
      level: 'finisher',
      t10: 3000,
      weeklyKm: 30,
      sessions: 4,
      longRunDay: 'sun',
    };
    const response = await postPlan({ token: await token(), input: tooClose });
    expect(response.status).toBe(422);
    const body: unknown = await response.json();
    expect(isApiError(body) && ['plan_too_short', 'invalid_input'].includes(body.error)).toBe(true);
  });
});
