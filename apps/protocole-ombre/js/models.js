// Modèles 3D procéduraux : armes (vue à la première personne et aperçu
// armurerie) et soldats (troisième personne, animés).
import * as THREE from 'three';
import { getTexture } from './textures.js';

const BODY = { urban: '#5a6068', tan: '#a08a64', black: '#1d2024', carbon: '#2a2c33', olive: '#4c5638' };

const matCache = new Map();
function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
const std = (color, rough = 0.5, metal = 0.3, map = null) =>
  mat(`std:${color}:${rough}:${metal}:${map}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: map ? getTexture(map) : null }));
const glow = (color, k = 3) =>
  mat(`glow:${color}:${k}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }));

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function cyl(r, len, m, x = 0, y = 0, z = 0, axis = 'z', seg = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Modèle d'arme orienté vers -Z, origine à la poignée.
 * Renvoie { group, muzzle (Object3D), sight (hauteur de la ligne de visée), mag }.
 */
export function buildWeaponModel(w) {
  const m = w.model;
  const g = new THREE.Group();
  const body = std(BODY[m.body] || BODY.black, 0.55, 0.25, 'metal');
  const dark = std('#18191c', 0.4, 0.8);
  const metal = std('#3a3d42', 0.3, 0.9, 'metal');
  const acc = glow(m.accent, 2.5);
  let muzzleZ, sightY;

  if (m.pistol) {
    const L = m.len;
    g.add(box(0.034, 0.05, L, body, 0, 0.045, -L / 2 + 0.04));            // culasse
    g.add(box(0.03, 0.03, L * 0.8, dark, 0, 0.008, -L * 0.4 + 0.04));      // carcasse
    g.add(box(0.03, 0.1, 0.045, dark, 0, -0.045, 0.02).rotateX(-0.25));    // poignée
    g.add(box(0.036, 0.006, L * 0.6, acc, 0, 0.072, -L / 2 + 0.06));
    if (m.revolver) g.add(cyl(0.026, 0.05, metal, 0, 0.03, -0.03, 'z', 8));
    g.add(box(0.006, 0.012, 0.006, dark, 0, 0.076, -L + 0.06));
    muzzleZ = -L + 0.03; sightY = 0.078;
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.045, muzzleZ); g.add(muzzle);
    return { group: g, muzzle, sightY };
  }

  const L = m.len;
  const recv = L * 0.42;
  const heavy = m.heavy ? 1.25 : 1;
  // Boîte de culasse et garde-main
  g.add(box(0.055 * heavy, 0.085 * heavy, recv, body, 0, 0.03, -recv / 2 + 0.06));
  g.add(box(0.05 * heavy, 0.07, L * 0.32, dark, 0, 0.035, -recv - L * 0.16 + 0.06));
  g.add(box(0.052 * heavy, 0.008, L * 0.3, acc, 0, 0.072, -recv - L * 0.15 + 0.06));
  g.add(box(0.008, 0.012, L * 0.25, acc, 0.03 * heavy, 0.03, -recv - L * 0.15 + 0.06));
  // Rail supérieur
  g.add(box(0.03, 0.012, recv * 0.9, metal, 0, 0.078 * heavy, -recv / 2 + 0.05));
  // Canon(s)
  const barrelLen = m.barrel + L * 0.25;
  const bz = -recv - L * 0.32 + 0.06;
  if (m.double) {
    g.add(cyl(0.02, barrelLen + L * 0.3, metal, -0.021, 0.035, bz + 0.05));
    g.add(cyl(0.02, barrelLen + L * 0.3, metal, 0.021, 0.035, bz + 0.05));
    muzzleZ = bz + 0.05 - (barrelLen + L * 0.3) / 2;
  } else {
    g.add(cyl(0.013 * heavy, barrelLen, metal, 0, 0.04, bz - barrelLen / 2 + 0.04));
    muzzleZ = bz - barrelLen + 0.04;
    g.add(box(0.03, 0.03, 0.06, dark, 0, 0.04, muzzleZ + 0.02)); // frein de bouche
  }
  // Poignée pistolet
  g.add(box(0.035, 0.1, 0.045, dark, 0, -0.045, 0.06).rotateX(-0.3));
  // Chargeur
  const magG = new THREE.Group();
  const mz = m.stock === 'bullpup' ? 0.16 : -0.06;
  switch (m.mag) {
    case 'curved': {
      const a = box(0.03, 0.13, 0.05, dark, 0, -0.06, 0); a.rotation.x = 0.25; magG.add(a); break;
    }
    case 'straight': magG.add(box(0.028, 0.12, 0.045, dark, 0, -0.06, 0)); break;
    case 'drum': magG.add(cyl(0.06, 0.05, dark, 0, -0.06, 0, 'x', 16)); break;
    case 'box': magG.add(box(0.04, 0.08, 0.07, dark, 0, -0.035, 0)); break;
    case 'tube': g.add(cyl(0.016, L * 0.5, metal, 0, 0.005, -recv - L * 0.1)); break;
    default: break;
  }
  magG.position.set(0, 0, mz);
  g.add(magG);
  // Crosse
  switch (m.stock) {
    case 'fixed': g.add(box(0.045, 0.08, 0.22, body, 0, 0.01, 0.2)); g.add(box(0.05, 0.1, 0.02, dark, 0, 0.0, 0.31)); break;
    case 'skeleton':
      g.add(box(0.012, 0.012, 0.22, metal, 0, 0.05, 0.2)); g.add(box(0.012, 0.012, 0.22, metal, 0, -0.02, 0.2));
      g.add(box(0.04, 0.09, 0.02, dark, 0, 0.015, 0.31)); break;
    case 'bullpup': g.add(box(0.055, 0.09, 0.2, body, 0, 0.025, 0.18)); break;
    case 'sniper': g.add(box(0.05, 0.1, 0.28, body, 0, 0.0, 0.23)); g.add(box(0.04, 0.04, 0.1, dark, 0, 0.065, 0.2)); break;
    case 'folded': g.add(box(0.01, 0.06, 0.12, metal, 0.035, 0.02, 0.0)); break;
    default: break;
  }
  // Visée
  sightY = 0.1 * heavy;
  switch (w.scope) {
    case 'dot':
      g.add(box(0.035, 0.035, 0.05, dark, 0, 0.1, -0.02));
      g.add(box(0.026, 0.026, 0.004, glow('#ff3030', 1.5), 0, 0.1, -0.044));
      sightY = 0.1; break;
    case 'holo':
      g.add(box(0.045, 0.012, 0.07, dark, 0, 0.088, -0.02));
      g.add(box(0.006, 0.045, 0.06, dark, -0.02, 0.11, -0.02));
      g.add(box(0.006, 0.045, 0.06, dark, 0.02, 0.11, -0.02));
      g.add(box(0.006, 0.006, 0.06, acc, 0, 0.133, -0.02));
      sightY = 0.11; break;
    case 'scope':
    case 'sniper': {
      const sl = w.scope === 'sniper' ? 0.3 : 0.2;
      g.add(cyl(0.024, sl, dark, 0, 0.11, -0.04));
      g.add(cyl(0.032, 0.05, dark, 0, 0.11, -0.04 - sl / 2));
      g.add(cyl(0.03, 0.04, dark, 0, 0.11, -0.04 + sl / 2));
      g.add(box(0.02, 0.03, 0.02, metal, 0, 0.09, -0.02));
      sightY = 0.11; break;
    }
    default:
      g.add(box(0.008, 0.02, 0.01, dark, 0, 0.09, 0.05));
      g.add(box(0.005, 0.02, 0.005, dark, 0, 0.065, muzzleZ + 0.06));
      sightY = 0.095;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.04, muzzleZ - 0.02);
  g.add(muzzle);
  return { group: g, muzzle, sightY, mag: magG };
}

