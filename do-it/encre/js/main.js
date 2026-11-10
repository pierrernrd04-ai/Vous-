// Encré · par Do It
// Tes notes vocales deviennent des pages : à retravailler, ranger et retenir.
import * as db from './db.js';
import { createEditor, BLOCKS, htmlToText, countWords } from './editor.js';
import { loadVoiceNotes, loadVoiceThemes, saveVoiceNote, themeOf, moodOf, noteToHtml, noteToSection, newVoiceEntry, writeVoiceNote, retryPendingNotes } from './voice.js';
import { childFolders, pagesIn, canMoveFolder, folderPath, deepCount, flatTree, nextOrder, descendantIds } from './tree.js';
import { newCard, review, dueCards, mastery, dueLabel } from './memory.js';
import { toMarkdown } from './markdown.js';
import { Dictation, isSpeechSupported } from '../../js/speech.js';
import { cleanTranscript } from '../../js/local-ai.js';
import { esc, attr, typo, ago, longDate, timeLabel, uid, plural, clock, dayKey, addDays, wordCount } from '../../js/format.js';
import { REASONS, aiStatus } from '../../js/ai.js';
import { QUOTES } from '../../js/quotes.js';
import { getValue as getDoItValue } from '../../js/store.js';
import { fold, slugify } from '../../js/themes.js';
import { download } from '../../js/export.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const svg = (body, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const I = {
  home: svg('<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  wave: svg('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  brain: svg('<path d="M12 5a3 3 0 0 0-5.8-1A3 3 0 0 0 4 9a3 3 0 0 0 0 5 3 3 0 0 0 3 4 3 3 0 0 0 5 1z"/><path d="M12 5a3 3 0 0 1 5.8-1A3 3 0 0 1 20 9a3 3 0 0 1 0 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1z"/><path d="M12 5v14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 16),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 18),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  page: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  pin: svg('<path d="M9 4h6l-1 6 4 3H6l4-3z"/><path d="M12 13v8"/>', 18),
  move: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 14h6M13 11l3 3-3 3"/>', 18),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 18),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', 18),
  upload: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>', 18),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 18),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', 18),
  image: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', 18),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>', 18),
  spark: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>', 18),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 16),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 16),
  keyboard: svg('<path d="M6 9l6 6 6-6"/>', 18),
  folderPlus: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/>', 18),
  pages: svg('<path d="M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M16 3v4h4"/><path d="M4 7v12a4 4 0 0 0 4 4"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  searchLg: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  drop: svg('<path d="M12 3c3.6 4.6 7 8.2 7 12a7 7 0 0 1-14 0c0-3.8 3.4-7.4 7-12z"/><path d="M9.5 15.5a2.6 2.6 0 0 0 2.5 2.5"/>', 16),
  left: svg('<path d="M15 5l-7 7 7 7"/>', 20),
  right: svg('<path d="M9 5l7 7-7 7"/>', 20),
  quote: '<svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><path fill="currentColor" d="M0 26V15.6C0 6.9 4.3 1.7 12.6 0l1.3 3.7C9.3 5.2 7.1 8 6.9 12H13v14H0zm19.5 0V15.6C19.5 6.9 23.8 1.7 32.1 0l1.3 3.7C28.8 5.2 26.6 8 26.4 12h6.1v14H19.5z"/></svg>',
  shuffle: svg('<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.6 0 2.8-1.2 3.8-2.8M14 9.8C15 8.2 16.1 7 17.5 7H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>', 15),
  bolt: svg('<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>'),
  chart: svg('<path d="M5 20V12M10 20V7M15 20v-5M20 20V4"/>'),
  pen: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  sparkLg: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
  hand: svg('<path d="M3 17c3-1 4-6 6.5-6 1.6 0 1.4 2.4 0 4-1.2 1.4-.6 3 1 3 2.6 0 4.6-5.6 7-5.6 1.2 0 1 1.6.5 2.8"/><path d="M3 21h18"/>', 18),
};

const COVERS = [
  { id: 'neon', label: 'Néon' },
  { id: 'aurore', label: 'Aurore' },
  { id: 'grille', label: 'Grille' },
  { id: 'encre', label: 'Encre' },
  { id: 'pluie', label: 'Pluie' },
  { id: 'onde', label: 'Onde' },
  { id: 'papier', label: 'Papier' },
];
const EMOJIS = ['📄', '📝', '✍️', '📓', '📔', '📒', '📚', '💡', '🎯', '🧠', '❤️', '🌱', '🔥', '⭐', '🌙', '☀️', '🏃', '🍷', '💼', '✈️', '🎧', '🎙️', '🧭', '🗂️', '📁', '🔒', '🎨', '🎵', '🧘', '🍀', '⚡', '🌊', '🏔️', '💬', '🗝️', '🪴'];
const coverLayers = '<i></i><i></i><i></i>';
const cover = (id, cls = '') => (id ? `<span class="cover ${cls}" data-cover="${attr(id)}">${coverLayers}</span>` : '');

const state = {
  pages: [],
  folders: [],
  cards: [],
  notes: [],
  noteThemes: [],
  tabs: [],
  query: '',
  noteQuery: '',
  noteFilter: 'all',
  route: { name: 'home', id: null },
  editor: null,
  dictation: null,
  review: null,
  lastHash: null,
  depth: 0, // pages empilées par la navigation interne (pour « Retour »)
  hand: true, // notes vocales affichées en écriture manuscrite
  day: null, // jour affiché sur l'accueil (clé « 2026-10-29 »), null = aujourd'hui
  metric: 'words', // courbe des 7 derniers jours : mots, notes ou pages
  pageSort: 'recent',
  goal: 250, // objectif de mots par jour
  activity: {}, // { '2026-10-29': { words, pages: [ids] } } : ce qui a été écrit dans les pages
  quote: 0,
};

const findPage = (id) => state.pages.find((p) => p.id === id);
const findFolder = (id) => state.folders.find((f) => f.id === id);
const findNote = (id) => state.notes.find((n) => n.id === id);
const pageText = (p) => htmlToText(p.html || '');
const sortRecent = (list) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/* ───────────── Données ───────────── */

async function savePage(page, patch = {}, { count = true } = {}) {
  const before = page.words || 0;
  Object.assign(page, patch, { updatedAt: new Date().toISOString() });
  // Seule l'écriture compte dans l'activité du jour (pas un déplacement ni une couverture).
  if ('html' in patch || 'title' in patch) track(page.id, count ? Math.max(0, (page.words || 0) - before) : 0);
  await db.put('pages', page);
}

/* ───────────── Activité : mots encrés par jour, série ───────────── */

const todayKey = () => dayKey(new Date());
let activityTimer = 0;

/** Mots écrits dans une page aujourd'hui (les notes vocales sont comptées à part). */
function track(pageId, words) {
  const key = todayKey();
  const day = (state.activity[key] ||= { words: 0, pages: [] });
  day.words += words;
  if (!day.pages.includes(pageId)) day.pages.push(pageId);
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => db.setValue('activity', state.activity), 400);
}

function notesOn(key) {
  return state.notes.filter((n) => dayKey(n.createdAt) === key);
}

function dayStats(key) {
  const notes = notesOn(key);
  const act = state.activity[key] || { words: 0, pages: [] };
  const noteWords = notes.reduce((s, n) => s + wordCount(n.text), 0);
  return { words: noteWords + act.words, notes: notes.length, pages: act.pages.length, list: notes };
}

