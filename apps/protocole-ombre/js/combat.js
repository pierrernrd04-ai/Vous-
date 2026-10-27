// Balistique (tir instantané avec zones de dégâts) et grenades.
import { rayAABB, raySphere, spreadDir } from './util.js';
import { damageAt } from './weapons.js';

const HEAD_R = 0.17;

/** Zones touchables d'une entité (tête = sphère, corps = boîte). */
export function hitboxes(e) {
  const p = e.rpos, h = e.height;
  return {
    head: [p[0], p[1] + h - 0.17, p[2]],
    min: [p[0] - 0.3, p[1], p[2] - 0.3],
    max: [p[0] + 0.3, p[1] + h - 0.33, p[2] + 0.3],
  };
}

/** Lance un rayon contre le monde puis contre les ennemis du tireur. */
export function trace(world, entities, shooter, o, d, isEnemy, maxT = 400) {
  const wall = world.raycast(o, d, maxT);
  let best = wall.t, target = null, head = false;
  for (const e of entities) {
    if (e === shooter || !e.alive || !isEnemy(shooter, e)) continue;
    const hb = hitboxes(e);
    const th = raySphere(o, d, hb.head, HEAD_R, best);
    if (th < best) { best = th; target = e; head = true; }
    const tb = rayAABB(o, d, hb.min, hb.max, best);
    if (tb < best) { best = tb; target = e; head = false; }
  }
  return { t: best, target, head, box: target ? null : wall.box };
}

/**
 * Tir d'une arme (tous les plombs). Renvoie les impacts individuels et les
 * dégâts cumulés par cible.
 */
export function fireWeapon(world, entities, shooter, o, d, w, spreadRad, isEnemy, headBias = 0) {
  const pellets = [];
  const damage = new Map();
  for (let i = 0; i < w.pellets; i++) {
    const dir = spreadDir(d, spreadRad);
    const r = trace(world, entities, shooter, o, dir, isEnemy);
    if (r.target && !r.head && headBias > 0 && Math.random() < headBias) r.head = true;
    const end = [o[0] + dir[0] * r.t, o[1] + dir[1] * r.t, o[2] + dir[2] * r.t];
    pellets.push({ end, dir, ...r });
    if (r.target) {
      const dmg = damageAt(w, r.t) * (r.head ? w.headMult : 1);
      const prev = damage.get(r.target) || { dmg: 0, head: false };
      prev.dmg += dmg; prev.head = prev.head || r.head;
      damage.set(r.target, prev);
    }
  }
  return { pellets, damage };
}

// ──────────────────────────────────────────────────────────── Grenades

export const NADE = { fuse: 2.4, radius: 7, maxDamage: 160, throwSpeed: 17 };

export class Grenade {
  constructor(ownerId, team, pos, vel, fuse = NADE.fuse) {
    this.owner = ownerId; this.team = team;
    this.pos = pos.slice(); this.vel = vel.slice();
    this.fuse = fuse; this.dead = false;
    this.mesh = null;
  }

  /** Avance la grenade ; renvoie true si elle a rebondi (pour le son). */
  step(world, dt) {
    const p = this.pos, v = this.vel;
    v[1] -= 20 * dt;
    let bounced = false;
    for (let axis = 0; axis < 3; axis++) {
      const old = p[axis];
      p[axis] += v[axis] * dt;
      for (const b of world.boxes) {
        if (p[0] > b.min[0] - 0.06 && p[0] < b.max[0] + 0.06 && p[1] > b.min[1] - 0.06 && p[1] < b.max[1] + 0.06 && p[2] > b.min[2] - 0.06 && p[2] < b.max[2] + 0.06) {
          p[axis] = old;
          const sp = Math.abs(v[axis]);
          v[axis] *= -0.42;
          if (axis === 1) { v[0] *= 0.7; v[2] *= 0.7; }
          if (sp > 2) bounced = true;
          break;
        }
      }
    }
    this.fuse -= dt;
    if (this.fuse <= 0) this.dead = true;
    return bounced;
  }
}

/** Dégâts d'explosion pour chaque entité exposée. */
export function explosionDamage(world, entities, p) {
  const out = [];
  const from = [p[0], p[1] + 0.3, p[2]];
  for (const e of entities) {
    if (!e.alive) continue;
    const c = [e.rpos[0], e.rpos[1] + e.height * 0.5, e.rpos[2]];
    const d = Math.hypot(c[0] - from[0], c[1] - from[1], c[2] - from[2]);
    if (d > NADE.radius) continue;
    if (!world.lineOfSight(from, c)) continue;
    out.push({ e, dmg: NADE.maxDamage * Math.pow(1 - d / NADE.radius, 1.2) });
  }
  return out;
}
