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
