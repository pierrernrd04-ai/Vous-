// Do It et Encré : fonctionnent hors-ligne (coquilles en cache, l'API jamais).
const VERSION = 'do-it-v5';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/ai.js',
  './js/export.js',
  './js/format.js',
  './js/icons.js',
  './js/local-ai.js',
  './js/quotes.js',
  './js/speech.js',
  './js/store.js',
  './js/themes.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './encre/',
  './encre/index.html',
  './encre/css/encre.css',
  './encre/js/main.js',
  './encre/js/db.js',
  './encre/js/editor.js',
  './encre/js/markdown.js',
  './encre/js/memory.js',
  './encre/js/tree.js',
  './encre/js/voice.js',
  './encre/manifest.webmanifest',
  './encre/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // D'autres applis peuvent partager le site (GitHub Pages) : on ne supprime que nos anciens caches.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('do-it-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Polices Google : cache d'abord.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
        return res;
      })),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  // Seuls les fichiers de Do It et d'Encré (dossier du service worker) sont gérés ici.
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;

  // Pages et fichiers de l'appli : réseau d'abord (mises à jour immédiates), cache hors-ligne.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match(new URL('./index.html', self.location).href) : Response.error()))),
  );
});
