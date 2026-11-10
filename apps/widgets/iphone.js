// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: heartbeat;

/* Widgets du tracker « Routine & Performance » pour l'écran d'accueil et l'écran verrouillé de l'iPhone.
   À coller dans Scriptable (App Store, gratuit). Le tracker envoie un résumé chiffré à chaque modification ;
   ce script lit le dernier, le déchiffre ici avec ta clé iPhone et dessine le widget.
   Paramètre du widget (appui long › Modifier le widget › Parameter) : score, eau, pas, sobriete, repas,
   sommeil, taches, banque, doit, sport, semaine (petit) ; journee, banque, taches, semaine (moyen). */

const VERSION = '1.0.0';
const SRC = 'https://pierrernrd04-ai.github.io/Vous-/widgets/iphone.js';
const RELAYS = ['https://ntfy.envs.net/', 'https://ntfy.adminforge.de/'];
const KEY_NAME = 'vous-tracker-cle-iphone';
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), 'vous-tracker-widgets.json');

/* ================= déchiffrement (AES-256-GCM, partie compteur) en JavaScript pur ================= */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function unb64(s) {
  const out = [];
  let buf = 0, bits = 0;
  for (const ch of s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('base64');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return new Uint8Array(out);
}
const SBOX = (() => {
  const s = new Uint8Array(256);
  let p = 1, q = 1;
  do {
    p = p ^ ((p << 1) & 255) ^ (p & 128 ? 0x1b : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 128) q ^= 0x09;
    const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    s[p] = (x ^ 0x63) & 255;
  } while (p !== 1);
  s[0] = 0x63;
  return s;
})();
const xt = (b) => ((b << 1) ^ (b & 128 ? 0x1b : 0)) & 255;
function expandKey(k) {
  const w = new Uint8Array(240);
  w.set(k);
  let rcon = 1;
  for (let i = 32; i < 240; i += 4) {
    let t0 = w[i - 4], t1 = w[i - 3], t2 = w[i - 2], t3 = w[i - 1];
    if (i % 32 === 0) {
      const u = t0; t0 = SBOX[t1] ^ rcon; t1 = SBOX[t2]; t2 = SBOX[t3]; t3 = SBOX[u];
      rcon = xt(rcon);
    } else if (i % 32 === 16) { t0 = SBOX[t0]; t1 = SBOX[t1]; t2 = SBOX[t2]; t3 = SBOX[t3]; }
    w[i] = w[i - 32] ^ t0; w[i + 1] = w[i - 31] ^ t1; w[i + 2] = w[i - 30] ^ t2; w[i + 3] = w[i - 29] ^ t3;
  }
  return w;
}
function encryptBlock(w, inp) {
  const s = new Uint8Array(16), t = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = inp[i] ^ w[i];
  for (let r = 1; r <= 14; r++) {
    for (let i = 0; i < 16; i++) t[i] = SBOX[s[(i + 4 * (i % 4)) % 16]]; // SubBytes + ShiftRows
    if (r < 14) {
      for (let c = 0; c < 16; c += 4) {
        const a0 = t[c], a1 = t[c + 1], a2 = t[c + 2], a3 = t[c + 3], x = a0 ^ a1 ^ a2 ^ a3;
        s[c] = a0 ^ x ^ xt(a0 ^ a1); s[c + 1] = a1 ^ x ^ xt(a1 ^ a2); s[c + 2] = a2 ^ x ^ xt(a2 ^ a3); s[c + 3] = a3 ^ x ^ xt(a3 ^ a0);
      }
    } else s.set(t);
    for (let i = 0; i < 16; i++) s[i] ^= w[16 * r + i];
  }
  return s;
}
function utf8(b) {
  let out = '', i = 0;
  while (i < b.length) {
    const c = b[i++];
    if (c < 128) out += String.fromCharCode(c);
    else if (c < 224) out += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
    else if (c < 240) out += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else {
      const cp = (((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    }
  }
  return out;
}
/* message : [1][0 = non compressé][iv 12 octets][texte chiffré][étiquette 16 octets] ; compteur GCM = iv || 2, 3, … */
function openMsg(key, u8) {
  if (u8[0] !== 1 || u8[1] !== 0) throw new Error('format');
  const w = expandKey(key), ctr = new Uint8Array(16), ct = u8.subarray(14, u8.length - 16), out = new Uint8Array(ct.length);
  ctr.set(u8.subarray(2, 14));
  for (let o = 0, n = 2; o < ct.length; o += 16, n++) {
    ctr[12] = (n >>> 24) & 255; ctr[13] = (n >>> 16) & 255; ctr[14] = (n >>> 8) & 255; ctr[15] = n & 255;
    const ks = encryptBlock(w, ctr);
    for (let i = 0; i < 16 && o + i < ct.length; i++) out[o + i] = ct[o + i] ^ ks[i];
  }
  return JSON.parse(utf8(out));
}
function parseKey(s) {
  const m = /^VW1\.([\w-]{43})\.([0-9a-f]{24})$/.exec(String(s || '').trim());
  if (!m) return null;
  const key = unb64(m[1]);
  return key.length === 32 ? { key, topic: 'vous-' + m[2] + '-w', raw: m[0] } : null;
}

/* ================= données ================= */
function readCache() { try { return fm.fileExists(CACHE) ? JSON.parse(fm.readString(CACHE)) : null; } catch (e) { return null; } }
function writeCache(c) { try { fm.writeString(CACHE, JSON.stringify(c)); } catch (e) {} }
async function fetchSum(k) {
  let best = null, reached = 0;
  for (const relay of RELAYS) {
    try {
      const req = new Request(relay + k.topic + '/json?poll=1&since=latest');
      req.timeoutInterval = 8;
      const lines = (await req.loadString()).split('\n').filter(Boolean);
      reached++;
      for (const l of lines) {
        const m = JSON.parse(l), x = /^v1:[0-9A-Z]{6,16}:0\/1:([\w-]+)$/.exec(m.message || '');
        if (m.event !== 'message' || !x) continue;
        const obj = openMsg(k.key, unb64(x[1]));
        if (obj && obj.v === 1 && obj.sum && (!best || (obj.sum.dt || 0) > (best.dt || 0) || ((obj.sum.dt || 0) === (best.dt || 0) && obj.sum.at > best.at))) best = obj.sum;
      }
    } catch (e) { /* relais suivant */ }
  }
  return { sum: best, reached };
}
async function load(k) {
  const cache = readCache();
  const r = await fetchSum(k);
  let sum = cache && cache.sum, fresh = false;
  if (r.sum && (!sum || (r.sum.dt || 0) > (sum.dt || 0) || ((r.sum.dt || 0) === (sum.dt || 0) && r.sum.at >= sum.at))) { sum = r.sum; fresh = true; }
  if (fresh) writeCache({ sum, saved: Date.now() });
  return { sum, online: r.reached > 0 };
}

/* ================= formats ================= */
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const dayId = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function n0(v) { v = Math.round(v || 0); try { return v.toLocaleString('fr-FR'); } catch (e) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); } }
function n1(v) { try { return (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 }); } catch (e) { return String(Math.round((v || 0) * 10) / 10).replace('.', ','); } }
function eur(c, dec) { const v = (c || 0) / 100; try { return v.toLocaleString('fr-FR', { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) + ' €'; } catch (e) { return (dec ? v.toFixed(2).replace('.', ',') : String(Math.round(v))) + ' €'; } }
const plural = (n, w) => w + (n > 1 ? 's' : '');
const CATN = { courses: 'Courses', logement: 'Logement', transport: 'Transport', sorties: 'Sorties', shopping: 'Shopping', abonnements: 'Abonnements', sante: 'Santé', autres: 'Autres' };
const MOOD = ['très basse', 'basse', 'neutre', 'bonne', 'excellente'], SLEEPQ = ['Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'];
const DAYL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/* ce que les widgets affichent, avec les mêmes règles que la page des widgets du PC */
function view(s) {
  const T = dayId(new Date()), fresh = !!s && s.date === T, z = fresh ? s : null;
  const wg = (s && s.waterGoal) || 8, kg = (s && s.kcalGoal) || 2200, sg = (s && s.stepsGoal) || 10000;
  let sober = s ? s.sober || 0 : 0;
  if (s && !fresh && s.beer === 0) sober += 1;
  const f = s && s.fox, sameMonth = !!s && s.date.slice(0, 7) === T.slice(0, 7);
  return {
    has: !!s, fresh, T,
    score: z ? z.score : 0, act: z ? z.act || 0 : 0, kcal: z ? z.kcal : 0, kg, water: z ? z.water : 0, wg,
    steps: z ? z.steps : 0, sg, km: z ? z.km : 0, p: z ? z.p : 0, g: z ? z.g : 0, l: z ? z.l : 0, meals: z ? z.meals : 0,
    diff: z ? z.diff : 0, sleep: z ? z.sleep : null, sq: z ? z.sq : null, mood: z ? z.mood : null, energy: z ? z.energy : 0,
    beer: z ? z.beer : null, sober, saved: s ? s.saved || 0 : 0,
    tasks: z ? z.tasks : { open: 0, done: 0, total: 0, list: [] },
    fox: f ? { bal: f.bal, set: f.set, spent: sameMonth ? f.spent : 0, budget: f.budget, today: fresh ? f.today : 0, top: sameMonth ? f.top || [] : [] } : null,
    doit: z ? z.doit : { kcal: 0, min: 0, cyc: 0, goal: (s && s.doit && s.doit.goal) || 300 },
    swim: z ? z.swim : 0, gym: z ? z.gym : null, week: (s && s.week) || [], at: s ? s.at : null,
    quote: s && s.quotes && s.quotes.length ? s.quotes[new Date().getHours() % s.quotes.length] : null,
  };
}

/* ================= dessin ================= */
const C = (hex, a) => new Color(hex, a == null ? 1 : a);
const WHITE = C('#FFFFFF'), MUTED = C('#FFFFFF', 0.62), FAINT = C('#FFFFFF', 0.38);
const MOVE = '#FF2D6F', EAT = '#A3FF3C', DRINK = '#2EE6FF';
const THEMES = {
  score: ['#2A1E6E', '#0C0E24'], eau: ['#0E5A9C', '#071A3A'], pas: ['#7A3A12', '#1C0F0A'], sobriete: ['#43238A', '#120B2A'],
  repas: ['#2C5E12', '#0B1A07'], banque: ['#7A3209', '#160C0A'], doit: ['#08285C', '#040B1C'], sommeil: ['#1F3080', '#0A0F26'],
  taches: ['#6A4A0C', '#16100A'], sport: ['#0E5A44', '#06180F'], semaine: ['#123E6E', '#0A1024'],
};
function bg(w, key) {
  if (key === 'eau') return; // son fond est l'image de la vague
  const t = THEMES[key] || THEMES.score, g = new LinearGradient();
  g.colors = [C(t[0]), C(t[1])]; g.locations = [0, 1];
  g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
}
function sym(name, size, color) {
  try {
    const s = SFSymbol.named(name);
    if (!s) return null;
    s.applyFont(Font.semiboldSystemFont(size));
    return { img: s.image, size, color };
  } catch (e) { return null; }
}
function addSym(stack, name, size, color) {
  const s = sym(name, size, color);
  if (!s) return null;
  const i = stack.addImage(s.img);
  i.imageSize = new Size(size, size); i.tintColor = color;
  return i;
}
function txt(stack, text, font, color, opts) {
  const t = stack.addText(String(text));
  t.font = font; t.textColor = color || WHITE;
  if (opts && opts.lines) t.lineLimit = opts.lines;
  if (opts && opts.min) t.minimumScaleFactor = opts.min;
  return t;
}
function label(stack, icon, text, color) {
  const r = stack.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = 4;
  addSym(r, icon, 12, color);
  txt(r, text, Font.semiboldSystemFont(12), color, { lines: 1, min: 0.8 });
  return r;
}
function bigValue(stack, value, unit, size, color) {
  const r = stack.addStack(); r.layoutHorizontally(); r.bottomAlignContent(); r.spacing = 3;
  txt(r, value, Font.boldRoundedSystemFont(size), color || WHITE, { lines: 1, min: 0.5 });
  if (unit) txt(r, unit, Font.semiboldRoundedSystemFont(Math.round(size * 0.42)), MUTED, { lines: 1 });
  return r;
}
/* arc d'anneau : tracé en petits segments (Scriptable n'a pas d'arc), bouts arrondis */
function arc(dc, cx, cy, r, w, p, color) {
  p = clamp(p, 0, 1);
  if (p <= 0) return;
  const a0 = -Math.PI / 2, steps = Math.max(2, Math.ceil(120 * p)), path = new Path();
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (2 * Math.PI * p * i) / steps, pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
    if (i === 0) path.move(pt); else path.addLine(pt);
  }
  dc.addPath(path); dc.setStrokeColor(color); dc.setLineWidth(w); dc.strokePath();
  dc.setFillColor(color);
  const a1 = a0 + 2 * Math.PI * p;
  dc.fillEllipse(new Rect(cx - w / 2, cy - r - w / 2, w, w));
  dc.fillEllipse(new Rect(cx + r * Math.cos(a1) - w / 2, cy + r * Math.sin(a1) - w / 2, w, w));
}
function rings(v, size, mono) {
  const dc = new DrawContext(); dc.size = new Size(size, size); dc.opaque = false; dc.respectScreenScale = true;
  const cx = size / 2, w = size * 0.1, gap = size * 0.115, list = [[MOVE, v.act / 450], [EAT, v.kcal / v.kg], [DRINK, v.water / v.wg]];
  list.forEach(([col, p], i) => {
    const r = size / 2 - w / 2 - i * gap;
    dc.setStrokeColor(mono ? C('#FFFFFF', 0.22) : C(col, 0.2)); dc.setLineWidth(w);
    dc.strokeEllipse(new Rect(cx - r, cx - r, 2 * r, 2 * r));
    arc(dc, cx, cx, r, w, p, mono ? C('#FFFFFF') : C(col));
  });
  dc.setFont(Font.boldRoundedSystemFont(size * 0.2)); dc.setTextColor(WHITE); dc.setTextAlignedCenter();
  dc.drawTextInRect(String(v.score), new Rect(0, size / 2 - size * 0.14, size, size * 0.28));
  return dc.getImage();
}
function gauge(p, size, color, center, sub) {
  const dc = new DrawContext(); dc.size = new Size(size, size); dc.opaque = false; dc.respectScreenScale = true;
  const w = size * 0.11, r = size / 2 - w / 2 - 1;
  dc.setStrokeColor(C(color, 0.25)); dc.setLineWidth(w); dc.strokeEllipse(new Rect(size / 2 - r, size / 2 - r, 2 * r, 2 * r));
  arc(dc, size / 2, size / 2, r, w, p, C(color));
  dc.setTextColor(WHITE); dc.setTextAlignedCenter();
  dc.setFont(Font.boldRoundedSystemFont(size * (sub ? 0.27 : 0.3)));
  dc.drawTextInRect(center, new Rect(0, size / 2 - size * (sub ? 0.22 : 0.18), size, size * 0.36));
  if (sub) { dc.setFont(Font.semiboldSystemFont(size * 0.13)); dc.setTextColor(C('#FFFFFF', 0.7)); dc.drawTextInRect(sub, new Rect(0, size / 2 + size * 0.1, size, size * 0.2)); }
  return dc.getImage();
}
function bar(p, width, height, color) {
  const dc = new DrawContext(); dc.size = new Size(width, height); dc.opaque = false; dc.respectScreenScale = true;
  const r = height / 2, track = new Path();
  track.addRoundedRect(new Rect(0, 0, width, height), r, r);
  dc.addPath(track); dc.setFillColor(C('#FFFFFF', 0.16)); dc.fillPath();
  const wv = Math.max(p > 0 ? height : 0, width * clamp(p, 0, 1));
  if (wv > 0) { const f = new Path(); f.addRoundedRect(new Rect(0, 0, wv, height), r, r); dc.addPath(f); dc.setFillColor(C(color)); dc.fillPath(); }
  return dc.getImage();
}
function addBar(stack, p, width, height, color) { const i = stack.addImage(bar(p, width, height, color)); i.imageSize = new Size(width, height); return i; }
function weekBars(week, today, width, height, color) {
  const dc = new DrawContext(); dc.size = new Size(width, height); dc.opaque = false; dc.respectScreenScale = true;
  const n = Math.max(1, week.length), gap = width * 0.05, bw = (width - gap * (n - 1)) / n, lab = 13, hMax = height - lab - 2;
  dc.setFont(Font.semiboldSystemFont(10)); dc.setTextAlignedCenter();
  week.forEach((x, i) => {
    const h = Math.max(4, hMax * clamp(x[1] / 100, 0, 1)), px = i * (bw + gap), isT = x[0] === today, p = new Path();
    p.addRoundedRect(new Rect(px, hMax - h, bw, h), Math.min(5, bw / 2), Math.min(5, bw / 2));
    dc.addPath(p); dc.setFillColor(isT ? C(color) : x[1] > 0 ? C(color, 0.45) : C('#FFFFFF', 0.14)); dc.fillPath();
    const d = new Date(x[0] + 'T12:00:00');
    dc.setTextColor(isT ? WHITE : C('#FFFFFF', 0.45));
    dc.drawTextInRect(DAYL[d.getDay()], new Rect(px - 4, hMax + 2, bw + 8, lab));
  });
  return dc.getImage();
}
/* fond « eau » : une vague à la hauteur des verres bus */
function waterImage(p, width, height) {
  const dc = new DrawContext(); dc.size = new Size(width, height); dc.opaque = true; dc.respectScreenScale = true;
  const top = [14, 90, 156], bot = [7, 26, 58], bands = 48; // dégradé du thème « eau », en bandes fines
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1), c = top.map((t, j) => Math.round(t + (bot[j] - t) * k));
    dc.setFillColor(new Color('#' + c.map((x) => (x < 16 ? '0' : '') + x.toString(16)).join('')));
    dc.fillRect(new Rect(0, (height * i) / bands, width, height / bands + 1));
  }
  const level = height * (1 - clamp(p, 0, 1)), amp = Math.min(8, height * 0.035), seg = width / 4;
  const draw = (shift, color) => {
    const path = new Path();
    path.move(new Point(0, level));
    for (let i = 0; i < 4; i++) path.addQuadCurve(new Point((i + 1) * seg, level), new Point(i * seg + seg / 2, level + ((i + shift) % 2 ? amp : -amp)));
    path.addLine(new Point(width, height)); path.addLine(new Point(0, height)); path.closeSubpath();
    dc.addPath(path); dc.setFillColor(color); dc.fillPath();
  };
  if (p > 0) { draw(1, C('#2EE6FF', 0.3)); draw(0, C('#3B82F6', 0.5)); }
  return dc.getImage();
}
function updated(stack, v) {
  const r = stack.addStack(); r.layoutHorizontally(); r.centerAlignContent();
  if (!v.has) { txt(r, 'En attente du tracker', Font.mediumSystemFont(10), FAINT, { lines: 1 }); return; }
  if (!v.fresh) { txt(r, 'Nouvelle journée', Font.mediumSystemFont(10), FAINT, { lines: 1 }); return; }
  r.spacing = 3;
  txt(r, 'il y a', Font.mediumSystemFont(10), FAINT);
  const d = r.addDate(new Date(v.at)); d.applyRelativeStyle(); d.font = Font.mediumSystemFont(10); d.textColor = FAINT; d.lineLimit = 1;
}

