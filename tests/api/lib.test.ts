/** Briques de functions/_lib : configuration, Stripe, réponses HTTP, dates. */
import { describe, expect, it } from 'vitest';
import { parsePaymentLinkIds, readStripeConfig, stripeKeyMode } from '../../functions/_lib/env';
import { CACHE_PUBLIC_1H, apiError, byMethod, json } from '../../functions/_lib/http';
import { todayInParis } from '../../functions/_lib/input';
import { fetchCheckoutSession, parseCheckoutSession } from '../../functions/_lib/stripe';
import { API_ERROR_STATUS, type ApiErrorCode } from '../../src/shared/api-types';
import { BASE_ENV, LIVE_KEY, TEST_KEY, call, expectSecurityHeaders } from './helpers';

describe('env', () => {
  it('reconnaît le mode des clés secrètes et restreintes', () => {
    expect(stripeKeyMode(LIVE_KEY)).toBe('live');
    expect(stripeKeyMode(TEST_KEY)).toBe('test');
    expect(stripeKeyMode('sk_live_abc')).toBe('live');
    expect(stripeKeyMode('sk_test_abc')).toBe('test');
    for (const key of [undefined, '', 'pk_live_abc', 'rk_prod_abc', 'rk_live_', 'rk_live_a b']) {
      expect(stripeKeyMode(key)).toBeNull();
    }
  });

  it('lit PAYMENT_LINK_IDS en tolérant espaces et virgules superflues', () => {
    expect(parsePaymentLinkIds('plink_a, plink_b,,')).toEqual(new Set(['plink_a', 'plink_b']));
    expect(parsePaymentLinkIds('')).toBeNull();
    expect(parsePaymentLinkIds(undefined)).toBeNull();
    expect(parsePaymentLinkIds('plink_a,price_b')).toBeNull();
    // Valeurs factices des environnements locaux et e2e.
    expect(parsePaymentLinkIds('plink_test_x')).toEqual(new Set(['plink_test_x']));
    expect(stripeKeyMode('rk_test_fake_local')).toBe('test');
    for (const raw of ['plink_', 'plink__x', 'plink_a-b']) expect(parsePaymentLinkIds(raw), raw).toBeNull();
  });

  it('readStripeConfig nomme toutes les variables fautives', () => {
    expect(readStripeConfig({})).toEqual({
      ok: false,
      invalid: ['STRIPE_KEY', 'TOKEN_SECRET', 'PAYMENT_LINK_IDS'],
    });
    const result = readStripeConfig(BASE_ENV);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.stripeMode).toBe('live');
  });
});

describe('http', () => {
  it('json pose le type, le cache et les en-têtes de sécurité', async () => {
    const response = json({ a: 1 }, { status: 201, cache: CACHE_PUBLIC_1H, headers: { 'X-Test': 'oui' } });
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(response.headers.get('X-Test')).toBe('oui');
    expectSecurityHeaders(response);
    expect(await response.json()).toEqual({ a: 1 });
    expect(json(null).headers.get('Cache-Control')).toBe('no-store');
  });

  it('apiError utilise le statut du contrat et un message français par défaut', async () => {
    for (const code of Object.keys(API_ERROR_STATUS) as ApiErrorCode[]) {
      const response = apiError(code);
      expect(response.status).toBe(API_ERROR_STATUS[code]);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe(code);
      expect(body.message).toMatch(/[a-zé]/);
    }
    const withDetails = (await apiError('invalid_input', { details: ['a'] }).json()) as { details: string[] };
    expect(withDetails.details).toEqual(['a']);
    expect(await apiError('invalid_input', { details: [] }).json()).not.toHaveProperty('details');
  });

  it('byMethod aiguille et répond 405 sinon', async () => {
    const handler = byMethod({ GET: () => new Response('ok') });
    expect(await (await call(handler, new Request('https://x.fr/'))).text()).toBe('ok');
    const refused = await call(handler, new Request('https://x.fr/', { method: 'PATCH' }));
    expect(refused.status).toBe(405);
    expect(refused.headers.get('Allow')).toBe('GET');
  });
});

describe('todayInParis', () => {
  it('suit le fuseau de Paris, heure d’été comme d’hiver', () => {
    expect(todayInParis(new Date('2026-10-14T21:59:59Z'))).toBe('2026-10-14');
    expect(todayInParis(new Date('2026-10-14T22:00:00Z'))).toBe('2026-10-15');
    expect(todayInParis(new Date('2026-12-31T22:59:59Z'))).toBe('2026-12-31');
    expect(todayInParis(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });
});

describe('stripe', () => {
  const base = {
    id: 'cs_test_abc',
    object: 'checkout.session',
    livemode: false,
    status: 'complete',
    payment_status: 'paid',
    payment_link: 'plink_a',
    client_reference_id: null,
    customer_email: null,
    customer_details: { email: 'a@b.fr' },
  };

  it('parseCheckoutSession ne garde que les champs utiles', () => {
    expect(parseCheckoutSession({ ...base, amount_total: 1900, secret_field: 'x' })).toEqual({
      id: 'cs_test_abc',
      livemode: false,
      status: 'complete',
      payment_status: 'paid',
      payment_link: 'plink_a',
      client_reference_id: null,
      customer_email: null,
      customer_details: { email: 'a@b.fr' },
    });
  });

  it('parseCheckoutSession refuse les formes inattendues', () => {
    for (const value of [
      null,
      'texte',
      { ...base, object: 'payment_intent' },
      { ...base, livemode: 'false' },
      { ...base, payment_status: undefined },
      { ...base, status: 3 },
      { ...base, payment_link: 42 },
      { ...base, customer_details: 'a@b.fr' },
      { ...base, customer_details: { email: 7 } },
    ]) {
      expect(parseCheckoutSession(value)).toBeNull();
    }
  });

  it('fetchCheckoutSession accepte un fetch injecté et un délai personnalisé', async () => {
    const ok = await fetchCheckoutSession('cs_test_abc', TEST_KEY, {
      fetch: () => Promise.resolve(new Response(JSON.stringify(base))),
    });
    expect(ok.ok).toBe(true);

    const slow = await fetchCheckoutSession('cs_test_abc', TEST_KEY, {
      timeoutMs: 20,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('abandon', 'AbortError')));
        }),
    });
    expect(slow).toEqual({ ok: false, failure: 'unavailable', detail: 'délai de 20 ms dépassé' });
  });
});
