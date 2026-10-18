/* Version web autonome : remplace les fonctions de Claude (window.claude.use) :
   'sample' → API Claude avec la clé de l'utilisateur (ai.js), 'db' et 'user' → sauvegarde en ligne /api/state.
   Injecté dans <head> par build.mjs, avant le script de l'appli. */
(function () {
  'use strict';
  window.RP_STANDALONE = true;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

  /* analyse photo et tri : clé Claude de l'utilisateur, gardée dans ce téléphone ;
     le SDK (ai.js) n'est chargé qu'au premier usage */
  var AI_KEY = 'rp-ai-key', aiImpl = null;
  function aiKey() { try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; } }
  function aiLoad() {
    return aiImpl || (aiImpl = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = window.RP_AI_SRC || 'ai.js';
      s.onload = function () { if (window.RP_AI_IMPL) ok(window.RP_AI_IMPL); else ko(); };
      s.onerror = function () { s.remove(); ko(); };
      document.head.appendChild(s);
    }).catch(function () { aiImpl = null; throw { code: 'offline' }; }));
  }
  window.RP_AI = {
    hasKey: function () { return !!aiKey(); },
    keyHint: function () { var k = aiKey(); return k ? k.slice(0, 7) + '…' + k.slice(-4) : ''; },
    setKey: function (k) { try { localStorage.setItem(AI_KEY, k); } catch (e) {} },
    clearKey: function () { try { localStorage.removeItem(AI_KEY); } catch (e) {} },
    check: function (k) {
      return aiLoad().then(function (m) { return m.check(k); }, function (e) { return { ok: false, code: e.code }; });
    },
    sample: {
      limits: function () {
        return Promise.resolve({ images: { maxCount: 4, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxInputBytes: 1500000 } });
      },
      json: function (prompt, opts) {
        var k = aiKey();
        if (!k) return Promise.reject({ code: 'ai_key' });
        return aiLoad().then(function (m) { return m.json(prompt, opts || {}, k); });
      },
    },
  };

  var caps = {};
  window.claude = {
    use: function (name) {
      if (name === 'sample') return Promise.resolve(window.RP_AI.sample);
      if (caps[name]) return Promise.resolve(caps[name]);
      return Promise.reject({ code: 'capability_disabled' });
    },
  };

  /* mode local : tout reste dans le téléphone, pas de serveur */
  if (window.RP_MODE !== 'cloud') { try { localStorage.setItem('rp-key-skip', '1'); } catch (e) {} return; }

  /* ---- clé de sauvegarde : lue dans l'adresse (?k=…) ou mémorisée sur l'appareil ---- */
  var q = new URLSearchParams(location.search), key = q.get('k') || '';
  try { if (key) localStorage.setItem('rp-key', key); else key = localStorage.getItem('rp-key') || ''; } catch (e) {}
  if (!key || key.length < 8) return;
  if (!q.get('k')) { // garde la clé dans l'adresse : l'icône de l'écran d'accueil l'emporte avec elle
    q.set('k', key);
    try { history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash); } catch (e) {}
  }

  var API = 'api/state', OUT = 'rp-outbox';
  var outbox = {}, seen = {}, subs = [], since = 0, first = true, polling = false, failing = false, timer = 0;
  try { outbox = JSON.parse(localStorage.getItem(OUT) || '{}') || {}; } catch (e) { outbox = {}; }
  function saveOut() { try { localStorage.setItem(OUT, JSON.stringify(outbox)); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function req(method, body, qs) {
    return fetch(API + (qs || ''), {
      method: method,
      headers: { 'x-key': key, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    }).then(function (r) {
      if (r.status === 401) throw { code: 'permission_denied' };
      if (r.status === 413) throw { code: 'quota_exceeded' };
      if (!r.ok) throw { code: 'unavailable' };
      return r.json();
    }, function () { throw { code: 'unavailable' }; });
  }

  /* envoie la dernière version d'un document en attente */
  function push(path) {
    var item = outbox[path];
    if (!item) return Promise.resolve();
    return req('PUT', { path: path, body: item.b }).then(function (j) {
      seen[path] = Math.max(seen[path] || 0, j.updated || 0);
      if (outbox[path] && outbox[path].t === item.t) { delete outbox[path]; saveOut(); }
    });
  }
  async function pushRetry(path) {
    var waits = [0, 1200, 3500], last;
    for (var i = 0; i < waits.length; i++) {
      if (waits[i]) await sleep(waits[i]);
      try { await push(path); return; } catch (e) { last = e; if (e.code !== 'unavailable') break; }
    }
    throw last || { code: 'unavailable' };
  }
  async function drain() {
    var paths = Object.keys(outbox), had = paths.length;
    for (var i = 0; i < paths.length; i++) await push(paths[i]);
    return had > 0;
  }

  function parentOf(path) { var i = path.lastIndexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; }

  async function poll() {
    if (polling) return;
    polling = true; clearTimeout(timer);
    var drained = false;
    try {
      drained = await drain();
      var j = await req('GET', null, '?since=' + Math.max(0, since));
      var docs = j.docs || [];
      since = j.now - 5000;
      var recovered = failing; failing = false;
      subs.forEach(function (s) {
        var changes = [];
        docs.forEach(function (d) {
          var pc = parentOf(d.path);
          if (pc[0] !== s.path || outbox[d.path]) return;
          if ((seen[d.path] || 0) >= d.updated) return;
          seen[d.path] = d.updated;
          changes.push({ type: d.deleted ? 'removed' : (first ? 'added' : 'modified'),
            doc: { id: pc[1], data: function () { return d.body; } } });
        });
        try { s.cb({ docChanges: function () { return changes; }, drained: drained || recovered }); } catch (e) { console.error(e); }
      });
      first = false;
    } catch (e) {
      failing = true;
      if (e && e.code === 'permission_denied') subs.forEach(function (s) { s.err && s.err(e); });
    } finally {
      polling = false; schedule();
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(poll, document.visibilityState === 'visible' ? (failing ? 8000 : 4000) : 30000); }
  ['focus', 'online', 'pageshow'].forEach(function (ev) { window.addEventListener(ev, function () { poll(); }); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') poll(); });

  function docRef(path) {
    return {
      set: function (body) {
        outbox[path] = { b: JSON.parse(JSON.stringify(body)), t: Date.now() + Math.random() };
        saveOut();
        return pushRetry(path);
      },
      get: function () {
        return req('GET', null, '?path=' + encodeURIComponent(path)).then(function (j) {
          return { exists: !!j.doc, data: function () { return j.doc && j.doc.body; } };
        });
      },
      delete: function () { delete outbox[path]; saveOut(); return req('DELETE', null, '?path=' + encodeURIComponent(path)); },
      collection: function (name) { return colRef(path + '/' + name); },
    };
  }
  function colRef(path) {
    return {
      doc: function (id) { return docRef(path + '/' + id); },
      onSnapshot: function (cb, err) { subs.push({ path: path, cb: cb, err: err }); setTimeout(poll, 0); return function () {}; },
    };
  }
  caps.db = { doc: docRef, collection: colRef };
  caps.user = { id: function () { return Promise.resolve('me'); } };
})();
