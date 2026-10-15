/**
 * Lecture d'une Checkout Session Stripe (clé restreinte, lecture seule).
 *
 * Ne renvoie jamais le corps brut de Stripe : seulement les champs utiles, validés.
 * Les `detail` des échecs sont journalisables (statut HTTP, type d'erreur Stripe),
 * sans clé ni contenu de session.
 */

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';
/** Version d'API figée (la même que scripts/stripe-setup.mjs). */
export const STRIPE_API_VERSION = '2024-06-20';
/** Délai maximal pour l'appel complet (connexion + corps). */
export const STRIPE_TIMEOUT_MS = 8000;

/** Champs de la Checkout Session utilisés par `/api/unlock`. */
export interface CheckoutSession {
  id: string;
  livemode: boolean;
  /** `open` | `complete` | `expired` */
  status: string | null;
  /** `paid` | `unpaid` | `no_payment_required` */
  payment_status: string;
  /** id `plink_…` du Payment Link d'origine, `null` si la session n'en vient pas. */
  payment_link: string | null;
  client_reference_id: string | null;
  customer_email: string | null;
  customer_details: { email: string | null } | null;
  /**
   * Case « conditions » de la page de paiement (Payment Link avec `consent_collection`) :
   * `true` si l'acheteur l'a cochée. Son libellé reprend la demande d'accès immédiat et la
   * renonciation au droit de rétractation (scripts/stripe-setup.mjs).
   */
  terms_accepted: boolean;
}

export type StripeFailure =
  /** Stripe ne connaît pas cette session (404, ou 400 sur l'identifiant). */
  | 'not_found'
  /** Réseau, délai dépassé, 5xx, 429, clé refusée, réponse inattendue. */
  | 'unavailable';

export type CheckoutSessionResult =
  | { ok: true; session: CheckoutSession }
  | { ok: false; failure: StripeFailure; detail: string };

export interface FetchSessionOptions {
  /** Défaut : `globalThis.fetch` lu au moment de l'appel (simulable dans les tests). */
  fetch?: typeof fetch;
  timeoutMs?: number;
  apiBase?: string;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

/** Valide la forme d'une Checkout Session ; `null` si un champ attendu manque ou a un mauvais type. */
export function parseCheckoutSession(value: unknown): CheckoutSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.object !== undefined && v.object !== 'checkout.session') return null;
  if (typeof v.id !== 'string' || typeof v.livemode !== 'boolean') return null;
  if (typeof v.payment_status !== 'string') return null;

  const status = nullableString(v.status);
  const clientReferenceId = nullableString(v.client_reference_id);
  const customerEmail = nullableString(v.customer_email);
  if (status === undefined || clientReferenceId === undefined || customerEmail === undefined) {
    return null;
  }

  // `payment_link` est un id, ou un objet si la requête l'a « expand ».
  let paymentLink: string | null;
  const rawLink = v.payment_link;
  if (rawLink === null || rawLink === undefined) paymentLink = null;
  else if (typeof rawLink === 'string') paymentLink = rawLink;
  else if (
    typeof rawLink === 'object' &&
    typeof (rawLink as Record<string, unknown>).id === 'string'
  ) {
    paymentLink = (rawLink as { id: string }).id;
  } else return null;

  let customerDetails: CheckoutSession['customer_details'] = null;
  if (v.customer_details !== null && v.customer_details !== undefined) {
    if (typeof v.customer_details !== 'object') return null;
    const email = nullableString((v.customer_details as Record<string, unknown>).email);
    if (email === undefined) return null;
    customerDetails = { email };
  }

  // `consent` est absent ou `null` sans `consent_collection` : la case n'a alors pas été cochée.
  const consent = v.consent;
  const termsAccepted =
    typeof consent === 'object' &&
    consent !== null &&
    (consent as Record<string, unknown>).terms_of_service === 'accepted';

  return {
    id: v.id,
    livemode: v.livemode,
    status,
    payment_status: v.payment_status,
    payment_link: paymentLink,
    client_reference_id: clientReferenceId,
    customer_email: customerEmail,
    customer_details: customerDetails,
    terms_accepted: termsAccepted,
  };
}

/** Type d'erreur Stripe (`error.type`), seulement s'il a une forme sûre à journaliser. */
function stripeErrorType(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return '';
  const type = (error as Record<string, unknown>).type;
  return typeof type === 'string' && /^[a-z_]{1,64}$/.test(type) ? ` ${type}` : '';
}

/**
 * `GET /v1/checkout/sessions/{id}` avec `Authorization: Bearer <clé>`,
 * interrompu après `timeoutMs` (8 s par défaut) via `AbortController`.
 * `sessionId` doit déjà avoir été validé (regex `STRIPE_SESSION_ID_RE`).
 */
export async function fetchCheckoutSession(
  sessionId: string,
  stripeKey: string,
  options: FetchSessionOptions = {},
): Promise<CheckoutSessionResult> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? STRIPE_TIMEOUT_MS;
  const url = `${options.apiBase ?? STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`;

  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  let status: number;
  let text: string;
  try {
    const response = await doFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Version': STRIPE_API_VERSION,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    status = response.status;
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, failure: 'unavailable', detail: `délai de ${timeoutMs} ms dépassé` };
    }
    const name = error instanceof Error ? error.name : typeof error;
    return { ok: false, failure: 'unavailable', detail: `erreur réseau (${name})` };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, failure: 'unavailable', detail: `HTTP ${status}, corps non JSON` };
  }

  if (status === 404 || status === 400) {
    return { ok: false, failure: 'not_found', detail: `HTTP ${status}${stripeErrorType(body)}` };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, failure: 'unavailable', detail: `HTTP ${status}${stripeErrorType(body)}` };
  }

  const session = parseCheckoutSession(body);
  if (!session) {
    return { ok: false, failure: 'unavailable', detail: `HTTP ${status}, session illisible` };
  }
  return { ok: true, session };
}
