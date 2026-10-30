// Widgets Dan't : la page s'ouvre même si le PC démarre sans réseau (les rappels affichés sont gardés sur le PC).
const CACHE = 'dant-w-1';
const APP = new URL('../', self.location).pathname;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', '../link.js', '../saints.js', '../icons/icon.svg']).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('dant-w-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const own = url.origin === location.origin && url.pathname.startsWith(APP);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !font) return; // relais et météo : toujours en direct
  if (font) { e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; }))); return; }
  // réseau d'abord (mises à jour immédiates), sinon la copie gardée
  e.respondWith(fetch(req, { cache: 'no-store' }).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req.mode === 'navigate' ? './' : req, c)); }
    return r;
  }).catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true })));
});
