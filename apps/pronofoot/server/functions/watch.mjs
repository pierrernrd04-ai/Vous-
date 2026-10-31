// Surveillance des matchs, lancée chaque minute par Netlify.
// Pendant les matchs suivis, elle relit les scores toutes les 8 s pendant ~25 s
// (limite de 30 s des fonctions planifiées), soit 4 vérifications par minute.
import { fetchDay } from '../../api.js';
import { store, loadSubs, push } from '../lib/store.mjs';
import { detectEvents, snapshot, quickPrediction, wants, prematchFor, digestFor, needsFastPolling } from '../lib/engine.mjs';

const BUDGET_MS = 24e3, STEP_MS = 8e3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMatches(now = new Date()) {
  const days = [now];
  if (now.getUTCHours() < 7) days.push(new Date(now.getTime() - 864e5)); // fin de soirée sur le continent américain
  const lists = await Promise.all(days.map((d) => fetchDay(d).catch(() => [])));
  const byId = new Map();
  lists.flat().forEach((m) => byId.set(m.id, m));
  return [...byId.values()];
}

function parisSlot(now = new Date()) {
  const [h, m] = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).split(':').map(Number);
  return m === 0 || m === 30 ? `${now.toISOString().slice(0, 10)}T${h}:${m}` : null;
}

export async function tick({ first, s, subs, state, now = Date.now(), send = push }) {
  const matches = await fetchMatches(new Date(now));
  if (!matches.length) return { matches, fast: false, sent: 0 };
  for (const m of matches) if (m.state === 'pre') state.picks[m.id] = { c: quickPrediction(m).pick.code, t: now };
  const events = detectEvents(state.snap, matches, Object.fromEntries(Object.entries(state.picks).map(([k, v]) => [k, v.c])));
  state.snap = Object.fromEntries(matches.map((m) => [m.id, snapshot(m)]));
  const jobs = [];
  for (const ev of events) {
    if (state.sent[ev.key]) continue;
    state.sent[ev.key] = now;
    for (const sub of subs) if (wants(sub.prefs || {}, ev)) jobs.push(send(sub, { title: ev.title, body: ev.body, tag: `${ev.type}-${ev.matchId}`, url: ev.url, matchId: ev.matchId }, { urgent: ev.urgent }, s));
  }
  if (first) {
    for (const sub of subs) {
      for (const ev of prematchFor(sub.prefs || {}, matches, now)) {
        const k = `${ev.key}:${sub.key}`;
        if (state.sent[k] || (sub.prefs || {}).prematch === false) continue;
        state.sent[k] = now;
        jobs.push(send(sub, { title: ev.title, body: ev.body, tag: ev.key, url: ev.url, matchId: ev.matchId }, {}, s));
      }
    }
    const slot = parisSlot(new Date(now));
    if (slot && state.digestSlot !== slot) {
      state.digestSlot = slot;
      for (const sub of subs) {
        const d = digestFor(sub.prefs || {}, matches, now);
        if (d) jobs.push(send(sub, { title: d.title, body: d.body, tag: 'digest', url: d.url }, { topic: 'digest' }, s));
      }
    }
  }
  const results = await Promise.all(jobs);
  return { matches, fast: needsFastPolling(matches, subs.map((x) => x.prefs || {}), now), sent: results.filter(Boolean).length };
}

export default async () => {
  const start = Date.now();
  const s = store();
  const subs = await loadSubs(s);
  const state = { snap: {}, sent: {}, picks: {}, digestSlot: null, ...(await s.get('state', { type: 'json' })) };
  let sent = 0, polls = 0, fast = false;
  if (subs.length) {
    for (let i = 0; ; i++) {
      const r = await tick({ first: i === 0, s, subs, state });
      sent += r.sent; polls++; fast = r.fast;
      await s.setJSON('state', state);
      if (!fast || Date.now() - start + STEP_MS > BUDGET_MS) break;
      await sleep(Math.max(0, start + (i + 1) * STEP_MS - Date.now()));
    }
    // ménage : on garde 2 jours d'historique d'envois et de pronos
    const old = Date.now() - 2 * 864e5;
    for (const [k, t] of Object.entries(state.sent)) if (t < old) delete state.sent[k];
    for (const [k, v] of Object.entries(state.picks)) if (v.t < old) delete state.picks[k];
    await s.setJSON('state', state);
  }
  await s.setJSON('heartbeat', { at: Date.now(), polls, fast, sent, subscribers: subs.length, ms: Date.now() - start });
};

export const config = { schedule: '* * * * *' };
