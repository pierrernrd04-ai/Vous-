// Service worker : coquille hors ligne + notifications.
const CACHE = 'prono-v8';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'api.js', 'model.js', 'rating.js', 'icon.svg', 'icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // données live : toujours le réseau
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
// Notification push envoyée par le serveur d'alertes (même app fermée).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Prono', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Prono', {
    body: d.body || '',
    tag: d.tag,
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { matchId: d.matchId, url: d.url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = e.notification.data?.matchId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => x.url.startsWith(self.registration.scope));
      if (c) { if (id) c.postMessage({ open: id }); return c.focus(); }
      return self.clients.openWindow(id ? `./?match=${id}` : './');
    })
  );
});