/** Jours d'écriture d'affilée, jusqu'à aujourd'hui (ou hier si rien n'est encore écrit aujourd'hui). */
function streak() {
  const active = (key) => {
    const st = dayStats(key);
    return st.words > 0 || st.notes > 0 || st.pages > 0;
  };
  let d = new Date();
  if (!active(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (active(dayKey(d)) && n < 3650) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

const selectedDay = () => state.day || todayKey();
const dateFromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

async function saveFolder(folder) {
  await db.put('folders', folder);
}

async function createPage({ folderId = null, title = '', html = '<p><br></p>', icon = '📄', coverId, source = null } = {}) {
  const now = new Date().toISOString();
  const page = {
    id: uid(),
    title,
    html,
    icon,
    cover: coverId === undefined ? COVERS[state.pages.length % (COVERS.length - 1)].id : coverId,
    folderId,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    source,
    words: countWords(htmlToText(html)),
  };
  state.pages.push(page);
  await db.put('pages', page);
  return page;
}

async function createFolder({ name, parentId = null, icon = '📁' }) {
  const folder = { id: uid(), name, icon, parentId, open: true, order: nextOrder(childFolders(state.folders, parentId)), createdAt: new Date().toISOString() };
  state.folders.push(folder);
  await saveFolder(folder);
  return folder;
}

async function saveTabs() {
  await db.setValue('tabs', state.tabs);
}

function openTab(id) {
  if (!state.tabs.includes(id)) {
    state.tabs.push(id);
    if (state.tabs.length > 8) state.tabs.shift();
    saveTabs();
  }
}

async function seed() {
  if (await db.getValue('seeded', false)) return;
  await createPage({
    title: 'Bienvenue dans Encré',
    icon: '✍️',
    coverId: 'neon',
    html: `<p>Encré transforme tes notes vocales en pages que tu peux retravailler, ranger et <b>retenir</b>.</p>
<h2>Pour commencer</h2>
<ul class="todo"><li>Tape <b>/</b> au début d’une ligne pour choisir un bloc</li><li>Écris <b>#</b> puis espace pour un titre, <b>-</b> pour une liste, <b>[]</b> pour une case à cocher</li><li>Sélectionne un passage et touche <b>✦ Retenir</b> : il rejoint ta mémoire</li><li>Touche le micro pour dicter directement dans la page</li></ul>
<div class="callout">Ce qui est encré reste ancré.</div>
<h2>Tes notes vocales</h2>
<p>Tout ce que tu racontes dans Do It arrive dans l’onglet <b>Notes</b>. Modifie une note, ou fais-en une page pour la développer et la ranger dans un dossier.</p>
<blockquote>Les paroles s’envolent, les écrits restent.</blockquote>`,
  });
  await db.setValue('seeded', true);
}

/* ───────────── Navigation ───────────── */

function parseRoute() {
  const [, name = '', id = null] = location.hash.replace(/^#/, '').split('/');
  const known = { '': 'home', notes: 'notes', note: 'note', pages: 'pages', dossiers: 'folders', memoire: 'memory', page: 'page' };
  return { name: known[name] || 'home', id: id && decodeURIComponent(id) };
}

function transition(run, coverEl) {
  if (!document.startViewTransition || reduced()) return run();
  if (coverEl) coverEl.style.viewTransitionName = 'page-cover';
  const t = document.startViewTransition(run);
  // Une navigation rapide interrompt la transition précédente : ce n'est pas une erreur.
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
}

function go(hash, coverEl) {
  if (location.hash === hash) return render(true);
  transition(() => {
    history.pushState(null, '', hash);
    state.depth += 1;
    render();
  }, coverEl);
}

function closeEditor() {
  if (state.dictation) stopDictation(true);
  state.editor?.destroy();
  state.editor = null;
  $('#bubble').hidden = true;
}

function render(force = false) {
  const hash = location.hash || '#/';
  if (!force && hash === state.lastHash) return;
  state.lastHash = hash;
  closeEditor();
  state.route = parseRoute();
  const { name, id } = state.route;
  document.body.dataset.route = name;
  renderChrome();
  const view = $('#view');
  view.classList.remove('is-in');
  if (name === 'page') renderPage(id);
  else if (name === 'note') renderNote(id);
  else if (name === 'notes') renderNotes();
  else if (name === 'pages') renderPages();
  else if (name === 'folders') renderFolders();
  else if (name === 'memory') renderMemory();
  else renderHome();
  void view.offsetWidth;
  view.classList.add('is-in');
  countUp();
  window.scrollTo(0, 0);
}

/* ───────────── Habillage : barre d'app, onglets du bas, barre latérale ───────────── */

const NAV = [
  ['home', '#/', 'home', 'Accueil'],
  ['notes', '#/notes', 'wave', 'Notes'],
  ['pages', '#/pages', 'pages', 'Pages'],
  ['folders', '#/dossiers', 'folder', 'Dossiers'],
  ['memory', '#/memoire', 'brain', 'Mémoire'],
];

function navActive(key) {
  const { name } = state.route;
  return name === key || (key === 'notes' && name === 'note') || (key === 'pages' && name === 'page');
}

function dayNav() {
  const key = selectedDay();
  const date = dateFromKey(key);
  const today = todayKey();
  const yesterday = dayKey(addDays(new Date(), -1));
  const badge = key === today ? 'Aujourd’hui' : key === yesterday ? 'Hier' : new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date);
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `<div class="daynav">
    <button class="sq soft" type="button" data-action="day" data-id="-1" aria-label="Jour précédent">${I.left}</button>
    <button class="day-pill" type="button" data-action="day" data-id="0" aria-label="Revenir à aujourd’hui"><span class="day-badge${key === today ? '' : ' is-past'}">${esc(badge)}</span><b>${esc(label)}</b></button>
    <button class="sq soft" type="button" data-action="day" data-id="1" aria-label="Jour suivant"${key >= today ? ' disabled' : ''}>${I.right}</button>
  </div>`;
}

function renderChrome() {
  const { name, id } = state.route;
  const due = dueCards(state.cards).length;
  const days = streak();

  let top;
  if (name === 'page') {
    top = `<div class="bar-row"><button class="sq" data-action="back" aria-label="Retour">${I.back}</button>
      <div class="tabs" role="tablist" aria-label="Pages ouvertes">${state.tabs.map((tid) => {
        const p = findPage(tid);
        if (!p) return '';
        const active = tid === id;
        return `<a class="tab${active ? ' is-active' : ''}" href="#/page/${tid}" data-go role="tab" aria-selected="${active}"><span class="tab-ico">${esc(p.icon)}</span><span class="tab-title">${esc(p.title || 'Sans titre')}</span><button class="tab-x" type="button" data-action="close-tab" data-id="${tid}" aria-label="Fermer l’onglet">${I.close}</button></a>`;
      }).join('')}<button class="tab-new" type="button" data-action="new-page" aria-label="Nouvelle page">${I.plus}</button></div>
      <button class="sq" data-action="page-menu" data-id="${id}" aria-label="Options de la page">${I.more}</button></div>`;
  } else if (name === 'note') {
    top = `<div class="bar-row"><button class="sq" data-action="back" aria-label="Retour">${I.back}</button><p class="top-title">Note vocale</p><a class="sq" href="../#journal" aria-label="Ouvrir Do It">${I.ext}</a></div>`;
  } else {
    top = `<div class="bar-row">
      <a class="app-ico" href="#/" data-go aria-label="Encré : accueil">${MARK}</a>
      <span class="streak" title="Jours d’écriture d’affilée">${I.drop}<span>Jour <b>${days}</b></span></span>
      <button class="switch${state.hand ? ' is-on' : ''}" type="button" data-action="toggle-hand" aria-pressed="${state.hand}" aria-label="Écriture manuscrite" title="Écriture manuscrite"><i></i></button>
      <button class="sq neon" type="button" data-action="search" aria-label="Rechercher">${I.searchLg}</button>
      <button class="sq hide-xs" type="button" data-action="shortcuts" aria-label="Raccourcis">${I.grid}</button>
      <button class="sq" type="button" data-action="settings" aria-label="Réglages">${I.sliders}</button>
    </div>${name === 'home' ? dayNav() : ''}`;
  }
  $('#topbar').innerHTML = top;
  $('#topbar .tab.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const item = ([key, href, icon, label]) => `<a href="${href}" data-go class="${navActive(key) ? 'is-active' : ''}" aria-current="${navActive(key) ? 'page' : 'false'}"><span class="tb-ico">${I[icon]}${key === 'memory' && due ? `<b class="badge">${due}</b>` : ''}</span><span class="tb-label">${label}</span></a>`;
  $('#dock').innerHTML = `${NAV.map(item).join('')}<a href="../#parler" class="tb-ext"><span class="tb-ico">${I.mic}</span><span class="tb-label">Do It</span></a>`;

  $('#sidebar').innerHTML = `<a class="side-brand" href="#/" data-go><span class="app-ico">${MARK}</span><span><b>Encré</b><small>par Do It</small></span></a>
    <nav class="side-nav">${NAV.map(([key, href, icon, label]) => `<a href="${href}" data-go class="${navActive(key) ? 'is-active' : ''}"><span class="tb-ico">${I[icon]}</span><span>${label}</span>${key === 'notes' ? `<small>${state.notes.length}</small>` : key === 'pages' ? `<small>${state.pages.length}</small>` : key === 'memory' && due ? `<small class="hot">${due}</small>` : ''}</a>`).join('')}</nav>
    <button class="btn btn-neon side-new" type="button" data-action="capture">${I.mic}Parler</button>
    <p class="side-label">${I.folder}Dossiers <button class="mini" type="button" data-action="new-folder" aria-label="Nouveau dossier">${I.plus}</button></p>
    <div class="side-tree">${treeHTML()}</div>
    <a class="side-doit" href="../#parler">${I.mic}<span>Dicter dans Do It</span>${I.ext}</a>`;
}

const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true"><path class="mark-drop" d="M16 3c4.5 6 9 10.6 9 16a9 9 0 0 1-18 0c0-5.4 4.5-10 9-16z"/><path class="mark-wave" d="M11.5 19v2M14 16.5v7M16.5 18v4M19 17v6M21.5 19.5v1.5"/></svg>`;

/* ───────────── Arbre des dossiers ───────────── */

function pageNode(p, depth) {
  const active = state.route.name === 'page' && state.route.id === p.id;
  return `<li class="node is-page" data-node="page" data-id="${p.id}" draggable="true" style="--depth:${depth}">
    <div class="row${active ? ' is-active' : ''}">
      <a class="row-main" href="#/page/${p.id}" data-go><span class="ico">${esc(p.icon || '📄')}</span><span class="name">${esc(p.title || 'Sans titre')}</span>${p.pinned ? `<span class="pinned">${I.pin}</span>` : ''}</a>
      <span class="time">${ago(p.updatedAt).replace('il y a ', '')}</span>
      <button class="more" type="button" data-action="page-menu" data-id="${p.id}" aria-label="Options">${I.more}</button>
    </div>
  </li>`;
}

function folderNode(f, depth) {
  const open = f.open !== false;
  const kids = childFolders(state.folders, f.id);
  const pages = pagesIn(state.pages, f.id);
  const inner = kids.map((k) => folderNode(k, depth + 1)).join('') + pages.map((p) => pageNode(p, depth + 1)).join('');
  return `<li class="node is-folder${open ? ' is-open' : ''}" data-node="folder" data-id="${f.id}" draggable="true" style="--depth:${depth}">
    <div class="row" data-drop="${f.id}">
      <button class="twist" type="button" data-action="toggle-folder" data-id="${f.id}" aria-expanded="${open}" aria-label="${open ? 'Replier' : 'Déplier'}">${I.chevron}</button>
      <button class="row-main" type="button" data-action="toggle-folder" data-id="${f.id}"><span class="ico">${esc(f.icon || '📁')}</span><span class="name">${esc(f.name)}</span></button>
      <span class="count">${deepCount(state.folders, state.pages, f.id)}</span>
      <button class="more" type="button" data-action="folder-menu" data-id="${f.id}" aria-label="Options du dossier">${I.more}</button>
    </div>
    ${open ? `<ul class="children">${inner || `<li class="node empty-node" style="--depth:${depth + 1}"><button type="button" data-action="new-page-in" data-id="${f.id}">${I.plus} Nouvelle page</button></li>`}</ul>` : ''}
  </li>`;
}

function treeHTML() {
  const roots = childFolders(state.folders, null);
  const loose = pagesIn(state.pages, null);
  return `<ul class="tree" role="tree">${roots.map((f) => folderNode(f, 0)).join('')}</ul>
    <div class="loose" data-drop="root"><p class="loose-label">Sans dossier</p><ul class="tree">${loose.map((p) => pageNode(p, 0)).join('') || '<li class="node empty-node"><span>Glisse une page ici</span></li>'}</ul></div>`;
}

/* ───────────── Briques d'interface ───────────── */

const LINES = [
  'Ce qui est encré reste ancré.',
  'Tu parles, Encré écrit, ta mémoire garde.',
  'Une idée notée est une idée sauvée.',
  'Écris peu, mais écris chaque jour.',
  'Les grandes pages commencent par une phrase.',
  'Ta voix d’aujourd’hui, tes notes de demain.',
  'Relire, c’est se souvenir deux fois.',
];
const QUOTE_LIST = [...LINES, ...QUOTES];
const dayIndex = (key) => Math.floor(dateFromKey(key).getTime() / 86_400_000);

function cardHead(icon, label, extra = '') {
  return `<header class="card-head"><span class="card-label">${icon}${esc(label)}</span>${extra}</header>`;
}

/** Anneau de progression (0 → 100). */
function ring(pct, caption) {
  return `<div class="ring" role="img" aria-label="${pct} % ${attr(caption)}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-fill" cx="60" cy="60" r="52" pathLength="100" style="--p:${pct}"/></svg><span class="ring-txt"><b data-count="${pct}" data-suffix="%">${pct}%</b><small>${esc(caption)}</small></span></div>`;
}

/** Points lumineux qui flottent dans les cartes héros. */
function particles(n = 9) {
  return `<span class="particles" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i style="--x:${(k * 37 + 11) % 100}%;--y:${(k * 53 + 7) % 100}%;--d:${(k % 5) * 0.9}s;--s:${k % 3 === 0 ? 5 : 3}px"></i>`).join('')}</span>`;
}

function tile({ href, label, value, unit = '', bar = 0, sub, on = false, i = 0 }) {
  return `<a class="tile" href="${href}" data-go style="--i:${i}">
    <span class="tile-top"><span class="tile-label">${esc(label)}</span><i class="dot${on ? ' on' : ''}"></i></span>
    <span class="tile-val"><b data-count="${value}">${value}</b>${unit ? `<small>${esc(unit)}</small>` : ''}</span>
    <span class="meter"><i style="--w:${Math.max(0, Math.min(1, bar)).toFixed(3)}"></i></span>
    <span class="tile-sub">${esc(sub)}</span>
  </a>`;
}

function pageRow(p, i = 0) {
  const folder = p.folderId ? findFolder(p.folderId) : null;
  return `<a class="prow" href="#/page/${p.id}" data-go style="--i:${Math.min(i, 10)}">
    <span class="prow-ico">${esc(p.icon || '📄')}</span>
    <span class="prow-body"><span class="prow-title">${esc(p.title || 'Sans titre')}</span><span class="prow-meta">${folder ? `${esc(folder.name)} · ` : ''}${ago(p.updatedAt)} · ${plural(p.words || 0, 'mot')}</span></span>
    ${p.pinned ? `<span class="prow-pin">${I.pin}</span>` : ''}${I.chevron}
  </a>`;
}

function pageCard(p, i = 0) {
  const folder = p.folderId ? findFolder(p.folderId) : null;
  return `<a class="pcard" href="#/page/${p.id}" data-go data-cover-link style="--i:${Math.min(i, 12)}">
    ${cover(p.cover || 'papier', 'sm')}
    <span class="pcard-body">
      <span class="pcard-icon">${esc(p.icon || '📄')}</span>
      <span class="pcard-title">${esc(p.title || 'Sans titre')}</span>
      <span class="pcard-text">${esc(pageText(p).slice(0, 90)) || 'Page vide'}</span>
      <span class="pcard-meta">${folder ? `${esc(folder.name)} · ` : ''}${ago(p.updatedAt)}</span>
    </span>
  </a>`;
}

function noteRow(n, i = 0) {
  const t = n.themes?.[0] ? themeOf(n.themes[0], state.noteThemes) : null;
  const linked = state.pages.some((p) => p.source?.entryId === n.id);
  return `<a class="nrow" href="#/note/${n.id}" data-go style="--i:${i}">
    <span class="nrow-ico">${t ? esc(t.emoji) : '🎙️'}</span>
    <span class="nrow-body"><span class="nrow-title">${esc(n.title || 'Note vocale')}</span><span class="nrow-text${state.hand ? ' hand' : ''}">${esc(n.summary || n.text)}</span><span class="nrow-meta">${timeLabel(n.createdAt)}${dayKey(n.createdAt) === selectedDay() ? '' : ` · ${ago(n.createdAt)}`}${linked ? ' · <em>page créée</em>' : ''}${n.pending ? ' · <em>en attente de l’IA</em>' : ''}</span></span>
    ${I.chevron}
  </a>`;
}

function searchResults(q) {
  const f = fold(q);
  const pages = state.pages.filter((p) => fold(`${p.title} ${pageText(p)}`).includes(f));
  const notes = state.notes.filter((n) => fold(`${n.title} ${n.text}`).includes(f));
  if (!pages.length && !notes.length) return `<div class="empty"><p class="empty-title">Rien trouvé</p><p>Aucune page ni note ne contient « ${esc(q)} ».</p></div>`;
  return `${pages.length ? `<p class="sr-label">Pages · ${pages.length}</p><div class="list">${pages.slice(0, 20).map((p, i) => pageRow(p, i)).join('')}</div>` : ''}
    ${notes.length ? `<p class="sr-label">Notes vocales · ${notes.length}</p><div class="list">${notes.slice(0, 20).map((n, i) => noteRow(n, i)).join('')}</div>` : ''}`;
}

function banner() {
  const due = dueCards(state.cards).length;
  const pending = state.notes.filter((n) => n.pending && !n.edited).length;
  if (due) return `<a class="banner" href="#/memoire" data-go><span class="banner-ico">${I.brain}</span><span>${plural(due, 'passage')} à revoir aujourd’hui : deux minutes pour l’ancrer.</span>${I.chevron}</a>`;
  if (!state.notes.length) return `<button class="banner" type="button" data-action="capture"><span class="banner-ico">${I.mic}</span><span>Touche le micro et raconte : Encré résume, classe et écrit pour toi.</span>${I.chevron}</button>`;
  if (pending) return `<a class="banner soft" href="#/notes" data-go><span class="banner-ico">${I.bolt}</span><span>${plural(pending, 'note attend', 'notes attendent')} l’IA : elles seront réécrites dès qu’elle répond.</span>${I.chevron}</a>`;
  const loose = state.notes.find((n) => !state.pages.some((p) => p.source?.entryId === n.id));
  if (loose) return `<a class="banner" href="#/note/${loose.id}" data-go><span class="banner-ico">${I.spark}</span><span>Fais de « ${esc(loose.title || 'ta dernière note')} » une page à développer.</span>${I.chevron}</a>`;
  return '';
}

const METRICS = { words: ['Mots', 'mot', 'mots'], notes: ['Notes', 'note', 'notes'], pages: ['Pages', 'page', 'pages'] };

function weekChart(endKey) {
  const end = dateFromKey(endKey);
  const [, one, many] = METRICS[state.metric];
  const letter = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(end, i - 6);
    const k = dayKey(d);
    return { k, d, v: dayStats(k)[state.metric] };
  });
  const max = Math.max(1, ...days.map((x) => x.v));
  const total = days.reduce((s, x) => s + x.v, 0);
  return `<section class="card chart-card">
    ${cardHead(I.chart, '7 derniers jours', `<span class="card-total">${plural(total, one, many)}</span>`)}
    <div class="seg" role="tablist" aria-label="Mesure">${Object.entries(METRICS).map(([id, [label]]) => `<button class="seg-btn${state.metric === id ? ' is-on' : ''}" type="button" role="tab" aria-selected="${state.metric === id}" data-action="metric" data-id="${id}">${label}</button>`).join('')}</div>
    <div class="bars7">${days.map((x) => `<button class="bar${x.k === endKey ? ' is-sel' : ''}${x.v ? '' : ' is-zero'}" type="button" data-action="pick-day" data-id="${x.k}" style="--h:${(x.v / max).toFixed(3)}" aria-label="${attr(longDate(x.d))} : ${attr(plural(x.v, one, many))}"><span class="bar-val">${x.v}</span><span class="bar-col"><i></i></span><span class="bar-day">${letter.format(x.d).toUpperCase()}</span></button>`).join('')}</div>
  </section>`;
}

/* ───────────── Accueil : ma journée ───────────── */

function renderHome() {
  const key = selectedDay();
  const isToday = key === todayKey();
  const st = dayStats(key);
  const pct = Math.min(100, Math.round((100 * st.words) / state.goal));
  const left = Math.max(0, state.goal - st.words);
  const due = dueCards(state.cards);
  const recent = sortRecent(state.pages);
  const last = recent[0];
  const pinned = recent.filter((p) => p.pinned);
  const roots = childFolders(state.folders, null);
  const days = streak();
  const linked = state.notes.filter((n) => state.pages.some((p) => p.source?.entryId === n.id)).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const fresh = state.pages.filter((p) => new Date(p.updatedAt).getTime() > weekAgo).length;
  const noteList = st.list.length ? st.list : isToday ? state.notes.slice(0, 3) : [];
  const noteLabel = st.list.length ? (isToday ? 'Notes du jour' : 'Notes de ce jour') : 'Dernières notes';
  const line = LINES[dayIndex(key) % LINES.length];
  const quote = QUOTE_LIST[(dayIndex(key) + state.quote) % QUOTE_LIST.length];

  $('#view').innerHTML = `<section class="view home">
    <header class="phead">
      <div><h1>${isToday ? 'Ma journée' : esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(dateFromKey(key)).replace(/^./, (c) => c.toUpperCase()))}</h1><p>${isToday ? 'Ton encre du jour, en un coup d’œil' : esc(longDate(dateFromKey(key)))}</p></div>
      <button class="sq neon lg" type="button" data-action="capture" aria-label="Parler : nouvelle note vocale">${I.mic}</button>
    </header>

    <div class="cols">
      <div class="col">
        <section class="hero-card">
          ${particles()}
          <p class="hc-label">${isToday ? 'Objectif du jour' : 'Ce jour-là'} · ${plural(state.goal, 'mot')}</p>
          <div class="hc-top">
            <p class="hc-big"><span class="hc-num${st.words >= 1000 ? ' is-long' : ''}" data-count="${st.words}">${st.words.toLocaleString('fr-FR')}</span><span class="hc-side">${st.words > 1 ? 'mots<br>encrés' : 'mot<br>encré'}</span></p>
            ${ring(pct, 'de l’objectif')}
          </div>
          <p class="hc-next">${pct >= 100 ? '<b>Objectif atteint.</b> Tout ce que tu ajoutes est du bonus.' : isToday ? `Encore <b>${plural(left, 'mot')}</b> pour boucler ta journée.` : `Il manquait <b>${plural(left, 'mot')}</b> ce jour-là.`}</p>
          <p class="hc-line"><i></i>${esc(line)}</p>
          ${isToday ? `<div class="hc-ask"><p>Qu’est-ce qui t’a marqué aujourd’hui ?</p><div class="pills"><button class="pill neon" type="button" data-action="capture">${I.mic}Le raconter</button><button class="pill" type="button" data-action="new-page">${I.pen}L’écrire</button></div></div>` : ''}
          <div class="hc-stats">
            <div><b data-count="${st.notes}">${st.notes}</b><span>${st.notes > 1 ? 'notes vocales' : 'note vocale'}</span></div>
            <div><b data-count="${st.pages}">${st.pages}</b><span>${st.pages > 1 ? 'pages écrites' : 'page écrite'}</span></div>
            <div><b data-count="${days}">${days}</b><span>${days > 1 ? 'jours d’affilée' : 'jour d’affilée'}</span></div>
          </div>
        </section>

        ${banner()}

        <section class="card">
          ${cardHead(I.wave, noteLabel, `<a class="pill sm" href="#/notes" data-go>Toutes · ${state.notes.length}</a>`)}
          ${noteList.length ? `<div class="list">${noteList.map((n, i) => noteRow(n, i)).join('')}</div>` : `<div class="empty-inline"><p>${isToday ? 'Pas encore de note vocale.' : 'Aucune note ce jour-là.'}</p>${isToday ? `<button class="pill neon" type="button" data-action="capture">${I.mic}Parler</button>` : ''}</div>`}
        </section>

        ${weekChart(key)}
      </div>

      <div class="col">
        <section class="card">
          ${cardHead(I.grid, 'Mes dossiers', `<a class="pill sm" href="#/dossiers" data-go>Tous · ${state.folders.length}</a>`)}
          <div class="apps">${roots.slice(0, 7).map((f, i) => `<a class="app" href="#/dossiers" data-go data-open-folder="${f.id}" style="--i:${i}"><span class="app-tile v${i % 4}">${esc(f.icon)}</span><span class="app-name">${esc(f.name)}</span></a>`).join('')}<button class="app" type="button" data-action="new-folder" style="--i:${Math.min(roots.length, 7)}"><span class="app-tile add">${I.plus}</span><span class="app-name">Nouveau</span></button></div>
        </section>

        <button class="card quote-card" type="button" data-action="next-quote">
          <span class="q-top"><span class="q-mark">${I.quote}</span><span class="q-hint">${I.shuffle}Toucher pour changer</span></span>
          <span class="q-text">${esc(quote)}</span>
          <span class="q-src">Encré · phrase du jour</span>
        </button>

        <div class="chips scroll">
          <button class="chip" type="button" data-action="new-page">${I.plus}Nouvelle page</button>
          <button class="chip" type="button" data-action="dictate-page">${I.mic}Dicter une page</button>
          <button class="chip" type="button" data-action="new-folder">${I.folderPlus}Nouveau dossier</button>
          <a class="chip" href="../#journal">${I.ext}Journal Do It</a>
        </div>

        <div class="tiles">
          ${tile({ href: '#/pages', label: 'Mots', value: st.words, unit: `/ ${state.goal}`, bar: st.words / state.goal, sub: pct >= 100 ? 'Objectif atteint' : 'Objectif du jour', on: pct >= 100, i: 0 })}
          ${tile({ href: '#/notes', label: 'Notes', value: state.notes.length, unit: state.notes.length > 1 ? 'notes' : 'note', bar: state.notes.length ? linked / state.notes.length : 0, sub: `${plural(linked, 'devenue page', 'devenues pages')}`, on: st.notes > 0, i: 1 })}
          ${tile({ href: '#/pages', label: 'Pages', value: state.pages.length, unit: state.pages.length > 1 ? 'pages' : 'page', bar: state.pages.length ? fresh / state.pages.length : 0, sub: plural(fresh, 'active cette semaine', 'actives cette semaine'), on: st.pages > 0, i: 2 })}
          ${tile({ href: '#/memoire', label: 'Mémoire', value: Math.round(100 * avgMastery()), unit: '%', bar: avgMastery(), sub: due.length ? `${plural(due.length, 'passage')} à revoir` : state.cards.length ? 'Tout est à jour' : 'Rien à retenir encore', on: due.length > 0, i: 3 })}
        </div>

        ${last ? `<a class="card feature" href="#/page/${last.id}" data-go>
          <span class="feat-head"><span class="feat-ico">${I.pen}</span><span class="card-label">Reprendre l’écriture</span></span>
          <span class="feat-title">${esc(last.icon || '📄')} ${esc(last.title || 'Sans titre')}</span>
          <span class="feat-text">${esc(pageText(last).slice(0, 140))}</span>
          <span class="feat-link">Modifiée ${ago(last.updatedAt)} · ${plural(last.words || 0, 'mot')}${I.ext}</span>
        </a>` : ''}

        ${pinned.length ? `<section class="card">${cardHead(I.pin, 'Épinglées')}<div class="list">${pinned.map((p, i) => pageRow(p, i)).join('')}</div></section>` : ''}
      </div>
    </div>
  </section>`;
}

function avgMastery() {
  if (!state.cards.length) return 0;
  return state.cards.reduce((s, c) => s + mastery(c), 0) / state.cards.length;
}

/* ───────────── Notes vocales ───────────── */

function filteredNotes() {
  const q = fold(state.noteQuery.trim());
  return state.notes.filter((n) => (state.noteFilter === 'all' || n.themes?.includes(state.noteFilter)) && (!q || fold(`${n.title} ${n.text}`).includes(q)));
}

function renderNotes() {
  const counts = new Map();
  for (const n of state.notes) for (const t of n.themes || []) counts.set(t, (counts.get(t) || 0) + 1);
  const themes = [...counts].sort((a, b) => b[1] - a[1]);
  if (state.noteFilter !== 'all' && !counts.has(state.noteFilter)) state.noteFilter = 'all';
  const list = filteredNotes();
  const linked = state.notes.filter((n) => state.pages.some((p) => p.source?.entryId === n.id)).length;
  const week = state.notes.filter((n) => Date.now() - new Date(n.createdAt).getTime() < 7 * 86_400_000).length;
  const top = themes[0] ? themeOf(themes[0][0], state.noteThemes) : null;

  $('#view').innerHTML = `<section class="view notes">
    <header class="phead">
      <div><h1>Notes vocales</h1><p>Résumées par l’IA et classées par thème</p></div>
      <button class="sq neon lg" type="button" data-action="capture" aria-label="Nouvelle note vocale">${I.mic}</button>
    </header>

    <section class="hero-card compact">
      ${particles(6)}
      <p class="hc-label">Ta voix, mise au propre</p>
      <div class="hc-top">
        <p class="hc-big"><span class="hc-num" data-count="${state.notes.length}">${state.notes.length}</span><span class="hc-side">${state.notes.length > 1 ? 'notes<br>encrées' : 'note<br>encrée'}</span></p>
        <button class="sq neon lg hc-act" type="button" data-action="capture" aria-label="Parler">${I.bolt}</button>
      </div>
      <div class="hc-stats">
        <div><b data-count="${week}">${week}</b><span>cette semaine</span></div>
        <div><b data-count="${linked}">${linked}</b><span>${linked > 1 ? 'devenues pages' : 'devenue page'}</span></div>
        <div><b>${top ? esc(top.emoji) : '—'}</b><span>${top ? esc(top.label) : 'thème phare'}</span></div>
      </div>
    </section>

    <label class="search">${I.search}<input id="notes-search" type="search" placeholder="Rechercher une note" value="${attr(state.noteQuery)}" autocomplete="off"></label>
    ${themes.length ? `<div class="chips scroll">
      <button class="chip${state.noteFilter === 'all' ? ' is-active' : ''}" type="button" data-action="note-filter" data-id="all">Toutes <small>${state.notes.length}</small></button>
      ${themes.map(([id, c]) => {
        const t = themeOf(id, state.noteThemes);
        return `<button class="chip${state.noteFilter === id ? ' is-active' : ''}" type="button" data-action="note-filter" data-id="${attr(id)}">${esc(t.emoji)} ${esc(t.label)} <small>${c}</small></button>`;
      }).join('')}
    </div>` : ''}
    <div class="ncards" id="note-list">${noteCards(list)}</div>
  </section>`;
}

function noteCards(list) {
  const short = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return list.length ? list.map((n, i) => {
      const mood = moodOf(n.mood);
      const linked = state.pages.find((p) => p.source?.entryId === n.id);
      return `<a class="ncard" href="#/note/${n.id}" data-go style="--i:${Math.min(i, 10)}">
        <span class="ncard-top"><span class="card-label">${esc(short.format(new Date(n.createdAt)))} · ${timeLabel(n.createdAt)}</span><span class="mood" title="${esc(mood.label)}">${mood.emoji}</span></span>
        <span class="ncard-title">${esc(n.title || 'Note vocale')}</span>
        <span class="ncard-text${state.hand ? ' hand' : ''}">${esc(n.summary || n.text)}</span>
        <span class="ncard-foot">${(n.themes || []).map((id) => {
          const t = themeOf(id, state.noteThemes);
          return `<span class="tag">${esc(t.emoji)} ${esc(t.label)}</span>`;
        }).join('')}${linked ? `<span class="tag is-neon">${I.page} Page</span>` : ''}${n.pending ? '<span class="tag">⏳ IA</span>' : ''}</span>
      </a>`;
    }).join('') : state.notes.length
      ? '<div class="empty"><p class="empty-title">Aucune note ne correspond</p><p>Essaie un autre mot ou un autre thème.</p></div>'
      : '<button class="empty empty-btn" type="button" data-action="capture"><span class="empty-title">Pas encore de note vocale</span>Touche le micro et raconte : Encré résume, range par thème et écrit à la main.</button>';
}

let noteTimer = 0;
function renderNote(id) {
  const n = findNote(id);
  if (!n) {
    $('#view').innerHTML = '<section class="view"><div class="empty"><p class="empty-title">Note introuvable</p><p>Elle a peut-être été supprimée dans Do It.</p><a class="btn" href="#/notes" data-go>Retour aux notes</a></div></section>';
    return;
  }
  const mood = moodOf(n.mood);
  const linked = state.pages.find((p) => p.source?.entryId === n.id);
  const short = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#view').innerHTML = `<article class="note-page">
    <section class="hero-card note-hero">
      ${particles(7)}
      <p class="hc-label">${esc(short.format(new Date(n.createdAt)))} · ${timeLabel(n.createdAt)}</p>
      <h1 class="page-title" id="note-title" contenteditable="true" spellcheck="true" data-ph="Sans titre">${attr(n.title)}</h1>
      <div class="tags">${(n.themes || []).map((tid) => {
        const t = themeOf(tid, state.noteThemes);
        return `<span class="tag">${esc(t.emoji)} ${esc(t.label)}</span>`;
      }).join('')}<span class="tag">${mood.emoji} ${esc(mood.label)}</span></div>
      <div class="hc-stats">
        <div><b>${wordCount(n.text)}</b><span>mots</span></div>
        <div><b>${n.segments?.length || 1}</b><span>${(n.segments?.length || 1) > 1 ? 'prises de parole' : 'prise de parole'}</span></div>
        <div><b>${n.source === 'ai' ? 'IA' : n.pending ? '⏳' : '—'}</b><span>${n.source === 'ai' ? 'résumé' : n.pending ? 'en attente' : 'sans IA'}</span></div>
      </div>
    </section>

    <section class="card paper">
      <header class="card-head"><span class="card-label">${I.pen}La note</span><button class="hand-toggle" type="button" data-action="toggle-hand">${state.hand ? 'Aa Classique' : '✍︎ Manuscrit'}</button></header>
      <div class="doc${state.hand ? ' is-hand' : ''}" id="note-doc" contenteditable="true" spellcheck="true">${String(n.text || '').split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${attr(p.trim())}</p>`).join('') || '<p><br></p>'}</div>
      <p class="page-meta"><span class="save" id="save-state" data-state="saved">Enregistré dans Do It</span></p>
    </section>

    ${n.highlights?.length ? `<section class="card keypoints">${cardHead(I.spark, 'Points clés')}<ul>${n.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></section>` : ''}
    ${n.followUp ? `<section class="note-followup"><p><span>Encré te relance</span>« ${esc(n.followUp)} »</p><button class="pill neon" type="button" data-action="capture-reply" data-id="${n.id}">${I.mic}Répondre à voix haute</button></section>` : ''}
    <div class="note-actions">
      <button class="btn btn-neon" type="button" data-action="note-to-page" data-id="${n.id}">${linked ? `${I.page}Ouvrir la page` : `${I.spark}Transformer en page`}</button>
      <a class="btn" href="../#journal">${I.ext}Voir dans Do It</a>
    </div>
    ${n.segments?.length ? `<details class="card raw"><summary><span class="card-label">${I.wave}Ce que tu as dit</span><small>${plural(n.segments.length, 'prise')}</small></summary>${n.segments.map((s) => `<div class="raw-seg">${s.question ? `<p class="raw-q">« ${esc(s.question)} »</p>` : ''}<p>${esc(s.text)}</p></div>`).join('')}</details>` : ''}
  </article>`;

  const save = () => {
    clearTimeout(noteTimer);
    setSave('dirty', 'Modification…');
    noteTimer = setTimeout(async () => {
      const title = $('#note-title')?.innerText.trim() || n.title;
      const text = $$('#note-doc > *').map((el) => el.innerText.trim()).filter(Boolean).join('\n\n');
      const updated = await saveVoiceNote(n, { title, text });
      Object.assign(n, updated);
      setSave('saved', 'Enregistré dans Do It');
    }, 600);
  };
  $('#note-title').addEventListener('input', save);
  $('#note-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#note-doc').focus();
    }
  });
  $('#note-doc').addEventListener('input', save);
  $('#note-doc').addEventListener('focus', () => document.execCommand('defaultParagraphSeparator', false, 'p'));
}

