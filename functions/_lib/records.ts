/**
 * Registre des preuves (binding KV `RECORDS`) : déclarations de rétractation et accords
 * d'accès immédiat, conservés 5 ans (prescription de droit commun), et limitation simple
 * du nombre de demandes par adresse IP. Sans binding, les fonctions renvoient `false`.
 */
import { logError } from './http';
import type { Env } from './types';

/** Durée de conservation des preuves : 5 ans (secondes). */
export const RECORD_TTL_SEC = 5 * 365 * 24 * 3600;

export function recordsConfigured(env: Env): boolean {
  return env.RECORDS !== undefined;
}

/** Enregistre `value` (JSON) sous `key`. `true` si c'est fait. */
export async function putRecord(env: Env, key: string, value: unknown, scope: string): Promise<boolean> {
  if (!env.RECORDS) return false;
  try {
    await env.RECORDS.put(key, JSON.stringify(value), { expirationTtl: RECORD_TTL_SEC });
    return true;
  } catch (error) {
    logError(scope, 'enregistrement impossible', error);
    return false;
  }
}

/** Lit l'enregistrement `key`, ou `null` (absent, illisible ou pas de stockage). */
export async function getRecord(env: Env, key: string, scope: string): Promise<string | null> {
  if (!env.RECORDS) return null;
  try {
    return await env.RECORDS.get(key);
  } catch (error) {
    logError(scope, 'lecture impossible', error);
    return null;
  }
}

/**
 * Compte une demande de `ip` pour `bucket` sur l'heure en cours ; `false` au-delà de `limit`.
 * Sans stockage, rien n'est limité ici (ajouter une règle de limitation Cloudflare).
 */
export async function allowRequest(env: Env, bucket: string, ip: string, limit: number, now: Date = new Date()): Promise<boolean> {
  if (!env.RECORDS || !ip) return true;
  const hour = now.toISOString().slice(0, 13);
  const key = `rl:${bucket}:${hour}:${ip}`;
  try {
    const count = Number((await env.RECORDS.get(key)) ?? '0') || 0;
    if (count >= limit) return false;
    await env.RECORDS.put(key, String(count + 1), { expirationTtl: 3600 });
    return true;
  } catch (error) {
    logError(`ratelimit:${bucket}`, 'compteur indisponible', error);
    return true;
  }
}

/** Identifiant court et aléatoire, ex. `R-7K3Q9X2M` (alphabet sans caractères ambigus). */
export function randomReference(prefix: string): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}
