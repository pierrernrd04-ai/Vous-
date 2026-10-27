// Entrées unifiées : clavier/souris (verrouillage du pointeur), tactile
// (joystick flottant + boutons), manette standard.
import { isTouchDevice } from './util.js';

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
  KeyC: 'crouch', ControlLeft: 'crouchHold', KeyR: 'reload', KeyG: 'nade', KeyE: 'ability',
  Digit1: 'w1', Digit2: 'w2', KeyF: 'swap', Tab: 'score', Escape: 'pause', KeyP: 'pause',
};

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.touch = isTouchDevice();
    this.keys = new Set();
    this.edges = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0 };
    this.locked = false;
    this.enabled = false;
    this.crouchToggle = false;
    this.adsToggle = false;
    this.t = { joyId: null, joyX: 0, joyY: 0, joyOrigin: [0, 0], lookIds: new Map(), lookDX: 0, lookDY: 0, fire: 0, sprintLock: false };
    this.pad = { prev: [] };
    this.onPause = null;
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = KEYMAP[e.code];
      if (!k) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(k)) this.edges.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) this.keys.delete(k); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.touch) return;
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === c;
      if (was && !this.locked && this.enabled && this.onPause) this.onPause();
    });

    this._bindTouch();
  }

  requestLock() {
    if (this.touch) return;
    const retry = () => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch { /* refusé */ } };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(retry);
    } catch { retry(); }
  }

  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  _bindTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    this.touchRoot = root;
    const base = document.getElementById('joyBase');
    const knob = document.getElementById('joyKnob');
    const R = 60;
    const t = this.t;

    const btnOf = (el) => el && el.closest && el.closest('[data-act]');

    root.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const tc of e.changedTouches) {
        const btn = btnOf(document.elementFromPoint(tc.clientX, tc.clientY));
        if (btn) {
          const act = btn.dataset.act;
          btn.classList.add('on');
          if (act === 'fire' || act === 'fire2') {
            t.fire++;
            t.lookIds.set(tc.identifier, { x: tc.clientX, y: tc.clientY, btn, act });
          } else {
            this._touchAction(act);
            t.lookIds.set(tc.identifier, { x: tc.clientX, y: tc.clientY, btn, act, nolook: act !== 'ads' });
          }
          continue;
        }
        if (tc.clientX < innerWidth * 0.42 && t.joyId === null) {
          t.joyId = tc.identifier;
          t.joyOrigin = [tc.clientX, tc.clientY];
          base.style.transform = `translate(${tc.clientX - 70}px, ${tc.clientY - 70}px)`;
          base.classList.add('active');
          knob.style.transform = 'translate(0px, 0px)';
        } else {
          t.lookIds.set(tc.identifier, { x: tc.clientX, y: tc.clientY });
        }
      }
    }, { passive: false });

    root.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const tc of e.changedTouches) {
        if (tc.identifier === t.joyId) {
          let dx = tc.clientX - t.joyOrigin[0], dy = tc.clientY - t.joyOrigin[1];
          const L = Math.hypot(dx, dy);
          // Sprint automatique : joystick poussé franchement vers l'avant
          t.sprintLock = dy < -R * 1.05 && Math.abs(dx) < Math.abs(dy) * 0.6;
          if (L > R) { dx = dx / L * R; dy = dy / L * R; }
          t.joyX = dx / R; t.joyY = -dy / R;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          base.classList.toggle('sprint', t.sprintLock);
          continue;
        }
        const lk = t.lookIds.get(tc.identifier);
        if (lk && !lk.nolook) {
          t.lookDX += tc.clientX - lk.x;
          t.lookDY += tc.clientY - lk.y;
          lk.x = tc.clientX; lk.y = tc.clientY;
        }
      }
    }, { passive: false });

    const end = (e) => {
      for (const tc of e.changedTouches) {
        if (tc.identifier === t.joyId) {
          t.joyId = null; t.joyX = t.joyY = 0; t.sprintLock = false;
          base.classList.remove('active', 'sprint');
          knob.style.transform = 'translate(0px, 0px)';
          continue;
        }
        const lk = t.lookIds.get(tc.identifier);
        if (lk) {
          if (lk.btn) lk.btn.classList.remove('on');
          if (lk.act === 'fire' || lk.act === 'fire2') t.fire = Math.max(0, t.fire - 1);
          t.lookIds.delete(tc.identifier);
        }
      }
    };
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
  }

  _touchAction(act) {
    switch (act) {
      case 'ads': this.adsToggle = !this.adsToggle; break;
      case 'crouch': this.edges.add('crouch'); break;
      case 'jump': this.edges.add('jump'); break;
      case 'reload': this.edges.add('reload'); break;
      case 'swap': this.edges.add('swap'); break;
      case 'nade': this.edges.add('nade'); break;
      case 'ability': this.edges.add('ability'); break;
      case 'score': this.edges.add('score'); break;
      case 'pause': this.onPause && this.onPause(); break;
      default: break;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.keys.clear(); this.edges.clear();
      this.mouse.left = this.mouse.right = false;
      this.t.fire = 0; this.t.lookIds.clear(); this.t.joyId = null; this.t.joyX = this.t.joyY = 0;
      this.adsToggle = false; this.crouchToggle = false;
    }
    if (this.touchRoot) this.touchRoot.hidden = !(on && this.touch);
  }

  /** Lecture des entrées pour cette image ; remet à zéro les fronts et deltas. */
  frame(dt) {
    const s = this.settings;
    const k = this.keys, e = this.edges;
    const out = {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      fire: false, ads: false, sprint: false,
      jump: e.has('jump'), crouchPressed: e.has('crouch') || e.has('crouchHold'),
      reload: e.has('reload'), swap: e.has('swap') || e.has('w1') || e.has('w2'), slot: e.has('w1') ? 0 : e.has('w2') ? 1 : -1,
      nade: e.has('nade'), ability: e.has('ability'), score: k.has('score') || e.has('score'), pause: e.has('pause'),
    };
    if (e.has('crouch')) this.crouchToggle = !this.crouchToggle;

    // Clavier / souris
    out.moveY = (k.has('fwd') ? 1 : 0) - (k.has('back') ? 1 : 0);
    out.moveX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    out.sprint = k.has('sprint');
    const inv = s.invertY ? -1 : 1;
    const ms = 0.0022 * s.sens;
    out.lookX -= this.mouse.dx * ms;
    out.lookY -= this.mouse.dy * ms * inv;
    out.fire = this.mouse.left;
    out.ads = this.mouse.right;
    if (this.mouse.wheel) { out.swap = true; this.mouse.wheel = 0; }
    this.mouse.dx = this.mouse.dy = 0;

    // Tactile
    const t = this.t;
    if (this.touch) {
      if (t.joyId !== null) { out.moveX = t.joyX; out.moveY = t.joyY; }
      if (t.sprintLock) out.sprint = true;
      const ts = 0.0052 * s.sens;
      out.lookX -= t.lookDX * ts;
      out.lookY -= t.lookDY * ts * inv;
      t.lookDX = t.lookDY = 0;
      if (t.fire > 0) out.fire = true;
      if (this.adsToggle) out.ads = true;
    }

    // Manette
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      const b = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4);
      const prev = this.pad.prev;
      const edge = (i) => b(i) && !prev[i];
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly) { out.moveX = lx; out.moveY = -ly; }
      const gs = 3.0 * s.sens * dt;
      out.lookX -= Math.sign(rx) * rx * rx * gs;
      out.lookY -= Math.sign(ry) * ry * ry * gs * inv;
      if (b(7)) out.fire = true;
      if (b(6)) out.ads = true;
      if (b(10)) out.sprint = true;
      if (edge(0)) out.jump = true;
      if (edge(1)) { out.crouchPressed = true; this.crouchToggle = !this.crouchToggle; }
      if (edge(2)) out.reload = true;
      if (edge(3)) out.swap = true;
      if (edge(4)) out.nade = true;
      if (edge(5)) out.ability = true;
      if (b(8)) out.score = true;
      if (edge(9)) out.pause = true;
      this.pad.prev = gp.buttons.map((_, i) => b(i));
      this.gamepad = true;
    }

    out.crouchWanted = this.crouchToggle || k.has('crouchHold');
    // Normalisation du déplacement
    const ml = Math.hypot(out.moveX, out.moveY);
    if (ml > 1) { out.moveX /= ml; out.moveY /= ml; }
    if (out.moveY < 0.3) out.sprint = out.sprint && out.moveY > 0.3;
    e.clear();
    return out;
  }

  /** Annule l'accroupi mémorisé (après un saut ou une glissade). */
  clearCrouch() { this.crouchToggle = false; }
}
