// Intelligence des bots (exécutée uniquement chez l'hôte).
import { wrapAngle, rand, pick, dist3 } from './util.js';
import { PRIMARIES } from './weapons.js';

export const DIFFICULTIES = [
  { name: 'Recrue', react: 0.8, aimErr: 0.1, turn: 3.2, cone: 0.1, spreadMul: 1.7, burst: [0.2, 0.5], pause: [0.6, 1.1], fov: 1.6, see: 38, strafe: 0.25, head: 0.04, nade: 0.01, dmgMul: 0.7 },
  { name: 'Régulier', react: 0.5, aimErr: 0.055, turn: 5.5, cone: 0.07, spreadMul: 1.3, burst: [0.3, 0.7], pause: [0.35, 0.8], fov: 1.8, see: 55, strafe: 0.55, head: 0.1, nade: 0.03, dmgMul: 0.85 },
  { name: 'Vétéran', react: 0.3, aimErr: 0.032, turn: 8.5, cone: 0.05, spreadMul: 1.05, burst: [0.4, 0.9], pause: [0.2, 0.5], fov: 2.0, see: 70, strafe: 0.8, head: 0.2, nade: 0.05, dmgMul: 1 },
  { name: 'Élite', react: 0.17, aimErr: 0.018, turn: 13, cone: 0.035, spreadMul: 0.85, burst: [0.5, 1.2], pause: [0.12, 0.3], fov: 2.2, see: 95, strafe: 1, head: 0.32, nade: 0.07, dmgMul: 1 },
];

const NAMES = ['Kestrel', 'Onyx', 'Vex', 'Rook', 'Talon', 'Nyx', 'Cipher', 'Havoc', 'Rhino', 'Mirage', 'Specter', 'Brick', 'Raven', 'Volt', 'Jinx', 'Saber', 'Hex', 'Tank', 'Ghost', 'Blaze', 'Echo', 'Fuse', 'Wraith', 'Ajax'];
export const botName = (i) => `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ''}`;

export function botWeapon() {
  const r = Math.random();
  const cls = r < 0.42 ? 'ar' : r < 0.67 ? 'smg' : r < 0.78 ? 'shotgun' : r < 0.89 ? 'sniper' : 'lmg';
  return pick(PRIMARIES.filter((w) => w.cls === cls)).id;
}

export class Bot {
  constructor(ent, match, diffIndex) {
    this.e = ent;
    this.m = match;
    this.d = DIFFICULTIES[diffIndex] || DIFFICULTIES[1];
    this.path = null; this.pathIdx = 0; this.goal = null; this.repathT = 0; this.goalT = 0;
    this.target = null; this.seenT = 0; this.reactT = 0; this.lastKnown = null; this.lastKnownT = 0;
    this.perceiveT = rand(0, 0.2);
    this.strafeDir = 1; this.strafeT = 0;
    this.burstT = 0; this.pauseT = 0;
    this.errPhase = rand(0, 10);
    this.aimHead = false;
    this.stuckT = 0; this.lastPos = ent.body.pos.slice();
    this.crouchT = 0;
    this.nadeCD = rand(6, 14);
    this.ctl = { wish: { x: 0, z: 0 }, speed: 0, jumpPressed: false, crouchPressed: false, crouchWanted: false, sprinting: false };
  }

  reset() {
    this.path = null; this.goal = null; this.target = null; this.lastKnown = null;
    this.reactT = 0; this.burstT = 0; this.pauseT = 0;
  }

  /** Un ennemi nous a touchés : on se retourne vers lui. */
  hurtBy(attacker) {
    if (!attacker || !attacker.alive) return;
    this.lastKnown = attacker.rpos.slice(); this.lastKnownT = 5;
    if (!this.target) this.reactT = Math.max(this.reactT, this.d.react * 0.6);
  }

  update(dt) {
    const e = this.e, m = this.m, d = this.d;
    const ctl = this.ctl;
    ctl.jumpPressed = false; ctl.crouchPressed = false; ctl.sprinting = false;
    ctl.wish.x = 0; ctl.wish.z = 0;
    const eye = [e.body.pos[0], e.body.pos[1] + e.body.eyeHeight, e.body.pos[2]];

    // ── Perception (5–7 fois par seconde)
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = rand(0.13, 0.2);
      this._perceive(eye);
    }
    this.lastKnownT -= dt;
    if (this.lastKnownT <= 0) this.lastKnown = null;
    this.nadeCD -= dt;

