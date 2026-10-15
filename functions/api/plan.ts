/**
 * POST /api/plan, corps PlanRequest `{ token, input }` → PlanResponse (src/shared/api-types.ts).
 *
 * Ordre des contrôles : taille du corps (4 Ko, sinon 413) → JSON (400) → jeton (401)
 * → validation de l'entrée par le moteur (422 `invalid_input`) → génération
 * (422 `plan_too_short` à moins de 8 semaines de la course). Réponses `no-store`.
 */
import { generatePlan } from '../../src/engine/index';
import { PLAN_REQUEST_MAX_BYTES, type PlanResponse } from '../../src/shared/api-types';
import { verifyToken } from '../../src/shared/token';
import { readTokenSecret } from '../_lib/env';
import { apiError, byMethod, json, logError, withErrorBoundary } from '../_lib/http';
import { checkPlanInput, planErrorResponse, readJsonBody, todayInParis } from '../_lib/input';
import type { PagesHandler } from '../_lib/types';

const SCOPE = 'api/plan';

const handlePost: PagesHandler = async ({ request, env }) => {
  const tokenSecret = readTokenSecret(env);
  if (!tokenSecret) {
    logError(SCOPE, 'variable d’environnement absente ou invalide : TOKEN_SECRET');
    return apiError('server_misconfigured');
  }

  const body = await readJsonBody(request, PLAN_REQUEST_MAX_BYTES);
  if (!body.ok) return body.response;
  if (typeof body.value !== 'object' || body.value === null || Array.isArray(body.value)) {
    return apiError('bad_request', { message: 'Le corps doit être un objet { token, input }.' });
  }
  const { token, input } = body.value as Record<string, unknown>;

  const payload = typeof token === 'string' ? await verifyToken(token, tokenSecret) : null;
  if (!payload) return apiError('invalid_token');

  const checked = checkPlanInput(input);
  if (!checked.ok) return checked.response;

  let plan: PlanResponse;
  try {
    plan = generatePlan(checked.value, todayInParis());
  } catch (error) {
    const response = planErrorResponse(error);
    if (response) return response;
    throw error;
  }
  return json(plan);
};

export const onRequestPost: PagesHandler = withErrorBoundary(SCOPE, handlePost);

/** Toute autre méthode : 405 (`Allow: POST`). */
export const onRequest: PagesHandler = byMethod({ POST: onRequestPost });
