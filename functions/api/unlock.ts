/**
 * GET /api/unlock?session_id=cs_… → UnlockResponse (src/shared/api-types.ts).
 * Vérifie la Checkout Session Stripe puis émet un jeton.
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « API ».
 */
import type { PagesHandler } from '../_lib/types';

export const onRequestGet: PagesHandler = () => {
  throw new Error('GET /api/unlock : not implemented');
};
