/* V2 jar renderer (classic script -> window.JarV2).
 *
 * Procedural amber-glass jar on a 2D canvas, drawn at the output scale (stays crisp at any size):
 *   - real 360° label turntable: brand/png/label-wrap-2x.png mapped column by column on the
 *     cylinder (same mapping as tools/lib/jar3d.js: u = (asin(x/R) + rot) / 2pi + 0.5);
 *   - capsules seen through the glass placed in 3D inside the cylinder, so they turn with the jar;
 *   - ribbed lid as its own layer: lift, tilt and screw rotation (ribs move with lidRot);
 *   - open mouth + neck threads when the lid is lifted;
 *   - speculars fixed to the key light (upper left), moving sheen (light sweep), vertical glint,
 *     contre-jour darkening + warm rim light.
 * Geometry copied from brand/src/build_brand.py (viewBox 1000 x 1200, axis x = 500).
 *
 *   const jar = new JarV2({ label, capsule });           // HTMLImageElements
 *   jar.draw(ctx, { x0, y0, s, rot, lidLift, lidTilt, lidRot, light, glint, dark, rim, beforeLid })
 *   x0, y0: where the jar-unit origin lands (px); s: px per jar unit; rot: radians (0 = front,
 *   -2.1 composition panel, +2.1 usage panel); lidLift in jar units; lidTilt in degrees.
 */
