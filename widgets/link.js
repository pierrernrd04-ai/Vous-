/* Liaison chiffrée entre le tracker (iPhone, PC) et les widgets du bureau Windows (Lively Wallpaper).
   Relais : ntfy.sh, gratuit et sans compte. Tout est chiffré ici avant l'envoi (AES-GCM 256 bits, clé tirée
   du code de liaison) : le relais ne voit que du texte illisible. Il garde les messages 12 h.
   Partagé par apps/tracker (intégré à la page par build.mjs) et apps/widgets (chargé tel quel). */
(function () {
  'use strict';
  var RELAY = window.RP_RELAY || 'https://ntfy.sh/'; // RP_RELAY : relais de test
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

  /* opts : since (secondes, reprise après le dernier message reçu), onData(obj, meta), onStatus('live'|'retry'|'off'), onBad() */
  function connect(code, opts) {
    opts = opts || {};
    var K = null, es = null, closed = false, retry = 0, timer = null, beat = 0, q = Promise.resolve();
    var last = opts.since || 0, seen = new Set(), parts = new Map();
    var status = function (s) { if (opts.onStatus) try { opts.onStatus(s); } catch (e) {} };
    var ready = derive(code).then(function (k) { K = k; sub(); return k; });

    async function handle(m) {
      if (!m || m.event !== 'message' || !m.id || seen.has(m.id)) return;
      seen.add(m.id);
      if (m.time > last) last = m.time;
      var r = /^v1:([0-9A-Z]{6,16}):(\d+)\/(\d+):([\w-]+)$/.exec(m.message || '');
      if (!r) return;
      var mid = r[1], i = +r[2], n = +r[3];
      if (!(n > 0 && n <= 400 && i < n)) return;
      var p = parts.get(mid);
      if (!p) { p = { n: n, got: new Array(n), c: 0 }; parts.set(mid, p); }
      if (p.got[i] == null) { p.got[i] = r[4]; p.c++; }
      if (p.c < p.n) return;
      parts.delete(mid);
      var obj;
      try { obj = await unseal(K.key, unb64(p.got.join(''))); } catch (e) { if (opts.onBad) opts.onBad(e); return; }
      try { opts.onData(obj, { time: m.time, id: m.id }); } catch (e) { console.error(e); }
    }
    function sub() {
      if (closed || !K) return;
      // la reprise repart une seconde avant le dernier message vu (les doublons sont écartés)
      es = new EventSource(RELAY + K.topic + '/sse?since=' + (last ? last - 1 : 'all'));
      beat = Date.now();
      es.onopen = function () { retry = 0; beat = Date.now(); status('live'); };
      es.addEventListener('open', function () { beat = Date.now(); });
      es.addEventListener('keepalive', function () { beat = Date.now(); });
      es.onmessage = function (ev) {
        beat = Date.now();
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        q = q.then(function () { return handle(m); });
      };
      es.onerror = function () {
        if (es) es.close(); es = null;
        status('retry');
        clearTimeout(timer); timer = setTimeout(sub, Math.min(30000, 1000 * Math.pow(2, retry++)));
      };
    }
    function kick() { if (closed || !K) return; if (es) es.close(); es = null; clearTimeout(timer); retry = 0; sub(); }
    // le relais envoie un signe de vie toutes les 45 s : sans nouvelles depuis 2 min, on se reconnecte
    var watch = setInterval(function () { if (es && Date.now() - beat > 120000) kick(); }, 30000);
    var onVis = function () { if (document.visibilityState === 'visible') kick(); };
    document.addEventListener('visibilitychange', onVis);
    addEventListener('online', kick);

    async function send(obj, bg) {
      await ready;
      var b = b64(await seal(K.key, obj)), n = Math.max(1, Math.ceil(b.length / PART)), mid = rid(10);
      for (var i = 0; i < n; i++) {
        var body = 'v1:' + mid + ':' + i + '/' + n + ':' + b.slice(i * PART, (i + 1) * PART);
        var r = await fetch(RELAY + K.topic, { method: 'POST', body: body, keepalive: !!bg && n === 1, cache: 'no-store' });
        if (!r.ok) throw { code: r.status === 429 ? 'rate' : 'relay', status: r.status };
      }
      return n;
    }
    function close() {
      closed = true; clearInterval(watch); clearTimeout(timer);
      if (es) es.close(); es = null;
      document.removeEventListener('visibilitychange', onVis); removeEventListener('online', kick);
      status('off');
    }
    return { ready: ready, send: send, close: close, kick: kick, last: function () { return last; } };
  }

  window.RPLink = { parse: parse, newCode: newCode, connect: connect, derive: derive, seal: seal, unseal: unseal, rid: rid };
})();