    const w = e.weapon;
    const tgt = this.target;
    let wantYaw = e.yaw, wantPitch = 0;
    let fire = false;

    if (tgt && tgt.alive) {
      // ── Engagement
      this.seenT += dt;
      this.reactT -= dt;
      const aim = [tgt.rpos[0], tgt.rpos[1] + (this.aimHead ? tgt.height - 0.17 : tgt.height * 0.62), tgt.rpos[2]];
      const dx = aim[0] - eye[0], dy = aim[1] - eye[1], dz = aim[2] - eye[2];
      const dist = Math.hypot(dx, dz);
      // Erreur de visée qui se resserre avec le temps d'engagement
      const settle = Math.max(0.35, 1 - this.seenT * 0.45);
      this.errPhase += dt * 2.2;
      const err = d.aimErr * settle;
      wantYaw = Math.atan2(-dx, -dz) + Math.sin(this.errPhase * 1.3) * err;
      wantPitch = Math.atan2(dy, dist) + Math.cos(this.errPhase) * err * 0.7;
      const yawErr = Math.abs(wrapAngle(wantYaw - e.yaw));
      const angSize = Math.atan2(0.35, Math.max(1, dist));

      if (this.reactT <= 0 && yawErr < d.cone + angSize && e.mag > 0 && e.reloadT <= 0) {
        if (w.mode === 'auto') {
          if (this.pauseT > 0) this.pauseT -= dt;
          else {
            fire = true;
            this.burstT -= dt;
            if (this.burstT <= 0) { this.burstT = rand(...d.burst) * (dist < 12 ? 1.6 : 1); this.pauseT = rand(...d.pause) * (dist > 30 ? 1.4 : 1); }
          }
        } else fire = true;
      }

      // Déplacement de combat
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = rand(0.5, 1.4);
        this.strafeDir = Math.random() < d.strafe ? (Math.random() < 0.5 ? -1 : 1) : 0;
        if (Math.random() < d.strafe * 0.3 && dist > 8) { this.crouchT = rand(0.8, 2); }
      }
      this.crouchT -= dt;
      ctl.crouchWanted = this.crouchT > 0;
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
      let mx = rx * this.strafeDir, mz = rz * this.strafeDir;
      const close = w.cls === 'shotgun' || w.cls === 'smg';
      if ((close && dist > 7) || (!close && w.cls !== 'sniper' && dist > 35)) { mx += fx; mz += fz; }
      else if ((w.cls === 'sniper' && dist < 14) || e.mag === 0) { mx -= fx; mz -= fz; }
      const ml = Math.hypot(mx, mz);
      if (ml > 0.01) { ctl.wish.x = mx / ml; ctl.wish.z = mz / ml; }
      ctl.speed = 4.4 * w.move;
      this.lastKnown = tgt.rpos.slice(); this.lastKnownT = 6;

