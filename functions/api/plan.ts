/**
 * POST /api/plan, corps PlanRequest → PlanResponse (src/shared/api-types.ts).
 * 401 si le jeton est invalide ou expiré.
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « API ».
 */
import type { PagesHandler } from '../_lib/types';

export const onRequestPost: PagesHandler = () => {
  throw new Error('POST /api/plan : not implemented');
};
