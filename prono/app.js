import { fetchDay, fetchDetails, fetchLeagueHistory, isTop, leaguePriority, leagueSlug, rememberSlug } from './api.js';
import { predict, livePredict, pickHit, outcomeOf, reliability, CALIBRATION } from './model.js';
import { fitRatings, expectedGoals } from './rating.js';

// ───────────────────────── état ─────────────────────────
const LS = {
  get(k, d) { try { const v = localStorage.getItem('pf:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pf:' + k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué */ } },
};

// Serveur d'alertes push (Netlify) : envoie buts, cartons, coups d'envoi… même app fermée.
const PUSH_API = 'https://prono-alertes-foot.netlify.app';

const state = {
  offset: 0,
  matches: [],
  details: new Map(),
  ratings: new Map(),
  filter: LS.get('filter', 'all'),
  scope: LS.get('scope', 'top'),
  query: '',
  view: 'matchs',
  starred: new Set(LS.get('starred', [])),
  teams: LS.get('teams', {}), // id → nom
  settings: { notif: false, reminders: true, goals: true, kickoff: true, cards: true, prematch: true, sound: true, odds: true, alertScope: 'suivis', ...LS.get('settings', {}) },
  history: LS.get('history', {}),
  prev: LS.get('prev', {}),
  push: LS.get('push', { on: false, endpoint: null }),
  odds: LS.get('odds', {}), // id → { cur, moves: [{ t, h, d, a }], at, dir }
  server: null,
  updatedAt: null,
  error: null,
  open: null,
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => (x == null || Number.isNaN(x) ? '–' : Math.round(x * 100) + ' %');
const hhmm = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayDate = () => { const d = new Date(); d.setDate(d.getDate() + state.offset); return d; };
const minuteOf = (m) => (m.statusName === 'STATUS_HALFTIME' ? 45 : parseInt(m.clock, 10) || 0);
const followsTeam = (m) => m.home.id in state.teams || m.away.id in state.teams;
const followed = (m) => state.starred.has(m.id) || followsTeam(m);

// ───────────────────────── pronostics ─────────────────────────
function slugOf(m) { return leagueSlug(m.league) || state.details.get(m.id)?.leagueSlug || null; }

function predictionFor(m) {
  const d = state.details.get(m.id);
  const slug = slugOf(m);
  const fit = slug ? state.ratings.get(slug)?.fit : null;
  return predict({
    neutral: m.neutral,
    rating: fit ? expectedGoals(fit, m.home.id, m.away.id, m.neutral) : null,
    home: { form: m.home.form, record: m.home.record, games: d?.homeGames, standing: d?.homeStanding },
    away: { form: m.away.form, record: m.away.record, games: d?.awayGames, standing: d?.awayStanding },
    h2h: d?.h2h || [],
    market: d?.market || m.market,
    total: d?.total || m.total,
  });
}
const predCache = new Map();
function pred(m) {
  const slug = slugOf(m);
  const key = `${m.id}:${state.details.has(m.id) ? 'd' : 's'}:${slug && state.ratings.get(slug)?.fit ? 'r' : ''}`;
  if (!predCache.has(key)) predCache.set(key, predictionFor(m));
  return predCache.get(key);
}
function live(m) {
  if (m.state !== 'in') return null;
  const p = pred(m);
  const reds = (id) => m.reds.filter((r) => r.teamId === id).length;
  return livePredict(p.xgH, p.xgA, minuteOf(m), m.home.score ?? 0, m.away.score ?? 0, reds(m.home.id), reds(m.away.id));
}

function recordHistory() {
  let changed = false;
  for (const m of state.matches) {
    const h = state.history[m.id];
    if (m.state === 'pre') {
      const p = pred(m);
      const entry = {
        home: m.home.name, away: m.away.name, league: m.leagueLabel, date: m.date.toISOString(),
        pick: p.pick.code, alt: p.pick.alt?.code || null, pH: p.pH, pD: p.pD, pA: p.pA, pp: p.pick.p,
        tier: p.reliability.key, quality: p.quality, top: isTop(m.league),
        fav: p.market ? ['1', 'N', '2'][[p.market.pH, p.market.pD, p.market.pA].indexOf(Math.max(p.market.pH, p.market.pD, p.market.pA))] : null,
      };
      if (!h || h.pick !== entry.pick || h.quality !== entry.quality || Math.abs(h.pH - entry.pH) > 0.01) {
        state.history[m.id] = entry;
        changed = true;
      }
    } else if (m.completed && h && h.result == null && m.home.score != null) {
      h.result = `${m.home.score}-${m.away.score}`;
      h.outcome = outcomeOf(m.home.score, m.away.score);
      changed = true;
    }
  }
  if (changed) {
    const limit = Date.now() - 90 * 864e5;
    for (const [id, h] of Object.entries(state.history)) if (new Date(h.date).getTime() < limit) delete state.history[id];
    LS.set('history', state.history);
  }
}

// ───────────────────────── chargement ─────────────────────────
let loading = false;
async function refresh({ silent = false } = {}) {
  if (loading) return;
  loading = true;
  if (!silent) setStatus('Actualisation…');
  $('#refresh')?.classList.add('spin');
  try {
    const matches = await fetchDay(dayDate());
    matches.sort((a, b) => a.date - b.date);
    state.matches = matches;
    state.updatedAt = new Date();
    state.error = null;
    predCache.clear();
    if (state.offset === 0) detectEvents(matches);
    trackOdds(matches);
    recordHistory();
    render();
    enrichQueue();
    ratingsQueue();
    updateBadge();
  } catch {
    state.error = 'Connexion impossible aux données. Nouvel essai automatique.';
    render();
  } finally {
    loading = false;
    $('#refresh')?.classList.remove('spin');
    schedule();
  }
}

let pollTimer = null;
function schedule() {
  clearTimeout(pollTimer);
  const now = Date.now();
  const liveNow = state.matches.some((m) => m.state === 'in');
  const soon = state.matches.some((m) => m.state === 'pre' && m.date - now < 15 * 60e3 && m.date - now > -60 * 60e3);
  // cotes : suivi toutes les 60 s quand des matchs suivis commencent dans les 3 h
  const oddsWatch = state.matches.some((m) => m.state === 'pre' && m.market && m.date - now < 3 * 3600e3 && inScope(m));
  const delay = state.offset !== 0 ? 10 * 60e3 : liveNow ? 25e3 : soon || oddsWatch ? 60e3 : 5 * 60e3;
  pollTimer = setTimeout(() => refresh({ silent: true }), delay);
}

// Analyse détaillée (forme, classement, face-à-face…) en tâche de fond
const queued = new Set();
let running = 0;
function enrichQueue() {
  const targets = state.matches
    .filter((m) => m.state !== 'post' && !state.details.has(m.id) && !queued.has(m.id))
    .filter((m) => isTop(m.league) || followed(m))
    .sort((a, b) => leaguePriority(a.league) - leaguePriority(b.league) || a.date - b.date);
  targets.forEach((m) => queued.add(m.id));
  const list = [...targets];
  const next = async () => {
    const m = list.shift();
    if (!m) { running--; return; }
    await loadDetails(m, true);
    next();
  };
  while (running < 3 && list.length) { running++; next(); }
}

const DET_TTL = 3 * 3600e3;
async function loadDetails(m, background = false) {
  const cached = LS.get('det:' + m.id, null);
  if (cached && Date.now() - cached.fetchedAt < DET_TTL && m.state === 'pre') {
    state.details.set(m.id, cached);
  } else {
    try {
      const d = await fetchDetails(m);
      state.details.set(m.id, d);
      if (m.state === 'pre') LS.set('det:' + m.id, d);
    } catch { return; }
  }
  const d = state.details.get(m.id);
  if (d?.leagueSlug) { rememberSlug(m.league, d.leagueSlug); queueRating(d.leagueSlug); }
  if (background) renderSoon(); else render();
}
let renderTimer = null;
const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { predCache.clear(); recordHistory(); render(); }, 500); };

