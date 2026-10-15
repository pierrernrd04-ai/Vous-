import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest, onRequestGet } from '../../functions/api/unlock';
import { STRIPE_API_VERSION, STRIPE_TIMEOUT_MS } from '../../functions/_lib/stripe';
import type { Env } from '../../functions/_lib/types';
import type { UnlockResponse } from '../../src/shared/api-types';
import { TOKEN_EXP_SEC, verifyToken } from '../../src/shared/token';
import {
  BASE_ENV,
  LAUNCH_LINK,
  LIVE_KEY,
  NOW,
  NOW_SEC,
  ORIGIN,
  REGULAR_LINK,
  TEST_KEY,
  TEST_SECRET,
  call,
  captureConsole,
  expectApiError,
  expectSecurityHeaders,
} from './helpers';

const LIVE_ID = 'cs_live_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ0123456789abcdefghijklmn';
const TEST_ID = 'cs_test_a1B2c3D4e5F6g7H8i9J0';
/** Texte présent dans les corps Stripe simulés : ne doit jamais ressortir de l'API. */
const STRIPE_SECRET_MARKER = 'DETAIL_INTERNE_STRIPE';

function checkoutSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LIVE_ID,
    object: 'checkout.session',
    livemode: true,
    status: 'complete',
    payment_status: 'paid',
    payment_link: LAUNCH_LINK,
    client_reference_id: 'w1-marathon-l2',
    customer_email: null,
    customer_details: { email: 'coureuse@example.fr', name: STRIPE_SECRET_MARKER, phone: null },
    amount_total: 1900,
    currency: 'eur',
    metadata: { note: STRIPE_SECRET_MARKER },
    ...overrides,
  };
}

function stripeJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stripeError(status: number, type: string): Response {
  return stripeJson(
    { error: { type, message: `${STRIPE_SECRET_MARKER} ${LIVE_KEY}`, code: 'resource_missing' } },
    status,
  );
}

function unlockRequest(sessionId: string | null, init?: RequestInit): Request {
  const url = new URL('/api/unlock', ORIGIN);
  if (sessionId !== null) url.searchParams.set('session_id', sessionId);
  return new Request(url, init);
}

const fetchMock = vi.fn<typeof fetch>();
let consoleCapture: ReturnType<typeof captureConsole>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  consoleCapture = captureConsole();
});

afterEach(() => {
  const logs = consoleCapture.output();
  consoleCapture.restore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Jamais de secret dans les journaux, quel que soit le scénario.
  expect(logs).not.toContain(LIVE_KEY);
  expect(logs).not.toContain(TEST_KEY);
  expect(logs).not.toContain(TEST_SECRET);
  expect(logs).not.toContain(STRIPE_SECRET_MARKER);
});

async function unlock(sessionId: string | null, env: Env = BASE_ENV): Promise<Response> {
  return call(onRequestGet, unlockRequest(sessionId), env);
}

/** Corps brut de la réponse, pour vérifier qu'aucune donnée interne ne fuit. */
async function expectNoLeak(response: Response): Promise<void> {
  const text = await response.clone().text();
  expect(text).not.toContain(LIVE_KEY);
  expect(text).not.toContain(TEST_SECRET);
  expect(text).not.toContain(STRIPE_SECRET_MARKER);
}

