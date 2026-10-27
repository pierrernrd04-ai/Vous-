// Sons synthétisés en temps réel (Web Audio) et spatialisés en 3D.

const SHOT = {
  ar: { lp: 3200, thump: 95, len: 0.22, vol: 0.55, crack: 0.25 },
  smg: { lp: 4200, thump: 120, len: 0.14, vol: 0.45, crack: 0.15 },
  shotgun: { lp: 1800, thump: 70, len: 0.45, vol: 0.85, crack: 0.1 },
  sniper: { lp: 2600, thump: 60, len: 0.9, vol: 0.95, crack: 0.6 },
  lmg: { lp: 2800, thump: 85, len: 0.25, vol: 0.6, crack: 0.25 },
  pistol: { lp: 3800, thump: 130, len: 0.16, vol: 0.45, crack: 0.2 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.ambient = null;
  }

  /** À appeler depuis un geste utilisateur (exigence des navigateurs). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  setListener(pos, yaw) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(pos[0], t); L.positionY.setValueAtTime(pos[1], t); L.positionZ.setValueAtTime(pos[2], t);
      L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(0, t); L.forwardZ.setValueAtTime(fz, t);
      L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
    } else {
      L.setPosition(pos[0], pos[1], pos[2]);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  _out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 4; p.rolloffFactor = 1.1; p.maxDistance = 200;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
    else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(this.master);
    return p;
  }

  _noise(out, { t0 = 0, dur, vol, type = 'lowpass', freq, q = 0.7, attack = 0.002, sweep }) {
    const c = this.ctx, t = c.currentTime + t0;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  _tone(out, { t0 = 0, dur, vol, freq, to, type = 'sine' }) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shot(cls, pos = null) {
    if (!this.ctx) return;
    const s = SHOT[cls] || SHOT.ar;
    const out = this._out(pos);
    const v = s.vol * (pos ? 1.6 : 1);
    this._noise(out, { dur: s.len, vol: v, freq: s.lp, sweep: 300, q: 0.5 });
    this._noise(out, { dur: 0.05, vol: v * s.crack * 2, type: 'highpass', freq: 2500 });
    this._tone(out, { dur: s.len * 0.8, vol: v * 0.9, freq: s.thump * 1.6, to: s.thump * 0.5 });
    if (cls === 'sniper') this._noise(out, { t0: 0.08, dur: 1.2, vol: v * 0.25, freq: 900, sweep: 120 });
  }

  empty() { if (!this.ctx) return; this._noise(this.master, { dur: 0.04, vol: 0.25, type: 'bandpass', freq: 2200, q: 4 }); }

  reload(dur) {
    if (!this.ctx) return;
    const o = this.master;
    this._noise(o, { t0: 0.1, dur: 0.06, vol: 0.3, type: 'bandpass', freq: 1500, q: 3 });
    this._noise(o, { t0: dur * 0.45, dur: 0.07, vol: 0.35, type: 'bandpass', freq: 1100, q: 3 });
    this._noise(o, { t0: dur * 0.8, dur: 0.05, vol: 0.4, type: 'bandpass', freq: 2600, q: 5 });
  }

  pump() {
    if (!this.ctx) return;
    this._noise(this.master, { t0: 0.18, dur: 0.08, vol: 0.35, type: 'bandpass', freq: 900, q: 2 });
    this._noise(this.master, { t0: 0.32, dur: 0.07, vol: 0.35, type: 'bandpass', freq: 1300, q: 2 });
  }

  hit(head) {
    if (!this.ctx) return;
    this._tone(this.master, { dur: 0.05, vol: 0.18, freq: head ? 2400 : 1700, type: 'square' });
    if (head) this._tone(this.master, { t0: 0.04, dur: 0.18, vol: 0.12, freq: 3200 });
  }

  kill() {
    if (!this.ctx) return;
    this._tone(this.master, { dur: 0.12, vol: 0.18, freq: 880, type: 'triangle' });
    this._tone(this.master, { t0: 0.08, dur: 0.25, vol: 0.18, freq: 1320, type: 'triangle' });
  }

  hurt() {
    if (!this.ctx) return;
    this._noise(this.master, { dur: 0.18, vol: 0.5, freq: 400, sweep: 120 });
    this._tone(this.master, { dur: 0.15, vol: 0.3, freq: 160, to: 60 });
  }

  step(pos) {
    if (!this.ctx) return;
    this._noise(this._out(pos), { dur: 0.07, vol: pos ? 0.25 : 0.08, freq: 600, q: 1 });
  }

  boost(pos) {
    if (!this.ctx) return;
    this._noise(this._out(pos), { dur: 0.45, vol: 0.4, type: 'bandpass', freq: 400, sweep: 2400, q: 1.5, attack: 0.03 });
  }

  slide() { if (this.ctx) this._noise(this.master, { dur: 0.6, vol: 0.2, freq: 1200, sweep: 300, attack: 0.02 }); }

  explosion(pos) {
    if (!this.ctx) return;
    const out = this._out(pos);
    this._noise(out, { dur: 1.4, vol: 1.2, freq: 1400, sweep: 60, q: 0.4 });
    this._tone(out, { dur: 0.9, vol: 1, freq: 90, to: 28 });
  }

  bounce(pos) { if (this.ctx) this._noise(this._out(pos), { dur: 0.05, vol: 0.3, type: 'bandpass', freq: 1800, q: 4 }); }

  ui(kind = 'click') {
    if (!this.ctx) return;
    if (kind === 'hover') this._tone(this.master, { dur: 0.04, vol: 0.04, freq: 1800 });
    else this._tone(this.master, { dur: 0.08, vol: 0.1, freq: 900, to: 1400, type: 'triangle' });
  }

  streak() {
    if (!this.ctx) return;
    [660, 880, 1100].forEach((f, i) => this._tone(this.master, { t0: i * 0.09, dur: 0.22, vol: 0.14, freq: f, type: 'triangle' }));
  }

  ambience(kind) {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const cfg = { wind: ['lowpass', 500, 0.06], rain: ['highpass', 1800, 0.07], city: ['lowpass', 260, 0.08], factory: ['lowpass', 180, 0.12] }[kind] || ['lowpass', 400, 0.05];
    f.type = cfg[0]; f.frequency.value = cfg[1];
    g.gain.value = cfg[2];
    src.connect(f).connect(g).connect(this.master);
    src.start();
    const nodes = [src];
    if (kind === 'factory' || kind === 'city') {
      const o = c.createOscillator(); o.frequency.value = kind === 'factory' ? 55 : 48;
      const og = c.createGain(); og.gain.value = 0.03;
      o.connect(og).connect(this.master); o.start(); nodes.push(o);
    }
    this.ambient = nodes;
  }

  stopAmbience() {
    if (this.ambient) for (const n of this.ambient) try { n.stop(); } catch { /* déjà arrêté */ }
    this.ambient = null;
  }
}

export const audio = new AudioEngine();