async function noteToPage(id) {
  const n = findNote(id);
  if (!n) return;
  const existing = state.pages.find((p) => p.source?.entryId === n.id);
  if (existing) return go(`#/page/${existing.id}`);
  let folder = state.folders.find((f) => f.system === 'voice');
  if (!folder) {
    folder = await createFolder({ name: 'Notes vocales', icon: '🎙️' });
    folder.system = 'voice';
    await saveFolder(folder);
  }
  const t = n.themes?.[0] ? themeOf(n.themes[0], state.noteThemes) : null;
  const page = await createPage({
    title: n.title || 'Note vocale',
    html: noteToHtml(n),
    icon: t?.emoji || '🎙️',
    coverId: 'onde',
    folderId: folder.id,
    source: { type: 'voice', entryId: n.id, createdAt: n.createdAt },
  });
  toast('✦ Page créée à partir de ta note');
  go(`#/page/${page.id}`);
}

/* ───────────── Page ───────────── */

function setSave(stateName, label) {
  const el = $('#save-state');
  if (!el) return;
  el.dataset.state = stateName;
  el.textContent = label || (stateName === 'saved' ? 'Enregistré' : 'Modification…');
}

function stats(page) {
  const words = page.words || 0;
  const minutes = Math.max(1, Math.round(words / 230));
  return `${plural(words, 'mot')} · ${minutes} min de lecture`;
}

