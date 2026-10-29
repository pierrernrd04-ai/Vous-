// Dictée vocale avec l’API Web Speech du navigateur (Chrome, Edge, Safari).
// La reconnaissance s’arrête d’elle-même après un silence : on la relance
// tant que l’utilisateur n’a pas appuyé sur « terminer ».

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export function isSpeechSupported() {
  return Boolean(Recognition);
}

export function isMobile() {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Fusionne les résultats définitifs d’une session. Chrome sur Android renvoie
 * parfois des résultats cumulés (chacun reprend le précédent) : on remplace
 * au lieu d’ajouter pour éviter les doublons.
 */
export function mergeResults(parts) {
  let acc = '';
  for (const raw of parts) {
    const part = String(raw || '').trim();
    if (!part) continue;
    const a = norm(acc);
    const p = norm(part);
    if (!a) acc = part;
    else if (p.startsWith(a)) acc = part;
    else if (a.endsWith(p)) continue;
    else acc = `${acc} ${part}`;
  }
  return acc.replace(/\s+/g, ' ').trim();
}

export function joinText(...parts) {
  return parts.map((p) => (p || '').trim()).filter(Boolean).join(' ');
}

const FATAL = {
  'not-allowed': 'Micro refusé. Autorise le micro pour ce site dans les réglages du navigateur.',
  'service-not-allowed': 'La dictée est désactivée. Sur iPhone : Réglages › Général › Clavier › Dictée.',
  'audio-capture': 'Aucun micro détecté.',
  network: 'La dictée a besoin d’une connexion internet sur ce navigateur.',
  'language-not-supported': 'Le français n’est pas disponible pour la dictée sur ce navigateur.',
};

export class Dictation {
  /**
   * @param {{ lang?: string, onText?: (finalText: string, interim: string) => void,
   *   onActivity?: () => void, onError?: (message: string) => void }} handlers
   */
  constructor({ lang = 'fr-FR', onText, onActivity, onError } = {}) {
    this.lang = lang;
    this.onText = onText || (() => {});
    this.onActivity = onActivity || (() => {});
    this.onError = onError || (() => {});
    this.active = false;
    this.rec = null;
    this.committed = '';
    this.sessionFinal = '';
    this.interim = '';
    this.fatal = null;
    this.endWaiters = [];
    this.restarts = 0;
  }

  get text() {
    return joinText(this.committed, this.sessionFinal, this.interim);
  }

  start() {
    if (!Recognition) throw new Error('unsupported');
    this.active = true;
    this.committed = '';
    this.sessionFinal = '';
    this.interim = '';
    this.fatal = null;
    this.restarts = 0;
    this.spawn();
  }

  spawn() {
    const rec = new Recognition();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const finals = [];
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finals.push(result[0].transcript);
        else interim += result[0].transcript;
      }
      this.sessionFinal = mergeResults(finals);
      this.interim = interim.trim();
      this.onActivity();
      this.onText(joinText(this.committed, this.sessionFinal), this.interim);
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (FATAL[event.error]) {
        this.fatal = event.error;
        this.active = false;
        this.onError(FATAL[event.error]);
      }
    };

    rec.onend = () => {
      // Ce que la session a entendu est acquis, même s’il restait du provisoire.
      this.committed = joinText(this.committed, this.sessionFinal, this.interim);
      this.sessionFinal = '';
      this.interim = '';
      if (this.rec === rec) this.rec = null;
      if (this.active && !this.fatal && this.restarts < 500) {
        this.restarts += 1;
        setTimeout(() => this.active && this.spawn(), 150);
        return;
      }
      const waiters = this.endWaiters.splice(0);
      waiters.forEach((resolve) => resolve(this.committed));
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // Déjà démarrée (double appel) : la session en cours suffit.
    }
  }

  /** Arrête l’écoute et renvoie tout le texte entendu. */
  stop() {
    this.active = false;
    const rec = this.rec;
    if (!rec) return Promise.resolve(this.text);
    return new Promise((resolve) => {
      let done = false;
      const finish = (text) => {
        if (done) return;
        done = true;
        resolve(text);
      };
      this.endWaiters.push(finish);
      // Certains navigateurs ne déclenchent jamais `end` : on n’attend pas plus de 1,5 s.
      setTimeout(() => finish(this.text), 1500);
      try {
        rec.stop();
      } catch {
        finish(this.text);
      }
    });
  }

  cancel() {
    this.active = false;
    this.endWaiters.splice(0);
    try {
      this.rec?.abort();
    } catch {
      /* rien à annuler */
    }
    this.rec = null;
  }
}

/**
 * Niveau sonore du micro (0 à 1) pour animer l’orbe. Sur mobile, on évite
 * d’ouvrir le micro une seconde fois pendant la dictée : l’animation suit
 * alors l’arrivée des mots.
 */
export async function startLevelMeter(onLevel) {
  if (isMobile() || !navigator.mediaDevices?.getUserMedia) return () => {};
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return () => {};
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
}
