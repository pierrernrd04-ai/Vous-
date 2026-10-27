// Corps physique d'un soldat (joueur ou bot) : boîte verticale contre les
// boîtes du monde, résolution axe par axe, montée de marches, saut, propulseur
// (double saut), glissade.

export const STAND_H = 1.8;
export const CROUCH_H = 1.15;
export const SLIDE_H = 0.95;
export const RADIUS = 0.34;
const STEP = 0.55;
const GRAVITY = 24;
const JUMP_V = 7.4;
const BOOST_V = 7.0;
const GROUND_ACCEL = 60;
const AIR_ACCEL = 14;
const FRICTION = 10;

export const SPEED = { walk: 5.4, sprint: 8.0, crouch: 2.8, ads: 3.2 };

export class Body {
  constructor(x = 0, y = 0, z = 0) {
    this.pos = [x, y, z];
    this.vel = [0, 0, 0];
    this.height = STAND_H;
    this.onGround = false;
    this.crouching = false;
    this.sliding = 0;          // temps de glissade restant
    this.slideDir = [0, 0];
    this.boostAvailable = true;
    this.landImpact = 0;       // vitesse verticale à l'atterrissage (pour l'effet caméra)
    this.events = [];          // 'jump' | 'boost' | 'land' | 'slide'
  }

  get eyeHeight() { return this.height - 0.15; }

  teleport(x, y, z) {
    this.pos[0] = x; this.pos[1] = y; this.pos[2] = z;
    this.vel[0] = this.vel[1] = this.vel[2] = 0;
    this.sliding = 0; this.crouching = false; this.height = STAND_H;
  }

  /**
   * wish : { x, z } direction monde normalisée (ou nulle), speed : vitesse cible,
   * ctl : { jumpPressed, crouchPressed (fronts montants), crouchWanted, sprinting }.
   */
  step(world, dt, wish, speed, ctl) {
    this.events.length = 0;
    const v = this.vel;

    // Glissade : sprint + accroupi au sol
    if (ctl.crouchPressed && this.onGround && ctl.sprinting && this.sliding <= 0) {
      const hs = Math.hypot(v[0], v[2]);
      if (hs > 4) {
        this.sliding = 0.75;
        this.slideDir = [v[0] / hs, v[2] / hs];
        const boost = Math.max(hs, 9.5);
        v[0] = this.slideDir[0] * boost; v[2] = this.slideDir[1] * boost;
        this.events.push('slide');
      }
    }
    this.crouching = !!ctl.crouchWanted && this.sliding <= 0;

    // Hauteur cible
    const targetH = this.sliding > 0 ? SLIDE_H : this.crouching ? CROUCH_H : STAND_H;
    if (targetH > this.height) {
      // Se relever seulement s'il y a la place
      const test = Math.min(STAND_H, this.height + 4 * dt);
      if (!this._overlaps(world, this.pos, test)) this.height = test;
    } else {
      this.height = Math.max(targetH, this.height - 6 * dt);
    }

    if (this.sliding > 0) {
      this.sliding -= dt;
      const hs = Math.hypot(v[0], v[2]);
      const ns = Math.max(0, hs - 9 * dt);
      if (hs > 0.01) { v[0] *= ns / hs; v[2] *= ns / hs; }
      if (ctl.jumpPressed && this.onGround) { this.sliding = 0; }
      if (this.sliding <= 0 || ns < 3) this.sliding = 0;
    } else {
      // Accélération vers la vitesse souhaitée
      const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
      const tx = wish.x * speed, tz = wish.z * speed;
      if (this.onGround) {
        const hs = Math.hypot(v[0], v[2]);
        if (hs > 0 && !wish.x && !wish.z) {
          const drop = hs * FRICTION * dt;
          const ns = Math.max(0, hs - drop);
          v[0] *= ns / hs; v[2] *= ns / hs;
        }
      }
      const dx = tx - v[0], dz = tz - v[2];
      const dl = Math.hypot(dx, dz);
      if (dl > 0) {
        const a = Math.min(dl, accel * dt * (wish.x || wish.z || !this.onGround ? 1 : 0.5));
        if (wish.x || wish.z || this.onGround) { v[0] += dx / dl * a; v[2] += dz / dl * a; }
      }
    }

    // Saut / propulseur
    if (ctl.jumpPressed) {
      if (this.onGround) {
        v[1] = JUMP_V; this.onGround = false; this.events.push('jump');
        if (this.crouching) this.crouching = false;
      } else if (this.boostAvailable) {
        v[1] = Math.max(v[1], 0) + BOOST_V;
        const hs = Math.hypot(wish.x, wish.z);
        if (hs > 0) { v[0] += wish.x * 2.5; v[2] += wish.z * 2.5; }
        this.boostAvailable = false; this.events.push('boost');
      }
    }

    v[1] -= GRAVITY * dt;
    if (v[1] < -40) v[1] = -40;

    const wasGround = this.onGround;
    const fallSpeed = v[1];
    this._moveAxis(world, 0, v[0] * dt, wasGround);
    this._moveAxis(world, 2, v[2] * dt, wasGround);
    this.onGround = false;
    this._moveAxis(world, 1, v[1] * dt, wasGround);

    if (this.onGround) {
      this.boostAvailable = true;
      if (!wasGround && fallSpeed < -6) { this.landImpact = -fallSpeed; this.events.push('land'); }
    }

    // Garde-fou : sortie du monde
    const W = world.W / 2 + 2, D = world.D / 2 + 2;
    if (this.pos[0] < -W || this.pos[0] > W || this.pos[2] < -D || this.pos[2] > D || this.pos[1] < -5) {
      this.pos[0] = Math.max(-W + 3, Math.min(W - 3, this.pos[0]));
      this.pos[2] = Math.max(-D + 3, Math.min(D - 3, this.pos[2]));
      if (this.pos[1] < -5) this.pos[1] = 2;
    }
  }

