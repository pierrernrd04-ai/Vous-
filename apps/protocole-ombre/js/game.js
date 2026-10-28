// Une partie : monde, entités (joueurs, bots), règles, réseau.
// L'hôte fait autorité (dégâts, éliminations, bots, réapparitions, score) ;
// chaque client simule son propre soldat et détecte ses propres impacts.
import * as THREE from 'three';
import { World, buildEnvironment } from './world.js';
import { NavGrid } from './nav.js';
import { Body, SPEED, STAND_H, CROUCH_H } from './physics.js';
import { Character } from './character.js';
import { Effects } from './effects.js';
import { Bot } from './bots.js';
import { fireWeapon, trace, Grenade, NADE, explosionDamage } from './combat.js';
import { getWeapon } from './weapons.js';
import { getMap } from './maps.js';
import { audio } from './audio.js';
import { clamp, lerp, damp, rand, wrapAngle, dirFromAngles, dist3 } from './util.js';

const DEG = Math.PI / 180;
const SNAP_RATE = 1 / 15;
const STATE_RATE = 1 / 20;
const INTERP = 0.1;
const RESPAWN = 4;
const ALLY = '#4fd8ff', FOE = '#ff5a3c', ME = '#ffcc33';

export class Match {
  constructor(ctx) {
    this.ctx = ctx;
    const { renderer, quality, cfg, roster, localId, net } = ctx;
    this.cfg = cfg;
    this.net = net;
    this.isHost = !net || net.isHost || !net.peer;
    this.online = !!(net && net.peer);
    this.map = getMap(cfg.map);
    this.hud = ctx.hud;
    this.input = ctx.input;
    this.vm = ctx.vm;
    this.settings = ctx.settings;

    // Scène
    const theme = this.map.theme;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
    this.scene.background = new THREE.Color(theme.fog);
    this.world = new World(this.map, quality);
    this.scene.add(this.world.group);
    this.envTex = buildEnvironment(renderer, this.world, this.scene);
    this.vm.setTheme(theme, this.envTex);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.05, 1500);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.effects = new Effects(this.scene, quality);
    this.effects.setWeather(theme, this.camera);
    if (this.isHost) this.nav = new NavGrid(this.world);

    // Entités
    this.entities = new Map();
    this.entityList = [];
    this.teamScore = [0, 0];
    this.grenades = [];
    for (const r of roster) this._addEntity(r, localId);
    this.local = this.entities.get(localId);
    this.lp = this._localState();

    this.time = 0;
    this.timeLeft = cfg.timeLimit;
    this.phase = 'countdown';
    this.countdown = 3.5;
    this.snapT = 0; this.stateT = 0; this.mmT = 0;
    this.ended = false;
    this.paused = false;

