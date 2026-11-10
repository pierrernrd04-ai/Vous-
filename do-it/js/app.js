// Do It · De l’oral à l’écrit
// Tu parles, Do It écrit : dictée, réécriture par l’IA, journal classé par thème.
import { THEMES, MOODS, getTheme, getMood, resolveTheme, fold, slugify, hueFor } from './themes.js';
import { Dictation, isSpeechSupported, startLevelMeter, isMobile } from './speech.js';
import * as store from './store.js';
import { writeEntry, aiStatus, REASONS, isRetryable } from './ai.js';
import {
  dayKey, addDays, dayLabel, longDate, todayLabel, timeLabel, ago, clock, greeting, momentLabel,
  wordCount, plural, esc, attr, typo, paragraphs, uid,
} from './format.js';
import { QUOTES, quoteAt, promptIdeas, WRITING_STEPS } from './quotes.js';
import { toMarkdown, toBackup, parseBackup, download } from './export.js';
import { ICONS } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const DEFAULT_SETTINGS = { name: '', style: 'professionnel', appearance: 'light', accessCode: '', onboarded: false };
const STYLE_OPTIONS = [['professionnel', 'Pro'], ['recit', 'Récit'], ['synthese', 'Synthèse']];
const APPEARANCE_OPTIONS = [['auto', 'Auto'], ['dark', 'Sombre'], ['light', 'Clair']];
const VIEWS = ['parler', 'journal', 'themes', 'bilan'];
const MAX_RECORDING_S = 20 * 60;

const LOGO_MARK = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lm" gradientUnits="userSpaceOnUse" x1="6" y1="12" x2="44" y2="36"><stop offset="0" stop-color="#ff2d95"/><stop offset=".55" stop-color="#1fa2ff"/><stop offset="1" stop-color="#3ee39d"/></linearGradient></defs><g fill="none" stroke="url(#lm)" stroke-width="4.2" stroke-linecap="round"><path class="logo-bar" d="M8 20v8"/><path class="logo-bar" d="M15 14v20"/><path class="logo-bar" d="M22 18v12"/><path d="M28 24c3-7 6-7 7 0s4 7 6 0"/></g><circle cx="42.5" cy="31" r="2.2" fill="#7d1533"/></svg>`;
const CONFETTI_COLORS = ['#ff2d95', '#1fa2ff', '#3ee39d', '#7d1533', '#ff7ab9', '#8fe9ff'];

const state = {
  entries: [], // du plus récent au plus ancien
  customThemes: [],
  settings: { ...DEFAULT_SETTINGS },
  ai: null,
  filter: 'all',
  query: '',
  processing: new Set(),
  revealId: null,
  quoteIndex: Math.floor(Math.random() * QUOTES.length),
  ideaSeed: Math.floor(Math.random() * 100),
  installPrompt: null,
  rec: {
    status: 'idle', // idle | listening | finalizing | processing
    dictation: null,
    startedAt: 0,
    replyTo: null,
    question: null,
    timer: 0,
    stopMeter: null,
    wakeLock: null,
    level: 0,
    target: 0,
    raf: 0,
    history: [],
  },
};

/* ───────────── Données ───────────── */

const sortEntries = (list) => list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const findEntry = (id) => state.entries.find((e) => e.id === id);

async function persistEntry(entry) {
  entry.updatedAt = new Date().toISOString();
  await store.saveEntry(structuredClone(entry));
}

async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await store.setValue('settings', { ...state.settings });
}

async function saveCustomThemes() {
  await store.setValue('customThemes', state.customThemes);
}

function newEntry(segment) {
  const now = new Date().toISOString();
  return {
    id: uid(), createdAt: now, updatedAt: now, segments: [segment],
    title: '', text: '', summary: '', highlights: [], themes: [], mood: 'neutre', followUp: '',
    source: null, reason: null, pending: false, edited: false, style: state.settings.style,
  };
}

function themeCounts(entries = state.entries) {
  const map = new Map();
  for (const e of entries) {
    for (const id of e.themes || []) {
      const cur = map.get(id) || { count: 0, last: e.createdAt };
      cur.count += 1;
      if (e.createdAt > cur.last) cur.last = e.createdAt;
      map.set(id, cur);
    }
  }
  return map;
}

/** [id, { count, last }] du thème le plus fréquent au moins fréquent, puis du plus récent. */
function sortedThemeCounts() {
  return [...themeCounts()].sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last));
}

function streakInfo() {
  const days = new Set(state.entries.map((e) => dayKey(e.createdAt)));
  const today = days.has(dayKey(new Date()));
  let d = today ? new Date() : addDays(new Date(), -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n += 1;
    d = addDays(d, -1);
  }
  return { n, today };
}

function rawText(e) {
  return (e.segments || []).map((s) => s.text).join(' ');
}

/* ───────────── Écriture par l’IA ───────────── */

function applyResult(entry, res) {
  const ids = [];
  let themesChanged = false;
  for (const proposal of res.entry.themes || []) {
    const r = resolveTheme(proposal, state.customThemes);
    if (!r) continue;
    if (r.isNew) {
      state.customThemes.push(r.theme);
      themesChanged = true;
    }
    if (!ids.includes(r.id)) ids.push(r.id);
  }
  if (themesChanged) saveCustomThemes();
  Object.assign(entry, {
    title: res.entry.title,
    text: res.entry.text,
    summary: res.entry.summary,
    highlights: res.entry.highlights || [],
    themes: ids.length ? ids : ['quotidien'],
    mood: res.entry.mood,
    followUp: res.entry.followUp,
    source: res.source,
    reason: res.reason || null,
    pending: res.source === 'local' && isRetryable(res.reason),
    edited: false,
    style: state.settings.style,
  });
}

