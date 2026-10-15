/*
 * Service worker · Pass J-24 · Traceo (SPEC section 4).
 *
 * - Pré-cache du shell : pages et fichiers émis par Vite (liste injectée au build
 *   par vite.config.ts, plugin « public-placeholders ») + icônes et manifeste.
 * - Version de cache = empreinte du build, injectée de la même façon : chaque
 *   déploiement installe un nouveau shell et supprime l'ancien.
 * - Pages : réseau d'abord, repli sur la copie en cache (hors ligne).
 * - /assets/* (noms avec empreinte, immuables) : cache d'abord.
 * - POST /api/plan : réseau d'abord ; la dernière réponse réussie est gardée et
 *   resservie hors ligne (ou si le serveur est en panne), marquée `X-SW-Cache`.
 * - GET /api/preview : réseau d'abord, repli sur le cache.
 * - /api/unlock : jamais intercepté, jamais mis en cache.
 */
'use strict';

const VERSION = '__BUILD_ID__';
const SHELL_CACHE = `j24-shell-${VERSION}`;
/** Copies des réponses de l'API (plan, aperçu) : indépendant de la version, survit aux mises à jour. */
const API_CACHE = 'j24-api-v1';
const MAX_PLAN_ENTRIES = 8;
const MAX_PREVIEW_ENTRIES = 12;

/** Fichiers de public/ (non émis par Vite) utiles hors ligne. */
const STATIC_FILES = [
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

function precacheUrls() {
  let built = [];
  try {
    const parsed = JSON.parse('__PRECACHE_URLS__');
    if (Array.isArray(parsed)) built = parsed.filter((url) => typeof url === 'string' && url.startsWith('/'));
  } catch {
    // Fichier non traité par le build (développement) : seulement les fichiers statiques.
  }
  return Array.from(new Set([...built, ...STATIC_FILES]));
}

/* ------------------------------------------------------------------ */
/* Outils                                                             */
/* ------------------------------------------------------------------ */

/** Une réponse issue d'une redirection ne peut pas servir une navigation : on la recopie. */
async function clean(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** Marque une réponse servie depuis le cache (lu par src/lib/api.ts). */
async function markCached(response) {
  const headers = new Headers(response.headers);
  headers.set('X-SW-Cache', '1');
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/** Clé de cache d'une page : `/plan/index.html`, `/plan` et `/plan/?x=1` → `/plan/`. */
function pageKey(href) {
  const url = new URL(href);
  let path = url.pathname.replace(/index\.html$/, '');
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  return new URL(path, url.origin).href;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Garde au plus `max` entrées dont l'URL commence par `prefix` (les plus anciennes partent). */
async function trim(cache, prefix, max) {
  const keys = (await cache.keys()).filter((request) => request.url.startsWith(prefix));
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hors ligne · Pass J-24</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#050f15;color:#e6f2f0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}main{max-width:28rem}h1{font-size:1.6rem;margin:0 0 .5rem}p{color:#c3d6d4}a{display:inline-block;margin-top:1rem;padding:.8rem 1.4rem;border-radius:999px;background:#25c98f;color:#03140d;font-weight:700;text-decoration:none}a:focus-visible{outline:3px solid #2be39b;outline-offset:3px}</style></head><body><main><h1>Tu es hors ligne</h1><p>Cette page n’est pas encore disponible sans connexion. Ton plan, lui, reste consultable s’il a déjà été ouvert sur cet appareil.</p><a href="/plan/">Ouvrir mon plan</a></main></body></html>`;

function offlinePage() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                       */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Un fichier en échec ne bloque pas l'installation : il sera mis en cache à la première visite.
      await Promise.all(
        precacheUrls().map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
            if (response.ok) await cache.put(pageKey(new URL(url, self.location.origin).href), await clean(response));
          } catch {
            // Hors ligne pendant l'installation : rien à faire.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('j24-') && !keep.has(name)).map((name) => caches.delete(name)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // Préchargement indisponible : sans conséquence.
        }
      }
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ */
/* Stratégies                                                         */
/* ------------------------------------------------------------------ */

/** Pages : réseau d'abord (contenu à jour), copie en cache hors ligne. */
async function pageNetworkFirst(event) {
  const key = pageKey(event.request.url);
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));
    if (response.ok && response.type === 'basic') {
      const copy = await clean(response.clone());
      event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(key, copy)));
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const hit = (await cache.match(key)) || (await caches.match(key, { ignoreSearch: true }));
    return hit || offlinePage();
  }
}

/** Fichiers avec empreinte : cache d'abord. */
async function cacheFirst(event) {
  const hit = await caches.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy)));
  }
  return response;
}

/** Icônes, manifeste… : la copie en cache tout de suite, mise à jour en arrière-plan. */
async function staleWhileRevalidate(event) {
  const hit = await caches.match(event.request);
  const network = fetch(event.request)
    .then(async (response) => {
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  return (await network) || Response.error();
}

/** POST /api/plan : réseau d'abord, dernière réponse réussie en secours (hors ligne ou panne). */
async function planNetworkFirst(event) {
  const body = await event.request.clone().text();
  let token = '';
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.token === 'string') token = parsed.token;
  } catch {
    // Corps illisible : le serveur répondra 400, rien à mettre en cache.
  }
  const origin = self.location.origin;
  const exactKey = `${origin}/__sw/plan/${await sha256(body)}`;
  const lastKey = `${origin}/__sw/plan-last/${await sha256(token)}`;

  const fromCache = async () => {
    const cache = await caches.open(API_CACHE);
    const hit = (await cache.match(exactKey)) || (token ? await cache.match(lastKey) : undefined);
    return hit ? markCached(hit) : null;
  };

  let response;
  try {
    response = await fetch(event.request);
  } catch {
    return (await fromCache()) || Response.error();
  }
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(
      (async () => {
        const cache = await caches.open(API_CACHE);
        const blob = await copy.blob();
        const init = { status: copy.status, statusText: copy.statusText, headers: copy.headers };
        await cache.put(exactKey, new Response(blob, init));
        if (token) await cache.put(lastKey, new Response(blob, init));
        await trim(cache, `${origin}/__sw/plan/`, MAX_PLAN_ENTRIES);
      })(),
    );
    return response;
  }
  // Panne du serveur : mieux vaut le dernier plan connu. 401, 422… sont rendus tels quels.
  if (response.status >= 500) return (await fromCache()) || response;
  return response;
}

/** GET /api/* (aperçu) : réseau d'abord, repli sur le cache. */
async function apiNetworkFirst(event) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(event.request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(
        cache.put(event.request, copy).then(() => trim(cache, `${self.location.origin}/api/`, MAX_PREVIEW_ENTRIES)),
      );
    }
    return response;
  } catch {
    const hit = await cache.match(event.request);
    return hit ? markCached(hit) : Response.error();
  }
}

/* ------------------------------------------------------------------ */
/* Routage                                                            */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Autres sites (Stripe, PayPal, Traceo) : le navigateur s'en charge.
  if (url.origin !== self.location.origin) return;
  // Déblocage après paiement : toujours le réseau, jamais de cache.
  if (url.pathname.startsWith('/api/unlock')) return;

  if (url.pathname === '/api/plan') {
    if (request.method === 'POST') event.respondWith(planNetworkFirst(event));
    return;
  }
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiNetworkFirst(event));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(event));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
