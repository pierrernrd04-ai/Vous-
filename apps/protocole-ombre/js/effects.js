// Effets visuels mutualisés : traçantes, étincelles, flashs, impacts,
// explosions, fumée, météo.
import * as THREE from 'three';
import { getGlowTexture, getFlashTexture } from './textures.js';
import { rand } from './util.js';

const TRACERS = 64;
const SPARKS = 500;
const DECALS = 90;

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    this.q = quality;
    const glowTex = getGlowTexture();

    // Traçantes
    this.tracerPos = new Float32Array(TRACERS * 6);
    this.tracerCol = new Float32Array(TRACERS * 6);
    this.tracerLife = new Float32Array(TRACERS);
    this.tracerData = Array.from({ length: TRACERS }, () => ({ a: [0, 0, 0], b: [0, 0, 0], c: [1, 1, 1] }));
    this.tracerIdx = 0;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);

    // Étincelles
    this.sparkPos = new Float32Array(SPARKS * 3);
    this.sparkCol = new Float32Array(SPARKS * 3);
    this.sparkVel = new Float32Array(SPARKS * 3);
    this.sparkLife = new Float32Array(SPARKS);
    this.sparkBase = new Float32Array(SPARKS * 3);
    this.sparkIdx = 0;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.09, map: glowTex, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);

    // Flashs (sprites) en troisième personne
    const flashMat = new THREE.SpriteMaterial({ map: getFlashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(3, 2.4, 1.6) });
    this.flashes = Array.from({ length: 10 }, () => {
      const s = new THREE.Sprite(flashMat);
      s.visible = false; s.scale.setScalar(0.6); s.userData.t = 0;
      scene.add(s); return s;
    });
    this.flashIdx = 0;

    // Impacts de balles
    const decalMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
    this.decals = Array.from({ length: DECALS }, () => {
      const m = new THREE.Mesh(decalGeo, decalMat);
      m.visible = false; m.matrixAutoUpdate = true;
      scene.add(m); return m;
    });
    this.decalIdx = 0;

    // Fumée / boules de feu
    this.puffMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x777777, transparent: true, depthWrite: false, opacity: 0.6 });
    this.fireMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(4, 2, 0.6), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.puffs = [];

    // Lumière dynamique partagée (flash du joueur, explosions)
    this.light = new THREE.PointLight(0xffb060, 0, 10, 2);
    scene.add(this.light);
    this.lightT = 0;

    this.weather = null;
  }

  tracer(a, b, color = [1.6, 1.3, 0.8]) {
    const i = this.tracerIdx = (this.tracerIdx + 1) % TRACERS;
    const d = this.tracerData[i];
    // Segment court qui file vers la cible
    d.a = a.slice(); d.b = b.slice(); d.c = color;
    d.len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    d.prog = 0;
    this.tracerLife[i] = 1;
  }

  spark(p, n = 8, color = [2, 1.5, 0.7], speed = 4, normal = null) {
    for (let k = 0; k < n; k++) {
      const i = this.sparkIdx = (this.sparkIdx + 1) % SPARKS;
      this.sparkPos[i * 3] = p[0]; this.sparkPos[i * 3 + 1] = p[1]; this.sparkPos[i * 3 + 2] = p[2];
      let vx = rand(-1, 1), vy = rand(-0.2, 1.2), vz = rand(-1, 1);
      if (normal) { vx += normal[0] * 1.5; vy += normal[1] * 1.5; vz += normal[2] * 1.5; }
      const s = speed * rand(0.4, 1);
      this.sparkVel[i * 3] = vx * s; this.sparkVel[i * 3 + 1] = vy * s; this.sparkVel[i * 3 + 2] = vz * s;
      this.sparkBase[i * 3] = color[0]; this.sparkBase[i * 3 + 1] = color[1]; this.sparkBase[i * 3 + 2] = color[2];
      this.sparkLife[i] = rand(0.25, 0.5);
    }
  }

  impact(p, normal) {
    this.spark(p, 6, [2, 1.6, 0.9], 3.5, normal);
    this.puff(p, 0.25, 0.5, 0x8a8a8a);
    const m = this.decals[this.decalIdx = (this.decalIdx + 1) % DECALS];
    m.visible = true;
    m.position.set(p[0] + normal[0] * 0.01, p[1] + normal[1] * 0.01, p[2] + normal[2] * 0.01);
    m.lookAt(p[0] + normal[0], p[1] + normal[1], p[2] + normal[2]);
    m.rotateZ(Math.random() * 6.28);
    const s = rand(0.8, 1.3); m.scale.set(s, s, s);
  }

  bodyHit(p, head) {
    this.spark(p, head ? 14 : 8, head ? [3, 0.5, 0.3] : [2.2, 0.35, 0.25], 2.5);
  }

  muzzle(p, withLight = true) {
    const s = this.flashes[this.flashIdx = (this.flashIdx + 1) % this.flashes.length];
    s.position.set(p[0], p[1], p[2]);
    s.material.rotation = Math.random() * 6.28;
    s.scale.setScalar(rand(0.45, 0.7));
    s.visible = true; s.userData.t = 0.05;
    if (withLight && this.q.dynamicLights) this.flashLight(p, 0xffb060, 6, 0.05);
  }

  flashLight(p, color, intensity, dur) {
    this.light.position.set(p[0], p[1], p[2]);
    this.light.color.set(color);
    this.light.intensity = intensity;
    this.light.distance = intensity * 2.2;
    this.lightT = dur; this.lightMax = intensity; this.lightDur = dur;
  }

  puff(p, size, life, color = 0x777777, fire = false) {
    const mat = fire ? this.fireMat : this.puffMat.clone();
    if (!fire) mat.color.set(color);
    const s = new THREE.Sprite(mat);
    s.position.set(p[0], p[1], p[2]);
    s.scale.setScalar(size);
    s.userData = { t: life, life, size, fire, vy: fire ? 1.5 : 0.6 };
    this.scene.add(s);
    this.puffs.push(s);
  }

  explosion(p) {
    this.spark(p, 60, [3, 1.8, 0.6], 11);
    for (let i = 0; i < 6; i++) this.puff([p[0] + rand(-0.6, 0.6), p[1] + rand(0, 0.8), p[2] + rand(-0.6, 0.6)], rand(1.5, 2.6), rand(0.3, 0.5), 0, true);
    for (let i = 0; i < 8; i++) this.puff([p[0] + rand(-1, 1), p[1] + rand(0.2, 1.4), p[2] + rand(-1, 1)], rand(2, 3.5), rand(1.2, 2), 0x555555);
    this.flashLight([p[0], p[1] + 1, p[2]], 0xff9040, 30, 0.35);
  }

  setWeather(theme, camera) {
    if (this.weather) { this.scene.remove(this.weather.obj); this.weather.obj.geometry.dispose(); this.weather = null; }
    const kind = theme.rain ? 'rain' : theme.snow ? 'snow' : theme.dust ? 'dust' : theme.embers ? 'embers' : null;
    if (!kind) return;
    const N = kind === 'rain' ? this.q.particles : Math.floor(this.q.particles * 0.8);
    const B = 36;
    const pos = new Float32Array(N * (kind === 'rain' ? 6 : 3));
    const seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seed[i * 3] = rand(-B, B); seed[i * 3 + 1] = rand(0, 22); seed[i * 3 + 2] = rand(-B, B); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    let obj;
    if (kind === 'rain') {
      obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8aa8cc, transparent: true, opacity: 0.45, depthWrite: false }));
    } else {
      const color = { snow: 0xffffff, dust: 0xe8c090, embers: 0xff8030 }[kind];
      const size = { snow: 0.12, dust: 0.06, embers: 0.08 }[kind];
      obj = new THREE.Points(g, new THREE.PointsMaterial({
        color, size, map: getGlowTexture(), transparent: true, depthWrite: false,
        blending: kind === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: kind === 'dust' ? 0.5 : 0.9,
        toneMapped: kind !== 'embers',
      }));
    }
    obj.frustumCulled = false;
    this.scene.add(obj);
    this.weather = { kind, obj, seed, N, B, t: 0, camera };
  }

  update(dt, camPos) {
    // Traçantes
    for (let i = 0; i < TRACERS; i++) {
      const life = this.tracerLife[i];
      const o = i * 6;
      if (life <= 0) { this.tracerCol.fill(0, o, o + 6); continue; }
      const d = this.tracerData[i];
      d.prog += dt * 420;
      const t0 = Math.min(1, Math.max(0, (d.prog - 4) / d.len));
      const t1 = Math.min(1, d.prog / d.len);
      for (let k = 0; k < 3; k++) {
        this.tracerPos[o + k] = d.a[k] + (d.b[k] - d.a[k]) * t0;
        this.tracerPos[o + 3 + k] = d.a[k] + (d.b[k] - d.a[k]) * t1;
      }
      const f = t0 >= 1 ? 0 : 1;
      for (let k = 0; k < 3; k++) { this.tracerCol[o + k] = d.c[k] * 0.2 * f; this.tracerCol[o + 3 + k] = d.c[k] * f; }
      if (t0 >= 1) this.tracerLife[i] = 0;
    }
    this.tracers.geometry.attributes.position.needsUpdate = true;
    this.tracers.geometry.attributes.color.needsUpdate = true;

    // Étincelles
    for (let i = 0; i < SPARKS; i++) {
      let l = this.sparkLife[i];
      const o = i * 3;
      if (l <= 0) { this.sparkCol[o] = this.sparkCol[o + 1] = this.sparkCol[o + 2] = 0; continue; }
      l -= dt; this.sparkLife[i] = l;
      this.sparkVel[o + 1] -= 14 * dt;
      this.sparkPos[o] += this.sparkVel[o] * dt;
      this.sparkPos[o + 1] += this.sparkVel[o + 1] * dt;
      this.sparkPos[o + 2] += this.sparkVel[o + 2] * dt;
      if (this.sparkPos[o + 1] < 0.02) { this.sparkPos[o + 1] = 0.02; this.sparkVel[o + 1] *= -0.4; }
      const k = Math.max(0, l * 2.5);
      this.sparkCol[o] = this.sparkBase[o] * k; this.sparkCol[o + 1] = this.sparkBase[o + 1] * k; this.sparkCol[o + 2] = this.sparkBase[o + 2] * k;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;

    for (const s of this.flashes) if (s.visible) { s.userData.t -= dt; if (s.userData.t <= 0) s.visible = false; }

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const s = this.puffs[i], u = s.userData;
      u.t -= dt;
      if (u.t <= 0) { this.scene.remove(s); if (!u.fire) s.material.dispose(); this.puffs.splice(i, 1); continue; }
      const k = 1 - u.t / u.life;
      s.scale.setScalar(u.size * (1 + k * (u.fire ? 0.8 : 1.6)));
      s.position.y += u.vy * dt;
      if (!u.fire) s.material.opacity = 0.55 * (1 - k);
    }

    if (this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, this.lightMax * (this.lightT / this.lightDur));
    } else this.light.intensity = 0;

    this._weather(dt, camPos);
  }

  _weather(dt, cam) {
    const w = this.weather;
    if (!w) return;
    w.t += dt;
    const pos = w.obj.geometry.attributes.position.array;
    const { seed, N, B } = w;
    const fall = { rain: 22, snow: 1.4, dust: 0.3, embers: -0.8 }[w.kind];
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      let y = seed[o + 1] - fall * dt;
      if (y < 0) y += 22; else if (y > 22) y -= 22;
      seed[o + 1] = y;
      let x = seed[o], z = seed[o + 2];
      if (w.kind !== 'rain') {
        x += Math.sin(w.t * 0.7 + i) * dt * (w.kind === 'dust' ? 1.5 : 0.4) + (w.kind === 'dust' ? dt * 1.2 : 0);
        seed[o] = x;
      }
      // Enveloppe autour de la caméra
      const wx = ((x - cam[0]) % (2 * B) + 3 * B) % (2 * B) - B + cam[0];
      const wz = ((z - cam[2]) % (2 * B) + 3 * B) % (2 * B) - B + cam[2];
      if (w.kind === 'rain') {
        const r = i * 6;
        pos[r] = wx; pos[r + 1] = y; pos[r + 2] = wz;
        pos[r + 3] = wx + 0.05; pos[r + 4] = y + 0.55; pos[r + 5] = wz;
      } else {
        pos[o] = wx; pos[o + 1] = y; pos[o + 2] = wz;
      }
    }
    w.obj.geometry.attributes.position.needsUpdate = true;
  }
}
