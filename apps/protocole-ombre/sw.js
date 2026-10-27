// Service worker : le jeu fonctionne hors ligne une fois chargé (sauf le multijoueur).
const CACHE = 'protocole-ombre-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icons/icon.svg', 'icons/icon-192.png',
  'lib/three.module.min.js', 'lib/peerjs.min.js',
  'lib/addons/postprocessing/EffectComposer.js', 'lib/addons/postprocessing/RenderPass.js', 'lib/addons/postprocessing/UnrealBloomPass.js',
  'lib/addons/postprocessing/OutputPass.js', 'lib/addons/postprocessing/ShaderPass.js', 'lib/addons/postprocessing/MaskPass.js', 'lib/addons/postprocessing/Pass.js',
  'lib/addons/shaders/CopyShader.js', 'lib/addons/shaders/LuminosityHighPassShader.js', 'lib/addons/shaders/OutputShader.js',
  'lib/addons/utils/BufferGeometryUtils.js',
  'js/main.js', 'js/game.js', 'js/world.js', 'js/maps.js', 'js/physics.js', 'js/nav.js', 'js/bots.js', 'js/combat.js', 'js/weapons.js',
  'js/models.js', 'js/viewmodel.js', 'js/effects.js', 'js/textures.js', 'js/hud.js', 'js/input.js', 'js/net.js', 'js/audio.js', 'js/util.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (mises à jour immédiates), cache en secours hors ligne.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const fonts = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  if (!sameOrigin && !fonts) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))),
  );
});
