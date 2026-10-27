// Arme à la première personne : rendue dans une scène séparée (pas de
// traversée des murs), animée (balancement, recul, rechargement, visée…).
import * as THREE from 'three';
import { buildWeaponModel } from './models.js';
import { getFlashTexture } from './textures.js';
import { damp } from './util.js';

const HIP = new THREE.Vector3(0.17, -0.2, -0.44);
const VM_FOV = 62;

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VM_FOV, 1, 0.01, 10);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xdde6ff, 0x30302a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.5, 1, 0.3);
    this.scene.add(key);
    this.key = key;
    this.root = new THREE.Group();
    this.camera.add(this.root);
    this.models = new Map();
    this.current = null;
    this.t = 0;
    this.kick = 0; this.kickRot = 0;
    this.swayX = 0; this.swayY = 0;
    this.pos = HIP.clone();
    this.rot = new THREE.Euler();
    this.lower = 0;     // 0..1 abaissé (changement d'arme)
    this.sprintK = 0;
    this.reloadK = 0;

    const flashMat = new THREE.SpriteMaterial({ map: getFlashTexture(), blending: THREE.AdditiveBlending, depthTest: false, toneMapped: false, color: new THREE.Color(3, 2.5, 1.8) });
    this.flash = new THREE.Sprite(flashMat);
    this.flash.scale.setScalar(0.16);
    this.flash.visible = false;
    this.flashT = 0;
  }

  setTheme(theme, envTex = null) {
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.9;
    this.key.color.set(theme.sun);
    this.key.intensity = theme.night ? 1.2 : 2.2;
  }

  _arms(teamColor) {
    const g = new THREE.Group();
    const sleeve = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.7, metalness: 0.2 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.3 });
    const R = new THREE.Group();
    const ra = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.062, 0.3), sleeve); ra.position.set(0, -0.03, 0.2);
    const rg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.09), glove); rg.position.set(0, -0.03, 0.04);
    R.add(ra, rg); R.position.set(0.012, -0.03, 0.06); R.rotation.set(0.15, 0.08, 0);
    const L = new THREE.Group();
    const la = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), sleeve); la.position.set(0.02, -0.04, 0.2);
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.1), glove); lg.position.set(0, 0, 0.0);
    L.add(la, lg); L.position.set(-0.02, -0.01, -0.3); L.rotation.set(0.35, -0.45, 0.2);
    g.add(R, L);
    g.userData = { R, L };
    return g;
  }

  equip(w, teamColor = 0x2c3a4a) {
    if (!this.models.has(w.id)) {
      const m = buildWeaponModel(w);
      const holder = new THREE.Group();
      holder.add(m.group);
      const arms = this._arms(teamColor);
      if (w.model.pistol) { arms.userData.L.position.set(-0.03, -0.06, 0.02); arms.userData.L.rotation.set(0.3, -0.3, 0.4); }
      else arms.userData.L.position.z = -Math.min(0.42, w.model.len * 0.45);
      holder.add(arms);
      this.models.set(w.id, { holder, ...m });
    }
    if (this.current) this.root.remove(this.current.holder);
    this.current = this.models.get(w.id);
    this.current.holder.add(this.flash);
    this.flash.position.copy(this.current.muzzle.position);
    this.root.add(this.current.holder);
    this.weapon = w;
    this.lower = 1;
  }

  fire(strength = 1) {
    this.kick = Math.min(1.5, this.kick + 0.35 * strength);
    this.kickRot = Math.min(1.5, this.kickRot + 0.4 * strength);
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * 6.28;
    this.flash.scale.setScalar(0.12 + Math.random() * 0.08);
    this.flashT = 0.045;
  }

  /** Position monde du bout du canon (pour les traçantes). */
  muzzleWorld(mainCamera, out = new THREE.Vector3()) {
    if (!this.current) return out.setFromMatrixPosition(mainCamera.matrixWorld);
    this.current.muzzle.getWorldPosition(out); // dans l'espace de la caméra d'arme
    // La caméra d'arme est à l'origine sans rotation : out est en espace vue.
    out.applyMatrix4(mainCamera.matrixWorld);
    return out;
  }

  /**
   * s : { dt, ads (0..1), moving (0..1), sprint, airborne, lookDX, lookDY,
   *       reloading (0..1 progression ou -1), swapping, crouch }
   */
  update(s) {
    const dt = s.dt;
    if (!this.current) return;
    this.t += dt * (s.sprint ? 13 : 9) * Math.max(0.15, s.moving);
    const ads = s.ads;
    const w = this.weapon;

    // Inertie de la visée
    this.swayX = damp(this.swayX, Math.max(-0.05, Math.min(0.05, -s.lookDX * 0.6)), 10, dt);
    this.swayY = damp(this.swayY, Math.max(-0.05, Math.min(0.05, s.lookDY * 0.6)), 10, dt);

    const bobK = s.moving * (1 - ads * 0.85) * (s.airborne ? 0.2 : 1);
    const bobX = Math.sin(this.t) * 0.012 * bobK;
    const bobY = -Math.abs(Math.cos(this.t)) * 0.012 * bobK;
    const idle = Math.sin(performance.now() / 900) * 0.002 * (1 - ads);

    this.sprintK = damp(this.sprintK, s.sprint ? 1 : 0, 10, dt);
    this.reloadK = damp(this.reloadK, s.reloading >= 0 ? 1 : 0, 12, dt);
    this.lower = damp(this.lower, s.swapping ? 1 : 0, 14, dt);
    this.kick = damp(this.kick, 0, 14, dt);
    this.kickRot = damp(this.kickRot, 0, 10, dt);

    const sightY = this.current.sightY;
    const adsPos = new THREE.Vector3(0, -sightY, w.model.pistol ? -0.3 : -0.26);
    const target = HIP.clone().lerp(adsPos, ads);
    target.x += bobX + this.swayX * (1 - ads * 0.7);
    target.y += bobY + idle + this.swayY * (1 - ads * 0.7) - this.lower * 0.3 - this.reloadK * 0.06 - this.sprintK * 0.04;
    target.z += this.kick * (w.cls === 'shotgun' || w.cls === 'sniper' ? 0.09 : 0.035) * (1 - ads * 0.4);
    if (s.crouch) target.y -= 0.01 * (1 - ads);
    this.pos.lerp(target, 1 - Math.exp(-28 * dt));

    const holder = this.current.holder;
    holder.position.copy(this.pos);
    const rp = this.reloadK;
    // Animation de rechargement : bascule + chargeur retiré
    const prog = s.reloading >= 0 ? s.reloading : 1;
    const tilt = Math.sin(Math.min(1, prog) * Math.PI);
    holder.rotation.set(
      this.kickRot * 0.09 * (1 - ads * 0.5) + rp * 0.25 * tilt - this.sprintK * 0.25 - this.lower * 0.6,
      this.sprintK * 0.75 + this.swayX * 2,
      rp * 0.5 * tilt + this.sprintK * 0.25 + bobX * 2,
    );
    if (this.current.mag) {
      const out = s.reloading >= 0 ? Math.sin(Math.min(1, prog) * Math.PI) : 0;
      this.current.mag.position.y = -out * 0.25;
      this.current.mag.visible = !(s.reloading >= 0 && prog > 0.35 && prog < 0.55);
    }

    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    this.root.visible = !s.hidden;
  }
}
