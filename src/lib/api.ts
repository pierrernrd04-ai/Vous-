/**
 * Client de l'API (/api/preview, /api/unlock, /api/plan).
 *
 * Ne lève jamais d'exception : chaque appel renvoie `{ ok: true, data }` ou un
 * échec typé avec un message en français affichable tel quel. Les réponses sont
 * vérifiées structurellement avant usage (une réponse inattendue ne casse pas la page).
 */
import {
  API_ROUTES,
  isApiError,
  type ApiErrorCode,
  type Plan,
  type PlanInput,
  type PreviewResponse,
  type Session,
  type UnlockResponse,
  type Week,
} from '../shared/api-types';
import { planInputToSearchParams } from '../shared/query';

export type FailureCode = ApiErrorCode | 'network' | 'timeout' | 'bad_response';

export interface ApiFailure {
  ok: false;
  /** Statut HTTP, 0 si la requête n'a pas abouti. */
  status: number;
  code: FailureCode;
  message: string;
  details: string[];
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  /** Réponse servie par le service worker depuis son cache (hors ligne). */
  fromCache: boolean;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const FALLBACK_MESSAGES: Record<'network' | 'timeout' | 'bad_response' | 'http', string> = {
  network: 'Connexion impossible. Vérifie ton réseau, puis réessaie.',
  timeout: 'Le serveur met trop de temps à répondre. Réessaie dans un instant.',
  bad_response: 'Réponse inattendue du serveur. Réessaie dans un instant.',
  http: 'Une erreur est survenue. Réessaie dans un instant.',
};

const DEFAULT_TIMEOUT_MS = 15_000;

function failure(status: number, code: FailureCode, message: string, details: string[] = []): ApiFailure {
  return { ok: false, status, code, message, details };
}

/* ---------------- Gardes de forme ---------------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export function isSession(v: unknown): v is Session {
  return (
    isObj(v) &&
    isStr(v.date) &&
    isStr(v.dow) &&
    isStr(v.type) &&
    isStr(v.title) &&
    isNum(v.km) &&
    isNum(v.durationMin) &&
    Array.isArray(v.paces) &&
    v.paces.every((p) => isObj(p) && isStr(p.label) && isNum(p.secPerKm)) &&
    Array.isArray(v.steps) &&
    v.steps.every(isStr) &&
    (v.loopKm === null || isNum(v.loopKm))
  );
}

export function isWeek(v: unknown): v is Week {
  return (
    isObj(v) &&
    isNum(v.index) &&
    isStr(v.start) &&
    isStr(v.end) &&
    isStr(v.phase) &&
    typeof v.deload === 'boolean' &&
    isNum(v.km) &&
    Array.isArray(v.sessions) &&
    v.sessions.every(isSession) &&
    (v.note === undefined || isStr(v.note))
  );
}

function isPaces(v: unknown): v is Plan['paces'] {
  return (
    isObj(v) && isNum(v.ef) && isNum(v.seuil) && isNum(v.as10) && isNum(v.allure_course) && isNum(v.recup)
  );
}

function isPredicted(v: unknown): v is Plan['predicted'] {
  return isObj(v) && isNum(v.raceSec);
}

export function isPreview(v: unknown): v is PreviewResponse {
  return (
    isObj(v) &&
    isWeek(v.week1) &&
    Array.isArray(v.overview) &&
    v.overview.every(
      (o) => isObj(o) && isNum(o.index) && isStr(o.start) && isStr(o.phase) && typeof o.deload === 'boolean' && isNum(o.km),
    ) &&
    isPaces(v.paces) &&
    isPredicted(v.predicted)
  );
}

export function isPlan(v: unknown): v is Plan {
  return (
    isObj(v) &&
    isObj(v.input) &&
    Array.isArray(v.weeks) &&
    v.weeks.length > 0 &&
    v.weeks.every(isWeek) &&
    isPaces(v.paces) &&
    isPredicted(v.predicted) &&
    isNum(v.totalKm)
  );
}

export function isUnlockResponse(v: unknown): v is UnlockResponse {
  return isObj(v) && isStr(v.token) && v.token.length > 0 && isStr(v.email) && isStr(v.ref);
}

/* ---------------- Requête générique ---------------- */

async function request<T>(
  url: string,
  init: RequestInit,
  guard: (v: unknown) => v is T,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      credentials: 'same-origin',
    });
  } catch {
    clearTimeout(timer);
    return controller.signal.aborted
      ? failure(0, 'timeout', FALLBACK_MESSAGES.timeout)
      : failure(0, 'network', FALLBACK_MESSAGES.network);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (isApiError(body)) {
      return failure(response.status, body.error, body.message, body.details ?? []);
    }
    return failure(response.status, response.status >= 500 ? 'internal_error' : 'bad_response', FALLBACK_MESSAGES.http);
  }
  if (!guard(body)) return failure(response.status, 'bad_response', FALLBACK_MESSAGES.bad_response);
  return { ok: true, data: body, fromCache: response.headers.has('X-SW-Cache') };
}

/* ---------------- Endpoints ---------------- */

/** URL de l'aperçu pour une entrée (ordre des paramètres stable → cache HTTP efficace). */
export function previewUrl(input: PlanInput): string {
  return `${API_ROUTES.preview}?${planInputToSearchParams(input).toString()}`;
}

export function getPreview(input: PlanInput): Promise<ApiResult<PreviewResponse>> {
  return request(previewUrl(input), { method: 'GET' }, isPreview);
}

export function unlock(sessionId: string): Promise<ApiResult<UnlockResponse>> {
  const url = `${API_ROUTES.unlock}?${new URLSearchParams({ session_id: sessionId }).toString()}`;
  return request(url, { method: 'GET', cache: 'no-store' }, isUnlockResponse, 20_000);
}

export function postPlan(token: string, input: PlanInput): Promise<ApiResult<Plan>> {
  return request(
    API_ROUTES.plan,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, input }),
      cache: 'no-store',
    },
    isPlan,
  );
}
