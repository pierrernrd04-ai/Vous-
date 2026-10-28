// Armurier : modèles d'armes réalistes construits à partir de silhouettes de
// profil extrudées et biseautées (carcasses, crosses, poignées, chargeurs…),
// de cylindres (canons, tubes, optiques) et de matériaux PBR.
//
// Repère d'une arme : origine au sommet de la poignée pistolet (là où se
// referme la main droite), -Z vers la bouche, +Y vers le haut, +X à droite.
// Les profils sont décrits en (u, v) : u = distance vers l'avant, v = hauteur.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getNormalMap } from './textures.js';

const FURNITURE = { urban: '#4b5158', tan: '#9a8159', black: '#1b1d21', carbon: '#25272c', olive: '#485237' };

// ──────────────────────────────────────────────── matériaux

const matCache = new Map();
function material(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

function pbr(color, rough, metal, normalScale = 0.35) {
  const n = getNormalMap('fine', 2.2);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, normalMap: n });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

function weaponMaterials(def) {
  const furn = FURNITURE[def.model.body] || FURNITURE.black;
  return {
    steel: material('steel', () => pbr('#3a3d42', 0.34, 0.8)),
    alu: material('alu', () => pbr('#2a2d32', 0.4, 0.55)),
    poly: material('poly', () => pbr('#232428', 0.7, 0.05, 0.5)),
    furn: material(`furn:${furn}`, () => pbr(furn, 0.66, 0.08, 0.5)),
    dark: material('dark', () => new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.8, metalness: 0.3 })),
    brass: material('brass', () => pbr('#b08a3c', 0.3, 0.9)),
    lens: material('lens', () => new THREE.MeshStandardMaterial({ color: '#0b1a2a', roughness: 0.04, metalness: 1, emissive: '#06121f', emissiveIntensity: 0.6 })),
    glow: material(`glow:${def.model.accent}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(def.model.accent).multiplyScalar(2.2), toneMapped: false })),
    reticle: material('reticle', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(4), toneMapped: false, depthTest: false, transparent: true })),
  };
}

// ──────────────────────────────────────────────── outils de construction

const round = (u0, v0, u1, v1, r, seg = 3) => {
  // Rectangle arrondi (sens trigonométrique) en points (u, v).
  const out = [];
  const corner = (cu, cv, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; out.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } };
  corner(u1 - r, v0 + r, -Math.PI / 2);
  corner(u1 - r, v1 - r, 0);
  corner(u0 + r, v1 - r, Math.PI / 2);
  corner(u0 + r, v0 + r, Math.PI);
  return out;
};

class Kit {
  constructor() { this.geos = new Map(); this.magGeos = new Map(); this.target = this.geos; }

  /** Les pièces ajoutées ensuite appartiennent au chargeur (animé à part). */
  mag(fn) { this.target = this.magGeos; fn(); this.target = this.geos; }

  push(key, g) {
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (!this.target.has(key)) this.target.set(key, []);
    this.target.get(key).push(g);
    return g;
  }

  /** Silhouette de profil (u, v) extrudée sur l'épaisseur `t`, centrée en x. */
  side(key, pts, t, { x = 0, bevel = 0.0018, holes = [], curve = 3 } = {}) {
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
    const depth = Math.max(0.001, t - 2 * bevel);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, curveSegments: curve, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 2,
    });
    g.rotateY(Math.PI / 2);
    g.translate(x - depth / 2, 0, 0);
    this._uvScale(g, 9);
    return this.push(key, g);
  }

  /** Silhouette de face (x, y) extrudée vers l'avant entre u0 et u1. */
  front(key, pts, u0, u1, { holes = [], bevel = 0.0012 } = {}) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const depth = Math.max(0.001, u1 - u0 - 2 * bevel);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -u0 - bevel - depth);
    this._uvScale(g, 9);
    return this.push(key, g);
  }

  box(key, u0, u1, v0, v1, w, x = 0) {
    const g = new THREE.BoxGeometry(w, v1 - v0, u1 - u0);
    g.translate(x, (v0 + v1) / 2, -(u0 + u1) / 2);
    return this.push(key, g);
  }

  /** Cylindre le long de l'axe du canon ; rRear/rFront pour un cône. */
  cyl(key, u0, u1, v, r, { x = 0, rFront = r, seg = 18 } = {}) {
    const g = new THREE.CylinderGeometry(r, rFront, u1 - u0, seg);
    g.rotateX(Math.PI / 2);
    g.translate(x, v, -(u0 + u1) / 2);
    return this.push(key, g);
  }

  /** Cylindre vertical (pieds de bipied, tourelles…). */
  cylY(key, u, v0, v1, r, x = 0, seg = 12) {
    const g = new THREE.CylinderGeometry(r, r, v1 - v0, seg);
    g.translate(x, (v0 + v1) / 2, -u);
    return this.push(key, g);
  }

  /** Cylindre transversal (axe X). */
  cylX(key, u, v, r, len, x = 0, seg = 16) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2);
    g.translate(x, v, -u);
    return this.push(key, g);
  }

  sphere(key, u, v, r, x = 0) {
    const g = new THREE.SphereGeometry(r, 12, 8);
    g.translate(x, v, -u);
    return this.push(key, g);
  }

  /** Rail Picatinny : semelle + créneaux. */
  rail(u0, u1, v, w = 0.021, x = 0, key = 'alu') {
    this.box(key, u0, u1, v, v + 0.005, w * 0.8, x);
    for (let u = u0 + 0.004; u < u1 - 0.004; u += 0.01) this.box(key, u, u + 0.0052, v + 0.005, v + 0.0085, w, x);
  }

  /** Rail latéral (côté gauche ou droit). */
  railSide(u0, u1, v, side, key = 'alu') {
    const x = side * 0.016;
    this.box(key, u0, u1, v - 0.008, v + 0.008, 0.005, x);
    for (let u = u0 + 0.004; u < u1 - 0.004; u += 0.01) this.box(key, u, u + 0.0052, v - 0.0105, v + 0.0105, 0.004, x + side * 0.004);
  }

  _uvScale(g, k) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  }

  build(mats) {
    const group = new THREE.Group();
    const make = (map, parent) => {
      for (const [key, list] of map) {
        const mesh = new THREE.Mesh(mergeGeometries(list, false), mats[key]);
        mesh.castShadow = true;
        if (key === 'reticle') mesh.renderOrder = 10;
        parent.add(mesh);
        list.forEach((g) => g.dispose());
      }
    };
    make(this.geos, group);
    const mag = new THREE.Group();
    make(this.magGeos, mag);
    group.add(mag);
    return { group, mag };
  }
}

// ──────────────────────────────────────────────── pièces communes

function pistolGrip(k, key = 'poly', u = 0, rake = 1) {
  const p = [[-0.056, -0.004], [-0.012, -0.004], [-0.016, -0.022], [-0.022, -0.034], [-0.021, -0.046], [-0.027, -0.058],
    [-0.026, -0.07], [-0.032, -0.082], [-0.033, -0.096], [-0.04, -0.11], [-0.05, -0.119], [-0.082, -0.118],
    [-0.088, -0.108], [-0.078, -0.07], [-0.068, -0.03], [-0.062, -0.012]];
  k.side(key, p.map(([a, b]) => [a * (rake > 1 ? 1.05 : 1) + u + b * (rake - 1) * 0.4, b]), 0.03, { bevel: 0.004 });
}

function triggerGroup(k, u0 = -0.012, u1 = 0.058, v = -0.004) {
  const outer = [[u0, v], [u1, v], [u1 + 0.002, v - 0.024], [u1 - 0.01, v - 0.036], [u0 + 0.004, v - 0.036], [u0, v - 0.03]];
  const inner = [[u0 + 0.006, v - 0.003], [u1 - 0.004, v - 0.003], [u1 - 0.004, v - 0.024], [u1 - 0.012, v - 0.031], [u0 + 0.008, v - 0.031], [u0 + 0.006, v - 0.026]];
  k.side('alu', outer, 0.011, { holes: [inner], bevel: 0.0015 });
  k.side('steel', [[0.004, v], [0.012, v], [0.017, v - 0.016], [0.013, v - 0.027], [0.009, v - 0.024], [0.01, v - 0.012]], 0.005, { bevel: 0.001 });
}

function curvedMag(k, key, uFront, vTop, len, curve, depth = 0.062, w = 0.024, ribs = true) {
  const n = 8, front = [], back = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    front.push([uFront + curve * t * t, vTop - len * t]);
    back.push([uFront - depth + curve * t * t * 0.85, vTop - len * t]);
  }
  const pts = [...front, [front[n][0] + 0.004, front[n][1] - 0.014], [back[n][0] - 0.004, back[n][1] - 0.014], ...back.reverse()];
  k.mag(() => {
    k.side(key, pts, w, { bevel: 0.0025 });
    if (ribs) for (let i = 1; i < 4; i++) {
      const t = i / 4.2;
      const u = uFront - depth / 2 + curve * t * t * 0.92;
      k.box(key, u - depth * 0.42, u + depth * 0.42, vTop - len * t - 0.004, vTop - len * t + 0.004, w + 0.003);
    }
  });
}

function boxStock(k, key, uFront, uRear, vTop, vBot, w = 0.036, hole = false) {
  const p = [[uFront, vTop], [uRear + 0.012, vTop + 0.006], [uRear, vTop - 0.004], [uRear, vBot + 0.006], [uRear + 0.014, vBot], [uFront, vTop - 0.06]];
  const holes = hole ? [[[uFront - 0.05, vTop - 0.018], [uRear + 0.05, vTop - 0.012], [uRear + 0.05, vBot + 0.04], [uFront - 0.06, vTop - 0.05]]] : [];
  k.side(key, p, w, { holes, bevel: 0.004 });
  k.box('poly', uRear - 0.012, uRear, vBot + 0.004, vTop - 0.002, w + 0.004);
}

function collapsibleStock(k, key = 'poly', u0 = -0.09, v = 0.045) {
  k.cyl('alu', u0 - 0.18, u0, v, 0.0145, { seg: 16 });
  const b = u0 - 0.1;
  k.side(key, [[b, v + 0.024], [b - 0.14, v + 0.036], [b - 0.152, v + 0.03], [b - 0.152, v - 0.11], [b - 0.138, v - 0.118],
    [b - 0.11, v - 0.09], [b - 0.03, v - 0.014], [b, v - 0.012]], 0.038, { bevel: 0.004, holes: [[[b - 0.03, v - 0.005], [b - 0.09, v - 0.004], [b - 0.11, v - 0.06], [b - 0.08, v - 0.062]]] });
  k.box('poly', b - 0.16, b - 0.15, v - 0.114, v + 0.03, 0.042);
}

function mlokHandguard(k, key, u0, u1, v0, v1, w = 0.042) {
  const holes = [];
  for (let u = u0 + 0.03; u < u1 - 0.035; u += 0.045) {
    const hv = (v0 + v1) / 2;
    holes.push(round(u, hv - 0.006, u + 0.028, hv + 0.006, 0.005, 2));
  }
  k.side(key, round(u0, v0, u1, v1, 0.008), w, { holes, bevel: 0.002 });
}

function muzzle(k, type, u, v, r = 0.009) {
  switch (type) {
    case 'brake':
      k.cyl('steel', u, u + 0.055, v, r * 1.45);
      for (let i = 0; i < 3; i++) k.box('dark', u + 0.01 + i * 0.014, u + 0.018 + i * 0.014, v - r * 0.9, v + r * 0.9, r * 3);
      return u + 0.055;
    case 'big':
      k.box('steel', u, u + 0.09, v - 0.018, v + 0.018, 0.05);
      for (let i = 0; i < 2; i++) k.box('dark', u + 0.015 + i * 0.04, u + 0.04 + i * 0.04, v - 0.014, v + 0.014, 0.052);
      return u + 0.09;
    case 'supp':
      k.cyl('alu', u, u + 0.16, v, 0.019, { seg: 20 });
      k.cyl('steel', u + 0.155, u + 0.162, v, 0.016);
      return u + 0.162;
    case 'flash':
      k.cyl('steel', u, u + 0.045, v, r * 1.25);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        k.box('dark', u + 0.022, u + 0.045, v + Math.sin(a) * r - 0.0015, v + Math.sin(a) * r + 0.0015, 0.003, Math.cos(a) * r);
      }
      return u + 0.045;
    default:
      return u;
  }
}

/** Optique ; renvoie la hauteur de la ligne de visée. */
function optic(k, type, u, vRail) {
  switch (type) {
    case 'dot': {
      k.box('alu', u - 0.03, u + 0.03, vRail, vRail + 0.012, 0.026);
      const c = vRail + 0.034;
      k.cyl('alu', u - 0.032, u + 0.032, c, 0.019, { seg: 24 });
      k.cyl('dark', u - 0.034, u + 0.034, c, 0.0165, { seg: 24 });
      k.cyl('lens', u + 0.026, u + 0.03, c, 0.0162, { seg: 24 });
      k.cylY('alu', u, c + 0.015, c + 0.026, 0.008);
      k.cylX('alu', u, c, 0.008, 0.012, 0.022);
      k.sphere('reticle', u + 0.024, c, 0.0009);
      return c;
    }
    case 'holo': {
      k.box('alu', u - 0.045, u + 0.035, vRail, vRail + 0.016, 0.034);
      const c = vRail + 0.04;
      k.front('alu', round(-0.022, vRail + 0.014, 0.022, vRail + 0.064, 0.006), u - 0.02, u + 0.035,
        { holes: [round(-0.017, vRail + 0.02, 0.017, vRail + 0.058, 0.004)] });
      k.box('lens', u + 0.012, u + 0.015, vRail + 0.02, vRail + 0.058, 0.034);
      k.box('glow', u - 0.044, u - 0.03, vRail + 0.008, vRail + 0.012, 0.03);
      const ring = new THREE.TorusGeometry(0.006, 0.0005, 6, 32);
      ring.translate(0, c, -(u + 0.011));
      k.push('reticle', ring);
      k.sphere('reticle', u + 0.011, c, 0.0008);
      return c;
    }
    case 'scope': {
      k.box('alu', u - 0.04, u + 0.04, vRail, vRail + 0.012, 0.028);
      const c = vRail + 0.036;
      k.cyl('alu', u - 0.06, u + 0.06, c, 0.017, { seg: 24 });
      k.cyl('alu', u + 0.045, u + 0.08, c, 0.017, { rFront: 0.022, seg: 24 });
      k.cyl('alu', u - 0.085, u - 0.05, c, 0.021, { rFront: 0.017, seg: 24 });
      k.cyl('lens', u + 0.078, u + 0.082, c, 0.02, { seg: 24 });
      k.cylY('alu', u, c + 0.015, c + 0.028, 0.009);
      k.box('glow', u - 0.02, u + 0.02, c + 0.016, c + 0.018, 0.004, 0.01);
      return c;
    }
    case 'sniper': {
      const c = vRail + 0.05;
      for (const ru of [u - 0.07, u + 0.06]) {
        k.box('alu', ru - 0.012, ru + 0.012, vRail, vRail + 0.03, 0.026);
        k.cyl('alu', ru - 0.012, ru + 0.012, c, 0.02, { seg: 20 });
      }
      k.cyl('steel', u - 0.12, u + 0.12, c, 0.0155, { seg: 24 });
      k.cyl('steel', u + 0.11, u + 0.2, c, 0.0155, { rFront: 0.029, seg: 28 });
      k.cyl('steel', u + 0.2, u + 0.24, c, 0.029, { seg: 28 });
      k.cyl('lens', u + 0.238, u + 0.243, c, 0.026, { seg: 28 });
      k.cyl('steel', u - 0.2, u - 0.11, c, 0.023, { rFront: 0.0155, seg: 24 });
      k.cyl('poly', u - 0.215, u - 0.195, c, 0.024, { seg: 24 });
      k.cylY('alu', u, c + 0.012, c + 0.036, 0.012, 0, 16);
      k.cylX('alu', u, c, 0.012, 0.03, 0.018, 16);
      k.box('glow', u - 0.1, u - 0.04, c + 0.0158, c + 0.0172, 0.003);
      return c;
    }
    default: { // organes de visée métalliques
      k.front('alu', [[-0.009, vRail], [0.009, vRail], [0.009, vRail + 0.022], [-0.009, vRail + 0.022]], u - 0.008, u + 0.004,
        { holes: [round(-0.0025, vRail + 0.011, 0.0025, vRail + 0.016, 0.0012, 2)] });
      return vRail + 0.0135;
    }
  }
}

function frontPost(k, u, vBarrel, vSight) {
  k.box('alu', u - 0.012, u + 0.012, vBarrel, vBarrel + 0.012, 0.022);
  k.side('alu', [[u - 0.012, vBarrel + 0.012], [u + 0.012, vBarrel + 0.012], [u + 0.004, vSight + 0.004], [u - 0.004, vSight + 0.004]], 0.006);
}

function bipod(k, u, v) {
  k.box('alu', u - 0.015, u + 0.015, v - 0.012, v, 0.03);
  for (const x of [-0.012, 0.012]) k.cyl('steel', u - 0.2, u, v - 0.016, 0.0055, { x });
}

// ──────────────────────────────────────────────── gabarits

const T = {};

// Carabine type M4
T.m4 = (k, w) => {
  k.side('alu', [[-0.1, 0.036], [0.112, 0.036], [0.112, -0.012], [0.106, -0.046], [0.03, -0.046], [0.022, -0.012], [-0.058, -0.012], [-0.1, 0.006]], 0.03, { bevel: 0.003 });
  k.side('alu', [[-0.104, 0.084], [0.17, 0.084], [0.17, 0.036], [-0.104, 0.036]], 0.032, { bevel: 0.003 });
  k.box('dark', -0.01, 0.06, 0.044, 0.07, 0.004, 0.017);
  k.cylX('alu', -0.065, 0.062, 0.007, 0.012, 0.019);
  k.box('alu', -0.135, -0.1, 0.074, 0.084, 0.03);
  k.rail(-0.1, 0.17, 0.084);
  pistolGrip(k, 'poly');
  triggerGroup(k);
  curvedMag(k, 'poly', 0.105, -0.042, 0.165, 0.02);
  collapsibleStock(k, 'furn');
  mlokHandguard(k, 'furn', 0.17, 0.48, 0.016, 0.088, 0.046);
  k.rail(0.18, 0.47, 0.088);
  k.cyl('steel', 0.17, 0.62, 0.06, 0.0085);
  k.box('steel', 0.48, 0.51, 0.045, 0.072, 0.024);
  const end = muzzle(k, 'brake', 0.62, 0.06);
  k.box('glow', 0.25, 0.4, 0.05, 0.053, 0.002, -0.0236);
  return { muzzle: end, bore: 0.06, rail: 0.0925, opticU: 0.03, gripL: [0.3, 0.012] };
};

// Fusil type AK (corps partagé avec le fusil à pompe semi-automatique)
function akBody(k, shotgun) {
  k.side('alu', [[-0.125, 0.07], [0.2, 0.07], [0.205, 0.064], [0.205, -0.008], [0.12, -0.012], [0.11, -0.02], [0.03, -0.02], [-0.04, -0.008], [-0.125, -0.002]], 0.034, { bevel: 0.003 });
  k.side('steel', [[-0.12, 0.07], [0.18, 0.07], [0.18, 0.078], [0.16, 0.086], [-0.1, 0.086], [-0.12, 0.08]], 0.032, { bevel: 0.004 });
  k.box('dark', 0.0, 0.08, 0.05, 0.066, 0.004, 0.018);
  k.box('steel', 0.03, 0.06, 0.054, 0.06, 0.012, 0.024);
  pistolGrip(k, 'furn', 0.004, 1.15);
  triggerGroup(k, -0.008, 0.06, -0.008);
  if (shotgun) k.mag(() => k.side('poly', round(0.03, -0.17, 0.125, -0.012, 0.01), 0.04, { bevel: 0.004 }));
  else curvedMag(k, 'steel', 0.108, -0.016, 0.19, 0.075, 0.064, 0.026, false);
  boxStock(k, 'furn', -0.12, -0.43, 0.066, -0.085, 0.034);
  k.side('furn', [[0.205, 0.02], [0.42, 0.024], [0.425, 0.03], [0.425, 0.066], [0.205, 0.068]], 0.044, { bevel: 0.006 });
  k.cyl('furn', 0.24, 0.42, 0.083, 0.012);
  k.cyl('steel', 0.2, 0.6, 0.05, shotgun ? 0.012 : 0.0085);
  k.cyl('steel', 0.42, 0.53, 0.082, 0.007);
  frontPost(k, 0.53, 0.05, 0.1);
  k.side('steel', [[0.205, 0.086], [0.24, 0.086], [0.24, 0.096], [0.21, 0.096]], 0.02);
  const end = muzzle(k, shotgun ? 'flash' : 'brake', 0.6, 0.05, shotgun ? 0.012 : 0.0085);
  k.rail(-0.04, 0.06, 0.086, 0.019, 0, 'steel');
  return { muzzle: end, bore: 0.05, rail: 0.0945, opticU: 0.01, gripL: [0.32, 0.01] };
}
T.ak = (k) => akBody(k, false);

// Fusil type SCAR (rafale)
T.scar = (k, w) => {
  k.side('alu', [[-0.105, 0.03], [0.1, 0.03], [0.1, -0.012], [0.094, -0.048], [0.028, -0.048], [0.02, -0.012], [-0.06, -0.012], [-0.105, 0.0]], 0.032, { bevel: 0.003 });
  k.side('furn', [[-0.11, 0.094], [0.38, 0.094], [0.385, 0.088], [0.385, 0.04], [0.2, 0.02], [0.1, 0.03], [-0.11, 0.03]], 0.044, { bevel: 0.004 });
  k.rail(-0.11, 0.38, 0.094);
  k.railSide(0.22, 0.36, 0.055, 1); k.railSide(0.22, 0.36, 0.055, -1);
  k.box('dark', -0.02, 0.06, 0.05, 0.072, 0.004, 0.0225);
  k.box('steel', 0.06, 0.08, 0.06, 0.072, 0.03, -0.028);
  pistolGrip(k, 'poly');
  triggerGroup(k);
  curvedMag(k, 'alu', 0.092, -0.044, 0.16, 0.014);
  k.side('furn', [[-0.105, 0.085], [-0.36, 0.08], [-0.37, 0.07], [-0.37, -0.075], [-0.355, -0.085], [-0.3, -0.06], [-0.13, 0.02], [-0.105, 0.025]], 0.04,
    { bevel: 0.004, holes: [[[-0.15, 0.07], [-0.33, 0.066], [-0.33, -0.05], [-0.29, -0.04], [-0.16, 0.035]]] });
  k.box('poly', -0.38, -0.365, -0.08, 0.08, 0.044);
  k.cyl('steel', 0.38, 0.6, 0.06, 0.009);
  const end = muzzle(k, 'flash', 0.6, 0.06);
  k.box('glow', 0.0, 0.3, 0.066, 0.069, 0.002, -0.0226);
  return { muzzle: end, bore: 0.06, rail: 0.1025, opticU: 0.06, gripL: [0.28, 0.025] };
};

// Bullpup type AUG/FAMAS : chargeur derrière la poignée
T.bullpup = (k, w) => {
  k.side('furn', [[-0.36, 0.06], [-0.34, 0.085], [0.2, 0.085], [0.26, 0.07], [0.27, 0.02], [0.08, 0.0], [0.05, -0.03], [-0.02, -0.03], [-0.07, 0.0],
    [-0.12, -0.02], [-0.36, -0.035], [-0.375, -0.02], [-0.375, 0.045]], 0.05, { bevel: 0.006 });
  k.rail(-0.18, 0.2, 0.085);
  k.box('dark', -0.2, -0.12, 0.04, 0.066, 0.004, 0.0262);
  pistolGrip(k, 'poly');
  k.side('poly', [[0.07, 0.0], [0.11, 0.0], [0.105, -0.11], [0.08, -0.11]], 0.03, { bevel: 0.004 });
  triggerGroup(k, -0.012, 0.06, -0.004);
  k.mag(() => k.side('poly', [[-0.12, -0.02], [-0.065, -0.02], [-0.05, -0.18], [-0.11, -0.18]], 0.024, { bevel: 0.003 }));
  k.cyl('steel', 0.26, 0.5, 0.05, 0.009);
  const end = muzzle(k, 'flash', 0.5, 0.05);
  k.box('glow', -0.3, 0.15, 0.06, 0.063, 0.002, -0.0262);
  return { muzzle: end, bore: 0.05, rail: 0.0935, opticU: -0.02, gripL: [0.09, -0.04] };
};

// Fusil de bataille (long, chargeur droit)
T.battle = (k, w, muzzleType = 'brake') => {
  k.side('alu', [[-0.13, 0.09], [0.24, 0.09], [0.25, 0.08], [0.25, 0.0], [0.11, -0.014], [0.105, -0.05], [0.03, -0.05], [0.022, -0.014], [-0.07, -0.014], [-0.13, 0.0]], 0.038, { bevel: 0.004 });
  k.rail(-0.13, 0.24, 0.09);
  k.box('dark', -0.03, 0.07, 0.05, 0.075, 0.004, 0.0195);
  k.cyl('steel', 0.09, 0.22, 0.104, 0.007);
  pistolGrip(k, 'furn');
  triggerGroup(k);
  k.mag(() => k.side('steel', [[0.03, -0.046], [0.1, -0.046], [0.106, -0.2], [0.036, -0.2]], 0.026, { bevel: 0.003 }));
  boxStock(k, 'furn', -0.13, -0.45, 0.085, -0.08, 0.04);
  mlokHandguard(k, 'furn', 0.25, 0.5, 0.02, 0.085, 0.05);
  k.cyl('steel', 0.25, 0.68, 0.058, 0.0105);
  const end = muzzle(k, muzzleType, 0.68, 0.058, 0.0105);
  k.box('glow', 0.3, 0.45, 0.07, 0.073, 0.002, -0.0256);
  return { muzzle: end, bore: 0.058, rail: 0.0985, opticU: 0.04, gripL: [0.34, 0.018] };
};

// Mitraillette compacte type MP7 (chargeur dans la poignée)
T.mp7 = (k, w) => {
  k.side('poly', [[-0.11, 0.075], [0.16, 0.075], [0.175, 0.06], [0.175, 0.02], [0.1, 0.01], [0.06, -0.01], [-0.01, -0.01], [-0.11, 0.02]], 0.04, { bevel: 0.005 });
  k.rail(-0.08, 0.15, 0.075);
  pistolGrip(k, 'poly', 0.03);
  triggerGroup(k, 0.02, 0.085, -0.008);
  k.mag(() => k.box('poly', -0.035, -0.006, -0.17, -0.1, 0.022, 0));
  k.side('poly', [[0.12, 0.01], [0.15, 0.01], [0.146, -0.07], [0.124, -0.07]], 0.026, { bevel: 0.004 });
  for (const x of [-0.016, 0.016]) k.cyl('steel', -0.2, -0.1, 0.04, 0.004, { x });
  k.box('poly', -0.215, -0.2, -0.01, 0.06, 0.044);
  k.cyl('steel', 0.175, 0.27, 0.045, 0.008);
  const end = muzzle(k, 'flash', 0.27, 0.045, 0.008);
  k.box('glow', -0.06, 0.12, 0.05, 0.053, 0.002, -0.0206);
  return { muzzle: end, bore: 0.045, rail: 0.0835, opticU: 0.03, gripL: [0.135, -0.04] };
};

// Mitraillette type MP5
T.mp5 = (k, w) => {
  k.side('steel', [[-0.12, 0.07], [0.2, 0.07], [0.21, 0.062], [0.21, 0.02], [0.1, 0.016], [0.095, -0.03], [0.03, -0.03], [0.025, 0.0], [-0.12, 0.012]], 0.036, { bevel: 0.006 });
  k.cyl('steel', -0.02, 0.26, 0.08, 0.011);
  k.box('dark', 0.0, 0.06, 0.04, 0.062, 0.004, 0.0185);
  pistolGrip(k, 'poly');
  triggerGroup(k);
  curvedMag(k, 'steel', 0.09, -0.026, 0.16, 0.06, 0.05, 0.022, false);
  k.side('furn', round(0.21, 0.02, 0.36, 0.072, 0.02), 0.046, { bevel: 0.006 });
  k.cyl('steel', 0.21, 0.4, 0.048, 0.0075);
  k.cylX('steel', -0.08, 0.09, 0.012, 0.02);
  frontPost(k, 0.3, 0.07, 0.1);
  for (const x of [-0.017, 0.017]) k.cyl('steel', -0.3, -0.12, 0.05, 0.0045, { x });
  k.box('poly', -0.315, -0.3, -0.02, 0.07, 0.048);
  const end = muzzle(k, 'flash', 0.4, 0.048, 0.0075);
  k.rail(-0.06, 0.06, 0.081, 0.019, 0, 'steel');
  return { muzzle: end, bore: 0.048, rail: 0.0895, opticU: 0.0, gripL: [0.29, 0.02] };
};

// Mitraillette anguleuse type Vector (chargeur avant)
T.vector = (k, w) => {
  k.side('furn', [[-0.1, 0.08], [0.2, 0.08], [0.23, 0.06], [0.23, 0.0], [0.13, -0.06], [0.04, -0.06], [0.02, -0.01], [-0.1, 0.0]], 0.048, { bevel: 0.006 });
  k.rail(-0.08, 0.2, 0.08);
  pistolGrip(k, 'poly', 0.0, 1.25);
  triggerGroup(k, -0.01, 0.05, -0.006);
  k.mag(() => k.side('poly', [[0.1, -0.05], [0.14, -0.05], [0.15, -0.24], [0.11, -0.24]], 0.024, { bevel: 0.003 }));
  k.side('poly', [[-0.1, 0.06], [-0.3, 0.06], [-0.31, 0.05], [-0.31, -0.06], [-0.29, -0.06], [-0.27, 0.0], [-0.1, 0.0]], 0.03,
    { bevel: 0.004, holes: [[[-0.14, 0.045], [-0.27, 0.045], [-0.27, 0.015], [-0.14, 0.015]]] });
  k.cyl('steel', 0.23, 0.36, 0.05, 0.0085);
  const end = muzzle(k, 'flash', 0.36, 0.05, 0.0085);
  k.box('glow', -0.05, 0.18, 0.055, 0.058, 0.002, -0.025);
  return { muzzle: end, bore: 0.05, rail: 0.0885, opticU: 0.04, gripL: [0.16, -0.03] };
};

// Fusil à pompe tactique
T.pump = (k, w) => {
  k.side('alu', round(-0.1, -0.008, 0.13, 0.064, 0.008), 0.038, { bevel: 0.004 });
  k.box('dark', -0.02, 0.07, 0.03, 0.055, 0.004, 0.0195);
  pistolGrip(k, 'poly');
  triggerGroup(k);
  k.cyl('steel', 0.13, 0.62, 0.048, 0.0115, { seg: 20 });
  k.cyl('steel', 0.13, 0.55, 0.016, 0.0125, { seg: 18 });
  k.mag(() => {
    k.cyl('poly', 0.2, 0.36, 0.018, 0.022, { seg: 20 });
    for (let u = 0.215; u < 0.35; u += 0.02) k.cyl('dark', u, u + 0.006, 0.018, 0.0225, { seg: 20 });
  });
  k.box('steel', 0.55, 0.57, 0.012, 0.052, 0.02);
  k.sphere('steel', 0.61, 0.062, 0.0028);
  collapsibleStock(k, 'furn', -0.1, 0.04);
  k.rail(-0.08, 0.12, 0.064);
  return { muzzle: 0.62, bore: 0.048, rail: 0.0725, opticU: 0.03, gripL: [0.28, 0.0], pumpMag: true };
};

// Fusil à pompe semi-automatique à chargeur (type Saiga)
T.saiga = (k) => akBody(k, true);

// Fusil à deux canons juxtaposés
T.double = (k, w) => {
  k.side('steel', round(-0.06, -0.01, 0.08, 0.06, 0.01), 0.044, { bevel: 0.004 });
  for (const x of [-0.0115, 0.0115]) k.cyl('steel', 0.06, 0.52, 0.04, 0.0115, { x, seg: 20 });
  k.box('steel', 0.06, 0.5, 0.05, 0.054, 0.006);
  k.side('furn', round(0.08, 0.008, 0.3, 0.036, 0.012), 0.05, { bevel: 0.006 });
  k.side('furn', [[-0.06, 0.05], [-0.12, 0.045], [-0.4, 0.05], [-0.41, 0.04], [-0.41, -0.09], [-0.395, -0.1], [-0.13, -0.04], [-0.08, -0.04], [-0.06, -0.01]], 0.042, { bevel: 0.006 });
  k.box('poly', -0.42, -0.405, -0.095, 0.048, 0.046);
  triggerGroup(k, -0.02, 0.05, -0.008);
  k.box('steel', -0.06, -0.03, 0.06, 0.07, 0.008);
  k.sphere('steel', 0.515, 0.058, 0.0025);
  return { muzzle: 0.52, bore: 0.04, rail: 0.06, opticU: -0.04, gripL: [0.2, 0.0], noRail: true };
};

// Fusil de précision à verrou (châssis à trou de pouce)
T.bolt = (k, w) => {
  k.cyl('steel', -0.13, 0.17, 0.062, 0.017, { seg: 20 });
  k.side('furn', [[-0.14, 0.05], [0.42, 0.05], [0.43, 0.04], [0.43, 0.005], [0.12, -0.005], [0.105, -0.045], [0.03, -0.045], [0.02, -0.01], [-0.05, -0.01],
    [-0.1, 0.0], [-0.14, 0.03]], 0.05, { bevel: 0.006 });
  k.side('furn', [[-0.13, 0.05], [-0.2, 0.062], [-0.44, 0.08], [-0.455, 0.07], [-0.455, -0.09], [-0.44, -0.1], [-0.33, -0.08], [-0.2, -0.02], [-0.13, 0.0]], 0.045,
    { bevel: 0.006, holes: [[[-0.16, 0.03], [-0.25, 0.04], [-0.27, -0.035], [-0.19, -0.03]]] });
  k.box('poly', -0.47, -0.455, -0.095, 0.075, 0.05);
  pistolGrip(k, 'poly', -0.005, 1.2);
  triggerGroup(k);
  k.mag(() => k.box('alu', 0.03, 0.1, -0.09, -0.04, 0.03));
  k.cylX('steel', -0.08, 0.072, 0.0045, 0.05, 0.03);
  k.sphere('steel', -0.08, 0.072, 0.009, 0.058);
  k.cyl('steel', 0.17, 0.82, 0.062, 0.0125, { rFront: 0.01, seg: 20 });
  const end = muzzle(k, 'brake', 0.82, 0.062, 0.01);
  k.rail(-0.12, 0.16, 0.079);
  bipod(k, 0.42, 0.006);
  return { muzzle: end, bore: 0.062, rail: 0.0875, opticU: 0.02, gripL: [0.3, -0.005] };
};

// Fusil de tireur d'élite semi-automatique
T.dmr = (k, w) => T.battle(k, w, 'supp');

// Anti-matériel calibre .50
T.fifty = (k, w) => {
  k.side('alu', [[-0.16, 0.1], [0.3, 0.1], [0.32, 0.085], [0.32, 0.0], [0.12, -0.012], [0.115, -0.06], [0.03, -0.06], [0.02, -0.012], [-0.08, -0.012], [-0.16, 0.0]], 0.05, { bevel: 0.005 });
  k.rail(-0.15, 0.3, 0.1, 0.024);
  k.box('dark', -0.06, 0.06, 0.05, 0.08, 0.004, 0.0255);
  k.side('furn', [[-0.16, 0.09], [-0.48, 0.085], [-0.49, 0.075], [-0.49, -0.085], [-0.475, -0.095], [-0.4, -0.06], [-0.2, 0.0], [-0.16, 0.01]], 0.045,
    { bevel: 0.005, holes: [[[-0.21, 0.07], [-0.43, 0.068], [-0.43, -0.05], [-0.38, -0.04], [-0.22, 0.02]]] });
  k.box('poly', -0.5, -0.485, -0.09, 0.08, 0.05);
  pistolGrip(k, 'poly');
  triggerGroup(k);
  k.mag(() => k.box('steel', 0.03, 0.115, -0.13, -0.055, 0.04));
  k.side('alu', round(0.32, 0.02, 0.62, 0.09, 0.012), 0.056, { bevel: 0.004, holes: [round(0.35, 0.045, 0.42, 0.065, 0.008), round(0.45, 0.045, 0.52, 0.065, 0.008), round(0.55, 0.045, 0.6, 0.065, 0.008)] });
  k.cyl('steel', 0.62, 0.98, 0.058, 0.015, { seg: 20 });
  const end = muzzle(k, 'big', 0.98, 0.058);
  bipod(k, 0.55, 0.018);
  return { muzzle: end, bore: 0.058, rail: 0.1085, opticU: 0.06, gripL: [0.36, 0.015] };
};

// Mitrailleuse légère type M249 (chargeur boîte)
T.saw = (k, w) => {
  k.side('alu', [[-0.16, 0.1], [0.18, 0.1], [0.2, 0.09], [0.2, 0.0], [0.08, -0.014], [-0.06, -0.014], [-0.16, 0.0]], 0.06, { bevel: 0.005 });
  k.side('steel', [[-0.12, 0.1], [0.16, 0.1], [0.16, 0.112], [-0.1, 0.116], [-0.12, 0.11]], 0.056, { bevel: 0.004 });
  k.rail(-0.08, 0.15, 0.115);
  pistolGrip(k, 'poly', -0.01);
  triggerGroup(k, -0.022, 0.048, -0.01);
  k.mag(() => {
    k.side('furn', round(0.03, -0.14, 0.16, -0.012, 0.012), 0.08, { bevel: 0.006 });
    k.box('dark', 0.05, 0.14, -0.1, -0.06, 0.082);
  });
  boxStock(k, 'furn', -0.16, -0.48, 0.09, -0.075, 0.046, true);
  k.side('furn', round(0.2, 0.02, 0.38, 0.09, 0.012), 0.06, { bevel: 0.005 });
  k.cyl('steel', 0.2, 0.74, 0.06, 0.0125, { seg: 20 });
  k.box('steel', 0.38, 0.62, 0.075, 0.08, 0.03);
  k.cylY('steel', 0.3, 0.1, 0.14, 0.005, 0);
  k.box('poly', 0.24, 0.36, 0.135, 0.145, 0.02);
  const end = muzzle(k, 'flash', 0.74, 0.06, 0.0125);
  bipod(k, 0.6, 0.045);
  k.box('glow', -0.1, 0.12, 0.07, 0.073, 0.002, -0.031);
  return { muzzle: end, bore: 0.06, rail: 0.1235, opticU: 0.03, gripL: [0.3, 0.02] };
};

// Mitrailleuse type M60 (poignée de transport sur le canon)
T.m60 = (k, w) => {
  k.side('steel', [[-0.18, 0.095], [0.22, 0.095], [0.24, 0.085], [0.24, 0.0], [0.1, -0.014], [-0.08, -0.014], [-0.18, 0.0]], 0.056, { bevel: 0.005 });
  k.rail(-0.12, 0.2, 0.095);
  pistolGrip(k, 'furn');
  triggerGroup(k);
  k.mag(() => k.side('furn', round(0.02, -0.15, 0.17, -0.014, 0.01), 0.07, { bevel: 0.005 }));
  boxStock(k, 'furn', -0.18, -0.52, 0.085, -0.08, 0.046);
  k.side('furn', round(0.24, 0.018, 0.44, 0.085, 0.02), 0.056, { bevel: 0.006 });
  k.cyl('steel', 0.24, 0.8, 0.055, 0.013, { seg: 20 });
  k.cylY('steel', 0.5, 0.06, 0.11, 0.005, 0);
  k.box('poly', 0.43, 0.57, 0.105, 0.116, 0.022);
  const end = muzzle(k, 'flash', 0.8, 0.055, 0.013);
  bipod(k, 0.66, 0.04);
  return { muzzle: end, bore: 0.055, rail: 0.1035, opticU: 0.04, gripL: [0.33, 0.015] };
};

// Pistolet à percussion (type polymère)
T.glock = (k, w) => {
  k.side('steel', [[-0.07, 0.06], [0.115, 0.06], [0.12, 0.054], [0.12, 0.028], [-0.072, 0.028], [-0.075, 0.052]], 0.026, { bevel: 0.003 });
  for (let u = -0.065; u < -0.035; u += 0.006) k.box('dark', u, u + 0.0025, 0.032, 0.056, 0.027);
  k.box('dark', -0.01, 0.04, 0.05, 0.06, 0.004, 0.0122);
  k.side('poly', [[-0.062, 0.03], [0.112, 0.03], [0.112, 0.012], [0.04, 0.008], [0.03, -0.004], [-0.06, 0.004]], 0.024, { bevel: 0.003 });
  k.side('poly', [[-0.058, 0.006], [-0.016, 0.004], [-0.02, -0.04], [-0.026, -0.085], [-0.03, -0.098], [-0.07, -0.096], [-0.072, -0.086], [-0.064, -0.03], [-0.07, 0.0]], 0.026, { bevel: 0.004 });
  triggerGroup(k, -0.014, 0.04, 0.004);
  k.mag(() => k.box('poly', -0.074, -0.026, -0.104, -0.094, 0.028));
  k.box('steel', 0.1, 0.108, 0.06, 0.066, 0.004);
  k.box('steel', -0.066, -0.058, 0.06, 0.066, 0.016);
  k.box('glow', -0.03, 0.08, 0.034, 0.036, 0.002, -0.0128);
  return { muzzle: 0.122, bore: 0.046, rail: 0.06, opticU: 0, sightY: 0.0665, gripL: [-0.02, -0.05], pistol: true, noRail: true };
};

// Revolver
T.revolver = (k, w) => {
  k.side('steel', [[-0.05, 0.06], [0.04, 0.062], [0.05, 0.058], [0.05, 0.016], [0.0, 0.004], [-0.03, 0.0], [-0.06, 0.03]], 0.024, { bevel: 0.003 });
  k.mag(() => {
    k.cyl('steel', -0.008, 0.038, 0.038, 0.021, { seg: 6 });
    k.cyl('dark', -0.009, 0.039, 0.038, 0.006, { seg: 12 });
  });
  k.cyl('steel', 0.05, 0.17, 0.046, 0.009, { seg: 18 });
  k.box('steel', 0.05, 0.17, 0.052, 0.061, 0.01);
  k.cyl('steel', 0.05, 0.16, 0.031, 0.0055);
  k.side('furn', [[-0.06, 0.012], [-0.022, 0.006], [-0.026, -0.04], [-0.034, -0.088], [-0.04, -0.096], [-0.072, -0.092], [-0.074, -0.08], [-0.066, -0.03], [-0.07, 0.01]], 0.03, { bevel: 0.005 });
  triggerGroup(k, -0.016, 0.03, 0.0);
  k.box('steel', -0.058, -0.04, 0.06, 0.07, 0.008);
  k.box('steel', 0.16, 0.166, 0.061, 0.068, 0.003);
  return { muzzle: 0.17, bore: 0.046, rail: 0.06, opticU: 0, sightY: 0.066, gripL: [-0.02, -0.05], pistol: true, noRail: true };
};

const TEMPLATE_OF = {
  vk12: 'm4', kr9: 'ak', m21: 'scar', arx: 'bullpup', hv47: 'battle',
  k3: 'mp7', frelon: 'mp5', razor: 'vector',
  brise: 'pump', dragon: 'saiga', krait: 'double',
  lance: 'bolt', sentinelle: 'dmr', eclipse: 'fifty',
  colosse: 'saw', rempart: 'm60',
  mamba: 'glock', cobra: 'revolver',
};

const OPTIC_OF = { dot: 'dot', holo: 'holo', scope: 'scope', sniper: 'sniper', iron: 'iron' };

/**
 * Construit le modèle complet d'une arme.
 * Renvoie { group, mag, muzzle, sightY, gripR, gripL, length, pistol }.
 */
export function buildWeapon(def) {
  const k = new Kit();
  const mats = weaponMaterials(def);
  const tpl = T[TEMPLATE_OF[def.id] || 'm4'];
  const info = tpl(k, def);
  let sightY;
  if (info.sightY) sightY = info.sightY;
  else if (def.scope === 'iron' || info.noRail) {
    sightY = info.noRail ? info.rail + 0.004 : optic(k, 'iron', -0.02, info.rail);
    if (!info.noRail) frontPost(k, info.muzzle - 0.06, info.bore, sightY);
  } else sightY = optic(k, OPTIC_OF[def.scope] || 'dot', info.opticU, info.rail);

  const { group, mag } = k.build(mats);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, info.bore, -info.muzzle - 0.01);
  group.add(muzzle);
  const eject = new THREE.Object3D();
  eject.position.set(0.03, info.bore, -0.03);
  group.add(eject);
  return {
    group, mag, muzzle, eject, sightY,
    gripR: new THREE.Vector3(0, -0.045, 0.036),
    gripL: new THREE.Vector3(info.pistol ? -0.012 : -0.008, info.gripL[1] - 0.012, -info.gripL[0]),
    length: info.muzzle,
    opticU: info.noRail || def.scope === 'iron' ? -0.02 : info.opticU,
    pistol: !!info.pistol,
    pumpMag: !!info.pumpMag,
  };
}
