// Multijoueur pair-à-pair (WebRTC via PeerJS, chargé en script global).
// Topologie en étoile : l'hôte relaie tout. Le serveur de signalisation
// public PeerJS sert uniquement à mettre les navigateurs en relation.

const PREFIX = 'protocole-ombre-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const makeRoomCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export class Net {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.conns = new Map(); // peerId -> DataConnection
    this.host = null;       // connexion vers l'hôte (client)
    this.handlers = {};
    this.code = null;
  }

  get available() { return typeof window.Peer === 'function'; }
  get id() { return this.peer ? this.peer.id : 'local'; }

  /** Crée un salon ; résout avec le code. */
  createRoom(handlers, attempt = 0) {
    this.handlers = handlers;
    this.isHost = true;
    const code = makeRoomCode();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(PREFIX + code, { debug: 0 });
      const fail = setTimeout(() => { peer.destroy(); reject(new Error('Délai dépassé : serveur de mise en relation injoignable.')); }, 12000);
      peer.on('open', () => {
        clearTimeout(fail);
        this.peer = peer; this.code = code;
        resolve(code);
      });
      peer.on('connection', (conn) => this._accept(conn));
      peer.on('error', (err) => {
        clearTimeout(fail);
        if (err.type === 'unavailable-id' && attempt < 3) { peer.destroy(); this.createRoom(handlers, attempt + 1).then(resolve, reject); return; }
        if (!this.peer) reject(new Error(describe(err)));
        else this.handlers.onError?.(describe(err));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignoré */ } });
    });
  }

  _accept(conn) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      this.handlers.onJoin?.(conn.peer);
    });
    conn.on('data', (msg) => this.handlers.onData?.(conn.peer, msg));
    const gone = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      this.handlers.onLeave?.(conn.peer);
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  /** Rejoint un salon par son code. */
  joinRoom(code, handlers) {
    this.handlers = handlers;
    this.isHost = false;
    code = code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer({ debug: 0 });
      const fail = setTimeout(() => { peer.destroy(); reject(new Error('Délai dépassé : salon injoignable.')); }, 15000);
      peer.on('open', () => {
        this.peer = peer;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => { clearTimeout(fail); this.host = conn; this.code = code; resolve(); });
        conn.on('data', (msg) => this.handlers.onData?.('host', msg));
        conn.on('close', () => this.handlers.onHostLost?.());
      });
      peer.on('error', (err) => {
        clearTimeout(fail);
        if (!this.host) { peer.destroy(); reject(new Error(describe(err))); }
        else this.handlers.onError?.(describe(err));
      });
    });
  }

  send(msg) { if (this.host && this.host.open) this.host.send(msg); }
  sendTo(peerId, msg) { const c = this.conns.get(peerId); if (c && c.open) c.send(msg); }
  broadcast(msg, except = null) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  close() {
    try { this.peer?.destroy(); } catch { /* ignoré */ }
    this.peer = null; this.host = null; this.conns.clear(); this.isHost = false; this.code = null;
  }
}

function describe(err) {
  switch (err.type) {
    case 'peer-unavailable': return 'Salon introuvable. Vérifie le code.';
    case 'network': case 'server-error': case 'socket-error': return 'Connexion au réseau impossible.';
    case 'browser-incompatible': return 'Ce navigateur ne gère pas le multijoueur (WebRTC).';
    default: return err.message || 'Erreur réseau.';
  }
}
