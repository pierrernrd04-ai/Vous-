/**
 * Lecture et validation des variables d'environnement (SPEC section 3).
 *
 * Les erreurs ne citent que le NOM des variables fautives, jamais leur valeur.
 */
import { TOKEN_SECRET_MIN_LENGTH } from '../../src/shared/token';
import type { Env } from './types';

export type StripeMode = 'live' | 'test';

export interface StripeConfig {
  stripeKey: string;
  /** Mode déduit du préfixe de la clé (`sk_live_`, `rk_test_`…). */
  stripeMode: StripeMode;
  tokenSecret: string;
  paymentLinkIds: ReadonlySet<string>;
}

export type ConfigResult<T> = { ok: true; config: T } | { ok: false; invalid: string[] };

// Les vrais identifiants Stripe sont alphanumériques après le préfixe ; « _ » est toléré
// pour les valeurs factices des environnements locaux et e2e (`plink_test_x`).
const STRIPE_KEY_RE = /^(?:sk|rk)_(live|test)_[A-Za-z0-9][A-Za-z0-9_]*$/;
const PAYMENT_LINK_ID_RE = /^plink_[A-Za-z0-9][A-Za-z0-9_]*$/;

/** Mode Stripe d'une clé, ou `null` si la clé n'a pas un format reconnu. */
export function stripeKeyMode(key: string | undefined): StripeMode | null {
  const match = STRIPE_KEY_RE.exec(key?.trim() ?? '');
  return match ? (match[1] as StripeMode) : null;
}

/** `TOKEN_SECRET` s'il est présent et assez long, sinon `null`. */
export function readTokenSecret(env: Env): string | null {
  const secret = env.TOKEN_SECRET;
  return typeof secret === 'string' && secret.length >= TOKEN_SECRET_MIN_LENGTH ? secret : null;
}

/**
 * Ids `plink_…` de `PAYMENT_LINK_IDS` (séparés par des virgules, espaces tolérés).
 * @returns `null` si la liste est vide ou contient un id mal formé.
 */
export function parsePaymentLinkIds(raw: string | undefined): Set<string> | null {
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0 || !ids.every((id) => PAYMENT_LINK_ID_RE.test(id))) return null;
  return new Set(ids);
}

/** Configuration complète de `GET /api/unlock`. */
export function readStripeConfig(env: Env): ConfigResult<StripeConfig> {
  const invalid: string[] = [];
  const stripeKey = env.STRIPE_KEY?.trim() ?? '';
  const stripeMode = stripeKeyMode(stripeKey);
  if (!stripeMode) invalid.push('STRIPE_KEY');
  const tokenSecret = readTokenSecret(env);
  if (!tokenSecret) invalid.push('TOKEN_SECRET');
  const paymentLinkIds = parsePaymentLinkIds(env.PAYMENT_LINK_IDS);
  if (!paymentLinkIds) invalid.push('PAYMENT_LINK_IDS');

  if (!stripeMode || !tokenSecret || !paymentLinkIds) return { ok: false, invalid };
  return { ok: true, config: { stripeKey, stripeMode, tokenSecret, paymentLinkIds } };
}

/** Longueur maximale d'un id dans `REVOKED_SIDS` (même borne que `sid` dans le jeton). */
const MAX_REVOKED_SID_LENGTH = 300;

/**
 * Ids désactivés de `REVOKED_SIDS` (séparés par des virgules ou des retours à la ligne,
 * espaces tolérés). Les entrées vides ou démesurées sont ignorées.
 */
export function parseRevokedSids(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? '')
      .split(/[,\n]/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && id.length <= MAX_REVOKED_SID_LENGTH),
  );
}

/** Vrai si l'accès lié à cette session (ou à ce paiement PayPal) a été désactivé. */
export function isRevokedSid(env: Env, sid: string): boolean {
  return parseRevokedSids(env.REVOKED_SIDS).has(sid.trim());
}
