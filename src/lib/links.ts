/**
 * Construction des liens (boucle Traceo, lien personnel, e-mail au support). Pures.
 */
import { config } from '../config';
import { isToComplete, legal } from '../legal';

/** Distance de boucle lisible dans une URL : 8, 8.5… (pas de virgule). */
function kmParam(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return String(rounded);
}

/** « Générer ma boucle de X km » → `traceoAppUrl?km=X`. */
export function loopUrl(km: number, base: string = config.traceoAppUrl): string {
  try {
    const url = new URL(base);
    url.searchParams.set('km', kmParam(km));
    return url.toString();
  } catch {
    return `${base}${base.includes('?') ? '&' : '?'}km=${encodeURIComponent(kmParam(km))}`;
  }
}

/** Lien personnel à conserver : `<origin>/plan/#t=<jeton>`. */
export function personalPlanUrl(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/plan/#t=${token}`;
}

/** Extrait un jeton d'un lien personnel collé, d'un fragment `#t=…` ou d'un jeton brut. */
export function extractToken(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const fromHash = /(?:^|[#&?])t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/.exec(value);
  if (fromHash?.[1]) return fromHash[1];
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/** Adresse du support, ou `null` tant qu'elle n'est pas renseignée dans legal.ts. */
export function supportEmail(): string | null {
  const email = legal.editor.email.trim();
  return isToComplete(email) || !email.includes('@') ? null : email;
}

/** Lien `mailto:` vers `to` avec sujet et corps encodés (RFC 6068). */
export function mailtoUrl(to: string, subject: string, body = ''): string {
  const params: string[] = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to}?${params.join('&')}`;
}
