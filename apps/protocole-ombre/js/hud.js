// Interface en jeu (DOM superposé au canvas).
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class HUD {
  constructor() {
    this.root = $('hud');
    this.el = {};
    for (const id of ['scoreA', 'scoreB', 'timer', 'modeLabel', 'killfeed', 'crosshair', 'hitmarker', 'dmgVignette', 'dmgArrows',
      'weaponName', 'ammoMag', 'ammoRes', 'nades', 'abilityFill', 'abilityBtnFill', 'hpFill', 'hpText', 'toasts', 'center', 'popups', 'scoreboard',
      'death', 'deathKiller', 'deathWeapon', 'deathTimer', 'scope', 'markers', 'minimap', 'streakPips', 'lowAmmo', 'reloadHint', 'teamA', 'teamB']) this.el[id] = $(id);
    this.mm = this.el.minimap.getContext('2d');
    this.hitT = 0;
    this.feed = [];
    this.markerPool = [];
    this.v = new THREE.Vector3();
  }

  show(on) { this.root.hidden = !on; }

  setup(match) {
    this.match = match;
    const ffa = match.cfg.mode === 'ffa';
    this.el.modeLabel.textContent = ffa ? `MÊLÉE GÉNÉRALE · ${match.cfg.scoreLimit}` : `MATCH À MORT PAR ÉQUIPE · ${match.cfg.scoreLimit}`;
    this.el.teamA.textContent = ffa ? 'TOI' : 'ALLIÉS';
    this.el.teamB.textContent = ffa ? 'MEILLEUR' : 'ENNEMIS';
    this.el.killfeed.innerHTML = '';
    this.el.toasts.innerHTML = '';
    this.el.popups.innerHTML = '';
    this.feed = [];
    this.showDeath(false);
    this.showScoreboard(false);
    this.el.scope.hidden = true;
  }

  update(dt, s) {
    const e = this.el;
    e.scoreA.textContent = s.scoreA;
    e.scoreB.textContent = s.scoreB;
    const t = Math.max(0, Math.ceil(s.timeLeft));
    e.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    e.timer.classList.toggle('warn', t <= 30);
    e.weaponName.textContent = s.weaponName;
    e.ammoMag.textContent = s.mag;
    e.ammoRes.textContent = s.reserve;
    e.ammoMag.classList.toggle('low', s.mag <= Math.ceil(s.magSize * 0.25));
    e.lowAmmo.hidden = !(s.mag === 0 && !s.reloading);
    e.reloadHint.hidden = !s.reloading;
    e.nades.textContent = '◆'.repeat(s.nades) + '◇'.repeat(Math.max(0, 2 - s.nades));
    e.abilityFill.style.transform = `scaleX(${s.ability})`;
    if (e.abilityBtnFill) e.abilityBtnFill.style.transform = `scaleY(${s.ability})`;
    document.body.classList.toggle('ability-ready', s.ability >= 1);
    e.hpFill.style.transform = `scaleX(${Math.max(0, s.hp) / 100})`;
    e.hpText.textContent = Math.max(0, Math.ceil(s.hp));
    e.hpFill.classList.toggle('crit', s.hp < 35);
    e.dmgVignette.style.opacity = Math.max(0, Math.min(1, (1 - s.hp / 100) * 1.25 - 0.15));

    // Réticule dynamique
    const gap = 6 + s.spreadPx;
    e.crosshair.style.setProperty('--gap', `${gap}px`);
    e.crosshair.style.opacity = s.ads > 0.6 || s.sprint ? 0 : 1;
    e.crosshair.classList.toggle('enemy', s.overEnemy);

    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) e.hitmarker.className = ''; }

    // Séries
    e.streakPips.innerHTML = [3, 6].map((n) => `<span class="${s.streak >= n ? 'on' : ''}">${n}</span>`).join('');

    e.scope.hidden = !s.scoped;
  }

  hitmarker(head, kill) {
    const h = this.el.hitmarker;
    h.className = '';
    void h.offsetWidth;
    h.className = `show ${head ? 'head' : ''} ${kill ? 'kill' : ''}`;
    this.hitT = kill ? 0.35 : 0.18;
  }

  killfeed(killer, victim, weapon, head, kColor, vColor) {
    const div = document.createElement('div');
    div.className = 'kf';
    div.innerHTML = `<b style="color:${kColor}">${esc(killer)}</b><span class="kw">${esc(weapon)}${head ? ' <i class="hs">✛</i>' : ''}</span><b style="color:${vColor}">${esc(victim)}</b>`;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => div.classList.add('out'), 5000);
    setTimeout(() => div.remove(), 5600);
  }

  damageFrom(angle) {
    const a = document.createElement('div');
    a.className = 'darrow';
    a.style.transform = `rotate(${angle}rad)`;
    this.el.dmgArrows.appendChild(a);
    setTimeout(() => a.remove(), 1100);
  }

  popup(text, cls = '') {
    const p = document.createElement('div');
    p.className = `pop ${cls}`;
    p.textContent = text;
    this.el.popups.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }

  toast(title, sub = '', cls = '') {
    const t = document.createElement('div');
    t.className = `toast ${cls}`;
    t.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  center(text, sub = '') {
    const c = this.el.center;
    if (!text) { c.hidden = true; return; }
    c.hidden = false;
    c.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  }

  showDeath(on, killer = '', weapon = '', t = 0) {
    this.el.death.hidden = !on;
    if (!on) return;
    this.el.deathKiller.textContent = killer;
    this.el.deathWeapon.textContent = weapon;
    this.el.deathTimer.textContent = t > 0 ? `Redéploiement dans ${Math.ceil(t)}` : 'Redéploiement…';
  }

  showScoreboard(on, match = null) {
    const sb = this.el.scoreboard;
    sb.hidden = !on;
    if (!on || !match) return;
    const rows = (list) => list.map((e) => `<tr class="${e.isLocal ? 'me' : ''}"><td>${esc(e.name)}${e.isBot ? ' <small>BOT</small>' : ''}</td><td>${e.score}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${e.ping ?? ''}</td></tr>`).join('');
    const head = '<tr><th>Joueur</th><th>Score</th><th>É</th><th>M</th><th></th></tr>';
    const sorted = [...match.entityList].sort((a, b) => b.score - a.score);
    if (match.cfg.mode === 'ffa') {
      sb.innerHTML = `<h3>MÊLÉE GÉNÉRALE</h3><table>${head}${rows(sorted)}</table>`;
    } else {
      const my = match.local.team;
      const a = sorted.filter((e) => e.team === my), b = sorted.filter((e) => e.team !== my);
      sb.innerHTML = `<div class="sbcols"><div><h3 class="ally">ALLIÉS · ${match.teamScore[my]}</h3><table>${head}${rows(a)}</table></div>` +
        `<div><h3 class="foe">ENNEMIS · ${match.teamScore[1 - my]}</h3><table>${head}${rows(b)}</table></div></div>`;
    }
  }

  /** Marqueurs à travers les murs (Impulsion) ; positions monde → écran. */
  markers(list, camera) {
    const pool = this.markerPool;
    while (pool.length < list.length) {
      const d = document.createElement('div');
      d.className = 'marker';
      this.el.markers.appendChild(d);
      pool.push(d);
    }
    const W = innerWidth, H = innerHeight;
    pool.forEach((d, i) => {
      const p = list[i];
      if (!p) { d.style.display = 'none'; return; }
      this.v.set(p[0], p[1], p[2]).project(camera);
      if (this.v.z > 1) { d.style.display = 'none'; return; }
      d.style.display = 'block';
      d.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W}px, ${(-this.v.y * 0.5 + 0.5) * H}px)`;
    });
  }

  minimap(world, me, yaw, others, time) {
    const g = this.mm, c = this.el.minimap;
    const S = c.width;
    const mm = world.minimap;
    const zoom = 2.2;        // grossissement de la carte
    const sc = mm.scale * zoom * (S / mm.size);
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(8,10,14,.75)'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate(yaw);
    g.translate(-me[0] * sc, -me[2] * sc);
    g.globalAlpha = 0.9;
    g.drawImage(mm.canvas, -mm.size / 2 * zoom * (S / mm.size), -mm.size / 2 * zoom * (S / mm.size), mm.size * zoom * (S / mm.size), mm.size * zoom * (S / mm.size));
    g.globalAlpha = 1;
    for (const o of others) {
      g.fillStyle = o.color;
      g.beginPath();
      if (o.enemy) { g.arc(o.p[0] * sc, o.p[2] * sc, 3.2, 0, Math.PI * 2); }
      else {
        g.save(); g.translate(o.p[0] * sc, o.p[2] * sc); g.rotate(-o.yaw);
        g.moveTo(0, -4); g.lineTo(3, 3); g.lineTo(-3, 3); g.closePath(); g.restore();
      }
      g.fill();
    }
    g.restore();
    // Joueur au centre + cône de vision
    g.save();
    g.translate(S / 2, S / 2);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.35);
    grd.addColorStop(0, 'rgba(255,255,255,.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S * 0.35, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
    g.fillStyle = '#ffcc33';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 4.5); g.lineTo(0, 2); g.lineTo(-4.5, 4.5); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); g.stroke();
  }
}
