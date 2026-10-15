/**
 * Textes juridiques partagés par le navigateur et les Pages Functions : case de
 * renonciation (SPEC section 4), déclaration de rétractation en ligne et e-mails
 * de confirmation sur support durable (accusé de réception, accord d'accès immédiat).
 *
 * Module pur : aucune API propre au navigateur ou à Workers au niveau module.
 */
import { isToComplete, legal } from '../legal';

/** Libellé exact de la case de renonciation (SPEC section 4), jamais cochée d'avance. */
export const WAIVER_TEXT =
  "Je demande l'accès immédiat au contenu numérique et je reconnais perdre mon droit de rétractation (art. L221-28 13° C. conso)";

/** Version du texte de la case, enregistrée avec chaque accord (preuve, art. L221-7). */
export const WAIVER_TEXT_VERSION = '2026-10-14';

export const PRODUCT_NAME = 'Pass J-24 · Traceo';
export const PRODUCT_DESCRIPTION =
  'Pass J-24 · Traceo (programme de préparation au marathon ou au semi-marathon généré automatiquement, contenu numérique fourni sans support matériel)';

/** Fin de l'accès au plan, en toutes lettres (même date que `TOKEN_EXPIRES_AT`). */
export const ACCESS_UNTIL_LABEL = '30 juin 2027';

let parisFormat: Intl.DateTimeFormat | undefined;

/** « jeudi 15 octobre 2026 à 14:32 » à l'heure de Paris. */
export function formatParisDateTime(date: Date): string {
  parisFormat ??= new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = parisFormat.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')} à ${part('hour')}:${part('minute')}`;
}

/** Identité du vendeur pour les e-mails, sans les valeurs encore « À COMPLÉTER ». */
export function sellerSignature(): string {
  const parts = [`${legal.editor.name} ${legal.editor.status}`];
  for (const value of [legal.editor.address, legal.editor.email]) {
    if (!isToComplete(value)) parts.push(value);
  }
  if (!isToComplete(legal.editor.siren)) parts.push(`SIREN ${legal.editor.siren}`);
  return parts.join(', ');
}

/* ------------------------------------------------------------------ */
/* Rétractation en ligne                                              */
/* ------------------------------------------------------------------ */

export interface WithdrawalFields {
  name: string;
  purchaseEmail: string;
  orderRef?: string;
}

/** Texte intégral de la déclaration de rétractation envoyée par la fonction en ligne. */
export function withdrawalDeclaration(fields: WithdrawalFields): string {
  const ref = fields.orderRef?.trim();
  return (
    `Je soussigné(e) ${fields.name.trim()} notifie par la présente ma rétractation du contrat portant sur la fourniture du contenu numérique ${PRODUCT_DESCRIPTION}, ` +
    `commandé avec l'adresse e-mail ${fields.purchaseEmail.trim()}` +
    (ref ? ` (référence de la commande : ${ref})` : '') +
    '.'
  );
}

export interface MailContent {
  subject: string;
  text: string;
}

/** Accusé de réception de la rétractation, sur support durable (art. L221-21 et D221-5 C. conso). */
export function withdrawalAcknowledgement(data: {
  name: string;
  declaration: string;
  receivedAtLabel: string;
  reference: string;
}): MailContent {
  return {
    subject: `Accusé de réception de ta rétractation – ${PRODUCT_NAME}`,
    text: [
      `Bonjour ${data.name.trim()},`,
      '',
      `Nous avons bien reçu ta déclaration de rétractation, envoyée le ${data.receivedAtLabel} (heure de Paris), référence ${data.reference} :`,
      '',
      `« ${data.declaration} »`,
      '',
      'Tu seras remboursé de la totalité de la somme payée au plus tard 14 jours après cette date, avec le moyen de paiement utilisé pour l’achat, sans frais. Ton accès au plan sera ensuite désactivé.',
      '',
      'Garde ce message : il prouve la date de ta rétractation.',
      '',
      sellerSignature(),
    ].join('\n'),
  };
}

/* ------------------------------------------------------------------ */
/* Accord d'accès immédiat                                             */
/* ------------------------------------------------------------------ */

/**
 * Confirmation sur support durable de l'accord d'accès immédiat et de la perte du droit de
 * rétractation (art. L221-13 et L221-28 13° C. conso).
 */
export function waiverConfirmation(data: {
  /** Référence de la commande (id de session Stripe ou `paypal:<id>`). */
  orderRef: string;
  /** Vrai si l'accord a été donné avant le paiement (fenêtre d'achat ou page Stripe). */
  beforePayment: boolean;
  /** Date et heure de l'accord (ou de sa réception), à l'heure de Paris. */
  atLabel: string;
  siteUrl: string;
}): MailContent {
  const when = data.beforePayment ? 'Au moment de ta commande' : `Le ${data.atLabel} (heure de Paris)`;
  return {
    subject: `${PRODUCT_NAME} : confirmation de ta commande et de ta demande d’accès immédiat`,
    text: [
      'Bonjour,',
      '',
      `Merci pour ta commande du ${PRODUCT_DESCRIPTION}. Référence : ${data.orderRef}. Ton accès au plan est valable jusqu’au ${ACCESS_UNTIL_LABEL}.`,
      '',
      `${when}, tu as demandé l’accès immédiat à ce contenu numérique et reconnu perdre ainsi ton droit de rétractation (art. L221-28 13° du code de la consommation), en cochant la case : « ${WAIVER_TEXT} ». Ce message confirme ton accord.`,
      '',
      `Garantie légale de conformité, médiation et conditions générales de vente : ${data.siteUrl}/cgv/`,
      '',
      sellerSignature(),
    ].join('\n'),
  };
}
