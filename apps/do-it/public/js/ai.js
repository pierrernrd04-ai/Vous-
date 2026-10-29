// Appel à /api/ecrire, avec repli sur le mode local.
import { localWrite } from './local-ai.js';
import { getTheme } from './themes.js';

const ENDPOINT = '/api/ecrire';

/** État de l’IA côté serveur : { ai, needsCode, authorized } ou null si injoignable. */
export async function aiStatus(accessCode) {
  try {
    const res = await fetch(ENDPOINT, { headers: accessCode ? { 'x-doit-code': accessCode } : {}, cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('json')) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Écrit une entrée. Renvoie toujours un résultat :
 * `{ source: 'ai', entry }` ou `{ source: 'local', entry, reason }`.
 * Dans les deux cas, `entry.themes` est une liste de `{ id, label, emoji }`.
 */
export async function writeEntry({ segments, style, customThemes, accessCode, when }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 62_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(accessCode ? { 'x-doit-code': accessCode } : {}) },
      body: JSON.stringify({
        segments: segments.map(({ text, question }) => (question ? { text, question } : { text })),
        style,
        when,
        customThemes: customThemes.map(({ id, label, emoji }) => ({ id, label, emoji })),
      }),
      signal: controller.signal,
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : null;
    if (res.ok && data?.entry) return { source: 'ai', entry: data.entry };
    const reason = data?.error || (res.status === 404 ? 'ai_unavailable' : 'upstream');
    return local(segments, style, customThemes, reason, data?.message);
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : navigator.onLine === false ? 'offline' : 'network';
    return local(segments, style, customThemes, reason);
  } finally {
    clearTimeout(timer);
  }
}

function local(segments, style, customThemes, reason, message) {
  const out = localWrite(segments, style);
  const themes = out.themes.map((id) => {
    const t = getTheme(id, customThemes);
    return { id: t.id, label: t.label, emoji: t.emoji };
  });
  return { source: 'local', reason, message, entry: { ...out, themes } };
}

/** Messages courts affichés quand l’IA n’a pas pu écrire. */
export const REASONS = {
  offline: 'Hors-ligne : écrit en mode local, je le sublimerai au retour du réseau.',
  network: 'Réseau capricieux : écrit en mode local, je réessaierai.',
  timeout: 'L’IA a mis trop de temps : écrit en mode local, je réessaierai.',
  code: 'Code d’accès requis pour l’IA (Bilan › Réglages).',
  ai_unavailable: 'IA non connectée : écrit en mode local.',
  busy: 'L’IA est très demandée : écrit en mode local, je réessaierai.',
  refusal: 'L’IA n’a pas voulu réécrire ce passage : version locale conservée.',
  input: 'Entrée trop longue pour l’IA : version locale conservée.',
  upstream: 'L’IA est indisponible : écrit en mode local, je réessaierai.',
  output: 'Réponse de l’IA incomplète : écrit en mode local, je réessaierai.',
  server: 'Petit souci côté serveur : écrit en mode local, je réessaierai.',
};

/** Les échecs passagers méritent une nouvelle tentative automatique. */
export function isRetryable(reason) {
  return ['offline', 'network', 'timeout', 'busy', 'upstream', 'output', 'server'].includes(reason);
}
