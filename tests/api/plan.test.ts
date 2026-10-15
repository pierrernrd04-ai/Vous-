/**
 * POST /api/plan. Le moteur est simulé (vi.mock) : ces tests ne dépendent que du
 * contrat de src/engine/index.ts. Le parcours avec le vrai moteur est couvert
 * par engine-integration.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest, onRequestPost } from '../../functions/api/plan';
import { PlanError, type PlanInput } from '../../src/engine/types';
import { PLAN_REQUEST_MAX_BYTES, type PlanResponse } from '../../src/shared/api-types';
import { buildTokenPayload, signToken } from '../../src/shared/token';
import { SAMPLE_INPUT, SAMPLE_PLAN } from './fixtures';
import {
  BASE_ENV,
  NOW,
  NOW_SEC,
  ORIGIN,
  TEST_SECRET,
  call,
  captureConsole,
  expectApiError,
  expectSecurityHeaders,
} from './helpers';

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

const OTHER_SECRET = 'un-autre-secret-0123456789-abcdefghijklmnop';

function planRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request(new URL('/api/plan', ORIGIN), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

function validToken(nowSec = NOW_SEC, secret = TEST_SECRET): Promise<string> {
  return signToken(
    buildTokenPayload({ email: 'coureuse@example.fr', sid: 'cs_live_abc', ref: 'w1-marathon-l2', nowSec }),
    secret,
  );
}

let consoleCapture: ReturnType<typeof captureConsole>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  engine.validateInput.mockReset().mockImplementation((raw) => ({ ok: true, input: raw as PlanInput }));
  engine.generatePlan.mockReset().mockReturnValue(SAMPLE_PLAN);
  consoleCapture = captureConsole();
});

afterEach(() => {
  const logs = consoleCapture.output();
  consoleCapture.restore();
  vi.useRealTimers();
  expect(logs).not.toContain(TEST_SECRET);
});

describe('POST /api/plan — succès', () => {
  it('renvoie le plan généré, en no-store, avec les en-têtes de sécurité', async () => {
    const token = await validToken();
    const response = await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expectSecurityHeaders(response);
    expect((await response.json()) as PlanResponse).toEqual(SAMPLE_PLAN);

    expect(engine.validateInput).toHaveBeenCalledWith(SAMPLE_INPUT);
    // `today` = date du jour à Paris.
    expect(engine.generatePlan).toHaveBeenCalledWith(SAMPLE_INPUT, '2026-10-14');
  });

  it('passe au moteur l’entrée normalisée par validateInput', async () => {
    const normalized: PlanInput = { ...SAMPLE_INPUT, raceName: 'Marathon de Paris 2027' };
    engine.validateInput.mockReturnValueOnce({ ok: true, input: normalized });
    const token = await validToken();
    await call(onRequestPost, planRequest({ token, input: { ...SAMPLE_INPUT, extra: 1 } }));
    expect(engine.generatePlan).toHaveBeenCalledWith(normalized, '2026-10-14');
  });

  it('accepte un corps d’exactement 4 Ko', async () => {
    const token = await validToken();
    const base = JSON.stringify({ token, input: SAMPLE_INPUT, pad: '' });
    const body = JSON.stringify({ token, input: SAMPLE_INPUT, pad: 'x'.repeat(PLAN_REQUEST_MAX_BYTES - base.length) });
    expect(new TextEncoder().encode(body).byteLength).toBe(PLAN_REQUEST_MAX_BYTES);
    expect((await call(onRequestPost, planRequest(body))).status).toBe(200);
  });
});

describe('POST /api/plan — jeton (401)', () => {
  const cases: [string, () => Promise<unknown>][] = [
    ['jeton absent', () => Promise.resolve(undefined)],
    ['jeton vide', () => Promise.resolve('')],
    ['jeton non textuel', () => Promise.resolve(12345)],
    ['jeton mal formé', () => Promise.resolve('pas-un-jeton')],
    ['jeton signé avec un autre secret', () => validToken(NOW_SEC, OTHER_SECRET)],
    [
      'jeton altéré',
      async () => {
        const token = await validToken();
        return `${token.slice(0, 10)}${token.charAt(10) === 'A' ? 'B' : 'A'}${token.slice(11)}`;
      },
    ],
    [
      'jeton expiré',
      () =>
        signToken({ v: 1, sub: 'a@b.fr', sid: 'cs_live_x', ref: '', iat: NOW_SEC - 100, exp: NOW_SEC - 1 }, TEST_SECRET),
    ],
  ];

  it.each(cases)('%s', async (_label, makeToken) => {
    const token = await makeToken();
    const response = await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT }));
    expectSecurityHeaders(response);
    await expectApiError(response, 401, 'invalid_token');
    // Le jeton est contrôlé avant l'entrée : rien n'est calculé sans accès.
    expect(engine.validateInput).not.toHaveBeenCalled();
    expect(engine.generatePlan).not.toHaveBeenCalled();
  });
});

describe('POST /api/plan — jeton de test et accès désactivés (401)', () => {
  const testToken = () =>
    signToken(buildTokenPayload({ email: 'a@b.fr', sid: 'cs_test_a1FakePreviewSession', nowSec: NOW_SEC }), TEST_SECRET);

  it('jeton émis pour un paiement de test : refusé avec une clé réelle', async () => {
    const response = await call(onRequestPost, planRequest({ token: await testToken(), input: SAMPLE_INPUT }));
    const body = await expectApiError(response, 401, 'invalid_token');
    expect(body.message).toMatch(/paiement de test/);
    expect(engine.generatePlan).not.toHaveBeenCalled();
  });

  it('jeton émis pour un paiement de test : refusé sans clé Stripe (site PayPal seul)', async () => {
    const { STRIPE_KEY: _ignored, ...env } = BASE_ENV;
    const response = await call(onRequestPost, planRequest({ token: await testToken(), input: SAMPLE_INPUT }), env);
    await expectApiError(response, 401, 'invalid_token');
  });

  it('jeton émis pour un paiement de test : accepté sur un déploiement de test', async () => {
    const env = { ...BASE_ENV, STRIPE_KEY: 'rk_test_previewKey' };
    const response = await call(onRequestPost, planRequest({ token: await testToken(), input: SAMPLE_INPUT }), env);
    expect(response.status).toBe(200);
  });

  it('accès désactivé par REVOKED_SIDS (remboursement) : refusé', async () => {
    const env = { ...BASE_ENV, REVOKED_SIDS: ' cs_live_zzz , cs_live_abc,paypal:9XY' };
    const response = await call(onRequestPost, planRequest({ token: await validToken(), input: SAMPLE_INPUT }), env);
    const body = await expectApiError(response, 401, 'invalid_token');
    expect(body.message).toMatch(/désactivé/);
    expect(engine.generatePlan).not.toHaveBeenCalled();
  });

  it('REVOKED_SIDS sans cet achat : accès conservé', async () => {
    const env = { ...BASE_ENV, REVOKED_SIDS: 'cs_live_autre' };
    const response = await call(onRequestPost, planRequest({ token: await validToken(), input: SAMPLE_INPUT }), env);
    expect(response.status).toBe(200);
  });
});

describe('POST /api/plan — entrée (422)', () => {
  it('renvoie les erreurs de validation du moteur', async () => {
    const errors = [
      'Le temps sur 10 km doit être compris entre 30 et 90 minutes.',
      'Le nombre de séances doit être 3, 4 ou 5.',
    ];
    engine.validateInput.mockReturnValueOnce({ ok: false, errors });
    const token = await validToken();
    const response = await call(onRequestPost, planRequest({ token, input: { ...SAMPLE_INPUT, t10: 10 } }));
    const error = await expectApiError(response, 422, 'invalid_input');
    expect(error.details).toEqual(errors);
    expect(engine.generatePlan).not.toHaveBeenCalled();
  });

  it('input absent : validé par le moteur comme une entrée vide', async () => {
    engine.validateInput.mockReturnValueOnce({ ok: false, errors: ['Choisis une course.'] });
    const token = await validToken();
    const response = await call(onRequestPost, planRequest({ token }));
    expect(engine.validateInput).toHaveBeenCalledWith(undefined);
    await expectApiError(response, 422, 'invalid_input');
  });

  it('PLAN_TOO_SHORT → 422 plan_too_short avec le message du moteur', async () => {
    const message = 'Ta course est dans 5 semaines : il en faut au moins 8 pour ce programme.';
    engine.generatePlan.mockImplementationOnce(() => {
      throw new PlanError('PLAN_TOO_SHORT', [message]);
    });
    const token = await validToken();
    const response = await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT }));
    const error = await expectApiError(response, 422, 'plan_too_short');
    expect(error.message).toBe(message);
    expect(error.details).toEqual([message]);
  });

  it('PlanError INVALID_INPUT levée à la génération → 422 invalid_input', async () => {
    engine.generatePlan.mockImplementationOnce(() => {
      throw new PlanError('INVALID_INPUT', ['La date de course doit être un dimanche ou un autre jour valide.']);
    });
    const token = await validToken();
    const error = await expectApiError(
      await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT })),
      422,
      'invalid_input',
    );
    expect(error.details).toHaveLength(1);
  });
});

describe('POST /api/plan — corps de requête', () => {
  it('JSON invalide → 400', async () => {
    await expectApiError(await call(onRequestPost, planRequest('{"token": ')), 400, 'bad_request');
  });

  it('corps vide → 400', async () => {
    await expectApiError(await call(onRequestPost, planRequest('')), 400, 'bad_request');
  });

  it.each([['[]'], ['null'], ['"texte"'], ['42']])('corps %s (pas un objet) → 400', async (body) => {
    await expectApiError(await call(onRequestPost, planRequest(body)), 400, 'bad_request');
  });

  it('UTF-8 invalide → 400', async () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]); // {"\xff":1}
    const request = new Request(new URL('/api/plan', ORIGIN), { method: 'POST', body: bytes });
    await expectApiError(await call(onRequestPost, request), 400, 'bad_request');
  });

  it('corps de plus de 4 Ko (lu en flux) → 413', async () => {
    const token = await validToken();
    const body = JSON.stringify({ token, input: SAMPLE_INPUT, pad: 'x'.repeat(PLAN_REQUEST_MAX_BYTES) });
    await expectApiError(await call(onRequestPost, planRequest(body)), 413, 'payload_too_large');
    expect(engine.generatePlan).not.toHaveBeenCalled();
  });

  it('Content-Length annoncé trop grand → 413 sans lire le corps', async () => {
    const request = planRequest('{}');
    const withLength = new Request(request, {
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(PLAN_REQUEST_MAX_BYTES + 1) },
    });
    expect(withLength.headers.get('Content-Length')).toBe(String(PLAN_REQUEST_MAX_BYTES + 1));
    await expectApiError(await call(onRequestPost, withLength), 413, 'payload_too_large');
  });
});

describe('POST /api/plan — erreurs serveur', () => {
  it('TOKEN_SECRET absent ou trop court → 500 server_misconfigured', async () => {
    const token = await validToken();
    for (const env of [{ ...BASE_ENV, TOKEN_SECRET: undefined }, { ...BASE_ENV, TOKEN_SECRET: 'court' }]) {
      const response = await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT }), env);
      await expectApiError(response, 500, 'server_misconfigured');
    }
    expect(consoleCapture.output()).toContain('TOKEN_SECRET');
  });

  it('exception inattendue du moteur → 500 internal_error, sans détail exposé', async () => {
    engine.generatePlan.mockImplementationOnce(() => {
      throw new Error('détail interne du moteur');
    });
    const token = await validToken();
    const response = await call(onRequestPost, planRequest({ token, input: SAMPLE_INPUT }));
    expect(await response.clone().text()).not.toContain('détail interne');
    await expectApiError(response, 500, 'internal_error');
  });
});

describe('/api/plan — autres méthodes', () => {
  it.each(['GET', 'PUT', 'DELETE', 'OPTIONS'])('%s → 405 avec Allow: POST', async (method) => {
    const response = await call(onRequest, new Request(new URL('/api/plan', ORIGIN), { method }));
    expect(response.headers.get('Allow')).toBe('POST');
    await expectApiError(response, 405, 'method_not_allowed');
  });

  it('onRequest aiguille aussi POST vers le même traitement', async () => {
    const token = await validToken();
    expect((await call(onRequest, planRequest({ token, input: SAMPLE_INPUT }))).status).toBe(200);
  });
});
