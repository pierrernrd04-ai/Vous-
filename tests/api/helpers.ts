/**
 * Outils communs aux tests de l'API (Pages Functions appelées directement, sans wrangler).
 */
import { expect, vi, type MockInstance } from 'vitest';
import type { Env, PagesContext, PagesHandler } from '../../functions/_lib/types';
import { isApiError, type ApiError, type ApiErrorCode } from '../../src/shared/api-types';

/** Instant de référence des tests : mercredi 14/10/2026, 12:00 à Paris. */
export const NOW = new Date('2026-10-14T10:00:00Z');
export const NOW_SEC = Math.floor(NOW.getTime() / 1000);

/** Secret factice (≥ 32 caractères). */
export const TEST_SECRET = 'secret-de-test-0123456789-abcdefghijklmnop';
/** Clés factices, volontairement trop courtes pour ressembler à de vraies clés Stripe. */
export const LIVE_KEY = 'rk_live_cleFactice';
export const TEST_KEY = 'rk_test_cleFactice';
export const LAUNCH_LINK = 'plink_1Lancement';
export const REGULAR_LINK = 'plink_1Normal';

export const BASE_ENV: Env = {
  STRIPE_KEY: LIVE_KEY,
  TOKEN_SECRET: TEST_SECRET,
  PAYMENT_LINK_IDS: `${LAUNCH_LINK},${REGULAR_LINK}`,
  SITE_URL: 'https://traceo-pass.pages.dev',
};

export const ORIGIN = 'https://traceo-pass.pages.dev';

export function makeContext(request: Request, env: Env = BASE_ENV): PagesContext {
  return {
    request,
    env,
    params: {},
    data: {},
    waitUntil: () => undefined,
    next: () => Promise.resolve(new Response('Not Found', { status: 404 })),
  };
}

export function call(handler: PagesHandler, request: Request, env: Env = BASE_ENV) {
  return Promise.resolve(handler(makeContext(request, env)));
}

/** Lit une réponse d'erreur et vérifie sa forme `ApiError`, son statut et son code. */
export async function expectApiError(
  response: Response,
  status: number,
  code: ApiErrorCode,
): Promise<ApiError> {
  expect(response.status).toBe(status);
  expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const body: unknown = await response.json();
  expect(isApiError(body)).toBe(true);
  const error = body as ApiError;
  expect(error.error).toBe(code);
  expect(error.message.length).toBeGreaterThan(0);
  return error;
}

/** En-têtes de sécurité attendus sur toute réponse de l'API. */
export function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
}

/**
 * Fait taire `console.*` et renvoie un accès à tout ce qui a été journalisé,
 * pour vérifier qu'aucun secret n'y apparaît.
 */
export function captureConsole(): { output: () => string; restore: () => void } {
  const spies: MockInstance[] = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
  );
  return {
    output: () =>
      spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => args.map((a) => (a instanceof Error ? `${a.name} ${a.message}` : String(a))).join(' '))
        .join('\n'),
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}
