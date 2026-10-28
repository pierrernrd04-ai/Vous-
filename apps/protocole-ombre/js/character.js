// Personnage humain : modèle riggé (squelette Mixamo) animé en repos / marche /
// course, avec corrections procédurales par-dessus l'animation :
//   - torsion du bas du corps vers la direction de déplacement (pas latéraux,
//     marche arrière),
//   - accroupi (hanches abaissées, genoux pliés),
//   - posture de tir (buste tourné, visée en hauteur),
//   - bras positionnés par cinématique inverse (IK à deux os) sur l'arme,
//     doigts refermés sur la poignée et le garde-main,
//   - chute à la mort.
// Chaque équipe a sa faction : armure recolorée et lumières de visière.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { assets } from './assets.js';
import { buildWeapon } from './gunsmith.js';

export const FACTIONS = [
  { name: 'SPECTRES', armor: '#34598c', suit: '#161c26', light: '#2ee6ff', tag: '#4fd8ff' },
  { name: 'LÉGION ROUGE', armor: '#8c2f24', suit: '#241815', light: '#ff5a1a', tag: '#ff5a3c' },
];

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// ──────────────────────────────────────────────── matériaux de faction

const factionMats = new Map();
function factionMaterials(team, srcBody, srcVisor) {
  const key = `${team}`;
  if (factionMats.has(key)) return factionMats.get(key);
  const f = FACTIONS[team] || FACTIONS[1];
  const body = srcBody.clone();
  body.roughness = 0.74; body.metalness = 0.06;
  const armor = new THREE.Color(f.armor), suit = new THREE.Color(f.suit);
  body.onBeforeCompile = (sh) => {
    sh.uniforms.uArmor = { value: armor };
    sh.uniforms.uSuit = { value: suit };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uArmor;\nuniform vec3 uSuit;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          // Les plaques d'armure (teintes chaudes de la texture) prennent la couleur de la faction.
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float warm = clamp((diffuseColor.r - diffuseColor.b) * 3.4 - 0.12, 0.0, 1.0) * smoothstep(0.08, 0.2, diffuseColor.r);
          vec3 plate = uArmor * (0.16 + lum * 1.05);
          vec3 cloth = mix(diffuseColor.rgb, uSuit * (0.5 + lum * 2.4), 0.45);
          diffuseColor.rgb = mix(cloth, plate, warm);
        }`);
  };
  body.customProgramCacheKey = () => `faction-${team}`;
  const visor = srcVisor.clone();
  visor.emissive = new THREE.Color(f.light);
  visor.emissiveIntensity = 0.85;
  visor.color = new THREE.Color('#111418');
  visor.roughness = 0.15; visor.metalness = 0.9;
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(f.light).multiplyScalar(2.6), toneMapped: false });
  const out = { body, visor, glow };
  factionMats.set(key, out);
  return out;
}

// ──────────────────────────────────────────────── outils osseux

/** Applique une rotation exprimée dans le repère monde à un os. */
function rotateWorld(bone, axis, angle) {
  if (!angle) return;
  bone.parent.getWorldQuaternion(_q1);
  bone.getWorldQuaternion(_q2);
  _q3.setFromAxisAngle(axis, angle).multiply(_q2);
  bone.quaternion.copy(_q1.invert().multiply(_q3));
  bone.updateMatrixWorld(true);
}

/** Oriente un os pour que la direction monde `from` devienne `to`. */
function aimBone(bone, from, to) {
  _q3.setFromUnitVectors(from.normalize(), to.normalize());
  bone.parent.getWorldQuaternion(_q1);
  bone.getWorldQuaternion(_q2);
  _q3.multiply(_q2);
  bone.quaternion.copy(_q1.invert().multiply(_q3));
  bone.updateMatrixWorld(true);
}

/** Fixe l'orientation monde d'un os. */
function setWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(_q1);
  bone.quaternion.copy(_q1.invert().multiply(q));
  bone.updateMatrixWorld(true);
}

/** IK analytique à deux os (épaule → coude → poignet). */
function solveArm(upper, lower, hand, target, pole) {
  const a = upper.getWorldPosition(new THREE.Vector3());
  const b = lower.getWorldPosition(new THREE.Vector3());
  const c = hand.getWorldPosition(new THREE.Vector3());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const dir = target.clone().sub(a);
  const d = clamp(dir.length(), 0.05, (l1 + l2) * 0.998);
  dir.normalize();
  const pd = pole.clone().sub(a);
  pd.sub(dir.clone().multiplyScalar(pd.dot(dir))).normalize();
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const elbow = a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(pd, l1 * Math.sqrt(1 - cosA * cosA));
  aimBone(upper, b.clone().sub(a), elbow.clone().sub(a));
  const b2 = lower.getWorldPosition(new THREE.Vector3());
  const c2 = hand.getWorldPosition(new THREE.Vector3());
  const goal = a.clone().addScaledVector(dir, d);
  aimBone(lower, c2.sub(b2), goal.sub(b2));
}

/** Quaternion à partir de trois axes monde (x, y, z orthonormés). */
function basisQuat(x, y, z, out = new THREE.Quaternion()) {
  _m1.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m1);
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

/**
 * Géométrie « bras seuls » pour la vue subjective : on ne garde que les
 * triangles dont les sommets sont principalement liés aux os des bras.
 */
let armsGeometry = null;
function armsOnly(mesh) {
  if (armsGeometry) return armsGeometry;
  const g = mesh.geometry;
  const bones = mesh.skeleton.bones;
  const keep = new Set();
  bones.forEach((b, i) => { if (/(Arm|ForeArm|Hand)/.test(b.name) && !/Shoulder/.test(b.name)) keep.add(i); });
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const dominant = new Int32Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
    dominant[v] = best;
  }
  const idx = g.index.array, out = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (keep.has(dominant[idx[t]]) && keep.has(dominant[idx[t + 1]]) && keep.has(dominant[idx[t + 2]])) out.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  armsGeometry = g.clone();
  armsGeometry.setIndex(out);
  return armsGeometry;
}

// ──────────────────────────────────────────────── personnage

export class Character {
  /**
   * opts : { team, name, showName, weapon (définition), firstPerson }
   * En vue à la première personne, seuls les bras et l'arme sont visibles.
   */
  constructor(opts) {
    const src = assets.soldier;
    this.team = opts.team;
    this.fp = !!opts.firstPerson;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();     // pivot de chute à la mort
    this.root.add(this.pivot);
    this.model = SkeletonUtils.clone(src.scene);
    this.pivot.add(this.model);
    this.bones = {};
    let bodySrc = null, visorSrc = null;
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace('mixamorig', '')] = o;
      if (o.isSkinnedMesh) {
        if (o.name.includes('visor')) visorSrc = o.material; else bodySrc = o.material;
        o.frustumCulled = false;
        o.castShadow = !this.fp;
      }
    });
    const mats = factionMaterials(this.team, bodySrc, visorSrc);
    this.model.traverse((o) => { if (o.isSkinnedMesh) o.material = o.name.includes('visor') ? mats.visor : mats.body; });

    // Balises lumineuses de faction (dos et épaule) : reconnaissables de loin.
    if (!this.fp) {
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 1.2), mats.glow);
      beacon.position.set(0, 8, -14);
      this.bones.Spine2.add(beacon);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 2.2, 12), mats.glow);
      band.position.set(0, 12, 0);
      this.bones.LeftArm.add(band);
    }

    // Animation
    this.mixer = new THREE.AnimationMixer(this.model);
    const clip = (n) => src.animations.find((c) => c.name === n);
    this.actions = {};
    for (const n of ['Idle', 'Walk', 'Run']) {
      const a = this.mixer.clipAction(clip(n));
      a.play();
      a.setEffectiveWeight(n === 'Idle' ? 1 : 0);
      a.time = Math.random() * clip(n).duration;
      this.actions[n] = a;
    }

    this.lowerYaw = 0;
    this.crouchK = 0;
    this.aimK = 1;
    this.deathT = -1;
    this.flinch = 0;
    this.weaponCache = new Map();
    this.setWeapon(opts.weapon);
    if (opts.showName && opts.name) this._nameTag(opts.name, opts.tagColor || FACTIONS[this.team]?.tag || '#fff');

    if (this.fp) {
      // Vue subjective : seuls les bras sont dessinés (pas de torse ni de tête devant la caméra).
      this.model.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        if (o.name.includes('visor')) o.visible = false;
        else o.geometry = armsOnly(o);
      });
    }
  }

  setWeapon(def) {
    if (this.weapon && this.weapon.def === def) return;
    if (this.weapon) this.weapon.group.parent?.remove(this.weapon.group);
    let w = this.weaponCache.get(def.id);
    if (!w) {
      w = buildWeapon(def);
      w.def = def;
      w.group.traverse((o) => { if (o.isMesh) o.castShadow = !this.fp; });
      this.weaponCache.set(def.id, w);
    }
    this.root.add(w.group);
    this.weapon = w;
    this.muzzle = w.muzzle;
  }

  _nameTag(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 48;
    const g = c.getContext('2d');
    g.font = '700 30px Rajdhani, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(text, 129, 35);
    g.fillStyle = color; g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
    sp.scale.set(1.25, 0.24, 1);
    sp.position.y = 2.12;
    sp.renderOrder = 5;
    this.root.add(sp);
    this.tag = sp;
  }

  showTag(on) { this.tagOn = on; if (this.tag) this.tag.visible = on && this.deathT < 0; }

  hit() { this.flinch = 1; }

  /**
   * s : { speed, moveYaw (direction du déplacement relative au regard, rad),
   *       crouch (0..1), pitch, airborne, alive, ads (0..1) }
   */
  animate(dt, s) {
    const B = this.bones;
    if (!s.alive) return this._dead(dt);
    if (this.deathT >= 0) this._revive();

    // ── Mélange des animations de locomotion
    const sp = s.speed || 0;
    let back = false;
    let yawTarget = 0;
    if (sp > 0.4 && s.moveYaw !== undefined) {
      let my = s.moveYaw;
      if (Math.abs(my) > 1.9) { back = true; my = my > 0 ? my - Math.PI : my + Math.PI; }
      yawTarget = clamp(my, -1.1, 1.1);
    }
    this.lowerYaw = damp(this.lowerYaw, yawTarget, 8, dt);
    const idleW = clamp(1 - sp / 1.6, 0, 1);
    const runW = this.fp ? 0 : clamp((sp - 3.4) / 2.4, 0, 1);
    const walkW = Math.max(0, 1 - idleW - runW);
    const A = this.actions;
    A.Idle.setEffectiveWeight(idleW);
    A.Walk.setEffectiveWeight(walkW);
    A.Run.setEffectiveWeight(runW);
    A.Walk.setEffectiveTimeScale(clamp(sp / 1.7, 0.6, 1.7) * (back ? -1 : 1));
    A.Run.setEffectiveTimeScale(clamp(sp / 5.6, 0.8, 1.35) * (back ? -1 : 1));
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);

    const fwd = _v1.set(0, 0, -1).applyQuaternion(this.root.getWorldQuaternion(_q2)).setY(0).normalize();
    const right = _v2.crossVectors(fwd, UP).normalize();

    // ── Bas du corps orienté vers le déplacement, buste vers la visée
    if (!this.fp) {
      rotateWorld(B.Hips, UP, this.lowerYaw);
      rotateWorld(B.Spine, UP, -this.lowerYaw * 0.5);
      rotateWorld(B.Spine1, UP, -this.lowerYaw * 0.5);
    }

    // ── Accroupi
    this.crouchK = damp(this.crouchK, s.crouch ? 1 : 0, 10, dt);
    const ck = this.crouchK;
    if (ck > 0.01 && !this.fp) {
      B.Hips.position.z -= 33 * ck;          // repère du rig : Z vers le haut, en centimètres
      B.Hips.updateMatrixWorld(true);
      for (const side of ['Left', 'Right']) {
        rotateWorld(B[`${side}UpLeg`], right, 0.95 * ck);
        rotateWorld(B[`${side}Leg`], right, -1.7 * ck);
        rotateWorld(B[`${side}Foot`], right, 0.65 * ck);
      }
      rotateWorld(B.Spine, right, 0.28 * ck);
    }
    if (s.airborne && !this.fp) {
      rotateWorld(B.RightUpLeg, right, 0.7); rotateWorld(B.RightLeg, right, -1.1);
      rotateWorld(B.LeftUpLeg, right, 0.25); rotateWorld(B.LeftLeg, right, -0.5);
    }

    // ── Posture de tir : buste tourné (épaule gauche en avant) et visée verticale
    const pitch = clamp(s.pitch || 0, -1.2, 1.2);
    const pistol = this.weapon.pistol;
    if (!this.fp) {
      const twist = pistol ? -0.12 : -0.42;
      rotateWorld(B.Spine1, UP, twist * 0.5);
      rotateWorld(B.Spine2, UP, twist * 0.5);
      rotateWorld(B.Spine1, right, pitch * 0.3);
      rotateWorld(B.Spine2, right, pitch * 0.3);
      rotateWorld(B.Neck, UP, -twist * 0.6);
      rotateWorld(B.Head, UP, -twist * 0.4);
      rotateWorld(B.Head, right, pitch * 0.35);
      if (this.flinch > 0) {
        rotateWorld(B.Spine2, right, -this.flinch * 0.18);
        this.flinch = Math.max(0, this.flinch - dt * 6);
      }
    }

    // ── Arme : calée à l'épaule droite (fusils) ou tenue à deux mains devant (pistolets)
    if (!this.fp) this._placeWeapon(fwd, right, pitch, pistol);
    else {
      // Vue subjective : épaule gauche avancée pour atteindre le garde-main.
      rotateWorld(B.Spine1, UP, pistol ? -0.08 : -0.24);
      rotateWorld(B.Spine2, UP, pistol ? -0.08 : -0.24);
    }
    this._armsIK(fwd, right, s.leftTarget || null);
  }

  _placeWeapon(fwd, right, pitch, pistol) {
    const B = this.bones;
    const aim = _v3.copy(fwd).applyAxisAngle(right, pitch);
    const up = _v4.crossVectors(right, aim).normalize();
    const sh = B.RightArm.getWorldPosition(new THREE.Vector3());
    const pos = new THREE.Vector3();
    if (pistol) {
      const chest = B.Spine2.getWorldPosition(new THREE.Vector3());
      pos.copy(chest).addScaledVector(aim, 0.46).addScaledVector(up, -0.02).addScaledVector(right, 0.03);
    } else {
      pos.copy(sh).addScaledVector(aim, 0.3).addScaledVector(up, -0.06).addScaledVector(right, -0.07);
    }
    const q = basisQuat(right, up, aim.clone().negate());
    // Passage du repère monde au repère local de la racine
    const g = this.weapon.group;
    this.root.getWorldQuaternion(_q2);
    g.quaternion.copy(_q2.invert().multiply(q));
    g.position.copy(this.root.worldToLocal(pos));
    g.updateMatrixWorld(true);
  }

  /** Mains sur l'arme par IK, doigts refermés. */
  _armsIK(fwd, right, leftTarget) {
    const B = this.bones;
    const g = this.weapon.group;
    g.updateMatrixWorld(true);
    const gq = g.getWorldQuaternion(new THREE.Quaternion());
    const gx = new THREE.Vector3(1, 0, 0).applyQuaternion(gq);  // droite de l'arme
    const gy = new THREE.Vector3(0, 1, 0).applyQuaternion(gq);  // haut de l'arme
    const gf = new THREE.Vector3(0, 0, -1).applyQuaternion(gq); // avant de l'arme
    const down = gy.clone().negate();

    // Main droite : dos de la main vers l'extérieur, doigts vers l'avant/bas, pouce en haut.
    const rx = gx.clone();
    const ry = gf.clone().addScaledVector(gy, -0.45).normalize();
    const rz = new THREE.Vector3().crossVectors(rx, ry).normalize();
    ry.crossVectors(rz, rx).normalize();
    const rq = basisQuat(rx, ry, rz);
    const gripR = g.localToWorld(this.weapon.gripR.clone());
    const wristR = gripR.clone().addScaledVector(ry, -0.055).addScaledVector(rx, 0.02);
    const poleR = B.RightArm.getWorldPosition(new THREE.Vector3()).addScaledVector(down, 0.6).addScaledVector(gx, 0.45).addScaledVector(gf, -0.2);
    solveArm(B.RightArm, B.RightForeArm, B.RightHand, wristR, poleR);
    setWorldQuat(B.RightHand, rq);

    // Main gauche : sous le garde-main, paume vers le haut, doigts vers la droite.
    let lx, ly, lz;
    if (this.weapon.pistol) {
      lx = gx.clone().negate();
      ly = gf.clone().addScaledVector(gy, -0.6).normalize();
      lz = new THREE.Vector3().crossVectors(lx, ly).normalize();
      ly.crossVectors(lz, lx).normalize();
    } else {
      lx = down.clone();
      lz = gf.clone().negate();
      ly = new THREE.Vector3().crossVectors(lz, lx).normalize();
    }
    const lq = basisQuat(lx, ly, lz);
    const gl = this.weapon.gripL.clone();
    if (this.fp && !this.weapon.pistol) gl.z = Math.max(gl.z, -0.25);
    const gripL = leftTarget ? leftTarget.clone() : g.localToWorld(gl);
    const wristL = gripL.clone().addScaledVector(ly, -0.055).addScaledVector(lx, 0.022);
    const poleL = B.LeftArm.getWorldPosition(new THREE.Vector3()).addScaledVector(down, 0.7).addScaledVector(gx, -0.4);
    solveArm(B.LeftArm, B.LeftForeArm, B.LeftHand, wristL, poleL);
    setWorldQuat(B.LeftHand, lq);

    // Doigts refermés (rotation autour de l'axe Z local de chaque phalange)
    for (const side of ['Right', 'Left']) {
      for (const f of FINGERS) {
        for (let i = 1; i <= 3; i++) {
          const bone = B[`${side}Hand${f}${i}`];
          if (!bone) continue;
          bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), i === 1 ? 1.15 : 1.0);
        }
      }
      const t1 = B[`${side}HandThumb1`];
      if (t1) t1.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.35);
    }
    B.RightHand.updateMatrixWorld(true);
    B.LeftHand.updateMatrixWorld(true);
  }

  _dead(dt) {
    if (this.deathT < 0) {
      this.deathT = 0;
      this.fallDir = Math.random() < 0.65 ? -1 : 1;
      this.fallSide = (Math.random() - 0.5) * 0.6;
      for (const a of Object.values(this.actions)) a.setEffectiveTimeScale(0);
      if (this.tag) this.tag.visible = false;
    }
    this.deathT = Math.min(1, this.deathT + dt * 2.2);
    const e = this.deathT * this.deathT * (3 - 2 * this.deathT);
    this.mixer.update(dt);
    this.pivot.rotation.x = this.fallDir * 1.45 * e;
    this.pivot.rotation.z = this.fallSide * e;
    this.pivot.position.y = 0.12 * e;
    // L'arme tombe avec la main droite
    this.root.updateMatrixWorld(true);
    const hand = this.bones.RightHand;
    const g = this.weapon.group;
    const hp = hand.getWorldPosition(new THREE.Vector3());
    g.position.copy(this.root.worldToLocal(hp.setY(Math.max(0.05, hp.y))));
    g.rotation.set(0, 0, Math.PI / 2 * e);
  }

  _revive() {
    this.deathT = -1;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    for (const a of Object.values(this.actions)) a.setEffectiveTimeScale(1);
    if (this.tag) this.tag.visible = !!this.tagOn;
  }

  dispose() {
    if (this.tag) { this.tag.material.map.dispose(); this.tag.material.dispose(); }
    this.mixer.stopAllAction();
  }
}