/* ---------- petits widgets ---------- */
function small(w, v, p) {
  w.setPadding(14, 14, 12, 14);
  const key = { eau: 'eau', pas: 'pas', sobriete: 'sobriete', repas: 'repas', sommeil: 'sommeil', taches: 'taches', banque: 'banque', doit: 'doit', sport: 'sport', semaine: 'semaine' }[p] || 'score';
  bg(w, key);
  if (key === 'score') {
    label(w, 'heart.fill', 'Score du jour', C('#FF8BB0'));
    w.addSpacer(6);
    const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 10;
    const im = row.addImage(rings(v, 150)); im.imageSize = new Size(70, 70);
    const col = row.addStack(); col.layoutVertically(); col.spacing = 3;
    [[MOVE, n0(v.act), 'kcal'], [EAT, n0(v.kcal), 'kcal'], [DRINK, v.water + '/' + v.wg, 'eau']].forEach(([c, a, b]) => {
      const r = col.addStack(); r.layoutVertically();
      txt(r, a, Font.boldRoundedSystemFont(14), C(c), { lines: 1, min: 0.6 });
      txt(r, b, Font.mediumSystemFont(9), MUTED, { lines: 1 });
    });
    w.addSpacer();
  } else if (key === 'eau') {
    w.backgroundImage = waterImage(v.water / v.wg, 340, 340);
    label(w, 'drop.fill', 'Hydratation', C(DRINK));
    w.addSpacer(6);
    bigValue(w, String(v.water), '/ ' + v.wg, 40);
    w.addSpacer();
    txt(w, v.water >= v.wg ? 'Objectif atteint' : 'Encore ' + (v.wg - v.water) + ' ' + plural(v.wg - v.water, 'verre'), Font.semiboldSystemFont(12), WHITE, { lines: 1 });
  } else if (key === 'pas') {
    label(w, 'figure.walk', 'Pas', C('#FFB36B'));
    w.addSpacer(4);
    bigValue(w, n0(v.steps), '', 30);
    txt(w, n1(v.km) + ' km · ' + Math.round(clamp(v.steps / v.sg, 0, 9.99) * 100) + ' % de ' + n0(v.sg), Font.mediumSystemFont(11), MUTED, { lines: 1, min: 0.7 });
    w.addSpacer();
    addBar(w, v.steps / v.sg, 130, 7, '#FF8A3D');
    w.addSpacer(6);
  } else if (key === 'sobriete') {
    label(w, 'shield.fill', 'Sans alcool', C('#C4B5FD'));
    w.addSpacer(4);
    bigValue(w, String(v.sober), plural(v.sober, 'jour'), 40);
    w.addSpacer();
    txt(w, v.beer > 0 ? "Aujourd'hui : " + v.beer + ' ' + plural(v.beer, 'bouteille') : v.saved > 0 ? '≈ ' + eur(v.saved * 100) + ' économisés ce mois' : "Un jour après l'autre", Font.semiboldSystemFont(11), WHITE, { lines: 2, min: 0.8 });
  } else if (key === 'repas') {
    label(w, 'fork.knife', 'Repas', C(EAT));
    w.addSpacer(4);
    bigValue(w, n0(v.kcal), 'kcal', 27);
    txt(w, 'sur ' + n0(v.kg), Font.mediumSystemFont(11), MUTED, { lines: 1 });
    w.addSpacer();
    addBar(w, v.kcal / v.kg, 130, 7, EAT);
    w.addSpacer(5);
    const mac = w.addStack(); mac.layoutHorizontally(); mac.spacing = 7;
    [['P', v.p, '#FF8BB0'], ['G', v.g, '#FFD166'], ['L', v.l, '#7DD3FC']].forEach(([l, g, c]) => {
      const r = mac.addStack(); r.layoutHorizontally(); r.spacing = 2;
      txt(r, l, Font.boldSystemFont(10), C(c)); txt(r, n0(g) + ' g', Font.semiboldSystemFont(10), WHITE, { lines: 1 });
    });
    w.addSpacer(5);
  } else if (key === 'sommeil') {
    label(w, 'moon.fill', 'Sommeil', C('#A5B8FF'));
    w.addSpacer(4);
    bigValue(w, v.sleep != null ? n1(v.sleep) : '—', 'h', 36);
    txt(w, v.sq ? SLEEPQ[v.sq - 1] + ' sommeil' : 'À noter dans le tracker', Font.mediumSystemFont(11), MUTED, { lines: 1, min: 0.8 });
    w.addSpacer();
    txt(w, v.mood ? 'Humeur ' + MOOD[v.mood - 1] : 'Humeur à noter', Font.semiboldSystemFont(12), WHITE, { lines: 1 });
    const e = w.addStack(); e.layoutHorizontally(); e.spacing = 3;
    for (let i = 0; i < 5; i++) txt(e, '●', Font.systemFont(9), i < (v.energy || 0) ? C('#FFD166') : FAINT);
  } else if (key === 'taches') {
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    label(top, 'checklist', 'Tâches', C('#FFC56B')); top.addSpacer();
    txt(top, String(v.tasks.open), Font.boldRoundedSystemFont(22), C('#FFB340'));
    w.addSpacer(6);
    const list = (v.tasks.list || []).slice(0, 3);
    if (!list.length) txt(w, v.has ? 'Tout est fait. Bravo !' : 'Tes tâches arrivent…', Font.semiboldSystemFont(12), WHITE, { lines: 2 });
    list.forEach((x) => {
      const r = w.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = 5;
      txt(r, '○', Font.boldSystemFont(11), x[2] ? C('#FF5C7A') : x[3] ? C('#C4B5FD') : C('#FFB340'));
      txt(r, x[0], Font.mediumSystemFont(11), WHITE, { lines: 1 });
      w.addSpacer(3);
    });
    w.addSpacer();
  } else if (key === 'banque') {
    label(w, 'eurosign.circle.fill', 'Fox Bank', C('#FF9A4D'));
    w.addSpacer(8);
    txt(w, 'Solde', Font.mediumSystemFont(10), MUTED);
    txt(w, v.fox ? eur(v.fox.bal, true) : '—', Font.boldRoundedSystemFont(26), WHITE, { lines: 1, min: 0.45 });
    w.addSpacer();
    if (v.fox) {
      txt(w, 'Dépensé ' + eur(v.fox.spent) + ' / ' + eur(v.fox.budget), Font.mediumSystemFont(10), MUTED, { lines: 1, min: 0.7 });
      w.addSpacer(4);
      addBar(w, v.fox.budget ? v.fox.spent / v.fox.budget : 0, 130, 6, v.fox.spent > v.fox.budget ? '#FF5C7A' : '#FF8A3D');
    } else txt(w, "Ouvre l'onglet Banque", Font.mediumSystemFont(10), MUTED, { lines: 1 });
  } else if (key === 'doit') {
    label(w, 'bolt.fill', 'Do It Sport', C('#5EF0FF'));
    w.addSpacer(4);
    const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 8;
    const col = row.addStack(); col.layoutVertically();
    bigValue(col, n0(v.doit.kcal), 'kcal', 28);
    txt(col, v.doit.min ? v.doit.min + ' min · ' + v.doit.cyc + ' ' + plural(v.doit.cyc, 'cycle') : 'Pas de séance', Font.mediumSystemFont(10), MUTED, { lines: 2 });
    w.addSpacer();
    const g = w.addStack(); g.layoutHorizontally(); g.addSpacer();
    const im = g.addImage(gauge(v.doit.kcal / (v.doit.goal || 300), 120, '#5EF0FF', Math.round(clamp(v.doit.kcal / (v.doit.goal || 300), 0, 9.99) * 100) + '%'));
    im.imageSize = new Size(54, 54);
  } else if (key === 'sport') {
    label(w, 'figure.strengthtraining.traditional', 'Sport du jour', C('#34D399'));
    w.addSpacer(4);
    bigValue(w, n0(v.act), 'kcal', 28);
    w.addSpacer();
    [['Natation', v.swim ? v.swim + ' min' : '—'], ['Salle', v.gym ? v.gym[0] + ' min' : '—'], ['Do It', v.doit.kcal ? n0(v.doit.kcal) + ' kcal' : '—']].forEach(([a, b]) => {
      const r = w.addStack(); r.layoutHorizontally();
      txt(r, a, Font.mediumSystemFont(11), MUTED); r.addSpacer(); txt(r, b, Font.boldSystemFont(11), WHITE);
      w.addSpacer(2);
    });
  } else if (key === 'semaine') {
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    label(top, 'chart.bar.fill', '7 jours', C('#7DD3FC')); top.addSpacer();
    const has = v.week.filter((x) => x[1] > 0);
    txt(top, has.length ? String(Math.round(has.reduce((a, x) => a + x[1], 0) / has.length)) : '—', Font.boldRoundedSystemFont(20), WHITE);
    w.addSpacer(8);
    const im = w.addImage(weekBars(v.week, v.T, 260, 170, DRINK)); im.imageSize = new Size(130, 85);
    w.addSpacer();
  }
  if (key !== 'banque' && key !== 'doit') updated(w, v);
}