describe('GET /api/unlock — paiement valide', () => {
  it('renvoie { token, email, ref } et un jeton vérifiable', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession()));
    const response = await unlock(LIVE_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expectSecurityHeaders(response);
    await expectNoLeak(response);

    const body = (await response.json()) as UnlockResponse;
    expect(Object.keys(body).sort()).toEqual(['email', 'ref', 'token']);
    expect(body.email).toBe('coureuse@example.fr');
    expect(body.ref).toBe('w1-marathon-l2');
    await expect(verifyToken(body.token, TEST_SECRET, NOW_SEC)).resolves.toEqual({
      v: 1,
      sub: 'coureuse@example.fr',
      sid: LIVE_ID,
      ref: 'w1-marathon-l2',
      iat: NOW_SEC,
      exp: TOKEN_EXP_SEC,
    });
  });

  it('interroge la bonne URL Stripe avec la clé en Bearer et un signal d’abandon', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession()));
    await unlock(LIVE_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.stripe.com/v1/checkout/sessions/${LIVE_ID}`);
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${LIVE_KEY}`);
    expect(headers.get('Stripe-Version')).toBe(STRIPE_API_VERSION);
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepte le second Payment Link et les espaces dans PAYMENT_LINK_IDS', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ payment_link: REGULAR_LINK })));
    const response = await unlock(LIVE_ID, {
      ...BASE_ENV,
      PAYMENT_LINK_IDS: ` ${LAUNCH_LINK} , ${REGULAR_LINK} ,`,
    });
    expect(response.status).toBe(200);
  });

  it('accepte un payment_link développé (objet)', async () => {
    fetchMock.mockResolvedValueOnce(
      stripeJson(checkoutSession({ payment_link: { id: LAUNCH_LINK, object: 'payment_link' } })),
    );
    expect((await unlock(LIVE_ID)).status).toBe(200);
  });

  it('se rabat sur customer_email, et renvoie ref vide sans client_reference_id', async () => {
    fetchMock.mockResolvedValueOnce(
      stripeJson(
        checkoutSession({
          customer_details: null,
          customer_email: 'autre@example.fr',
          client_reference_id: null,
        }),
      ),
    );
    const response = await unlock(LIVE_ID);
    expect(response.status).toBe(200);
    const body = (await response.json()) as UnlockResponse;
    expect(body).toMatchObject({ email: 'autre@example.fr', ref: '' });
    expect((await verifyToken(body.token, TEST_SECRET, NOW_SEC))?.ref).toBe('');
  });

  it('fonctionne en mode test avec une clé de test', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ id: TEST_ID, livemode: false })));
    const response = await unlock(TEST_ID, { ...BASE_ENV, STRIPE_KEY: TEST_KEY });
    expect(response.status).toBe(200);
    const body = (await response.json()) as UnlockResponse;
    expect((await verifyToken(body.token, TEST_SECRET, NOW_SEC))?.sid).toBe(TEST_ID);
  });
});

describe('GET /api/unlock — paiement non abouti (402)', () => {
  it('session complète mais non payée', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ payment_status: 'unpaid' })));
    const error = await expectApiError(await unlock(LIVE_ID), 402, 'not_paid');
    expect(error.message).toContain('confirmation');
  });

  it('session encore ouverte', async () => {
    fetchMock.mockResolvedValueOnce(
      stripeJson(checkoutSession({ status: 'open', payment_status: 'unpaid' })),
    );
    const error = await expectApiError(await unlock(LIVE_ID), 402, 'not_paid');
    expect(error.message).toContain('pas encore finalisé');
  });

  it('session expirée', async () => {
    fetchMock.mockResolvedValueOnce(
      stripeJson(checkoutSession({ status: 'expired', payment_status: 'unpaid' })),
    );
    const error = await expectApiError(await unlock(LIVE_ID), 402, 'not_paid');
    expect(error.message).toContain('expiré');
  });

  it('aucun paiement requis (payment_status = no_payment_required)', async () => {
    fetchMock.mockResolvedValueOnce(
      stripeJson(checkoutSession({ payment_status: 'no_payment_required' })),
    );
    await expectApiError(await unlock(LIVE_ID), 402, 'not_paid');
  });

  it('session de test avec une clé réelle : refusée sans appeler Stripe', async () => {
    const error = await expectApiError(await unlock(TEST_ID), 402, 'not_paid');
    expect(error.message).toContain('mode test');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('session réelle avec une clé de test : refusée sans appeler Stripe', async () => {
    await expectApiError(await unlock(LIVE_ID, { ...BASE_ENV, STRIPE_KEY: TEST_KEY }), 402, 'not_paid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('livemode renvoyé par Stripe incohérent avec la clé réelle', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ livemode: false })));
    await expectApiError(await unlock(LIVE_ID), 402, 'not_paid');
  });
});

describe('GET /api/unlock — Payment Link inconnu (403)', () => {
  it('lien absent de PAYMENT_LINK_IDS', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ payment_link: 'plink_1Inconnu' })));
    const response = await unlock(LIVE_ID);
    await expectNoLeak(response);
    await expectApiError(response, 403, 'unknown_payment_link');
  });

  it('session créée hors Payment Link', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ payment_link: null })));
    await expectApiError(await unlock(LIVE_ID), 403, 'unknown_payment_link');
  });
});

