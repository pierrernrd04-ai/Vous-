/**
 * Stockage local (`localStorage`) tolérant aux pannes : navigation privée,
 * quota plein, stockage désactivé… Chaque accès est protégé par try/catch et
 * renvoie une valeur neutre en cas d'échec. Rien n'est indispensable : le site
 * fonctionne sans stockage (on redemande simplement le lien personnel).
 */

const PREFIX = 'j24:';

/** Clés utilisées par le site (préfixées par `j24:`). */
export const STORAGE_KEYS = {
  /** Jeton d'accès au plan complet. */
  token: 'token',
  /** Référence client du jeton (`w1-marathon-l2`…). */
  ref: 'ref',
  /** Réglages du plan complet (PlanFormValues, avec le lundi de départ `startDate` une fois le plan reçu). */
  settings: 'settings',
  /** Dernières valeurs du formulaire gratuit. */
  freeForm: 'free-form',
  /** Séances cochées « fait » : { "<date>:<type>": horodatage }. */
  done: 'done',
  /** Horodatage ISO de l'acceptation de la renonciation au droit de rétractation. */
  waiver: 'waiver',
  /** Bandeau d'installation refermé (horodatage). */
  installDismissed: 'install-dismissed',
  /** Dernier plan reçu (secours hors ligne). */
  lastPlan: 'last-plan',
  /** Course et niveau choisis au moment de l'achat (préremplissage du plan). */
  checkoutPrefs: 'checkout-prefs',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function backend(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function readString(key: StorageKey): string | null {
  try {
    return backend()?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

/** @returns `true` si l'écriture a réussi. */
export function writeString(key: StorageKey, value: string): boolean {
  try {
    const storage = backend();
    if (!storage) return false;
    storage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: StorageKey): void {
  try {
    backend()?.removeItem(PREFIX + key);
  } catch {
    // Rien à faire : le stockage est indisponible.
  }
}

/**
 * Efface toutes les données du site sur cet appareil (clés `j24:`).
 * @returns le nombre d'éléments effacés.
 */
export function clearAllSiteData(): number {
  try {
    const storage = backend();
    if (!storage) return 0;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
    return keys.length;
  } catch {
    return 0;
  }
}

/** Préfixe des caches du service worker qui gardent une copie du plan (public/sw.js). */
export const OFFLINE_PLAN_CACHE_PREFIX = 'j24-api';

/** Supprime la copie hors ligne du plan gardée par le service worker (au mieux, sans erreur). */
export async function clearOfflinePlanCache(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(OFFLINE_PLAN_CACHE_PREFIX)).map((name) => caches.delete(name)));
  } catch {
    // Cache Storage indisponible : rien à effacer.
  }
}

/** Lit un JSON et le valide avec `guard` ; `null` si absent, illisible ou invalide. */
export function readJson<T>(key: StorageKey, guard: (value: unknown) => value is T): T | null {
  const raw = readString(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: StorageKey, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** Garde de type : objet simple (pas un tableau). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
