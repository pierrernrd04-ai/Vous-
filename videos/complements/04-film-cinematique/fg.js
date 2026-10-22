/* Ambrel V4 : foreground layers drawn on 2D canvases, uploaded as textures by gl-shots.js.
   FG.gesture(ctx, t, cam)  S4 : stylised silhouette hand pouring water from a glass carafe into a tumbler
   FG.hero(ctx, t, cam)     S7 : jar (Jar3D, real label rotation) on the pedestal
   All positions are world pixels (1920x1080, y down); cam = {zoom, roll} matches the shader camera. */
(function () {
  'use strict';
  const { prog, seg, ease, lerp, clamp, kf } = SK;

  function camXform(ctx, cam) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(960, 540);
    ctx.scale(cam.zoom || 1, cam.zoom || 1);
    if (cam.roll) ctx.rotate(-cam.roll);
    ctx.translate(-960, -540);
  }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function mixc(a, b, p) { return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * p)); }
  // local -> world for a rotation about (px, py)
  function rot(px, py, a, x, y) { const c = Math.cos(a), s = Math.sin(a); return [px + c * x - s * y, py + s * x + c * y]; }

  // ------------------------------------------------------------------ S4 timeline
  const POUR0 = 7.95, POUR1 = 10.05;
  function pourState(t) {
    // carafe tilt (radians, applied as canvas rotate(-tilt) => counter-clockwise on screen)
    const tilt = kf(t, [[7.2, 0.86], [7.95, 1.06], [10.0, 1.30], [10.45, 0.86], [11.2, 0.80]], ease.inOutSine);
    const lift = kf(t, [[10.0, 0], [10.6, -16], [11.2, -24]], ease.inOutSine);
    const fill = seg(t, POUR0 + 0.25, POUR1 + 0.2, ease.inOutSine); // glass water level 0..1
    return { tilt, lift, fill };
  }

  // ------------------------------------------------------------------ glass tumbler
  const GL = { cx: 960, base: 832, h: 292, rb: 74, rt: 94, ery: 11 };
  function tumblerPath(ctx, inset) {
    const { cx, base, h, rb, rt } = GL, top = base - h;
    ctx.beginPath();
    ctx.moveTo(cx - rt + inset, top);
    ctx.lineTo(cx - rb + inset, base - 6);
    ctx.quadraticCurveTo(cx - rb + inset, base + GL.ery - 2, cx, base + GL.ery - 1);
    ctx.quadraticCurveTo(cx + rb - inset, base + GL.ery - 2, cx + rb - inset, base - 6);
    ctx.lineTo(cx + rt - inset, top);
    ctx.closePath();
  }
  function radiusAt(y) { const { base, h, rb, rt } = GL; return lerp(rb, rt, clamp((base - y) / h)); }

  function drawTumbler(ctx, t, st, light, warm) {
    const { cx, base, h, ery } = GL, top = base - h;
    const hi = rgba(light, 0.85), hiSoft = rgba(light, 0.22);
    // body tint
    ctx.save();
    tumblerPath(ctx, 0); ctx.fillStyle = 'rgba(205,220,235,0.05)'; ctx.fill();
    ctx.clip();
    // water
    const wl = lerp(base - 20, base - 168, st.fill);
    if (st.fill > 0.002 || t > POUR0 + 0.2) {
      const g = ctx.createLinearGradient(0, wl, 0, base);
      g.addColorStop(0, rgba(mixc([170, 195, 220], [235, 200, 150], warm), 0.20));
      g.addColorStop(1, rgba(mixc([120, 150, 180], [200, 150, 95], warm), 0.30));
      ctx.fillStyle = g;
      ctx.fillRect(cx - 140, wl, 280, base - wl + 20);
      // plunging stream glow inside the water
      if (t > POUR0 && t < POUR1 + 0.15) {
        const sx = st.impactX || cx;
        const gg = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
        gg.addColorStop(0, rgba(light, 0)); gg.addColorStop(0.5, rgba(light, 0.16)); gg.addColorStop(1, rgba(light, 0));
        ctx.fillStyle = gg; ctx.fillRect(sx - 40, wl, 80, Math.min(90, base - wl));
      }
      // bubbles
      const R = SK.rng(7);
      for (let i = 0; i < 26; i++) {
        const t0 = POUR0 + R() * 2.3, life = 0.5 + R() * 0.7, x0 = (R() - 0.5) * 70, r = 1.2 + R() * 2.6;
        const k = (t - t0) / life;
        if (k < 0 || k > 1) continue;
        const y = lerp(wl + 70 + R() * 30, wl + 4, ease.outQuad(k));
        if (y > base - 6) continue;
        ctx.beginPath(); ctx.arc((st.impactX || cx) + x0 * (0.4 + k), y, r, 0, 6.283);
        ctx.strokeStyle = rgba(light, 0.55 * (1 - k)); ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // internal refraction bands
    for (const [x, w, a] of [[-0.70, 10, 0.16], [0.62, 16, 0.12], [-0.25, 26, 0.05]]) {
      const xx = cx + x * GL.rt;
      const g = ctx.createLinearGradient(xx - w, 0, xx + w, 0);
      g.addColorStop(0, rgba(light, 0)); g.addColorStop(0.5, rgba(light, a)); g.addColorStop(1, rgba(light, 0));
      ctx.fillStyle = g; ctx.fillRect(xx - w, top, 2 * w, h);
    }
    // thick base
    const bg = ctx.createLinearGradient(0, base - 22, 0, base + ery);
    bg.addColorStop(0, rgba(light, 0.05)); bg.addColorStop(0.6, rgba(light, 0.35)); bg.addColorStop(1, rgba(light, 0.12));
    ctx.fillStyle = bg; ctx.fillRect(cx - 100, base - 22, 200, 40);
    ctx.restore();
    // meniscus
    if (st.fill > 0.002 || t > POUR0 + 0.2) {
      const wl2 = lerp(base - 20, base - 168, st.fill), r = radiusAt(wl2) - 3;
      const wob = (t > POUR0 && t < POUR1 + 0.3) ? 1.5 * Math.sin(t * 23) : 0;
      ctx.beginPath(); ctx.ellipse(cx, wl2 + wob * 0.3, r, 6 + wob * 0.4, 0, 0, 6.283);
      ctx.strokeStyle = rgba(light, 0.55); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, wl2 + 1, r - 2, 5, 0, 0.15, 3.0);
      ctx.strokeStyle = rgba(light, 0.9); ctx.lineWidth = 1.2; ctx.stroke();
    }
    // edges: dark refraction band + bright core line
    ctx.save();
    tumblerPath(ctx, 0); ctx.strokeStyle = 'rgba(12,12,16,0.30)'; ctx.lineWidth = 7; ctx.stroke();
    tumblerPath(ctx, 2.5); ctx.strokeStyle = hi; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // rim
    ctx.beginPath(); ctx.ellipse(cx, top, GL.rt, ery, 0, 0, 6.283);
    ctx.strokeStyle = 'rgba(12,12,16,0.25)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = hi; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, top, GL.rt - 3, ery - 2, 0, 3.4, 6.0);
    ctx.strokeStyle = hiSoft; ctx.lineWidth = 3; ctx.stroke();
  }

  // ------------------------------------------------------------------ carafe (local coords: body centre at 0,0; neck up = -y)
  const SPOUT = [-42, -190];
  function carafePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-24, -186);                          // lip, left
    ctx.quadraticCurveTo(-36, -195, -42, -190);     // spout
    ctx.quadraticCurveTo(-37, -180, -22, -176);
    ctx.lineTo(-22, -112);                          // neck
    ctx.bezierCurveTo(-22, -80, -62, -74, -62, -40); // shoulder
    ctx.lineTo(-62, 130);
    ctx.quadraticCurveTo(-62, 150, -42, 152);
    ctx.lineTo(42, 152);
    ctx.quadraticCurveTo(62, 150, 62, 130);
    ctx.lineTo(62, -40);
    ctx.bezierCurveTo(62, -74, 22, -80, 22, -112);
    ctx.lineTo(22, -180);
    ctx.quadraticCurveTo(24, -188, 18, -188);
    ctx.lineTo(-20, -188);
    ctx.closePath();
  }
  // silhouette of the hand: back of the hand on the right of the body, fingers wrapping the front
  function handPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(56, -40);
    ctx.bezierCurveTo(90, -54, 140, -58, 178, -36);
    ctx.bezierCurveTo(197, -24, 205, 8, 203, 40);
    ctx.bezierCurveTo(201, 70, 181, 95, 146, 99);
    ctx.bezierCurveTo(116, 101, 84, 92, 60, 80);
    ctx.bezierCurveTo(54, 50, 52, -10, 56, -40);
    ctx.closePath();
  }
  // [y at the base, half thickness, x of the tip, angle (deg)]: index, middle, ring, little finger
  const FINGERS = [[-24, 14.5, 4, -9], [6, 15, -10, -3], [35, 14.5, -4, 3], [62, 12.5, 12, 8]];
  function fingerPath(ctx, f) {
    const [y0, r, xt, ang] = f, xb = 74;
    const yt = y0 + Math.tan(ang * Math.PI / 180) * (xt - xb);
    const ux = xt - xb, uy = yt - y0, L = Math.hypot(ux, uy), dx = ux / L, dy = uy / L, nx = -dy, ny = dx;
    const rt = r * 0.84, bend = 5;
    const mx = (xb + xt) / 2 + nx * bend, my = (y0 + yt) / 2 + ny * bend;
    ctx.beginPath();
    ctx.moveTo(xb - nx * r, y0 - ny * r);
    ctx.quadraticCurveTo(mx - nx * r * 0.95, my - ny * r * 0.95, xt - nx * rt, yt - ny * rt);
    ctx.arc(xt, yt, rt, Math.atan2(-ny, -nx), Math.atan2(ny, nx), dx > 0);
    ctx.quadraticCurveTo(mx + nx * r * 0.95, my + ny * r * 0.95, xb + nx * r, y0 + ny * r);
    ctx.closePath();
    return { xt, yt, rt, dx, dy };
  }
  function thumbPath(ctx) { // thumb behind the shoulder, seen through the glass
    ctx.beginPath();
    ctx.moveTo(70, -40);
    ctx.bezierCurveTo(58, -66, 40, -86, 18, -96);
    ctx.bezierCurveTo(6, -101, 0, -90, 10, -82);
    ctx.bezierCurveTo(26, -70, 42, -52, 52, -30);
    ctx.closePath();
  }

  function drawCarafe(ctx, t, st, light, warm, skin, rim) {
    const PX = 1198, PY = 444 + st.lift;
    const a = -st.tilt;
    ctx.save();
    ctx.translate(PX, PY); ctx.rotate(a);
    // glass body + water inside (surface stays horizontal in world space)
    carafePath(ctx);
    ctx.fillStyle = 'rgba(205,220,235,0.06)'; ctx.fill();
    ctx.save();
    carafePath(ctx); ctx.clip();
    const remain = 1 - seg(t, POUR0, POUR1, ease.linear) * 0.78;
    // water surface world y: computed from the remaining volume (approximation)
    ctx.rotate(-a);
    const wy = lerp(-40, 120, 1 - remain) + Math.sin(t * 9) * 1.2;
    const wg = ctx.createLinearGradient(0, wy, 0, wy + 200);
    wg.addColorStop(0, rgba(mixc([175, 200, 225], [240, 205, 160], warm), 0.18));
    wg.addColorStop(1, rgba(mixc([120, 150, 180], [205, 150, 95], warm), 0.30));
    ctx.fillStyle = wg; ctx.fillRect(-300, wy, 600, 400);
    ctx.fillStyle = rgba(light, 0.45); ctx.fillRect(-300, wy - 1, 600, 2.2);
    ctx.rotate(a);
    // internal highlights
    for (const [x, w, al] of [[-56, 9, 0.22], [52, 14, 0.12]]) {
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, rgba(light, 0)); g.addColorStop(0.5, rgba(light, al)); g.addColorStop(1, rgba(light, 0));
      ctx.fillStyle = g; ctx.fillRect(x - w, -110, 2 * w, 260);
    }
    ctx.restore();
    // thumb seen through the glass (behind the body: softened)
    ctx.save();
    thumbPath(ctx); ctx.fillStyle = rgba(skin, 0.45); ctx.fill();
    ctx.restore();
    // glass edges
    carafePath(ctx); ctx.strokeStyle = 'rgba(12,12,16,0.30)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = rgba(light, 0.85); ctx.lineWidth = 1.5; ctx.stroke();
    // hand: back of the hand + fingers across the front
    handPath(ctx); ctx.fillStyle = rgba(skin, 1); ctx.fill();
    for (let i = FINGERS.length - 1; i >= 0; i--) {
      fingerPath(ctx, FINGERS[i]);
      ctx.fillStyle = rgba(skin, 1); ctx.fill();
    }
    // hint of the separations between the fingers (backlight leaking along the upper edges)
    for (let i = 1; i < FINGERS.length; i++) {
      const [y0, r, xt, ang] = FINGERS[i], xb = 74;
      const yt = y0 + Math.tan(ang * Math.PI / 180) * (xt - xb);
      ctx.beginPath();
      ctx.moveTo(xb - 6, y0 - r + 1.5);
      ctx.quadraticCurveTo((xb + xt) / 2, (y0 + yt) / 2 - r + 6, xt + r * 0.55, yt - r * 0.62);
      ctx.strokeStyle = rgba(rim, 0.26); ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke();
    }
    const wrist = [200, 18];
    ctx.restore();
    // forearm: from the wrist (follows the hand) to an off-screen elbow (fixed)
    const w = rot(PX, PY, a, wrist[0], wrist[1]);
    const wa = rot(PX, PY, a, 182, -30), wb = rot(PX, PY, a, 186, 92);
    const E = [2230, 120 + st.lift * 0.4];
    ctx.beginPath();
    ctx.moveTo(wa[0], wa[1]);
    ctx.bezierCurveTo(w[0] + 120, w[1] - 110, E[0] - 260, E[1] - 140, E[0], E[1] - 100);
    ctx.lineTo(E[0], E[1] + 120);
    ctx.bezierCurveTo(E[0] - 280, E[1] + 140, w[0] + 120, w[1] + 120, wb[0], wb[1]);
    ctx.closePath();
    ctx.fillStyle = rgba(skin, 1); ctx.fill();
    // spout tip and direction (world), for the stream
    const tip = rot(PX, PY, a, SPOUT[0], SPOUT[1]);
    const dir = [Math.cos(a) * -1 - Math.sin(a) * -0.25, Math.sin(a) * -1 + Math.cos(a) * -0.25];
    const n = Math.hypot(dir[0], dir[1]);
    return { tip, dir: [dir[0] / n, dir[1] / n] };
  }

  function drawStream(ctx, t, sp, st, light) {
    if (t < POUR0 || t > POUR1 + 0.35) return;
    const surf = lerp(GL.base - 20, GL.base - 168, st.fill);
    const v = 150, g = 2600;
    const pts = [];
    for (let s = 0; s <= 0.6; s += 0.006) {
      const x = sp.tip[0] + sp.dir[0] * v * s, y = sp.tip[1] + sp.dir[1] * v * s + 0.5 * g * s * s;
      pts.push([x, y, s]);
      if (y >= surf) break;
    }
    const last = pts[pts.length - 1];
    st.impactX = last[0];
    const sEnd = last[2];
    const front = clamp((t - POUR0) / 0.16) * sEnd;           // stream front falling at start
    const tail = clamp((t - POUR1) / 0.20) * sEnd;            // tail detaching at the end
    const vis = pts.filter((q) => q[2] >= tail && q[2] <= front);
    if (vis.length < 2) return;
    const wob = (q) => Math.sin(q[2] * 60 - t * 34) * 1.3 + Math.sin(q[2] * 23 + t * 17) * 0.8;
    const line = (w, col) => {
      ctx.beginPath();
      vis.forEach((q, i) => { const x = q[0] + wob(q); if (i) ctx.lineTo(x, q[1]); else ctx.moveTo(x, q[1]); });
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    };
    line(11, rgba(light, 0.12));
    line(6.5, rgba(light, 0.30));
    line(2.4, rgba([255, 252, 246], 0.92));
    // splash at the surface
    if (front >= sEnd * 0.98 && t < POUR1 + 0.1) {
      const R = SK.rng(Math.floor(t * 30) + 11);
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (R() - 0.5) * 2.2, d = 4 + R() * 16, r = 0.8 + R() * 1.8;
        ctx.beginPath(); ctx.arc(last[0] + Math.cos(ang) * d, surf - 2 + Math.sin(ang) * d * 0.6, r, 0, 6.283);
        ctx.fillStyle = rgba(light, 0.75); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(last[0], surf, 16, 4, 0, 0, 6.283);
      ctx.strokeStyle = rgba(light, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function gesture(ctx, t, cam) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    camXform(ctx, cam);
    const warm = cam.warm;
    const light = mixc([214, 228, 245], [255, 228, 186], warm);
    const skin = mixc([30, 26, 26], [44, 26, 16], warm);
    const rim = mixc([150, 170, 200], [255, 170, 100], warm);
    const st = pourState(t);
    st.impactX = GL.cx + 14;
    // stream first (it is behind the near rim of the glass), then glass, then carafe + hand
    const sp = drawCarafePrepass(t, st);
    drawStream(ctx, t, sp, st, light);
    drawTumbler(ctx, t, st, light, warm);
    drawCarafe(ctx, t, st, light, warm, skin, rim);
  }
  // spout position without drawing (needed to draw the stream before the glass)
  function drawCarafePrepass(t, st) {
    const PX = 1198, PY = 444 + st.lift, a = -st.tilt;
    const tip = rot(PX, PY, a, SPOUT[0], SPOUT[1]);
    const dir = [Math.cos(a) * -1 - Math.sin(a) * -0.25, Math.sin(a) * -1 + Math.cos(a) * -0.25];
    const n = Math.hypot(dir[0], dir[1]);
    return { tip, dir: [dir[0] / n, dir[1] / n] };
  }

  // ------------------------------------------------------------------ S7 hero jar
  // pedestal top centre in world px and the jar scale (shared with the shader through FG.HERO)
  const HERO = { cx: 960, topY: 772, scale: 0.555, pedR: 300 };
  function hero(ctx, t, cam, jar) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    camXform(ctx, cam);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const sc = HERO.scale;
    // jar body bottom (1073 units) sits on the pedestal top centre
    const x = HERO.cx - 500 * sc, y = HERO.topY - 1068 * sc;
    jar.draw(ctx, { x, y, scale: sc, rot: cam.rot, light: cam.sheen, forceStrips: true });
    // warm rim light on the left edge of the glass (beam side)
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    const g = ctx.createLinearGradient(222, 0, 262, 0);
    g.addColorStop(0, 'rgba(255,214,160,0.34)'); g.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g; ctx.fillRect(222, 330, 40, 730);
    ctx.restore();
  }

  window.FG = { gesture, hero, HERO, GL, pourState };
})();
