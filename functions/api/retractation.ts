/**
 * POST /api/retractation, corps WithdrawalRequest → WithdrawalResponse (src/shared/api-types.ts).
 *
 * Fonction de rétractation en ligne « Renoncer au contrat ici » (art. L221-21 et D221-5 du
 * code de la consommation, dans leur rédaction issue de l'ordonnance n° 2026-2 et du décret
 * n° 2026-3) : la déclaration (nom et prénom, e-mail et référence de la commande, adresse
 * de l'accusé de réception) est enregistrée avec sa date et son heure de réception, une copie
 * part au vendeur et un accusé de réception reprenant son contenu part à l'adresse indiquée.
 *
 * Il faut au moins un canal fiable vers le vendeur : stockage `RECORDS` ou copie par e-mail
 * (`MAIL_API_KEY`, `MAIL_FROM`, `SELLER_EMAIL` ou l'e-mail de src/legal.ts). Sinon 503
 * `service_unavailable` : la page propose alors l'e-mail ou le courrier.
 * 5 demandes par heure et par adresse IP au plus quand `RECORDS` est configuré (429).
 */
import { isToComplete, legal } from '../../src/legal';
import {
  FORM_REQUEST_MAX_BYTES,
  type WithdrawalRequest,
  type WithdrawalResponse,
} from '../../src/shared/api-types';
import { formatParisDateTime, withdrawalAcknowledgement, withdrawalDeclaration } from '../../src/shared/legal-texts';
import { apiError, byMethod, json, logError, withErrorBoundary } from '../_lib/http';
import { readJsonBody } from '../_lib/input';
import { isEmail, mailConfigured, sendMail } from '../_lib/mail';
import { allowRequest, putRecord, randomReference } from '../_lib/records';
import type { Env, PagesHandler } from '../_lib/types';

const SCOPE = 'api/retractation';
const MAX_NAME = 120;
const MAX_REF = 200;
const RATE_LIMIT_PER_HOUR = 5;

type Parsed = { ok: true; value: WithdrawalRequest } | { ok: false; errors: string[] };

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Valide le corps ; messages en français, affichables tels quels. */
function parseWithdrawal(raw: unknown): Parsed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Le formulaire est illisible. Recharge la page puis réessaie.'] };
  }
  const v = raw as Record<string, unknown>;
  const name = text(v.name);
  const purchaseEmail = text(v.purchaseEmail).toLowerCase();
  const ackEmail = text(v.ackEmail).toLowerCase();
  const orderRef = text(v.orderRef);
  const errors: string[] = [];
  if (name.length < 2 || name.length > MAX_NAME) errors.push('Indique tes nom et prénom.');
  if (!isEmail(purchaseEmail)) errors.push('Indique l’adresse e-mail utilisée pour l’achat.');
  if (!isEmail(ackEmail)) errors.push('Indique l’adresse e-mail où recevoir l’accusé de réception.');
  if (orderRef.length > MAX_REF) errors.push(`La référence de la commande doit faire au plus ${MAX_REF} caractères.`);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { name, purchaseEmail, ackEmail, ...(orderRef ? { orderRef } : {}) } };
}

/** Adresse du vendeur pour la copie de chaque rétractation. */
function sellerEmail(env: Env): string {
  const fromEnv = env.SELLER_EMAIL?.trim() ?? '';
  if (isEmail(fromEnv)) return fromEnv;
  return isToComplete(legal.editor.email) ? '' : legal.editor.email;
}

const handlePost: PagesHandler = async ({ request, env }) => {
  const seller = sellerEmail(env);
  const canStore = env.RECORDS !== undefined;
  const canMailSeller = mailConfigured(env) && seller !== '';
  if (!canStore && !canMailSeller) {
    logError(SCOPE, 'ni stockage RECORDS ni envoi d’e-mail au vendeur : fonction de rétractation indisponible');
    return apiError('service_unavailable');
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (!(await allowRequest(env, 'retractation', ip, RATE_LIMIT_PER_HOUR))) return apiError('rate_limited');

  const body = await readJsonBody(request, FORM_REQUEST_MAX_BYTES);
  if (!body.ok) return body.response;
  const parsed = parseWithdrawal(body.value);
  if (!parsed.ok) return apiError('invalid_input', { message: parsed.errors.join(' '), details: parsed.errors });
  const fields = parsed.value;

  const now = new Date();
  const receivedAt = now.toISOString();
  const receivedAtLabel = formatParisDateTime(now);
  const reference = randomReference('R');
  const declaration = withdrawalDeclaration(fields);

  const stored = await putRecord(
    env,
    `retractation:${receivedAt}:${reference}`,
    { reference, receivedAt, ...fields, declaration },
    SCOPE,
  );
  const sellerCopy = canMailSeller
    ? await sendMail(
        env,
        {
          to: seller,
          subject: `Rétractation ${reference} – ${fields.purchaseEmail}`,
          text: `Déclaration reçue le ${receivedAtLabel} (heure de Paris), référence ${reference} :\n\n« ${declaration} »\n\nAccusé de réception demandé à : ${fields.ackEmail}\nÀ faire : rembourser sous 14 jours et ajouter l'id de la commande à REVOKED_SIDS.`,
          replyTo: fields.ackEmail,
        },
        SCOPE,
      )
    : false;
  if (!stored && !sellerCopy) {
    logError(SCOPE, 'déclaration ni enregistrée ni transmise');
    return apiError('service_unavailable');
  }

  const ack = withdrawalAcknowledgement({ name: fields.name, declaration, receivedAtLabel, reference });
  const acknowledgementSent = await sendMail(
    env,
    { to: fields.ackEmail, subject: ack.subject, text: ack.text, ...(seller ? { replyTo: seller } : {}) },
    SCOPE,
  );

  const response: WithdrawalResponse = { reference, receivedAt, receivedAtLabel, declaration, acknowledgementSent };
  return json(response);
};

export const onRequestPost: PagesHandler = withErrorBoundary(SCOPE, handlePost);

/** Toute autre méthode : 405 (`Allow: POST`). */
export const onRequest: PagesHandler = byMethod({ POST: onRequestPost });
