// Vue à la première personne : vraies mains gantées et manches de la faction
// (modèle humain, tête et jambes repliées) tenant l'arme par IK. Rendue dans
// une scène séparée (pas de traversée des murs), animée : balancement,
// inertie, recul, rechargement (la main gauche va chercher le chargeur),
// sprint, visée.
import * as THREE from 'three';
import { Character } from './character.js';
import { getFlashTexture } from './textures.js';
import { damp } from './util.js';

const HIP = new THREE.Vector3(0.115, -0.145, -0.38);
const VM_FOV = 58;
const HIP_PISTOL = new THREE.Vector3(0.12, -0.125, -0.44);

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VM_FOV, 1, 0.01, 10);
    this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0xdde6ff, 0x30302a, 1.2);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 1, 0.4);
    this.scene.add(key);
    this.key = key;
    // Lumière d'appoint côté caméra : l'arme reste lisible même à contre-jour.
    this.fill = new THREE.DirectionalLight(0xffffff, 0.9);
    this.fill.position.set(-0.3, 0.2, 1);
    this.scene.add(this.fill);
    this.holder = new THREE.Group();
    this.camera.add(this.holder);
    this.body = null;
    this.t = 0;
    this.kick = 0; this.kickRot = 0;
    this.swayX = 0; this.swayY = 0;
    this.hip = HIP.clone();
    this.bodyOffset = new THREE.Vector3(0.01, -1.66, -0.12);
    this.pos = HIP.clone();
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
    this.scene.environmentIntensity = 0.85;
    this.key.color.set(theme.sun);
    this.key.intensity = theme.night ? 1.3 : 2.4;
    this.hemi.color.set(theme.hemiSky);
    this.hemi.groundColor.set(theme.hemiGround);
    this.hemi.intensity = theme.night ? 0.9 : 1.2;
  }

  /** Équipe une arme ; `team` choisit les manches de la faction. */
  equip(def, team = this.team ?? 0) {
    if (!this.body || this.body.team !== team) {
      if (this.body) { this.camera.remove(this.body.root); this.body.dispose(); }
      this.body = new Character({ team, firstPerson: true, weapon: def });
      this.body.root.position.copy(this.bodyOffset);
      this.camera.add(this.body.root);
      this.team = team;
    }
    this.body.setWeapon(def);
    const w = this.body.weapon;
    w.group.position.set(0, 0, 0);
    w.group.rotation.set(0, 0, 0);
    this.holder.add(w.group);
    w.group.add(this.flash);
    this.flash.position.copy(w.muzzle.position);
    this.current = w;
    this.weapon = def;
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
    this.current.muzzle.getWorldPosition(out); // espace de la caméra d'arme (= espace vue)
    out.applyMatrix4(mainCamera.matrixWorld);
    return out;
  }

  /** Position monde de la fenêtre d'éjection (douilles). */
  ejectWorld(mainCamera, out = new THREE.Vector3()) {
    if (!this.current) return out.setFromMatrixPosition(mainCamera.matrixWorld);
    this.current.eject.getWorldPosition(out);
    out.applyMatrix4(mainCamera.matrixWorld);
    return out;
  }

  /**
   * s : { dt, ads (0..1), moving (0..1), sprint, airborne, lookDX, lookDY,
   *       reloading (0..1 progression ou -1), swapping, crouch, hidden }
   */
  update(s) {
    const dt = s.dt;
    if (!this.current) return;
    this.t += dt * (s.sprint ? 13 : 9) * Math.max(0.15, s.moving);
    const ads = s.ads;
    const w = this.weapon;
    const cur = this.current;

    // Inertie de la visée
    this.swayX = damp(this.swayX, Math.max(-0.05, Math.min(0.05, -s.lookDX * 0.6)), 10, dt);
    this.swayY = damp(this.swayY, Math.max(-0.05, Math.min(0.05, s.lookDY * 0.6)), 10, dt);

    const bobK = s.moving * (1 - ads * 0.85) * (s.airborne ? 0.2 : 1);
    const bobX = Math.sin(this.t) * 0.011 * bobK;
    const bobY = -Math.abs(Math.cos(this.t)) * 0.011 * bobK;
    const breath = Math.sin(performance.now() / 900) * 0.0018 * (1 - ads * 0.7);

    this.sprintK = damp(this.sprintK, s.sprint ? 1 : 0, 10, dt);
    this.reloadK = damp(this.reloadK, s.reloading >= 0 ? 1 : 0, 12, dt);
    this.lower = damp(this.lower, s.swapping ? 1 : 0, 14, dt);
    this.kick = damp(this.kick, 0, 14, dt);
    this.kickRot = damp(this.kickRot, 0, 10, dt);

    // Visée : la ligne de mire passe par le centre de l'écran.
    const adsPos = new THREE.Vector3(0, -cur.sightY, cur.pistol ? -0.42 : -(0.2 + cur.opticU));
    const target = (cur.pistol ? HIP_PISTOL : this.hip).clone().lerp(adsPos, ads);
    target.x += bobX + this.swayX * (1 - ads * 0.7);
    target.y += bobY + breath + this.swayY * (1 - ads * 0.7) - this.lower * 0.3 - this.reloadK * 0.05 - this.sprintK * 0.05;
    target.z += this.kick * (w.cls === 'shotgun' || w.cls === 'sniper' ? 0.07 : 0.028) * (1 - ads * 0.4) + this.sprintK * 0.04;
    if (s.crouch) target.y -= 0.01 * (1 - ads);
    this.pos.lerp(target, 1 - Math.exp(-28 * dt));

    const g = cur.group;
    g.position.copy(this.pos);
    const prog = s.reloading >= 0 ? s.reloading : 1;
    const tilt = Math.sin(Math.min(1, prog) * Math.PI);
    const rp = this.reloadK;
    g.rotation.set(
      this.kickRot * 0.08 * (1 - ads * 0.5) + rp * 0.14 * tilt - this.sprintK * 0.3 - this.lower * 0.6,
      this.sprintK * 0.6 + this.swayX * 2,
      rp * 0.38 * tilt + this.sprintK * 0.35 + bobX * 2,
    );

    // Chargeur retiré puis remis ; la main gauche l'accompagne.
    let leftTarget = null;
    if (cur.mag) {
      const out = s.reloading >= 0 ? Math.sin(Math.min(1, prog) * Math.PI) : 0;
      cur.mag.position.y = -out * 0.22;
      cur.mag.position.z = out * 0.04;
      if (s.reloading >= 0 && prog > 0.12 && prog < 0.85 && !cur.pumpMag) {
        g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(cur.mag);
        if (!box.isEmpty()) leftTarget = box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(-0.03, -0.02, 0));
      }
    }

    this.body.root.position.copy(this.bodyOffset);
    if (cur.pistol) this.body.root.position.y -= 0.08;
    this.body.animate(dt, { speed: s.moving * 3, alive: true, pitch: 0, leftTarget });

    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    this.holder.visible = !s.hidden;
    this.body.root.visible = !s.hidden;
  }
}