/* ---------- widgets moyens ---------- */
function tile(stack, icon, color, value, unit, name, width) {
  const t = stack.addStack(); t.layoutVertically(); t.spacing = 1; t.size = new Size(width || 84, 0);
  const r = t.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = 4;
  addSym(r, icon, 11, C(color)); txt(r, name, Font.semiboldSystemFont(10), MUTED, { lines: 1 });
  const v2 = t.addStack(); v2.layoutHorizontally(); v2.bottomAlignContent(); v2.spacing = 2;
  txt(v2, value, Font.boldRoundedSystemFont(19), WHITE, { lines: 1, min: 0.6 });
  if (unit) txt(v2, unit, Font.semiboldRoundedSystemFont(10), MUTED, { lines: 1 });
}
function medium(w, v, p) {
  w.setPadding(14, 16, 12, 16);
  if (p === 'banque') {
    bg(w, 'banque');
    const row = w.addStack(); row.layoutHorizontally(); row.spacing = 14;
    const left = row.addStack(); left.layoutVertically();
    label(left, 'eurosign.circle.fill', 'Fox Bank', C('#FF9A4D'));
    left.addSpacer(10);
    txt(left, 'Solde', Font.mediumSystemFont(11), MUTED);
    txt(left, v.fox ? eur(v.fox.bal, true) : '—', Font.boldRoundedSystemFont(30), WHITE, { lines: 1, min: 0.5 });
    left.addSpacer();
    txt(left, v.fox && v.fox.today ? "Aujourd'hui : −" + eur(v.fox.today, true) : v.fox && !v.fox.set ? 'Renseigne ton solde dans Banque' : ' ', Font.mediumSystemFont(11), MUTED, { lines: 1, min: 0.7 });
    const right = row.addStack(); right.layoutVertically(); right.size = new Size(130, 0);
    txt(right, 'Dépensé ce mois', Font.mediumSystemFont(10), MUTED);
    txt(right, v.fox ? eur(v.fox.spent) : '—', Font.boldRoundedSystemFont(18), WHITE, { lines: 1 });
    right.addSpacer(4);
    if (v.fox) {
      addBar(right, v.fox.budget ? v.fox.spent / v.fox.budget : 0, 130, 6, v.fox.spent > v.fox.budget ? '#FF5C7A' : '#FF8A3D');
      right.addSpacer(5);
      txt(right, 'Reste ' + eur(Math.max(0, v.fox.budget - v.fox.spent)) + ' sur ' + eur(v.fox.budget), Font.mediumSystemFont(9), FAINT, { lines: 1, min: 0.7 });
      right.addSpacer(6);
      v.fox.top.slice(0, 3).forEach((x) => {
        const r = right.addStack(); r.layoutHorizontally();
        txt(r, CATN[x[0]] || 'Autres', Font.mediumSystemFont(10), MUTED, { lines: 1 }); r.addSpacer(); txt(r, eur(x[1]), Font.semiboldSystemFont(10), WHITE);
      });
    }
    right.addSpacer();
    return;
  }
  if (p === 'taches') {
    bg(w, 'taches');
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    label(top, 'checklist', 'Tâches du jour', C('#FFC56B')); top.addSpacer();
    txt(top, v.tasks.total ? v.tasks.done + '/' + v.tasks.total + ' faites' : '', Font.semiboldSystemFont(11), MUTED);
    w.addSpacer(6);
    const list = (v.tasks.list || []).slice(0, 4);
    if (!list.length) txt(w, v.has ? 'Tout est fait. Bravo !' : 'Tes tâches arrivent…', Font.semiboldSystemFont(13), WHITE);
    list.forEach((x) => {
      const r = w.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = 7;
      txt(r, '○', Font.boldSystemFont(13), x[2] ? C('#FF5C7A') : x[3] ? C('#C4B5FD') : C('#FFB340'));
      txt(r, x[0], Font.mediumSystemFont(13), WHITE, { lines: 1 }); r.addSpacer();
      if (x[1] || x[2]) txt(r, x[1] || 'en retard', Font.semiboldSystemFont(11), x[2] && !x[1] ? C('#FF5C7A') : MUTED);
      w.addSpacer(4);
    });
    w.addSpacer();
    addBar(w, v.tasks.total ? v.tasks.done / v.tasks.total : 0, 300, 5, '#FFB340');
    return;
  }
  if (p === 'semaine') {
    bg(w, 'semaine');
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    label(top, 'chart.bar.fill', 'Score des 7 derniers jours', C('#7DD3FC')); top.addSpacer();
    const has = v.week.filter((x) => x[1] > 0);
    txt(top, has.length ? 'moyenne ' + Math.round(has.reduce((a, x) => a + x[1], 0) / has.length) : '', Font.semiboldSystemFont(11), MUTED);
    w.addSpacer(8);
    const im = w.addImage(weekBars(v.week, v.T, 600, 200, DRINK)); im.imageSize = new Size(300, 100);
    w.addSpacer();
    updated(w, v);
    return;
  }
  // « journee » : anneaux + 4 tuiles
  bg(w, 'score');
  const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 14;
  const left = row.addStack(); left.layoutVertically(); left.centerAlignContent();
  const im = left.addImage(rings(v, 220)); im.imageSize = new Size(106, 106);
  const right = row.addStack(); right.layoutVertically(); right.spacing = 8;
  const hd = right.addStack(); hd.layoutHorizontally(); hd.centerAlignContent();
  txt(hd, v.fresh ? (v.score >= 80 ? 'Journée au top' : v.score >= 50 ? 'Belle lancée' : 'On continue') : 'Nouvelle journée', Font.boldSystemFont(14), WHITE, { lines: 1 });
  const r1 = right.addStack(); r1.layoutHorizontally(); r1.spacing = 8;
  tile(r1, 'figure.walk', '#FFB36B', n0(v.steps), '', 'Pas');
  tile(r1, 'drop.fill', DRINK, v.water + '/' + v.wg, '', 'Eau');
  const r2 = right.addStack(); r2.layoutHorizontally(); r2.spacing = 8;
  tile(r2, 'fork.knife', EAT, n0(v.kcal), 'kcal', 'Repas');
  tile(r2, 'shield.fill', '#C4B5FD', String(v.sober), plural(v.sober, 'jour'), 'Sans alcool');
  updated(right, v);
}

