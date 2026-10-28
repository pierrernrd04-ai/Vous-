// Service worker : l'appli s'ouvre même sans réseau. La sauvegarde (/api) n'est jamais mise en cache.
const CACHE = 'rp-40a0bb6044';
const SHELL = ['./index.html'];
const EXTRA = ['./manifest.json', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).then(() => Promise.all(EXTRA.map((u) => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('rp-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;
  // les autres applis du même site (miroir/, foxbank/…) ont leur propre cache : seul icons/ est un dossier du tracker
  const rel = url.pathname.slice(new URL('./', self.location).pathname.length);
  if (url.origin === location.origin && rel.includes('/') && !rel.startsWith('icons/')) return;
  if (req.mode === 'navigate') {
    // réseau d'abord (mises à jour immédiates), cache si hors ligne
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })),
    );
    return;
  }
  if (url.origin === location.origin || url.hostname === 'raw.githubusercontent.com' || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