    if (this.isHost) {
      this._spawnCandidates();
      const idx = [0, 0];
      for (const e of this.entityList) {
        if (e.peer && !e.isBot) continue; // apparaît quand son client est prêt
        if (this.cfg.mode === 'ffa') { this._spawn(e, this._pickSpawn(e)); continue; }
        const list = this.world.spawns[e.team];
        const s = list[idx[e.team]++ % list.length];
        this._spawn(e, { x: s.x + rand(-0.4, 0.4), z: s.z + rand(-0.4, 0.4), yaw: s.yaw });
      }
    } else {
      this.net.send({ t: 'ready' });
    }
    audio.ambience(theme.ambientSound);
  }

  // ─────────────────────────────────────────────── mise en place

  _addEntity(r, localId) {
    const isLocal = r.id === localId;
    const e = {
      id: r.id, name: r.name, team: r.team, isBot: !!r.isBot, isLocal, peer: r.peer || null,
      body: null, rpos: [0, -50, 0], height: STAND_H, yaw: 0, pitch: 0, crouch: 0, speed: 0, air: false, ads: false, sprint: false,
      hp: 100, alive: false, respawnT: 0, regenT: 0, kills: 0, deaths: 0, score: 0, streak: 0,
      weapon: getWeapon(r.weapon), mag: 0, reloadT: 0, fireCD: 0, lastShotTime: -99, nades: 2,
      snaps: [], lastAttacker: null, model: null, prevPos: [0, 0, 0],
    };
    e.mag = e.weapon.mag;
    // Corps simulé ici : le joueur local, et les bots chez l'hôte
    if (isLocal || (e.isBot && this.isHost)) {
      e.body = new Body(0, -50, 0);
      e.rpos = e.body.pos;
    }
    if (e.isBot && this.isHost) e.bot = new Bot(e, this, this.cfg.diff);
    if (!isLocal) this._makeModel(e);
    this.entities.set(e.id, e);
    this.entityList.push(e);
    return e;
  }

  _makeModel(e) {
    const ally = this._isAllyOfLocal(e);
    // Factions absolues en équipe (bleus contre rouges) ; en mêlée, tous les autres sont rouges.
    const faction = this.cfg.mode === 'ffa' ? 1 : e.team;
    e.model = new Character({ team: faction, name: e.name, showName: true, tagColor: ally ? ALLY : FOE, weapon: e.weapon });
    e.model.showTag(ally);
    e.model.root.visible = false;
    this.scene.add(e.model.root);
  }

  /** Faction des bras du joueur local. */
  _vmTeam() { return this.cfg.mode === 'ffa' ? 0 : this.ctx.localTeam; }

  _isAllyOfLocal(e) {
    return this.cfg.mode !== 'ffa' && this.ctx.localTeam === e.team;
  }

  _localState() {
    const prof = this.ctx.loadout;
    const P = {
      weapons: [prof.primary, prof.secondary].map((id) => {
        const def = getWeapon(id);
        return { def, mag: def.mag, reserve: def.mag * def.reserveMags };
      }),
      wi: 0, fireCD: 0, burstLeft: 0, burstCD: 0, reloadT: 0, reloadDur: 1, swapT: 0, ads: 0, bloom: 0,
      recoilP: 0, recoilY: 0, prevTrigger: false, sprintOut: 0,
      ability: 0.35, pulseT: 0, uavT: 0, overT: 0, dip: 0, dipV: 0, shake: 0, stepAcc: 0,
      killerId: null, deathPos: null, aimTarget: null, hurtT: 0,
    };
    this.vm.equip(P.weapons[0].def, this._vmTeam());
    this.local.weapon = P.weapons[0].def;
    return P;
  }

  _spawnCandidates() {
    const list = [...this.world.spawns[0], ...this.world.spawns[1]].map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, y: 0 }));
    for (let i = 0; i < 18; i++) {
      const n = this.nav.randomOpen();
      if (n === undefined) break;
      const p = this.nav.pos(n);
      if (p[1] > 0.2) continue;
      list.push({ x: p[0], z: p[2], yaw: Math.atan2(p[0], p[2]), y: p[1] });
    }
    this.spawnPoints = list;
  }

  _pickSpawn(e) {
    let best = null, bestScore = -Infinity;
    const enemies = this.entityList.filter((o) => o !== e && o.alive && this.isEnemy(e, o));
    const allies = this.entityList.filter((o) => o !== e && o.alive && !this.isEnemy(e, o));
    for (const s of this.spawnPoints) {
      let minD = 60;
      let seen = false;
      for (const o of enemies) {
        const d = Math.hypot(o.rpos[0] - s.x, o.rpos[2] - s.z);
        minD = Math.min(minD, d);
        if (d < 50 && !seen && this.world.lineOfSight([s.x, 1.6, s.z], [o.rpos[0], o.rpos[1] + 1.5, o.rpos[2]])) seen = true;
      }
      let allyBonus = 0;
      for (const o of allies) { const d = Math.hypot(o.rpos[0] - s.x, o.rpos[2] - s.z); if (d < 20) allyBonus += 3; }
      const score = Math.min(minD, 45) - (seen ? 35 : 0) + Math.min(allyBonus, 9) + rand(0, 6);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    // Orienter vers le centre de la carte
    return { x: best.x + rand(-0.4, 0.4), z: best.z + rand(-0.4, 0.4), yaw: Math.atan2(best.x, best.z) };
  }

  /** (Hôte) Fait apparaître une entité et prévient son propriétaire. */
  _spawn(e, s) {
    this._applySpawn(e, s);
    if (this.online && e.peer && !e.isBot) this.net.sendTo(e.peer, { t: 'spawn', x: s.x, z: s.z, yaw: s.yaw });
  }

  _applySpawn(e, s) {
    e.alive = true; e.hp = 100; e.regenT = 0; e.nades = 2; e.lastAttacker = null;
    e.yaw = s.yaw; e.pitch = 0;
    e.snaps.length = 0;
    if (e.body) e.body.teleport(s.x, 0.05, s.z);
    else { e.rpos[0] = s.x; e.rpos[1] = 0; e.rpos[2] = s.z; }
    e.mag = e.weapon.mag; e.reloadT = 0; e.fireCD = 0.5;
    if (e.bot) e.bot.reset();
    if (e.model) e.model.root.visible = true;
    if (e.isLocal) {
      const P = this.lp;
      for (const w of P.weapons) { w.mag = w.def.mag; w.reserve = w.def.mag * w.def.reserveMags; }
      P.wi = 0; P.reloadT = 0; P.swapT = 0.5; P.ads = 0; P.recoilP = 0; P.bloom = 0; P.killerId = null;
      this.vm.equip(P.weapons[0].def, this._vmTeam());
      e.weapon = P.weapons[0].def;
      this.hud.showDeath(false);
      this.input.clearCrouch();
    }
  }

  isEnemy(a, b) { return a !== b && a.team !== b.team; }

  // ─────────────────────────────────────────────── boucle

  update(dt) {
    if (this.paused && !this.online) return;
    this.time += dt;
    const now = performance.now() / 1000;
    const e = this.local, P = this.lp;

    if (this.isHost && !this.ended) this._hostTimers(dt);

    // Entrées
    const live = this.phase === 'live' && !this.ended;
    const inp = this.input.frame(dt);
    if (inp.pause && this.ctx.onPause) this.ctx.onPause();
    this.hud.showScoreboard(inp.score && !this.ended, this);

    if (e.alive) this._updateLocal(dt, live ? inp : { ...NO_INPUT, lookX: inp.lookX, lookY: inp.lookY });
    else this._updateDead(dt);

    // Bots (hôte)
    if (this.isHost) {
      this.pathBudget = 2;
      for (const b of this.entityList) {
        if (!b.bot) continue;
        b.fireCD -= dt;
        if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.mag = b.weapon.mag; }
        if (!b.alive) continue;
        const ctl = live ? b.bot.update(dt) : IDLE_CTL;
        b.body.step(this.world, dt, ctl.wish, ctl.speed, ctl);
        b.height = b.body.height;
        b.crouch = b.body.height < 1.5 ? 1 : 0;
        b.air = !b.body.onGround;
        b.sprint = ctl.sprinting;
        if (this.world.inHazard(b.body.pos)) this.applyDamage(b.id, 140 * dt, null, 'lava', false);
        if (b.body.events.includes('boost')) audio.boost(b.rpos);
      }
    }

    // Réseau
    if (this.online) {
      if (this.isHost) {
        this.snapT -= dt;
        if (this.snapT <= 0) { this.snapT = SNAP_RATE; this._sendSnapshot(); }
      } else {
        this.stateT -= dt;
        if (this.stateT <= 0) { this.stateT = STATE_RATE; this._sendState(); }
      }
    }

    // Entités distantes : interpolation
    for (const o of this.entityList) {
      if (o.body) continue;
      this._interpolate(o, now);
    }

    this._updateGrenades(dt);
    this._animateModels(dt);
    this._updateCamera(dt, inp);
    this.effects.update(dt, [this.camera.position.x, this.camera.position.y, this.camera.position.z]);
    this.world.update(this.time);
    this._updateHud(dt);
    audio.setListener([this.camera.position.x, this.camera.position.y, this.camera.position.z], e.yaw);
  }

  _hostTimers(dt) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'live'; this.hud.center(''); this.hud.toast('COMBATTEZ !', this.map.name, 'big'); }
      else this.hud.center(String(Math.ceil(this.countdown - 0.5) || 'PRÊT'), this.map.name);
      return;
    }
    this.timeLeft -= dt;
    for (const o of this.entityList) {
      if (o.alive) {
        o.regenT -= dt;
        if (o.regenT <= 0 && o.hp < 100) o.hp = Math.min(100, o.hp + 30 * dt);
      } else {
        o.respawnT -= dt;
        if (o.respawnT <= 0 && !this.ended && (o.isBot || o.isLocal || (o.peer && o.ready))) this._spawn(o, this._pickSpawn(o));
      }
    }
    if (this.timeLeft <= 0) this._end();
  }

  // ─────────────────────────────────────────────── joueur local

  _updateLocal(dt, inp) {
    const e = this.local, P = this.lp, body = e.body;
    const W = P.weapons[P.wi], w = W.def;
    const over = P.overT > 0;
    P.overT -= dt; P.pulseT -= dt; P.uavT -= dt; P.hurtT -= dt;
    P.ability = Math.min(1, P.ability + dt / 45);

    // ── Visée assistée (tactile / manette) et regard
    let lookScale = 1 / (1 + (w.zoom - 1) * P.ads * 0.9);
    const assist = this.settings.aimAssist && (this.input.touch || this.input.gamepad);
    const eye = [body.pos[0], body.pos[1] + body.eyeHeight, body.pos[2]];
    const aimDir = dirFromAngles(e.yaw + P.recoilY, e.pitch + P.recoilP);
    const tr = trace(this.world, this.entityList, e, eye, aimDir, (a, b) => this.isEnemy(a, b), 150);
    P.aimTarget = tr.target;
    if (assist) {
      const tgt = this._assistTarget(eye, aimDir);
      if (tgt) {
        lookScale *= 0.55;
        const moving = Math.abs(inp.moveX) + Math.abs(inp.moveY) > 0.1 || Math.abs(inp.lookX) > 0.0005;
        if (moving) {
          e.yaw += clamp(wrapAngle(tgt.yaw - e.yaw), -0.9 * dt, 0.9 * dt) * (0.5 + P.ads * 0.5);
          e.pitch += clamp(tgt.pitch - e.pitch, -0.5 * dt, 0.5 * dt) * (0.5 + P.ads * 0.5);
        }
      }
    }
    e.yaw = wrapAngle(e.yaw + inp.lookX * lookScale);
    e.pitch = clamp(e.pitch + inp.lookY * lookScale, -1.5, 1.5);
    this._lookDX = inp.lookX; this._lookDY = inp.lookY;

    // ── Déplacement
    const firing = inp.fire || (this.settings.autoFire && this.input.touch && this._autoFireOk(tr, w));
    if (firing) P.sprintOut = 0.18; else P.sprintOut -= dt;
    const sprint = inp.sprint && inp.moveY > 0.3 && P.ads < 0.3 && P.sprintOut <= 0 && !body.crouching;
    let speed = body.crouching ? SPEED.crouch : sprint ? SPEED.sprint : P.ads > 0.5 ? SPEED.ads : SPEED.walk;
    speed *= w.move * (over ? 1.12 : 1);
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    let wx = rx * inp.moveX + fx * inp.moveY, wz = rz * inp.moveX + fz * inp.moveY;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const mag = Math.min(1, wl);
    body.step(this.world, dt, { x: mag > 0.05 ? wx / (wl || 1) : 0, z: mag > 0.05 ? wz / (wl || 1) : 0 }, speed * Math.max(0.35, mag), {
      jumpPressed: inp.jump, crouchPressed: inp.crouchPressed, crouchWanted: inp.crouchWanted, sprinting: sprint,
    });
    for (const ev of body.events) {
      if (ev === 'jump') { this.input.clearCrouch(); audio.step(null); }
      if (ev === 'boost') { audio.boost(null); this.effects.spark([body.pos[0], body.pos[1] + 0.8, body.pos[2]], 12, [0.5, 1.6, 3], 2.5); }
      if (ev === 'slide') { this.input.clearCrouch(); audio.slide(); }
      if (ev === 'land') { P.dipV -= Math.min(0.35, body.landImpact * 0.025); audio.step(null); }
    }
    e.height = body.height; e.crouch = body.height < 1.5 ? 1 : 0; e.air = !body.onGround; e.sprint = sprint; e.ads = P.ads > 0.5;
    const hs = Math.hypot(body.vel[0], body.vel[2]);
    e.speed = hs;
    if (body.onGround && hs > 2.5 && body.sliding <= 0) {
      P.stepAcc += hs * dt;
      if (P.stepAcc > (sprint ? 2.6 : 2.1)) { P.stepAcc = 0; audio.step(null); }
    }
    if (this.world.inHazard(body.pos)) this._localDamage(e.id, 140 * dt, 'lava');

    // ── Arme
    P.fireCD -= dt * (over ? 1.25 : 1);
    P.burstCD -= dt;
    P.swapT -= dt;
    P.bloom = Math.max(0, P.bloom - dt * 5);
    P.recoilP = damp(P.recoilP, 0, 7, dt);
    P.recoilY = damp(P.recoilY, 0, 7, dt);

    if (inp.swap && P.swapT <= 0) {
      const target = inp.slot >= 0 ? inp.slot : 1 - P.wi;
      if (target !== P.wi) {
        P.wi = target; P.reloadT = 0; P.swapT = 0.45; P.ads = 0; P.burstLeft = 0;
        this.vm.equip(P.weapons[P.wi].def, this._vmTeam());
        e.weapon = P.weapons[P.wi].def;
        audio.ui('click');
        return;
      }
    }

    const reloading = P.reloadT > 0;
    if (reloading) {
      P.reloadT -= dt * (over ? 1.4 : 1);
      if (P.reloadT <= 0) {
        const take = Math.min(w.mag - W.mag, W.reserve);
        W.mag += take; W.reserve -= take;
      }
    }
    const wantReload = (inp.reload || (W.mag === 0 && P.fireCD <= 0)) && P.reloadT <= 0 && W.mag < w.mag && W.reserve > 0 && P.swapT <= 0;
    if (wantReload) { P.reloadT = P.reloadDur = w.reload; P.burstLeft = 0; audio.reload(w.reload); }

    const adsWanted = inp.ads && !sprint && P.swapT <= 0 && P.reloadT <= 0;
    P.ads = clamp(P.ads + (adsWanted ? 1 : -1) * dt / w.adsTime, 0, 1);

    const trigger = !!firing;
    const edge = trigger && !P.prevTrigger;
    P.prevTrigger = trigger;
    const ready = P.fireCD <= 0 && P.reloadT <= 0 && P.swapT <= 0 && !sprint;
    if (edge && W.mag === 0 && P.reloadT <= 0) audio.empty();

    if (w.mode === 'burst') {
      if (edge && ready && P.burstLeft === 0 && W.mag > 0) { P.burstLeft = w.burst; P.burstCD = 0; }
      if (P.burstLeft > 0 && P.burstCD <= 0 && W.mag > 0 && P.reloadT <= 0) {
        this._localShoot(W, w, eye);
        P.burstLeft--; P.burstCD = 60 / w.rpm;
        if (P.burstLeft === 0 || W.mag === 0) { P.burstLeft = 0; P.fireCD = w.burstDelay; }
      }
    } else if (ready && W.mag > 0 && (w.mode === 'auto' ? trigger : edge)) {
      this._localShoot(W, w, eye);
      P.fireCD = 60 / w.rpm;
      if (w.mode === 'pump' || w.mode === 'bolt') audio.pump();
    }

    // Grenade
    if (inp.nade && e.nades > 0 && P.swapT <= 0) {
      e.nades--;
      const d = dirFromAngles(e.yaw, e.pitch + 0.12);
      const p = [eye[0] + d[0] * 0.5, eye[1] - 0.1, eye[2] + d[2] * 0.5];
      const v = [d[0] * NADE.throwSpeed + body.vel[0] * 0.4, d[1] * NADE.throwSpeed + 2.5, d[2] * NADE.throwSpeed + body.vel[2] * 0.4];
      this._throw(e, p, v);
      P.swapT = 0.5;
    }
    // Compétence : Impulsion
    if (inp.ability && P.ability >= 1) {
      P.ability = 0; P.pulseT = 7;
      audio.streak();
      this.hud.toast('IMPULSION', 'Ennemis révélés à travers les murs', 'ability');
      this.effects.flashLight([body.pos[0], body.pos[1] + 1, body.pos[2]], 0x19e6ff, 8, 0.5);
    }
  }

  _autoFireOk(tr, w) {
    return tr.target && tr.t < w.range[1] * 1.4 && this.lp.swapT <= 0;
  }

  _assistTarget(eye, dir) {
    let best = null, bestA = 5 * DEG;
    for (const o of this.entityList) {
      if (!o.alive || !this.isEnemy(this.local, o)) continue;
      const c = [o.rpos[0], o.rpos[1] + o.height * 0.7, o.rpos[2]];
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const L = Math.hypot(dx, dy, dz);
      if (L > 50) continue;
      const a = Math.acos(clamp((dx * dir[0] + dy * dir[1] + dz * dir[2]) / L, -1, 1));
      if (a < bestA && this.world.lineOfSight(eye, c)) {
        bestA = a;
        best = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
      }
    }
    return best;
  }

  _localShoot(W, w, eye) {
    const e = this.local, P = this.lp, body = e.body;
    W.mag--;
    const moving = Math.hypot(body.vel[0], body.vel[2]) > 1.5;
    let spread = lerp(w.spread[0], w.spread[1], P.ads);
    if (moving && P.ads < 0.5) spread *= 1.3;
    if (!body.onGround) spread *= 1.8;
    if (body.crouching) spread *= 0.85;
    spread = (spread + P.bloom * (1 - P.ads * 0.6)) * DEG;
    P.bloom = Math.min(3, P.bloom + (w.cls === 'sniper' ? 2 : 0.3));
    const dir = dirFromAngles(e.yaw + P.recoilY, e.pitch + P.recoilP);
    const k = (1 - 0.3 * P.ads) * rand(0.85, 1.15) * w.recoil.v * DEG;
    e.pitch = clamp(e.pitch + k * 0.5, -1.5, 1.5);
    P.recoilP += k * 0.5;
    P.recoilY += rand(-1, 1) * w.recoil.h * DEG * 0.6;
    e.yaw += rand(-1, 1) * w.recoil.h * DEG * 0.25;
    P.shake = Math.min(1, P.shake + (w.cls === 'shotgun' || w.cls === 'sniper' ? 0.5 : 0.12));
    this.vm.fire(w.cls === 'shotgun' || w.cls === 'sniper' ? 2 : 1);
    audio.shot(w.cls, null);
    const muzzle = this.vm.muzzleWorld(this.camera);
    this.shoot(e, eye, dir, w, spread, 1, [muzzle.x, muzzle.y, muzzle.z]);
    if (w.id !== 'cobra' && w.id !== 'krait') {
      // Douille éjectée vers la droite
      const ej = this.vm.ejectWorld(this.camera);
      const cam = this.camera;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const vel = right.multiplyScalar(rand(1.8, 2.6)).addScaledVector(up, rand(1.2, 2)).add(new THREE.Vector3(body.vel[0], 0, body.vel[2]));
      this.effects.shell(ej, vel, body.pos[1]);
    }
  }

  // ─────────────────────────────────────────────── tir commun

  /**
   * Résout un tir pour l'entité `e` (joueur local ou bot chez l'hôte) :
   * effets, dégâts et diffusion réseau.
   */
  shoot(e, origin, dir, w, spread, dmgMul = 1, muzzle = null) {
    const res = fireWeapon(this.world, this.entityList, e, origin, dir, w, spread, (a, b) => this.isEnemy(a, b));
    e.lastShotTime = this.time;
    const from = muzzle || this._muzzleOf(e) || origin;
    const ends = res.pellets.slice(0, w.pellets > 1 ? 4 : 1).map((p) => p.end.map((v) => Math.round(v * 100) / 100));
    this._shotFx(e, from, res.pellets, w, !!muzzle);
    for (const [target, { dmg, head }] of res.damage) {
      if (this.isHost) this.applyDamage(target.id, dmg * dmgMul, e.id, w.id, head);
      else {
        this.net.send({ t: 'hit', v: target.id, d: Math.round(dmg * 10) / 10, h: head, w: w.id });
        if (e.isLocal) { this.hud.hitmarker(head, false); audio.hit(head); }
      }
    }
    if (this.online) {
      const msg = { t: 'shot', id: e.id, w: w.id, e: ends };
      if (this.isHost) this.net.broadcast(msg); else this.net.send(msg);
    }
  }

  _muzzleOf(e) {
    if (!e.model) return null;
    const v = new THREE.Vector3();
    e.model.muzzle.getWorldPosition(v);
    return [v.x, v.y, v.z];
  }

  _shotFx(e, from, pellets, w, local) {
    const tracerCol = e.isLocal || this._isAllyOfLocal(e) ? [1.2, 1.6, 2.2] : [2.4, 1.2, 0.5];
    pellets.forEach((p, i) => {
      if (i < 3 && (w.pellets === 1 || Math.random() < 0.6)) this.effects.tracer(from, p.end, tracerCol);
      if (p.target) { this.effects.bodyHit(p.end, p.head); p.target.model?.hit(); }
      else if (p.box) this.effects.impact(p.end, World.faceNormal(p.box, p.end));
    });
    if (!local) {
      this.effects.muzzle(from, false);
      if (e.model) e.model.root.userData.fireT = 0.06;
    }
  }

  /** Effets d'un tir reçu par le réseau. */
  _remoteShot(msg) {
    const e = this.entities.get(msg.id);
    if (!e || e.isLocal) return;
    const w = getWeapon(msg.w);
    e.lastShotTime = this.time;
    const from = this._muzzleOf(e) || [e.rpos[0], e.rpos[1] + 1.4, e.rpos[2]];
    for (const end of msg.e) {
      this.effects.tracer(from, end, this._isAllyOfLocal(e) ? [1.2, 1.6, 2.2] : [2.4, 1.2, 0.5]);
      const dir = [end[0] - from[0], end[1] - from[1], end[2] - from[2]];
      const L = Math.hypot(...dir);
      const hit = this.world.raycast(from, dir.map((v) => v / L), L + 0.2);
      if (hit.box && hit.t > L - 0.3) this.effects.impact(end, World.faceNormal(hit.box, end));
      else this.effects.spark(end, 3, [2, 0.6, 0.4], 2);
    }
    this.effects.muzzle(from, false);
    audio.shot(w.cls, from);
  }

  // ─────────────────────────────────────────────── bots (hôte)

  botFire(e, d) {
    if (e.fireCD > 0 || e.reloadT > 0 || e.mag <= 0) return;
    const w = e.weapon;
    let interval = 60 / w.rpm;
    if (w.mode === 'semi') interval = Math.max(interval, rand(0.22, 0.42));
    if (w.mode === 'burst') interval = Math.max(interval, 0.12);
    e.fireCD = interval;
    e.mag--;
    const moving = Math.hypot(e.body.vel[0], e.body.vel[2]) > 1.5;
    const ads = w.cls === 'sniper' ? 1 : 0.75;
    let spread = lerp(w.spread[0], w.spread[1], ads) * d.spreadMul + (moving ? 0.6 : 0.2);
    if (w.cls === 'sniper') spread = 0.35 * d.spreadMul;
    const eye = [e.body.pos[0], e.body.pos[1] + e.body.eyeHeight, e.body.pos[2]];
    this.shoot(e, eye, dirFromAngles(e.yaw, e.pitch), w, spread * DEG, d.dmgMul);
    audio.shot(w.cls, this._muzzleOf(e) || eye);
  }

  startReload(e) {
    if (e.reloadT > 0 || e.mag >= e.weapon.mag) return;
    e.reloadT = e.weapon.reload;
  }

  botThrow(e, target) {
    if (e.nades <= 0) return;
    e.nades--;
    const eye = [e.body.pos[0], e.body.pos[1] + e.body.eyeHeight, e.body.pos[2]];
    const dx = target[0] - eye[0], dz = target[2] - eye[2];
    const d = Math.hypot(dx, dz);
    const ang = 0.6;
    const v = Math.min(19, Math.sqrt((d * 20) / Math.sin(2 * ang)));
    const vel = [dx / d * v * Math.cos(ang), v * Math.sin(ang), dz / d * v * Math.cos(ang)];
    this._throw(e, eye, vel);
  }

  // ─────────────────────────────────────────────── grenades

  _throw(e, p, v) {
    const g = new Grenade(e.id, e.team, p, v);
    this._addGrenadeMesh(g);
    g.owned = true;
    this.grenades.push(g);
    if (this.online) {
      const msg = { t: 'nade', id: e.id, p: p.map((x) => +x.toFixed(2)), v: v.map((x) => +x.toFixed(2)) };
      if (this.isHost) this.net.broadcast(msg); else this.net.send(msg);
    }
  }

  _addGrenadeMesh(g) {
    if (!this._nadeGeo) {
      this._nadeGeo = new THREE.SphereGeometry(0.08, 10, 8);
      this._nadeMat = new THREE.MeshStandardMaterial({ color: 0x2a3326, roughness: 0.5, metalness: 0.6, emissive: 0xff2010, emissiveIntensity: 0.6 });
    }
    g.mesh = new THREE.Mesh(this._nadeGeo, this._nadeMat);
    g.mesh.position.set(...g.pos);
    this.scene.add(g.mesh);
  }

  _updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (g.step(this.world, dt)) audio.bounce(g.pos);
      g.mesh.position.set(...g.pos);
      g.mesh.rotation.x += dt * 8;
      if (!g.dead) continue;
      this.scene.remove(g.mesh);
      this.grenades.splice(i, 1);
      this.effects.explosion(g.pos);
      audio.explosion(g.pos);
      const dCam = this.camera.position.distanceTo(new THREE.Vector3(...g.pos));
      this.lp.shake = Math.min(1.5, this.lp.shake + Math.max(0, 1.2 - dCam / 15));
      if (!g.owned) continue;
      const owner = this.entities.get(g.owner);
      for (const { e, dmg } of explosionDamage(this.world, this.entityList, g.pos)) {
        if (owner && e !== owner && !this.isEnemy(owner, e)) continue;
        const d = e === owner ? dmg * 0.5 : dmg;
        if (this.isHost) this.applyDamage(e.id, d, g.owner, 'nade', false);
        else this.net.send({ t: 'hit', v: e.id, d: Math.round(d), h: false, w: 'nade' });
      }
    }
  }

  // ─────────────────────────────────────────────── dégâts et éliminations

  /** (Hôte) Applique des dégâts ; attackerId null = environnement. */
  applyDamage(targetId, dmg, attackerId, wid, head) {
    const t = this.entities.get(targetId);
    if (!t || !t.alive || this.ended || this.phase !== 'live') return;
    const a = attackerId ? this.entities.get(attackerId) : null;
    if (a && a !== t && !this.isEnemy(a, t)) return;
    t.hp -= dmg;
    t.regenT = 4;
    if (a && a !== t) t.lastAttacker = a.id;
    if (t.bot) t.bot.hurtBy(a);
    const kill = t.hp <= 0;
    if (t.isLocal) this._localHurt(dmg, a);
    else if (t.peer && !t.isBot) this.net.sendTo(t.peer, { t: 'dmg', d: Math.round(dmg), hp: Math.max(0, Math.round(t.hp)), f: a ? a.rpos.map((v) => +v.toFixed(1)) : null });
    if (a && a !== t) {
      if (a.isLocal) { this.hud.hitmarker(head, kill); audio.hit(head); }
      else if (a.peer && !a.isBot && kill) this.net.sendTo(a.peer, { t: 'hm', h: head, k: true });
    }
    if (kill) this._kill(t, a && a !== t ? a : null, wid, head);
  }

  _kill(t, a, wid, head) {
    t.alive = false; t.hp = 0; t.deaths++; t.respawnT = RESPAWN;
    const msg = { t: 'kill', k: a ? a.id : null, v: t.id, w: wid, h: !!head };
    if (a) {
      a.kills++; a.score += 100 + (head ? 25 : 0);
      if (this.cfg.mode !== 'ffa') this.teamScore[a.team]++;
    }
    if (this.online) this.net.broadcast(msg);
    this._onKill(msg);
    const limit = this.cfg.scoreLimit;
    if (this.cfg.mode === 'ffa' ? a && a.kills >= limit : Math.max(...this.teamScore) >= limit) this._end();
  }

  /** (Tous) Réaction à une élimination. */
  _onKill(msg) {
    const k = msg.k ? this.entities.get(msg.k) : null;
    const v = this.entities.get(msg.v);
    if (!v) return;
    v.alive = false;
    const wname = msg.w === 'nade' ? 'Grenade' : msg.w === 'lava' ? 'Métal en fusion' : getWeapon(msg.w).name;
    const col = (e) => (!e ? '#aaa' : e.isLocal ? ME : this._isAllyOfLocal(e) ? ALLY : FOE);
    this.hud.killfeed(k ? k.name : '—', v.name, wname, msg.h, col(k), col(v));
    const P = this.lp;
    if (v.isLocal) {
      v.streak = 0;
      P.killerId = k ? k.id : null;
      P.deathPos = v.rpos.slice();
      P.deathT = RESPAWN;
      P.ads = 0;
      this.hud.showDeath(true, k ? k.name : 'Accident', wname, RESPAWN);
    }
    if (k && k.isLocal && !v.isLocal) {
      k.streak++;
      audio.kill();
      this.hud.popup(msg.h ? '+125  TIR À LA TÊTE' : '+100  ÉLIMINATION', msg.h ? 'head' : '');
      P.ability = Math.min(1, P.ability + 0.15);
      if (k.streak === 3) { P.uavT = 25; audio.streak(); this.hud.toast('DRONE DE RECONNAISSANCE', 'Ennemis visibles sur la minicarte', 'streak'); }
      if (k.streak === 6) { P.overT = 15; audio.streak(); this.hud.toast('SURCHARGE', 'Cadence, vitesse et rechargement accrus', 'streak'); }
      if (k.streak >= 2 && k.streak !== 3 && k.streak !== 6) this.hud.toast(`SÉRIE DE ${k.streak}`);
    }
  }

  _localHurt(dmg, a) {
    const P = this.lp;
    P.shake = Math.min(1.2, P.shake + 0.25);
    P.hurtT = 0.3;
    audio.hurt();
    if (a) {
      const dx = a.rpos[0] - this.local.rpos[0], dz = a.rpos[2] - this.local.rpos[2];
      const ang = Math.atan2(-dx, -dz) - this.local.yaw;
      this.hud.damageFrom(-ang);
    }
  }

  /** Dégâts infligés par l'environnement au joueur local. */
  _localDamage(id, dmg, wid) {
    if (this.isHost) this.applyDamage(id, dmg, null, wid, false);
    else {
      this._envAcc = (this._envAcc || 0) + dmg;
      if (this._envAcc > 10) { this.net.send({ t: 'hit', v: id, d: Math.round(this._envAcc), h: false, w: wid }); this._envAcc = 0; }
    }
  }

  _updateDead(dt) {
    const P = this.lp;
    P.deathT = (P.deathT || 0) - dt;
    const k = P.killerId ? this.entities.get(P.killerId) : null;
    this.hud.showDeath(true, k ? k.name : 'Accident', this.hud.el.deathWeapon.textContent, P.deathT);
  }

  _end() {
    if (this.ended) return;
    const stats = this.entityList.map((e) => [e.id, e.kills, e.deaths, e.score]);
    const msg = { t: 'end', sc: this.teamScore, st: stats };
    if (this.online && this.isHost) this.net.broadcast(msg);
    this._onEnd(msg);
  }

  _onEnd(msg) {
    if (this.ended) return;
    this.ended = true;
    this.teamScore = msg.sc;
    for (const [id, k, d, s] of msg.st) { const e = this.entities.get(id); if (e) { e.kills = k; e.deaths = d; e.score = s; } }
    this.hud.center('FIN DU MATCH');
    setTimeout(() => this.ctx.onEnd && this.ctx.onEnd(this._results()), 2200);
  }

  _results() {
    const me = this.local;
    const ffa = this.cfg.mode === 'ffa';
    const sorted = [...this.entityList].sort((a, b) => b.score - a.score);
    const win = ffa ? sorted[0] === me : this.teamScore[me.team] > this.teamScore[1 - me.team];
    const draw = !ffa && this.teamScore[0] === this.teamScore[1];
    return {
      win, draw, ffa, map: this.map.name,
      teamScore: this.teamScore, myTeam: me.team,
      me: { kills: me.kills, deaths: me.deaths, score: me.score },
      table: sorted.map((e) => ({ name: e.name, team: e.team, isBot: e.isBot, isLocal: e.isLocal, kills: e.kills, deaths: e.deaths, score: e.score, ally: e.isLocal || this._isAllyOfLocal(e) })),
    };
  }

  // ─────────────────────────────────────────────── réseau

  _sendSnapshot() {
    const r = (v) => Math.round(v * 100) / 100;
    const ents = this.entityList.map((e) => {
      const f = (e.alive ? 1 : 0) | (e.crouch ? 2 : 0) | (e.air ? 4 : 0) | (e.ads ? 8 : 0) | (e.sprint ? 16 : 0);
      return [e.id, r(e.rpos[0]), r(e.rpos[1]), r(e.rpos[2]), r(e.yaw), r(e.pitch), f, Math.round(e.hp), e.kills, e.deaths, e.score, e.weapon.id];
    });
    this.net.broadcast({ t: 'snap', tl: Math.round(this.timeLeft), ph: this.phase, cd: +this.countdown.toFixed(1), sc: this.teamScore, e: ents });
  }

  _sendState() {
    const e = this.local;
    const r = (v) => Math.round(v * 100) / 100;
    const f = (e.alive ? 1 : 0) | (e.crouch ? 2 : 0) | (e.air ? 4 : 0) | (e.ads ? 8 : 0) | (e.sprint ? 16 : 0);
    this.net.send({ t: 'st', p: e.rpos.map(r), y: r(e.yaw), pi: r(e.pitch), f, w: e.weapon.id });
  }

  _pushSnap(e, p, yaw, pitch, f) {
    const now = performance.now() / 1000;
    const alive = !!(f & 1);
    if (alive && !e._wasAlive) e.snaps.length = 0;
    e._wasAlive = alive;
    e.snaps.push({ t: now, p, yaw, pitch, f });
    if (e.snaps.length > 30) e.snaps.shift();
  }

  _interpolate(e, now) {
    const buf = e.snaps;
    if (!buf.length) return;
    const rt = now - INTERP;
    while (buf.length >= 3 && buf[1].t <= rt) buf.shift();
    const a = buf[0], b = buf[1] || a;
    let k = b === a ? 1 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
    for (let i = 0; i < 3; i++) e.rpos[i] = lerp(a.p[i], b.p[i], k);
    e.yaw = a.yaw + wrapAngle(b.yaw - a.yaw) * k;
    e.pitch = lerp(a.pitch, b.pitch, k);
    const f = b.f;
    e.crouch = f & 2 ? 1 : 0; e.air = !!(f & 4); e.ads = !!(f & 8); e.sprint = !!(f & 16);
    e.height = e.crouch ? CROUCH_H : STAND_H;
  }

  /** Messages réseau reçus pendant la partie. */
  onMessage(from, msg) {
    if (this.isHost) {
      const e = this.entityList.find((x) => x.peer === from && !x.isBot);
      if (!e) return;
      switch (msg.t) {
        case 'ready': e.ready = true; if (!e.alive && !this.ended) this._spawn(e, this._pickSpawn(e)); break;
        case 'st': {
          if (!e.alive) return;
          this._pushSnap(e, msg.p, msg.y, msg.pi, msg.f | 1);
          if (msg.w && msg.w !== e.weapon.id) e.weapon = getWeapon(msg.w);
          break;
        }
        case 'hit': {
          const dmg = Math.min(Number(msg.d) || 0, 400);
          if (msg.w === 'lava') { if (msg.v === e.id) this.applyDamage(e.id, dmg, null, 'lava', false); break; }
          if (!e.alive && msg.w !== 'nade') break;
          this.applyDamage(msg.v, dmg, e.id, msg.w, !!msg.h);
          break;
        }
        case 'shot': this.net.broadcast(msg, from); this._remoteShot(msg); break;
        case 'nade': this.net.broadcast(msg, from); this._remoteNade(msg); break;
        default: break;
      }
      return;
    }
    // Client
    switch (msg.t) {
      case 'snap': {
        this.timeLeft = msg.tl;
        this.teamScore = msg.sc;
        if (msg.ph !== this.phase) {
          if (msg.ph === 'live') { this.hud.center(''); this.hud.toast('COMBATTEZ !', this.map.name, 'big'); }
          this.phase = msg.ph;
        }
        if (this.phase === 'countdown') this.hud.center(String(Math.ceil(msg.cd - 0.5) || 'PRÊT'), this.map.name);
        for (const [id, x, y, z, yaw, pitch, f, hp, k, d, s, wid] of msg.e) {
          const e = this.entities.get(id);
          if (!e) continue;
          e.kills = k; e.deaths = d; e.score = s;
          if (e.isLocal) { if (e.alive) e.hp = hp; continue; }
          e.hp = hp;
          const alive = !!(f & 1);
          if (!alive && e.alive) e.alive = false;
          if (alive && !e.alive) { e.alive = true; if (e.model) e.model.root.visible = true; }
          if (wid && wid !== e.weapon.id) e.weapon = getWeapon(wid);
          this._pushSnap(e, [x, y, z], yaw, pitch, f);
        }
        break;
      }
      case 'spawn': this._applySpawn(this.local, msg); break;
      case 'dmg': {
        this.local.hp = msg.hp;
        this._localHurt(msg.d, msg.f ? { rpos: msg.f } : null);
        break;
      }
      case 'hm': this.hud.hitmarker(msg.h, msg.k); break;
      case 'kill': {
        const v = this.entities.get(msg.v);
        if (v && v.isLocal) v.alive = false;
        this._onKill(msg);
        break;
      }
      case 'shot': this._remoteShot(msg); break;
      case 'nade': this._remoteNade(msg); break;
      case 'end': this._onEnd(msg); break;
      default: break;
    }
  }

  _remoteNade(msg) {
    const owner = this.entities.get(msg.id);
    if (!owner || owner.isLocal) return;
    const g = new Grenade(msg.id, owner.team, msg.p, msg.v);
    g.owned = false;
    this._addGrenadeMesh(g);
    this.grenades.push(g);
  }

  /** (Hôte) Un joueur a quitté : un bot prend sa place. */
  playerLeft(peerId) {
    const e = this.entityList.find((x) => x.peer === peerId && !x.isBot);
    if (!e) return;
    e.isBot = true; e.peer = null;
    e.name += ' (bot)';
    e.body = new Body(e.rpos[0], e.rpos[1], e.rpos[2]);
    e.rpos = e.body.pos;
    e.bot = new Bot(e, this, this.cfg.diff);
    this.hud.toast(`${e.name.replace(' (bot)', '')} a quitté la partie`, 'Remplacé par un bot');
  }

  // ─────────────────────────────────────────────── rendu

  _animateModels(dt) {
    // Les personnages hors du champ de vision ne sont pas animés (gros gain CPU).
    const cam = this.camera;
    cam.updateMatrixWorld();
    this._frustum = this._frustum || new THREE.Frustum();
    this._pv = this._pv || new THREE.Matrix4();
    this._pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._pv);
    const sphere = this._sphere || (this._sphere = new THREE.Sphere(new THREE.Vector3(), 1.4));
    for (const e of this.entityList) {
      if (!e.model) continue;
      const m = e.model;
      if (!e.alive) {
        if (e.deadAt == null) e.deadAt = this.time;
        if (this.time - e.deadAt > 2.5) { m.root.visible = false; continue; }
      } else e.deadAt = null;
      if (e.rpos[1] < -20) { m.root.visible = false; continue; }
      m.root.visible = true;
      m.root.position.set(e.rpos[0], e.rpos[1], e.rpos[2]);
      m.root.rotation.y = e.yaw;
      const dx = e.rpos[0] - e.prevPos[0], dz = e.rpos[2] - e.prevPos[2];
      const sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      e.speed = damp(e.speed, Math.min(sp, 12), 10, dt);
      if (sp > 0.3) e.moveYaw = wrapAngle(Math.atan2(-dx, -dz) - e.yaw);
      e.prevPos[0] = e.rpos[0]; e.prevPos[1] = e.rpos[1]; e.prevPos[2] = e.rpos[2];
      if (m.weapon.def !== e.weapon) m.setWeapon(e.weapon);
      if (!this._isAllyOfLocal(e)) m.showTag(e.alive && this.lp.aimTarget === e);
      sphere.center.set(e.rpos[0], e.rpos[1] + 0.9, e.rpos[2]);
      m.offscreenT = (m.offscreenT || 0) + dt;
      if (!this._frustum.intersectsSphere(sphere) && e.alive && m.offscreenT < 0.5) continue;
      m.animate(Math.min(m.offscreenT, 0.1), { speed: e.speed, moveYaw: e.moveYaw || 0, crouch: e.crouch, pitch: e.pitch, airborne: e.air, alive: e.alive });
      m.offscreenT = 0;
    }
  }

  _updateCamera(dt, inp) {
    const cam = this.camera, e = this.local, P = this.lp;
    P.shake = damp(P.shake, 0, 6, dt);
    const sh = P.shake * 0.012;
    if (e.alive) {
      // Ressort d'atterrissage
      P.dipV += (-P.dip * 60 - P.dipV * 10) * dt;
      P.dip += P.dipV * dt;
      cam.position.set(e.rpos[0], e.rpos[1] + e.body.eyeHeight + P.dip, e.rpos[2]);
      cam.rotation.y = e.yaw + P.recoilY + (Math.random() - 0.5) * sh;
      cam.rotation.x = e.pitch + P.recoilP + (Math.random() - 0.5) * sh;
      cam.rotation.z = e.body.sliding > 0 ? 0.05 : 0;
      const w = P.weapons[P.wi].def;
      const base = this.settings.fov * DEG;
      const adsFov = 2 * Math.atan(Math.tan(base / 2) / w.zoom);
      let fov = lerp(base, adsFov, P.ads) / DEG;
      if (e.sprint) fov += 5;
      if (e.body.sliding > 0) fov += 8;
      cam.fov = damp(cam.fov, fov, 14, dt);
      const scoped = (w.scope === 'sniper' || w.scope === 'scope') && P.ads > 0.92;
      this.scoped = scoped;
      this.vm.update({
        dt, ads: P.ads, moving: clamp(e.speed / 6, 0, 1), sprint: e.sprint, airborne: e.air, lookDX: this._lookDX || 0, lookDY: this._lookDY || 0,
        reloading: P.reloadT > 0 ? 1 - P.reloadT / P.reloadDur : -1, swapping: P.swapT > 0.2, crouch: e.crouch, hidden: scoped,
      });
      if (scoped) {
        const t = this.time;
        cam.rotation.y += Math.sin(t * 1.3) * 0.0012;
        cam.rotation.x += Math.sin(t * 1.7) * 0.0010;
      }
    } else {
      // Caméra de mort : au-dessus du corps, tournée vers le tueur
      this.scoped = false;
      const d = P.deathPos || e.rpos;
      const k = P.killerId ? this.entities.get(P.killerId) : null;
      const target = new THREE.Vector3(...(k ? k.rpos : d)).add(new THREE.Vector3(0, 1.2, 0));
      const pos = new THREE.Vector3(d[0], d[1] + 3.2, d[2]);
      const away = new THREE.Vector3(d[0], 0, d[2]).sub(new THREE.Vector3(target.x, 0, target.z));
      if (away.lengthSq() > 0.01) pos.add(away.normalize().multiplyScalar(2.5));
      cam.position.lerp(pos, 1 - Math.exp(-4 * dt));
      const m = new THREE.Matrix4().lookAt(cam.position, target, new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      cam.quaternion.slerp(q, 1 - Math.exp(-5 * dt));
      cam.fov = damp(cam.fov, this.settings.fov, 6, dt);
      this.vm.update({ dt, ads: 0, moving: 0, sprint: false, airborne: false, lookDX: 0, lookDY: 0, reloading: -1, swapping: true, crouch: 0, hidden: true });
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.vm.camera.aspect = cam.aspect;
    this.vm.camera.updateProjectionMatrix();
  }

  _updateHud(dt) {
    const e = this.local, P = this.lp;
    this.hurtFx = e.alive ? clamp((1 - e.hp / 100) * 1.1 - 0.25, 0, 1) + (P.hurtT > 0 ? 0.35 : 0) : 0.4;
    const W = P.weapons[P.wi];
    const my = e.team;
    let scoreA, scoreB;
    if (this.cfg.mode === 'ffa') {
      scoreA = e.kills;
      scoreB = Math.max(0, ...this.entityList.filter((o) => o !== e).map((o) => o.kills));
    } else { scoreA = this.teamScore[my]; scoreB = this.teamScore[1 - my]; }
    const w = W.def;
    const spreadDeg = lerp(w.spread[0], w.spread[1], P.ads) + P.bloom + (e.speed > 1.5 ? 0.8 : 0) + (e.air ? 2 : 0);
    const spreadPx = Math.tan(spreadDeg * DEG) / Math.tan((this.camera.fov * DEG) / 2) * innerHeight / 2;
    this.hud.update(dt, {
      scoreA, scoreB, timeLeft: this.timeLeft,
      weaponName: w.name, mag: W.mag, reserve: W.reserve, magSize: w.mag, reloading: P.reloadT > 0,
      nades: e.nades, ability: P.ability, hp: e.hp, spreadPx: Math.min(spreadPx, 90), ads: P.ads, sprint: e.sprint,
      overEnemy: !!P.aimTarget, streak: e.streak, scoped: this.scoped && e.alive,
    });
    // Marqueurs d'Impulsion
    if (P.pulseT > 0 && e.alive) {
      const list = this.entityList.filter((o) => o.alive && this.isEnemy(e, o) && dist3(o.rpos, e.rpos) < 50)
        .map((o) => [o.rpos[0], o.rpos[1] + o.height + 0.25, o.rpos[2]]);
      this.hud.markers(list, this.camera);
    } else this.hud.markers([], this.camera);
    // Minicarte (≈ 20 Hz)
    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.05;
      const others = [];
      for (const o of this.entityList) {
        if (o === e || !o.alive) continue;
        if (!this.isEnemy(e, o)) others.push({ p: o.rpos, yaw: o.yaw, color: ALLY, enemy: false });
        else if (P.uavT > 0 || P.pulseT > 0 || this.time - o.lastShotTime < 1.6) others.push({ p: o.rpos, color: FOE, enemy: true });
      }
      const center = e.alive ? e.rpos : (P.deathPos || e.rpos);
      this.hud.minimap(this.world, center, e.yaw, others, this.time);
    }
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  dispose() {
    audio.stopAmbience();
    for (const e of this.entityList) if (e.model) { this.scene.remove(e.model.root); e.model.dispose(); }
    this.world.dispose();
    this.envTex?.dispose();
    this.hud.markers([], this.camera);
  }
}

const NO_INPUT = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, ads: false, sprint: false, jump: false, crouchPressed: false, crouchWanted: false, reload: false, swap: false, slot: -1, nade: false, ability: false };
const IDLE_CTL = { wish: { x: 0, z: 0 }, speed: 0, jumpPressed: false, crouchPressed: false, crouchWanted: false, sprinting: false };
