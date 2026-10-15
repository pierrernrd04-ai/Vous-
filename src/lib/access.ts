/**
 * Jeton d'accès côté navigateur : lecture depuis `#t=` ou le stockage local,
 * enregistrement, lecture (non vérifiée) du contenu pour l'affichage.
 * La validité réelle est toujours contrôlée par le serveur (`/api/plan`).
 */
import { readTokenPayloadUnverified, type TokenPayload } from '../shared/token';
import { extractToken, mailtoUrl, supportEmail } from './links';
import { STORAGE_KEYS, clearOfflinePlanCache, readString, removeItem, writeString } from './storage';

/** Jeton présent dans le fragment de l'URL (`#t=…`), sinon `null`. */
export function tokenFromHash(hash: string = location.hash): string | null {
  if (!hash || hash.length < 3) return null;
  return extractToken(hash);
}

export function storedToken(): string | null {
  const token = readString(STORAGE_KEYS.token);
  return token && extractToken(token) === token ? token : null;
}

export function storeToken(token: string, ref?: string): void {
  const previous = storedToken();
  writeString(STORAGE_KEYS.token, token);
  if (ref !== undefined) writeString(STORAGE_KEYS.ref, ref);
  // Nouveau jeton : le plan de secours d'un autre achat n'a plus lieu d'être.
  if (previous && previous !== token) removeItem(STORAGE_KEYS.lastPlan);
}

export function clearToken(): void {
  removeItem(STORAGE_KEYS.token);
  removeItem(STORAGE_KEYS.ref);
  removeItem(STORAGE_KEYS.lastPlan);
  void clearOfflinePlanCache();
}

/** Contenu du jeton, pour affichage uniquement (signature non vérifiée). */
export function tokenInfo(token: string): TokenPayload | null {
  return readTokenPayloadUnverified(token);
}

/** Lien `mailto:` vers le support (ou `null` si l'adresse n'est pas encore renseignée). */
export function supportMailto(subject: string, body: string): string | null {
  const email = supportEmail();
  return email ? mailtoUrl(email, subject, body) : null;
}
