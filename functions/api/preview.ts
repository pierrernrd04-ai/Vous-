/**
 * GET /api/preview?<PlanInput en query> → PreviewResponse (src/shared/api-types.ts).
 *
 * Aperçu gratuit : semaine 1 complète + vue d'ensemble des phases, allures et prédiction.
 * Pas de jeton. `Cache-Control: public, max-age=3600` sur les succès, `no-store` sur les erreurs.
 * 422 `invalid_input` (détails = erreurs de validation) ou `plan_too_short`.
 */
import { previewPlan } from '../../src/engine/index';
import type { PreviewResponse } from '../../src/shared/api-types';
import { CACHE_PUBLIC_1H, byMethod, json, withErrorBoundary } from '../_lib/http';
import { parsePreviewQuery, planErrorResponse, todayInParis } from '../_lib/input';
import type { PagesHandler } from '../_lib/types';

const handleGet: PagesHandler = (context) => {
  const parsed = parsePreviewQuery(new URL(context.request.url));
  if (!parsed.ok) return parsed.response;

  let preview: PreviewResponse;
  try {
    preview = previewPlan(parsed.value, todayInParis());
  } catch (error) {
    const response = planErrorResponse(error);
    if (response) return response;
    throw error;
  }
  return json(preview, { cache: CACHE_PUBLIC_1H });
};

export const onRequestGet: PagesHandler = withErrorBoundary('api/preview', handleGet);

/** Toute autre méthode : 405 (`Allow: GET`). */
export const onRequest: PagesHandler = byMethod({ GET: onRequestGet });
