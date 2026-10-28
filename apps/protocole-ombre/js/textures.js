// Textures procédurales dessinées sur canvas : aucune image à télécharger.
// Chaque texture est en niveaux de gris ; la couleur vient du matériau (teinte).
import * as THREE from 'three';
import { rng } from './util.js';

const SIZE = 256;
const cache = new Map();

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function noise(g, r, amount, size = SIZE, scale = 1) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount * scale;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function blotches(g, r, count, alpha, size = SIZE) {
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = 8 + r() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.5 ? 0 : 255;
    grd.addColorStop(0, `rgba(${v},${v},${v},${alpha * r()})`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const painters = {
  concrete(g, r) {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, r, 40, 0.18);
    noise(g, r, 28);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
    g.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (const [x, y] of [[16, 16], [SIZE - 16, 16], [16, SIZE - 16], [SIZE - 16, SIZE - 16]]) {
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }
  },
  metal(g, r) {
    g.fillStyle = '#b4b6ba'; g.fillRect(0, 0, SIZE, SIZE);
    // Brossage horizontal
    for (let y = 0; y < SIZE; y++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.06})`;
      g.fillRect(0, y, SIZE, 1);
    }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
    g.strokeRect(2, 2, SIZE - 4, SIZE - 4);
    g.beginPath(); g.moveTo(0, SIZE / 2); g.lineTo(SIZE, SIZE / 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 1;
    g.strokeRect(5, 5, SIZE - 10, SIZE - 10);
    g.fillStyle = 'rgba(0,0,0,.45)';
    for (let i = 0; i < 8; i++) {
      const x = 12 + (i % 4) * ((SIZE - 24) / 3);
      const y = i < 4 ? 12 : SIZE - 12;
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
    blotches(g, r, 12, 0.12);
    noise(g, r, 14);
  },
  floor(g, r) {
    g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, SIZE, SIZE);
    const n = 4, s = SIZE / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 150 + r() * 40;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
    blotches(g, r, 30, 0.2);
    noise(g, r, 22);
  },
  hazard(g) {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#1a1a1a';
    for (let i = -SIZE; i < SIZE * 2; i += 64) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - SIZE, SIZE); g.lineTo(i - SIZE, SIZE);
      g.closePath(); g.fill();
    }
  },
  container(g, r) {
    g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, SIZE, SIZE);
    for (let x = 0; x < SIZE; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, 'rgba(0,0,0,.35)');
      grd.addColorStop(0.5, 'rgba(255,255,255,.18)');
      grd.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = grd; g.fillRect(x, 0, 16, SIZE);
    }
    g.fillStyle = 'rgba(70,40,20,.25)';
    for (let i = 0; i < 25; i++) g.fillRect(r() * SIZE, r() * SIZE, 2 + r() * 6, 10 + r() * 40);
    noise(g, r, 18);
  },
  ground(g, r) {
    g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, SIZE, SIZE);
    blotches(g, r, 70, 0.22);
    noise(g, r, 40);
    g.strokeStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.moveTo(r() * SIZE, r() * SIZE);
      for (let k = 0; k < 4; k++) g.lineTo(r() * SIZE, r() * SIZE);
      g.stroke();
    }
  },
  grate(g) {
    g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#d0d0d0';
    for (let i = 0; i < SIZE; i += 16) { g.fillRect(i, 0, 4, SIZE); g.fillRect(0, i, SIZE, 4); }
  },
  facade(g, r) {
    // Fenêtres : utilisé comme carte émissive (blanc = allumé).
    g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE);
    const cols = 8, rows = 8, w = SIZE / cols, h = SIZE / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() < 0.42) {
        const v = 120 + r() * 135;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(i * w + 4, j * h + 6, w - 8, h - 12);
      }
    }
  },
  fine(g, r) {
    // Micro-surface d'arme : grain fin + rayures légères (pour la carte de relief).
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE);
    noise(g, r, 30);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = r() * SIZE, y = r() * SIZE, l = 6 + r() * 30, a = r() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  },
  fabric(g, r) {
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 4) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, SIZE, 2); }
    for (let x = 0; x < SIZE; x += 4) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 2, SIZE); }
    noise(g, r, 22);
  },
  panelDark(g, r) {
    g.fillStyle = '#6a6c72'; g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(SIZE, i * 64); g.stroke();
    }
    g.beginPath(); g.moveTo(128, 0); g.lineTo(128, SIZE); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 4; i++) g.fillRect(8, i * 64 + 8, 40, 6);
    noise(g, r, 16);
  },
};

const sources = new Map();
function source(kind) {
  if (sources.has(kind)) return sources.get(kind);
  const [c, g] = canvas();
  const r = rng(kind.length * 7919 + kind.charCodeAt(0));
  painters[kind](g, r);
  sources.set(kind, c);
  return c;
}

/** Texture répétable (niveaux de gris) mise en cache par type. */
export function getTexture(kind, maxAniso = 4) {
  if (cache.has(kind)) return cache.get(kind);
  const c = source(kind);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = kind === 'facade' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  cache.set(kind, tex);
  return tex;
}

/**
 * Carte de relief (normal map) déduite de la luminance de la texture :
 * joints, rivets et grain accrochent la lumière de façon réaliste.
 */
export function getNormalMap(kind, strength = 2, maxAniso = 4) {
  const key = `n:${kind}:${strength}`;
  if (cache.has(key)) return cache.get(key);
  const src = source(kind);
  const S = src.width;
  const sd = src.getContext('2d').getImageData(0, 0, S, S).data;
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11) / 255;
  const [c, g] = canvas(S);
  const img = g.createImageData(S, S);
  const d = img.data;
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // Filtre de Sobel (bords répétés pour une texture sans couture)
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * S + x) * 4;
    d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  cache.set(key, tex);
  return tex;
}

/** Texture d'éclat (sprite radial) pour flashs, étincelles, lueurs. */
export function getGlowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const [c, g] = canvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('glow', tex);
  return tex;
}

/** Flash de bouche en étoile. */
export function getFlashTexture() {
  if (cache.has('flash')) return cache.get('flash');
  const [c, g] = canvas(128);
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    const grd = g.createLinearGradient(0, 0, 60, 0);
    grd.addColorStop(0, 'rgba(255,240,200,1)');
    grd.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(62, 0); g.lineTo(0, 7); g.fill();
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('flash', tex);
  return tex;
}
