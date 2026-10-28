// Construction d'une carte : géométrie fusionnée par matériau, boîtes de
// collision, points d'apparition, ciel, lumières, minicarte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTexture, getNormalMap } from './textures.js';
import { rayAABB } from './util.js';

const WALL_T = 0.4;
const DOOR_W = 2.4;
const DOOR_H = 2.6;

/** Boîte dont les UV sont en mètres / `scale` (textures à échelle constante). */
function boxGeometry(w, h, d, scale, seed) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune).
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const off = (seed * 0.37) % 1;
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * su / scale + off, uv.getY(i) * sv / scale);
    }
  }
  return g;
}

function cylinderGeometry(r, h, scale) {
  const g = new THREE.CylinderGeometry(r, r, h, 20, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * r) / scale, uv.getY(i) * h / scale);
  return g;
}

export class World {
  constructor(map, quality) {
    this.map = map;
    this.theme = map.theme;
    this.quality = quality;
    const [W, D] = map.size;
    this.W = W; this.D = D;
    this.boxes = [];        // { min, max, solid, bullet }
    this.hazards = [];      // { min, max }
    this.spawns = [[], []];
    this.group = new THREE.Group();
    this.lights = [];
    this.animated = [];     // objets avec update(t)
    this._geo = new Map();  // matKey -> [geometries]
    this._neon = [];        // geometries avec couleurs de sommets
    this._materials = new Map();

    const B = this._builder();
    map.build(B);
    this._finalize();
  }

  // ---------------------------------------------------------------- construction