// Notation des équipes par championnat (14 mois de matchs, buts + tirs cadrés)
const ratingQ = [];
let ratingBusy = false;
function queueRating(slug) {
  if (!slug || state.ratings.has(slug) || ratingQ.includes(slug)) return;
  ratingQ.push(slug);
  pumpRatings();
}
function ratingsQueue() {
  const leagues = [...new Set(state.matches.filter((m) => m.state !== 'post' && (isTop(m.league) || followed(m))).sort((a, b) => leaguePriority(a.league) - leaguePriority(b.league)).map((m) => leagueSlug(m.league)).filter(Boolean))];
  leagues.forEach(queueRating);
}
async function pumpRatings() {
  if (ratingBusy) return;
  ratingBusy = true;
  while (ratingQ.length) {
    const slug = ratingQ.shift();
    try {
      const rows = await fetchLeagueHistory(slug);
      state.ratings.set(slug, { fit: fitRatings(rows), at: Date.now(), n: rows.length });
    } catch {
      state.ratings.set(slug, { fit: null, at: Date.now(), n: 0 });
    }
    renderSoon();
  }
  ratingBusy = false;
}

function cleanCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('pf:det:')) {
        const v = JSON.parse(localStorage.getItem(k));
        if (!v || Date.now() - v.fetchedAt > DET_TTL) localStorage.removeItem(k);
      }
    }
  } catch { /* rien */ }
}

// ───────────────────────── cotes en temps réel ─────────────────────────
const r2 = (x) => Math.round(x * 100) / 100;
function trackOdds(matches) {
  const now = Date.now();
  let changed = false;
  for (const m of matches) {
    if (!m.market || m.state === 'post') continue;
    const cur = { h: r2(m.market.home), d: r2(m.market.draw), a: r2(m.market.away) };
    const e = state.odds[m.id];
    if (!e) { state.odds[m.id] = { cur, moves: [{ t: now, ...cur }], at: null, dir: {}, seen: now }; changed = true; continue; }
    e.seen = now;
    if (e.cur.h !== cur.h || e.cur.d !== cur.d || e.cur.a !== cur.a) {
      e.dir = { h: Math.sign(cur.h - e.cur.h), d: Math.sign(cur.d - e.cur.d), a: Math.sign(cur.a - e.cur.a) };
      const before = e.cur;
      e.cur = cur; e.at = now;
      e.moves.push({ t: now, ...cur });
      if (e.moves.length > 30) e.moves.splice(1, e.moves.length - 30);
      changed = true;
      // alerte si une cote d'un match suivi bouge d'au moins 8 %
      if (state.settings.odds && followed(m) && state.offset === 0) {
        const big = [['h', m.home.short], ['d', 'Nul'], ['a', m.away.short]].filter(([k]) => Math.abs(cur[k] / before[k] - 1) >= 0.08);
        if (big.length) notify(`Cotes en mouvement · ${m.home.short} – ${m.away.short}`, big.map(([k, n]) => `${n} ${before[k].toFixed(2)} → ${cur[k].toFixed(2)} ${cur[k] < before[k] ? '▼' : '▲'}`).join(' · '), 'odds-' + m.id, { matchId: m.id });
      }
    }
  }
  if (changed) {
    for (const [id, e] of Object.entries(state.odds)) if (now - (e.seen || 0) > 3 * 864e5) delete state.odds[id];
    LS.set('odds', state.odds);
  }
}
// tendance d'une cote : dernier mouvement récent (30 min), sinon par rapport à l'ouverture
function oddsTrend(m, k) {
  const e = state.odds[m.id];
  if (e?.at && Date.now() - e.at < 30 * 60e3 && e.dir[k]) return e.dir[k];
  const open = m.opening?.[{ h: 'home', d: 'draw', a: 'away' }[k]], cur = m.market?.[{ h: 'home', d: 'draw', a: 'away' }[k]];
  if (!open || !cur || Math.abs(cur - open) < 0.005) return 0;
  return Math.sign(cur - open);
}
const flashing = (m) => { const e = state.odds[m.id]; return e?.at && Date.now() - e.at < 90e3; };
function oddCell(m, k, cls = 'od') {
  const v = m.market?.[{ h: 'home', d: 'draw', a: 'away' }[k]];
  if (!v) return '';
  const t = oddsTrend(m, k);
  return `<span class="${cls} ${t < 0 ? 'down' : t > 0 ? 'up' : ''} ${flashing(m) && state.odds[m.id]?.dir?.[k] ? 'flash' : ''}">${v.toFixed(2)}${t ? `<i>${t < 0 ? '▼' : '▲'}</i>` : ''}</span>`;
}

// ───────────────────────── notifications ─────────────────────────
const inScope = (m) => {
  if (followed(m)) return true;
  if (state.settings.alertScope === 'favoris') return false;
  if (state.settings.alertScope === 'tous') return true;
  return isTop(m.league);
};

let audioCtx = null;
function chime(kind = 'goal') {
  if (!state.settings.sound || document.hidden) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'goal' ? [660, 880, 1320] : [520, 390];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch { /* audio indisponible */ }
  try { navigator.vibrate?.(kind === 'goal' ? [80, 60, 160] : [120]); } catch { /* rien */ }
}

async function notify(title, body, tag, { kind = 'info', matchId, event = false } = {}) {
  toast(title, body, matchId);
  if (kind === 'goal' || kind === 'red') chime(kind === 'goal' ? 'goal' : 'alert');
  if (event && state.push.on) return; // le serveur envoie déjà la notification système
  if (!state.settings.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', renotify: true, data: { matchId } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, opts);
  } catch { /* repli */ }
  try { new Notification(title, opts); } catch { /* mobile sans service worker */ }
}

function updateBadge() {
  const n = state.matches.filter((m) => m.state === 'in' && followed(m)).length;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch { /* non géré */ }
}

