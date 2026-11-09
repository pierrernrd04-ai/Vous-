/* Douze Marches — fonctionnement hors ligne. Ne touche qu’aux caches « douze-marches-… » (les autres applis du site gardent les leurs). */
const VERSION = "douze-marches-202611091355";
const CORE = ["./", "index.html", "manifest.webmanifest", "fonts/fonts.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("douze-marches-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const scope = new URL("./", self.location).pathname;
  // seule l’application elle-même est mise en cache pour le hors-ligne (pas la page de vente ni la page légale)
  if (req.mode === "navigate" && !(url.pathname === scope || url.pathname === scope + "index.html")) return;
  if (req.mode === "navigate") {
    // réseau d’abord (mises à jour immédiates), cache si hors ligne
    e.respondWith(
      fetch(req.url, { cache: "no-store", credentials: "same-origin" })
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("index.html", copy)); } return res; })
        .catch(() => caches.match("index.html", { ignoreSearch: true }))
    );
    return;
  }
  const mine = url.origin === location.origin && url.pathname.startsWith(scope);
  if (mine || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