  _builder() {
    const world = this;
    let s = 1, team = 0;
    const X = (x) => s * x, Z = (z) => s * z;
    const B = {
      both(fn) { s = 1; team = 0; fn(B); s = -1; team = 1; fn(B); s = 1; team = 0; },
      box(x, y, z, w, h, d, mat) { world._addBox(X(x), y, Z(z), w, h, d, mat, true); },
      deco(x, y, z, w, h, d, mat) { world._addBox(X(x), y, Z(z), w, h, d, mat, false); },
      neon(x, y, z, w, h, d, color, intensity = 2.5, ring = false) {
        if (!ring) return world._addNeon(X(x), y, Z(z), w, h, d, color, intensity);
        const t = 0.08;
        world._addNeon(X(x), y, Z(z) - d / 2, w, h, t, color, intensity);
        world._addNeon(X(x), y, Z(z) + d / 2, w, h, t, color, intensity);
        world._addNeon(X(x) - w / 2, y, Z(z), t, h, d, color, intensity);
        world._addNeon(X(x) + w / 2, y, Z(z), t, h, d, color, intensity);
      },
      light(x, y, z, color, intensity, dist) { world.lights.push({ pos: [X(x), y, Z(z)], color, intensity, dist }); },
      spawn(x, z, yaw) { world.spawns[team].push({ x: X(x), z: Z(z), yaw: s > 0 ? yaw : yaw + Math.PI }); },
      stairs(x0, z0, axis, width, height, length, mat, baseY = 0) {
        const n = Math.max(2, Math.ceil(height / 0.4));
        const rise = height / n, depth = length / n;
        const sign = axis[0] === '+' ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const along = sign * (i + 0.5) * depth;
          const h = (i + 1) * rise;
          if (axis[1] === 'z') B.box(x0, baseY, z0 + along, width, h, depth, mat);
          else B.box(x0 + along, baseY, z0, depth, h, width, mat);
        }
      },
      house(x, z, w, d, h, mat, opts = {}) {
        const doors = opts.doors || [];
        const t = WALL_T;
        const lintel = h - DOOR_H;
        const face = (key, cx, cz, len, alongX) => {
          const has = doors.includes(key);
          if (!has) {
            if (alongX) B.box(cx, 0, cz, len, h, t, mat); else B.box(cx, 0, cz, t, h, len, mat);
            return;
          }
          const seg = (len - DOOR_W) / 2;
          const o = (len + DOOR_W) / 4;
          if (alongX) {
            B.box(cx - o, 0, cz, seg, h, t, mat); B.box(cx + o, 0, cz, seg, h, t, mat);
            if (lintel > 0.05) B.box(cx, DOOR_H, cz, DOOR_W, lintel, t, mat);
          } else {
            B.box(cx, 0, cz - o, t, h, seg, mat); B.box(cx, 0, cz + o, t, h, seg, mat);
            if (lintel > 0.05) B.box(cx, DOOR_H, cz, t, lintel, DOOR_W, mat);
          }
        };
        face('-z', x, z - d / 2 + t / 2, w, true);
        face('+z', x, z + d / 2 - t / 2, w, true);
        face('-x', x - w / 2 + t / 2, z, d - 2 * t, false);
        face('+x', x + w / 2 - t / 2, z, d - 2 * t, false);
        if (opts.roof !== false) B.box(x, h, z, w, 0.3, d, opts.roofMat || 'floor');
        B.deco(x, h + 0.3, z - d / 2, w, 0.06, 0.06, 'trim');
      },
      cover(x, z, w, d, h = 1.1, mat = 'cover') { B.box(x, 0, z, w, h, d, mat); },
      container(x, z, axis, mat, y = 0) {
        const L = 6.1, H = 2.6, Wd = 2.44;
        const [w, d] = axis === 'x' ? [L, Wd] : [Wd, L];
        B.box(x, y, z, w, H, d, mat);
        // Cadres d'extrémité
        for (const e of [-1, 1]) {
          if (axis === 'x') B.deco(x + e * (L / 2 - 0.06), y, z, 0.14, H + 0.02, Wd + 0.04, 'metal');
          else B.deco(x, y, z + e * (L / 2 - 0.06), Wd + 0.04, H + 0.02, 0.14, 'metal');
        }
      },
      tank(x, z, r, h, mat) {
        world._addCylinder(X(x), Z(z), r, h, mat);
        world._addBox(X(x), 0, Z(z), r * 1.8, h, r * 1.8, mat, true, false);
      },
      car(x, z, axis, mat) {
        const L = 4.4, Wd = 1.9;
        const ax = axis === 'x';
        const bw = ax ? L : Wd, bd = ax ? Wd : L;
        world._addBox(X(x), 0, Z(z), bw, 1.45, bd, mat, true, false);
        B.deco(x, 0.32, z, bw, 0.72, bd, mat);
        B.deco(x, 1.04, z, ax ? 2.4 : 1.7, 0.6, ax ? 1.7 : 2.4, 'glass');
        for (const a of [-1.4, 1.4]) for (const b of [-0.85, 0.85]) {
          world._addCylinderAxis(X(ax ? x + a : x + b), 0.36, Z(ax ? z + b : z + a), 0.36, 0.3, ax ? 'z' : 'x', 'tire');
        }
        const f = L / 2 + 0.01;
        for (const b of [-0.6, 0.6]) {
          if (ax) {
            B.neon(x + f, 0.7, z + b, 0.04, 0.12, 0.35, '#fff6e0', 3);
            B.neon(x - f, 0.75, z + b, 0.04, 0.1, 0.4, '#ff1020', 2.5);
          } else {
            B.neon(x + b, 0.7, z + f, 0.35, 0.12, 0.04, '#fff6e0', 3);
            B.neon(x + b, 0.75, z - f, 0.4, 0.1, 0.04, '#ff1020', 2.5);
          }
        }
      },
      ground(mat) { world._groundMat = mat; },
      perimeter(h, mat, invisibleH = 0) {
        const W = world.W, D = world.D, t = 1;
        const walls = [
          [0, -D / 2 - t / 2, W + 2 * t, t], [0, D / 2 + t / 2, W + 2 * t, t],
          [-W / 2 - t / 2, 0, t, D], [W / 2 + t / 2, 0, t, D],
        ];
        for (const [x, z, w, d] of walls) {
          world._addBox(x, 0, z, w, h, d, mat, true);
          if (invisibleH > h) world._addBox(x, h, z, w, invisibleH - h, d, null, true);
          world._addBox(x, h, z, w + 0.1, 0.12, d + 0.1, 'trim', false);
        }
      },
      lava(x, z, w, d) {
        world.hazards.push({ min: [x - w / 2, -1, z - d / 2], max: [x + w / 2, 0.22, z + d / 2] });
        world._lava = { x, z, w, d };
      },
    };
    return B;
  }

  _addBox(cx, y, cz, w, h, d, mat, solid, visible = true) {
    if (solid) {
      this.boxes.push({
        min: [cx - w / 2, y, cz - d / 2], max: [cx + w / 2, y + h, cz + d / 2],
        bullet: mat !== null, mat,
      });
    }
    if (!visible || mat === null) return;
    const spec = this._matSpec(mat);
    const g = boxGeometry(w, h, d, spec.scale || 2, cx + cz * 1.7 + y);
    g.translate(cx, y + h / 2, cz);
    this._pushGeo(mat, g);
  }

  _addCylinder(cx, cz, r, h, mat) {
    const spec = this._matSpec(mat);
    const g = cylinderGeometry(r, h, spec.scale || 2);
    g.translate(cx, h / 2, cz);
    this._pushGeo(mat, g);
  }

  _addCylinderAxis(cx, cy, cz, r, len, axis, mat) {
    const g = new THREE.CylinderGeometry(r, r, len, 14);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
    g.translate(cx, cy, cz);
    this._pushGeo(mat, g);
  }

  _addNeon(cx, y, cz, w, h, d, color, intensity) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.deleteAttribute('uv');
    g.translate(cx, y + h / 2, cz);
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._neon.push(g);
  }

  _pushGeo(mat, g) {
    if (!this._geo.has(mat)) this._geo.set(mat, []);
    this._geo.get(mat).push(g);
  }

  _matSpec(key) {
    const builtins = {
      glass: { color: '#0d1420', rough: 0.05, metal: 0.9, scale: 2 },
      tire: { color: '#151515', rough: 0.9, scale: 1 },
    };
    return this.theme.mats[key] || builtins[key] || this.theme.mats.wall;
  }

  _material(key) {
    if (this._materials.has(key)) return this._materials.get(key);
    const spec = this._matSpec(key);
    const aniso = this.quality.aniso;
    const m = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.rough ?? 0.8,
      metalness: spec.metal ?? 0,
      map: spec.tex ? getTexture(spec.tex, aniso) : null,
    });
    if (spec.tex && spec.tex !== 'facade') {
      // Relief : joints, rivets, grain accrochent la lumière.
      const strength = { hazard: 0.8, grate: 3, container: 2.5, metal: 2.5, panelDark: 2.5, floor: 1.8 }[spec.tex] || 2;
      m.normalMap = getNormalMap(spec.tex, strength, aniso);
      const k = spec.normal ?? 0.85;
      m.normalScale.set(k, k);
    }
    if (spec.emissive) {
      m.emissive = new THREE.Color(spec.emissive);
      m.emissiveIntensity = spec.emissiveIntensity ?? 1;
      if (spec.emissiveMap) m.emissiveMap = getTexture(spec.emissiveMap, aniso);
    }
    this._materials.set(key, m);
    return m;
  }

  _finalize() {
    const q = this.quality;
    const t = this.theme;
    const [W, D] = [this.W, this.D];

    // Sol de collision
    this.boxes.push({ min: [-W / 2 - 50, -2, -D / 2 - 50], max: [W / 2 + 50, 0, D / 2 + 50], bullet: true, mat: 'ground', ground: true });

    // Géométrie fusionnée par matériau
    for (const [key, list] of this._geo) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, this._material(key));
      mesh.castShadow = q.shadows;
      mesh.receiveShadow = q.shadows;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
    if (this._neon.length) {
      const merged = mergeGeometries(this._neon, false);
      const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true }));
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }

    // Sol visuel
    const margin = t.water ? 2 : 160;
    const gw = W + margin * 2, gd = D + margin * 2;
    const gspec = this._matSpec(this._groundMat || 'ground');
    const gGeo = new THREE.PlaneGeometry(gw, gd);
    gGeo.rotateX(-Math.PI / 2);
    const uv = gGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * gw / (gspec.scale || 5), uv.getY(i) * gd / (gspec.scale || 5));
    const ground = new THREE.Mesh(gGeo, this._material(this._groundMat || 'ground'));
    ground.receiveShadow = q.shadows;
    this.group.add(ground);

    if (t.water) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#06121c', roughness: 0.12, metalness: 0.9 }),
      );
      water.position.y = -0.9;
      this.group.add(water);
      // Quai : bord visible
      const edge = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 1, D + 4), this._material('wall'));
      edge.position.y = -0.5;
      this.group.add(edge);
    }

    if (this._lava) this._buildLava();

    // Lumières
    const hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiIntensity);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(t.sun, t.sunIntensity);
    const sd = new THREE.Vector3(...t.sunDir).normalize();
    const R = Math.max(W, D) * 0.75;
    sun.position.copy(sd).multiplyScalar(R * 1.4);
    sun.target.position.set(0, 0, 0);
    if (q.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      const c = sun.shadow.camera;
      c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = R * 3.5;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.04;
    }
    this.group.add(sun, sun.target);
    this.sun = sun;

    const maxLights = q.pointLights;
    for (const L of this.lights.slice(0, maxLights)) {
      const pl = new THREE.PointLight(L.color, L.intensity * 2.2, L.dist, 1.6);
      pl.position.set(...L.pos);
      this.group.add(pl);
    }

    this.sky = buildSky(t);
    this.group.add(this.sky);
    this.animated.push((time) => { this.sky.material.uniforms.uTime.value = time; });

    this.solids = this.boxes.filter((b) => !b.ground);
    this.minimap = this._buildMinimap();
  }

  _buildLava() {
    const { x, z, w, d } = this._lava;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vUv * vec2(6.0, 3.5);
          float v = n(p + vec2(uTime*0.25, uTime*0.1)) * 0.6 + n(p*2.3 - vec2(uTime*0.18, 0.0)) * 0.4;
          vec3 col = mix(vec3(0.5,0.05,0.0), vec3(3.2,1.1,0.15), smoothstep(0.35, 0.85, v));
          col += vec3(2.0,1.6,0.6) * smoothstep(0.82, 0.95, v);
          gl_FragColor = vec4(col, 1.0);
        }`,
      toneMapped: false,
    });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
    lava.position.set(x, 0.04, z);
    this.group.add(lava);
    this.animated.push((time) => { mat.uniforms.uTime.value = time; });
  }

  _buildMinimap() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const sc = size / Math.max(this.W, this.D);
    g.fillStyle = 'rgba(10,14,20,0.85)';
    g.fillRect(0, 0, size, size);
    const ox = size / 2, oz = size / 2;
    const sorted = [...this.solids].filter((b) => b.mat).sort((a, b) => a.max[1] - b.max[1]);
    for (const b of sorted) {
      const top = b.max[1];
      const v = Math.min(255, 70 + top * 22);
      g.fillStyle = `rgb(${v * 0.75 | 0},${v * 0.82 | 0},${v | 0})`;
      g.fillRect(ox + b.min[0] * sc, oz + b.min[2] * sc, (b.max[0] - b.min[0]) * sc, (b.max[2] - b.min[2]) * sc);
    }
    for (const hz of this.hazards) {
      g.fillStyle = 'rgba(255,90,0,0.85)';
      g.fillRect(ox + hz.min[0] * sc, oz + hz.min[2] * sc, (hz.max[0] - hz.min[0]) * sc, (hz.max[2] - hz.min[2]) * sc);
    }
    return { canvas: c, scale: sc, size };
  }

  // ---------------------------------------------------------------- requêtes

  /** Distance du premier mur touché par un rayon (balles, ligne de vue). */
  raycast(o, d, maxT = 500) {
    let best = maxT, hit = null;
    for (const b of this.boxes) {
      if (!b.bullet) continue;
      const t = rayAABB(o, d, b.min, b.max, best);
      if (t < best) { best = t; hit = b; }
    }
    return { t: best, box: hit };
  }

  /** Vrai si le segment a→b est dégagé. */
  lineOfSight(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return true;
    const d = [dx / L, dy / L, dz / L];
    return this.raycast(a, d, L).t >= L - 0.05;
  }

  /** Normale (approximative) de la face d'une boîte au point p. */
  static faceNormal(box, p) {
    let best = Infinity, n = [0, 1, 0];
    for (let i = 0; i < 3; i++) {
      const dmin = Math.abs(p[i] - box.min[i]);
      const dmax = Math.abs(p[i] - box.max[i]);
      if (dmin < best) { best = dmin; n = [0, 0, 0]; n[i] = -1; }
      if (dmax < best) { best = dmax; n = [0, 0, 0]; n[i] = 1; }
    }
    return n;
  }

  inHazard(p) {
    for (const h of this.hazards) {
      if (p[0] > h.min[0] && p[0] < h.max[0] && p[2] > h.min[2] && p[2] < h.max[2] && p[1] < h.max[1]) return true;
    }
    return false;
  }

  update(time) { for (const f of this.animated) f(time); }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.map) o.material.dispose?.();
    });
    for (const m of this._materials.values()) m.dispose();
  }
}

/** Carte d'environnement (reflets) générée à partir du ciel de la carte. */
export function buildEnvironment(renderer, world, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(world.sky.clone());
  const t = world.theme;
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(t.night ? '#6a5aff' : t.sun).multiplyScalar(t.night ? 1.5 : 2) });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), glowMat);
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 200, 30, Math.sin(a) * 200);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  scene.environment = tex;
  scene.environmentIntensity = t.night ? 0.8 : 0.7;
  return tex;
}

function buildSky(t) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(t.skyTop) },
      bottom: { value: new THREE.Color(t.skyBottom) },
      sunColor: { value: new THREE.Color(t.sun) },
      sunDir: { value: new THREE.Vector3(...t.sunDir).normalize() },
      stars: { value: t.stars || t.night ? 1 : 0 },
      night: { value: t.night ? 1 : 0 },
      clouds: { value: t.clouds ?? (t.indoor ? 0 : 0.35) },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top, bottom, sunColor, sunDir; uniform float stars, night, clouds, uTime;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
      void main(){
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(smoothstep(0.42, 1.0, h), 0.8));
        float s = max(dot(vDir, sunDir), 0.0);
        col += sunColor * (pow(s, 600.0) * (night > 0.5 ? 1.2 : 6.0) + pow(s, 8.0) * (night > 0.5 ? 0.05 : 0.35));
        if (stars > 0.5 && vDir.y > 0.05) {
          vec3 q = floor(vDir * 380.0);
          float st = step(0.9975, hash(q));
          col += vec3(st) * 0.9 * smoothstep(0.05, 0.4, vDir.y);
        }
        if (clouds > 0.0 && vDir.y > 0.0) {
          // Couche nuageuse projetée sur un plan, éclairée côté soleil.
          vec2 uv = vDir.xz / (vDir.y + 0.15) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = fbm(uv * 1.3);
          float cover = 1.0 - clouds;
          float c = smoothstep(cover - 0.05, cover + 0.3, n);
          float lit = pow(max(dot(normalize(vec3(vDir.x, 0.25, vDir.z)), sunDir), 0.0), 2.0);
          vec3 cloudCol = night > 0.5
            ? mix(bottom * 0.6, bottom * 1.6 + vec3(0.02), n)
            : mix(mix(bottom, vec3(1.0), 0.55) * 0.82, sunColor * 1.15 + 0.15, lit * 0.7);
          col = mix(col, cloudCol, c * smoothstep(0.0, 0.18, vDir.y) * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