function detectEvents(matches) {
  const prev = state.prev;
  const next = {};
  const now = Date.now();
  for (const m of matches) {
    const snap = { s: m.state, n: m.statusName, h: m.home.score ?? 0, a: m.away.score ?? 0, r: m.reds.length, w: prev[m.id]?.w || false };
    next[m.id] = snap;
    const p = prev[m.id];
    if (!inScope(m)) continue;
    const vs = `${m.home.short} ${snap.h}-${snap.a} ${m.away.short}`;
    // 15 minutes avant le coup d'envoi (matchs et équipes suivis)
    if (state.settings.prematch && followed(m) && m.state === 'pre' && !snap.w && m.date - now < 16 * 60e3 && m.date - now > 0) {
      snap.w = true;
      const pr = pred(m);
      notify(`Dans 15 min · ${m.home.short} – ${m.away.short}`, `Prono ${pr.pick.code} (${pct(pr.pick.p)}, ${pr.reliability.tier.toLowerCase()}) · ${m.leagueLabel}`, 'pre-' + m.id, { matchId: m.id, event: true });
    }
    if (!p) continue;
    if (p.s === 'pre' && m.state === 'in' && state.settings.kickoff) {
      const pr = pred(m);
      notify(`Coup d’envoi · ${m.home.short} – ${m.away.short}`, `Prono ${pr.pick.code} · ${pr.pick.label} (${pct(pr.pick.p)})`, 'ko-' + m.id, { matchId: m.id, event: true });
    }
    if (state.settings.goals && (snap.h > p.h || snap.a > p.a)) {
      const team = snap.h > p.h ? m.home : m.away;
      const last = [...m.goals].reverse().find((g) => g.teamId === team.id);
      const who = last ? `${last.player}${last.penalty ? ' (pen.)' : ''}${last.own ? ' (c.s.c.)' : ''} ${last.minute}` : m.clock || '';
      const lp = live(m);
      const lead = lp ? ` · victoire ${m.home.short} ${pct(lp.pH)} / nul ${pct(lp.pD)} / ${m.away.short} ${pct(lp.pA)}` : '';
      notify(`⚽ BUT ${team.short} · ${vs}`, `${who}${lead}`, 'goal-' + m.id, { kind: 'goal', matchId: m.id, event: true });
    } else if (state.settings.goals && (snap.h < p.h || snap.a < p.a)) {
      notify(`But annulé · ${vs}`, 'Décision de l’arbitre (VAR)', 'goal-' + m.id, { matchId: m.id, event: true });
    }
    if (state.settings.cards && snap.r > (p.r || 0)) {
      const r = m.reds[m.reds.length - 1];
      const team = r?.teamId === m.home.id ? m.home : m.away;
      notify(`🟥 Rouge · ${team.short}`, `${r?.player || ''} ${r?.minute || ''} · ${vs}`, 'red-' + m.id, { kind: 'red', matchId: m.id, event: true });
    }
    if (state.settings.kickoff && p.n !== 'STATUS_HALFTIME' && m.statusName === 'STATUS_HALFTIME') {
      notify(`Mi-temps · ${vs}`, m.goals.map((g) => `${g.player} ${g.minute}`).join(', ') || 'Pas de but', 'ht-' + m.id, { matchId: m.id, event: true });
    }
    if (p.s === 'in' && m.state === 'post' && m.completed) {
      const h = state.history[m.id];
      const verdict = h ? (pickHit(h.pick, snap.h, snap.a) ? `Prono ${h.pick} validé ✓` : `Prono ${h.pick} raté ✕`) : '';
      notify(`Fin du match · ${vs}`, verdict, 'ft-' + m.id, { matchId: m.id, event: true });
    }
  }
  state.prev = next;
  LS.set('prev', next);
}

let reminderTimer = null;
function scheduleReminder() {
  clearTimeout(reminderTimer);
  const now = new Date();
  const nextSlot = new Date(now);
  nextSlot.setSeconds(0, 0);
  nextSlot.setMinutes(now.getMinutes() < 30 ? 30 : 60);
  reminderTimer = setTimeout(() => { sendReminder(); scheduleReminder(); }, nextSlot - now);
}
function sendReminder(force = false) {
  if ((!state.settings.reminders || state.offset !== 0) && !force) return;
  const now = Date.now();
  const upcoming = state.matches
    .filter((m) => m.state === 'pre' && m.date - now > 0 && m.date - now < 3 * 3600e3 && inScope(m))
    .sort((a, b) => (followed(b) - followed(a)) || pred(b).pick.p - pred(a).pick.p);
  const liveN = state.matches.filter((m) => m.state === 'in' && inScope(m)).length;
  if (!upcoming.length) { if (force) toast('Rappel', 'Aucun match suivi dans les 3 prochaines heures.'); return; }
  const lines = upcoming.slice(0, 5).sort((a, b) => a.date - b.date).map((m) => {
    const p = pred(m);
    return `${hhmm(m.date)} ${m.home.short}–${m.away.short} → ${p.pick.code} ${pct(p.pick.p)}`;
  });
  const more = upcoming.length > 5 ? ` · +${upcoming.length - 5} autres` : '';
  notify(`${upcoming.length} match${upcoming.length > 1 ? 's' : ''} d’ici 3 h${liveN ? ` · ${liveN} en direct` : ''}`, lines.join('\n') + more, 'reminder', { event: !force });
}

// ───────────────────────── push serveur ─────────────────────────
const pushSupported = () => PUSH_API && !PUSH_API.includes('__') && 'serviceWorker' in navigator && 'PushManager' in window;
function b64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function pushPrefs() {
  const s = state.settings;
  return { scope: s.alertScope, teams: Object.keys(state.teams), matches: [...state.starred], goals: s.goals, cards: s.cards, kickoff: s.kickoff, prematch: s.prematch, reminders: s.reminders };
}
async function api(path, body) {
  const r = await fetch(PUSH_API + '/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function subscribePush() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await api('vapid');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    }
    await api('subscribe', { subscription: sub.toJSON(), prefs: pushPrefs() });
    state.push = { on: true, endpoint: sub.endpoint, at: Date.now() };
    LS.set('push', state.push);
    return true;
  } catch (e) {
    state.push = { on: false, endpoint: null, error: String(e.message || e) };
    LS.set('push', state.push);
    return false;
  }
}
let syncTimer = null;
function syncPush() {
  if (!state.push.on) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => subscribePush(), 800);
}
async function checkServer() {
  if (!pushSupported()) return;
  try { state.server = await api('status'); } catch { state.server = { ok: false }; }
  if (state.view === 'reglages') render();
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('Notifications', 'Sur iPhone : touchez Partager puis « Sur l’écran d’accueil », ouvrez Prono depuis l’icône, puis activez les alertes.');
    return false;
  }
  const perm = await Notification.requestPermission();
  state.settings.notif = perm === 'granted';
  LS.set('settings', state.settings);
  if (perm === 'granted') {
    const ok = await subscribePush();
    notify('Alertes activées', ok ? 'Le serveur vous préviendra même app fermée : buts, rouges, mi-temps, fins de match, rappel :00 et :30.' : 'Alertes actives tant que l’app est ouverte (serveur injoignable pour le moment).', 'welcome');
    checkServer();
  }
  else toast('Notifications', 'Autorisation refusée dans le navigateur.');
  render();
  return perm === 'granted';
}

// ───────────────────────── rendu ─────────────────────────
function setStatus(t) { const el = $('#status'); if (el) el.textContent = t; }

