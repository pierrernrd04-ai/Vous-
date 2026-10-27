// Outils mathématiques partagés (aucune dépendance).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Interpolation indépendante du framerate : `k` = vitesse (1/s). */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Ramène un angle dans ]-π, π]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Intersection rayon / boîte alignée (méthode des slabs).
 * o, d : [x,y,z] (d normalisé) ; renvoie la distance d'entrée ou Infinity.
 */
export function rayAABB(o, d, min, max, maxT = Infinity) {
  let t0 = 0, t1 = maxT;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / d[i];
    let tn = (min[i] - o[i]) * inv;
    let tf = (max[i] - o[i]) * inv;
    if (tn > tf) { const s = tn; tn = tf; tf = s; }
    if (tn > t0) t0 = tn;
    if (tf < t1) t1 = tf;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** Intersection rayon / sphère ; renvoie la distance ou Infinity. */
export function raySphere(o, d, c, r, maxT = Infinity) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 && t <= maxT ? t : Infinity;
}

/** Direction de visée à partir de lacet/tangage (lacet 0 = vers -Z). */
export function dirFromAngles(yaw, pitch, out = [0, 0, 0]) {
  const cp = Math.cos(pitch);
  out[0] = -Math.sin(yaw) * cp;
  out[1] = Math.sin(pitch);
  out[2] = -Math.cos(yaw) * cp;
  return out;
}

/** Perturbe une direction dans un cône de demi-angle `spread` (radians). */
export function spreadDir(d, spread) {
  if (spread <= 0) return [d[0], d[1], d[2]];
  // Base orthonormée autour de d.
  const up = Math.abs(d[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let rx = up[1] * d[2] - up[2] * d[1];
  let ry = up[2] * d[0] - up[0] * d[2];
  let rz = up[0] * d[1] - up[1] * d[0];
  const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
  const ux = d[1] * rz - d[2] * ry, uy = d[2] * rx - d[0] * rz, uz = d[0] * ry - d[1] * rx;
  const a = Math.random() * Math.PI * 2;
  const r = Math.tan(spread) * Math.sqrt(Math.random());
  const x = d[0] + (rx * Math.cos(a) + ux * Math.sin(a)) * r;
  const y = d[1] + (ry * Math.cos(a) + uy * Math.sin(a)) * r;
  const z = d[2] + (rz * Math.cos(a) + uz * Math.sin(a)) * r;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

export const dist2D = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Stockage local tolérant (navigation privée, WebView restreinte…). */
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* indisponible */ }
  },
};

export const isTouchDevice = () =>
  matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
