/**
 * Réponses HTTP des Pages Functions : JSON, en-têtes de sécurité, cache,
 * erreurs normalisées (`ApiError`) et aiguillage par méthode.
 *
 * `public/_headers` ne s'applique pas aux Functions : chaque réponse de /api/*
 * pose ici ses propres en-têtes.
 */
import {
  API_ERROR_STATUS,
  type ApiError,
  type ApiErrorCode,
} from '../../src/shared/api-types';
import type { PagesHandler } from './types';

/** Valeurs de `Cache-Control` utilisées par l'API. */
export const CACHE_NO_STORE = 'no-store';
export const CACHE_PUBLIC_1H = 'public, max-age=3600';

/** En-têtes posés sur toute réponse de l'API (JSON pur, jamais affiché comme une page). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

export interface JsonInit {
  status?: number;
  /** `Cache-Control` ; défaut `no-store`. */
  cache?: string;
  headers?: Record<string, string>;
}

/** Réponse JSON UTF-8 avec en-têtes de sécurité et `Cache-Control` (défaut `no-store`). */
export function json(body: unknown, init: JsonInit = {}): Response {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', init.cache ?? CACHE_NO_STORE);
  for (const [name, value] of Object.entries(init.headers ?? {})) headers.set(name, value);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

/** Message par défaut (français, affichable tel quel) de chaque code d'erreur. */
export const DEFAULT_ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = Object.freeze({
  bad_request: 'La requête est illisible. Recharge la page puis réessaie.',
  payload_too_large: 'La requête est trop volumineuse.',
  invalid_input: 'Certains paramètres du plan ne sont pas valides.',
  plan_too_short:
    'Il reste moins de 8 semaines avant ta course : c’est trop court pour un plan complet.',
  invalid_session_id:
    'Le lien de paiement est incomplet ou invalide. Ouvre le lien reçu juste après ton paiement.',
  invalid_token:
    'Ton lien d’accès n’est pas valide ou a expiré. Ouvre le lien personnel reçu après ton achat.',
  not_paid: 'Le paiement n’est pas confirmé : le plan n’est pas encore débloqué.',
  unknown_payment_link: 'Ce paiement ne correspond pas au Pass J-24.',
  method_not_allowed: 'Méthode non autorisée.',
  stripe_unavailable:
    'Impossible de vérifier ton paiement pour le moment. Réessaie dans quelques minutes : ton achat n’est pas perdu.',
  server_misconfigured:
    'Le service est momentanément indisponible. Réessaie un peu plus tard, ton achat n’est pas perdu.',
  internal_error: 'Une erreur inattendue est survenue. Réessaie dans un instant.',
});

/** Réponse d'erreur normalisée ; le statut HTTP découle du code (`API_ERROR_STATUS`). */
export function apiError(
  code: ApiErrorCode,
  options: { message?: string; details?: string[]; headers?: Record<string, string> } = {},
): Response {
  const body: ApiError = { error: code, message: options.message ?? DEFAULT_ERROR_MESSAGES[code] };
  if (options.details && options.details.length > 0) body.details = [...options.details];
  return json(body, {
    status: API_ERROR_STATUS[code],
    cache: CACHE_NO_STORE,
    ...(options.headers ? { headers: options.headers } : {}),
  });
}

export type HttpMethod = 'GET' | 'POST';

/** 405 avec l'en-tête `Allow`. */
export function methodNotAllowed(allowed: readonly HttpMethod[]): Response {
  return apiError('method_not_allowed', { headers: { Allow: allowed.join(', ') } });
}

/**
 * Journalise une erreur. Ne jamais y passer de secret, de jeton ni de corps Stripe :
 * seulement un contexte fixe, plus le nom et le début du message d'une exception.
 */
export function logError(scope: string, message: string, error?: unknown): void {
  const detail =
    error instanceof Error ? ` (${error.name}: ${error.message.slice(0, 200)})` : '';
  console.error(`[${scope}] ${message}${detail}`);
}

/** Enveloppe un handler : toute exception non prévue devient un 500 `internal_error`. */
export function withErrorBoundary(scope: string, handler: PagesHandler): PagesHandler {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      logError(scope, 'exception non gérée', error);
      return apiError('internal_error');
    }
  };
}

/**
 * Handler unique qui aiguille selon la méthode et répond 405 pour les autres.
 * Exporté en `onRequest` à côté des `onRequestGet`/`onRequestPost` : Pages essaie
 * d'abord les routes à méthode, puis celle-ci.
 */
export function byMethod(handlers: Partial<Record<HttpMethod, PagesHandler>>): PagesHandler {
  const allowed = (Object.keys(handlers) as HttpMethod[]).filter((m) => handlers[m]);
  return (context) => {
    const handler = handlers[context.request.method.toUpperCase() as HttpMethod];
    return handler ? handler(context) : methodNotAllowed(allowed);
  };
}