function visibleMatches() {
  const q = state.query.trim().toLowerCase();
  return state.matches.filter((m) => {
    if (state.scope === 'top' && !isTop(m.league) && !followed(m)) return false;
    if (state.scope === 'fav' && !followed(m)) return false;
    if (state.filter === 'live' && m.state !== 'in') return false;
    if (state.filter === 'next' && m.state !== 'pre') return false;
    if (state.filter === 'done' && m.state !== 'post') return false;
    if (q && !`${m.home.name} ${m.away.name} ${m.leagueLabel}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function logo(t, size = 22) {
  return t.logo
    ? `<img class="logo" src="${esc(t.logo.replace('/500/', '/500/'))}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo ph'}))">`
    : `<span class="logo ph"></span>`;
}

function timeCell(m) {
  if (m.state === 'in') return `<span class="live"><i></i>${m.statusName === 'STATUS_HALFTIME' ? 'MT' : esc(m.clock || 'Live')}</span>`;
  if (m.state === 'post') return `<span class="muted">${m.completed ? 'Fin' : esc(m.statusShort)}</span>`;
  return `<span>${hhmm(m.date)}</span>`;
}

function probBar(p, cls = '') {
  return `<div class="bar ${cls}" role="img" aria-label="1 ${pct(p.pH)}, nul ${pct(p.pD)}, 2 ${pct(p.pA)}">
    <span style="flex:${p.pH.toFixed(3)}" class="b1"></span><span style="flex:${p.pD.toFixed(3)}" class="bn"></span><span style="flex:${p.pA.toFixed(3)}" class="b2"></span>
  </div>`;
}
const tierChip = (rel) => `<span class="tier ${rel.key}">${rel.tier}</span>`;

function verdict(m) {
  const h = state.history[m.id];
  if (!h || m.state !== 'post' || m.home.score == null || !m.completed) return '';
  const ok = pickHit(h.pick, m.home.score, m.away.score);
  return `<span class="tag ${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✕'}</span>`;
}

function row(m) {
  const p = pred(m);
  const lp = live(m);
  const shown = lp || p;
  const started = m.state !== 'pre';
  const star = followed(m);
  const fav = [shown.pH, shown.pD, shown.pA].indexOf(Math.max(shown.pH, shown.pD, shown.pA));
  const wp = (v, i) => (m.state === 'post' ? '' : `<span class="wp ${fav === i ? 'fav' : ''}">${pct(v)}</span>`);
  const sub = m.state === 'post'
    ? `${esc(m.leagueLabel)}${verdict(m) ? ` · prono ${esc(state.history[m.id].pick)} ${verdict(m)}` : ''}`
    : `<span class="${fav === 1 ? 'fav-t' : ''}">Nul ${pct(shown.pD)}</span>${m.state === 'pre' && m.market ? ` <span class="dl-od">cote ${oddCell(m, 'd', 'od inl')}</span>` : ''} · ${lp ? '<span class="live-t">en direct</span>' : esc(m.leagueLabel)}`;
  return `<li class="match ${m.state}" data-id="${m.id}" tabindex="0">
    <div class="t">${timeCell(m)}</div>
    <div class="teams">
      <div class="team ${m.state === 'post' && m.home.winner ? 'win' : ''}">${logo(m.home)}<span class="nm"><span class="full">${esc(m.home.name)}</span><span class="shortn">${esc(m.home.short)}</span></span>${started ? `<b class="sc">${m.home.score ?? ''}</b>` : ''}${wp(shown.pH, 0)}${m.state === 'pre' ? oddCell(m, 'h') : ''}</div>
      <div class="team ${m.state === 'post' && m.away.winner ? 'win' : ''}">${logo(m.away)}<span class="nm"><span class="full">${esc(m.away.name)}</span><span class="shortn">${esc(m.away.short)}</span></span>${started ? `<b class="sc">${m.away.score ?? ''}</b>` : ''}${wp(shown.pA, 2)}${m.state === 'pre' ? oddCell(m, 'a') : ''}</div>
      <div class="drawline muted small">${sub}</div>
    </div>
    <button class="star ${star ? 'on' : ''}" data-star="${m.id}" aria-label="${star ? 'Ne plus suivre' : 'Suivre'} ce match">${star ? '★' : '☆'}</button>
  </li>`;
}

function card(m) {
  const p = pred(m);
  return `<button class="hl" data-id="${m.id}">
    <span class="hl-top"><span class="muted small">${hhmm(m.date)} · ${esc(m.leagueLabel)}</span>${tierChip(p.reliability)}</span>
    <span class="hl-teams">${logo(m.home, 18)}${esc(m.home.short)}<span class="muted">–</span>${esc(m.away.short)}${logo(m.away, 18)}</span>
    <span class="hl-pick"><b>${p.pick.code}</b><span>${esc(p.pick.label)}</span><span class="pp">${pct(p.pick.p)}</span></span>
    <span class="muted small">Réussite mesurée à ce niveau : ${pct(p.reliability.hit)}</span>
  </button>`;
}

function liveStrip() {
  const lv = visibleMatches().filter((m) => m.state === 'in');
  if (!lv.length || state.filter === 'done' || state.filter === 'next') return '';
  return `<section class="livebox"><h2><span class="live"><i></i>En direct</span><span class="muted">${lv.length}</span></h2><div class="lv-row">${lv.slice(0, 12).map((m) => {
    const lp = live(m);
    return `<button class="lv" data-id="${m.id}">
      <span class="muted small">${esc(m.leagueLabel)} · <b class="live-t">${m.statusName === 'STATUS_HALFTIME' ? 'MT' : esc(m.clock)}</b></span>
      <span class="lv-line">${logo(m.home, 18)}<span>${esc(m.home.short)}</span><b>${m.home.score ?? 0}</b></span>
      <span class="lv-line">${logo(m.away, 18)}<span>${esc(m.away.short)}</span><b>${m.away.score ?? 0}</b></span>
      ${lp ? probBar(lp, 'thin') : ''}
    </button>`;
  }).join('')}</div></section>`;
}

function summary() {
  const vis = visibleMatches();
  const pre = vis.filter((m) => m.state === 'pre');
  const safe = pre.filter((m) => pred(m).pick.p >= 0.65).length;
  const lv = vis.filter((m) => m.state === 'in').length;
  const done = vis.filter((m) => m.state === 'post' && state.history[m.id]?.result);
  const ok = done.filter((m) => pickHit(state.history[m.id].pick, m.home.score, m.away.score)).length;
  return `<div class="summary">
    <div><b>${vis.length}</b><span class="muted small">matchs</span></div>
    <div><b class="${lv ? 'live-t' : ''}">${lv}</b><span class="muted small">en direct</span></div>
    <button data-view="surs"><b>${safe}</b><span class="muted small">pronos sûrs</span></button>
    <div><b>${done.length ? `${ok}/${done.length}` : '–'}</b><span class="muted small">validés</span></div>
  </div>`;
}

function renderMatches() {
  if (state.error && !state.matches.length) return `<p class="empty">${esc(state.error)}</p>`;
  if (!state.updatedAt) return `<div class="skeleton">${'<div></div>'.repeat(8)}</div>`;
  const list = visibleMatches();
  if (!list.length) return summary() + `<p class="empty">Aucun match pour ce filtre.${state.scope !== 'all' ? ' <button class="link" data-scope="all">Voir le monde entier</button>' : ''}</p>`;
  // tri par heure de coup d'envoi, regroupé par créneau
  const groups = new Map();
  for (const m of [...list].sort((x, y) => x.date - y.date || leaguePriority(x.league) - leaguePriority(y.league))) {
    const k = hhmm(m.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  return summary() + liveStrip() + `<div class="legend muted small"><span>% = probabilité de victoire</span><span class="wp fav">favori</span></div>` + [...groups.entries()].map(([h, ms], gi) => `<section class="league" style="--i:${Math.min(gi, 10)}">
      <h3><span>${h}</span><span class="muted">${ms.length} match${ms.length > 1 ? 's' : ''}</span></h3>
      <ul>${ms.map(row).join('')}</ul>
    </section>`).join('');
}

function renderSafe() {
  if (!state.updatedAt) return `<div class="skeleton">${'<div></div>'.repeat(6)}</div>`;
  const pre = state.matches.filter((m) => m.state === 'pre' && (isTop(m.league) || followed(m) || state.scope === 'all'));
  const ranked = [...pre].sort((a, b) => pred(b).pick.p - pred(a).pick.p);
  const safe = ranked.filter((m) => pred(m).pick.p >= 0.65);
  const tight = ranked.filter((m) => pred(m).pick.p < 0.65 && pred(m).pick.p >= 0.55).slice(0, 9);
  const values = pre.filter((m) => pred(m).value.length);
  const t5 = CALIBRATION[0], t4 = CALIBRATION[1];
  return `<div class="safe">
    <p class="lead">Les pronos les plus probables ${state.offset === 0 ? 'du jour' : state.offset < 0 ? 'd’hier' : 'de demain'}, classés par probabilité. Testés sur ${t5.n + t4.n} matchs comparables : <b>${pct(t5.hit)}</b> de réussite en « Très sûr », <b>${pct(t4.hit)}</b> en « Sûr ».</p>
    ${safe.length ? `<div class="hl-row">${safe.map(card).join('')}</div>` : '<p class="empty">Aucun prono à 65 % ou plus pour le moment. Les analyses se complètent au fil des minutes.</p>'}
    ${tight.length ? `<h2>Solides <span class="muted small">55 à 65 % · ${pct(CALIBRATION[2].hit)} de réussite mesurée, ${pct(CALIBRATION[2].dc)} en double chance</span></h2><div class="hl-row">${tight.map(card).join('')}</div>` : ''}
    ${values.length ? `<h2>Value bets <span class="muted small">le modèle voit plus de chances que la cote n’en donne</span></h2><div class="hl-row">${values.map(card).join('')}</div>` : ''}
    <p class="note">Même à 88 %, un prono sur huit est perdu. Combiner plusieurs pronos multiplie les risques : trois pronos « Sûrs » ensemble ne passent qu’environ 4 fois sur 10.</p>
  </div>`;
}

function renderBilan() {
  const all = Object.entries(state.history).map(([id, h]) => ({ id, ...h })).filter((h) => h.result);
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  const hit = (h, code = h.pick) => pickHit(code, ...h.result.split('-').map(Number));
  const rate = (arr, f = (h) => hit(h)) => (arr.length ? arr.filter(f).length / arr.length : null);
  const stat = (label, v, n, sub = '') => `<div class="kpi"><span class="muted small">${label}</span><b>${v == null ? '–' : pct(v)}</b><span class="muted small">${n} match${n > 1 ? 's' : ''}${sub}</span></div>`;
  const tiers = CALIBRATION.map((c) => {
    const arr = all.filter((h) => h.tier === c.key);
    return `<div class="cal-row"><span>${tierChip(c)}</span><span>${arr.length ? pct(rate(arr)) : '–'} <span class="muted small">(${arr.length})</span></span><span class="muted">${pct(c.hit)}</span></div>`;
  }).join('');
  return `<div class="bilan">
    ${all.length ? `<div class="kpis">
      ${stat('Réussite 1N2', rate(all), all.length)}
      ${stat('Pronos « Sûr » et +', rate(all.filter((h) => h.pp >= 0.65)), all.filter((h) => h.pp >= 0.65).length)}
      ${stat('Double chance', rate(all.filter((h) => h.alt), (h) => hit(h, h.alt)), all.filter((h) => h.alt).length, ' (matchs serrés)')}
      ${stat('Favori du marché', rate(all.filter((h) => h.fav), (h) => h.fav === h.outcome), all.filter((h) => h.fav).length, ' (référence)')}
    </div>` : '<p class="empty">Le bilan se remplit tout seul : chaque prono est figé avant le coup d’envoi puis comparé au score final.</p>'}
    <section class="panel"><h4>Fiabilité par niveau</h4>
      <div class="cal-row head"><span>Niveau</span><span>Sur cet appareil</span><span>Backtest</span></div>${tiers}
      <p class="muted small">Backtest : 1 971 matchs des 5 grands championnats (sept. 2025 à oct. 2026), prono calculé uniquement avec les données disponibles avant chaque match.</p>
    </section>
    ${all.length ? `<ul class="hist">${all.slice(0, 200).map((h) => {
      const ok = hit(h);
      return `<li><span class="tag ${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✕'}</span>
        <span class="h-m"><span>${esc(h.home)} <b>${h.result}</b> ${esc(h.away)}</span><span class="muted small">${new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${esc(h.league)}</span></span>
        <span class="h-p">${h.pick} <span class="muted small">${pct(h.pp)}</span></span></li>`;
    }).join('')}</ul>` : ''}
  </div>`;
}

function renderSettings() {
  const s = state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const tog = (k, label, sub) => `<label class="set"><span><b>${label}</b><span class="muted small">${sub}</span></span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const teams = Object.entries(state.teams);
  return `<div class="settings-wrap">
    ${!standalone && /iPhone|iPad/.test(navigator.userAgent) ? `<section class="panel install"><b>Installer Prono sur l’iPhone</b><ol><li>Touchez <b>Partager</b> <span class="muted">(carré avec une flèche)</span></li><li>Choisissez <b>Sur l’écran d’accueil</b></li><li>Ouvrez Prono depuis l’icône, puis activez les alertes ci-dessous</li></ol></section>` : ''}
    <div class="settings">
      <div class="set"><span><b>Notifications de l’app</b><span class="muted small">${perm === 'granted' && s.notif ? 'Activées sur cet appareil' : perm === 'denied' ? 'Bloquées dans les réglages' : perm === 'unsupported' ? 'Installez d’abord l’app sur l’écran d’accueil' : 'Désactivées'}</span></span>
        ${perm === 'granted' && s.notif ? '<button class="btn ghost" data-act="test">Tester</button>' : '<button class="btn" data-act="notif">Activer</button>'}</div>
      ${pushSupported() || PUSH_API.includes('__') ? `<div class="set"><span><b>Alertes app fermée</b><span class="muted small">${!pushSupported() ? 'Serveur pas encore configuré' : !state.push.on ? 'Activez les notifications pour vous abonner' : state.server == null ? 'Vérification du serveur…' : state.server.ok ? `Serveur actif · vérifié il y a ${Math.max(1, Math.round((Date.now() - state.server.at) / 1000))} s${state.server.fast ? ' · mode direct (toutes les 8 s)' : ''}` : 'Serveur injoignable : alertes de l’app seulement'}</span></span>${state.push.on ? '<button class="btn ghost" data-act="pushtest">Tester</button>' : ''}</div>` : ''}
      ${tog('goals', 'Buts', 'Buteur, minute et nouvelles probabilités. But annulé par la VAR')}
      ${tog('cards', 'Cartons rouges', 'Avec le joueur et la minute')}
      ${tog('kickoff', 'Coup d’envoi, mi-temps, fin', 'Avec le prono puis le verdict')}
      ${tog('prematch', '15 min avant mes matchs', 'Matchs ★ et équipes suivies')}
      ${tog('reminders', 'Rappel toutes les 30 min', 'À l’heure pile et à la demie : les matchs des 3 prochaines heures')}
      ${tog('odds', 'Mouvements de cotes', 'Quand une cote d’un match suivi bouge d’au moins 8 %')}
      ${tog('sound', 'Son et vibration', 'Quand l’app est ouverte')}
      <div class="set"><span><b>Matchs concernés</b><span class="muted small">Pour toutes les alertes</span></span>
        <select data-set="alertScope">
          <option value="suivis" ${s.alertScope === 'suivis' ? 'selected' : ''}>Top ligues + suivis</option>
          <option value="favoris" ${s.alertScope === 'favoris' ? 'selected' : ''}>Seulement mes suivis</option>
          <option value="tous" ${s.alertScope === 'tous' ? 'selected' : ''}>Le monde entier</option>
        </select></div>
      <div class="set"><span><b>Aperçu du rappel</b><span class="muted small">Le prochain rappel, tout de suite</span></span><button class="btn ghost" data-act="remind">Envoyer</button></div>
    </div>
    <section class="panel"><h4>Équipes suivies</h4>
      ${teams.length ? `<div class="chips">${teams.map(([id, n]) => `<button class="chip" data-unteam="${id}">${esc(n)} ✕</button>`).join('')}</div>` : '<p class="muted small">Ouvrez un match et touchez « Suivre » sous une équipe : tous ses matchs seront suivis automatiquement.</p>'}
    </section>
    <section class="panel"><h4>Bon à savoir</h4>
      <p class="small">Deux systèmes se complètent : le serveur d’alertes surveille les matchs toutes les 8 secondes et envoie des notifications push, même téléphone verrouillé et app fermée. Quand Prono est ouvert, l’app vérifie aussi elle-même toutes les 25 secondes. Sur iPhone, les notifications push exigent que Prono soit installé sur l’écran d’accueil (iOS 16.4 ou plus).</p>
    </section>
    <p class="note">Données ESPN, actualisées toutes les 25 s pendant les matchs. Pronostics à titre informatif : pariez de façon responsable, jamais plus que ce que vous pouvez perdre. Joueurs Info Service : 09 74 75 13 13.</p>
  </div>`;
}

function formChips(games) {
  return (games || []).map((g) => {
    const r = g.gf > g.ga ? 'W' : g.gf === g.ga ? 'D' : 'L';
    return `<span class="fc ${r}" title="${esc((g.home ? 'vs ' : '@ ') + g.opponent)} ${g.gf}-${g.ga}">${{ W: 'V', D: 'N', L: 'D' }[r]}</span>`;
  }).join('');
}

function powerBars(m) {
  const fit = state.ratings.get(slugOf(m))?.fit;
  if (!fit || !(m.home.id in fit.att) || !(m.away.id in fit.att)) return '';
  const all = Object.keys(fit.att);
  const rank = (obj, id, asc) => 1 + all.filter((t) => (asc ? obj[t] < obj[id] : obj[t] > obj[id])).length;
  const line = (label, vh, va, better) => {
    const max = Math.max(vh, va, 1.6);
    return `<div class="pw"><span class="pw-v ${better === 'h' ? 'best' : ''}">${vh.toFixed(2)}</span><div class="pw-b"><span style="width:${(vh / max) * 100}%"></span></div><span class="pw-l muted small">${label}</span><div class="pw-b r"><span style="width:${(va / max) * 100}%"></span></div><span class="pw-v ${better === 'a' ? 'best' : ''}">${va.toFixed(2)}</span></div>`;
  };
  const ah = fit.att[m.home.id], aa = fit.att[m.away.id], dh = fit.def[m.home.id], da = fit.def[m.away.id];
  return `<section><h4>Puissance <span class="muted small">notation sur ${fit.n} matchs · 1,00 = moyenne du championnat</span></h4>
    ${line('Attaque', ah, aa, ah > aa ? 'h' : 'a')}
    ${line('Défense (bas = mieux)', dh, da, dh < da ? 'h' : 'a')}
    <p class="muted small">Rang attaque : ${rank(fit.att, m.home.id)}e contre ${rank(fit.att, m.away.id)}e · rang défense : ${rank(fit.def, m.home.id, true)}e contre ${rank(fit.def, m.away.id, true)}e sur ${all.length} équipes.</p>
  </section>`;
}

function oddsBox(m, p) {
  if (!m.market) return m.state === 'pre' ? '<section><h4>Cotes</h4><p class="muted small">Pas de cotes disponibles pour ce match.</p></section>' : '';
  const e = state.odds[m.id];
  const keys = [['h', 'home', `1 · ${esc(m.home.short)}`, p.pH], ['d', 'draw', 'N · Nul', p.pD], ['a', 'away', `2 · ${esc(m.away.short)}`, p.pA]];
  const rows = keys.map(([k, kk, label, prob]) => {
    const cur = m.market[kk], open = m.opening?.[kk];
    const varPct = open ? (cur / open - 1) * 100 : null;
    return `<div class="ot-row"><span class="small">${label}</span>${oddCell(m, k, 'od big')}<span class="muted small">${open ? open.toFixed(2) : '–'}</span><span class="small ${varPct == null || Math.abs(varPct) < 0.5 ? 'muted' : varPct < 0 ? 'dn-t' : 'up-t'}">${varPct == null ? '–' : `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)} %`}</span><span class="small">${(1 / prob).toFixed(2)}</span></div>`;
  }).join('');
  const moves = (e?.moves || []).slice(1).reverse().slice(0, 6);
  return `<section class="oddsbox">
    <h4>Cotes <span class="muted small">${esc(m.provider || 'bookmaker')} · ${m.state === 'pre' ? 'suivies en direct' : 'avant-match'}</span></h4>
    <div class="ot-row head"><span></span><span>Actuelle</span><span>Ouverture</span><span>Variation</span><span>Cote juste</span></div>
    ${rows}
    ${moves.length ? `<div class="moves"><span class="muted small">Derniers mouvements</span>${moves.map((x) => `<div class="mv"><span class="muted small">${new Date(x.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span><span class="small">${x.h.toFixed(2)} · ${x.d.toFixed(2)} · ${x.a.toFixed(2)}</span></div>`).join('')}</div>` : `<p class="muted small">${e ? `Suivi depuis ${new Date(e.moves[0].t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} : pas de mouvement pour l’instant.` : ''}</p>`}
    <p class="muted small">▼ la cote baisse (les parieurs misent dessus), ▲ elle monte. « Cote juste » = 1 / probabilité de notre synthèse : une cote Betclic au-dessus est plus avantageuse. Ce ne sont pas les cotes Betclic : Betclic bloque l’accès automatique à ses cotes ; elles sont en général un peu plus basses.</p>
  </section>`;
}

function winBox(m, p, lp) {
  const w = lp || p;
  const arr = [w.pH, w.pD, w.pA];
  const fav = arr.indexOf(Math.max(...arr));
  const favName = [m.home.name, 'Match nul', m.away.name][fav];
  const cell = (i, label, t) => `<div class="wb ${fav === i ? 'fav' : ''}">${t ? logo(t, 30) : '<span class="wb-x">=</span>'}<span class="wb-l">${label}</span><b>${pct(arr[i])}</b></div>`;
  return `<section class="win">
    <h4>Qui va gagner ?${lp ? ' <span class="live-t small">en direct</span>' : ''}</h4>
    <div class="win-row">${cell(0, esc(m.home.short), m.home)}${cell(1, 'Nul')}${cell(2, esc(m.away.short), m.away)}</div>
    ${probBar(w, 'thick')}
    <p class="small win-txt">${fav === 1 ? `Le <b>match nul</b> est l’issue la plus probable (${pct(arr[1])}).` : `<b>${esc(favName)}</b> a ${pct(arr[fav])} de chances de gagner.`}${lp ? ` <span class="muted">Avant le match : ${esc(m.home.short)} ${pct(p.pH)} · nul ${pct(p.pD)} · ${esc(m.away.short)} ${pct(p.pA)}.</span>` : ''}</p>
  </section>`;
}

function renderDetail(m) {
  const d = state.details.get(m.id);
  const p = pred(m);
  const lp = live(m);
  const started = m.state !== 'pre';
  const goalsFor = (t) => m.goals.filter((g) => g.teamId === t.id).map((g) => `${esc(g.player)} ${esc(g.minute)}${g.penalty ? ' (pen.)' : ''}${g.own ? ' (c.s.c.)' : ''}`).join('<br>');
  const reds = m.reds.map((r) => `<span class="red"></span>${esc(r.player)} ${esc(r.minute)}`).join(' · ');
  const games = (list) => (list || []).map((g) => `<li><span class="fc ${g.gf > g.ga ? 'W' : g.gf === g.ga ? 'D' : 'L'}"></span><span class="muted small">${new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>${g.home ? 'vs' : '@'} ${esc(g.opponent)}</span><b>${g.gf}-${g.ga}</b></li>`).join('');
  const st = (s) => (s ? `${s.rank}e · ${s.pts} pts · ${s.w}V ${s.d}N ${s.l}D · ${s.gd > 0 ? '+' : ''}${s.gd}` : '');
  const leaders = (t) => (d?.leaders?.[t.id] || []).slice(0, 2).map((c) => `<div class="small"><span class="muted">${esc(c.category === 'Goals' ? 'Buteurs' : c.category === 'Assists' ? 'Passeurs' : c.category)}</span> ${c.players.map((x) => esc(x.name)).join(', ')}</div>`).join('');
  const lineup = (t) => (d?.lineups?.[t.id] || []).map((x) => `<span><span class="muted">${esc(x.jersey || '')}</span> ${esc(x.name)}</span>`).join('');
  const triple = (label, a, b, c, cls = '') => `<div class="cmp ${cls}"><span class="muted small">${label}</span><span>${pct(a)}</span><span>${pct(b)}</span><span>${pct(c)}</span></div>`;
  const teamBtn = (t) => `<button class="mini ${t.id in state.teams ? 'on' : ''}" data-team="${t.id}" data-tname="${esc(t.name)}">${t.id in state.teams ? '✓ Suivie' : '+ Suivre'}</button>`;
  const rel = p.reliability;
  const finalHit = m.completed && state.history[m.id] ? pickHit(state.history[m.id].pick, m.home.score, m.away.score) : null;

  return `<div class="sheet-head">
      <div class="grab"></div>
      <button class="close" data-act="close" aria-label="Fermer">✕</button>
      <span class="muted small head-meta">${esc(m.leagueLabel)} · ${m.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${hhmm(m.date)}${m.venue ? ' · ' + esc(m.venue) : ''}</span>
      <div class="board">
        <div class="side">${logo(m.home, 56)}<b>${esc(m.home.name)}</b><span class="form">${formChips(d?.homeGames)}</span>${teamBtn(m.home)}</div>
        <div class="score">${started ? `<span class="big">${m.home.score ?? 0}<span class="muted">–</span>${m.away.score ?? 0}</span>${timeCell(m)}` : `<span class="big vs">${hhmm(m.date)}</span><span class="muted small">${m.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>`}</div>
        <div class="side">${logo(m.away, 56)}<b>${esc(m.away.name)}</b><span class="form">${formChips(d?.awayGames)}</span>${teamBtn(m.away)}</div>
      </div>
      ${started && m.goals.length ? `<div class="scorers"><span>${goalsFor(m.home)}</span><span></span><span>${goalsFor(m.away)}</span></div>` : ''}
      ${reds ? `<div class="scorers one small">${reds}</div>` : ''}
      ${lp ? `<div class="livep"><span class="muted small">Probabilités en direct</span><div class="probs sm"><div><b>${pct(lp.pH)}</b><span class="muted small">${esc(m.home.short)}</span></div><div><b>${pct(lp.pD)}</b><span class="muted small">Nul</span></div><div><b>${pct(lp.pA)}</b><span class="muted small">${esc(m.away.short)}</span></div></div>${probBar(lp)}</div>` : ''}
    </div>
    <div class="sheet-body">
      ${m.state === 'post' ? '' : winBox(m, p, lp)}
      ${oddsBox(m, p)}
      <section class="verdict ${finalHit == null ? '' : finalHit ? 'won' : 'lost'}">
        <div class="v-main">
          <span class="muted small">${m.state === 'pre' ? 'Notre pronostic' : 'Pronostic d’avant-match'}${finalHit == null ? '' : finalHit ? ' · validé ✓' : ' · raté ✕'}</span>
          <div class="v-line"><b class="v-code">${p.pick.code}</b><span><b>${esc(p.pick.label)}</b><br><span class="muted">${pct(p.pick.p)} de probabilité</span></span></div>
        </div>
        <div class="v-rel">
          ${tierChip(rel)}
          <span class="small">Réussite mesurée à ce niveau : <b>${pct(rel.hit)}</b></span>
          <span class="muted small">sur ${rel.n} matchs testés${p.quality === 'complète' || p.quality === 'bonne' ? '' : ' · données partielles, prudence'}</span>
        </div>
        ${p.pick.alt ? `<div class="v-alt"><span class="muted small">Plus prudent</span><b>${p.pick.alt.code}</b><span class="small">${esc(p.pick.alt.label)} · ${pct(p.pick.alt.p)}</span><span class="muted small">double chance : ${pct(rel.dc)} de réussite mesurée</span></div>` : ''}
      </section>
      <section>
        <div class="grid3 first">
          <div><span class="muted small">Buts attendus</span><b>${p.xgH.toFixed(2)} – ${p.xgA.toFixed(2)}</b></div>
          <div><span class="muted small">+ de 2,5 buts</span><b>${pct(p.over25)}</b></div>
          <div><span class="muted small">Les deux marquent</span><b>${pct(p.btts)}</b></div>
        </div>
        <h4 class="mt">Scores les plus probables</h4>
        <div class="scores">${p.scores.slice(0, 6).map((s, i) => `<span class="${i === 0 ? 'first' : ''}">${s.h}-${s.a}<em>${pct(s.p)}</em></span>`).join('')}</div>
      </section>
      ${powerBars(m)}
      <section>
        <h4>Modèle contre marché</h4>
        <div class="cmp head"><span></span><span>1</span><span>N</span><span>2</span></div>
        ${triple(p.source === 'notation' ? 'Modèle (notation)' : 'Modèle (forme)', p.model.pH, p.model.pD, p.model.pA)}
        ${p.market ? triple('Marché sans marge', p.market.pH, p.market.pD, p.market.pA) : ''}
        ${triple('Synthèse', p.pH, p.pD, p.pA, 'strong')}
        ${m.market ? `<p class="muted small">Cotes ${esc(m.provider || '')} : 1 @ ${m.market.home.toFixed(2)} · N @ ${m.market.draw.toFixed(2)} · 2 @ ${m.market.away.toFixed(2)}. Cote « juste » selon notre synthèse : ${(1 / p.pick.p).toFixed(2)} pour le ${p.pick.code}. Comparez avec Betclic.</p>` : '<p class="muted small">Pas de cotes pour ce match : prono basé sur le modèle seul, moins fiable.</p>'}
        ${p.value.length ? `<p class="small"><span class="tag val">Value</span> ${p.value.map((v) => `${v.outcome} : le modèle donne ${Math.round(v.edge * 100)} points de plus que la cote ${v.odds.toFixed(2)}`).join(', ')}.</p>` : ''}
      </section>
      <section>
        <h4>Pourquoi ce prono</h4>
        <ul class="signals">${p.signals.map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">Analyse en cours de chargement…</li>'}</ul>
      </section>
      ${d ? `<section class="two">
        <div><h4>${esc(m.home.short)}</h4>${st(d.homeStanding) ? `<p class="small">${st(d.homeStanding)}</p>` : ''}<ul class="games">${games(d.homeGames)}</ul>${leaders(m.home)}</div>
        <div><h4>${esc(m.away.short)}</h4>${st(d.awayStanding) ? `<p class="small">${st(d.awayStanding)}</p>` : ''}<ul class="games">${games(d.awayGames)}</ul>${leaders(m.away)}</div>
      </section>
      ${d.h2h.length ? `<section><h4>Face-à-face</h4><ul class="games h2h">${d.h2h.map((g) => `<li><span class="muted small">${new Date(g.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span><span>${esc(m.home.short)} <b>${g.homeGoals}-${g.awayGoals}</b> ${esc(m.away.short)}</span></li>`).join('')}</ul></section>` : ''}
      ${lineup(m.home) || lineup(m.away) ? `<section class="two"><div><h4>Onze ${esc(m.home.short)}</h4><div class="lineup">${lineup(m.home)}</div></div><div><h4>Onze ${esc(m.away.short)}</h4><div class="lineup">${lineup(m.away)}</div></div></section>` : ''}` : '<section><p class="muted small">Chargement de la forme, du classement et des face-à-face…</p></section>'}
      <section class="actions">
        <button class="btn ${state.starred.has(m.id) ? 'ghost' : ''}" data-star="${m.id}">${state.starred.has(m.id) ? '★ Match suivi' : '☆ Suivre ce match'}</button>
        ${m.link ? `<a class="btn ghost" href="${esc(m.link)}" target="_blank" rel="noopener">Fiche ESPN</a>` : ''}
      </section>
    </div>`;
}

let lastSig = '';
function render() {
  const liveN = state.matches.filter((m) => m.state === 'in' && (state.scope === 'all' || (state.scope === 'top' ? isTop(m.league) || followed(m) : followed(m)))).length;
  $('#days').innerHTML = [-1, 0, 1].map((o) => {
    const d = new Date(); d.setDate(d.getDate() + o);
    const label = o === 0 ? 'Aujourd’hui' : o === -1 ? 'Hier' : 'Demain';
    return `<button class="${o === state.offset ? 'on' : ''}" data-day="${o}">${label}<span class="small">${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span></button>`;
  }).join('');
  const tabs = [['matchs', 'Matchs', '<path d="M4 6h16M4 12h16M4 18h10"/>'], ['surs', 'Sûrs', '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'], ['bilan', 'Bilan', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'], ['reglages', 'Alertes', '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>']];
  const tabHtml = tabs.map(([k, l, icon]) => `<button class="${state.view === k ? 'on' : ''}" data-view="${k}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg><span>${l}</span></button>`).join('');
  $('#tabs').innerHTML = tabHtml;
  $('#bottom').innerHTML = tabHtml;
  $('#bell').classList.toggle('on', state.settings.notif);
  const isList = state.view === 'matchs';
  $('#filters').hidden = !isList;
  $('#days').hidden = !(isList || state.view === 'surs');
  if (isList) {
    $('#filters').innerHTML = `
      <div class="seg">${[['all', 'Tous'], ['live', `Direct${liveN ? ` <b>${liveN}</b>` : ''}`], ['next', 'À venir'], ['done', 'Finis']].map(([k, l]) => `<button class="${state.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
      <div class="seg">${[['top', 'Top'], ['all', 'Monde'], ['fav', '★']].map(([k, l]) => `<button class="${state.scope === k ? 'on' : ''}" data-scope="${k}">${l}</button>`).join('')}</div>
      <input id="q" type="search" placeholder="Rechercher une équipe" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search">`;
  }
  const main = $('#main');
  main.innerHTML = state.view === 'matchs' ? renderMatches() : state.view === 'surs' ? renderSafe() : state.view === 'bilan' ? renderBilan() : renderSettings();
  // animation d'entrée seulement quand on change d'onglet, de jour ou au premier chargement des matchs
  const sig = `${state.view}|${state.offset}|${state.updatedAt ? 1 : 0}`;
  if (sig !== lastSig) {
    const order = ['matchs', 'surs', 'bilan', 'reglages'];
    const dir = lastSig && order.indexOf(state.view) < order.indexOf(lastSig.split('|')[0]) ? 'from-left' : 'from-right';
    main.classList.remove('enter', 'from-left', 'from-right');
    void main.offsetWidth;
    main.classList.add('enter', dir);
    lastSig = sig;
  }
  setStatus(state.error ? state.error : state.updatedAt ? `${state.matches.length} matchs dans le monde · mis à jour à ${hhmm(state.updatedAt)}${state.matches.some((m) => m.state === 'in') ? ' · direct toutes les 25 s' : ''}` : 'Chargement…');
  if (state.open) {
    const m = state.matches.find((x) => x.id === state.open);
    const box = $('#sheet .sheet-in');
    if (m) { const y = box.scrollTop; box.innerHTML = renderDetail(m); box.scrollTop = y; }
  }
}

// ───────────────────────── interactions ─────────────────────────
function openMatch(id) {
  const m = state.matches.find((x) => x.id === id);
  if (!m) return;
  state.open = id;
  $('#sheet').hidden = false;
  document.body.classList.add('locked');
  const box = $('#sheet .sheet-in');
  box.innerHTML = renderDetail(m);
  box.scrollTop = 0;
  if (!state.details.has(id) || m.state !== 'pre') loadDetails(m);
  const slug = slugOf(m);
  if (slug) queueRating(slug);
  history.pushState({ sheet: id }, '');
}
function closeMatch(fromPop = false) {
  if (!state.open) return;
  state.open = null;
  $('#sheet').hidden = true;
  document.body.classList.remove('locked');
  if (!fromPop && history.state?.sheet) history.back();
}
window.addEventListener('popstate', () => closeMatch(true));

let toastTimer;
function toast(title, body, matchId) {
  const el = $('#toast');
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(body).replace(/\n/g, '<br>')}</span>`;
  el.dataset.id = matchId || '';
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => (el.hidden = true), 300); }, 7000);
}

function toggleStar(id) {
  state.starred.has(id) ? state.starred.delete(id) : state.starred.add(id);
  LS.set('starred', [...state.starred]);
  syncPush();
  const m = state.matches.find((x) => x.id === id);
  if (m && state.starred.has(id) && !state.details.has(id)) loadDetails(m, true);
  updateBadge();
  render();
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('#toast')) { const id = $('#toast').dataset.id; if (id) openMatch(id); return; }
  const t = e.target.closest('button, li.match, a');
  if (!t) { if (e.target.id === 'sheet') closeMatch(); return; }
  if (t.dataset.star) { e.stopPropagation(); toggleStar(t.dataset.star); return; }
  if (t.dataset.team) {
    const id = t.dataset.team;
    if (id in state.teams) delete state.teams[id]; else state.teams[id] = t.dataset.tname;
    LS.set('teams', state.teams); syncPush(); updateBadge(); render(); return;
  }
  if (t.dataset.unteam) { delete state.teams[t.dataset.unteam]; LS.set('teams', state.teams); syncPush(); render(); return; }
  if (t.dataset.day != null) { state.offset = Number(t.dataset.day); state.updatedAt = null; state.matches = []; render(); refresh(); return; }
  if (t.dataset.view) { state.view = t.dataset.view; if (state.view === 'reglages') checkServer(); render(); window.scrollTo(0, 0); return; }
  if (t.dataset.filter) { state.filter = t.dataset.filter; LS.set('filter', state.filter); render(); return; }
  if (t.dataset.scope) { state.scope = t.dataset.scope; LS.set('scope', state.scope); state.view = 'matchs'; render(); return; }
  if (t.dataset.id) { openMatch(t.dataset.id); return; }
  const act = t.dataset.act;
  if (act === 'close') closeMatch();
  if (act === 'notif') enableNotifications();
  if (act === 'test') notify('⚽ BUT PSG · PSG 1-0 Marseille', 'O. Dembélé 23’ · victoire PSG 78 % / nul 15 % / Marseille 7 %', 'test', { kind: 'goal' });
  if (act === 'remind') sendReminder(true);
  if (act === 'pushtest') { try { const r = await api('test', { endpoint: state.push.endpoint }); toast('Serveur', r.ok ? 'Notification de test envoyée par le serveur.' : 'Échec de l’envoi.'); } catch { toast('Serveur', 'Serveur injoignable.'); } }
  if (t.id === 'bell') { if (!state.settings.notif) enableNotifications(); else { state.view = 'reglages'; render(); } }
  if (t.id === 'refresh') refresh();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.open) closeMatch();
  if (e.key === 'Enter' && e.target.matches?.('li.match')) openMatch(e.target.dataset.id);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { state.query = e.target.value; $('#main').innerHTML = renderMatches(); }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset.set;
  if (!k) return;
  state.settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  LS.set('settings', state.settings);
  syncPush();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.updatedAt && Date.now() - state.updatedAt > 30e3) refresh({ silent: true });
});
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.open) openMatch(e.data.open); });

// ───────────────────────── démarrage ─────────────────────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
}
cleanCache();
render();
if (state.push.on) { subscribePush(); checkServer(); setInterval(checkServer, 60e3); }
refresh();
scheduleReminder();
const deep = new URLSearchParams(location.search).get('match');
if (deep) { const wait = setInterval(() => { if (state.matches.length) { clearInterval(wait); openMatch(deep); } }, 300); setTimeout(() => clearInterval(wait), 15000); }
