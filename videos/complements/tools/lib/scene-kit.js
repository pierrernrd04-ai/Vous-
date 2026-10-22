/* Ambrel scene kit: deterministic, seekable HTML scenes for tools/render.mjs.
 *
 * Classic script (no ES module) so a scene also works when opened straight from disk
 * (file://). Exposes window.SK.
 *
 * Contract with render.mjs:
 *   window.__seek(t)   draws the frame at time t (seconds). It must depend ONLY on t:
 *                      no setTimeout/setInterval/requestAnimationFrame/Date/Math.random.
 *                      It may return a Promise.
 *   window.__ready     Promise resolved when fonts/images/etc. are loaded.
 *   window.__duration  default duration in seconds (render.mjs --dur overrides).
 *   window.__RENDER    true when driven by render.mjs / snap.mjs (no preview UI).
 * SK.scene({...}) sets all of this up for you.
 *
 * URL params: ?safe=1 (safe-zone overlay), ?t=3.2 (frozen frame), ?w=&h= (size),
 *             ?dur= (duration). In a normal browser the scene auto-plays with a
 *             transport bar (space = play/pause, arrows = +/- 1 frame).
 */
(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  function num(k, d) { return qs.has(k) && qs.get(k) !== '' ? +qs.get(k) : d; }
  var RENDER = !!window.__RENDER || qs.get('render') === '1';
  var params = {
    w: num('w', null), h: num('h', null), fps: num('fps', 30), dur: num('dur', null),
    t: qs.has('t') ? +qs.get('t') : null, safe: qs.get('safe') === '1', render: RENDER, qs: qs,
  };

  // ------------------------------------------------------------------ math
  var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, p) { return a + (b - a) * p; };
  /** normalized progress of t inside [a, b] (0 before, 1 after) */
  var prog = function (t, a, b) { return b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)); };
  var ease = {
    linear: function (x) { return x; },
    inQuad: function (x) { return x * x; },
    outQuad: function (x) { return 1 - (1 - x) * (1 - x); },
    inOutQuad: function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
    inCubic: function (x) { return x * x * x; },
    outCubic: function (x) { return 1 - Math.pow(1 - x, 3); },
    inOutCubic: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    outQuart: function (x) { return 1 - Math.pow(1 - x, 4); },
    inOutQuart: function (x) { return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; },
    outQuint: function (x) { return 1 - Math.pow(1 - x, 5); },
    outExpo: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    inOutExpo: function (x) { return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; },
    inOutSine: function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; },
    outSine: function (x) { return Math.sin((x * Math.PI) / 2); },
    outBack: function (x, s) { s = s === undefined ? 1.70158 : s; var c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  };
  /** eased progress in [a,b] */
  var seg = function (t, a, b, e) { return (e || ease.inOutCubic)(prog(t, a, b)); };
  /** damped spring 0 -> 1 starting at t0 (overshoots a little) */
  var spring = function (t, t0, freq, damping) {
    freq = freq || 2.2; damping = damping === undefined ? 0.42 : damping;
    var x = Math.max(0, t - t0);
    return 1 - Math.exp(-damping * 10 * x) * Math.cos(freq * 2 * Math.PI * x);
  };
  /** keyframes: kf(t, [[t0, v0], [t1, v1], ...], ease) -> interpolated value */
  var kf = function (t, frames, e) {
    e = e || ease.inOutCubic;
    if (t <= frames[0][0]) return frames[0][1];
    for (var i = 1; i < frames.length; i++) {
      if (t <= frames[i][0]) {
        var a = frames[i - 1], b = frames[i];
        var p = e(prog(t, a[0], b[0]));
        if (Array.isArray(a[1])) return a[1].map(function (v, j) { return lerp(v, b[1][j], p); });
        return lerp(a[1], b[1], p);
      }
    }
    return frames[frames.length - 1][1];
  };
  /** visibility window with fades: 0 before a, ramps to 1, back to 0 at b */
  var win = function (t, a, b, fin, fout) {
    fin = fin === undefined ? 0.25 : fin; fout = fout === undefined ? fin : fout;
    if (t < a || t > b) return 0;
    return Math.min(fin > 0 ? prog(t, a, a + fin) : 1, fout > 0 ? 1 - prog(t, b - fout, b) : 1);
  };
  /** deterministic PRNG (mulberry32). rng(seed)() -> [0,1) */
  var rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function hash(i, seed) { var r = rng((i * 374761393 + (seed || 0) * 668265263) >>> 0); return r(); }
  /** smooth 1-D value noise in [-1, 1] */
  var noise1 = function (x, seed) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
  };
  /** handheld camera: {x, y, r} offsets in px/deg, deterministic */
  var handheld = function (t, amp, speed, seed) {
    amp = amp === undefined ? 6 : amp; speed = speed || 0.8; seed = seed || 1;
    return {
      x: amp * (noise1(t * speed, seed) * 0.7 + noise1(t * speed * 2.7, seed + 7) * 0.3),
      y: amp * (noise1(t * speed, seed + 13) * 0.7 + noise1(t * speed * 3.1, seed + 21) * 0.3),
      r: amp * 0.06 * noise1(t * speed * 0.6, seed + 31),
    };
  };
  /** apply transform/opacity: SK.set(el, {x, y, s, sx, sy, r, o, blur}) */
  var set = function (el, o) {
    if (!el) return;
    var tr = '';
    if (o.x || o.y) tr += 'translate(' + (o.x || 0).toFixed(2) + 'px,' + (o.y || 0).toFixed(2) + 'px) ';
    if (o.r) tr += 'rotate(' + o.r.toFixed(3) + 'deg) ';
    if (o.s !== undefined) tr += 'scale(' + o.s.toFixed(4) + ') ';
    if (o.sx !== undefined || o.sy !== undefined) tr += 'scale(' + (o.sx === undefined ? 1 : o.sx).toFixed(4) + ',' + (o.sy === undefined ? 1 : o.sy).toFixed(4) + ') ';
    el.style.transform = tr || 'none';
    if (o.o !== undefined) el.style.opacity = clamp(o.o).toFixed(3);
    if (o.blur !== undefined) el.style.filter = o.blur > 0.01 ? 'blur(' + o.blur.toFixed(2) + 'px)' : 'none';
  };
  /** first n characters for a typewriter effect */
  var typewriter = function (text, p) { var n = Math.round(clamp(p) * text.length); return text.slice(0, n); };
  /** pause every CSS animation/transition and put it at time t (lets you use @keyframes) */
  var syncCSS = function (t) {
    document.getAnimations().forEach(function (a) { a.pause(); a.currentTime = t * 1000; });
  };

  // ------------------------------------------------------------------ loading
  var BRAND_FONTS = [
    '500 40px Fraunces', '600 40px Fraunces', 'italic 400 40px Fraunces',
    '400 40px Manrope', '600 40px Manrope', '700 40px Manrope', '800 40px Manrope',
  ];
  function loadFonts(list) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(list.map(function (f) { return document.fonts.load(f, 'AaÉéèàçœ’%·0123456789').catch(function () {}); }));
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { res(im); }, function () { res(im); }); };
      im.onerror = function () { rej(new Error('image failed: ' + src)); };
      im.src = src;
    });
  }
  /** preload images: SK.loadImages({jar: '../brand/png/x.png'}) -> {jar: HTMLImageElement} */
  function loadImages(map) {
    var keys = Object.keys(map), out = {};
    return Promise.all(keys.map(function (k) { return loadImage(map[k]).then(function (im) { out[k] = im; }); })).then(function () { return out; });
  }
  function decodeAll(root) {
    var imgs = Array.prototype.slice.call((root || document).querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) {
      if (im.complete && im.naturalWidth) return im.decode ? im.decode().catch(function () {}) : null;
      return new Promise(function (r) { im.addEventListener('load', r, { once: true }); im.addEventListener('error', function () { console.error('image failed: ' + im.src); r(); }, { once: true }); });
    }));
  }

  // ------------------------------------------------------------------ safe zones
  var SAFE = {
    '9:16': { w: 1080, h: 1920, top: 288, critical: 1248, hard: 1536, captionsMax: 1440, left: 80, right: 950 },
    '16:9': { w: 1920, h: 1080, mx: 96, my: 54, band: [656, 1264] },
    '4:5': { w: 1080, h: 1350, m: 86 },
  };
  function safeZones(stage, preset) {
    var z = SAFE[preset];
    var o = document.createElement('div');
    o.className = 'sk-safe';
    o.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:99999;font:600 22px/1.2 Manrope,system-ui,sans-serif;color:#fff;';
    function box(css, label, bg) {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;box-sizing:border-box;' + css + (bg ? ';background:' + bg : '');
      if (label) { d.textContent = label; d.style.padding = '6px 10px'; d.style.textShadow = '0 1px 2px #000'; }
      o.appendChild(d);
    }
    if (preset === '9:16') {
      box('left:0;top:0;width:100%;height:' + z.top + 'px', 'UI plateforme (y < ' + z.top + ')', 'rgba(255,0,60,.28)');
      box('left:0;top:' + z.critical + 'px;width:100%;height:' + (z.hard - z.critical) + 'px', 'Zone à risque : pas de message critique (y > ' + z.critical + ')', 'rgba(255,170,0,.22)');
      box('left:0;top:' + z.hard + 'px;width:100%;height:' + (z.h - z.hard) + 'px', 'Interdit (y > ' + z.hard + ') · légende/CTA plateforme', 'rgba(255,0,60,.33)');
      box('left:' + z.right + 'px;top:' + z.top + 'px;width:' + (z.w - z.right) + 'px;height:' + (z.hard - z.top) + 'px', '', 'rgba(255,0,60,.2)');
      box('left:0;top:' + z.top + 'px;width:' + z.left + 'px;height:' + (z.hard - z.top) + 'px', '', 'rgba(255,0,60,.2)');
      box('left:' + z.left + 'px;top:' + z.top + 'px;width:' + (z.right - z.left) + 'px;height:' + (z.critical - z.top) + 'px;border:3px solid #2dff8a', 'Zone verte', '');
      box('left:0;top:' + z.captionsMax + 'px;width:100%;height:0;border-top:3px dashed #ffd400', '', '');
    } else if (preset === '16:9') {
      box('left:' + z.mx + 'px;top:' + z.my + 'px;right:' + z.mx + 'px;bottom:' + z.my + 'px;border:3px solid #2dff8a', 'Marges texte 5 %', '');
      box('left:' + z.band[0] + 'px;top:0;width:' + (z.band[1] - z.band[0]) + 'px;height:100%;border-left:3px dashed #ffd400;border-right:3px dashed #ffd400', 'Bande 9:16', '');
    } else {
      box('left:' + z.m + 'px;top:' + z.m + 'px;right:' + z.m + 'px;bottom:' + z.m + 'px;border:3px solid #2dff8a', 'Marges', '');
    }
    stage.appendChild(o);
    return o;
  }

  // ------------------------------------------------------------------ captions
  var VOWELS = /[aeiouyàâäéèêëîïôöùûüœæ]+/gi;
  function syllables(w) {
    var s = w.toLowerCase().replace(/[^a-zà-ÿœæ0-9]/g, '');
    if (/^\d+$/.test(s)) return Math.max(1, s.length);
    var m = s.match(VOWELS);
    var n = m ? m.length : 1;
    if (n > 1 && /[^aeiouyàâäéèêëîïôöùûüœæ](e|es|ent)$/.test(s)) n -= 1; // silent final e / es / ent
    return Math.max(1, n);
  }
  function pauseAfter(w) {
    if (/[.!?…]$/.test(w)) return 1.4;
    if (/[,;:]$/.test(w)) return 0.7;
    return 0;
  }
  /** distribute words of `text` over [start, end] by syllable weight (+ punctuation pauses) */
  function estimateWords(text, start, end) {
    var words = text.split(/\s+/).filter(Boolean);
    var weights = words.map(function (w) { return syllables(w) + 0.35; });
    var pauses = words.map(pauseAfter);
    var total = weights.reduce(function (a, b) { return a + b; }, 0) + pauses.slice(0, -1).reduce(function (a, b) { return a + b; }, 0);
    var k = (end - start) / total, t = start;
    return words.map(function (w, i) {
      var s = t, e = t + weights[i] * k;
      t = e + (i < words.length - 1 ? pauses[i] * k : 0);
      return { w: w, start: +s.toFixed(3), end: +e.toFixed(3) };
    });
  }

  /**
   * Kinetic word-by-word captions.
   *   var cap = new SK.Captions(el, cues, {maxWords: 4, maxChars: 16, lead: 0.08,
   *                                        emphasis: ['fatigue', 'bisglycinate'], mode: 'highlight'})
   *   cap.update(t)   // call from your seek(t)
   * cues: [{start, end, text, words?: [{w, start, end}]}]   (vo-build.mjs writes this)
   * mode 'highlight': whole chunk visible, current word in accent colour.
   * mode 'reveal'   : words appear one by one.
   * Styling: .ak-captions / .ak-cap-line / .ak-w (.is-now .is-past .is-em) in brand.css.
   */
  function Captions(el, cues, opts) {
    opts = opts || {};
    this.el = el;
    this.lead = opts.lead === undefined ? 0.08 : opts.lead;
    this.hold = opts.hold === undefined ? 0.35 : opts.hold;
    this.mode = opts.mode || 'highlight';
    this.maxChars = opts.maxChars || 16;
    var maxWords = opts.maxWords || 4;
    var em = (opts.emphasis || []).map(function (s) { return s.toLowerCase(); });
    var words = [];
    (cues || []).forEach(function (c) {
      var ws = c.words && c.words.length ? c.words : estimateWords(c.text, c.start, c.end);
      ws.forEach(function (w, i) { words.push({ w: w.w, start: w.start, end: w.end, cueEnd: i === ws.length - 1 }); });
    });
    var chunks = [], cur = [];
    words.forEach(function (w, i) {
      var prev = cur[cur.length - 1];
      var brk = cur.length >= maxWords || (prev && (/[.!?…,;:]$/.test(prev.w) || prev.cueEnd || w.start - prev.end > 0.35));
      if (brk && cur.length) { chunks.push(cur); cur = []; }
      var clean = w.w.toLowerCase().replace(/[^a-zà-ÿœæ0-9%]/g, '');
      w.em = em.some(function (e) { return clean.indexOf(e) === 0; });
      cur.push(w);
    });
    if (cur.length) chunks.push(cur);
    var self = this;
    this.chunks = chunks.map(function (ws, i) {
      var nxt = chunks[i + 1];
      var a = ws[0].start - self.lead;
      var b = ws[ws.length - 1].end + self.hold;
      if (nxt) b = Math.min(b, nxt[0].start - self.lead);
      return { words: ws, a: a, b: b, lines: splitLines(ws, self.maxChars) };
    });
    this.current = -1;
  }
  function splitLines(ws, maxChars) {
    var lines = [[]], len = 0;
    ws.forEach(function (w) {
      var l = w.w.length;
      if (lines[lines.length - 1].length && len + 1 + l > maxChars && lines.length < 2) { lines.push([]); len = 0; }
      lines[lines.length - 1].push(w); len += (len ? 1 : 0) + l;
    });
    return lines;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  Captions.prototype.update = function (t) {
    var idx = -1;
    for (var i = 0; i < this.chunks.length; i++) if (t >= this.chunks[i].a && t < this.chunks[i].b) { idx = i; break; }
    if (idx !== this.current) {
      this.current = idx;
      if (idx < 0) { this.el.innerHTML = ''; }
      else {
        this.el.innerHTML = this.chunks[idx].lines.map(function (line) {
          return '<div class="ak-cap-line">' + line.map(function (w) { return '<span class="ak-w' + (w.em ? ' is-em' : '') + '">' + esc(w.w) + '</span>'; }).join(' ') + '</div>';
        }).join('');
      }
    }
    if (idx < 0) return;
    var ch = this.chunks[idx], spans = this.el.querySelectorAll('.ak-w'), lead = this.lead, mode = this.mode;
    var pIn = ease.outBack(prog(t, ch.a, ch.a + 0.14), 2.2);
    this.el.style.transform = 'scale(' + lerp(0.9, 1, pIn).toFixed(4) + ')';
    this.el.style.opacity = prog(t, ch.a, ch.a + 0.08).toFixed(3);
    ch.words.forEach(function (w, i) {
      var sp = spans[i]; if (!sp) return;
      var on = t >= w.start - lead;
      var now = on && (i === ch.words.length - 1 || t < ch.words[i + 1].start - lead);
      sp.classList.toggle('is-past', on && !now);
      sp.classList.toggle('is-now', now);
      if (mode === 'reveal') {
        var p = ease.outBack(prog(t, w.start - lead, w.start - lead + 0.12), 2);
        sp.style.opacity = on ? 1 : 0;
        sp.style.transform = 'translateY(' + ((1 - p) * 18).toFixed(1) + 'px) scale(' + lerp(0.85, 1, p).toFixed(3) + ')';
      } else {
        var q = ease.outCubic(prog(t, w.start - lead, w.start - lead + 0.1));
        sp.style.transform = now ? 'scale(' + lerp(1, 1.06, q).toFixed(3) + ')' : 'none';
      }
    });
  };

  // ------------------------------------------------------------------ grain overlay (lo-fi / iPhone look)
  /** new SK.Grain(canvas, {amount: .07, size: 256}) ; grain.draw(t, fps) */
  function Grain(canvas, opts) {
    opts = opts || {};
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.amount = opts.amount === undefined ? 0.07 : opts.amount;
    var size = opts.size || 256, r = rng(opts.seed || 99);
    this.tiles = [];
    for (var k = 0; k < 8; k++) {
      var tc = document.createElement('canvas'); tc.width = tc.height = size;
      var x = tc.getContext('2d'), id = x.createImageData(size, size);
      for (var i = 0; i < id.data.length; i += 4) { var v = (r() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      x.putImageData(id, 0, 0); this.tiles.push(tc);
    }
  }
  Grain.prototype.draw = function (t, fps) {
    var f = Math.floor(t * (fps || 30)), tile = this.tiles[f % 8], ctx = this.ctx;
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.globalAlpha = this.amount;
    var pat = ctx.createPattern(tile, 'repeat');
    ctx.save(); ctx.translate((f * 37) % 256, (f * 91) % 256); ctx.fillStyle = pat;
    ctx.fillRect(-256, -256, this.c.width + 512, this.c.height + 512); ctx.restore();
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ preview player
  function preview(stage, W, H, dur, fps) {
    var bar = document.createElement('div');
    bar.className = 'sk-bar';
    bar.innerHTML = '<button type="button">❚❚</button><input type="range" min="0" max="' + dur + '" step="' + (1 / fps) + '" value="0"><span>0.00 s</span>' +
      '<a href="#" data-safe>zones</a>';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:44px;display:flex;gap:12px;align-items:center;padding:0 12px;background:#111;color:#eee;font:13px system-ui;z-index:100000';
    bar.querySelector('input').style.flex = '1';
    bar.querySelector('a').style.color = '#9cf';
    document.body.appendChild(bar);
    document.documentElement.style.background = '#2a2a2a';
    document.body.style.margin = '0';
    function fit() {
      var s = Math.min(window.innerWidth / W, (window.innerHeight - 44) / H);
      stage.style.transformOrigin = '0 0';
      stage.style.transform = 'scale(' + s + ')';
      stage.style.position = 'absolute';
      stage.style.left = ((window.innerWidth - W * s) / 2) + 'px';
      stage.style.top = '0px';
    }
    fit(); window.addEventListener('resize', fit);
    var btn = bar.querySelector('button'), rg = bar.querySelector('input'), lab = bar.querySelector('span');
    var playing = params.t === null, t = params.t || 0, t0 = performance.now() - t * 1000;
    function show(tt) { t = tt; window.__seek(tt); rg.value = tt; lab.textContent = tt.toFixed(2) + ' s'; }
    function loop(now) {
      if (playing) show(((now - t0) / 1000) % dur);
      requestAnimationFrame(loop);
    }
    btn.onclick = function () { playing = !playing; btn.textContent = playing ? '❚❚' : '▶'; t0 = performance.now() - t * 1000; };
    rg.oninput = function () { playing = false; btn.textContent = '▶'; show(+rg.value); };
    bar.querySelector('a').onclick = function (e) {
      e.preventDefault(); var u = new URL(location.href);
      if (u.searchParams.get('safe') === '1') u.searchParams.delete('safe'); else u.searchParams.set('safe', '1');
      location.href = u.href;
    };
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); btn.onclick(); }
      if (e.code === 'ArrowRight') { playing = false; show(Math.min(dur, t + 1 / fps)); }
      if (e.code === 'ArrowLeft') { playing = false; show(Math.max(0, t - 1 / fps)); }
    });
    if (!playing) btn.textContent = '▶';
    show(t);
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ scene
  /**
   * SK.scene({
   *   stage: '#stage',            // element (default .ak-stage)
   *   width: 1080, height: 1920,  // design size (URL ?w=&h= override)
   *   duration: 12,
   *   fonts: [...],               // extra CSS font specs to preload
   *   ready: async () => {},      // load your assets here
   *   seek: (t, ctx) => {},       // draw frame t. ctx = {W, H, dur, fps}
   *   safePreset: '9:16'          // overlay preset for ?safe=1 (auto from size)
   * })
   */
  function scene(opts) {
    var stage = typeof opts.stage === 'string' ? document.querySelector(opts.stage) : (opts.stage || document.querySelector('.ak-stage'));
    if (!stage) throw new Error('SK.scene: stage element not found');
    var W = params.w || opts.width || 1080, H = params.h || opts.height || 1920;
    var dur = params.dur || opts.duration || 10, fps = params.fps || 30;
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    document.documentElement.style.setProperty('--w', W + 'px');
    document.documentElement.style.setProperty('--h', H + 'px');
    var ctx = { W: W, H: H, dur: dur, fps: fps, stage: stage, render: RENDER };
    window.__duration = dur;
    window.__seek = function (t) { return opts.seek(clamp(t, 0, dur), ctx); };
    window.__ready = (async function () {
      await loadFonts(BRAND_FONTS.concat(opts.fonts || []));
      if (opts.ready) await opts.ready(ctx);
      await decodeAll(stage);
      if (document.fonts) await document.fonts.ready;
      await window.__seek(params.t || 0);
    })();
    window.__ready.catch(function (e) { console.error('scene ready failed', e); });
    if (params.safe) safeZones(stage, opts.safePreset || (W > H ? '16:9' : H / W > 1.5 ? '9:16' : '4:5'));
    if (!RENDER) window.__ready.then(function () { preview(stage, W, H, dur, fps); });
    return ctx;
  }

  window.SK = {
    params: params, clamp: clamp, lerp: lerp, prog: prog, ease: ease, seg: seg, spring: spring,
    kf: kf, win: win, rng: rng, noise1: noise1, handheld: handheld, set: set, typewriter: typewriter,
    syncCSS: syncCSS, loadImages: loadImages, loadImage: loadImage, loadFonts: loadFonts,
    SAFE: SAFE, safeZones: safeZones, Captions: Captions, estimateWords: estimateWords,
    syllables: syllables, Grain: Grain, scene: scene,
  };
})();
