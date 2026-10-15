/**
 * Jeton d'accès au plan complet (SPEC section 3).
 *
 * Format : `base64url(JSON payload).base64url(HMAC-SHA256(secret, partie1))`,
 * où `partie1` est la chaîne ASCII exacte avant le point.
 * Web Crypto (`crypto.subtle`) uniquement, comparaison de signature à temps constant.
 * Fonctionne dans Workers, Node ≥ 22 (`globalThis.crypto`) et le navigateur.
 *
 * scripts/token.mjs réimplémente le même algorithme en JavaScript pur
 * (tests/api/token-script.test.ts prouve que ses jetons passent `verifyToken`).
 * Toute modification ici doit y être reportée.
 */

export const TOKEN_VERSION = 1;

/** Fin de validité de tous les jetons : 30/06/2027 23:59:59, heure de Paris. */
export const TOKEN_EXPIRES_AT = '2027-06-30T23:59:59+02:00';

/**
 * Dernière date de course acceptée pour le plan payant : le jour où l'accès prend fin
 * (le plan reste ouvert jusqu'au jour J inclus). Appliquée par les formulaires et l'API.
 */
export const LAST_RACE_DATE = TOKEN_EXPIRES_AT.slice(0, 10);

/** `TOKEN_EXPIRES_AT` en secondes Unix (valeur de `exp`). */
export const TOKEN_EXP_SEC = Math.floor(Date.parse(TOKEN_EXPIRES_AT) / 1000);

/** Longueur minimale de `TOKEN_SECRET`. */
export const TOKEN_SECRET_MIN_LENGTH = 32;

/** Longueur maximale acceptée pour un jeton (garde-fou avant tout calcul). */
export const TOKEN_MAX_LENGTH = 2048;

/** Bornes des champs texte du payload. */
const MAX_SUB_LENGTH = 320;
const MAX_SID_LENGTH = 300;
const MAX_REF_LENGTH = 200;

export interface TokenPayload {
  v: typeof TOKEN_VERSION;
  /** e-mail de l'acheteur (`''` si Stripe n'en a transmis aucun) */
  sub: string;
  /** id de session Stripe (`cs_…`) ou `paypal:<id>` */
  sid: string;
  /** référence client (`client_reference_id`, ex. `w1-marathon-l2`), `''` si absente */
  ref: string;
  /** émission, secondes Unix */
  iat: number;
  /** expiration, secondes Unix */
  exp: number;
}

/* ------------------------------------------------------------------ */
/* Construction et validation du payload                               */
/* ------------------------------------------------------------------ */

/** Secondes Unix entières pour un instant donné (défaut : maintenant). */
export function unixNow(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000);
}

/**
 * Payload standard : version courante, émis à `nowSec`, valable jusqu'à `TOKEN_EXPIRES_AT`.
 */
export function buildTokenPayload(fields: {
  email: string;
  sid: string;
  ref?: string;
  nowSec?: number;
}): TokenPayload {
  return {
    v: TOKEN_VERSION,
    sub: fields.email,
    sid: fields.sid,
    ref: fields.ref ?? '',
    iat: fields.nowSec ?? unixNow(),
    exp: TOKEN_EXP_SEC,
  };
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isUnixSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Vérifie la forme d'un payload (types, bornes, `exp > iat`), sans regarder l'horloge.
 * Les champs inconnus sont tolérés ici mais jamais recopiés (voir `normalizePayload`).
 */
export function isTokenPayload(value: unknown): value is TokenPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    p.v === TOKEN_VERSION &&
    isBoundedString(p.sub, 0, MAX_SUB_LENGTH) &&
    isBoundedString(p.sid, 1, MAX_SID_LENGTH) &&
    isBoundedString(p.ref, 0, MAX_REF_LENGTH) &&
    isUnixSeconds(p.iat) &&
    isUnixSeconds(p.exp) &&
    p.exp > p.iat
  );
}

/** Copie stricte (ordre des clés fixe, aucun champ en trop). */
function normalizePayload(p: TokenPayload): TokenPayload {
  return { v: p.v, sub: p.sub, sid: p.sid, ref: p.ref, iat: p.iat, exp: p.exp };
}

/* ------------------------------------------------------------------ */
/* base64url (RFC 4648 §5, sans remplissage)                           */
/* ------------------------------------------------------------------ */

