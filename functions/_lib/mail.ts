/**
 * Envoi d'e-mails transactionnels (accusés de réception, confirmations) via l'API HTTP de
 * Resend (`MAIL_API_KEY`, `MAIL_FROM`). Sans configuration, `sendMail` renvoie `false` :
 * l'appelant décide alors d'une solution de repli. Ne journalise jamais la clé ni le contenu.
 */
import { logError } from './http';
import type { Env } from './types';

export const MAIL_API_URL = 'https://api.resend.com/emails';
export const MAIL_TIMEOUT_MS = 8000;

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** Adresse e-mail plausible (forme simple, ≤ 254 caractères). */
export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/** Vrai si l'envoi d'e-mails est configuré. */
export function mailConfigured(env: Env): boolean {
  return Boolean(env.MAIL_API_KEY?.trim() && env.MAIL_FROM?.trim());
}

/** Envoie un e-mail texte. `true` si le prestataire l'a accepté, `false` sinon (jamais d'exception). */
export async function sendMail(env: Env, message: MailMessage, scope: string): Promise<boolean> {
  const key = env.MAIL_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  if (!key || !from || !isEmail(message.to)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);
  try {
    const response = await fetch(MAIL_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo && isEmail(message.replyTo) ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      logError(scope, `envoi d’e-mail refusé : HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    logError(scope, controller.signal.aborted ? 'envoi d’e-mail : délai dépassé' : 'envoi d’e-mail impossible', error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
