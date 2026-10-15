/**
 * GET /api/unlock?session_id=cs_… → UnlockResponse (src/shared/api-types.ts).
 *
 * Lit la Checkout Session Stripe (clé restreinte `STRIPE_KEY`, délai 8 s) et émet un jeton si :
 * - le mode de la session (test / réel) correspond à celui de la clé ;
 * - `payment_link` ∈ `PAYMENT_LINK_IDS` (sinon 403) ;
 * - `status = complete` et `payment_status = paid` (sinon 402).
 * 400 si l'id est mal formé ou inconnu de Stripe, 502 si Stripe ne répond pas correctement,
 * 500 si la configuration du serveur est incomplète.
 * La réponse ne contient jamais la clé ni le corps brut de Stripe ; les journaux non plus.
 */
import { STRIPE_SESSION_ID_RE, type UnlockResponse } from '../../src/shared/api-types';
import { buildTokenPayload, signToken } from '../../src/shared/token';
import { readStripeConfig, type StripeMode } from '../_lib/env';
import { apiError, byMethod, json, logError, withErrorBoundary } from '../_lib/http';
import { fetchCheckoutSession, type CheckoutSession } from '../_lib/stripe';
import type { PagesHandler } from '../_lib/types';

const SCOPE = 'api/unlock';
const MAX_SESSION_ID_LENGTH = 255;
const MAX_EMAIL_LENGTH = 320;
const MAX_REF_LENGTH = 200;

function modeMismatch(keyMode: StripeMode): Response {
  return apiError('not_paid', {
    message:
      keyMode === 'live'
        ? 'Ce paiement a été fait en mode test : il ne débloque pas le plan.'
        : 'Ce paiement réel ne peut pas être vérifié sur ce site de test.',
  });
}

/** 402 adapté à l'état de la session, ou `null` si elle est bien complète et payée. */
function notPaidResponse(session: CheckoutSession): Response | null {
  if (session.status === 'open') {
    return apiError('not_paid', {
      message:
        'Ton paiement n’est pas encore finalisé. Termine-le sur la page de paiement, puis rouvre ce lien.',
    });
  }
  if (session.status === 'expired') {
    return apiError('not_paid', {
      message:
        'Cette session de paiement a expiré sans être réglée. Tu peux relancer l’achat depuis la page d’accueil.',
    });
  }
  if (session.status !== 'complete') return apiError('not_paid');
  if (session.payment_status === 'unpaid') {
    return apiError('not_paid', {
      message:
        'Ton paiement est en cours de confirmation par ta banque. Réessaie dans quelques minutes avec ce même lien.',
    });
  }
  if (session.payment_status !== 'paid') return apiError('not_paid');
  return null;
}

function boundedOrEmpty(value: string | null | undefined, max: number): string {
  const text = value?.trim() ?? '';
  return text.length <= max ? text : '';
}

const handleGet: PagesHandler = async ({ request, env }) => {
  const sessionId = new URL(request.url).searchParams.get('session_id') ?? '';
  if (sessionId.length > MAX_SESSION_ID_LENGTH || !STRIPE_SESSION_ID_RE.test(sessionId)) {
    return apiError('invalid_session_id');
  }

  const configResult = readStripeConfig(env);
  if (!configResult.ok) {
    logError(SCOPE, `variables d’environnement absentes ou invalides : ${configResult.invalid.join(', ')}`);
    return apiError('server_misconfigured');
  }
  const { stripeKey, stripeMode, tokenSecret, paymentLinkIds } = configResult.config;

  // Une session de test ne débloque jamais rien avec une clé réelle (et inversement).
  const sessionMode: StripeMode = sessionId.startsWith('cs_live_') ? 'live' : 'test';
  if (sessionMode !== stripeMode) return modeMismatch(stripeMode);

  const result = await fetchCheckoutSession(sessionId, stripeKey);
  if (!result.ok) {
    logError(SCOPE, `lecture de la session Stripe impossible : ${result.detail}`);
    if (result.failure === 'not_found') {
      return apiError('invalid_session_id', {
        message:
          'Cette session de paiement est introuvable. Ouvre le lien reçu juste après ton paiement.',
      });
    }
    return apiError('stripe_unavailable');
  }

  const session = result.session;
  if (session.id !== sessionId) {
    logError(SCOPE, 'Stripe a renvoyé une autre session que celle demandée');
    return apiError('stripe_unavailable');
  }
  if (session.livemode !== (stripeMode === 'live')) return modeMismatch(stripeMode);
  if (session.payment_link === null || !paymentLinkIds.has(session.payment_link)) {
    return apiError('unknown_payment_link');
  }
  const notPaid = notPaidResponse(session);
  if (notPaid) return notPaid;

  const email = boundedOrEmpty(
    session.customer_details?.email ?? session.customer_email,
    MAX_EMAIL_LENGTH,
  );
  const ref = boundedOrEmpty(session.client_reference_id, MAX_REF_LENGTH);
  const token = await signToken(buildTokenPayload({ email, sid: sessionId, ref }), tokenSecret);

  const body: UnlockResponse = { token, email, ref };
  return json(body);
};

export const onRequestGet: PagesHandler = withErrorBoundary(SCOPE, handleGet);

/** Toute autre méthode : 405 (`Allow: GET`). */
export const onRequest: PagesHandler = byMethod({ GET: onRequestGet });