/* ---------- grand widget : toute la journée ---------- */
function large(w, v) {
  w.setPadding(16, 16, 14, 16);
  bg(w, 'score');
  const now = new Date(), h = now.getHours();
  const hd = w.addStack(); hd.layoutHorizontally(); hd.centerAlignContent();
  const hl = hd.addStack(); hl.layoutVertically();
  txt(hl, (h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir') + ', Pierre', Font.boldSystemFont(17), WHITE);
  let ds = ''; try { ds = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) {}
  txt(hl, ds ? ds.charAt(0).toUpperCase() + ds.slice(1) : '', Font.mediumSystemFont(11), MUTED);
  hd.addSpacer(); updated(hd, v);
  w.addSpacer(10);
  const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 14;
  const im = row.addImage(rings(v, 210)); im.imageSize = new Size(100, 100);
  const leg = row.addStack(); leg.layoutVertically(); leg.spacing = 5;
  [[MOVE, 'BOUGER', n0(v.act), 'kcal'], [EAT, 'MANGER', n0(v.kcal), '/ ' + n0(v.kg)], [DRINK, 'BOIRE', String(v.water), '/ ' + v.wg + ' verres']].forEach(([c, a, b, u]) => {
    const r = leg.addStack(); r.layoutVertically();
    txt(r, a, Font.boldSystemFont(9), C(c));
    const vv = r.addStack(); vv.layoutHorizontally(); vv.bottomAlignContent(); vv.spacing = 3;
    txt(vv, b, Font.boldRoundedSystemFont(17), WHITE); txt(vv, u, Font.semiboldSystemFont(10), MUTED);
  });
  w.addSpacer(10);
  const g1 = w.addStack(); g1.layoutHorizontally(); g1.spacing = 6;
  tile(g1, 'figure.walk', '#FFB36B', n0(v.steps), '', 'Pas', 72);
  tile(g1, 'shield.fill', '#C4B5FD', String(v.sober), 'j', 'Sobriété', 72);
  tile(g1, 'moon.fill', '#A5B8FF', v.sleep != null ? n1(v.sleep) : '—', 'h', 'Sommeil', 72);
  tile(g1, 'bolt.fill', '#5EF0FF', n0(v.doit.kcal), 'kcal', 'Do It', 72);
  w.addSpacer(10);
  const tk = w.addStack(); tk.layoutHorizontally(); tk.centerAlignContent();
  label(tk, 'checklist', 'Tâches', C('#FFC56B')); tk.addSpacer();
  txt(tk, v.tasks.open + ' ' + plural(v.tasks.open, 'restante'), Font.semiboldSystemFont(11), MUTED);
  w.addSpacer(4);
  const list = (v.tasks.list || []).slice(0, 3);
  if (!list.length) txt(w, v.has ? 'Tout est fait. Bravo !' : 'Tes tâches arrivent…', Font.mediumSystemFont(12), WHITE);
  list.forEach((x) => {
    const r = w.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = 6;
    txt(r, '○', Font.boldSystemFont(12), x[2] ? C('#FF5C7A') : x[3] ? C('#C4B5FD') : C('#FFB340'));
    txt(r, x[0], Font.mediumSystemFont(12), WHITE, { lines: 1 }); r.addSpacer();
    if (x[1]) txt(r, x[1], Font.semiboldSystemFont(10), MUTED);
    w.addSpacer(2);
  });
  w.addSpacer();
  const ft = w.addStack(); ft.layoutHorizontally(); ft.bottomAlignContent(); ft.spacing = 12;
  const fb = ft.addStack(); fb.layoutVertically(); fb.spacing = 2;
  label(fb, 'eurosign.circle.fill', 'Fox Bank', C('#FF9A4D'));
  txt(fb, v.fox ? eur(v.fox.bal, true) : '—', Font.boldRoundedSystemFont(18), WHITE, { lines: 1, min: 0.6 });
  if (v.fox) txt(fb, 'Dépensé ' + eur(v.fox.spent) + ' / ' + eur(v.fox.budget), Font.mediumSystemFont(9), MUTED, { lines: 1, min: 0.7 });
  ft.addSpacer();
  const wk = ft.addImage(weekBars(v.week, v.T, 300, 120, DRINK)); wk.imageSize = new Size(150, 60);
}

/* ---------- écran verrouillé ---------- */
function lock(w, v, fam, p) {
  if (fam === 'accessoryCircular') {
    const im = p === 'eau' ? gauge(v.water / v.wg, 120, '#FFFFFF', String(v.water), '/' + v.wg)
      : p === 'pas' ? gauge(v.steps / v.sg, 120, '#FFFFFF', v.steps >= 1000 ? n1(v.steps / 1000) + 'k' : String(v.steps), 'pas')
      : p === 'sobriete' ? gauge(1, 120, '#FFFFFF', String(v.sober), 'jours')
      : rings(v, 120, true);
    const i = w.addImage(im); i.imageSize = new Size(60, 60);
    return;
  }
  if (fam === 'accessoryInline') {
    txt(w, `Score ${v.score} · ${v.water}/${v.wg} verres · ${v.sober} j sans alcool`, Font.semiboldSystemFont(12), WHITE, { lines: 1 });
    return;
  }
  // rectangulaire : trois lignes
  const r0 = w.addStack(); r0.layoutHorizontally(); r0.centerAlignContent(); r0.spacing = 4;
  addSym(r0, 'heart.fill', 11, WHITE); txt(r0, 'Score ' + v.score + ' · ' + n0(v.steps) + ' pas', Font.boldSystemFont(13), WHITE, { lines: 1, min: 0.7 });
  const r1 = w.addStack(); r1.layoutHorizontally(); r1.centerAlignContent(); r1.spacing = 4;
  addSym(r1, 'drop.fill', 11, WHITE); txt(r1, v.water + '/' + v.wg + ' verres · ' + n0(v.kcal) + ' kcal', Font.mediumSystemFont(12), WHITE, { lines: 1, min: 0.7 });
  const r2 = w.addStack(); r2.layoutHorizontally(); r2.centerAlignContent(); r2.spacing = 4;
  addSym(r2, 'shield.fill', 11, WHITE); txt(r2, v.sober + ' ' + plural(v.sober, 'jour') + ' sans alcool', Font.mediumSystemFont(12), WHITE, { lines: 1, min: 0.7 });
}

function noKey(w, fam) {
  if (fam && fam.startsWith('accessory')) { txt(w, 'Tracker : ouvre Scriptable', Font.semiboldSystemFont(12), WHITE, { lines: 2 }); return; }
  bg(w, 'score'); w.setPadding(14, 14, 14, 14);
  label(w, 'link', 'Tracker', C('#C4B5FD'));
  w.addSpacer(6);
  txt(w, 'Touche ce widget pour relier ton tracker.', Font.semiboldSystemFont(13), WHITE, { lines: 4 });
  w.addSpacer();
  txt(w, 'Copie d\'abord ta clé iPhone dans le tracker (Widgets PC).', Font.mediumSystemFont(10), MUTED, { lines: 3 });
}

async function build(fam, param, k) {
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000); // iOS décide, en général toutes les 5 à 15 minutes
  if (!k) { noKey(w, fam); return w; }
  const { sum } = await load(k);
  const v = view(sum), p = String(param || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (fam && fam.startsWith('accessory')) lock(w, v, fam, p);
  else if (fam === 'medium') medium(w, v, p);
  else if (fam === 'large' || fam === 'extraLarge') large(w, v);
  else small(w, v, p);
  return w;
}

/* ================= dans l'appli : réglage, aperçu, mise à jour ================= */
async function askKey() {
  let clip = '';
  try { clip = Pasteboard.paste() || ''; } catch (e) {}
  let k = parseKey(clip);
  if (!k) {
    const a = new Alert();
    a.title = 'Relier le tracker';
    a.message = "Dans le tracker de l'iPhone : Accueil › Widgets PC › Copier ma clé iPhone. Reviens ici : la clé est lue toute seule. Ou colle-la ci-dessous.";
    a.addTextField('VW1.…', '');
    a.addAction('Relier'); a.addCancelAction('Annuler');
    if ((await a.presentAlert()) < 0) return null;
    k = parseKey(a.textFieldValue(0));
    if (!k) { const e = new Alert(); e.title = 'Clé non reconnue'; e.message = 'Elle commence par VW1. Recopie-la depuis le tracker.'; e.addAction('OK'); await e.presentAlert(); return null; }
  }
  Keychain.set(KEY_NAME, k.raw);
  const r = await fetchSum(k);
  const ok = new Alert();
  ok.title = r.sum ? 'Tracker relié ✓' : 'Clé enregistrée';
  ok.message = r.sum ? 'Tes widgets sont prêts. Ajoute-les sur ton écran d\'accueil (appui long › + › Scriptable).'
    : "Aucun résumé reçu pour l'instant : ouvre le tracker et touche « Tester la liaison » dans Widgets PC, il en envoie un.";
  ok.addAction('OK'); await ok.presentAlert();
  return k;
}
async function selfUpdate() {
  try {
    const req = new Request(SRC + '?t=' + Date.now()); req.timeoutInterval = 10;
    const code = await req.loadString(), m = /const VERSION = '([\d.]+)'/.exec(code);
    if (!m || m[1] === VERSION || !/^\/\/ Variables used by Scriptable/.test(code)) return false;
    const newer = m[1].split('.').map(Number), cur = VERSION.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if (newer[i] > cur[i]) break; if (newer[i] < cur[i]) return false; }
    const path = module.filename, f = path.includes('Mobile Documents') ? FileManager.iCloud() : FileManager.local();
    f.writeString(path, code);
    return m[1];
  } catch (e) { return false; }
}

const savedKey = Keychain.contains(KEY_NAME) ? parseKey(Keychain.get(KEY_NAME)) : null;
if (config.runsInWidget) {
  Script.setWidget(await build(config.widgetFamily, args.widgetParameter, savedKey));
} else {
  let k = savedKey;
  if (!k) k = await askKey();
  if (k) {
    const upd = await selfUpdate();
    const a = new Alert();
    a.title = 'Widgets du tracker';
    a.message = (upd ? 'Script mis à jour (version ' + upd + '). ' : '') + 'Données lues sur les relais. Les widgets se rafraîchissent tout seuls, en général toutes les 5 à 15 minutes.';
    ['Aperçu petit', 'Aperçu moyen', 'Aperçu grand', 'Changer de clé'].forEach((x) => a.addAction(x));
    a.addCancelAction('Fermer');
    const i = await a.presentAlert();
    if (i === 3) { Keychain.remove(KEY_NAME); await askKey(); }
    else if (i >= 0) {
      const w = await build(['small', 'medium', 'large'][i], null, k);
      if (i === 0) await w.presentSmall(); else if (i === 1) await w.presentMedium(); else await w.presentLarge();
    }
  }
}
Script.complete();
