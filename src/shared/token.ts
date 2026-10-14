/**
 * Jeton d'accès au plan complet (SPEC section 3).
 *
 * Format : `base64url(JSON payload).base64url(HMAC-SHA256(secret, partie1))`.
 * Web Crypto (`crypto.subtle`) uniquement, vérification à temps constant.
 * Fonctionne dans Workers, Node ≥ 22 (tests, scripts/token.mjs) et le navigateur.
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « API ».
 */

export const TOKEN_VERSION = 1;

/** Fin de validité de tous les jetons : 30/06/2027 23:59:59, heure de Paris. */
export const TOKEN_EXPIRES_AT = '2027-06-30T23:59:59+02:00';

/** `TOKEN_EXPIRES_AT` en secondes Unix (valeur de `exp`). */
export const TOKEN_EXP_SEC = Math.floor(Date.parse(TOKEN_EXPIRES_AT) / 1000);

/** Longueur minimale de `TOKEN_SECRET`. */
export const TOKEN_SECRET_MIN_LENGTH = 32;

export interface TokenPayload {
  v: typeof TOKEN_VERSION;
  /** e-mail de l'acheteur */
  sub: string;
  /** id de session Stripe (`cs_…`) ou `paypal:<id>` */
  sid: string;
  /** référence client (`client_reference_id`, ex. `w1-marathon-l2`) */
  ref: string;
  /** émission, secondes Unix */
  iat: number;
  /** expiration, secondes Unix */
  exp: number;
}

/** Signe `payload` avec `secret` (≥ 32 caractères) et renvoie le jeton. */
export async function signToken(_payload: TokenPayload, _secret: string): Promise<string> {
  throw new Error('signToken : not implemented');
}

/**
 * Vérifie signature, version et expiration.
 * @param nowSec instant de référence en secondes Unix (défaut : maintenant).
 * @returns le payload si le jeton est valide, sinon `null` (jamais d'exception).
 */
export async function verifyToken(
  _token: string,
  _secret: string,
  _nowSec?: number,
): Promise<TokenPayload | null> {
  throw new Error('verifyToken : not implemented');
}
