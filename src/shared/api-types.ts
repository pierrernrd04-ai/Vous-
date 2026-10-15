/**
 * Contrat HTTP entre le front (src/pages) et les Pages Functions (functions/api).
 *
 * Client-safe : ne contient que des types (ré-exportés du moteur en `export type`,
 * donc effacés au build) et quelques constantes. Le navigateur importe les types
 * du plan d'ici, jamais depuis src/engine.
 */
import type { Plan, PlanInput, PlanPreview } from '../engine/types';

export type {
  Dow,
  Level,
  PaceKey,
  Phase,
  Plan,
  PlanInput,
  PlanPreview,
  RaceKind,
  Session,
  SessionPace,
  SessionType,
  Week,
  WeekOverview,
} from '../engine/types';

export const API_ROUTES = {
  preview: '/api/preview',
  unlock: '/api/unlock',
  plan: '/api/plan',
} as const;

/* ---------------- GET /api/preview?<PlanInput en query> ---------------- */

/**
 * Paramètres de query : mêmes noms que les champs de `PlanInput`,
 * valeurs en texte (nombres en décimal). Voir `planInputToSearchParams`.
 */
export type PreviewQuery = Partial<Record<keyof PlanInput, string>>;

/**
 * 200 — `Cache-Control: public, max-age=3600`.
 * 422 `invalid_input` (détails = erreurs de validation) ou `plan_too_short`.
 */
export type PreviewResponse = PlanPreview;

/* ---------------- GET /api/unlock?session_id=cs_… ---------------- */

/** Format accepté pour `session_id` (sinon 400 `invalid_session_id`). */
export const STRIPE_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

export interface UnlockQuery {
  session_id: string;
}

/**
 * 200 — `Cache-Control: no-store`.
 * 400 `invalid_session_id` (format, ou session inconnue de Stripe), 402 `not_paid`
 * (session ouverte, expirée, non payée, ou mode test/réel incohérent avec la clé),
 * 403 `unknown_payment_link`, 502 `stripe_unavailable` (panne, délai de 8 s dépassé),
 * 500 `server_misconfigured`.
 */
export interface UnlockResponse {
  token: string;
  email: string;
  /** `client_reference_id` de la session (ex. `w1-marathon-l2`), `''` si absent. */
  ref: string;
}

/* ---------------- POST /api/plan ---------------- */

/** Taille maximale du corps de `POST /api/plan`, en octets (sinon 413 `payload_too_large`). */
export const PLAN_REQUEST_MAX_BYTES = 4096;

/**
 * Réponses : 200 `Plan` (`no-store`) ; 400 `bad_request` (JSON illisible) ;
 * 401 `invalid_token` ; 413 `payload_too_large` ; 422 `invalid_input`
 * (détails = erreurs de validation) ou `plan_too_short`.
 */
export interface PlanRequest {
  token: string;
  input: PlanInput;
}

export type PlanResponse = Plan;

/* ---------------- Erreurs ---------------- */

export type ApiErrorCode =
  | 'bad_request'
  | 'payload_too_large'
  | 'invalid_input'
  | 'plan_too_short'
  | 'invalid_session_id'
  | 'invalid_token'
  | 'not_paid'
  | 'unknown_payment_link'
  | 'method_not_allowed'
  | 'stripe_unavailable'
  | 'server_misconfigured'
  | 'internal_error';

/** Statut HTTP associé à chaque code d'erreur. */
export const API_ERROR_STATUS = {
  bad_request: 400,
  payload_too_large: 413,
  invalid_input: 422,
  plan_too_short: 422,
  invalid_session_id: 400,
  invalid_token: 401,
  not_paid: 402,
  unknown_payment_link: 403,
  method_not_allowed: 405,
  stripe_unavailable: 502,
  server_misconfigured: 500,
  internal_error: 500,
} as const satisfies Record<ApiErrorCode, number>;

/** Corps JSON de toute réponse d'erreur. */
export interface ApiError {
  error: ApiErrorCode;
  /** Message en français, affichable tel quel. */
  message: string;
  /** Détails éventuels (ex. liste des erreurs de validation), en français. */
  details?: string[];
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.error === 'string' &&
    Object.hasOwn(API_ERROR_STATUS, v.error) &&
    typeof v.message === 'string' &&
    (v.details === undefined ||
      (Array.isArray(v.details) && v.details.every((d) => typeof d === 'string')))
  );
}
