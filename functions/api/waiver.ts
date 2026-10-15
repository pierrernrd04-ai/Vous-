/**
 * POST /api/waiver, corps WaiverRequest `{ token }` → WaiverResponse (src/shared/api-types.ts).
 *
 * Preuve et confirmation sur support durable de la demande d'accès immédiat (art. L221-13,
 * L221-28 13° et L221-7 du code de la consommation) : l'accord est enregistré (`RECORDS`,
 * avec la référence de la commande, l'e-mail, la date et la version du texte de la case) et
 * confirmé par e-mail à l'acheteur. Une seule confirmation par commande quand `RECORDS`
 * est configuré. 401 si le jeton est invalide, 503 si ni stockage ni e-mail ne sont configurés.
 */
import { FORM_REQUEST_MAX_BYTES, type WaiverResponse } from '../../src/shared/api-types';
import { WAIVER_TEXT, WAIVER_TEXT_VERSION, formatParisDateTime, waiverConfirmation } from '../../src/shared/legal-texts';
import { checkAccessToken } from '../_lib/access';
import { readTokenSecret } from '../_lib/env';
import { apiError, byMethod, json, logError, withErrorBoundary } from '../_lib/http';
import { readJsonBody } from '../_lib/input';
import { isEmail, mailConfigured, sendMail } from '../_lib/mail';
import { getRecord, putRecord } from '../_lib/records';
import type { PagesHandler } from '../_lib/types';

const SCOPE = 'api/waiver';
const WAIVER_REF_PREFIX = 'w1-';

/** Référence lisible de la commande : `cs_live_…` ou `PayPal <id>`. */
function orderReference(sid: string): string {
  return sid.startsWith('paypal:') ? `PayPal ${sid.slice('paypal:'.length)}` : sid;
}

const handlePost: PagesHandler = async ({ request, env }) => {
  const tokenSecret = readTokenSecret(env);
  if (!tokenSecret) {
    logError(SCOPE, 'variable d’environnement absente ou invalide : TOKEN_SECRET');
    return apiError('server_misconfigured');
  }
  if (env.RECORDS === undefined && !mailConfigured(env)) return apiError('service_unavailable');

  const body = await readJsonBody(request, FORM_REQUEST_MAX_BYTES);
  if (!body.ok) return body.response;
  const token = typeof body.value === 'object' && body.value !== null ? (body.value as Record<string, unknown>).token : undefined;
  const access = await checkAccessToken(env, token, tokenSecret);
  if (!access.ok) return access.response;
  const { payload } = access;

  const key = `waiver:${payload.sid}`;
  if ((await getRecord(env, key, SCOPE)) !== null) {
    // Déjà enregistré et confirmé pour cette commande : rien à renvoyer.
    return json({ recorded: true, confirmationSent: false } satisfies WaiverResponse);
  }

  const now = new Date();
  const beforePayment = payload.ref.startsWith(WAIVER_REF_PREFIX);
  const recorded = await putRecord(
    env,
    key,
    {
      sid: payload.sid,
      email: payload.sub,
      ref: payload.ref,
      at: now.toISOString(),
      beforePayment,
      text: WAIVER_TEXT,
      textVersion: WAIVER_TEXT_VERSION,
    },
    SCOPE,
  );

  const siteUrl = (env.SITE_URL?.trim() || new URL(request.url).origin).replace(/\/+$/, '');
  const mail = waiverConfirmation({
    orderRef: orderReference(payload.sid),
    beforePayment,
    atLabel: formatParisDateTime(now),
    siteUrl,
  });
  const confirmationSent = isEmail(payload.sub)
    ? await sendMail(env, { to: payload.sub, subject: mail.subject, text: mail.text }, SCOPE)
    : false;

  return json({ recorded, confirmationSent } satisfies WaiverResponse);
};

export const onRequestPost: PagesHandler = withErrorBoundary(SCOPE, handlePost);

/** Toute autre méthode : 405 (`Allow: POST`). */
export const onRequest: PagesHandler = byMethod({ POST: onRequestPost });
