/* Ambrel jar turntable for 2D canvas (classic script -> window.Jar3D, also SK.Jar3D).
 *
 * The jar is rotationally symmetric: glass, lid and highlights do not change when it turns,
 * only the label does. So we draw the front packshot (glass + lid), then re-draw the label
 * area column by column from the unrolled texture brand/png/label-wrap-2x.png mapped on the
 * cylinder (u = (asin(x/R) + rot) / 2pi), then re-apply cylinder shading and speculars.
 *
 *   const imgs = await SK.loadImages({ body: A.assets.jarBody, lid: A.assets.jarLid, label: A.assets.labelWrap });
 *   const jar = new Jar3D(imgs);
 *   jar.draw(ctx, { x: 40, y: 300, scale: 1.0, rot: t * 1.2, lidLift: 0, lidTilt: 0 });
 *
 * Coordinates: (x, y) is where the top-left corner of the 1000x1200 packshot canvas lands,
 * scale = output px per packshot unit (0.5 -> jar about 460 px tall). rot in radians,
 * 0 = front label facing camera, PI = back (composition / ingredients panel... see note).
 * Label texture layout (1748 units wide): front panel centred (u = 0.5), composition panel on the
 * left (u ~ 0.17, reached with rot = -2.1), usage/precautions on the right (u ~ 0.83, rot = +2.1).
 * lidLift: px (packshot units) the lid goes up; lidTilt: degrees; lidAlpha: 0..1.
 * light: 0..1 extra moving highlight position (a soft vertical sheen that sweeps the glass).
 */
(function () {
  'use strict';
  var G = { bx0: 222, bx1: 778, labT: 424, labB: 954, curve: 9, texOffset: 1.8, texH: 530 };
  var R = (G.bx1 - G.bx0) / 2, CX = (G.bx0 + G.bx1) / 2;

  function Jar3D(imgs, opts) {
    this.body = imgs.body; this.lid = imgs.lid; this.label = imgs.label;
    this.k = this.body.naturalWidth / 1000;            // body/lid images are 1000*k wide
    this.tk = this.label.naturalWidth / 1748;          // label texture scale
    this.opts = opts || {};
  }
  // top edge of the label at horizontal offset dx (quadratic curve, same as the SVG)
  function edge(base, dx) { var s = (dx + R) / (2 * R); return base + 4 * G.curve * s * (1 - s); }

  Jar3D.prototype.labelPath = function (ctx) {
    ctx.beginPath();
    ctx.moveTo(G.bx0, G.labT);
    ctx.quadraticCurveTo(CX, G.labT + 2 * G.curve, G.bx1, G.labT);
    ctx.lineTo(G.bx1, G.labB);
    ctx.quadraticCurveTo(CX, G.labB + 2 * G.curve, G.bx0, G.labB);
    ctx.closePath();
  };

  Jar3D.prototype.draw = function (ctx, o) {
    o = o || {};
    var sc = o.scale || 1, rot = o.rot || 0;
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.scale(sc, sc);
    // 1. glass body (front packshot without lid)
    ctx.drawImage(this.body, 0, 0, 1000, 1200);
    // 2. label strips
    if (Math.abs(((rot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) > 1e-4 || o.forceStrips) {
      ctx.save();
      this.labelPath(ctx); ctx.clip();
      ctx.fillStyle = '#F4ECDF'; ctx.fillRect(G.bx0, G.labT, 2 * R, G.labB - G.labT + 2 * G.curve);
      var step = Math.max(0.5, 1 / sc);       // one strip per output pixel
      var TW = this.label.naturalWidth, TH = this.label.naturalHeight, tk = this.tk;
      for (var dx = -R; dx < R; dx += step) {
        var mid = Math.max(-0.99999, Math.min(0.99999, (dx + step / 2) / R));
        var th = Math.asin(mid);
        var u = (((th + rot) / (2 * Math.PI) + 0.5) % 1 + 1) % 1;   // 0.5 = front panel centre
        var dudx = 1748 / (2 * Math.PI) / (R * Math.cos(th));       // texture units per jar unit
        var sw = Math.max(1, dudx * step * tk);
        var sx = u * TW;
        if (sx + sw > TW) sx = TW - sw;
        var top = edge(G.labT, dx) + G.texOffset;
        ctx.drawImage(this.label, sx, 0, sw, TH, CX + dx, top, step + 0.35, G.texH);
      }
      // 3. cylinder shading (same stops as the SVG label gradient)
      var g = ctx.createLinearGradient(G.bx0, 0, G.bx1, 0);
      g.addColorStop(0, 'rgba(58,28,8,.62)'); g.addColorStop(0.1, 'rgba(58,28,8,.2)');
      g.addColorStop(0.26, 'rgba(58,28,8,.03)'); g.addColorStop(0.38, 'rgba(255,255,255,.14)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(58,28,8,.1)');
      g.addColorStop(0.93, 'rgba(58,28,8,.35)'); g.addColorStop(1, 'rgba(58,28,8,.66)');
      ctx.fillStyle = g; ctx.fillRect(G.bx0, G.labT, 2 * R, G.labB - G.labT + 2 * G.curve);
      ctx.restore();
      // speculars over the label (fixed to the light, not to the label)
      this.sheen(ctx, 281, 30, 0.34); this.sheen(ctx, 282.5, 7, 0.45); this.sheen(ctx, 734, 12, 0.16, '255,217,168');
    }
    // 4. moving sheen (light sweep), o.light in 0..1 across the body
    if (o.light !== undefined && o.light > 0 && o.light < 1) {
      ctx.save();
      ctx.beginPath(); ctx.rect(G.bx0, 330, 2 * R, 730); ctx.clip();
      var lx = G.bx0 - 60 + (2 * R + 120) * o.light;
      this.sheen(ctx, lx, 70, 0.35 * Math.sin(Math.PI * o.light));
      ctx.restore();
    }
    // 5. lid
    if (this.lid && o.lid !== false) {
      ctx.save();
      ctx.globalAlpha = o.lidAlpha === undefined ? 1 : o.lidAlpha;
      ctx.translate(500, 220 - (o.lidLift || 0));
      ctx.rotate(((o.lidTilt || 0) * Math.PI) / 180);
      ctx.translate(-500, -220);
      ctx.drawImage(this.lid, 0, 0, 1000, 1200);
      ctx.restore();
    }
    ctx.restore();
  };

  // soft vertical highlight centred at x (jar units), width w
  Jar3D.prototype.sheen = function (ctx, x, w, a, rgb) {
    rgb = rgb || '255,255,255';
    var g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(0.5, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w, G.labT - 40, 2 * w, G.labB - G.labT + 120);
  };

  Jar3D.GEOMETRY = G;
  window.Jar3D = Jar3D;
  if (window.SK) window.SK.Jar3D = Jar3D;
})();