let titleTimer = 0;
function renderPage(id) {
  const page = findPage(id);
  if (!page) {
    state.tabs = state.tabs.filter((t) => t !== id);
    saveTabs();
    $('#view').innerHTML = '<section class="view"><div class="empty"><p class="empty-title">Page introuvable</p><p>Elle a peut-être été supprimée.</p><a class="btn" href="#/" data-go>Accueil</a></div></section>';
    return;
  }
  openTab(id);
  renderChrome();
  const path = page.folderId ? folderPath(state.folders, page.folderId) : [];
  $('#view').innerHTML = `<article class="page" data-page="${page.id}">
    ${page.cover ? `<div class="cover lg" data-cover="${attr(page.cover)}" style="view-transition-name:page-cover">${coverLayers}<button class="cover-btn" type="button" data-action="page-cover">${I.image}Couverture</button></div>` : '<div class="cover-space"></div>'}
    <div class="page-inner">
      <button class="page-icon" type="button" data-action="page-icon" aria-label="Changer l’icône">${esc(page.icon || '📄')}</button>
      <nav class="crumbs">
        <button type="button" data-action="page-move" data-id="${page.id}">${I.folder}${path.length ? path.map((f) => `<span>${esc(f.name)}</span>`).join('<i>/</i>') : '<span>Sans dossier</span>'}</button>
        ${page.cover ? '' : `<button type="button" data-action="page-cover">${I.image}Ajouter une couverture</button>`}
      </nav>
      <h1 class="page-title" id="page-title" contenteditable="true" spellcheck="true" data-ph="Sans titre">${attr(page.title)}</h1>
      <p class="page-meta"><span class="save" id="save-state" data-state="saved">Enregistré</span><span id="page-stats">${stats(page)}</span></p>
      ${page.source?.type === 'voice' ? `<a class="source" href="#/note/${page.source.entryId}" data-go>${I.wave}Née d’une note vocale du ${longDate(page.source.createdAt).toLowerCase()}</a>` : ''}
      <div class="doc" id="doc"></div>
    </div>
  </article>`;

  state.editor = createEditor($('#doc'), {
    html: page.html,
    onDirty: () => setSave('dirty'),
    onChange: async (html) => {
      const words = countWords(htmlToText(html));
      await savePage(page, { html, words });
      setSave('saved');
      const st = $('#page-stats');
      if (st) st.textContent = stats(page);
    },
    onCommand: (cmd) => (cmd === 'dictate' ? startDictation() : insertVoiceNote()),
    onError: (msg) => toast(msg),
    onState: updateToolbar,
  });

  const title = $('#page-title');
  title.addEventListener('input', () => {
    setSave('dirty');
    clearTimeout(titleTimer);
    titleTimer = setTimeout(async () => {
      await savePage(page, { title: title.innerText.replace(/\s+/g, ' ').trim() });
      setSave('saved');
      const tab = $(`#topbar .tab[href="#/page/${page.id}"] .tab-title`);
      if (tab) tab.textContent = typo(page.title || 'Sans titre');
    }, 400);
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      state.editor?.root.focus();
    }
  });
  title.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });
  if (!page.title && !pageText(page)) setTimeout(() => title.focus(), 350);
}

/* ───────────── Barre d'édition et bulle de sélection ───────────── */

function updateToolbar(s) {
  for (const [key, on] of Object.entries({ bold: s.bold, italic: s.italic, underline: s.underline, strike: s.strike, mark: s.mark, todo: s.block === 'todo', ul: s.block === 'ul' })) {
    $(`#toolbar [data-tb="${key}"]`)?.classList.toggle('is-on', Boolean(on));
    $(`#bubble [data-tb="${key}"]`)?.classList.toggle('is-on', Boolean(on));
  }
  const label = { p: 'Texte', h1: 'Titre 1', h2: 'Titre 2', h3: 'Titre 3', ul: 'Liste', ol: 'Liste 1.', todo: 'Tâches', quote: 'Citation', callout: 'Encadré' }[s.block] || 'Texte';
  const blockBtn = $('#toolbar [data-tb="block"] span');
  if (blockBtn) blockBtn.textContent = label;

  const bubble = $('#bubble');
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine || !s.rect || s.collapsed) {
    bubble.hidden = true;
    return;
  }
  bubble.hidden = false;
  const w = bubble.offsetWidth;
  const top = s.rect.top > 70 ? s.rect.top - bubble.offsetHeight - 10 : s.rect.bottom + 10;
  bubble.style.top = `${top}px`;
  bubble.style.left = `${Math.min(window.innerWidth - w - 10, Math.max(10, s.rect.left + s.rect.width / 2 - w / 2))}px`;
}

async function toolbarAction(key) {
  const ed = state.editor;
  if (!ed) return;
  if (key === 'bold' || key === 'italic' || key === 'underline') return ed.inline(key);
  if (key === 'strike') return ed.inline('strikeThrough');
  if (key === 'mark') return ed.mark();
  if (key === 'todo' || key === 'ul') return ed.setBlock(ed.blockType() === key ? 'p' : key);
  if (key === 'dictate') return state.dictation ? stopDictation() : startDictation();
  if (key === 'done') {
    document.activeElement?.blur();
    return;
  }
  if (key === 'retain') return retain();
  if (key === 'block') {
    ed.saveSelection();
    const id = await pickBlock();
    if (!id) return;
    ed.restoreSelection();
    ed.runBlockCommand(id);
  }
}

function retain() {
  const ed = state.editor;
  const page = findPage(state.route.id);
  if (!ed || !page) return;
  const id = uid();
  const text = ed.mark(id);
  if (!text) {
    toast('Sélectionne d’abord le passage à retenir.');
    return;
  }
  const card = newCard({ id, text, pageId: page.id });
  state.cards.push(card);
  db.put('cards', card);
  toast('✦ Passage ajouté à ta mémoire');
  renderChrome();
}

/* ───────────── Dictée dans une page ───────────── */

function startDictation() {
  if (!state.editor) return;
  if (!isSpeechSupported()) {
    toast('La dictée n’est pas disponible sur ce navigateur : ouvre Encré dans Chrome ou Safari.');
    return;
  }
  state.editor.saveSelection();
  const panel = $('#dictation');
  const live = $('#dictation-text');
  live.textContent = '';
  panel.hidden = false;
  panel.classList.add('is-on');
  $('#toolbar [data-tb="dictate"]')?.classList.add('is-rec');
  const bars = $$('#dictation .bars i');
  let energy = 0;
  const d = new Dictation({
    onText: (finalText, interim) => {
      live.innerHTML = `${esc(finalText)} <span class="interim">${esc(interim)}</span>`;
      live.scrollTop = live.scrollHeight;
    },
    onActivity: () => {
      energy = 1;
    },
    onError: (msg) => {
      toast(msg);
      stopDictation();
    },
  });
  const tick = () => {
    energy *= 0.9;
    bars.forEach((b, i) => b.style.setProperty('--v', (0.15 + Math.abs(Math.sin(Date.now() / 160 + i)) * (0.25 + energy * 0.75)).toFixed(2)));
    if (state.dictation) state.dictation.raf = requestAnimationFrame(tick);
  };
  state.dictation = { d, raf: 0 };
  try {
    d.start();
  } catch {
    stopDictation(true);
    return;
  }
  tick();
}

async function stopDictation(cancel = false) {
  const cur = state.dictation;
  if (!cur) return;
  state.dictation = null;
  cancelAnimationFrame(cur.raf);
  $('#toolbar [data-tb="dictate"]')?.classList.remove('is-rec');
  const panel = $('#dictation');
  panel.classList.remove('is-on');
  setTimeout(() => {
    if (!state.dictation) panel.hidden = true;
  }, 300);
  if (cancel) {
    cur.d.cancel();
    return;
  }
  const text = (await cur.d.stop()).trim();
  if (!text) {
    toast('Je n’ai rien entendu.');
    return;
  }
  const clean = cleanTranscript(text);
  state.editor?.insertBlocks(clean.split(/\n{2,}/).map((p) => `<p>${attr(p)}</p>`).join(''));
  toast('🎙 Dictée ajoutée à la page');
}