const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

const B64URL_LOOKUP: Int16Array = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64URL_ALPHABET.length; i++) table[B64URL_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      B64URL_ALPHABET.charAt((n >> 18) & 63) +
      B64URL_ALPHABET.charAt((n >> 12) & 63) +
      B64URL_ALPHABET.charAt((n >> 6) & 63) +
      B64URL_ALPHABET.charAt(n & 63);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += B64URL_ALPHABET.charAt((n >> 18) & 63) + B64URL_ALPHABET.charAt((n >> 12) & 63);
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out +=
      B64URL_ALPHABET.charAt((n >> 18) & 63) +
      B64URL_ALPHABET.charAt((n >> 12) & 63) +
      B64URL_ALPHABET.charAt((n >> 6) & 63);
  }
  return out;
}

/**
 * Décodage strict : alphabet base64url uniquement, pas de `=`, et forme canonique
 * (les bits de remplissage du dernier caractère doivent être nuls).
 * @returns les octets, ou `null` si l'entrée n'est pas du base64url canonique.
 */
export function base64urlDecode(text: string): Uint8Array | null {
  if (!B64URL_RE.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length; i++) {
    const value = B64URL_LOOKUP[text.charCodeAt(i)] ?? -1;
    if (value < 0) return null;
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  // Bits restants (2 ou 4) : non nuls = encodage non canonique.
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return null;
  return out;
}

/* ------------------------------------------------------------------ */
/* HMAC et comparaison                                                  */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder();

/** Compare deux suites d'octets en temps constant (pour une longueur donnée). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function assertSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== 'string' || secret.length < TOKEN_SECRET_MIN_LENGTH) {
    throw new RangeError(
      `TOKEN_SECRET doit contenir au moins ${TOKEN_SECRET_MIN_LENGTH} caractères.`,
    );
  }
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(signature);
}

/* ------------------------------------------------------------------ */
/* API publique                                                         */
/* ------------------------------------------------------------------ */

/**
 * Signe `payload` avec `secret` (≥ 32 caractères) et renvoie le jeton.
 * @throws {RangeError} secret trop court ; {TypeError} payload invalide.
 */
export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  assertSecret(secret);
  if (!isTokenPayload(payload)) {
    throw new TypeError('Payload de jeton invalide.');
  }
  const body = base64urlEncode(encoder.encode(JSON.stringify(normalizePayload(payload))));
  const signature = base64urlEncode(await hmacSha256(secret, body));
  return `${body}.${signature}`;
}

/**
 * Vérifie format, signature (temps constant), version, forme du payload et expiration.
 * @param nowSec instant de référence en secondes Unix (défaut : maintenant).
 * @returns le payload si le jeton est valide, sinon `null` (jamais d'exception).
 */
export async function verifyToken(
  token: string,
  secret: string,
  nowSec: number = unixNow(),
): Promise<TokenPayload | null> {
  try {
    if (typeof token !== 'string' || token.length === 0 || token.length > TOKEN_MAX_LENGTH) {
      return null;
    }
    if (typeof secret !== 'string' || secret.length < TOKEN_SECRET_MIN_LENGTH) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body = '', signaturePart = ''] = parts;

    const signature = base64urlDecode(signaturePart);
    const payloadBytes = base64urlDecode(body);
    if (!signature || !payloadBytes) return null;

    const expected = await hmacSha256(secret, body);
    if (!timingSafeEqual(signature, expected)) return null;

    const payload = decodePayload(payloadBytes);
    if (!payload) return null;
    if (!Number.isFinite(nowSec) || payload.exp <= nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

function decodePayload(bytes: Uint8Array): TokenPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
  return isTokenPayload(parsed) ? normalizePayload(parsed) : null;
}

/**
 * Lit le payload SANS vérifier la signature ni l'expiration (côté navigateur :
 * afficher l'e-mail ou la date de fin). Ne jamais s'en servir pour autoriser quoi que ce soit.
 */
export function readTokenPayloadUnverified(token: string): TokenPayload | null {
  if (typeof token !== 'string' || token.length > TOKEN_MAX_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const bytes = base64urlDecode(parts[0] ?? '');
  return bytes ? decodePayload(bytes) : null;
}