      // Grenade sur une cible abritée à moyenne distance
      if (this.nadeCD <= 0 && dist > 9 && dist < 24 && Math.random() < d.nade) {
        this.nadeCD = rand(12, 22);
        m.botThrow(e, aim);
      }
    } else {
      this.target = null;
      ctl.crouchWanted = false;
      // ── Chasse ou patrouille
      if (this.lastKnown && !this.goalIsLastKnown) { this.goal = this.lastKnown; this.goalIsLastKnown = true; this.path = null; }
      if (!this.goal || this.goalT <= 0) this._newGoal();
      this.goalT -= dt;
      this.repathT -= dt;
      if ((!this.path || this.repathT <= 0) && m.pathBudget > 0) {
        m.pathBudget--;
        this.path = m.nav.findPath(e.body.pos, this.goal);
        this.pathIdx = 0; this.repathT = rand(1.5, 2.5);
        if (!this.path) { this.goal = null; }
      }
      if (this.path && this.pathIdx < this.path.length) {
        const wp = this.path[this.pathIdx];
        const dx = wp[0] - e.body.pos[0], dz = wp[2] - e.body.pos[2];
        const dl = Math.hypot(dx, dz);
        if (dl < 0.6 && Math.abs(wp[1] - e.body.pos[1]) < 1.2) {
          this.pathIdx++;
          if (this.pathIdx >= this.path.length) { this.goal = null; this.goalIsLastKnown = false; if (this.lastKnown && dist3(this.lastKnown, e.body.pos) < 3) this.lastKnown = null; }
        } else if (dl > 0.01) {
          ctl.wish.x = dx / dl; ctl.wish.z = dz / dl;
          wantYaw = Math.atan2(-dx, -dz);
        }
        // Sprint en patrouille si long trajet
        const sprint = !this.lastKnown && this.path.length - this.pathIdx > 3;
        ctl.sprinting = sprint;
        ctl.speed = (sprint ? 7.2 : 5) * w.move;
      }
      // Rechargement tactique au calme
      if (e.mag < w.mag * 0.4 && e.reloadT <= 0) m.startReload(e);
    }

    // Détection de blocage
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      const moved = Math.hypot(e.body.pos[0] - this.lastPos[0], e.body.pos[2] - this.lastPos[2]);
      if ((ctl.wish.x || ctl.wish.z) && moved < 0.35) {
        ctl.jumpPressed = true;
        this.path = null; this.repathT = 0;
        if (!this.target) this.goal = null;
        this.strafeDir = -this.strafeDir || 1;
      }
      this.lastPos = e.body.pos.slice();
      this.stuckT = 0;
    }

    // Rotation limitée en vitesse
    const turn = d.turn * dt * (tgt ? 1 : 0.7);
    const dyaw = wrapAngle(wantYaw - e.yaw);
    e.yaw = wrapAngle(e.yaw + Math.max(-turn, Math.min(turn, dyaw)));
    e.pitch += Math.max(-turn, Math.min(turn, wantPitch - e.pitch));

    if (fire) m.botFire(e, d);
    if (e.mag <= 0 && e.reloadT <= 0) m.startReload(e);
    return ctl;
  }

  _perceive(eye) {
    const e = this.e, m = this.m, d = this.d;
    let best = null, bestScore = Infinity;
    for (const o of m.entityList) {
      if (o === e || !o.alive || !m.isEnemy(e, o)) continue;
      const c = [o.rpos[0], o.rpos[1] + o.height * 0.75, o.rpos[2]];
      const dx = c[0] - eye[0], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dz);
      if (dist > d.see) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(-dx, -dz) - e.yaw));
      const noticed = ang < d.fov / 2 || dist < 5 || (this.lastKnown && dist3(this.lastKnown, o.rpos) < 4);
      if (!noticed) continue;
      if (!m.world.lineOfSight(eye, c)) continue;
      const score = dist + ang * 6 + (o === this.target ? -8 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best !== this.target) {
      if (best) {
        this.reactT = this.d.react * rand(0.7, 1.3) * (this.target ? 0.5 : 1);
        this.seenT = 0;
        this.aimHead = Math.random() < d.head;
      }
      this.target = best;
    }
    // Ouïe : tirs proches non masqués
    if (!best) {
      for (const o of m.entityList) {
        if (o === e || !o.alive || !m.isEnemy(e, o)) continue;
        if (m.time - o.lastShotTime < 0.8 && dist3(o.rpos, e.body.pos) < 40) {
          this.lastKnown = o.rpos.slice(); this.lastKnownT = 5; this.goalIsLastKnown = false;
          break;
        }
      }
    }
  }

  _newGoal() {
    const m = this.m;
    this.goalIsLastKnown = false;
    this.goalT = rand(10, 18);
    const enemies = m.entityList.filter((o) => o.alive && m.isEnemy(this.e, o));
    if (enemies.length && Math.random() < 0.6) {
      const t = pick(enemies);
      this.goal = [t.rpos[0] + rand(-8, 8), t.rpos[1], t.rpos[2] + rand(-8, 8)];
    } else {
      const n = m.nav.randomOpen();
      this.goal = n !== undefined ? m.nav.pos(n) : [0, 0, 0];
    }
    this.path = null;
  }
}