  _aabb(p, h, out) {
    out[0] = p[0] - RADIUS; out[1] = p[1]; out[2] = p[2] - RADIUS;
    out[3] = p[0] + RADIUS; out[4] = p[1] + h; out[5] = p[2] + RADIUS;
    return out;
  }

  _overlaps(world, p, h) {
    const a = this._aabb(p, h, _a);
    for (const b of world.boxes) {
      if (a[0] < b.max[0] && a[3] > b.min[0] && a[1] < b.max[1] - 1e-4 && a[4] > b.min[1] && a[2] < b.max[2] && a[5] > b.min[2]) return b;
    }
    return null;
  }

  _moveAxis(world, axis, delta, wasGround) {
    if (delta === 0 && axis !== 1) return;
    const p = this.pos;
    p[axis] += delta;
    const a = this._aabb(p, this.height, _a);
    for (const b of world.boxes) {
      if (!(a[0] < b.max[0] && a[3] > b.min[0] && a[1] < b.max[1] && a[4] > b.min[1] && a[2] < b.max[2] && a[5] > b.min[2])) continue;
      if (axis === 1) {
        if (delta <= 0) {
          p[1] = b.max[1];
          this.vel[1] = 0;
          this.onGround = true;
        } else {
          p[1] = b.min[1] - this.height - 1e-3;
          this.vel[1] = Math.min(0, this.vel[1]);
        }
      } else {
        // Montée de marche
        const rise = b.max[1] - p[1];
        if (rise > 0 && rise <= STEP && (wasGround || this.vel[1] <= 0)) {
          const old = p[1];
          p[1] = b.max[1] + 1e-3;
          if (!this._overlaps(world, p, this.height)) { this.onGround = true; this._aabb(p, this.height, a); continue; }
          p[1] = old;
        }
        if (delta > 0) p[axis] = (axis === 0 ? b.min[0] : b.min[2]) - RADIUS - 1e-3;
        else p[axis] = (axis === 0 ? b.max[0] : b.max[2]) + RADIUS + 1e-3;
        this.vel[axis] = 0;
        if (this.sliding > 0) this.sliding = 0;
      }
      this._aabb(p, this.height, a);
    }
  }
}

const _a = new Float64Array(6);
