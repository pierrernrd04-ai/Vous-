#!/usr/bin/env node
/**
 * Génère un jeton d'accès au plan (ventes PayPal, support) — SPEC section 3.
 *
 *   TOKEN_SECRET=… SITE_URL=https://traceo-pass.pages.dev npm run token -- <email> [ref]
 *
 * `TOKEN_SECRET` et `SITE_URL` sont lus dans l'environnement, sinon dans `.dev.vars`
 * à la racine du dépôt (chemin modifiable avec `DEV_VARS_FILE`). Imprime le jeton et
 * le lien personnel `SITE_URL/plan/#t=<jeton>`.
 *
 * Même algorithme que src/shared/token.ts (réimplémenté en JavaScript pur pour tourner
 * sur tout Node ≥ 22 sans compilation) : `base64url(JSON payload).base64url(HMAC-SHA256)`,
 * payload `{ v: 1, sub, sid, ref, iat, exp }`. tests/api/token-script.test.ts vérifie que
 * les jetons produits ici passent `verifyToken`. Toute modification doit être reportée
 * dans les deux fichiers.
 */
import { webcrypto } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_VERSION = 1;
/** Fin de validité de tous les jetons : 30/06/2027 23:59:59, heure de Paris. */
export const TOKEN_EXPIRES_AT = '2027-06-30T23:59:59+02:00';
export const TOKEN_EXP_SEC = Math.floor(Date.parse(TOKEN_EXPIRES_AT) / 1000);
export const TOKEN_SECRET_MIN_LENGTH = 32;
/** URL de production (wrangler.toml), utilisée si `SITE_URL` n'est défini nulle part. */
export const DEFAULT_SITE_URL = 'https://traceo-pass.pages.dev';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
/** Même règle que le `client_reference_id` de Stripe. */
const REF_RE = /^[A-Za-z0-9_-]{1,200}$/;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_DEV_VARS_PATH = resolve(dirname(SCRIPT_PATH), '..', '.dev.vars');

const USAGE = `Usage : npm run token -- <email> [ref]

  <email>  adresse de l'acheteur (elle figure dans le jeton)
  [ref]    référence facultative : id de la transaction PayPal, ou w1-<course>-<niveau>
           (lettres, chiffres, « - » et « _ », 200 caractères au plus)

TOKEN_SECRET (au moins ${TOKEN_SECRET_MIN_LENGTH} caractères, le même qu'en production) et SITE_URL
sont lus dans l'environnement, sinon dans .dev.vars.

Exemple :
  TOKEN_SECRET='…' SITE_URL='${DEFAULT_SITE_URL}' npm run token -- acheteur@exemple.fr 5TY12345AB678901C`;

/** Erreur destinée à l'utilisateur du script (message affiché tel quel). */
export class TokenScriptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenScriptError';
  }
}

/* ------------------------------------------------------------------ */
/* Configuration                                                        */
/* ------------------------------------------------------------------ */

/**
 * Lit un fichier au format `.dev.vars` (dotenv simple) : `CLÉ=valeur`, lignes `#` ignorées,
 * guillemets simples ou doubles retirés, commentaire en fin de ligne toléré hors guillemets.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDevVars(text) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const quoted = /^(["'])(.*)\1$/.exec(rawValue);
    vars[key] = quoted ? quoted[2] : rawValue.replace(/\s+#.*$/, '').trim();
  }
  return vars;
}

/**
 * Réglages effectifs : l'environnement d'abord, puis `.dev.vars` s'il existe.
 * @param {Record<string, string | undefined>} env
 * @returns {{ secret: string, siteUrl: string, warnings: string[] }}
 */
export function loadSettings(env) {
  const devVarsPath = env.DEV_VARS_FILE ? resolve(env.DEV_VARS_FILE) : DEFAULT_DEV_VARS_PATH;
  const devVars = existsSync(devVarsPath) ? parseDevVars(readFileSync(devVarsPath, 'utf8')) : {};
  const warnings = [];

  let secret = env.TOKEN_SECRET;
  if (!secret && devVars.TOKEN_SECRET) {
    secret = devVars.TOKEN_SECRET;
    warnings.push(
      `TOKEN_SECRET lu dans ${devVarsPath} : c'est le secret local. ` +
        'Pour un client, utilise le TOKEN_SECRET de production, sinon son lien ne marchera pas.',
    );
  }
  if (!secret) {
    throw new TokenScriptError(
      'TOKEN_SECRET est introuvable (ni dans l\'environnement, ni dans .dev.vars).',
    );
  }
  if (secret.length < TOKEN_SECRET_MIN_LENGTH) {
    throw new TokenScriptError(
      `TOKEN_SECRET doit contenir au moins ${TOKEN_SECRET_MIN_LENGTH} caractères.`,
    );
  }

  let siteUrl = env.SITE_URL;
  if (!siteUrl && devVars.SITE_URL) {
    siteUrl = devVars.SITE_URL;
    warnings.push(`SITE_URL lu dans ${devVarsPath} : ${siteUrl}`);
  }
  if (!siteUrl) {
    siteUrl = DEFAULT_SITE_URL;
    warnings.push(`SITE_URL absent : lien construit sur ${DEFAULT_SITE_URL}`);
  }
  return { secret, siteUrl: normalizeSiteUrl(siteUrl), warnings };
}

