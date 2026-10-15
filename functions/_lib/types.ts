/**
 * Types communs des Pages Functions.
 *
 * Volontairement indépendants de `@cloudflare/workers-types` : les handlers
 * n'utilisent que des API standard (fetch, Request, Response, URL, crypto.subtle),
 * si bien que les tests Vitest (Node, lib DOM) peuvent importer functions/api/*.ts
 * directement. Éviter les globals propres à Workers (`caches.default`, `HTMLRewriter`…)
 * ou les isoler derrière un test d'existence.
 */

/** Variables d'environnement (SPEC section 3). Toutes peuvent manquer en cas de mauvaise configuration. */
export interface Env {
  /** Clé restreinte Stripe, lecture des Checkout Sessions (`rk_live_…` / `rk_test_…`). */
  STRIPE_KEY?: string;
  /** Secret HMAC des jetons, ≥ 32 caractères. */
  TOKEN_SECRET?: string;
  /** Ids `plink_…` acceptés, séparés par des virgules. */
  PAYMENT_LINK_IDS?: string;
  /** URL publique du site, sans barre finale (ex. https://traceo-pass.pages.dev). */
  SITE_URL?: string;
  /**
   * Accès désactivés (remboursement, rétractation, litige) : ids de session `cs_…` ou
   * `paypal:<id>`, séparés par des virgules. Vérifiés par /api/plan et /api/unlock.
   */
  REVOKED_SIDS?: string;
  /**
   * Stockage KV (binding `RECORDS`) des déclarations de rétractation et des accords d'accès
   * immédiat (preuve, art. L221-7 C. conso). Facultatif, mais requis pour la fonction de
   * rétractation en ligne si l'envoi d'e-mails n'est pas configuré.
   */
  RECORDS?: KvStore;
  /** Clé API de l'envoi d'e-mails (Resend, https://resend.com). */
  MAIL_API_KEY?: string;
  /** Expéditeur des e-mails, ex. « Pass J-24 · Traceo <support@exemple.fr> » (domaine vérifié). */
  MAIL_FROM?: string;
  /** Adresse du vendeur qui reçoit une copie de chaque rétractation (défaut : e-mail de src/legal.ts). */
  SELLER_EMAIL?: string;
}

/** Sous-ensemble de l'API KV de Cloudflare utilisé ici (simulable dans les tests). */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Sous-ensemble structurel de l'`EventContext` passé par Cloudflare Pages. */
export interface PagesContext<E = Env> {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
}

export type PagesHandler<E = Env> = (context: PagesContext<E>) => Response | Promise<Response>;