(function () {
  'use strict';
  var G = { BX0: 222, BX1: 778, LX0: 258, LX1: 742, NX0: 300, NX1: 700, LID_T: 140, LID_B: 300,
    NECK_T: 292, NECK_B: 318, SH_T: 306, SH_E: 388, LAB_T: 424, LAB_B: 954, BODY_B: 1064, CURVE: 9,
    texOffset: 1.8, texH: 530 };
  var R = (G.BX1 - G.BX0) / 2, CX = 500, LR = (G.LX1 - G.LX0) / 2;
  var BODY_D = 'M' + G.NX0 + ' ' + G.SH_T + ' L' + G.NX1 + ' ' + G.SH_T +
    ' C' + (G.NX1 + 58) + ' ' + G.SH_T + ' ' + G.BX1 + ' ' + (G.SH_T + 30) + ' ' + G.BX1 + ' ' + G.SH_E +
    ' L' + G.BX1 + ' ' + (G.BODY_B - 54) +
    ' C' + G.BX1 + ' ' + (G.BODY_B - 14) + ' ' + (G.BX1 - 34) + ' ' + (G.BODY_B + G.CURVE) + ' ' + (G.BX1 - 90) + ' ' + (G.BODY_B + G.CURVE) +
    ' L' + (G.BX0 + 90) + ' ' + (G.BODY_B + G.CURVE) +
    ' C' + (G.BX0 + 34) + ' ' + (G.BODY_B + G.CURVE) + ' ' + G.BX0 + ' ' + (G.BODY_B - 14) + ' ' + G.BX0 + ' ' + (G.BODY_B - 54) +
    ' L' + G.BX0 + ' ' + G.SH_E +
    ' C' + G.BX0 + ' ' + (G.SH_T + 30) + ' ' + (G.NX0 - 58) + ' ' + G.SH_T + ' ' + G.NX0 + ' ' + G.SH_T + ' Z';
  var LABEL_D = 'M' + G.BX0 + ' ' + G.LAB_T + ' Q' + CX + ' ' + (G.LAB_T + 2 * G.CURVE) + ' ' + G.BX1 + ' ' + G.LAB_T +
    ' L' + G.BX1 + ' ' + G.LAB_B + ' Q' + CX + ' ' + (G.LAB_B + 2 * G.CURVE) + ' ' + G.BX0 + ' ' + G.LAB_B + ' Z';

  function lin(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function layer(K, fn) {
    var c = document.createElement('canvas'); c.width = Math.round(1000 * K); c.height = Math.round(1200 * K);
    var x = c.getContext('2d'); x.scale(K, K); fn(x, K); return c;
  }

  function JarV2(imgs, opts) {
    opts = opts || {};
    this.label = imgs.label; this.capsule = imgs.capsule;
    this.tk = this.label.naturalWidth / 1748;
    this.body = new Path2D(BODY_D); this.labelP = new Path2D(LABEL_D);
    var K = opts.K || 1.2, body = this.body, labelP = this.labelP;
    // ---- static layers (smooth gradients and blurred speculars: resolution independent enough)
    this.back = layer(K, function (c) {
      c.fillStyle = lin(c, G.NX0, 0, G.NX1, 0, [[0, '#2A1204'], [0.3, '#7C3C12'], [0.5, '#5C2B0C'], [1, '#1F0D03']]);
      rrect(c, G.NX0, G.NECK_T, G.NX1 - G.NX0, G.NECK_B - G.NECK_T, 6); c.fill();
      c.fillStyle = lin(c, G.BX0, 0, G.BX1, 0, [[0, '#2E1405'], [0.07, '#5E2C0D'], [0.2, '#9C4E19'], [0.32, '#C26E2A'],
        [0.44, '#A2521B'], [0.68, '#7A3A12'], [0.88, '#55270B'], [1, '#2A1204']]);
      c.fill(body);
    });
    this.tint = layer(K, function (c) {
      c.globalAlpha = 0.35; c.fillStyle = '#7A3A12'; c.fill(body); c.globalAlpha = 1;
      c.fillStyle = lin(c, 0, G.SH_T, 0, G.BODY_B, [[0, 'rgba(0,0,0,.35)'], [0.12, 'rgba(0,0,0,0)'], [0.9, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.25)']]);
      c.fill(body);
    });
    this.spec = layer(K, function (c, k) {
      c.beginPath(); c.moveTo(G.BX0, G.LAB_T); c.quadraticCurveTo(500, G.LAB_T + 2 * G.CURVE, G.BX1, G.LAB_T);
      c.strokeStyle = 'rgba(42,18,4,.25)'; c.lineWidth = 2; c.stroke();
      c.save(); c.clip(body);
      c.filter = 'blur(' + (5 * k) + 'px)';
      c.fillStyle = 'rgba(255,255,255,.38)'; rrect(c, 266, G.SH_E - 30, 30, G.BODY_B - G.SH_E - 30, 15); c.fill();
      c.fillStyle = 'rgba(255,217,168,.22)'; rrect(c, 728, G.SH_E, 12, G.BODY_B - G.SH_E - 90, 6); c.fill();
      c.filter = 'blur(' + (2.2 * k) + 'px)';
      c.fillStyle = 'rgba(255,255,255,.55)'; rrect(c, 279, G.SH_E - 10, 7, G.BODY_B - G.SH_E - 80, 3.5); c.fill();
      c.beginPath(); c.moveTo(G.NX0 + 10, G.SH_T + 14);
      c.bezierCurveTo(G.NX0 - 30, G.SH_T + 18, G.BX0 + 24, G.SH_T + 44, G.BX0 + 20, G.SH_E + 6);
      c.strokeStyle = 'rgba(255,226,188,.45)'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.moveTo(G.BX0 + 40, G.BODY_B - 14); c.quadraticCurveTo(500, G.BODY_B + 2 * G.CURVE + 6, G.BX1 - 40, G.BODY_B - 14);
      c.strokeStyle = 'rgba(231,154,75,.35)'; c.lineWidth = 6; c.stroke();
      c.restore();
    });
    this.lidBase = layer(K, function (c) {
      c.fillStyle = lin(c, G.LX0, 0, G.LX1, 0, [[0, '#A99C89'], [0.12, '#CFC5B6'], [0.34, '#EEE8DE'], [0.46, '#F7F2EA'],
        [0.72, '#D9D0C2'], [0.92, '#B4A794'], [1, '#8F826F']]);
      rrect(c, G.LX0, G.LID_T, G.LX1 - G.LX0, G.LID_B - G.LID_T, 22); c.fill();
    });
    this.lidTop = layer(K, function (c, k) {
      c.fillStyle = lin(c, 0, G.LID_T, 0, G.LID_B, [[0, 'rgba(255,255,255,.55)'], [0.08, 'rgba(255,255,255,0)'], [0.88, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.22)']]);
      rrect(c, G.LX0, G.LID_T, G.LX1 - G.LX0, G.LID_B - G.LID_T, 22); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; rrect(c, G.LX0 + 14, G.LID_T + 7, G.LX1 - G.LX0 - 28, 3, 1.5); c.fill();
      c.fillStyle = 'rgba(90,74,56,.18)'; c.fillRect(G.LX0 + 6, G.LID_T + 22, G.LX1 - G.LX0 - 12, 2);
      c.fillStyle = 'rgba(90,74,56,.2)'; c.fillRect(G.LX0 + 4, G.LID_B - 16, G.LX1 - G.LX0 - 8, 2);
      c.filter = 'blur(' + (2.2 * k) + 'px)';
      c.fillStyle = 'rgba(255,255,255,.45)'; rrect(c, G.LX0 + 120, G.LID_T + 30, 26, G.LID_B - G.LID_T - 52, 13); c.fill();
      c.filter = 'none';
    });
    // ---- capsules inside the glass, in 3D (angle a around the axis, radius r, height y, 3D axis)
    var rnd = (window.SK && SK.rng) ? SK.rng(11) : Math.random, list = [];
    function add(n, y0, y1, op) {
      for (var i = 0; i < n; i++) {
        list.push({ a: rnd() * Math.PI * 2, r: R * (0.3 + 0.66 * rnd()), y: y0 + (y1 - y0) * rnd(),
          psi: (rnd() * 2 - 1) * 1.1, beta: rnd() * Math.PI * 2, op: op * (0.8 + 0.4 * rnd()) });
      }
    }
    add(24, G.SH_T + 26, G.LAB_T + 6, 0.17);
    add(26, G.LAB_B + 2, G.BODY_B - 4, 0.15);
    this.contents = list;
  }

  JarV2.prototype.drawContents = function (ctx, rot) {
    var cs = Math.cos(rot), sn = Math.sin(rot), cap = this.capsule;
    var items = this.contents.map(function (c) {
      var x = CX + c.r * Math.sin(c.a - rot), z = c.r * Math.cos(c.a - rot);
      var vx = Math.cos(c.psi) * Math.cos(c.beta), vy = Math.sin(c.psi), vz = Math.cos(c.psi) * Math.sin(c.beta);
      var px = vx * cs - vz * sn;
      return { c: c, x: x, z: z, lf: Math.min(1, Math.hypot(px, vy)), ang: Math.atan2(vy, px) };
    }).sort(function (a, b) { return a.z - b.z; });
    ctx.save(); ctx.clip(this.body); ctx.globalCompositeOperation = 'screen';
    items.forEach(function (it) {
      var d = (it.z / it.c.r + 1) / 2, L = 74, D = 27 * (0.88 + 0.12 * d);
      var len = D + (L - D) * it.lf, ang = it.ang;
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.globalAlpha = it.c.op * (0.45 + 0.75 * d);
      ctx.save(); ctx.translate(it.x, it.c.y); ctx.rotate(ang);
      ctx.drawImage(cap, -len * 320 / 296 / 2, -D * 120 / 104 / 2, len * 320 / 296, D * 120 / 104);
      ctx.restore();
    });
    ctx.restore();
  };

  JarV2.prototype.drawLabel = function (ctx, rot, s) {
    ctx.save(); ctx.clip(this.labelP);
    ctx.fillStyle = '#F4ECDF'; ctx.fillRect(G.BX0, G.LAB_T, 2 * R, G.LAB_B - G.LAB_T + 2 * G.CURVE);
    var step = Math.max(0.5, 1 / s), TW = this.label.naturalWidth, TH = this.label.naturalHeight, tk = this.tk;
    for (var dx = -R; dx < R; dx += step) {
      var mid = Math.max(-0.99999, Math.min(0.99999, (dx + step / 2) / R));
      var th = Math.asin(mid);
      var u = (((th + rot) / (2 * Math.PI) + 0.5) % 1 + 1) % 1;
      var dudx = 1748 / (2 * Math.PI) / (R * Math.cos(th));
      var sw = Math.max(1, dudx * step * tk), sx = u * TW;
      if (sx + sw > TW) sx = TW - sw;
      var ss = (dx + R) / (2 * R), top = G.LAB_T + 4 * G.CURVE * ss * (1 - ss) + G.texOffset;
      ctx.drawImage(this.label, sx, 0, sw, TH, CX + dx, top, step + 0.35, G.texH);
    }
    ctx.fillStyle = lin(ctx, G.BX0, 0, G.BX1, 0, [[0, 'rgba(58,28,8,.62)'], [0.1, 'rgba(58,28,8,.2)'], [0.26, 'rgba(58,28,8,.03)'],
      [0.38, 'rgba(255,255,255,.14)'], [0.5, 'rgba(255,255,255,0)'], [0.8, 'rgba(58,28,8,.1)'], [0.93, 'rgba(58,28,8,.35)'], [1, 'rgba(58,28,8,.66)']]);
    ctx.fillRect(G.BX0, G.LAB_T, 2 * R, G.LAB_B - G.LAB_T + 2 * G.CURVE);
    ctx.restore();
  };

  // soft vertical band (jar units)
  function band(ctx, x, w, y0, y1, a, rgb) {
    if (a <= 0.001) return;
    rgb = rgb || '255,255,255';
    ctx.fillStyle = lin(ctx, x - w, 0, x + w, 0, [[0, 'rgba(' + rgb + ',0)'], [0.5, 'rgba(' + rgb + ',' + a.toFixed(3) + ')'], [1, 'rgba(' + rgb + ',0)']]);
    ctx.fillRect(x - w, y0, 2 * w, y1 - y0);
  }

  JarV2.prototype.drawLid = function (ctx, o) {
    var lift = o.lidLift || 0;
    ctx.save();
    ctx.translate(500, 220 - lift); ctx.rotate(((o.lidTilt || 0) * Math.PI) / 180); ctx.translate(-500, -220);
    ctx.drawImage(this.lidBase, 0, 0, 1000, 1200);
    ctx.save(); rrect(ctx, G.LX0, G.LID_T, G.LX1 - G.LX0, G.LID_B - G.LID_T, 22); ctx.clip();
    var n = 140, rr = o.lidRot || 0, y = G.LID_T + 26, h = G.LID_B - G.LID_T - 40;
    ctx.fillStyle = '#3B2E20';
    for (var i = 0; i < n; i++) {
      var th = ((i * 2 * Math.PI / n + rr) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (th > Math.PI) th -= 2 * Math.PI;
      if (Math.abs(th) >= Math.PI / 2 - 0.02) continue;
      var x = 500 + LR * Math.sin(th);
      ctx.globalAlpha = 0.05 + 0.07 * (1 - Math.cos(th));
      ctx.fillRect(x - 0.9 * Math.max(0.5, Math.cos(th)), y, 1.8 * Math.max(0.5, Math.cos(th)), h);
    }
    ctx.globalAlpha = 1;
    // light sweep / glint on the lid
    if (o.light > 0 && o.light < 1) band(ctx, G.LX0 - 40 + (G.LX1 - G.LX0 + 80) * o.light, 60, G.LID_T, G.LID_B, 0.4 * Math.sin(Math.PI * o.light));
    if (o.glint) band(ctx, 330, 16, G.LID_T, G.LID_B, 0.5 * o.glint);
    if (o.dark) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(70,40,22,' + (0.82 * o.dark).toFixed(3) + ')'; ctx.fillRect(G.LX0, G.LID_T, G.LX1 - G.LX0, G.LID_B - G.LID_T);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.rim) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = lin(ctx, G.LX0, 0, G.LX1, 0, [[0, 'rgba(255,196,120,' + (0.85 * o.rim).toFixed(3) + ')'], [0.04, 'rgba(255,196,120,0)'],
        [0.96, 'rgba(255,196,120,0)'], [1, 'rgba(255,196,120,' + (0.85 * o.rim).toFixed(3) + ')']]);
      ctx.fillRect(G.LX0, G.LID_T, G.LX1 - G.LX0, G.LID_B - G.LID_T);
      ctx.fillStyle = 'rgba(255,200,130,' + (0.6 * o.rim).toFixed(3) + ')'; ctx.fillRect(G.LX0 + 10, G.LID_T, G.LX1 - G.LX0 - 20, 4);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.drawImage(this.lidTop, 0, 0, 1000, 1200);
    ctx.restore();
  };

  /** screen position of the mouth centre for jar options o */
  JarV2.prototype.mouth = function (o) { return { x: o.x0 + 500 * o.s, y: o.y0 + G.NECK_T * o.s }; };

  JarV2.prototype.draw = function (ctx, o) {
    var s = o.s || 1, rot = o.rot || 0;
    ctx.save();
    ctx.translate(o.x0 || 0, o.y0 || 0); ctx.scale(s, s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.back, 0, 0, 1000, 1200);
    this.drawContents(ctx, rot);
    ctx.drawImage(this.tint, 0, 0, 1000, 1200);
    this.drawLabel(ctx, rot, s);
    ctx.drawImage(this.spec, 0, 0, 1000, 1200);
    ctx.save(); ctx.clip(this.body);
    if (o.light > 0 && o.light < 1) {
      var lx = G.BX0 - 80 + (2 * R + 160) * o.light, a = Math.sin(Math.PI * o.light);
      band(ctx, lx, 90, G.SH_T, G.BODY_B + 10, 0.32 * a);
      band(ctx, lx + 8, 14, G.SH_T, G.BODY_B + 10, 0.5 * a);
    }
    if (o.glint) { band(ctx, 302, 22, G.SH_T, G.BODY_B, 0.42 * o.glint); band(ctx, 300, 4.5, G.SH_E - 20, G.BODY_B - 40, 0.75 * o.glint); }
    if (o.dark) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(56,22,6,' + (0.86 * o.dark).toFixed(3) + ')'; ctx.fill(this.body);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.rim) {
      ctx.globalCompositeOperation = 'screen';
      var ra = 0.95 * o.rim;
      ctx.fillStyle = lin(ctx, G.BX0, 0, G.BX1, 0, [[0, 'rgba(255,196,120,' + ra.toFixed(3) + ')'], [0.025, 'rgba(255,170,90,' + (ra * 0.45).toFixed(3) + ')'], [0.07, 'rgba(255,170,90,0)'],
        [0.93, 'rgba(255,170,90,0)'], [0.975, 'rgba(255,170,90,' + (ra * 0.45).toFixed(3) + ')'], [1, 'rgba(255,196,120,' + ra.toFixed(3) + ')']]);
      ctx.fill(this.body);
      // warm light passing through the amber glass (shoulder and base, outside the opaque label)
      ctx.globalCompositeOperation = 'lighter';
      var ga = 0.55 * o.rim * (o.dark || 0);
      ctx.fillStyle = lin(ctx, G.BX0, 0, G.BX1, 0, [[0, 'rgba(150,50,0,0)'], [0.18, 'rgba(190,75,8,' + (ga * 0.7).toFixed(3) + ')'], [0.42, 'rgba(225,105,20,' + ga.toFixed(3) + ')'],
        [0.62, 'rgba(210,95,15,' + (ga * 0.9).toFixed(3) + ')'], [0.85, 'rgba(170,60,5,' + (ga * 0.5).toFixed(3) + ')'], [1, 'rgba(150,50,0,0)']]);
      ctx.fillRect(G.BX0, G.SH_T, 2 * R, G.LAB_T - G.SH_T); ctx.fillRect(G.BX0, G.LAB_B + 12, 2 * R, G.BODY_B - G.LAB_B);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // open mouth + threads when the lid is up
    var open = Math.min(1, (o.lidLift || 0) / 30);
    if (open > 0.01) {
      ctx.save(); ctx.globalAlpha = open;
      ctx.strokeStyle = 'rgba(255,205,150,.28)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(G.NX0 + 2, G.NECK_T + 9); ctx.quadraticCurveTo(500, G.NECK_T + 21, G.NX1 - 2, G.NECK_T + 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,8,2,.3)';
      ctx.beginPath(); ctx.moveTo(G.NX0 + 2, G.NECK_T + 17); ctx.quadraticCurveTo(500, G.NECK_T + 29, G.NX1 - 2, G.NECK_T + 13); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(500, G.NECK_T, 197, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = lin(ctx, 0, G.NECK_T - 13, 0, G.NECK_T + 13, [[0, '#0E0501'], [0.6, '#2B1205'], [1, '#5A2A0C']]); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,166,.55)';
      ctx.beginPath(); ctx.ellipse(500, G.NECK_T, 197, 13, 0, 0.05, Math.PI - 0.05); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,166,.22)';
      ctx.beginPath(); ctx.ellipse(500, G.NECK_T, 197, 13, 0, Math.PI + 0.05, 2 * Math.PI - 0.05); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (o.beforeLid) o.beforeLid();
    if (o.lid !== false) {
      ctx.save(); ctx.translate(o.x0 || 0, o.y0 || 0); ctx.scale(s, s);
      this.drawLid(ctx, o);
      ctx.restore();
    }
  };

  JarV2.G = G; JarV2.R = R;
  window.JarV2 = JarV2;
})();