async function processEntry(entry, { foreground = false, silent = false, isNew = false } = {}) {
  if (state.processing.has(entry.id)) return null;
  state.processing.add(entry.id);
  if (foreground) setStage('processing');
  renderEntryViews();

  const res = await writeEntry({
    segments: entry.segments,
    style: state.settings.style,
    customThemes: state.customThemes,
    accessCode: state.settings.accessCode,
    when: momentLabel(new Date(entry.segments.at(-1)?.at || entry.createdAt)),
  });

  state.processing.delete(entry.id);
  // L’entrée a pu être supprimée pendant l’écriture.
  if (!findEntry(entry.id)) return null;
  applyResult(entry, res);
  await persistEntry(entry);

  if (foreground) {
    state.revealId = entry.id;
    setStage('idle');
  }
  renderAll();
  if (foreground) {
    requestAnimationFrame(() => {
      const card = $(`#feed [data-entry="${entry.id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => burst(card || $('#orb'), isNew ? 34 : 20), 450);
    });
    setTimeout(() => {
      if (state.revealId === entry.id) state.revealId = null;
    }, 2500);
  }
  if (res.source === 'local' && !silent) {
    const shown = res.reason === 'network' && navigator.onLine !== false && !state.ai ? 'ai_unavailable' : res.reason;
    toast(REASONS[shown] || REASONS.upstream, 'warn');
  }
  if (res.reason === 'code') refreshAiStatus();
  if (foreground && isNew) celebrate();
  return res;
}

let retrying = false;
async function retryPending() {
  if (retrying || navigator.onLine === false || !state.ai?.ai || (state.ai.needsCode && !state.ai.authorized)) return;
  const todo = state.entries.filter((e) => e.pending && !e.edited && !state.processing.has(e.id));
  if (!todo.length) return;
  retrying = true;
  let done = 0;
  for (const entry of todo) {
    const res = await processEntry(entry, { silent: true });
    if (res?.source === 'ai') done += 1;
    else break;
  }
  retrying = false;
  if (done) toast(`✨ ${plural(done, 'entrée sublimée', 'entrées sublimées')} par l’IA`);
}

async function refreshAiStatus() {
  state.ai = await aiStatus(state.settings.accessCode);
  renderAiStatus();
  return state.ai;
}

/* ───────────── Enregistrement ───────────── */

function setStage(status) {
  state.rec.status = status;
  const stage = $('#stage');
  stage.dataset.state = status;
  $('#view-parler').dataset.state = status;
  const orb = $('#orb');
  const hint = $('#stage-hint');
  const listening = status === 'listening';
  orb.setAttribute('aria-label', listening ? 'Terminer l’enregistrement' : 'Commencer l’enregistrement');
  orb.setAttribute('aria-pressed', String(listening));
  $('.orb-icon', orb).innerHTML = listening ? ICONS.stop : ICONS.mic;
  orb.disabled = status === 'finalizing' || status === 'processing';
  $('#stage-actions').hidden = !listening;

  clearInterval(writingTicker);
  if (status === 'idle') {
    hint.textContent = typo(state.entries.some((e) => dayKey(e.createdAt) === dayKey(new Date())) ? 'Encore une histoire ? Appuie et raconte' : 'Appuie et raconte');
    $('#live').innerHTML = '';
    state.rec.replyTo = null;
    state.rec.question = null;
  } else if (status === 'listening') {
    hint.textContent = '00:00 · Je t’écoute…';
  } else if (status === 'finalizing') {
    hint.textContent = 'Je termine d’écouter…';
  } else if (status === 'processing') {
    let i = 0;
    hint.textContent = 'Do It écrit…';
    writingTicker = setInterval(() => {
      hint.textContent = typo(WRITING_STEPS[i % WRITING_STEPS.length]);
      i += 1;
    }, 1700);
  }
  renderReplyBanner();
}
let writingTicker = 0;

function renderReplyBanner() {
  const banner = $('#reply-banner');
  const { question, status } = state.rec;
  const show = Boolean(question) && (status === 'idle' || status === 'listening');
  banner.hidden = !show;
  if (show) $('#reply-question').textContent = typo(question);
}

function renderLive(finalText, interim) {
  const live = $('#live');
  live.innerHTML = `${esc(finalText)} <span class="interim">${esc(interim)}</span>`;
  live.scrollTop = live.scrollHeight;
}

function levelLoop() {
  const rec = state.rec;
  rec.target *= 0.9;
  if (isMobile()) rec.target = Math.max(rec.target, 0.06 + Math.random() * 0.05);
  rec.level += (rec.target - rec.level) * 0.3;
  $('#orb').style.setProperty('--level', rec.level.toFixed(3));
  rec.history.push(rec.level);
  if (rec.history.length > 40) rec.history.shift();
  const bars = $('#meter').children;
  for (let i = 0; i < bars.length; i++) {
    const v = rec.history[rec.history.length - bars.length + i] ?? 0;
    bars[i].style.transform = `scaleY(${(0.12 + Math.min(1, v * 1.6) * 0.88).toFixed(3)})`;
  }
  rec.raf = requestAnimationFrame(levelLoop);
}

async function startRecording({ replyTo = null, question = null } = {}) {
  if (state.rec.status === 'processing' || state.rec.status === 'finalizing') {
    toast('Je finis d’écrire, une seconde…');
    return;
  }
  if (state.rec.status !== 'idle') return;
  const replyQuestion = question || (replyTo ? findEntry(replyTo)?.followUp : null) || null;
  if (!isSpeechSupported()) {
    openComposer({ replyTo, question: replyQuestion, unsupported: true });
    return;
  }

  const dictation = new Dictation({
    onText: renderLive,
    onActivity: () => {
      state.rec.target = Math.max(state.rec.target, 0.55 + Math.random() * 0.45);
    },
    onError: (message) => {
      toast(message, 'error');
      if (state.rec.status === 'listening') finishRecording({ quietIfEmpty: true });
    },
  });

  Object.assign(state.rec, { dictation, startedAt: Date.now(), replyTo, question: replyQuestion, level: 0, target: 0, history: [] });
  try {
    dictation.start();
  } catch {
    openComposer({ replyTo, question: replyQuestion, unsupported: true });
    return;
  }
  setStage('listening');
  vibrate(12);
  state.rec.timer = setInterval(() => {
    const s = (Date.now() - state.rec.startedAt) / 1000;
    $('#stage-hint').textContent = `${clock(s)} · Je t’écoute…`;
    if (s >= MAX_RECORDING_S) finishRecording();
  }, 250);
  levelLoop();
  state.rec.stopMeter = await startLevelMeter((v) => {
    state.rec.target = Math.max(state.rec.target, v);
  });
  if (state.rec.status !== 'listening') state.rec.stopMeter?.();
  try {
    const lock = await navigator.wakeLock?.request('screen');
    if (state.rec.status === 'listening') state.rec.wakeLock = lock;
    else lock?.release().catch(() => {});
  } catch {
    /* écran de veille : tant pis */
  }
}

function stopRecordingExtras() {
  const rec = state.rec;
  clearInterval(rec.timer);
  cancelAnimationFrame(rec.raf);
  rec.stopMeter?.();
  rec.stopMeter = null;
  rec.wakeLock?.release?.().catch(() => {});
  rec.wakeLock = null;
  $('#orb').style.setProperty('--level', '0');
}

async function finishRecording({ quietIfEmpty = false } = {}) {
  const rec = state.rec;
  if (rec.status !== 'listening') return;
  setStage('finalizing');
  vibrate([8, 40, 8]);
  const text = (await rec.dictation.stop()).trim();
  stopRecordingExtras();
  const duration = Math.round((Date.now() - rec.startedAt) / 1000);
  const { replyTo, question } = rec;
  if (!text) {
    setStage('idle');
    if (!quietIfEmpty) toast('Je n’ai rien entendu… Rapproche-toi du micro et réessaie.', 'warn');
    return;
  }
  await submitSpeech({ text, duration, replyTo, question });
}

function cancelRecording() {
  if (state.rec.status !== 'listening') return;
  state.rec.dictation?.cancel();
  stopRecordingExtras();
  setStage('idle');
  toast('Enregistrement annulé');
}

async function submitSpeech({ text, duration = 0, replyTo = null, question = null }) {
  const segment = { text, at: new Date().toISOString(), duration };
  if (question) segment.question = question;
  let entry = replyTo ? findEntry(replyTo) : null;
  const isNew = !entry;
  if (entry) {
    entry.segments.push(segment);
  } else {
    entry = newEntry(segment);
    state.entries.unshift(entry);
  }
  await persistEntry(entry);
  state.rec.replyTo = null;
  state.rec.question = null;
  await processEntry(entry, { foreground: true, isNew });
}

/* ───────────── Rendu ───────────── */

function chip(themeId, { tag = 'span', active = false, count = null, action = '' } = {}) {
  const t = getTheme(themeId, state.customThemes);
  const attrs = tag === 'button' ? ` type="button" data-action="${action}" data-id="${esc(t.id)}" aria-pressed="${active}"` : '';
  return `<${tag} class="chip${active ? ' is-active' : ''}" style="--h:${t.hue}"${attrs}><span class="chip-emoji">${esc(t.emoji)}</span>${esc(t.label)}${count != null ? `<span class="chip-count">${count}</span>` : ''}</${tag}>`;
}

function revealHtml(text) {
  const words = String(text || '').split(/(\s+)/);
  const step = Math.min(28, 1400 / Math.max(1, words.length / 2));
  let i = 0;
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.split(/(\s+)/).map((w) => (w.trim() ? `<span class="w" style="--d:${Math.round(i++ * step)}ms">${esc(w)}</span>` : w)).join('')}</p>`)
    .join('');
}

function skeletonCard(e) {
  return `<article class="entry is-writing" data-entry="${e.id}" aria-busy="true">
    <header class="entry-meta"><time datetime="${e.createdAt}">${timeLabel(e.createdAt)}</time><span class="writing-label"><i class="pen"></i>Do It écrit…</span></header>
    <div class="skeleton"><span></span><span></span><span></span><span></span></div>
  </article>`;
}

function entryCard(e, { full = false, i = 0 } = {}) {
  if (state.processing.has(e.id) && !e.text) return skeletonCard(e);
  const mood = getMood(e.mood);
  const updating = state.processing.has(e.id);
  const reveal = full && state.revealId === e.id;
  const badges = [
    e.source === 'local' ? `<span class="badge" title="${esc(REASONS[e.reason] || 'Écrit sans l’IA')}">Mode local</span>` : '',
    e.segments.length > 1 ? `<span class="badge soft">${e.segments.length} prises</span>` : '',
    updating ? '<span class="badge glow">Mise à jour…</span>' : '',
  ].join('');
  const hue = getTheme(e.themes?.[0] || 'quotidien', state.customThemes).hue;
  return `<article class="entry${full ? ' is-full' : ''}${updating ? ' is-updating' : ''}${reveal ? ' is-reveal' : ''}" style="--h:${hue};--i:${Math.min(i, 8)}" data-entry="${e.id}" tabindex="0" role="button" aria-label="Ouvrir « ${esc(e.title)} »">
    <header class="entry-meta"><time datetime="${e.createdAt}">${timeLabel(e.createdAt)}</time><span class="mood" title="Humeur : ${mood.label}">${mood.emoji}</span>${badges}</header>
    <h3 class="entry-title">${esc(e.title || 'Sans titre')}</h3>
    <div class="entry-text${full ? '' : ' clamp'}">${reveal ? revealHtml(e.text) : paragraphs(e.text)}</div>
    ${full && e.highlights?.length ? `<ul class="points">${e.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    <footer class="chips">${(e.themes || []).map((id) => chip(id)).join('')}</footer>
  </article>`;
}

function followUpBubble(e) {
  if (!e.followUp || state.processing.has(e.id)) return '';
  return `<div class="followup">
    <span class="followup-avatar">${LOGO_MARK}</span>
    <div class="followup-body">
      <p class="followup-label">Do It te relance</p>
      <p class="followup-q">${esc(e.followUp)}</p>
      <button class="btn btn-sm btn-primary" type="button" data-action="reply" data-id="${e.id}">${ICONS.reply}Répondre à voix haute</button>
    </div>
  </div>`;
}

function renderHeader() {
  const { n, today } = streakInfo();
  const el = $('#streak');
  el.hidden = n === 0;
  el.innerHTML = `${ICONS.flame}<b>${n}</b><span class="sr-only"> jour${n > 1 ? 's' : ''} d’affilée</span>`;
  el.title = today ? `${n} jour${n > 1 ? 's' : ''} d’affilée` : `Série de ${n} jour${n > 1 ? 's' : ''} : raconte quelque chose aujourd’hui pour la prolonger`;
  el.classList.toggle('is-cold', !today);
}

function renderParler() {
  const name = state.settings.name.trim();
  $('#hello').textContent = `${greeting()}${name ? `, ${name}` : ''}.`;
  $('#today').textContent = todayLabel();

  const counts = sortedThemeCounts().map(([id]) => id);
  $('#ideas-row').innerHTML = promptIdeas(counts, state.ideaSeed)
    .map((q, i) => `<button class="idea" type="button" style="--i:${i}" data-action="idea" data-q="${esc(q)}">${esc(q)}</button>`)
    .join('');

  const todayKey = dayKey(new Date());
  const todays = state.entries.filter((e) => dayKey(e.createdAt) === todayKey);
  const feed = $('#feed');
  if (!todays.length) {
    feed.innerHTML = `<div class="empty">
      <p class="empty-title">Ta page du jour est blanche.</p>
      <p>Appuie sur l’orbe et raconte, même en vrac. Do It remet tout au propre et le range au bon endroit.</p>
      ${state.entries.length ? `<a class="link" href="#journal">Relire ton journal ${ICONS.chevron}</a>` : ''}
    </div>`;
    return;
  }
  feed.innerHTML = `<div class="feed-head"><h2>Aujourd’hui</h2><a class="link" href="#journal">Tout le journal ${ICONS.chevron}</a></div>
    ${todays.map((e, i) => `${entryCard(e, { full: true, i })}${i === 0 ? followUpBubble(e) : ''}`).join('')}`;
}

function matchesQuery(e, q) {
  if (!q) return true;
  return fold(`${e.title} ${e.text} ${e.summary} ${rawText(e)}`).includes(q);
}

function renderJournal() {
  const counts = themeCounts();
  if (state.filter !== 'all' && !counts.has(state.filter)) state.filter = 'all';
  const sorted = sortedThemeCounts();
  $('#tabs').innerHTML = [
    `<button class="chip tab${state.filter === 'all' ? ' is-active' : ''}" type="button" data-action="filter" data-id="all" aria-pressed="${state.filter === 'all'}">Tout<span class="chip-count">${state.entries.length}</span></button>`,
    ...sorted.map(([id, info]) => chip(id, { tag: 'button', active: state.filter === id, count: info.count, action: 'filter' }).replace('class="chip', 'class="chip tab')),
  ].join('');

  const total = state.entries.length;
  $('#journal-count').textContent = total ? `${plural(total, 'récit')} · ${plural(new Set(state.entries.map((e) => dayKey(e.createdAt))).size, 'jour')}` : 'Ton histoire commence ici.';

  const q = fold(state.query.trim());
  const list = state.entries.filter((e) => (state.filter === 'all' || e.themes?.includes(state.filter)) && matchesQuery(e, q));
  const timeline = $('#timeline');
  if (!total) {
    timeline.innerHTML = `<div class="empty"><p class="empty-title">Aucun récit pour l’instant.</p><p>Ton premier enregistrement apparaîtra ici, daté et classé.</p><a class="btn btn-primary" href="#parler">${ICONS.mic}Raconter quelque chose</a></div>`;
    return;
  }
  if (!list.length) {
    timeline.innerHTML = `<div class="empty"><p class="empty-title">Rien ne correspond.</p><p>Essaie un autre mot ou un autre thème.</p></div>`;
    return;
  }
  const groups = new Map();
  for (const e of list) {
    const k = dayKey(e.createdAt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  timeline.innerHTML = [...groups.values()]
    .map((items) => `<section class="day"><h3 class="day-label"><span>${dayLabel(items[0].createdAt)}</span><small>${plural(items.length, 'récit')}</small></h3>${items.map((e, i) => entryCard(e, { i })).join('')}</section>`)
    .join('');
}

function sparkline(themeId) {
  const days = 14;
  const now = new Date();
  const counts = Array.from({ length: days }, (_, i) => {
    const k = dayKey(addDays(now, i - days + 1));
    return state.entries.filter((e) => dayKey(e.createdAt) === k && e.themes?.includes(themeId)).length;
  });
  const max = Math.max(1, ...counts);
  return `<span class="spark" aria-hidden="true">${counts.map((c) => `<i style="--v:${(c / max).toFixed(2)}"></i>`).join('')}</span>`;
}

function renderThemes() {
  const counts = sortedThemeCounts();
  const grid = $('#theme-grid');
  const tiles = counts.map(([id, info], i) => {
    const t = getTheme(id, state.customThemes);
    return `<button class="tile" type="button" style="--h:${t.hue};--i:${Math.min(i, 10)}" data-action="open-theme" data-id="${esc(id)}">
      <span class="tile-emoji">${esc(t.emoji)}</span>
      <span class="tile-label">${esc(t.label)}</span>
      <span class="tile-meta">${plural(info.count, 'récit')} · ${ago(info.last)}</span>
      ${sparkline(id)}
    </button>`;
  });
  const unused = THEMES.filter((t) => !counts.some(([id]) => id === t.id));
  grid.innerHTML = tiles.length
    ? tiles.join('')
    : `<div class="empty wide"><p class="empty-title">Les onglets se créent tout seuls.</p><p>Parle de ton sport, de tes soirées, de ton moral… Do It comprend de quoi tu parles et ouvre le bon thème.</p></div>`;
  $('#themes-ghost').innerHTML = unused.length
    ? `<p class="ghost-label">Ce que Do It sait aussi reconnaître</p><div class="ghost-row">${unused.map((t) => `<span class="ghost" style="--h:${t.hue}">${t.emoji} ${esc(t.label)}</span>`).join('')}</div>`
    : '';
}

function moodChart() {
  const days = 14;
  const now = new Date();
  const points = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(now, i - days + 1);
    const k = dayKey(date);
    const items = state.entries.filter((e) => dayKey(e.createdAt) === k);
    const avg = items.length ? items.reduce((s, e) => s + getMood(e.mood).score, 0) / items.length : null;
    points.push({ date, avg });
  }
  const W = 320;
  const H = 132;
  const padL = 28;
  const padB = 22;
  const x = (i) => padL + (i * (W - padL - 8)) / (days - 1);
  const y = (v) => 8 + ((2 - v) * (H - padB - 16)) / 4;
  const known = points.map((p, i) => ({ ...p, i })).filter((p) => p.avg !== null);
  const path = known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(' ');
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });
  return `<svg class="mood-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Humeur des 14 derniers jours">
    <defs><linearGradient id="mg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7d1533"/><stop offset=".35" stop-color="#1fa2ff"/><stop offset=".7" stop-color="#ff2d95"/><stop offset="1" stop-color="#3ee39d"/></linearGradient><linearGradient id="ma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2d95" stop-opacity=".22"/><stop offset="1" stop-color="#1fa2ff" stop-opacity="0"/></linearGradient></defs>
    ${MOODS.map((m) => `<line x1="${padL}" x2="${W - 8}" y1="${y(m.score)}" y2="${y(m.score)}" class="grid"/><text x="2" y="${y(m.score) + 5}" class="emo">${m.emoji}</text>`).join('')}
    ${known.length > 1 ? `<path d="${path} L${x(known.at(-1).i).toFixed(1)} ${y(-2)} L${x(known[0].i).toFixed(1)} ${y(-2)} Z" class="area"/><path d="${path}" class="line" pathLength="1"/>` : ''}
    ${known.map((p, k) => `<circle cx="${x(p.i)}" cy="${y(p.avg)}" r="5" class="dot" style="--i:${k}"/>`).join('')}
    ${points.map((p, i) => `<text x="${x(i)}" y="${H - 4}" class="day${dayKey(p.date) === dayKey(now) ? ' is-today' : ''}">${weekday.format(p.date).toUpperCase()}</text>`).join('')}
  </svg>`;
}

function renderBilan() {
  const entries = state.entries;
  const { n } = streakInfo();
  const minutes = Math.round(entries.reduce((s, e) => s + (e.segments || []).reduce((t, g) => t + (g.duration || 0), 0), 0) / 60);
  const words = entries.reduce((s, e) => s + wordCount(e.text), 0);
  $('#stats').innerHTML = [
    ['🔥', n, n > 1 ? 'jours d’affilée' : 'jour d’affilée'],
    ['📖', entries.length, entries.length > 1 ? 'récits' : 'récit'],
    ['🎙️', minutes, minutes > 1 ? 'minutes racontées' : 'minute racontée'],
    ['✍️', words, words > 1 ? 'mots écrits' : 'mot écrit'],
  ].map(([emoji, value, label], i) => `<div class="stat" style="--i:${i}"><span class="stat-emoji">${emoji}</span><b class="stat-value" data-value="${value}">${value.toLocaleString('fr-FR')}</b><span class="stat-label">${label}</span></div>`).join('');

  const moods = entries.filter((e) => Date.now() - new Date(e.createdAt) < 14 * 86400e3);
  const avg = moods.length ? moods.reduce((s, e) => s + getMood(e.mood).score, 0) / moods.length : null;
  const avgMood = avg === null ? null : MOODS.reduce((best, m) => (Math.abs(m.score - avg) < Math.abs(best.score - avg) ? m : best));
  $('#mood-card').innerHTML = `<header class="card-head"><h3>Humeur</h3><span class="muted">${avgMood ? `${avgMood.emoji} plutôt ${avgMood.label.toLowerCase()} ces 14 jours` : '14 derniers jours'}</span></header>${moodChart()}`;

  const counts = sortedThemeCounts();
  const total = counts.reduce((s, [, i]) => s + i.count, 0);
  const top = counts.slice(0, 6);
  const others = counts.slice(6).reduce((s, [, i]) => s + i.count, 0);
  $('#mix-card').innerHTML = `<header class="card-head"><h3>De quoi tu parles</h3><span class="muted">${counts.length ? plural(counts.length, 'thème') : 'pas encore de thème'}</span></header>
    ${total ? `<div class="mix-bar">${top.map(([id, i], k) => `<i style="--h:${getTheme(id, state.customThemes).hue};--i:${k};flex:${i.count}" title="${esc(getTheme(id, state.customThemes).label)}"></i>`).join('')}${others ? `<i class="others" style="--i:6;flex:${others}"></i>` : ''}</div>
    <ul class="mix-legend">${top.map(([id, i]) => {
      const t = getTheme(id, state.customThemes);
      return `<li style="--h:${t.hue}"><span class="dot"></span>${esc(t.emoji)} ${esc(t.label)}<b>${Math.round((100 * i.count) / total)} %</b></li>`;
    }).join('')}${others ? `<li class="others"><span class="dot"></span>Autres<b>${Math.round((100 * others) / total)} %</b></li>` : ''}</ul>` : '<p class="muted small">Tes thèmes apparaîtront ici après quelques récits.</p>'}`;
}

function segmented(name, options, value) {
  return `<div class="segmented" role="radiogroup">${options.map(([v, label]) => `<button type="button" role="radio" data-action="set-${name}" data-value="${v}" aria-checked="${v === value}" class="${v === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>`;
}

function renderSettings() {
  const s = state.settings;
  $('#settings').innerHTML = `
    <h3 class="settings-title">Réglages</h3>
    <div class="row"><label for="set-name">Ton prénom</label><input id="set-name" type="text" autocomplete="given-name" maxlength="30" placeholder="Pour te saluer" value="${attr(s.name)}"></div>
    <div class="row col"><span class="row-label">Style d’écriture</span>${segmented('style', STYLE_OPTIONS, s.style)}<p class="hint" id="style-hint">${styleHint(s.style)}</p></div>
    <div class="row col"><span class="row-label">Apparence</span>${segmented('appearance', APPEARANCE_OPTIONS, s.appearance)}</div>
    <div class="row col" id="code-row" hidden><label for="set-code">Code d’accès à l’IA</label><input id="set-code" type="password" autocomplete="off" placeholder="Code défini sur Netlify" value="${attr(s.accessCode)}"></div>
    <div class="row status" id="ai-status"></div>
    <div class="row col"><span class="row-label">Ton journal</span>
      <div class="actions-grid">
        <button class="btn" type="button" data-action="export-md">${ICONS.download}Exporter (Markdown)</button>
        <button class="btn" type="button" data-action="export-json">${ICONS.download}Sauvegarde (JSON)</button>
        <button class="btn" type="button" data-action="import">${ICONS.upload}Importer</button>
        <button class="btn" type="button" data-action="install" id="install-btn" hidden>${ICONS.plus}Installer l’appli</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="hint" id="install-hint"></p>
    </div>
    <div class="row"><button class="btn btn-danger" type="button" data-action="wipe">${ICONS.trash}Tout effacer</button></div>
    <p class="fineprint">Do It · De l’oral à l’écrit. Ton journal reste sur cet appareil ; seul le texte dicté part à l’IA, le temps de l’écrire, sans être conservé.</p>`;
  renderAiStatus();
  renderInstall();
}

function styleHint(style) {
  return {
    professionnel: 'Prose nette et structurée, ton posé.',
    recit: 'Récit vivant façon journal intime.',
    synthese: 'L’essentiel en quelques phrases et points clés.',
  }[style];
}

function renderAiStatus() {
  const el = $('#ai-status');
  if (!el) return;
  const ai = state.ai;
  $('#code-row').hidden = !ai?.needsCode;
  let html;
  if (!ai) html = '<span class="status-dot off"></span><div><b>Mode local</b><p class="hint">L’IA n’est pas joignable ici. Do It nettoie et classe quand même tes récits, puis les sublime quand l’IA revient.</p></div>';
  else if (!ai.ai) html = '<span class="status-dot off"></span><div><b>IA non configurée</b><p class="hint">Le site tourne sans IA : mode local.</p></div>';
  else if (ai.needsCode && !ai.authorized) html = '<span class="status-dot warn"></span><div><b>Code d’accès requis</b><p class="hint">Saisis le code pour activer l’écriture par l’IA.</p></div>';
  else html = '<span class="status-dot on"></span><div><b>IA connectée</b><p class="hint">Claude réécrit, résume et classe chaque récit.</p></div>';
  el.innerHTML = html;
}

function renderInstall() {
  const btn = $('#install-btn');
  if (!btn) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  btn.hidden = !state.installPrompt || standalone;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  $('#install-hint').textContent = !standalone && ios ? 'Sur iPhone : bouton Partager › « Sur l’écran d’accueil » pour installer Do It.' : '';
}

function renderEntryViews() {
  renderParler();
  renderJournal();
}

function renderAll() {
  renderHeader();
  renderParler();
  renderJournal();
  renderThemes();
  renderBilan();
  if ($('#sheet').open && sheetEntryId && sheetMode !== 'edit') renderSheet(sheetEntryId);
}

/* ───────────── Fiche d’une entrée ───────────── */

let sheetEntryId = null;
let sheetMode = 'view'; // view | edit | themes

function openSheet(id) {
  sheetEntryId = id;
  sheetMode = 'view';
  renderSheet(id);
  const sheet = $('#sheet');
  if (!sheet.open) sheet.showModal();
}

function renderSheet(id) {
  const e = findEntry(id);
  const sheet = $('#sheet');
  if (!e) {
    sheet.close();
    return;
  }
  const mood = getMood(e.mood);
  const editing = sheetMode === 'edit';
  const busy = state.processing.has(e.id);
  const allThemeIds = [...new Set([...THEMES.map((t) => t.id), ...state.customThemes.map((t) => t.id)])];

  sheet.innerHTML = `<div class="sheet-inner">
    <header class="sheet-head">
      <p class="eyebrow">${longDate(e.createdAt)} · ${timeLabel(e.createdAt)}</p>
      <button class="icon-btn" type="button" data-action="close-sheet" aria-label="Fermer">${ICONS.close}</button>
    </header>
    ${editing
      ? `<input class="edit-title" id="edit-title" value="${attr(e.title)}" maxlength="90" aria-label="Titre">`
      : `<h2 class="sheet-title">${esc(e.title || 'Sans titre')}</h2>`}
    <div class="chips sheet-chips">
      ${sheetMode === 'themes'
        ? `${allThemeIds.map((tid) => chip(tid, { tag: 'button', active: e.themes.includes(tid), action: 'toggle-theme' })).join('')}
           <form class="new-theme" data-form="new-theme"><input name="label" maxlength="24" placeholder="Nouveau thème…" aria-label="Nouveau thème"><button class="btn btn-sm" type="submit">${ICONS.plus}Créer</button></form>
           <button class="btn btn-sm btn-primary" type="button" data-action="themes-done">${ICONS.check}OK</button>`
        : `${e.themes.map((tid) => chip(tid)).join('')}<button class="chip chip-edit" type="button" data-action="edit-themes">${ICONS.pencil}Thèmes</button>`}
    </div>
    <div class="mood-picker" role="radiogroup" aria-label="Humeur">
      ${MOODS.map((m) => `<button type="button" role="radio" aria-checked="${m.id === e.mood}" class="${m.id === e.mood ? 'is-active' : ''}" data-action="set-mood" data-value="${m.id}" title="${m.label}">${m.emoji}</button>`).join('')}
      <span class="mood-label">${mood.label}</span>
    </div>
    ${editing
      ? `<textarea class="edit-text" id="edit-text" rows="12" aria-label="Texte">${attr(e.text)}</textarea>`
      : `<div class="sheet-text">${busy && !e.text ? '<p class="muted">Do It écrit…</p>' : paragraphs(e.text)}</div>`}
    ${!editing && e.highlights?.length ? `<div class="points-box"><p class="eyebrow">Points clés</p><ul class="points">${e.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
    ${!editing && e.followUp ? `<div class="followup compact"><span class="followup-avatar">${LOGO_MARK}</span><div class="followup-body"><p class="followup-q">${esc(e.followUp)}</p></div></div>` : ''}
    <details class="raw">
      <summary>Ce que tu as dit <small>${plural(e.segments.length, 'prise')}</small></summary>
      ${e.segments.map((s) => `<div class="raw-seg">${s.question ? `<p class="raw-q">« ${esc(s.question)} »</p>` : ''}<p>${esc(s.text)}</p><small>${timeLabel(s.at)}${s.duration ? ` · ${clock(s.duration)}` : ''}</small></div>`).join('')}
    </details>
    <footer class="sheet-actions">
      ${editing
        ? `<button class="btn" type="button" data-action="cancel-edit">Annuler</button><button class="btn btn-primary" type="button" data-action="save-edit">${ICONS.check}Enregistrer</button>`
        : `<button class="btn btn-primary" type="button" data-action="reply" data-id="${e.id}" ${busy ? 'disabled' : ''}>${ICONS.mic}Continuer à voix haute</button>
           <div class="sheet-tools">
             <button class="icon-btn" type="button" data-action="edit" title="Modifier" aria-label="Modifier">${ICONS.pencil}</button>
             <button class="icon-btn" type="button" data-action="resublime" title="Réécrire avec l’IA" aria-label="Réécrire avec l’IA" ${busy ? 'disabled' : ''}>${ICONS.sparkle}</button>
             <button class="icon-btn" type="button" data-action="copy" title="Copier" aria-label="Copier">${ICONS.copy}</button>
             ${navigator.share ? `<button class="icon-btn" type="button" data-action="share" title="Partager" aria-label="Partager">${ICONS.share}</button>` : ''}
             <button class="icon-btn danger" type="button" data-action="delete" title="Supprimer" aria-label="Supprimer">${ICONS.trash}</button>
           </div>`}
    </footer>
  </div>`;
}

function entryAsText(e) {
  const themes = e.themes.map((id) => getTheme(id, state.customThemes)).map((t) => `${t.emoji} ${t.label}`).join(' · ');
  return `${e.title}\n${longDate(e.createdAt)} · ${timeLabel(e.createdAt)} · ${themes}\n\n${e.text}${e.highlights?.length ? `\n\n${e.highlights.map((h) => `• ${h}`).join('\n')}` : ''}`;
}

/* ───────────── Saisie au clavier ───────────── */

let composerContext = {};

function openComposer({ replyTo = null, question = null, unsupported = false } = {}) {
  composerContext = { replyTo, question };
  const dlg = $('#composer');
  $('#composer-note').innerHTML = unsupported
    ? 'La dictée vocale n’est pas disponible sur ce navigateur. Ouvre Do It dans <b>Chrome</b> ou <b>Safari</b>, ou écris ici : Do It s’occupe du reste.'
    : question
      ? `En réponse à : <b>« ${esc(question)} »</b>`
      : 'Écris comme tu parlerais, même en vrac : Do It s’occupe du reste.';
  $('#composer-text').value = '';
  dlg.showModal();
  setTimeout(() => $('#composer-text').focus(), 50);
}

async function submitComposer() {
  const text = $('#composer-text').value.trim();
  if (!text) {
    $('#composer-text').focus();
    return;
  }
  $('#composer').close();
  await submitSpeech({ text, duration: 0, ...composerContext });
}

/* ───────────── Navigation ───────────── */

function route() {
  const [view, param] = location.hash.replace(/^#/, '').split('/');
  const target = VIEWS.includes(view) ? view : 'parler';
  if (target === 'journal') state.filter = param ? decodeURIComponent(param) : 'all';
  for (const v of VIEWS) {
    $(`#view-${v}`).hidden = v !== target;
    $(`.tabbar [data-nav="${v}"]`).setAttribute('aria-current', v === target ? 'page' : 'false');
  }
  document.body.dataset.view = target;
  $('.tabbar').style.setProperty('--idx', VIEWS.indexOf(target));
  if (target === 'journal') renderJournal();
  if (target === 'themes') renderThemes();
  if (target === 'bilan') {
    renderBilan();
    countUp();
  }
  window.scrollTo({ top: 0 });
}

/** Les chiffres du bilan défilent jusqu'à leur valeur. */
function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const el of $$('#stats .stat-value')) {
    const target = Number(el.dataset.value) || 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1100);
      el.textContent = Math.round(target * (1 - (1 - t) ** 3)).toLocaleString('fr-FR');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/** Pluie de confettis aux couleurs de Do It, depuis un élément. */
function burst(from, count = 30) {
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const cx = r.left + r.width / 2;
  const cy = r.top + Math.min(r.height / 2, 120);
  for (let k = 0; k < count; k++) {
    const piece = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 170;
    if (Math.random() < 0.4) piece.className = 'round';
    piece.style.cssText = `left:${cx}px;top:${cy}px;--c:${CONFETTI_COLORS[k % CONFETTI_COLORS.length]};--s:${6 + Math.random() * 7}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist + 120}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 90}ms`;
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1600);
}

/* ───────────── Interactions ───────────── */

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* pas de vibreur */
  }
}

let toastTimer = 0;
function toast(message, tone = 'info') {
  const el = $('#toast');
  el.textContent = typo(message);
  el.dataset.tone = tone;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), tone === 'error' ? 6000 : 3800);
}

function celebrate() {
  const total = state.entries.length;
  const { n, today } = streakInfo();
  const firstToday = state.entries.filter((e) => dayKey(e.createdAt) === dayKey(new Date())).length === 1;
  const party = (message) => {
    toast(message);
    setTimeout(() => burst($('#orb'), 60), 900);
  };
  if (total === 1) return party('✍️ Premier chapitre écrit. Ton journal est lancé !');
  if (today && firstToday && [3, 7, 14, 30, 50, 100, 365].includes(n)) return party(`🔥 ${n} jours d’affilée. Continue comme ça !`);
  if ([10, 25, 50, 100, 250, 500].includes(total)) return party(`📖 ${total} récits dans ton journal. Respect.`);
}

function applyAppearance() {
  document.documentElement.dataset.theme = state.settings.appearance;
}

async function action(name, el) {
  const id = el.dataset.id;
  switch (name) {
    case 'reply': {
      const e = findEntry(id);
      if (!e) return;
      if ($('#sheet').open) $('#sheet').close();
      location.hash = '#parler';
      window.scrollTo({ top: 0 });
      startRecording({ replyTo: id, question: e.followUp || 'Et ensuite ?' });
      return;
    }
    case 'idea':
      window.scrollTo({ top: 0 });
      startRecording({ question: el.dataset.q });
      return;
    case 'keyboard':
      openComposer({ replyTo: state.rec.replyTo, question: state.rec.question });
      return;
    case 'cancel-rec':
      cancelRecording();
      return;
    case 'finish-rec':
      finishRecording();
      return;
    case 'clear-reply':
      state.rec.replyTo = null;
      state.rec.question = null;
      renderReplyBanner();
      return;
    case 'filter':
      state.filter = id;
      history.replaceState(null, '', id === 'all' ? '#journal' : `#journal/${encodeURIComponent(id)}`);
      renderJournal();
      return;
    case 'open-theme':
      state.filter = id;
      location.hash = `#journal/${encodeURIComponent(id)}`;
      return;
    case 'close-sheet':
      $('#sheet').close();
      return;
    case 'edit':
      sheetMode = 'edit';
      renderSheet(sheetEntryId);
      $('#edit-text')?.focus();
      return;
    case 'cancel-edit':
      sheetMode = 'view';
      renderSheet(sheetEntryId);
      return;
    case 'save-edit': {
      const e = findEntry(sheetEntryId);
      if (!e) return;
      e.title = $('#edit-title').value.trim() || e.title;
      e.text = $('#edit-text').value.replace(/\r\n/g, '\n').trim();
      e.edited = true;
      e.pending = false;
      await persistEntry(e);
      sheetMode = 'view';
      renderAll();
      toast('Modifications enregistrées');
      return;
    }
    case 'edit-themes':
      sheetMode = 'themes';
      renderSheet(sheetEntryId);
      return;
    case 'themes-done':
      sheetMode = 'view';
      renderAll();
      return;
    case 'toggle-theme': {
      const e = findEntry(sheetEntryId);
      if (!e) return;
      e.themes = e.themes.includes(id) ? e.themes.filter((t) => t !== id) : [...e.themes, id];
      if (!e.themes.length) e.themes = [id];
      await persistEntry(e);
      renderSheet(sheetEntryId);
      return;
    }
    case 'set-mood': {
      const e = findEntry(sheetEntryId);
      if (!e) return;
      e.mood = el.dataset.value;
      await persistEntry(e);
      renderAll();
      return;
    }
    case 'resublime': {
      const e = findEntry(sheetEntryId);
      if (!e) return;
      toast('Je réécris ce récit…');
      const res = await processEntry(e);
      if (res?.source === 'ai') toast('✨ Récit réécrit');
      return;
    }
    case 'copy': {
      const e = findEntry(sheetEntryId);
      try {
        await navigator.clipboard.writeText(entryAsText(e));
        toast('Copié dans le presse-papiers');
      } catch {
        toast('Copie impossible sur ce navigateur', 'warn');
      }
      return;
    }
    case 'share': {
      const e = findEntry(sheetEntryId);
      navigator.share?.({ title: e.title, text: entryAsText(e) }).catch(() => {});
      return;
    }
    case 'delete': {
      const e = findEntry(sheetEntryId);
      if (!e || !confirm(`Supprimer « ${e.title || 'ce récit'} » ? C’est définitif.`)) return;
      state.entries = state.entries.filter((x) => x.id !== e.id);
      await store.deleteEntry(e.id);
      $('#sheet').close();
      renderAll();
      toast('Récit supprimé');
      return;
    }
    case 'set-style': {
      const saved = saveSettings({ style: el.dataset.value });
      renderSettings();
      toast(`Style « ${STYLE_OPTIONS.find(([v]) => v === el.dataset.value)[1]} » pour les prochains récits`);
      await saved;
      return;
    }
    case 'set-appearance': {
      const saved = saveSettings({ appearance: el.dataset.value });
      applyAppearance();
      renderSettings();
      await saved;
      return;
    }
    case 'export-md':
      if (!state.entries.length) return toast('Rien à exporter pour l’instant');
      download(`do-it-journal-${dayKey(new Date())}.md`, toMarkdown(state.entries, state.customThemes), 'text/markdown;charset=utf-8');
      return;
    case 'export-json':
      download(`do-it-sauvegarde-${dayKey(new Date())}.json`, toBackup(state.entries, state.customThemes, state.settings), 'application/json');
      return;
    case 'import':
      $('#import-file').click();
      return;
    case 'install':
      state.installPrompt?.prompt();
      state.installPrompt = null;
      renderInstall();
      return;
    case 'wipe':
      if (!confirm('Effacer tout ton journal de cet appareil ? Pense à exporter une sauvegarde avant. C’est définitif.')) return;
      await store.clearAll();
      state.entries = [];
      state.customThemes = [];
      await saveSettings({ ...state.settings });
      renderAll();
      toast('Journal effacé');
      return;
    default:
  }
}

async function importFile(file) {
  try {
    const { entries, customThemes } = parseBackup(await file.text());
    let added = 0;
    for (const t of customThemes) {
      if (!state.customThemes.some((c) => c.id === t.id)) state.customThemes.push({ id: slugify(t.id), label: String(t.label), emoji: String(t.emoji || '🏷️'), hue: hueFor(t.id) });
    }
    await saveCustomThemes();
    for (const e of entries) {
      const existing = findEntry(e.id);
      if (existing && existing.updatedAt >= (e.updatedAt || '')) continue;
      const clean = { ...newEntry({ text: '' }), ...e, segments: Array.isArray(e.segments) ? e.segments : [] };
      if (existing) Object.assign(existing, clean);
      else state.entries.push(clean);
      await store.saveEntry(structuredClone(clean));
      added += 1;
    }
    sortEntries(state.entries);
    renderAll();
    toast(added ? `${plural(added, 'récit importé', 'récits importés')}` : 'Tout était déjà là');
  } catch (err) {
    toast(err.message || 'Import impossible', 'error');
  }
}

function bind() {
  $('#meter').innerHTML = '<i></i>'.repeat(32);
  $('.orb-icon').innerHTML = ICONS.mic;
  $('#keyboard-btn').insertAdjacentHTML('afterbegin', ICONS.keyboard);
  $('#cancel-rec').insertAdjacentHTML('afterbegin', ICONS.close);
  $('#finish-rec').insertAdjacentHTML('afterbegin', ICONS.check);
  $('#search-icon').innerHTML = ICONS.search;
  $('#reply-clear').innerHTML = ICONS.close;
  $('#composer-close').innerHTML = ICONS.close;
  for (const [nav, icon] of [['parler', 'mic'], ['journal', 'book'], ['themes', 'grid'], ['bilan', 'chart']]) {
    $(`.tabbar [data-nav="${nav}"] .tab-icon`).innerHTML = ICONS[icon];
  }

  $('#orb').addEventListener('click', () => {
    if (state.rec.status === 'listening') finishRecording();
    else startRecording({ replyTo: state.rec.replyTo, question: state.rec.question });
  });

  document.addEventListener('click', (ev) => {
    const actionEl = ev.target.closest('[data-action]');
    if (actionEl && !actionEl.disabled) {
      ev.preventDefault();
      action(actionEl.dataset.action, actionEl);
      return;
    }
    const card = ev.target.closest('[data-entry]');
    if (card && !card.classList.contains('is-writing') && !ev.target.closest('a')) openSheet(card.dataset.entry);
  });
  document.addEventListener('keydown', (ev) => {
    const card = ev.target.closest?.('[data-entry]');
    if (card && (ev.key === 'Enter' || ev.key === ' ') && ev.target === card) {
      ev.preventDefault();
      openSheet(card.dataset.entry);
      return;
    }
    const typing = ev.target.closest?.('input, textarea, [contenteditable="true"], dialog');
    if (typing || document.body.dataset.view !== 'parler') return;
    if (ev.code === 'Space' && !ev.repeat) {
      ev.preventDefault();
      $('#orb').click();
    } else if (ev.key === 'Escape') cancelRecording();
  });

  $('#search').addEventListener('input', (ev) => {
    state.query = ev.target.value;
    renderJournal();
  });

  $('#sheet').addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) ev.currentTarget.close();
  });
  $('#sheet').addEventListener('close', () => {
    sheetEntryId = null;
    sheetMode = 'view';
  });
  $('#sheet').addEventListener('submit', async (ev) => {
    if (ev.target.dataset.form !== 'new-theme') return;
    ev.preventDefault();
    const label = new FormData(ev.target).get('label')?.toString().trim();
    const e = findEntry(sheetEntryId);
    if (!label || !e) return;
    const r = resolveTheme({ label, emoji: '🏷️' }, state.customThemes);
    if (!r) return;
    if (r.isNew) {
      state.customThemes.push(r.theme);
      await saveCustomThemes();
    }
    if (!e.themes.includes(r.id)) e.themes.push(r.id);
    await persistEntry(e);
    renderSheet(sheetEntryId);
  });

  $('#composer').addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) ev.currentTarget.close();
  });
  $('#composer-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.submitter?.value === 'cancel') return $('#composer').close();
    submitComposer();
  });
  $('#composer-text').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) submitComposer();
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'set-name') {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(async () => {
        await saveSettings({ name: ev.target.value.trim() });
        renderParler();
      }, 300);
    }
  });
  document.addEventListener('change', async (ev) => {
    if (ev.target.id === 'set-code') {
      await saveSettings({ accessCode: ev.target.value.trim() });
      await refreshAiStatus();
      if (state.ai?.authorized) {
        toast('✨ IA activée');
        retryPending();
      } else toast('Code incorrect', 'warn');
    }
    if (ev.target.id === 'import-file' && ev.target.files?.[0]) {
      await importFile(ev.target.files[0]);
      ev.target.value = '';
    }
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => refreshAiStatus().then(retryPending));
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    state.installPrompt = ev;
    renderInstall();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.rec.status === 'idle') renderAll();
  });
}
let nameTimer = 0;

