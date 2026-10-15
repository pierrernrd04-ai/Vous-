/**
 * GET /api/preview. Le moteur est simulé (vi.mock) ; voir engine-integration.test.ts
 * pour le parcours complet avec le vrai moteur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest, onRequestGet } from '../../functions/api/preview';
import { PlanError, type PlanInput } from '../../src/engine/types';
import type { PreviewResponse } from '../../src/shared/api-types';
import { planInputToSearchParams } from '../../src/shared/query';
import { SAMPLE_INPUT, SAMPLE_PREVIEW } from './fixtures';
import { NOW, ORIGIN, call, captureConsole, expectApiError, expectSecurityHeaders } from './helpers';

type Engine = typeof import('../../src/engine/index');

const engine = vi.hoisted(() => ({
  validateInput: vi.fn<Engine['validateInput']>(),
  generatePlan: vi.fn<Engine['generatePlan']>(),
  previewPlan: vi.fn<Engine['previewPlan']>(),
  parseInputFromQuery: vi.fn<Engine['parseInputFromQuery']>(),
}));

vi.mock('../../src/engine/index', async (importOriginal) => ({
  ...(await importOriginal<Engine>()),
  ...engine,
}));

function previewRequest(query: string | URLSearchParams, init?: RequestInit): Request {
  const url = new URL('/api/preview', ORIGIN);
  url.search = String(query);
  return new Request(url, init);
}

let consoleCapture: ReturnType<typeof captureConsole>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  engine.parseInputFromQuery
    .mockReset()
    .mockImplementation((params) => Object.fromEntries(params.entries()));
  engine.validateInput.mockReset().mockReturnValue({ ok: true, input: SAMPLE_INPUT });
  engine.previewPlan.mockReset().mockReturnValue(SAMPLE_PREVIEW);
  consoleCapture = captureConsole();
});

afterEach(() => {
  consoleCapture.restore();
  vi.useRealTimers();
});

describe('GET /api/preview', () => {
  it('renvoie l’aperçu, en cache public 1 h', async () => {
    const response = await call(onRequestGet, previewRequest(planInputToSearchParams(SAMPLE_INPUT)));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expectSecurityHeaders(response);
    expect((await response.json()) as PreviewResponse).toEqual(SAMPLE_PREVIEW);

    // La query est lue par le moteur, validée, puis l'aperçu calculé pour aujourd'hui (Paris).
    const params = engine.parseInputFromQuery.mock.calls[0]?.[0];
    expect(params?.get('race')).toBe('marathon');
    expect(params?.get('t10')).toBe('3000');
    expect(engine.validateInput).toHaveBeenCalledWith(Object.fromEntries(params?.entries() ?? []));
    expect(engine.previewPlan).toHaveBeenCalledWith(SAMPLE_INPUT, '2026-10-14');
  });

  it('entrée invalide → 422 avec les messages, sans cache', async () => {
    const errors = ['Choisis un niveau : finisher, l2 ou l3.'];
    engine.validateInput.mockReturnValueOnce({ ok: false, errors });
    const response = await call(onRequestGet, previewRequest('race=marathon&level=pro'));
    const error = await expectApiError(response, 422, 'invalid_input');
    expect(error.details).toEqual(errors);
    expect(engine.previewPlan).not.toHaveBeenCalled();
  });

  it('PLAN_TOO_SHORT → 422 plan_too_short, sans cache', async () => {
    engine.previewPlan.mockImplementationOnce(() => {
      throw new PlanError('PLAN_TOO_SHORT', ['Ta course est trop proche pour un plan complet.']);
    });
    const response = await call(onRequestGet, previewRequest(planInputToSearchParams(SAMPLE_INPUT)));
    await expectApiError(response, 422, 'plan_too_short');
  });

  it('query démesurée → 400 sans solliciter le moteur', async () => {
    const response = await call(onRequestGet, previewRequest(`raceName=${'x'.repeat(3000)}`));
    await expectApiError(response, 400, 'bad_request');
    expect(engine.parseInputFromQuery).not.toHaveBeenCalled();
  });

  it('exception inattendue → 500 internal_error', async () => {
    engine.previewPlan.mockImplementationOnce(() => {
      throw new RangeError('boum');
    });
    const response = await call(onRequestGet, previewRequest('race=semi'));
    await expectApiError(response, 500, 'internal_error');
    expect(consoleCapture.output()).toContain('api/preview');
  });

  it.each(['POST', 'PUT', 'DELETE'])('%s → 405 avec Allow: GET', async (method) => {
    const response = await call(onRequest, previewRequest('', { method }));
    expect(response.headers.get('Allow')).toBe('GET');
    await expectApiError(response, 405, 'method_not_allowed');
  });

  it('accepte une entrée normalisée différente de la query brute', async () => {
    const normalized: PlanInput = { ...SAMPLE_INPUT, sessions: 5 };
    engine.validateInput.mockReturnValueOnce({ ok: true, input: normalized });
    await call(onRequest, previewRequest('sessions=5'));
    expect(engine.previewPlan).toHaveBeenCalledWith(normalized, '2026-10-14');
  });
});
