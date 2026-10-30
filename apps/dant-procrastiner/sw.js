// Service worker de Dan't Procrastiner : hors-ligne + relances toutes les heures.
importScripts('core.js');
const { check, get, set, applyAction } = self.DantCore;

const CACHE = 'dant-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'core.js', 'saints.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/badge.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dant-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // polices : cache d'abord ; météo et géocodage : toujours en ligne
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { c.put(req, res.clone()); return res; })));
    }
    return;
  }
  // réseau d'abord (mises à jour immédiates), cache si hors ligne
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});

// ---------- Relances ----------
async function show(r, count, msg) {
  await self.registration.showNotification(msg.title, {
    body: msg.body,
    tag: `dant-${r.id}`,
    renotify: true,
    requireInteraction: count > 1,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge.png',
    vibrate: count > 2 ? [200, 100, 200, 100, 400] : [200, 100, 200],
    timestamp: Date.now(),
    data: { id: r.id },
    actions: [
      { action: 'done', title: '✅ C’est fait' },
      { action: 'snooze', title: '⏳ Dans 1 h' },
    ],
  });
}

async function runCheck() {
  const due = await check(show);
  if (due.length) broadcast({ type: 'nagged', ids: due.map((d) => d.r.id) });
  updateBadge();
}

async function updateBadge() {
  if (!self.navigator.setAppBadge) return;
  const state = await get('state');
  const now = Date.now();
  const late = state ? state.reminders.filter((r) => !r.done && self.DantCore.baseOf(r) <= now).length : 0;
  try { late ? await self.navigator.setAppBadge(late) : await self.navigator.clearAppBadge(); } catch (e) {}
}

async function broadcast(msg) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach((c) => c.postMessage(msg));
  return list.length;
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'tick') e.waitUntil(runCheck());
  if (e.data && e.data.type === 'test') e.waitUntil(show({ id: 'test' }, 1, { title: '🔔 Test réussi !', body: 'Les relances arriveront comme ça.\nDan’t procrastiner !' }));
});

// Chrome Android sur appli installée : réveils périodiques en arrière-plan.
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'dant-check') e.waitUntil(runCheck());
});
// Prêt pour un futur serveur de push : tout message push déclenche une vérification.
self.addEventListener('push', (e) => e.waitUntil(runCheck()));

self.addEventListener('notificationclick', (e) => {
  const id = e.notification.data && e.notification.data.id;
  e.notification.close();
  e.waitUntil((async () => {
    if (id && id !== 'test' && (e.action === 'done' || e.action === 'snooze')) {
      // page ouverte : c'est elle qui applique (elle détient l'état) ; sinon on l'écrit directement
      const n = await broadcast({ type: 'action', id, action: e.action });
      if (!n) {
        const state = await get('state');
        if (state && applyAction(state, id, e.action, Date.now())) await set('state', state);
        updateBadge();
      }
      return;
    }
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const url = new URL(`./${id && id !== 'test' ? `?r=${id}` : ''}`, self.registration.scope).href;
    if (list.length) { await list[0].focus(); if (id) list[0].postMessage({ type: 'focus', id }); return; }
    await self.clients.openWindow(url);
  })());
});
