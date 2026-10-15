/**
 * Lecture des entrées de l'API : corps JSON borné, query de l'aperçu,
 * validation par le moteur (`validateInput`) et traduction des `PlanError`.
 */
import { parseInputFromQuery, validateInput } from '../../src/engine/index';
import { isPlanError, type PlanInput } from '../../src/engine/types';
import { apiError } from './http';

export type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };

/** Longueur maximale acceptée pour la query de `GET /api/preview` (caractères). */
export const MAX_QUERY_LENGTH = 2048;

function tooLarge(): Parsed<never> {
  return { ok: false, response: apiError('payload_too_large') };
}

function badRequest(message?: string): Parsed<never> {
  return { ok: false, response: apiError('bad_request', message ? { message } : {}) };
}

/**
 * Lit le corps en flux et s'arrête dès que `maxBytes` est dépassé
 * (413 sans tout charger en mémoire), puis le décode en JSON UTF-8 (400 sinon).
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<Parsed<unknown>> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && Number(declared) > maxBytes) return tooLarge();
  if (!request.body) return badRequest('Le corps de la requête est vide.');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk: Uint8Array = value instanceof Uint8Array ? value : new Uint8Array(value);
    total += chunk.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return tooLarge();
    }
    chunks.push(chunk);
  }
  if (total === 0) return badRequest('Le corps de la requête est vide.');

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return badRequest('Le corps de la requête n’est pas du JSON valide.');
  }
}

/** Valide une entrée inconnue avec le moteur ; 422 `invalid_input` + messages sinon. */
export function checkPlanInput(raw: unknown): Parsed<PlanInput> {
  const result = validateInput(raw);
  if (result.ok) return { ok: true, value: result.input };
  return { ok: false, response: apiError('invalid_input', { details: result.errors }) };
}

/** Query de `GET /api/preview` → `PlanInput` validée. */
export function parsePreviewQuery(url: URL): Parsed<PlanInput> {
  if (url.search.length > MAX_QUERY_LENGTH) return badRequest('Les paramètres sont trop longs.');
  return checkPlanInput(parseInputFromQuery(url.searchParams));
}

/**
 * Traduit une `PlanError` du moteur en réponse 422 (`plan_too_short` ou `invalid_input`),
 * ou renvoie `null` si l'erreur vient d'ailleurs.
 */
export function planErrorResponse(error: unknown): Response | null {
  if (!isPlanError(error)) return null;
  const messages = error.messages.filter((m) => typeof m === 'string' && m.length > 0);
  if (error.code === 'PLAN_TOO_SHORT') {
    return apiError('plan_too_short', {
      ...(messages.length > 0 ? { message: messages.join(' ') } : {}),
      details: messages,
    });
  }
  return apiError('invalid_input', { details: messages });
}

let parisDateFormat: Intl.DateTimeFormat | undefined;

/**
 * Date du jour à Paris (ISO yyyy-mm-dd), passée au moteur comme `today` :
 * la « semaine courante » est celle des coureurs, pas celle de l'UTC.
 */
export function todayInParis(now: Date = new Date()): string {
  parisDateFormat ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = parisDateFormat.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
