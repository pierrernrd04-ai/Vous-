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
  /** Paramètres du plan (PlanInput sans startDate). */
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
