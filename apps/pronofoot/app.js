import { fetchDay, fetchDetails, isTop, leaguePriority } from './api.js';
import { predict, pickHit, outcomeOf } from './model.js';

// ───────────────────────── état ─────────────────────────
const LS = {
  get(k, d) { try { const v = localStorage.getItem('pf:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pf:' + k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué */ } },
};

const state = {
  offset: 0,
  matches: [],
  details: new Map(),
  filter: LS.get('filter', 'all'),
  scope: LS.get('scope', 'top'),
  query: '',
  view: 'matchs',
  starred: new Set(LS.get('starred', [])),
  settings: { notif: false, reminders: true, goals: true, kickoff: true, alertScope: 'suivis', ...LS.get('settings', {}) },
  history: LS.get('history', {}),
  prev: LS.get('prev', {}),
  updatedAt: null,
  error: null,
  open: null,
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
const hhmm = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayDate = () => { const d = new Date(); d.setDate(d.getDate() + state.offset); return d; };

// ───────────────────────── pronostics ─────────────────────────
function predictionFor(m) {
  const d = state.details.get(m.id);
  return predict({
    neutral: m.neutral,
    home: { form: m.home.form, record: m.home.record, games: d?.homeGames, standing: d?.homeStanding },
    away: { form: m.away.form, record: m.away.record, games: d?.awayGames, standing: d?.awayStanding },
    h2h: d?.h2h || [],
    market: d?.market || m.market,
    total: d?.total || m.total,
  });
}
const predCache = new Map();
function pred(m) {
  const key = m.id + ':' + (state.details.has(m.id) ? 'd' : 's');
  if (!predCache.has(key)) predCache.set(key, predictionFor(m));
  return predCache.get(key);
}

function recordHistory() {
  let changed = false;
  for (const m of state.matches) {
    const h = state.history[m.id];
    if (m.state === 'pre') {
      // On fige le dernier pronostic d'avant-match (le plus informé)
      const p = pred(m);
      const entry = {
        home: m.home.name, away: m.away.name, league: m.leagueLabel, date: m.date.toISOString(),
        pick: p.pick.code, alt: p.pick.alt?.code || null, pH: p.pH, pD: p.pD, pA: p.pA,
        conf: p.confidence, deep: state.details.has(m.id), top: isTop(m.league),
        fav: p.market ? ['1', 'N', '2'][[p.market.pH, p.market.pD, p.market.pA].indexOf(Math.max(p.market.pH, p.market.pD, p.market.pA))] : null,
      };
      if (!h || h.pick !== entry.pick || h.deep !== entry.deep || Math.abs(h.pH - entry.pH) > 0.01) {
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
    // on garde 60 jours d'historique
    const limit = Date.now() - 60 * 864e5;
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
  try {
    const matches = await fetchDay(dayDate());
    matches.sort((a, b) => a.date - b.date);
    state.matches = matches;
    state.updatedAt = new Date();
    state.error = null;
    predCache.clear();
    if (state.offset === 0) detectEvents(matches);
    recordHistory();
    render();
    enrichQueue();
  } catch (e) {
    state.error = 'Connexion impossible aux données. Nouvel essai automatique.';
    render();
  } finally {
    loading = false;
    schedule();
  }
}

let pollTimer = null;
function schedule() {
  clearTimeout(pollTimer);
  const live = state.matches.some((m) => m.state === 'in');
  const soon = state.matches.some((m) => m.state === 'pre' && m.date - Date.now() < 15 * 60e3 && m.date - Date.now() > -60 * 60e3);
  // 30 s pendant le direct, 2 min avant un coup d'envoi, sinon 10 min
  const delay = state.offset !== 0 ? 10 * 60e3 : live ? 30e3 : soon ? 120e3 : 10 * 60e3;
  pollTimer = setTimeout(() => refresh({ silent: true }), delay);
}

// Analyse approfondie en tâche de fond, par lots de 3 requêtes
const queued = new Set();
let running = 0;
function enrichQueue() {
  const targets = state.matches
    .filter((m) => m.state !== 'post' && !state.details.has(m.id) && !queued.has(m.id))
    .filter((m) => isTop(m.league) || state.starred.has(m.id))
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
  predCache.delete(m.id + ':s');
  if (background) renderSoon(); else render();
}
let renderTimer = null;
const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { recordHistory(); render(); }, 400); };

function cleanDetailCache() {
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

// ───────────────────────── notifications ─────────────────────────
const inScope = (m) => {
  if (state.starred.has(m.id)) return true;
  if (state.settings.alertScope === 'favoris') return false;
  if (state.settings.alertScope === 'tous') return true;
  return isTop(m.league);
};

async function notify(title, body, tag) {
  toast(title, body);
  if (!state.settings.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', renotify: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, opts);
  } catch { /* repli ci-dessous */ }
  try { new Notification(title, opts); } catch { /* mobile sans service worker */ }
}

function detectEvents(matches) {
  const prev = state.prev;
  const next = {};
  for (const m of matches) {
    const snap = { s: m.state, h: m.home.score ?? 0, a: m.away.score ?? 0 };
    next[m.id] = snap;
    const p = prev[m.id];
    if (!p || !inScope(m)) continue;
    const vs = `${m.home.short} ${snap.h}-${snap.a} ${m.away.short}`;
    if (p.s === 'pre' && m.state === 'in' && state.settings.kickoff) {
      const pr = pred(m);
      notify('Coup d’envoi', `${m.home.name} – ${m.away.name} · Prono : ${pr.pick.code} (${pct(Math.max(pr.pH, pr.pD, pr.pA))})`, 'ko-' + m.id);
    }
    if (state.settings.goals && (snap.h > p.h || snap.a > p.a)) {
      const scorerTeam = snap.h > p.h ? m.home : m.away;
      const last = [...m.goals].reverse().find((g) => g.teamId === scorerTeam.id);
      const who = last ? ` · ${last.player}${last.penalty ? ' (sp)' : ''}${last.own ? ' (csc)' : ''} ${last.minute}` : m.clock ? ` · ${m.clock}` : '';
      notify(`But pour ${scorerTeam.name}`, `${vs}${who}`, 'goal-' + m.id);
    }
    if (p.s === 'in' && m.state === 'post' && m.completed) {
      const h = state.history[m.id];
      const verdict = h ? (pickHit(h.pick, snap.h, snap.a) ? ' · Prono validé' : ' · Prono raté') : '';
      notify('Fin du match', `${vs}${verdict}`, 'ft-' + m.id);
    }
  }
  state.prev = next;
  LS.set('prev', next);
}

// Rappel des prochains matchs toutes les 30 minutes (à :00 et :30)
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
  if (!state.settings.reminders && !force) return;
  if (state.offset !== 0 && !force) return;
  const now = Date.now();
  const upcoming = state.matches
    .filter((m) => m.state === 'pre' && m.date - now > 0 && m.date - now < 3 * 3600e3 && inScope(m))
    .sort((a, b) => a.date - b.date);
  if (!upcoming.length) { if (force) toast('Rappel', 'Aucun match suivi dans les 3 prochaines heures.'); return; }
  const lines = upcoming.slice(0, 4).map((m) => {
    const p = pred(m);
    return `${hhmm(m.date)} ${m.home.short} – ${m.away.short} → ${p.pick.code}`;
  });
  const more = upcoming.length > 4 ? ` (+${upcoming.length - 4})` : '';
  notify(`${upcoming.length} match${upcoming.length > 1 ? 's' : ''} dans les 3 h${more}`, lines.join('\n'), 'reminder');
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('Notifications', 'Ce navigateur ne gère pas les notifications. Sur iPhone : Partager → « Sur l’écran d’accueil », puis rouvrez l’app.');
    return false;
  }
  const perm = await Notification.requestPermission();
  state.settings.notif = perm === 'granted';
  LS.set('settings', state.settings);
  if (perm === 'granted') notify('Notifications activées', 'Buts en direct, coups d’envoi et rappel toutes les 30 minutes.', 'welcome');
  else toast('Notifications', 'Autorisation refusée dans le navigateur.');
  render();
  return perm === 'granted';
}

// ───────────────────────── rendu ─────────────────────────
function setStatus(t) { const el = $('#status'); if (el) el.textContent = t; }

function visibleMatches() {
  const q = state.query.trim().toLowerCase();
  return state.matches.filter((m) => {
    if (state.scope === 'top' && !isTop(m.league) && !state.starred.has(m.id)) return false;
    if (state.scope === 'fav' && !state.starred.has(m.id)) return false;
    if (state.filter === 'live' && m.state !== 'in') return false;
    if (state.filter === 'next' && m.state !== 'pre') return false;
    if (state.filter === 'done' && m.state !== 'post') return false;
    if (q && !`${m.home.name} ${m.away.name} ${m.leagueLabel}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function logo(t, size = 22) {
  return t.logo
    ? `<img class="logo" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.style.visibility='hidden'">`
    : `<span class="logo ph" style="width:${size}px;height:${size}px"></span>`;
}

function timeCell(m) {
  if (m.state === 'in') return `<span class="live"><i></i>${esc(m.clock || 'Live')}</span>`;
  if (m.state === 'post') return `<span class="muted">${m.completed ? 'Terminé' : esc(m.statusShort)}</span>`;
  return `<span>${hhmm(m.date)}</span>`;
}

function probBar(p) {
  return `<div class="bar" title="1 ${pct(p.pH)} · N ${pct(p.pD)} · 2 ${pct(p.pA)}">
    <span style="flex:${p.pH}" class="b1"></span><span style="flex:${p.pD}" class="bn"></span><span style="flex:${p.pA}" class="b2"></span>
  </div>`;
}

function verdict(m) {
  const h = state.history[m.id];
  if (!h || m.state !== 'post' || m.home.score == null) return '';
  const ok = pickHit(h.pick, m.home.score, m.away.score);
  return `<span class="tag ${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✕'}</span>`;
}

function row(m) {
  const p = pred(m);
  const showScore = m.state !== 'pre';
  const top = Math.max(p.pH, p.pD, p.pA);
  const star = state.starred.has(m.id);
  return `<li class="match ${m.state}" data-id="${m.id}">
    <div class="t">${timeCell(m)}</div>
    <div class="teams">
      <div class="team ${m.state === 'post' && m.home.winner ? 'win' : ''}">${logo(m.home)}<span>${esc(m.home.name)}</span>${showScore ? `<b>${m.home.score ?? ''}</b>` : ''}</div>
      <div class="team ${m.state === 'post' && m.away.winner ? 'win' : ''}">${logo(m.away)}<span>${esc(m.away.name)}</span>${showScore ? `<b>${m.away.score ?? ''}</b>` : ''}</div>
    </div>
    <div class="pr">
      <div class="pick"><span class="code">${p.pick.code}</span><span class="muted">${pct(top)}</span>${p.value.length ? '<span class="tag val">Value</span>' : ''}${verdict(m)}</div>
      ${probBar(p)}
    </div>
    <button class="star ${star ? 'on' : ''}" data-star="${m.id}" aria-label="${star ? 'Ne plus suivre' : 'Suivre'} ce match">${star ? '★' : '☆'}</button>
  </li>`;
}

function highlights() {
  if (state.filter === 'done' || state.filter === 'live') return '';
  const pre = visibleMatches().filter((m) => m.state === 'pre' && (m.market || state.details.has(m.id)));
  if (!pre.length) return '';
  const best = [...pre].sort((a, b) => pred(b).confidence - pred(a).confidence).slice(0, 3);
  const values = pre.filter((m) => pred(m).value.length).slice(0, 3);
  const card = (m, extra = '') => {
    const p = pred(m);
    return `<button class="hl" data-id="${m.id}">
      <span class="muted small">${hhmm(m.date)} · ${esc(m.leagueLabel)}</span>
      <span class="hl-teams">${esc(m.home.short)} – ${esc(m.away.short)}</span>
      <span class="hl-pick"><b>${p.pick.code}</b> ${esc(p.pick.label)} <span class="muted">${pct(p.pick.p)}</span>${extra}</span>
    </button>`;
  };
  return `<section class="hls">
    <h2>Les plus sûrs</h2><div class="hl-row">${best.map((m) => card(m)).join('')}</div>
    ${values.length ? `<h2>Value bets <span class="muted small">modèle au-dessus du marché</span></h2><div class="hl-row">${values.map((m) => { const v = pred(m).value[0]; return card(m, ` <span class="tag val">${v.outcome} @ ${v.odds.toFixed(2)}</span>`); }).join('')}</div>` : ''}
  </section>`;
}

function renderMatches() {
  const list = visibleMatches();
  if (state.error && !state.matches.length) return `<p class="empty">${esc(state.error)}</p>`;
  if (!state.updatedAt) return `<div class="skeleton">${'<div></div>'.repeat(8)}</div>`;
  if (!list.length) return `<p class="empty">Aucun match pour ce filtre.${state.scope === 'top' ? ' <button class="link" data-scope="all">Voir le monde entier</button>' : ''}</p>`;
  const groups = new Map();
  for (const m of list) {
    if (!groups.has(m.league)) groups.set(m.league, []);
    groups.get(m.league).push(m);
  }
  const ordered = [...groups.entries()].sort((a, b) => leaguePriority(a[0]) - leaguePriority(b[0]) || a[1][0].date - b[1][0].date);
  return highlights() + ordered.map(([, ms]) => `<section class="league">
      <h3>${esc(ms[0].leagueLabel)}<span class="muted">${ms.length}</span></h3>
      <ul>${ms.map(row).join('')}</ul>
    </section>`).join('');
}

function renderBilan() {
  const all = Object.entries(state.history).map(([id, h]) => ({ id, ...h })).filter((h) => h.result);
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!all.length) {
    return `<div class="bilan"><p class="empty">Le bilan se remplit tout seul : chaque prono est figé avant le coup d’envoi puis comparé au score final. Revenez après les premiers matchs terminés.</p></div>`;
  }
  const rate = (arr, f = (h) => pickHit(h.pick, ...h.result.split('-').map(Number))) => (arr.length ? arr.filter(f).length / arr.length : null);
  const strong = all.filter((h) => h.conf >= 55);
  const withFav = all.filter((h) => h.fav);
  const dbl = all.filter((h) => h.alt);
  const stat = (label, v, n, sub = '') => `<div class="kpi"><span class="muted small">${label}</span><b>${v == null ? '–' : pct(v)}</b><span class="muted small">${n} match${n > 1 ? 's' : ''}${sub}</span></div>`;
  return `<div class="bilan">
    <div class="kpis">
      ${stat('Réussite 1N2', rate(all), all.length)}
      ${stat('Confiance ≥ 55', rate(strong), strong.length)}
      ${stat('Double chance', rate(dbl, (h) => pickHit(h.alt, ...h.result.split('-').map(Number))), dbl.length, ' (pronos serrés)')}
      ${stat('Favori du marché', rate(withFav, (h) => h.fav === h.outcome), withFav.length, ' (référence)')}
    </div>
    <p class="note">Repère honnête : en football, même les meilleurs modèles professionnels tournent autour de 50 à 55 % de réussite sur le 1N2. Aucun outil ne peut garantir 100 % : le hasard (un poteau, un carton rouge) pèse trop lourd sur un seul match.</p>
    <ul class="hist">${all.slice(0, 150).map((h) => {
      const [hs, as] = h.result.split('-').map(Number);
      const ok = pickHit(h.pick, hs, as);
      return `<li><span class="tag ${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✕'}</span>
        <span class="h-m"><span>${esc(h.home)} <b>${h.result}</b> ${esc(h.away)}</span><span class="muted small">${new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${esc(h.league)}</span></span>
        <span class="h-p">${h.pick} <span class="muted">${h.conf}</span></span></li>`;
    }).join('')}</ul>
  </div>`;
}

function renderSettings() {
  const s = state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const tog = (k, label, sub) => `<label class="set"><span><b>${label}</b><span class="muted small">${sub}</span></span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
  return `<div class="settings">
    <div class="set"><span><b>Notifications</b><span class="muted small">${perm === 'granted' && s.notif ? 'Activées sur cet appareil' : perm === 'denied' ? 'Bloquées dans les réglages du navigateur' : perm === 'unsupported' ? 'Installez l’app sur l’écran d’accueil pour les recevoir' : 'Désactivées'}</span></span>
      ${perm === 'granted' && s.notif ? '<button class="btn ghost" data-act="test">Tester</button>' : '<button class="btn" data-act="notif">Activer</button>'}</div>
    ${tog('goals', 'Buts en temps réel', 'Une alerte à chaque but, avec le buteur et la minute')}
    ${tog('kickoff', 'Coups d’envoi et fins de match', 'Avec le prono et le verdict')}
    ${tog('reminders', 'Rappel toutes les 30 minutes', 'Les matchs suivis des 3 prochaines heures')}
    <div class="set"><span><b>Matchs concernés</b><span class="muted small">Pour toutes les alertes</span></span>
      <select data-set="alertScope">
        <option value="suivis" ${s.alertScope === 'suivis' ? 'selected' : ''}>Grands championnats + suivis</option>
        <option value="favoris" ${s.alertScope === 'favoris' ? 'selected' : ''}>Seulement mes matchs ★</option>
        <option value="tous" ${s.alertScope === 'tous' ? 'selected' : ''}>Tous les matchs du monde</option>
      </select></div>
    <div class="set"><span><b>Rappel maintenant</b><span class="muted small">Aperçu du prochain rappel</span></span><button class="btn ghost" data-act="remind">Envoyer</button></div>
    <p class="note">Les alertes partent tant que l’app est ouverte (onglet ou app installée en arrière-plan). Données : ESPN, actualisées toutes les 30 s pendant les matchs en direct. Pronostics à titre informatif : pariez de façon responsable, jamais plus que ce que vous pouvez perdre. Joueurs Info Service : 09 74 75 13 13.</p>
  </div>`;
}

function formChips(games) {
  return games.map((g) => {
    const r = g.gf > g.ga ? 'W' : g.gf === g.ga ? 'D' : 'L';
    return `<span class="fc ${r}" title="${esc((g.home ? 'vs ' : '@ ') + g.opponent)} ${g.gf}-${g.ga}">${{ W: 'V', D: 'N', L: 'D' }[r]}</span>`;
  }).join('');
}

function renderDetail(m) {
  const d = state.details.get(m.id);
  const p = pred(m);
  const live = m.state !== 'pre';
  const goalsFor = (t) => m.goals.filter((g) => g.teamId === t.id).map((g) => `${esc(g.player)} ${esc(g.minute)}${g.penalty ? ' (sp)' : ''}${g.own ? ' (csc)' : ''}`).join(' · ');
  const reds = m.reds.map((r) => `<span class="red"></span>${esc(r.player)} ${esc(r.minute)}`).join(' · ');
  const games = (list) => (list || []).map((g) => `<li><span class="fc ${g.gf > g.ga ? 'W' : g.gf === g.ga ? 'D' : 'L'}"></span><span class="muted small">${new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>${g.home ? 'vs' : '@'} ${esc(g.opponent)}</span><b>${g.gf}-${g.ga}</b></li>`).join('');
  const st = (s) => (s ? `${s.rank}e · ${s.pts} pts · ${s.w}V ${s.d}N ${s.l}D · ${s.gd > 0 ? '+' : ''}${s.gd}` : '–');
  const leaders = (t) => (d?.leaders?.[t.id] || []).slice(0, 2).map((c) => `<div class="small"><span class="muted">${esc(c.category === 'Goals' ? 'Buteurs' : c.category === 'Assists' ? 'Passeurs' : c.category)}</span> ${c.players.map((x) => esc(x.name)).join(', ')}</div>`).join('');
  const lineup = (t) => (d?.lineups?.[t.id] || []).map((x) => `<span>${esc(x.jersey || '')} ${esc(x.name)}</span>`).join('');
  const triple = (label, a, b, c) => `<div class="cmp"><span class="muted small">${label}</span><span>${pct(a)}</span><span>${pct(b)}</span><span>${pct(c)}</span></div>`;

  return `<div class="sheet-head">
      <button class="close" data-act="close" aria-label="Fermer">✕</button>
      <span class="muted small">${esc(m.leagueLabel)} · ${m.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${hhmm(m.date)}${m.venue ? ' · ' + esc(m.venue) : ''}</span>
      <div class="board">
        <div class="side">${logo(m.home, 56)}<b>${esc(m.home.name)}</b><span class="muted small">${formChips(d?.homeGames || [])}</span></div>
        <div class="score">${live ? `<span class="big">${m.home.score ?? 0} – ${m.away.score ?? 0}</span>${timeCell(m)}` : `<span class="big vs">${hhmm(m.date)}</span>`}</div>
        <div class="side">${logo(m.away, 56)}<b>${esc(m.away.name)}</b><span class="muted small">${formChips(d?.awayGames || [])}</span></div>
      </div>
      ${live && (m.goals.length || m.reds.length) ? `<div class="scorers"><span>${goalsFor(m.home)}</span><span>${goalsFor(m.away)}</span></div>${reds ? `<div class="scorers small">${reds}</div>` : ''}` : ''}
    </div>
    <div class="sheet-body">
      <section class="verdict">
        <div class="v-main"><span class="muted small">Pronostic</span><b class="v-code">${p.pick.code}</b><span>${esc(p.pick.label)}</span></div>
        <div class="v-side"><span class="muted small">Confiance</span><b>${p.confidence}</b><span class="muted small">/ 100</span></div>
        ${p.pick.alt ? `<div class="v-side"><span class="muted small">Double chance</span><b>${p.pick.alt.code}</b><span class="muted small">${pct(p.pick.alt.p)}</span></div>` : ''}
        <div class="v-side"><span class="muted small">Score probable</span><b>${p.scores[0].h}-${p.scores[0].a}</b><span class="muted small">${pct(p.scores[0].p)}</span></div>
      </section>
      <section>
        <div class="probs">
          <div><span class="muted small">1 · ${esc(m.home.short)}</span><b>${pct(p.pH)}</b></div>
          <div><span class="muted small">N · Nul</span><b>${pct(p.pD)}</b></div>
          <div><span class="muted small">2 · ${esc(m.away.short)}</span><b>${pct(p.pA)}</b></div>
        </div>
        ${probBar(p)}
        <div class="grid3">
          <div><span class="muted small">Buts attendus</span><b>${p.xgH.toFixed(2)} – ${p.xgA.toFixed(2)}</b></div>
          <div><span class="muted small">Plus de 2,5 buts</span><b>${pct(p.over25)}</b></div>
          <div><span class="muted small">Les deux marquent</span><b>${pct(p.btts)}</b></div>
        </div>
        <div class="scores">${p.scores.slice(0, 5).map((s) => `<span>${s.h}-${s.a} <span class="muted">${pct(s.p)}</span></span>`).join('')}</div>
      </section>
      <section>
        <h4>Modèle contre marché</h4>
        <div class="cmp head"><span></span><span>1</span><span>N</span><span>2</span></div>
        ${triple('Modèle statistique', p.model.pH, p.model.pD, p.model.pA)}
        ${p.market ? triple('Marché (sans marge)', p.market.pH, p.market.pD, p.market.pA) : ''}
        ${triple('Synthèse', p.pH, p.pD, p.pA)}
        ${m.market ? `<p class="muted small">Cotes de référence ${esc(m.provider || '')} : 1 @ ${m.market.home.toFixed(2)} · N @ ${m.market.draw.toFixed(2)} · 2 @ ${m.market.away.toFixed(2)}. Comparez avec Betclic avant de jouer.</p>` : ''}
        ${p.value.length ? `<p class="small"><span class="tag val">Value</span> Le modèle voit ${p.value.map((v) => `${v.outcome} plus probable que la cote ${v.odds.toFixed(2)} ne l’indique (+${Math.round(v.edge * 100)} pts)`).join(', ')}.</p>` : ''}
      </section>
      <section>
        <h4>Pourquoi ce prono</h4>
        <ul class="signals">${p.signals.map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">Analyse basée sur la forme récente et les cotes. Détails en cours de chargement…</li>'}</ul>
        <p class="muted small">Fiabilité des données : ${Math.round(p.coverage * 100)} %${d ? '' : ' · analyse approfondie en cours'}</p>
      </section>
      ${d ? `<section class="two">
        <div><h4>${esc(m.home.short)}</h4><p class="small">${st(d.homeStanding)}</p><ul class="games">${games(d.homeGames)}</ul>${leaders(m.home)}</div>
        <div><h4>${esc(m.away.short)}</h4><p class="small">${st(d.awayStanding)}</p><ul class="games">${games(d.awayGames)}</ul>${leaders(m.away)}</div>
      </section>
      ${d.h2h.length ? `<section><h4>Face-à-face</h4><ul class="games">${d.h2h.map((g) => `<li><span class="muted small">${new Date(g.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span><span>${esc(m.home.short)} ${g.homeGoals}-${g.awayGoals} ${esc(m.away.short)}</span></li>`).join('')}</ul></section>` : ''}
      ${lineup(m.home) || lineup(m.away) ? `<section class="two"><div><h4>Onze ${esc(m.home.short)}</h4><div class="lineup">${lineup(m.home)}</div></div><div><h4>Onze ${esc(m.away.short)}</h4><div class="lineup">${lineup(m.away)}</div></div></section>` : ''}` : ''}
      <section class="actions">
        <button class="btn ${state.starred.has(m.id) ? 'ghost' : ''}" data-star="${m.id}">${state.starred.has(m.id) ? '★ Suivi' : '☆ Suivre ce match'}</button>
        ${m.link ? `<a class="btn ghost" href="${esc(m.link)}" target="_blank" rel="noopener">Fiche complète</a>` : ''}
      </section>
    </div>`;
}

function render() {
  const day = dayDate();
  const live = state.matches.filter((m) => m.state === 'in').length;
  $('#days').innerHTML = [-1, 0, 1].map((o) => {
    const d = new Date(); d.setDate(d.getDate() + o);
    const label = o === 0 ? 'Aujourd’hui' : o === -1 ? 'Hier' : 'Demain';
    return `<button class="${o === state.offset ? 'on' : ''}" data-day="${o}">${label}<span class="muted small">${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></button>`;
  }).join('');
  $('#tabs').innerHTML = [['matchs', 'Matchs'], ['bilan', 'Bilan'], ['reglages', 'Alertes']].map(([k, l]) => `<button class="${state.view === k ? 'on' : ''}" data-view="${k}">${l}</button>`).join('');
  $('#bell').classList.toggle('on', state.settings.notif);
  $('#filters').hidden = state.view !== 'matchs';
  $('#days').hidden = state.view !== 'matchs';
  $('#filters').innerHTML = `
    <div class="seg">${[['all', 'Tous'], ['live', `Direct${live ? ` <b>${live}</b>` : ''}`], ['next', 'À venir'], ['done', 'Terminés']].map(([k, l]) => `<button class="${state.filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>
    <div class="seg">${[['top', 'Top ligues'], ['all', 'Monde'], ['fav', '★']].map(([k, l]) => `<button class="${state.scope === k ? 'on' : ''}" data-scope="${k}">${l}</button>`).join('')}</div>
    <input id="q" type="search" placeholder="Équipe, championnat…" value="${esc(state.query)}" autocomplete="off">`;
  const main = $('#main');
  main.innerHTML = state.view === 'matchs' ? renderMatches() : state.view === 'bilan' ? renderBilan() : renderSettings();
  const n = state.matches.length;
  setStatus(state.error ? state.error : state.updatedAt ? `${n} matchs · ${day.toLocaleDateString('fr-FR', { weekday: 'long' })} · mis à jour ${hhmm(state.updatedAt)}${live ? ' · direct 30 s' : ''}` : 'Chargement…');
  if (state.open) {
    const m = state.matches.find((x) => x.id === state.open);
    if (m) { $('#sheet .sheet-in').innerHTML = renderDetail(m); }
  }
}

// ───────────────────────── interactions ─────────────────────────
function openMatch(id) {
  const m = state.matches.find((x) => x.id === id);
  if (!m) return;
  state.open = id;
  $('#sheet').hidden = false;
  document.body.classList.add('locked');
  $('#sheet .sheet-in').innerHTML = renderDetail(m);
  $('#sheet .sheet-in').scrollTop = 0;
  if (!state.details.has(id) || m.state !== 'pre') loadDetails(m);
}
function closeMatch() {
  state.open = null;
  $('#sheet').hidden = true;
  document.body.classList.remove('locked');
}

let toastTimer;
function toast(title, body) {
  const el = $('#toast');
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(body).replace(/\n/g, '<br>')}</span>`;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => (el.hidden = true), 300); }, 6000);
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, li.match, a');
  if (!t) { if (e.target.id === 'sheet') closeMatch(); return; }
  if (t.dataset.star) {
    e.stopPropagation();
    const id = t.dataset.star;
    state.starred.has(id) ? state.starred.delete(id) : state.starred.add(id);
    LS.set('starred', [...state.starred]);
    const m = state.matches.find((x) => x.id === id);
    if (m && state.starred.has(id) && !state.details.has(id)) loadDetails(m, true);
    render();
    return;
  }
  if (t.dataset.day != null) { state.offset = Number(t.dataset.day); state.updatedAt = null; state.matches = []; render(); refresh(); return; }
  if (t.dataset.view) { state.view = t.dataset.view; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.filter) { state.filter = t.dataset.filter; LS.set('filter', state.filter); render(); return; }
  if (t.dataset.scope) { state.scope = t.dataset.scope; LS.set('scope', state.scope); render(); return; }
  if (t.dataset.id) { openMatch(t.dataset.id); return; }
  const act = t.dataset.act;
  if (act === 'close') closeMatch();
  if (act === 'notif') enableNotifications();
  if (act === 'test') notify('But pour Paris SG', 'PSG 1-0 Marseille · Exemple de notification 23’', 'test');
  if (act === 'remind') sendReminder(true);
  if (t.id === 'bell') { if (!state.settings.notif) enableNotifications(); else { state.view = 'reglages'; render(); } }
  if (t.id === 'refresh') refresh();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'q') {
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    $('#main').innerHTML = renderMatches();
    const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset.set;
  if (!k) return;
  state.settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  LS.set('settings', state.settings);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) closeMatch(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.updatedAt && Date.now() - state.updatedAt > 60e3) refresh({ silent: true });
});

// ───────────────────────── démarrage ─────────────────────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
cleanDetailCache();
render();
refresh();
scheduleReminder();