async function insertVoiceNote() {
  const note = await pickNote();
  if (!note || !state.editor) return;
  const paras = String(note.text || '').split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${attr(p.trim())}</p>`).join('');
  state.editor.insertBlocks(`<h3>${attr(note.title || 'Note vocale')}</h3>${paras}`);
  toast('Note vocale insérée');
}

/* ───────────── Dossiers ───────────── */

const SORTS = { recent: 'Récentes', pinned: 'Épinglées', az: 'A → Z' };

function renderPages() {
  let list = sortRecent(state.pages);
  if (state.pageSort === 'pinned') list = list.filter((p) => p.pinned);
  if (state.pageSort === 'az') list = [...state.pages].sort((a, b) => (a.title || 'Sans titre').localeCompare(b.title || 'Sans titre', 'fr'));
  const words = state.pages.reduce((s, p) => s + (p.words || 0), 0);
  const fromVoice = state.pages.filter((p) => p.source?.type === 'voice').length;

  $('#view').innerHTML = `<section class="view pages">
    <header class="phead">
      <div><h1>Pages</h1><p>Écris, mets en forme, retiens</p></div>
      <button class="sq neon lg" type="button" data-action="new-page" aria-label="Nouvelle page">${I.plus}</button>
    </header>

    <section class="hero-card compact">
      ${particles(6)}
      <p class="hc-label">Ta bibliothèque</p>
      <div class="hc-top">
        <p class="hc-big"><span class="hc-num${words >= 1000 ? ' is-long' : ''}" data-count="${words}">${words.toLocaleString('fr-FR')}</span><span class="hc-side">${words > 1 ? 'mots<br>écrits' : 'mot<br>écrit'}</span></p>
        <button class="sq neon lg hc-act" type="button" data-action="dictate-page" aria-label="Dicter une page">${I.mic}</button>
      </div>
      <div class="hc-stats">
        <div><b data-count="${state.pages.length}">${state.pages.length}</b><span>${state.pages.length > 1 ? 'pages' : 'page'}</span></div>
        <div><b data-count="${state.folders.length}">${state.folders.length}</b><span>${state.folders.length > 1 ? 'dossiers' : 'dossier'}</span></div>
        <div><b data-count="${fromVoice}">${fromVoice}</b><span>nées d’une note</span></div>
      </div>
    </section>

    <div class="seg wide" role="tablist" aria-label="Trier">${Object.entries(SORTS).map(([id, label]) => `<button class="seg-btn${state.pageSort === id ? ' is-on' : ''}" type="button" role="tab" aria-selected="${state.pageSort === id}" data-action="page-sort" data-id="${id}">${label}</button>`).join('')}</div>
    ${list.length ? `<div class="pgrid">${list.map((p, i) => pageCard(p, i)).join('')}</div>` : state.pageSort === 'pinned' ? '<div class="empty"><p class="empty-title">Aucune page épinglée</p><p>Dans une page, touche ⋯ puis « Épingler ».</p></div>' : `<button class="empty empty-btn" type="button" data-action="new-page"><span class="empty-title">Ta première page t’attend</span>Touche ici pour commencer à écrire.</button>`}
  </section>`;
}

function renderFolders() {
  const roots = childFolders(state.folders, null);
  $('#view').innerHTML = `<section class="view folders">
    <header class="phead">
      <div><h1>Dossiers</h1><p>${plural(state.folders.length, 'dossier')} · ${plural(state.pages.length, 'page')}</p></div>
      <button class="sq neon lg" type="button" data-action="new-folder" aria-label="Nouveau dossier">${I.folderPlus}</button>
    </header>
    ${roots.length ? `<section class="card">
      ${cardHead(I.grid, 'Mes dossiers', `<span class="pill sm">Tous · ${state.folders.length}</span>`)}
      <div class="apps">${roots.map((f, i) => `<button class="app" type="button" data-action="folder-menu" data-id="${f.id}" style="--i:${Math.min(i, 12)}"><span class="app-tile v${i % 4}">${esc(f.icon)}</span><span class="app-name">${esc(f.name)}</span><span class="app-count">${plural(deepCount(state.folders, state.pages, f.id), 'page')}</span></button>`).join('')}</div>
    </section>` : ''}
    <section class="card explorer">
      ${cardHead(I.folder, 'Arborescence', `<button class="pill sm" type="button" data-action="new-page">${I.plus}Page</button>`)}
      <p class="card-hint">Glisse une page sur un dossier, ou touche ⋯ pour la ranger.</p>
      ${treeHTML()}
    </section>
  </section>`;
}

async function moveTo(kind, id, targetId) {
  const target = targetId === 'root' ? null : targetId;
  if (kind === 'page') {
    const p = findPage(id);
    if (!p || (p.folderId ?? null) === target) return;
    await savePage(p, { folderId: target });
    if (target) {
      const f = findFolder(target);
      if (f && f.open === false) {
        f.open = true;
        await saveFolder(f);
      }
    }
    toast(target ? `Rangée dans « ${findFolder(target)?.name} »` : 'Rangée hors dossier');
  } else {
    const f = findFolder(id);
    if (!f || f.id === target || (f.parentId ?? null) === target) return;
    if (!canMoveFolder(state.folders, id, target)) {
      toast('Un dossier ne peut pas aller dans un de ses sous-dossiers.');
      return;
    }
    f.parentId = target;
    f.order = nextOrder(childFolders(state.folders, target));
    await saveFolder(f);
    toast('Dossier déplacé');
  }
  refresh();
}

function refresh() {
  renderChrome();
  const { name, id } = state.route;
  if (name === 'folders') renderFolders();
  else if (name === 'pages') renderPages();
  else if (name === 'home') renderHome();
  else if (name === 'notes') renderNotes();
  else if (name === 'memory') renderMemory();
  else if (name === 'page') {
    const page = findPage(id);
    const crumbs = $('.crumbs button[data-action="page-move"]');
    if (page && crumbs) {
      const path = page.folderId ? folderPath(state.folders, page.folderId) : [];
      crumbs.innerHTML = `${I.folder}${path.length ? path.map((f) => `<span>${esc(f.name)}</span>`).join('<i>/</i>') : '<span>Sans dossier</span>'}`;
    }
  }
}

async function deleteFolder(id) {
  const f = findFolder(id);
  if (!f) return;
  const ids = descendantIds(state.folders, id);
  const inside = state.pages.filter((p) => p.folderId && ids.has(p.folderId));
  const ok = await askConfirm({
    title: `Supprimer « ${f.name} » ?`,
    message: inside.length ? `${plural(inside.length, 'page')} ${inside.length > 1 ? 'seront rangées' : 'sera rangée'} dans « Sans dossier ». Aucune page n’est effacée.` : 'Le dossier est vide.',
    confirm: 'Supprimer le dossier',
    danger: true,
  });
  if (!ok) return;
  for (const p of inside) await savePage(p, { folderId: null });
  for (const fid of ids) await db.remove('folders', fid);
  state.folders = state.folders.filter((x) => !ids.has(x.id));
  toast('Dossier supprimé');
  refresh();
}

async function deletePage(id) {
  const p = findPage(id);
  if (!p) return;
  const ok = await askConfirm({ title: `Supprimer « ${p.title || 'Sans titre'} » ?`, message: 'La page sera effacée de cet appareil. Les passages retenus restent dans ta mémoire.', confirm: 'Supprimer la page', danger: true });
  if (!ok) return;
  state.pages = state.pages.filter((x) => x.id !== id);
  state.tabs = state.tabs.filter((t) => t !== id);
  await db.remove('pages', id);
  await saveTabs();
  toast('Page supprimée');
  if (state.route.name === 'page' && state.route.id === id) go(state.tabs.length ? `#/page/${state.tabs.at(-1)}` : '#/');
  else refresh();
}

async function pageMenu(id) {
  const p = findPage(id);
  if (!p) return;
  const onPage = state.route.name === 'page' && state.route.id === id;
  const choice = await openMenu(p.title || 'Sans titre', [
    !onPage && { id: 'open', icon: I.page, label: 'Ouvrir' },
    { id: 'pin', icon: I.pin, label: p.pinned ? 'Désépingler' : 'Épingler sur l’accueil' },
    { id: 'move', icon: I.move, label: 'Déplacer vers…' },
    onPage && { id: 'icon', icon: I.smile, label: 'Changer l’icône' },
    onPage && { id: 'cover', icon: I.image, label: 'Changer la couverture' },
    { id: 'duplicate', icon: I.copy, label: 'Dupliquer' },
    { id: 'export', icon: I.download, label: 'Exporter en Markdown' },
    { id: 'delete', icon: I.trash, label: 'Supprimer', danger: true },
  ]);
  if (choice === 'open') go(`#/page/${id}`);
  if (choice === 'pin') {
    await savePage(p, { pinned: !p.pinned });
    toast(p.pinned ? 'Épinglée sur l’accueil' : 'Désépinglée');
    refresh();
  }
  if (choice === 'move') await movePageDialog(id);
  if (choice === 'icon') await changeIcon(p);
  if (choice === 'cover') await changeCover(p);
  if (choice === 'duplicate') {
    state.editor?.flush();
    const copy = await createPage({ title: `${p.title || 'Sans titre'} (copie)`, html: p.html, icon: p.icon, coverId: p.cover, folderId: p.folderId });
    toast('Page dupliquée');
    go(`#/page/${copy.id}`);
  }
  if (choice === 'export') {
    state.editor?.flush();
    download(`${slugify(p.title || 'page') || 'page'}.md`, toMarkdown(p.title, p.html), 'text/markdown;charset=utf-8');
  }
  if (choice === 'delete') await deletePage(id);
}

async function folderMenu(id) {
  const f = findFolder(id);
  if (!f) return;
  const choice = await openMenu(`${f.icon} ${f.name}`, [
    { id: 'page', icon: I.plus, label: 'Nouvelle page ici' },
    { id: 'sub', icon: I.folderPlus, label: 'Nouveau sous-dossier' },
    { id: 'rename', icon: I.pencil, label: 'Renommer' },
    { id: 'icon', icon: I.smile, label: 'Changer l’icône' },
    { id: 'move', icon: I.move, label: 'Déplacer vers…' },
    { id: 'delete', icon: I.trash, label: 'Supprimer le dossier', danger: true },
  ]);
  if (choice === 'page') newPageIn(id);
  if (choice === 'sub') await newFolder(id);
  if (choice === 'rename') {
    const name = await askText({ title: 'Renommer le dossier', value: f.name, confirm: 'Renommer' });
    if (name) {
      f.name = name;
      await saveFolder(f);
      refresh();
    }
  }
  if (choice === 'icon') {
    const emoji = await pickEmoji(f.icon);
    if (emoji) {
      f.icon = emoji;
      await saveFolder(f);
      refresh();
    }
  }
  if (choice === 'move') {
    const target = await pickFolder({ title: `Déplacer « ${f.name} »`, exclude: descendantIds(state.folders, id), current: f.parentId ?? null });
    if (target !== undefined) await moveTo('folder', id, target ?? 'root');
  }
  if (choice === 'delete') await deleteFolder(id);
}

async function movePageDialog(id) {
  const p = findPage(id);
  const target = await pickFolder({ title: `Ranger « ${p.title || 'Sans titre'} »`, current: p.folderId ?? null, allowNew: true });
  if (target === undefined) return;
  await moveTo('page', id, target ?? 'root');
}

async function newFolder(parentId = null) {
  const name = await askText({ title: parentId ? 'Nouveau sous-dossier' : 'Nouveau dossier', placeholder: 'Projets, Idées, Sport…', confirm: 'Créer' });
  if (!name) return null;
  const folder = await createFolder({ name, parentId });
  if (parentId) {
    const parent = findFolder(parentId);
    if (parent) {
      parent.open = true;
      await saveFolder(parent);
    }
  }
  toast(`Dossier « ${name} » créé`);
  refresh();
  return folder;
}

async function newPageIn(folderId = null, opts = {}) {
  const page = await createPage({ folderId });
  ink(opts.from);
  go(`#/page/${page.id}`);
  return page;
}

async function changeIcon(p) {
  const emoji = await pickEmoji(p.icon);
  if (!emoji) return;
  await savePage(p, { icon: emoji });
  const btn = $('.page-icon');
  if (btn) {
    btn.textContent = emoji;
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
  }
  renderChrome();
}

async function changeCover(p) {
  const id = await pickCover(p.cover);
  if (id === undefined) return;
  state.editor?.flush();
  await savePage(p, { cover: id });
  render(true);
}

/* ───────────── Mémoire ───────────── */