/**
 * @param {string} raw
 * @returns {string} URL http(s) sans barre finale
 */
export function normalizeSiteUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new TokenScriptError(`SITE_URL n'est pas une URL valide : « ${raw} ».`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TokenScriptError('SITE_URL doit commencer par https:// (ou http:// en local).');
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/* ------------------------------------------------------------------ */
/* Jeton (identique à src/shared/token.ts)                             */
/* ------------------------------------------------------------------ */

const subtle = globalThis.crypto?.subtle ?? webcrypto.subtle;
const encoder = new TextEncoder();

/** @param {Uint8Array} bytes */
function base64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * @param {string} secret
 * @param {string} message
 * @returns {Promise<Uint8Array>}
 */
async function hmacSha256(secret, message) {
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Valide l'e-mail et la référence, puis construit le payload (clés dans l'ordre de token.ts).
 * @param {{ email: string, ref?: string, nowSec?: number }} fields
 */
export function buildPayload({ email, ref = '', nowSec = Math.floor(Date.now() / 1000) }) {
  const sub = email.trim();
  if (sub.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(sub)) {
    throw new TokenScriptError(`Adresse e-mail invalide : « ${email} ».`);
  }
  if (ref !== '' && !REF_RE.test(ref)) {
    throw new TokenScriptError(
      'Référence invalide : lettres, chiffres, « - » et « _ » uniquement, 200 caractères au plus.',
    );
  }
  if (!Number.isSafeInteger(nowSec) || nowSec < 0) {
    throw new TokenScriptError('Horloge invalide.');
  }
  if (nowSec >= TOKEN_EXP_SEC) {
    throw new TokenScriptError(
      'Les jetons expirent le 30/06/2027 : cette date est dépassée, plus aucun jeton ne peut être émis.',
    );
  }
  return {
    v: TOKEN_VERSION,
    sub,
    sid: `paypal:${ref || `manuel-${nowSec}`}`,
    ref,
    iat: nowSec,
    exp: TOKEN_EXP_SEC,
  };
}

/**
 * @param {{ email: string, ref?: string, secret: string, nowSec?: number }} options
 * @returns {Promise<string>}
 */
export async function createToken({ secret, ...fields }) {
  if (typeof secret !== 'string' || secret.length < TOKEN_SECRET_MIN_LENGTH) {
    throw new TokenScriptError(
      `TOKEN_SECRET doit contenir au moins ${TOKEN_SECRET_MIN_LENGTH} caractères.`,
    );
  }
  const body = base64url(encoder.encode(JSON.stringify(buildPayload(fields))));
  const signature = base64url(await hmacSha256(secret, body));
  return `${body}.${signature}`;
}

/**
 * @param {string} siteUrl URL déjà normalisée
 * @param {string} token
 */
export function planLink(siteUrl, token) {
  return `${siteUrl}/plan/#t=${token}`;
}

/* ------------------------------------------------------------------ */
/* Ligne de commande                                                    */
/* ------------------------------------------------------------------ */

/**
 * @param {string[]} args
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<number>} code de sortie
 */
export async function main(args, env) {
  if (args.includes('-h') || args.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  const positional = args.filter((arg) => arg !== '--');
  if (positional.length < 1 || positional.length > 2) {
    console.error(USAGE);
    return 1;
  }
  const [email = '', ref = ''] = positional;

  try {
    const { secret, siteUrl, warnings } = loadSettings(env);
    for (const warning of warnings) console.error(`Attention : ${warning}`);
    const token = await createToken({ email, ref, secret });
    console.log(`E-mail     : ${email.trim()}`);
    console.log(`Référence  : ${ref || '(aucune)'}`);
    console.log('Valable jusqu\'au 30/06/2027 inclus.');
    console.log('');
    console.log('Jeton :');
    console.log(token);
    console.log('');
    console.log('Lien personnel à envoyer :');
    console.log(planLink(siteUrl, token));
    return 0;
  } catch (error) {
    if (error instanceof TokenScriptError) {
      console.error(`Erreur : ${error.message}`);
      return 1;
    }
    throw error;
  }
}

function isMainModule() {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(SCRIPT_PATH);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