// ──────────────────────────────────────────────────────────── Soldats

const TEAM_STYLE = [
  { armor: '#2c3a4a', plate: '#46607a', visor: '#19e6ff', cloth: '#1e252e' },
  { armor: '#3a2e26', plate: '#6a4a32', visor: '#ff4a1a', cloth: '#26201c' },
];

const sharedGeo = {};
const G = (key, make) => (sharedGeo[key] ||= make());

export class Soldier {
  constructor(team, name = '', showName = false) {
    const s = TEAM_STYLE[team] || TEAM_STYLE[1];
    const armor = std(s.armor, 0.55, 0.45, 'panelDark');
    const plate = std(s.plate, 0.4, 0.6, 'metal');
    const cloth = std(s.cloth, 0.9, 0.05);
    const visor = glow(s.visor, 2.6);
    const dark = std('#121316', 0.4, 0.7);

    const root = new THREE.Group();
    const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
    const torso = new THREE.Group(); hips.add(torso);
    const mk = (geoKey, w, h, d, m, x, y, z, parent) => {
      const mesh = new THREE.Mesh(G(geoKey, () => new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(x, y, z); mesh.castShadow = true;
      parent.add(mesh); return mesh;
    };
    mk('pelvis', 0.36, 0.16, 0.22, cloth, 0, 0.02, 0, hips);
    mk('chest', 0.46, 0.5, 0.26, armor, 0, 0.36, 0, torso);
    mk('plate', 0.4, 0.3, 0.06, plate, 0, 0.42, -0.15, torso);
    mk('belt', 0.42, 0.06, 0.24, dark, 0, 0.12, 0, torso);
    // Propulseur dorsal
    mk('pack', 0.34, 0.36, 0.14, dark, 0, 0.38, 0.19, torso);
    for (const x of [-0.1, 0.1]) {
      const t = new THREE.Mesh(G('thr', () => new THREE.CylinderGeometry(0.045, 0.055, 0.2, 10)), plate);
      t.position.set(x, 0.24, 0.27); torso.add(t);
      const f = new THREE.Mesh(G('thrf', () => new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10)), visor);
      f.position.set(x, 0.135, 0.27); torso.add(f);
    }
    mk('stripe', 0.02, 0.22, 0.01, visor, 0.16, 0.42, -0.183, torso);
    // Tête
    const head = new THREE.Group(); head.position.set(0, 0.7, 0); torso.add(head);
    mk('neck', 0.1, 0.08, 0.1, cloth, 0, -0.02, 0, head);
    mk('helmet', 0.24, 0.24, 0.27, armor, 0, 0.12, 0.01, head);
    mk('visor', 0.22, 0.07, 0.04, visor, 0, 0.14, -0.13, head);
    mk('jaw', 0.18, 0.06, 0.06, dark, 0, 0.05, -0.12, head);
    mk('ant', 0.015, 0.14, 0.015, dark, 0.1, 0.28, 0.06, head);

    // Bras (tiennent l'arme)
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.29, 0.56, 0); torso.add(sh);
      mk('uarm', 0.12, 0.3, 0.13, armor, 0, -0.14, 0, sh);
      mk('pad', 0.15, 0.1, 0.16, plate, 0, -0.01, 0, sh);
      const el = new THREE.Group(); el.position.set(0, -0.28, 0); sh.add(el);
      mk('farm', 0.1, 0.28, 0.11, cloth, 0, -0.13, 0, el);
      mk('glove', 0.1, 0.08, 0.1, dark, 0, -0.29, 0, el);
      return { sh, el };
    };
    const armR = arm(1), armL = arm(-1);
    // Pose de visée
    armR.sh.rotation.set(1.2, 0, -0.1); armR.el.rotation.set(0.45, 0, 0);
    armL.sh.rotation.set(1.3, 0, 0.62); armL.el.rotation.set(0.35, 0, 0);
    // Arme tenue
    const gun = new THREE.Group();
    gun.position.set(0.1, 0.42, -0.42); torso.add(gun);
    gun.add(new THREE.Mesh(G('gunB', () => new THREE.BoxGeometry(0.07, 0.11, 0.62)), dark));
    const gl = new THREE.Mesh(G('gunG', () => new THREE.BoxGeometry(0.075, 0.012, 0.3)), visor);
    gl.position.set(0, 0.06, -0.08); gun.add(gl);
    const mag = new THREE.Mesh(G('gunM', () => new THREE.BoxGeometry(0.04, 0.14, 0.06)), dark);
    mag.position.set(0, -0.1, -0.05); gun.add(mag);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.02, -0.34); gun.add(this.muzzle);

    // Jambes
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.11, 0, 0); hips.add(hip);
      mk('uleg', 0.16, 0.44, 0.18, cloth, 0, -0.22, 0, hip);
      mk('kpad', 0.15, 0.12, 0.06, plate, 0, -0.42, -0.1, hip);
      const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      mk('lleg', 0.14, 0.42, 0.16, armor, 0, -0.21, 0, knee);
      mk('boot', 0.15, 0.1, 0.26, dark, 0, -0.45, -0.04, knee);
      return { hip, knee };
    };
    this.legR = leg(1); this.legL = leg(-1);

    if (showName && name) {
      const sp = nameSprite(name, s.visor);
      sp.position.set(0, 2.15, 0);
      root.add(sp);
      this.nameSprite = sp;
    }

    this.root = root; this.hips = hips; this.torso = torso; this.head = head;
    this.armR = armR; this.armL = armL; this.gun = gun;
    this.phase = Math.random() * 10;
    this.deathT = -1;
    this.flash = null;
  }

  /** speed : vitesse horizontale (m/s), crouch 0..1, pitch : tangage de visée. */
  animate(dt, { speed, crouch, pitch, airborne, alive }) {
    if (!alive) {
      if (this.deathT < 0) { this.deathT = 0; this.fallDir = Math.random() < 0.5 ? -1 : 1; }
      this.deathT = Math.min(1, this.deathT + dt * 2.6);
      const t = this.deathT;
      const e = t * t * (3 - 2 * t);
      this.hips.rotation.x = e * 1.45;
      this.hips.rotation.z = e * 0.3 * this.fallDir;
      this.hips.position.y = 0.95 - e * 0.72;
      this.legL.knee.rotation.x = this.legR.knee.rotation.x = e * 0.6;
      return;
    }
    if (this.deathT >= 0) { this.deathT = -1; this.hips.rotation.set(0, 0, 0); }
    const moving = Math.min(1, speed / 5);
    this.phase += dt * (4 + speed * 1.4);
    const sw = Math.sin(this.phase) * 0.75 * moving;
    const crouchK = crouch;
    this.hips.position.y = 0.95 - crouchK * 0.38 + Math.abs(Math.cos(this.phase)) * 0.04 * moving;
    this.legR.hip.rotation.x = sw - crouchK * 1.1;
    this.legL.hip.rotation.x = -sw - crouchK * 1.1;
    this.legR.knee.rotation.x = Math.max(0, -Math.sin(this.phase + 0.6)) * 0.9 * moving + crouchK * 1.7;
    this.legL.knee.rotation.x = Math.max(0, Math.sin(this.phase + 0.6)) * 0.9 * moving + crouchK * 1.7;
    if (airborne) { this.legR.hip.rotation.x = -0.6; this.legL.hip.rotation.x = 0.2; this.legR.knee.rotation.x = 1.1; this.legL.knee.rotation.x = 0.4; }
    this.torso.rotation.x = Math.max(-0.7, Math.min(0.7, pitch)) * 0.7 + crouchK * 0.15;
    this.head.rotation.x = Math.max(-0.5, Math.min(0.5, pitch)) * 0.4;
    this.torso.rotation.y = Math.sin(this.phase) * 0.06 * moving;
    if (this.flash) {
      this.flash.t -= dt;
      this.flash.mesh.visible = this.flash.t > 0;
    }
  }

  dispose() {
    if (this.nameSprite) { this.nameSprite.material.map.dispose(); this.nameSprite.material.dispose(); }
  }
}

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 48;
  const g = c.getContext('2d');
  g.font = '700 28px Rajdhani, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillText(text, 129, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  sp.scale.set(1.3, 0.25, 1);
  sp.renderOrder = 5;
  return sp;
}