function clozeHTML(text) {
  let n = 0;
  return esc(text).replace(/[\p{L}’'-]{6,}/gu, (w) => (n++ % 2 === 0 ? `<span class="cloze">${w}</span>` : w));
}

function renderMemory() {
  const due = dueCards(state.cards);
  const r = state.review;
  if (r) return renderReview();
  const sorted = [...state.cards].sort((a, b) => a.due.localeCompare(b.due));
  const pct = Math.round(100 * avgMastery());
  const solid = state.cards.filter((c) => mastery(c) >= 0.5).length;
  const reps = state.cards.reduce((s, c) => s + (c.reps || 0), 0);
  $('#view').innerHTML = `<section class="view memory">
    <header class="phead">
      <div><h1>Mémoire</h1><p>Ce qui est encré reste ancré</p></div>
      <button class="sq neon lg" type="button" data-action="start-review" aria-label="Réviser"${due.length ? '' : ' disabled'}>${I.brain}</button>
    </header>

    <section class="hero-card">
      ${particles()}
      <p class="hc-label">Révision espacée · 1, 3, 7, 16 jours…</p>
      <div class="hc-top">
        <p class="hc-big"><span class="hc-num" data-count="${due.length}">${due.length}</span><span class="hc-side">${due.length > 1 ? 'passages' : 'passage'}<br>à revoir</span></p>
        ${ring(pct, 'de maîtrise')}
      </div>
      <p class="hc-line"><i></i>${state.cards.length ? (due.length ? 'Deux minutes maintenant, des années de souvenirs.' : 'Tout est à jour. Reviens demain ✦') : 'Surligne un passage dans une page et touche ✦ Retenir.'}</p>
      ${due.length ? `<button class="btn btn-neon btn-lg" type="button" data-action="start-review">${I.brain}Réviser maintenant</button>` : ''}
      <div class="hc-stats">
        <div><b data-count="${state.cards.length}">${state.cards.length}</b><span>${state.cards.length > 1 ? 'passages retenus' : 'passage retenu'}</span></div>
        <div><b data-count="${solid}">${solid}</b><span>${solid > 1 ? 'bien ancrés' : 'bien ancré'}</span></div>
        <div><b data-count="${reps}">${reps}</b><span>${reps > 1 ? 'révisions' : 'révision'}</span></div>
      </div>
    </section>

    <div class="mlist">${sorted.length ? sorted.map((c, i) => {
      const p = findPage(c.pageId);
      const level = Math.round(mastery(c) * 6);
      return `<article class="card mcard" style="--i:${Math.min(i, 10)}">
        <header class="card-head"><span class="card-label">${I.sparkLg}${esc(dueLabel(c))}</span><span class="level" title="Maîtrise">${Array.from({ length: 6 }, (_, k) => `<i class="${k < level ? 'on' : ''}"></i>`).join('')}</span></header>
        <p class="mcard-text">« ${esc(c.text)} »</p>
        <footer>
        ${p ? `<a href="#/page/${p.id}" data-go class="mcard-src">${esc(p.icon)} ${esc(p.title || 'Sans titre')}</a>` : '<span class="mcard-src">Page supprimée</span>'}
        <button class="more" type="button" data-action="delete-card" data-id="${c.id}" aria-label="Retirer de la mémoire">${I.close}</button></footer>
      </article>`;
    }).join('') : `<div class="empty"><p class="empty-title">Rien à retenir… pour l’instant</p><p>Dans une page, sélectionne une phrase importante puis touche <b>✦ Retenir</b>.</p></div>`}</div>
  </section>`;
}

function renderReview() {
  const r = state.review;
  const card = r.queue[r.index];
  if (!card) {
    state.review = null;
    $('#view').innerHTML = `<section class="view memory"><div class="review-done hero-card">${particles()}<span class="done-orb"></span><h1>Révision terminée</h1><p>${plural(r.remembered, 'passage retenu', 'passages retenus')} sur ${r.queue.length}. Ce qui est encré reste ancré.</p><a class="btn btn-neon" href="#/memoire" data-action="end-review">Retour à la mémoire</a></div></section>`;
    burst();
    return;
  }
  const p = findPage(card.pageId);
  $('#view').innerHTML = `<section class="view memory review">
    <div class="rv-top"><button class="sq" type="button" data-action="end-review" aria-label="Arrêter">${I.close}</button><div class="rv-bar"><i style="width:${(100 * r.index) / r.queue.length}%"></i></div><span>${r.index + 1}/${r.queue.length}</span></div>
    <div class="flip${r.flipped ? ' is-flipped' : ''}" data-action="flip" role="button" tabindex="0" aria-label="Retourner la carte">
      <div class="face front"><p class="eyebrow">${p ? `${esc(p.icon)} ${esc(p.title || 'Sans titre')}` : 'Passage retenu'}</p><p class="rv-text">${clozeHTML(card.text)}</p><p class="rv-hint">Te souviens-tu des mots cachés ? Touche pour révéler.</p></div>
      <div class="face back"><p class="eyebrow">Le passage</p><p class="rv-text">« ${esc(card.text)} »</p></div>
    </div>
    <div class="rv-actions"${r.flipped ? '' : ' hidden'}>
      <button class="btn" type="button" data-action="grade" data-id="0">À revoir</button>
      <button class="btn btn-neon" type="button" data-action="grade" data-id="1">${I.check}Je m’en souviens</button>
    </div>
  </section>`;
}

/* ───────────── Fenêtres (menus, questions, sélecteurs) ───────────── */

function openSheet(html, bind) {
  return new Promise((resolve) => {
    const dlg = $('#sheet');
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dlg.open) dlg.close();
      resolve(value);
    };
    dlg.innerHTML = `<div class="sheet-inner">${html}</div>`;
    dlg.onclick = (e) => {
      if (e.target === dlg) finish(undefined);
      const close = e.target.closest('[data-sheet-close]');
      if (close) finish(undefined);
    };
    // Un « close » en retard (fenêtre précédente) arrive alors que celle-ci est déjà rouverte : on l'ignore.
    dlg.onclose = () => {
      if (!dlg.open) finish(undefined);
    };
    bind(dlg, finish);
    if (!dlg.open) dlg.showModal();
  });
}

function sheetHead(title) {
  return `<header class="sheet-head"><h2>${esc(title)}</h2><button class="sq" type="button" data-sheet-close aria-label="Fermer">${I.close}</button></header>`;
}

function openMenu(title, items) {
  const list = items.filter(Boolean);
  return openSheet(`${sheetHead(title)}<div class="menu">${list.map((it, i) => `<button type="button" class="menu-item${it.danger ? ' danger' : ''}" data-choice="${it.id}" style="--i:${i}">${it.icon}<span>${it.label}</span></button>`).join('')}</div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.choice)));
  });
}

function askText({ title, value = '', placeholder = '', confirm = 'OK' }) {
  return openSheet(`${sheetHead(title)}<form class="ask"><input name="v" value="${attr(value)}" placeholder="${attr(placeholder)}" maxlength="60" autocomplete="off" required><button class="btn btn-neon" type="submit">${esc(confirm)}</button></form>`, (dlg, finish) => {
    const form = dlg.querySelector('form');
    const input = form.querySelector('input');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 60);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(input.value.trim() || null);
    });
  });
}

function askConfirm({ title, message, confirm = 'Confirmer', danger = false }) {
  return openSheet(`${sheetHead(title)}<p class="ask-msg">${esc(message)}</p><div class="ask-actions"><button class="btn" type="button" data-sheet-close>Annuler</button><button class="btn ${danger ? 'btn-danger' : 'btn-neon'}" type="button" data-ok>${esc(confirm)}</button></div>`, (dlg, finish) => {
    dlg.querySelector('[data-ok]').addEventListener('click', () => finish(true));
  }).then((v) => v === true);
}

function pickEmoji(current) {
  return openSheet(`${sheetHead('Choisir une icône')}<div class="emojis">${EMOJIS.map((e, i) => `<button type="button" class="${e === current ? 'is-active' : ''}" data-emoji="${e}" style="--i:${i}">${e}</button>`).join('')}</div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-emoji]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.emoji)));
  });
}

function pickCover(current) {
  return openSheet(`${sheetHead('Couverture')}<div class="covers">${COVERS.map((c, i) => `<button type="button" class="cover-pick${c.id === current ? ' is-active' : ''}" data-cover-id="${c.id}" style="--i:${i}">${cover(c.id, 'xs')}<span>${c.label}</span></button>`).join('')}<button type="button" class="cover-pick none${!current ? ' is-active' : ''}" data-cover-id=""><span class="cover xs none"></span><span>Aucune</span></button></div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-cover-id]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.coverId || null)));
  });
}

function pickFolder({ title, current = null, exclude = new Set(), allowNew = false }) {
  const rows = flatTree(state.folders).filter(({ folder }) => !exclude.has(folder.id));
  return openSheet(`${sheetHead(title)}<div class="menu">
    <button type="button" class="menu-item${current === null ? ' is-current' : ''}" data-folder-id="">${I.page}<span>Sans dossier</span></button>
    ${rows.map(({ folder, depth }, i) => `<button type="button" class="menu-item${current === folder.id ? ' is-current' : ''}" data-folder-id="${folder.id}" style="--i:${i + 1};padding-left:${16 + depth * 18}px"><span class="menu-emoji">${esc(folder.icon)}</span><span>${esc(folder.name)}</span></button>`).join('')}
    ${allowNew ? `<button type="button" class="menu-item neon" data-new-folder>${I.folderPlus}<span>Nouveau dossier…</span></button>` : ''}
  </div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-folder-id]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.folderId || null)));
    dlg.querySelector('[data-new-folder]')?.addEventListener('click', () => finish('__new__'));
  }).then(async (v) => {
    if (v !== '__new__') return v;
    const folder = await newFolder(null);
    return folder ? folder.id : undefined;
  });
}

function pickBlock() {
  return openSheet(`${sheetHead('Insérer un bloc')}<div class="blocks">${BLOCKS.map((b, i) => `<button type="button" data-block-id="${b.id}" style="--i:${i}"><span class="b-ico">${b.icon}</span><span>${b.label}</span><small>${b.hint}</small></button>`).join('')}</div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-block-id]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.blockId)));
  });
}

function pickNote() {
  if (!state.notes.length) {
    toast('Aucune note vocale pour l’instant : raconte quelque chose dans Do It.');
    return Promise.resolve(null);
  }
  return openSheet(`${sheetHead('Insérer une note vocale')}<div class="menu">${state.notes.slice(0, 40).map((n, i) => `<button type="button" class="menu-item" data-note-id="${n.id}" style="--i:${Math.min(i, 12)}"><span class="menu-emoji">🎙️</span><span><b>${esc(n.title || 'Note vocale')}</b><small>${longDate(n.createdAt)}</small></span></button>`).join('')}</div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-note-id]').forEach((b) => b.addEventListener('click', () => finish(findNote(b.dataset.noteId))));
  });
}

/* ───────────── Recherche, réglages, raccourcis ───────────── */

function searchHint() {
  const pages = sortRecent(state.pages).slice(0, 4);
  const notes = state.notes.slice(0, 3);
  if (!pages.length && !notes.length) return '<p class="set-foot">Tes pages et tes notes vocales apparaîtront ici.</p>';
  return `${pages.length ? `<p class="sr-label">Pages récentes</p><div class="list">${pages.map((p, i) => pageRow(p, i)).join('')}</div>` : ''}
    ${notes.length ? `<p class="sr-label">Dernières notes</p><div class="list">${notes.map((n, i) => noteRow(n, i)).join('')}</div>` : ''}`;
}

function openSearch() {
  return openSheet(`${sheetHead('Rechercher')}<label class="search">${I.search}<input id="search-input" type="search" placeholder="Pages, notes vocales…" value="${attr(state.query)}" autocomplete="off" enterkeyhint="search"></label><div class="search-results" id="search-results">${state.query.trim() ? searchResults(state.query.trim()) : searchHint()}</div>`, (dlg, finish) => {
    const input = dlg.querySelector('#search-input');
    const out = dlg.querySelector('#search-results');
    setTimeout(() => input.focus(), 60);
    // Échap ferme la recherche d'un coup (sinon le champ « search » se contente de s'effacer).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(undefined);
      }
    });
    input.addEventListener('input', () => {
      state.query = input.value;
      const q = input.value.trim();
      out.innerHTML = q ? searchResults(q) : searchHint();
    });
    out.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      finish(a.getAttribute('href'));
    });
  }).then((href) => {
    if (href) go(href);
  });
}

async function checkAi(dlg) {
  const label = dlg.querySelector('#ai-state');
  const dot = dlg.querySelector('#ai-dot');
  const settings = await getDoItValue('settings', {});
  const st = await aiStatus(settings?.accessCode || '');
  if (!label?.isConnected) return;
  const ok = Boolean(st?.ai && (!st.needsCode || st.authorized));
  label.textContent = typo(ok ? 'Connectée : tes notes sont résumées et classées par Claude.' : st?.ai ? 'Code d’accès requis (à saisir dans Do It).' : 'Hors d’atteinte : Encré écrit en mode local, puis réécrit dès que l’IA répond.');
  dot.classList.toggle('on', ok);
}

