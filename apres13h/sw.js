// Après 13h : l'appli s'ouvre même sans réseau.
const CACHE="a13-c1f85ddecf";
const FILES=["./","./index.html","./manifest.webmanifest","./icons/icon.svg","./icons/icon-192.png","./icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith("a13-")&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;
  if(r.mode==="navigate"){e.respondWith(fetch(r,{cache:"no-store"}).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",cp));return res}).catch(()=>caches.match("./index.html")));return}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&(new URL(r.url).origin===location.origin||r.url.includes("fonts.g"))){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})))});