describe('GET /api/unlock — identifiant invalide (400)', () => {
  const invalidIds: (string | null)[] = [
    null,
    '',
    'abc',
    'cs_live_',
    'cs_prod_abc123',
    'cs_live_abc-123',
    'cs_live_abc/../../v1/customers',
    'cs_live_abc%20def',
    ' cs_live_abc123',
    'cs_live_abc123\n',
    'ps_live_abc123',
    `cs_live_${'a'.repeat(300)}`,
  ];

  it.each(invalidIds)('refuse %j sans appeler Stripe', async (id) => {
    await expectApiError(await unlock(id), 400, 'invalid_session_id');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('session inconnue de Stripe (404)', async () => {
    fetchMock.mockResolvedValueOnce(stripeError(404, 'invalid_request_error'));
    const response = await unlock(LIVE_ID);
    await expectNoLeak(response);
    const error = await expectApiError(response, 400, 'invalid_session_id');
    expect(error.message).toContain('introuvable');
  });
});

describe('GET /api/unlock — Stripe en panne (502)', () => {
  it('erreur 500 de Stripe, sans fuite du corps', async () => {
    fetchMock.mockResolvedValueOnce(stripeError(500, 'api_error'));
    const response = await unlock(LIVE_ID);
    await expectNoLeak(response);
    await expectApiError(response, 502, 'stripe_unavailable');
  });

  it('clé refusée par Stripe (401)', async () => {
    fetchMock.mockResolvedValueOnce(stripeError(401, 'authentication_error'));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it('limite de débit (429)', async () => {
    fetchMock.mockResolvedValueOnce(stripeError(429, 'rate_limit_error'));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it('erreur réseau', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed ${STRIPE_SECRET_MARKER}`));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it('réponse non JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 200 }));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it('session illisible (champs manquants)', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson({ id: LIVE_ID, object: 'checkout.session' }));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it('Stripe renvoie une autre session que celle demandée', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession({ id: `${LIVE_ID}x` })));
    await expectApiError(await unlock(LIVE_ID), 502, 'stripe_unavailable');
  });

  it(`abandonne après ${STRIPE_TIMEOUT_MS / 1000} s sans réponse`, async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    let aborted = false;
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    let settled = false;
    const pending = unlock(LIVE_ID).then((response) => {
      settled = true;
      return response;
    });
    await vi.advanceTimersByTimeAsync(STRIPE_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(aborted).toBe(true);
    await expectApiError(response, 502, 'stripe_unavailable');
    expect(consoleCapture.output()).toContain('délai');
  });
});

describe('GET /api/unlock — configuration du serveur (500)', () => {
  const broken: [string, Env][] = [
    ['STRIPE_KEY absente', { ...BASE_ENV, STRIPE_KEY: undefined }],
    ['STRIPE_KEY publique', { ...BASE_ENV, STRIPE_KEY: 'pk_live_cleFactice' }],
    ['TOKEN_SECRET absent', { ...BASE_ENV, TOKEN_SECRET: undefined }],
    ['TOKEN_SECRET trop court', { ...BASE_ENV, TOKEN_SECRET: 'court' }],
    ['PAYMENT_LINK_IDS absent', { ...BASE_ENV, PAYMENT_LINK_IDS: undefined }],
    ['PAYMENT_LINK_IDS vide', { ...BASE_ENV, PAYMENT_LINK_IDS: ' , ' }],
    ['PAYMENT_LINK_IDS mal formé', { ...BASE_ENV, PAYMENT_LINK_IDS: 'https://buy.stripe.com/abc' }],
    ['environnement vide', {}],
  ];

  it.each(broken)('%s', async (_label, env) => {
    const response = await unlock(LIVE_ID, env);
    await expectNoLeak(response);
    await expectApiError(response, 500, 'server_misconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
    // Le journal nomme la variable fautive, sans sa valeur.
    expect(consoleCapture.output()).toMatch(/STRIPE_KEY|TOKEN_SECRET|PAYMENT_LINK_IDS/);
    expect(consoleCapture.output()).not.toContain('pk_live_cleFactice');
  });
});

describe('/api/unlock — autres méthodes', () => {
  it('POST → 405 avec Allow: GET', async () => {
    const response = await call(onRequest, unlockRequest(LIVE_ID, { method: 'POST', body: '{}' }));
    expect(response.headers.get('Allow')).toBe('GET');
    expectSecurityHeaders(response);
    await expectApiError(response, 405, 'method_not_allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('onRequest aiguille aussi GET vers le même traitement', async () => {
    fetchMock.mockResolvedValueOnce(stripeJson(checkoutSession()));
    expect((await call(onRequest, unlockRequest(LIVE_ID))).status).toBe(200);
  });
});
