/* Liaison chiffrée entre le tracker (iPhone, PC) et les widgets du bureau Windows (Lively Wallpaper).
   Relais : trois serveurs ntfy publics, gratuits et sans compte, utilisés en même temps (si l'un sature ou tombe,
   les autres suffisent). Tout est chiffré ici avant l'envoi (AES-GCM 256 bits, clé tirée du code de liaison) :
   les relais ne voient que du texte illisible. Ils gardent les messages 12 h.
   Partagé par apps/tracker (intégré à la page par build.mjs) et apps/widgets (chargé tel quel). */
(function () {
  'use strict';
  // ntfy.envs.net et ntfy.adminforge.de : 17 280 messages par jour ; ntfy.sh : 250 seulement (en plus, au cas où)
  var RELAYS = window.RP_RELAYS || ['https://ntfy.envs.net/', 'https://ntfy.adminforge.de/', 'https://ntfy.sh/'];
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // sans I, L, O, U : pas de confusion à la saisie
  var PART = 3600; // caractères par message (le relais refuse au-delà de 4 096 octets)
  var te = new TextEncoder(), td = new TextDecoder();

  function clean(s) { return String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, ''); }
  function fmt(c) { return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12); }
  function parse(s) { var c = clean(s); return c.length === 12 && c.split('').every(function (ch) { return ALPHA.indexOf(ch) >= 0; }) ? fmt(c) : null; }
  function newCode() { var b = crypto.getRandomValues(new Uint8Array(12)), c = ''; for (var i = 0; i < 12; i++) c += ALPHA[b[i] & 31]; return fmt(c); }
  function rid(n) { var b = crypto.getRandomValues(new Uint8Array(n)), s = ''; for (var i = 0; i < n; i++) s += ALPHA[b[i] & 31]; return s; }

  function b64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64(s) {
    var bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function squeeze(u8, back) {
    var S = back ? DecompressionStream : CompressionStream;
    return new Response(new Blob([u8]).stream().pipeThrough(new S('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /* une seule clé de 384 bits : 256 pour le chiffrement, le reste nomme le canal sur le relais */
  function derive(code) {
    return crypto.subtle.importKey('raw', te.encode(clean(code)), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode('vous-widgets-v1'), iterations: 120000 }, base, 384);
    }).then(function (buf) {
      var bits = new Uint8Array(buf), hex = '';
      for (var i = 32; i < 44; i++) hex += (bits[i] < 16 ? '0' : '') + bits[i].toString(16);
      return crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']).then(function (key) {
        return { key: key, topic: 'vous-' + hex };
      });
    });
  }

  async function seal(key, obj) {
    var data = te.encode(JSON.stringify(obj)), z = 0;
    if (typeof CompressionStream === 'function') { try { data = await squeeze(data); z = 1; } catch (e) {} }
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data));
    var out = new Uint8Array(14 + ct.length);
    out[0] = 1; out[1] = z; out.set(iv, 2); out.set(ct, 14);
    return out;
  }
  async function unseal(key, u8) {
    if (u8[0] !== 1) throw new Error('version');
    var data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(2, 14) }, key, u8.slice(14)));
    if (u8[1] === 1) data = await squeeze(data, true);
    return JSON.parse(td.decode(data));
  }

  function host(u) { return u.replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  function post(url, body, bg) {
    // délai maximal : un envoi coupé (appli mise en veille) ne bloque jamais les suivants
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ac && setTimeout(function () { ac.abort(); }, 15000);
    return fetch(url, { method: 'POST', body: body, keepalive: !!bg && body.length < 60000, signal: ac ? ac.signal : undefined })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw { code: r.status === 429 ? 'rate' : 'relay', status: r.status }; return r; },
        function (e) { clearTimeout(t); throw e && e.code ? e : { code: 'offline' }; });
  }

  /* opts : since (secondes, reprise après le dernier message reçu), onData(obj, meta), onStatus('live'|'retry'|'off'), onBad() */
  function connect(code, opts) {
    opts = opts || {};
    var K = null, closed = false, q = Promise.resolve();
    var since0 = opts.since || 0, parts = new Map(), done = new Set();
    var R = RELAYS.map(function (u) { return { url: u, host: host(u), es: null, last: since0, beat: 0, retry: 0, timer: null, open: false, err: '', seen: new Set() }; });
    var status = function () {
      if (!opts.onStatus) return;
      var s = closed ? 'off' : R.some(function (r) { return r.open; }) ? 'live' : 'retry';
      try { opts.onStatus(s); } catch (e) {}
    };
    var ready = derive(code).then(function (k) { K = k; R.forEach(sub); poll(); return k; });

    async function handle(r, m) {
      if (!m || m.event !== 'message' || !m.id || r.seen.has(m.id)) return;
      r.seen.add(m.id);
      if (m.time > r.last) r.last = m.time;
      var x = /^v1:([0-9A-Z]{6,16}):(\d+)\/(\d+):([\w-]+)$/.exec(m.message || '');
      if (!x) return;
      var mid = x[1], i = +x[2], n = +x[3];
      if (done.has(mid) || !(n > 0 && n <= 400 && i < n)) return; // déjà reçu par un autre relais
      var p = parts.get(mid);
      if (!p) { p = { n: n, got: new Array(n), c: 0 }; parts.set(mid, p); }
      if (p.got[i] == null) { p.got[i] = x[4]; p.c++; }
      if (p.c < p.n) return;
      parts.delete(mid); done.add(mid);
      if (done.size > 3000) done = new Set(Array.from(done).slice(-1500));
      var obj;
      try { obj = await unseal(K.key, unb64(p.got.join(''))); } catch (e) { if (opts.onBad) opts.onBad(e); return; }
      try { opts.onData(obj, { time: m.time, id: mid, relay: r.host }); } catch (e) { console.error(e); }
    }
    function feed(r, m) { q = q.then(function () { return handle(r, m); }); }
    function sub(r) {
      if (closed || !K) return;
      // la reprise repart une seconde avant le dernier message vu (les doublons sont écartés)
      var es = r.es = new EventSource(r.url + K.topic + '/sse?since=' + (r.last ? r.last - 1 : 'all'));
      r.beat = Date.now();
      es.onopen = function () { r.retry = 0; r.beat = Date.now(); r.open = true; r.err = ''; status(); };
      es.addEventListener('open', function () { r.beat = Date.now(); });
      es.addEventListener('keepalive', function () { r.beat = Date.now(); });
      es.onmessage = function (ev) {
        r.beat = Date.now();
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        feed(r, m);
      };
      es.onerror = function () {
        es.close(); if (r.es === es) r.es = null;
        r.open = false; r.err = 'injoignable'; status();
        clearTimeout(r.timer); r.timer = setTimeout(function () { sub(r); }, Math.min(30000, 1000 * Math.pow(2, r.retry++)));
      };
    }
    function kick() {
      if (closed || !K) return;
      R.forEach(function (r) { if (r.es) r.es.close(); r.es = null; r.open = false; clearTimeout(r.timer); r.retry = 0; sub(r); });
      poll();
    }
    // filet de sécurité : une relecture directe des derniers messages, au cas où une connexion serait morte sans le dire
    function poll() {
      if (closed || !K) return;
      R.forEach(function (r) {
        fetch(r.url + K.topic + '/json?poll=1&since=' + (r.last ? r.last - 1 : 'all'), { cache: 'no-store' })
          .then(function (res) { return res.ok ? res.text() : ''; })
          .then(function (t) { t.split('\n').forEach(function (l) { if (l) { try { feed(r, JSON.parse(l)); } catch (e) {} } }); })
          .catch(function () {});
      });
    }
    // le relais envoie un signe de vie toutes les 45 s : sans nouvelles depuis 2 min, on se reconnecte.
    // Un trou dans l'horloge (fond d'écran suspendu par Lively, téléphone en veille) relance tout de suite.
    var tick = Date.now();
    var watch = setInterval(function () {
      var now = Date.now(), slept = now - tick > 20000; tick = now;
      if (slept) return kick();
      R.forEach(function (r) { if (r.es && now - r.beat > 120000) { r.es.close(); r.es = null; r.open = false; sub(r); } });
    }, 5000);
    var pollT = setInterval(poll, 60000);
    var onVis = function () { if (document.visibilityState === 'visible') kick(); };
    document.addEventListener('visibilitychange', onVis);
    addEventListener('online', kick);

    /* envoi sur tous les relais à la fois : réussi dès qu'un relais a tout reçu */
    async function send(obj, bg) {
      await ready;
      var b = b64(await seal(K.key, obj)), n = Math.max(1, Math.ceil(b.length / PART)), mid = rid(10);
      var bodies = []; for (var i = 0; i < n; i++) bodies.push('v1:' + mid + ':' + i + '/' + n + ':' + b.slice(i * PART, (i + 1) * PART));
      var res = await Promise.all(R.map(function (r) {
        var chain = Promise.resolve();
        bodies.forEach(function (body) { chain = chain.then(function () { return post(r.url + K.topic, body, bg); }); });
        return chain.then(function () { r.sendErr = ''; return true; }, function (e) { r.sendErr = (e && e.code) || 'relay'; return false; });
      }));
      var ok = res.filter(Boolean).length;
      if (!ok) throw { code: R.every(function (r) { return r.sendErr === 'rate'; }) ? 'rate' : R.every(function (r) { return r.sendErr === 'offline'; }) ? 'offline' : 'relay' };
      return { n: n, ok: ok, of: R.length };
    }
    function close() {
      closed = true; clearInterval(watch); clearInterval(pollT);
      R.forEach(function (r) { clearTimeout(r.timer); if (r.es) r.es.close(); r.es = null; r.open = false; });
      document.removeEventListener('visibilitychange', onVis); removeEventListener('online', kick);
      status();
    }
    function diag() { return R.map(function (r) { return { host: r.host, open: r.open, err: r.sendErr || '' }; }); }
    return { ready: ready, send: send, close: close, kick: kick, poll: poll, diag: diag,
      last: function () { return Math.max.apply(null, R.map(function (r) { return r.last || 0; })); } };
  }

  window.RPLink = { parse: parse, newCode: newCode, connect: connect, derive: derive, seal: seal, unseal: unseal, rid: rid, relays: RELAYS.map(host) };
})();