async function openSettings() {
  const goals = [100, 250, 500, 1000];
  const html = `${sheetHead('Réglages')}
    <div class="set-list">
      <div class="set-row"><span class="set-ico">${I.hand}</span><span class="set-txt"><b>Écriture manuscrite</b><small>Tes notes vocales s’affichent écrites à la main</small></span><button class="switch${state.hand ? ' is-on' : ''}" type="button" data-set="hand" aria-pressed="${state.hand}" aria-label="Écriture manuscrite"><i></i></button></div>
      <div class="set-row wrap"><span class="set-ico">${I.bolt}</span><span class="set-txt"><b>Objectif du jour</b><small>Mots à encrer chaque jour, notes et pages comprises</small></span><div class="seg">${goals.map((g) => `<button class="seg-btn${state.goal === g ? ' is-on' : ''}" type="button" data-goal="${g}">${g}</button>`).join('')}</div></div>
      <div class="set-row"><span class="set-ico">${I.sparkLg}</span><span class="set-txt"><b>Résumés par l’IA</b><small id="ai-state">Vérification…</small></span><i class="dot" id="ai-dot"></i></div>
    </div>
    <p class="sr-label">Données</p>
    <div class="menu">
      <button type="button" class="menu-item" data-choice="export">${I.download}<span>Sauvegarder tout <small>Pages, dossiers et mémoire en JSON</small></span></button>
      <button type="button" class="menu-item" data-choice="import">${I.upload}<span>Importer une sauvegarde</span></button>
      <a class="menu-item" href="../#parler">${I.ext}<span>Ouvrir Do It</span></a>
    </div>
    <p class="set-foot">Encré · par Do It. Tout reste sur cet appareil.</p>`;
  const choice = await openSheet(html, (dlg, finish) => {
    const sw = dlg.querySelector('[data-set="hand"]');
    sw.addEventListener('click', () => {
      state.hand = !state.hand;
      db.setValue('hand', state.hand);
      sw.classList.toggle('is-on', state.hand);
      sw.setAttribute('aria-pressed', String(state.hand));
    });
    dlg.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
      state.goal = Number(b.dataset.goal);
      db.setValue('goal', state.goal);
      dlg.querySelectorAll('[data-goal]').forEach((x) => x.classList.toggle('is-on', x === b));
    }));
    dlg.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.choice)));
    checkAi(dlg);
  });
  if (state.route.name === 'page') renderChrome();
  else render(true);
  if (choice === 'export') exportAll();
  if (choice === 'import') $('#import-file')?.click();
}

async function openShortcuts() {
  const due = dueCards(state.cards).length;
  const choice = await openMenu('Raccourcis', [
    { id: 'capture', icon: I.mic, label: 'Parler : nouvelle note vocale' },
    { id: 'page', icon: I.plus, label: 'Nouvelle page' },
    { id: 'dictate', icon: I.pen, label: 'Dicter une page' },
    { id: 'folder', icon: I.folderPlus, label: 'Nouveau dossier' },
    due && { id: 'review', icon: I.brain, label: `Réviser ${plural(due, 'passage')}` },
    { id: 'doit', icon: I.ext, label: 'Ouvrir le journal Do It' },
    { id: 'export', icon: I.download, label: 'Sauvegarder tout' },
  ]);
  if (choice === 'capture') openCapture();
  if (choice === 'page') newPageIn(null);
  if (choice === 'dictate') onAction('dictate-page', document.body);
  if (choice === 'folder') newFolder(null);
  if (choice === 'review') {
    go('#/memoire');
    setTimeout(() => onAction('start-review', document.body), 80);
  }
  if (choice === 'doit') location.href = '../#journal';
  if (choice === 'export') exportAll();
}

function exportAll() {
  const data = { app: 'encre', version: 1, exportedAt: new Date().toISOString(), pages: state.pages, folders: state.folders, cards: state.cards };
  download(`encre-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** Les chiffres clés défilent jusqu'à leur valeur. */
function countUp(root = document) {
  if (reduced()) return;
  for (const el of $$('[data-count]', root)) {
    const to = Number(el.dataset.count);
    if (!Number.isFinite(to) || to <= 0) continue;
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now();
    const dur = 700 + Math.min(500, to);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = `${Math.round(to * (1 - (1 - k) ** 3)).toLocaleString('fr-FR')}${suffix}`;
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/* ───────────── Capture vocale : tu parles, Encré écrit ───────────── */

const CAPTURE_STEPS = ['Je résume l’essentiel…', 'Je range par thèmes…', 'Je passe à l’encre…', 'Je soigne chaque mot…'];
const LOCAL_MSG = 'IA pas joignable pour l’instant : note nettoyée et classée sans elle, elle sera réécrite automatiquement.';
const cap = { status: 'closed', d: null, entry: null, question: null, startedAt: 0, timer: 0, raf: 0, ticker: 0, energy: 0 };

/** Texte « écrit à la main » : chaque mot se trace à l'encre, l'un après l'autre. */
function handWords(text, start, step = 70) {
  let i = 0;
  const html = esc(text).split(/(\s+)/).map((w) => (w.trim() ? `<span class="hw" style="--d:${start + i++ * step}ms">${w}</span>` : w)).join('');
  return { html, end: start + i * step };
}

function handCard(entry) {
  const mood = moodOf(entry.mood);
  let t = 150;
  const title = handWords(entry.title || 'Note vocale', t, 90);
  t = title.end + 200;
  const paras = String(entry.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const w = handWords(p, t);
    t = w.end + 120;
    return `<p>${w.html}</p>`;
  }).join('');
  const points = (entry.highlights || []).map((h) => {
    const w = handWords(h, t);
    t = w.end + 120;
    return `<li>${w.html}</li>`;
  }).join('');
  const themes = (entry.themes || []).map((tid, i) => {
    const th = themeOf(tid, state.noteThemes);
    return `<span class="tag hand-tag" style="--d:${t + i * 120}ms">${esc(th.emoji)} ${esc(th.label)}</span>`;
  }).join('');
  return `<article class="hand-card">
    <p class="eyebrow">${longDate(entry.createdAt)} · ${timeLabel(entry.updatedAt || entry.createdAt)} · ${mood.emoji} ${esc(mood.label)}</p>
    <h2 class="hand-title">${title.html}</h2>
    <div class="hand-text">${paras}</div>
    ${points ? `<ul class="hand-points">${points}</ul>` : ''}
    <div class="tags">${themes}</div>
    ${entry.source === 'local' ? `<p class="hand-local">${esc(entry.pending ? 'Écrite sans l’IA pour l’instant : elle sera réécrite automatiquement.' : 'Écrite sans l’IA.')}</p>` : ''}
  </article>`;
}

function renderCapture(status, { animate = true } = {}) {
  cap.status = status;
  clearInterval(cap.ticker);
  const el = $('#capture');
  el.dataset.state = status;
  const e = cap.entry;
  const head = `<header class="cap-head"><button class="sq" type="button" data-cap="close" aria-label="Fermer">${I.close}</button><p class="eyebrow">${e && status !== 'done' ? 'Tu complètes ta note' : 'Note vocale'}</p><span class="cap-timer" id="cap-timer"></span></header>`;

  if (status === 'done') {
    el.innerHTML = `${head}<div class="cap-body${animate ? '' : ' no-anim'}">${handCard(e)}
      ${e.followUp ? `<div class="note-followup cap-follow"><p><span>Encré te relance</span>« ${esc(e.followUp)} »</p><button class="btn" type="button" data-cap="reply">${I.mic}Répondre</button></div>` : ''}
      <div class="cap-grid">
        <button class="btn btn-neon" type="button" data-cap="to-page">${I.spark}En faire une page</button>
        <button class="btn" type="button" data-cap="append">${I.plus}Ajouter à une page</button>
        <button class="btn" type="button" data-cap="edit">${I.pencil}Modifier</button>
        <button class="btn" type="button" data-cap="again">${I.mic}Nouvelle note</button>
      </div></div>`;
    return;
  }

  if (status === 'unsupported') {
    el.innerHTML = `${head}<div class="cap-body"><p class="cap-note">La dictée n’est pas disponible sur ce navigateur (ouvre Encré dans <b>Chrome</b> ou <b>Safari</b>). Tu peux écrire ta note ici : Encré la résume et la range de la même façon.</p>
      <textarea id="cap-text" rows="8" placeholder="Raconte, même en vrac…"></textarea>
      <button class="btn btn-neon btn-lg" type="button" data-cap="write">${I.spark}Encré l’écrit</button></div>`;
    setTimeout(() => $('#cap-text')?.focus(), 100);
    return;
  }

  const q = cap.question;
  el.innerHTML = `${head}<div class="cap-body">
    ${q ? `<div class="cap-q"><span>Tu réponds à</span><p>« ${esc(q)} »</p></div>` : ''}
    <button class="cap-orb" type="button" data-cap="toggle" aria-label="${status === 'listening' ? 'Terminer' : 'Parler'}">
      <span class="cap-ring"></span><span class="cap-ring r2"></span>
      <span class="cap-core">${MARK}</span>
    </button>
    <p class="cap-hint" id="cap-hint">${status === 'listening' ? 'Je t’écoute… touche la goutte pour finir' : status === 'ready' ? 'Touche la goutte et parle' : 'Encré écrit…'}</p>
    <div class="bars cap-bars" aria-hidden="true">${'<i></i>'.repeat(18)}</div>
    <p class="cap-live" id="cap-live" aria-live="polite"></p>
    <div class="cap-actions"${status === 'listening' ? '' : ' hidden'}>
      <button class="btn" type="button" data-cap="cancel">Annuler</button>
      <button class="btn btn-neon" type="button" data-cap="stop">${I.check}Terminer</button>
    </div>
  </div>`;
}

function setWriting() {
  const el = $('#capture');
  el.dataset.state = 'writing';
  cap.status = 'writing';
  $('#capture .cap-actions')?.setAttribute('hidden', '');
  const hint = $('#cap-hint');
  let i = 0;
  if (hint) hint.textContent = 'Encré écrit…';
  cap.ticker = setInterval(() => {
    const h = $('#cap-hint');
    if (h) h.textContent = CAPTURE_STEPS[i++ % CAPTURE_STEPS.length];
  }, 1500);
}

function stopCaptureExtras() {
  clearInterval(cap.timer);
  cancelAnimationFrame(cap.raf);
}

function startListening() {
  if (state.dictation) stopDictation(true);
  if (!isSpeechSupported()) {
    renderCapture('unsupported');
    return;
  }
  renderCapture('listening');
  const live = $('#cap-live');
  const d = new Dictation({
    onText: (finalText, interim) => {
      live.innerHTML = `${esc(finalText)} <span class="interim">${esc(interim)}</span>`;
      live.scrollTop = live.scrollHeight;
    },
    onActivity: () => {
      cap.energy = 1;
    },
    onError: (msg) => {
      toast(msg);
      finishCapture({ quiet: true });
    },
  });
  try {
    d.start();
  } catch {
    renderCapture('unsupported');
    return;
  }
  cap.d = d;
  cap.startedAt = Date.now();
  const timer = $('#cap-timer');
  timer.textContent = '00:00';
  cap.timer = setInterval(() => {
    const s = (Date.now() - cap.startedAt) / 1000;
    timer.textContent = clock(s);
    if (s > 20 * 60) finishCapture();
  }, 250);
  const bars = $$('#capture .cap-bars i');
  const orb = $('#capture .cap-orb');
  const tick = () => {
    cap.energy *= 0.92;
    bars.forEach((b, k) => b.style.setProperty('--v', (0.12 + Math.abs(Math.sin(Date.now() / 170 + k * 0.7)) * (0.2 + cap.energy * 0.8)).toFixed(2)));
    orb?.style.setProperty('--level', cap.energy.toFixed(2));
    cap.raf = requestAnimationFrame(tick);
  };
  tick();
}

async function finishCapture({ quiet = false } = {}) {
  if (cap.status !== 'listening' || !cap.d) return;
  const d = cap.d;
  cap.d = null;
  setWriting();
  const text = (await d.stop()).trim();
  stopCaptureExtras();
  if (!text) {
    if (!quiet) toast('Je n’ai rien entendu… Rapproche-toi du micro et réessaie.');
    if (cap.entry?.text) renderCapture('done', { animate: false });
    else renderCapture('ready');
    return;
  }
  await writeCaptured(text, Math.round((Date.now() - cap.startedAt) / 1000));
}

async function writeCaptured(text, duration) {
  if (cap.status !== 'writing') setWriting();
  const segment = { text, at: new Date().toISOString(), duration };
  if (cap.question) segment.question = cap.question;
  let entry = cap.entry;
  if (entry) entry.segments.push(segment);
  else entry = newVoiceEntry(segment);
  const res = await writeVoiceNote(entry);
  cap.entry = entry;
  cap.question = null;
  state.noteThemes = res.customThemes;
  const i = state.notes.findIndex((n) => n.id === entry.id);
  if (i >= 0) state.notes[i] = entry;
  else state.notes.unshift(entry);
  if (cap.status === 'closed') return;
  renderCapture('done');
  setTimeout(() => burst(), 300);
  if (res.source === 'local') toast(['code', 'refusal', 'input'].includes(res.reason) ? REASONS[res.reason] : LOCAL_MSG);
  refresh();
}

function openCapture({ entryId = null, reply = false } = {}) {
  cap.entry = entryId ? findNote(entryId) : null;
  cap.question = reply && cap.entry ? cap.entry.followUp || null : null;
  const el = $('#capture');
  el.hidden = false;
  document.body.classList.add('cap-open');
  requestAnimationFrame(() => el.classList.add('is-open'));
  startListening();
}

function closeCapture() {
  if (cap.d) {
    cap.d.cancel();
    cap.d = null;
  }
  stopCaptureExtras();
  clearInterval(cap.ticker);
  cap.status = 'closed';
  const el = $('#capture');
  el.classList.remove('is-open');
  document.body.classList.remove('cap-open');
  setTimeout(() => {
    if (cap.status === 'closed') {
      el.hidden = true;
      el.innerHTML = '';
    }
  }, 450);
  refresh();
}

async function appendNoteTo(entry, page) {
  const section = noteToSection(entry);
  if (state.editor && state.route.name === 'page' && state.route.id === page.id) {
    state.editor.focusEnd();
    state.editor.insertBlocks(section);
    state.editor.flush();
  } else {
    const html = `${page.html || ''}${section}`;
    await savePage(page, { html, words: countWords(htmlToText(html)) }, { count: false });
  }
  toast(`Note ajoutée à « ${page.title || 'Sans titre'} »`);
}

async function captureAction(name) {
  const e = cap.entry;
  switch (name) {
    case 'close':
      return closeCapture();
    case 'toggle':
      if (cap.status === 'listening') return finishCapture();
      if (cap.status === 'ready') return startListening();
      return;
    case 'stop':
      return finishCapture();
    case 'cancel':
      if (cap.d) {
        cap.d.cancel();
        cap.d = null;
      }
      stopCaptureExtras();
      if (e?.text) return renderCapture('done', { animate: false });
      return closeCapture();
    case 'write': {
      const text = $('#cap-text')?.value.trim();
      if (!text) return;
      return writeCaptured(text, 0);
    }
    case 'reply':
      cap.question = e?.followUp || null;
      return startListening();
    case 'again':
      cap.entry = null;
      cap.question = null;
      return startListening();
    case 'edit':
      closeCapture();
      return go(`#/note/${e.id}`);
    case 'to-page':
      closeCapture();
      return noteToPage(e.id);
    case 'append': {
      const page = await pickPage();
      if (!page) return;
      await appendNoteTo(e, page);
      closeCapture();
      return go(`#/page/${page.id}`);
    }
    default:
  }
}

