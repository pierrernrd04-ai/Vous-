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
  retractation: '/api/retractation',
  waiver: '/api/waiver',
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

/**
 * Format accepté pour `session_id` (sinon 400 `invalid_session_id`) : id de Checkout Session
 * Stripe (SPEC section 3), resserré à la longueur des vrais ids
 * (une soixantaine de caractères après le préfixe) : un id fantaisiste est refusé avant
 * tout appel à Stripe.
 */
export const STRIPE_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{24,200}$/;

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

/* ---------------- POST /api/retractation ---------------- */

/** Taille maximale du corps de `POST /api/retractation` et `POST /api/waiver` (octets). */
export const FORM_REQUEST_MAX_BYTES = 4096;

/**
 * Déclaration de rétractation en ligne (fonction « Renoncer au contrat ici »,
 * art. L221-21 et D221-5 C. conso) : nom et prénom, éléments identifiant le contrat,
 * adresse où recevoir l'accusé de réception.
 */
export interface WithdrawalRequest {
  name: string;
  /** E-mail utilisé pour l'achat (identifie le contrat). */
  purchaseEmail: string;
  /** Référence de la commande (reçu Stripe ou PayPal), facultative. */
  orderRef?: string;
  /** Adresse où envoyer l'accusé de réception. */
  ackEmail: string;
}

/**
 * 200 : déclaration reçue. `acknowledgementSent` vaut faux si l'e-mail d'accusé de
 * réception n'a pas pu partir (la déclaration est tout de même enregistrée) ; la page
 * affiche alors l'accusé, à conserver. 422 `invalid_input` (détails), 429 `rate_limited`,
 * 503 `service_unavailable` (fonction non configurée : utiliser l'e-mail ou le courrier).
 */
export interface WithdrawalResponse {
  reference: string;
  /** Date et heure de réception, ISO 8601 UTC. */
  receivedAt: string;
  /** Même instant, en toutes lettres à l'heure de Paris. */
  receivedAtLabel: string;
  /** Texte intégral de la déclaration. */
  declaration: string;
  acknowledgementSent: boolean;
}

/* ---------------- POST /api/waiver ---------------- */

/** Accord d'accès immédiat donné après le paiement (/merci/, /plan/) ou avant (référence `w1-`). */
export interface WaiverRequest {
  token: string;
}

/** 200 : accord enregistré et/ou confirmation envoyée par e-mail. 401 jeton invalide, 503 non configuré. */
export interface WaiverResponse {
  recorded: boolean;
  confirmationSent: boolean;
}

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
  | 'rate_limited'
  | 'service_unavailable'
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
  rate_limited: 429,
  service_unavailable: 503,
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
