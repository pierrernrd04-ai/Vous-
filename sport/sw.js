const C="doitsport-v4";
const CORE=["index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("doitsport-")&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const u=new URL(e.request.url);
  if(u.origin===location.origin){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))));
  }else if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;})));
  }
});
self.addEventListener("push",e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(x){d={body:e.data?e.data.text():""};}
  e.waitUntil(self.registration.showNotification(d.title||"Cycle terminé",{body:d.body||"Reviens dans Do It Sport pour enchaîner.",tag:"doitsport-cycle",renotify:true,requireInteraction:true,icon:"icon-192.png",badge:"icon-192.png",vibrate:[500,200,500,200,900],data:{url:"index.html"}}));
});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if("focus" in c) return c.focus();}return self.clients.openWindow("index.html");}));});