function pickPage() {
  const pages = sortRecent(state.pages);
  if (!pages.length) {
    toast('Aucune page pour l’instant : choisis plutôt « En faire une page ».');
    return Promise.resolve(null);
  }
  return openSheet(`${sheetHead('Ajouter à quelle page ?')}<div class="menu">${pages.slice(0, 40).map((p, i) => `<button type="button" class="menu-item" data-page-id="${p.id}" style="--i:${Math.min(i, 12)}"><span class="menu-emoji">${esc(p.icon || '📄')}</span><span><b>${esc(p.title || 'Sans titre')}</b><small>${ago(p.updatedAt)}</small></span></button>`).join('')}</div>`, (dlg, finish) => {
    dlg.querySelectorAll('[data-page-id]').forEach((b) => b.addEventListener('click', () => finish(findPage(b.dataset.pageId))));
  });
}

/* ───────────── Effets ───────────── */

let toastTimer = 0;
function toast(message) {
  const el = $('#toast');
  el.textContent = typo(message);
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

/** Goutte d'encre néon qui s'étend depuis le point touché. */
function ink(from) {
  if (reduced()) return;
  const x = from?.clientX ?? window.innerWidth / 2;
  const y = from?.clientY ?? window.innerHeight - 60;
  const drop = document.createElement('span');
  drop.className = 'ink';
  drop.style.left = `${x}px`;
  drop.style.top = `${y}px`;
  document.body.append(drop);
  setTimeout(() => drop.remove(), 900);
}

/** Étincelles néon (fin de révision). */
function burst() {
  if (reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'sparks';
  for (let k = 0; k < 36; k++) {
    const s = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const d = 80 + Math.random() * 180;
    s.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;animation-delay:${Math.random() * 120}ms;${k % 3 === 0 ? 'background:#fff' : ''}`;
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1500);
}

/* ───────────── Actions ───────────── */

async function onAction(name, el, event) {
  const id = el.dataset.id;
  switch (name) {
    case 'back':
      if (state.depth > 0) history.back();
      else go('#/');
      return;
    case 'new-page':
      return newPageIn(state.route.name === 'page' ? findPage(state.route.id)?.folderId ?? null : null, { from: event });
    case 'new-page-in':
      return newPageIn(id, { from: event });
    case 'dictate-page': {
      await newPageIn(null, { from: event });
      setTimeout(() => {
        state.editor?.focusEnd();
        startDictation();
      }, 450);
      return;
    }
    case 'new-folder':
      return newFolder(null);
    case 'toggle-folder': {
      const f = findFolder(id);
      if (!f) return;
      f.open = f.open === false;
      await saveFolder(f);
      refresh();
      return;
    }
    case 'folder-menu':
      return folderMenu(id);
    case 'page-menu':
      return pageMenu(id);
    case 'page-move':
      return movePageDialog(id);
    case 'page-icon':
      return changeIcon(findPage(state.route.id));
    case 'page-cover':
      return changeCover(findPage(state.route.id));
    case 'close-tab': {
      state.tabs = state.tabs.filter((t) => t !== id);
      await saveTabs();
      if (state.route.id === id) go(state.tabs.length ? `#/page/${state.tabs.at(-1)}` : '#/');
      else renderChrome();
      return;
    }
    case 'note-filter':
      state.noteFilter = id;
      renderNotes();
      return;
    case 'capture':
      openCapture();
      return;
    case 'capture-reply':
      openCapture({ entryId: id, reply: true });
      return;
    case 'toggle-hand':
      state.hand = !state.hand;
      db.setValue('hand', state.hand);
      render(true);
      if (state.route.name !== 'note') toast(state.hand ? '✍︎ Notes en écriture manuscrite' : 'Aa Notes en écriture classique');
      return;
    case 'search':
      return openSearch();
    case 'settings':
      return openSettings();
    case 'shortcuts':
      return openShortcuts();
    case 'day': {
      const step = Number(id);
      const next = step === 0 ? todayKey() : dayKey(addDays(dateFromKey(selectedDay()), step));
      if (next > todayKey()) return;
      state.day = next === todayKey() ? null : next;
      return render(true);
    }
    case 'pick-day':
      state.day = id === todayKey() ? null : id;
      return render(true);
    case 'metric':
      state.metric = id;
      $('.chart-card').outerHTML = weekChart(selectedDay());
      return;
    case 'page-sort':
      state.pageSort = id;
      return renderPages();
    case 'next-quote': {
      state.quote += 1;
      const q = $('.quote-card .q-text');
      if (q) {
        q.classList.remove('swap');
        void q.offsetWidth;
        q.textContent = typo(QUOTE_LIST[(dayIndex(selectedDay()) + state.quote) % QUOTE_LIST.length]);
        q.classList.add('swap');
      }
      return;
    }
    case 'note-to-page':
      return noteToPage(id);
    case 'start-review': {
      const queue = dueCards(state.cards);
      if (!queue.length) return;
      state.review = { queue, index: 0, flipped: false, remembered: 0 };
      renderReview();
      return;
    }
    case 'flip':
      if (!state.review || state.review.flipped) return;
      state.review.flipped = true;
      $('.flip')?.classList.add('is-flipped');
      $('.rv-actions').hidden = false;
      return;
    case 'grade': {
      const r = state.review;
      if (!r) return;
      const card = r.queue[r.index];
      const ok = id === '1';
      const updated = review(card, ok);
      Object.assign(state.cards.find((c) => c.id === card.id), updated);
      await db.put('cards', updated);
      if (ok) r.remembered += 1;
      r.index += 1;
      r.flipped = false;
      renderReview();
      renderChrome();
      return;
    }
    case 'end-review':
      state.review = null;
      renderMemory();
      renderChrome();
      return;
    case 'delete-card':
      state.cards = state.cards.filter((c) => c.id !== id);
      await db.remove('cards', id);
      renderMemory();
      renderChrome();
      return;
    case 'export-all':
      return exportAll();
    case 'import':
      $('#import-file')?.click();
      return;
    default:
  }
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'encre') throw new Error();
    let added = 0;
    for (const [store, list] of [['folders', data.folders], ['pages', data.pages], ['cards', data.cards]]) {
      for (const item of Array.isArray(list) ? list : []) {
        if (!item?.id) continue;
        const target = state[store];
        const i = target.findIndex((x) => x.id === item.id);
        if (i >= 0) target[i] = item;
        else target.push(item);
        await db.put(store, item);
        added += 1;
      }
    }
    toast(added ? `${plural(added, 'élément importé', 'éléments importés')}` : 'Rien à importer');
    refresh();
  } catch {
    toast('Ce fichier n’est pas une sauvegarde Encré.');
  }
}

/* ───────────── Écouteurs ───────────── */

function bind() {
  document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl && !actionEl.disabled && !e.target.closest('dialog')) {
      e.preventDefault();
      e.stopPropagation();
      onAction(actionEl.dataset.action, actionEl, e);
      return;
    }
    const link = e.target.closest('a[data-go]');
    if (link && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const folderId = link.dataset.openFolder;
      if (folderId) {
        const f = findFolder(folderId);
        if (f && f.open === false) {
          f.open = true;
          saveFolder(f);
        }
      }
      const coverEl = link.hasAttribute('data-cover-link') ? link.querySelector('.cover') : null;
      go(link.getAttribute('href'), coverEl);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('.flip') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onAction('flip', e.target, e);
    }
  });

  // Barre d'édition et bulle : le focus reste dans la page.
  for (const bar of [$('#toolbar'), $('#bubble')]) {
    bar.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-tb]');
      if (!btn) return;
      e.preventDefault();
      toolbarAction(btn.dataset.tb);
    });
  }
  $('#dictation').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dict]');
    if (btn) stopDictation(btn.dataset.dict === 'cancel');
  });

  document.addEventListener('input', (e) => {
    if (e.target.closest?.('#doc, #note-doc, #page-title, #note-title')) keepCaretVisible();
    if (e.target.id === 'notes-search') {
      state.noteQuery = e.target.value;
      const list = $('#note-list');
      list.dataset.quiet = '';
      list.innerHTML = noteCards(filteredNotes());
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'import-file' && e.target.files?.[0]) importBackup(e.target.files[0]);
  });

  // Glisser-déposer des pages et dossiers (souris).
  document.addEventListener('dragstart', (e) => {
    const node = e.target.closest?.('[data-node]');
    if (!node) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ kind: node.dataset.node, id: node.dataset.id }));
    e.dataTransfer.effectAllowed = 'move';
    node.classList.add('is-dragging');
  });
  document.addEventListener('dragend', () => $$('.is-dragging, .is-over').forEach((n) => n.classList.remove('is-dragging', 'is-over')));
  document.addEventListener('dragover', (e) => {
    const zone = e.target.closest?.('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    $$('.is-over').forEach((n) => n !== zone && n.classList.remove('is-over'));
    zone.classList.add('is-over');
  });
  document.addEventListener('drop', (e) => {
    const zone = e.target.closest?.('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-over');
    try {
      const { kind, id } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (kind === 'page' || kind === 'folder') moveTo(kind, id, zone.dataset.drop);
    } catch {
      /* dépôt étranger */
    }
  });

  // La barre d'édition reste au-dessus du clavier.
  const vv = window.visualViewport;
  if (vv) {
    const place = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${kb}px`);
      document.body.classList.toggle('kb-open', kb > 80);
    };
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
  }

  window.addEventListener('popstate', () => {
    state.depth = Math.max(0, state.depth - 1);
    transition(() => render());
  });
  window.addEventListener('hashchange', () => render());
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') state.editor?.flush();
    else {
      state.notes = await loadVoiceNotes();
      if (state.route.name === 'notes' || state.route.name === 'home') refresh();
    }
  });
  window.addEventListener('pagehide', () => state.editor?.flush());
  window.addEventListener('online', () => rewritePending());
  $('#capture').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cap]');
    if (btn && !btn.disabled) captureAction(btn.dataset.cap);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cap.status !== 'closed' && !$('#sheet').open) closeCapture();
  });
}

/** En tapant, le curseur reste visible au-dessus de la barre d'édition et du clavier. */
function keepCaretVisible() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(false);
  let rect = r.getBoundingClientRect();
  if (!rect.height) {
    const node = r.startContainer.nodeType === Node.TEXT_NODE ? r.startContainer.parentNode : r.startContainer;
    rect = node.getBoundingClientRect?.() || rect;
  }
  const vv = window.visualViewport;
  const bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
  const limit = bottom - (document.body.dataset.route === 'page' ? 120 : 40);
  if (rect.bottom > limit) window.scrollBy({ top: rect.bottom - limit + 24 });
}

function splash() {
  const el = $('#splash');
  let seen = false;
  try {
    seen = sessionStorage.getItem('encre-splash') === '1';
    sessionStorage.setItem('encre-splash', '1');
  } catch {
    /* stockage indisponible */
  }
  if (seen || reduced()) {
    el.remove();
    return;
  }
  el.hidden = false;
  const leave = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 700);
  };
  el.addEventListener('click', leave, { once: true });
  setTimeout(leave, 2100);
}

async function init() {
  splash();
  bind();
  const [pages, folders, cards, tabs, notes, noteThemes, hand, goal, activity] = await Promise.all([
    db.getAll('pages'), db.getAll('folders'), db.getAll('cards'), db.getValue('tabs', []), loadVoiceNotes(), loadVoiceThemes(), db.getValue('hand', true), db.getValue('goal', 250), db.getValue('activity', {}),
  ]);
  Object.assign(state, { pages, folders, cards, notes, noteThemes, hand, goal, activity, tabs: tabs.filter((t) => pages.some((p) => p.id === t)) });
  await seed();
  if (!state.pages.length) state.pages = await db.getAll('pages');
  navigator.storage?.persist?.().catch(() => {});
  document.body.classList.add('is-ready');
  render(true);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  }
  rewritePending();
}

/** Notes écrites sans l'IA : réécrites dès qu'elle répond. */
async function rewritePending() {
  const done = await retryPendingNotes(state.notes, () => refresh());
  if (done) toast(`✦ ${plural(done, 'note réécrite', 'notes réécrites')} par l’IA`);
}

init();