function rotateQuotes() {
  const el = $('#quote');
  const show = () => {
    el.classList.remove('is-in');
    setTimeout(() => {
      el.textContent = typo(quoteAt(state.quoteIndex++));
      el.classList.add('is-in');
    }, 350);
  };
  el.textContent = typo(quoteAt(state.quoteIndex++));
  el.classList.add('is-in');
  setInterval(() => {
    if (state.rec.status === 'idle' && document.visibilityState === 'visible') show();
  }, 7000);
}

/* ───────────── Accueil ───────────── */

function showOnboarding() {
  const el = $('#onboarding');
  el.hidden = false;
  $('#onboarding-mark').innerHTML = LOGO_MARK;
  $('#onboarding-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await saveSettings({ name: $('#onboarding-name').value.trim(), onboarded: true });
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.hidden = true;
    }, 450);
    renderParler();
    renderSettings();
  });
}

async function init() {
  bind();
  state.entries = sortEntries(await store.loadEntries());
  state.customThemes = await store.getValue('customThemes', []);
  state.settings = { ...DEFAULT_SETTINGS, ...(await store.getValue('settings', {})) };
  applyAppearance();
  store.requestPersistence();
  renderSettings();
  renderAll();
  setStage('idle');
  route();
  rotateQuotes();
  $('.brand-mark').innerHTML = LOGO_MARK;
  document.body.classList.add('is-ready');
  if (!state.settings.onboarded) showOnboarding();
  refreshAiStatus().then(retryPending);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
