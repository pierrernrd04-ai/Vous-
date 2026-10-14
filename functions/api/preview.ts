/**
 * GET /api/preview?<PlanInput en query> → PreviewResponse (src/shared/api-types.ts).
 * Pas de jeton. Cache 1 h.
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « API ».
 */
import type { PagesHandler } from '../_lib/types';

export const onRequestGet: PagesHandler = () => {
  throw new Error('GET /api/preview : not implemented');
};
