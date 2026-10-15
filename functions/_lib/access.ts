/**
 * Contrôle d'un jeton d'accès côté serveur, commun à /api/plan et /api/waiver :
 * signature et expiration, jeton de paiement de test hors déploiement de test,
 * accès désactivé par `REVOKED_SIDS`.
 */
import { verifyToken, type TokenPayload } from '../../src/shared/token';
import { isRevokedSid, stripeKeyMode } from './env';
import { apiError } from './http';
import type { Env } from './types';

const TEST_TOKEN_MESSAGE =
  'Ce lien vient d’un paiement de test : il n’ouvre pas le plan sur ce site. Ouvre le lien personnel reçu après ton achat.';
const REVOKED_MESSAGE =
  'Cet accès a été désactivé (remboursement ou rétractation). Si c’est une erreur, écris au support avec l’e-mail utilisé pour l’achat.';

export type AccessResult = { ok: true; payload: TokenPayload } | { ok: false; response: Response };

export async function checkAccessToken(env: Env, token: unknown, tokenSecret: string): Promise<AccessResult> {
  const payload = typeof token === 'string' ? await verifyToken(token, tokenSecret) : null;
  if (!payload) return { ok: false, response: apiError('invalid_token') };
  // Un jeton émis pour un paiement de test (déploiement d'aperçu, carte 4242) ne vaut que
  // sur un déploiement de test : jamais sur le site réel ni sur un site sans clé Stripe.
  if (payload.sid.startsWith('cs_test_') && stripeKeyMode(env.STRIPE_KEY) !== 'test') {
    return { ok: false, response: apiError('invalid_token', { message: TEST_TOKEN_MESSAGE }) };
  }
  if (isRevokedSid(env, payload.sid)) {
    return { ok: false, response: apiError('invalid_token', { message: REVOKED_MESSAGE }) };
  }
  return { ok: true, payload };
}
