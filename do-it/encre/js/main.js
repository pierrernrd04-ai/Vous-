// Encré · par Do It
// Tes notes vocales deviennent des pages : à retravailler, ranger et retenir.
import * as db from './db.js';
import { createEditor, BLOCKS, htmlToText, countWords } from './editor.js';
import { loadVoiceNotes, loadVoiceThemes, saveVoiceNote, themeOf, moodOf, noteToHtml } from './voice.js';
import { childFolders, pagesIn, canMoveFolder, folderPath, deepCount, flatTree, nextOrder, descendantIds } from './tree.js';
import { newCard, review, dueCards, mastery, dueLabel } from './memory.js';
import { toMarkdown } from './markdown.js';
import { Dictation, isSpeechSupported } from '../../js/speech.js';
import { cleanTranscript } from '../../js/local-ai.js';
import { esc, attr, typo, ago, longDate, timeLabel, todayLabel, uid, plural } from '../../js/format.js';
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
};

const findPage = (id) => state.pages.find((p) => p.id === id);
const findFolder = (id) => state.folders.find((f) => f.id === id);
const findNote = (id) => state.notes.find((n) => n.id === id);
const pageText = (p) => htmlToText(p.html || '');
const sortRecent = (list) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/* ───────────── Données ───────────── */

async function savePage(page, patch = {}) {
  Object.assign(page, patch, { updatedAt: new Date().toISOString() });
  await db.put('pages', page);
}

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
  const known = { '': 'home', notes: 'notes', note: 'note', dossiers: 'folders', memoire: 'memory', page: 'page' };
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
  else if (name === 'folders') renderFolders();
  else if (name === 'memory') renderMemory();
  else renderHome();
  void view.offsetWidth;
  view.classList.add('is-in');
  window.scrollTo(0, 0);
}

/* ───────────── Habillage : barre du haut, dock, barre latérale ───────────── */

function renderChrome() {
  const { name, id } = state.route;
  const due = dueCards(state.cards).length;

  let top;
  if (name === 'page') {
    top = `<button class="icon-btn" data-action="back" aria-label="Retour">${I.back}</button>
      <div class="tabs" role="tablist" aria-label="Pages ouvertes">${state.tabs.map((tid) => {
        const p = findPage(tid);
        if (!p) return '';
        const active = tid === id;
        return `<a class="tab${active ? ' is-active' : ''}" href="#/page/${tid}" data-go role="tab" aria-selected="${active}"><span class="tab-ico">${esc(p.icon)}</span><span class="tab-title">${esc(p.title || 'Sans titre')}</span><button class="tab-x" type="button" data-action="close-tab" data-id="${tid}" aria-label="Fermer l’onglet">${I.close}</button></a>`;
      }).join('')}<button class="tab-new" type="button" data-action="new-page" aria-label="Nouvelle page">${I.plus}</button></div>
      <button class="icon-btn" data-action="page-menu" data-id="${id}" aria-label="Options de la page">${I.more}</button>`;
  } else if (name === 'note') {
    top = `<button class="icon-btn" data-action="back" aria-label="Retour">${I.back}</button><p class="top-title">Note vocale</p><a class="icon-btn" href="../#journal" aria-label="Ouvrir Do It">${I.ext}</a>`;
  } else {
    top = `<a class="brand" href="#/" data-go><span class="brand-mark">${MARK}</span><span class="brand-name">Encré<b>.</b></span></a>
      <a class="doit-link" href="../#parler">${I.mic}<span>Do It</span></a>`;
  }
  $('#topbar').innerHTML = top;
  $('#topbar .tab.is-active')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const nav = [['home', '#/', I.home, 'Accueil'], ['notes', '#/notes', I.wave, 'Notes'], ['folders', '#/dossiers', I.folder, 'Dossiers'], ['memory', '#/memoire', I.brain, 'Mémoire']];
  const item = ([key, href, icon, label]) => `<a href="${href}" data-go class="${name === key ? 'is-active' : ''}" aria-current="${name === key ? 'page' : 'false'}"><span class="dock-ico">${icon}${key === 'memory' && due ? `<b class="badge">${due}</b>` : ''}</span><span>${label}</span></a>`;
  $('#dock').innerHTML = `${item(nav[0])}${item(nav[1])}<button class="fab" type="button" data-action="new-page" aria-label="Nouvelle page">${I.plus}</button>${item(nav[2])}${item(nav[3])}`;

  $('#sidebar').innerHTML = `<a class="brand" href="#/" data-go><span class="brand-mark">${MARK}</span><span class="brand-name">Encré<b>.</b></span></a>
    <nav class="side-nav">${nav.map(([key, href, icon, label]) => `<a href="${href}" data-go class="${name === key || (key === 'notes' && name === 'note') ? 'is-active' : ''}">${icon}<span>${label}</span>${key === 'notes' ? `<small>${state.notes.length}</small>` : key === 'memory' && due ? `<small class="hot">${due}</small>` : ''}</a>`).join('')}</nav>
    <button class="btn btn-neon side-new" type="button" data-action="new-page">${I.plus}Nouvelle page</button>
    <p class="side-label">Dossiers <button class="mini" type="button" data-action="new-folder" aria-label="Nouveau dossier">${I.plus}</button></p>
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

/* ───────────── Accueil ───────────── */

function pageCard(p, i = 0, cls = '') {
  const folder = p.folderId ? findFolder(p.folderId) : null;
  return `<a class="pcard spot ${cls}" href="#/page/${p.id}" data-go data-cover-link style="--i:${i}">
    ${cover(p.cover || 'papier', 'sm')}
    <span class="pcard-body">
      <span class="pcard-icon">${esc(p.icon || '📄')}</span>
      <span class="pcard-title">${esc(p.title || 'Sans titre')}</span>
      <span class="pcard-meta">${folder ? `${esc(folder.icon)} ${esc(folder.name)} · ` : ''}${ago(p.updatedAt)}</span>
    </span>
  </a>`;
}

function noteRow(n, i = 0) {
  const t = n.themes?.[0] ? themeOf(n.themes[0], state.noteThemes) : null;
  const linked = state.pages.some((p) => p.source?.entryId === n.id);
  return `<a class="nrow spot" href="#/note/${n.id}" data-go style="--i:${i}">
    <span class="nrow-ico">${t ? esc(t.emoji) : '🎙️'}</span>
    <span class="nrow-body"><span class="nrow-title">${esc(n.title || 'Note vocale')}</span><span class="nrow-meta">${longDate(n.createdAt)} · ${timeLabel(n.createdAt)}${linked ? ' · <em>page créée</em>' : ''}</span></span>
    ${I.chevron}
  </a>`;
}

function searchResults(q) {
  const f = fold(q);
  const pages = state.pages.filter((p) => fold(`${p.title} ${pageText(p)}`).includes(f));
  const notes = state.notes.filter((n) => fold(`${n.title} ${n.text}`).includes(f));
  if (!pages.length && !notes.length) return `<div class="empty"><p class="empty-title">Rien trouvé</p><p>Aucune page ni note ne contient « ${esc(q)} ».</p></div>`;
  return `${pages.length ? `<section class="sec"><h2 class="sec-title">Pages <small>${pages.length}</small></h2><div class="grid">${pages.map((p, i) => pageCard(p, i)).join('')}</div></section>` : ''}
    ${notes.length ? `<section class="sec"><h2 class="sec-title">Notes vocales <small>${notes.length}</small></h2><div class="list">${notes.map((n, i) => noteRow(n, i)).join('')}</div></section>` : ''}`;
}

function renderHome() {
  const recent = sortRecent(state.pages);
  const last = recent[0];
  const due = dueCards(state.cards);
  const roots = childFolders(state.folders, null);
  const pinned = state.pages.filter((p) => p.pinned);

  $('#view').innerHTML = `<section class="view home">
    <header class="hero">
      <p class="eyebrow">${esc(todayLabel())}</p>
      <h1 class="wordmark">Encré<span class="ink-dot">.</span></h1>
      <p class="tagline">Ce qui est <em>encré</em> reste <em>ancré</em>.</p>
    </header>

    <label class="search spot">${I.search}<input id="home-search" type="search" placeholder="Rechercher dans tes pages et tes notes" value="${attr(state.query)}" autocomplete="off"></label>

    <div id="home-body">${state.query.trim() ? searchResults(state.query.trim()) : `
    <div class="quick">
      <button class="qa spot is-neon" type="button" data-action="new-page" style="--i:0">${I.plus}<span>Nouvelle page</span></button>
      <button class="qa spot" type="button" data-action="dictate-page" style="--i:1">${I.mic}<span>Dicter une page</span></button>
      <button class="qa spot" type="button" data-action="new-folder" style="--i:2">${I.folderPlus}<span>Nouveau dossier</span></button>
      <a class="qa spot" href="#/memoire" data-go style="--i:3">${I.brain}<span>Réviser${due.length ? ` <b>${due.length}</b>` : ''}</span></a>
    </div>

    ${last ? `<section class="sec"><h2 class="sec-title">Reprendre</h2>
      <a class="resume spot" href="#/page/${last.id}" data-go data-cover-link>
        ${cover(last.cover || 'papier', 'md')}
        <span class="resume-body"><span class="resume-icon">${esc(last.icon)}</span><span class="resume-title">${esc(last.title || 'Sans titre')}</span>
        <span class="resume-text">${esc(pageText(last).slice(0, 160))}</span><span class="resume-meta">Modifiée ${ago(last.updatedAt)} · ${plural(last.words || 0, 'mot')}</span></span>
      </a></section>` : ''}

    ${pinned.length ? `<section class="sec"><h2 class="sec-title">${I.pin} Épinglées</h2><div class="rail">${pinned.map((p, i) => pageCard(p, i)).join('')}</div></section>` : ''}

    <section class="sec"><h2 class="sec-title">Récentes <a class="sec-link" href="#/dossiers" data-go>Tout ranger ${I.chevron}</a></h2>
      ${recent.length ? `<div class="rail">${recent.slice(0, 10).map((p, i) => pageCard(p, i)).join('')}</div>` : '<div class="empty"><p>Ta première page t’attend.</p></div>'}
    </section>

    ${state.cards.length ? `<section class="sec"><a class="memo spot" href="#/memoire" data-go>
      <span class="memo-orb"><span></span></span>
      <span class="memo-body"><span class="memo-title">${due.length ? `${plural(due.length, 'passage')} à revoir aujourd’hui` : 'Ta mémoire est à jour'}</span><span class="memo-meta">${plural(state.cards.length, 'passage retenu', 'passages retenus')} · maîtrise ${Math.round(100 * avgMastery())} %</span></span>${I.chevron}
    </a></section>` : ''}

    <section class="sec"><h2 class="sec-title">Dossiers <button class="sec-link" type="button" data-action="new-folder">${I.plus} Nouveau</button></h2>
      ${roots.length ? `<div class="fgrid">${roots.map((f, i) => `<a class="fcard spot" href="#/dossiers" data-go data-open-folder="${f.id}" style="--i:${i}"><span class="fcard-ico">${esc(f.icon)}</span><span class="fcard-name">${esc(f.name)}</span><span class="fcard-count">${plural(deepCount(state.folders, state.pages, f.id), 'page')}</span></a>`).join('')}</div>` : '<button class="empty empty-btn" type="button" data-action="new-folder">Crée un dossier pour ranger tes pages par sujet : Projets, Idées, Sport…</button>'}
    </section>

    <section class="sec"><h2 class="sec-title">Notes vocales <a class="sec-link" href="#/notes" data-go>Tout voir ${I.chevron}</a></h2>
      ${state.notes.length ? `<div class="list">${state.notes.slice(0, 4).map((n, i) => noteRow(n, i)).join('')}</div>` : `<a class="empty empty-btn" href="../#parler">Aucune note pour l’instant. Raconte quelque chose dans <b>Do It</b> : elle apparaîtra ici.</a>`}
    </section>

    <footer class="foot"><button class="link" type="button" data-action="export-all">${I.download}Sauvegarder tout</button><button class="link" type="button" data-action="import">${I.upload}Importer</button><input id="import-file" type="file" accept="application/json,.json" hidden></footer>`}
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

  $('#view').innerHTML = `<section class="view notes">
    <header class="vhead"><p class="eyebrow">Depuis Do It</p><h1>Notes vocales</h1><p class="vsub">${plural(state.notes.length, 'note transcrite', 'notes transcrites')}, prêtes à devenir des pages.</p></header>
    <label class="search spot">${I.search}<input id="notes-search" type="search" placeholder="Rechercher une note" value="${attr(state.noteQuery)}" autocomplete="off"></label>
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
  return list.length ? list.map((n, i) => {
      const mood = moodOf(n.mood);
      const linked = state.pages.find((p) => p.source?.entryId === n.id);
      return `<a class="ncard spot" href="#/note/${n.id}" data-go style="--i:${Math.min(i, 10)}">
        <span class="ncard-top"><span>${longDate(n.createdAt)} · ${timeLabel(n.createdAt)}</span><span class="mood" title="${esc(mood.label)}">${mood.emoji}</span></span>
        <span class="ncard-title">${esc(n.title || 'Note vocale')}</span>
        <span class="ncard-text">${esc(n.summary || n.text)}</span>
        <span class="ncard-foot">${(n.themes || []).map((id) => {
          const t = themeOf(id, state.noteThemes);
          return `<span class="tag">${esc(t.emoji)} ${esc(t.label)}</span>`;
        }).join('')}${linked ? `<span class="tag is-neon">${I.page} Page</span>` : ''}</span>
      </a>`;
    }).join('') : state.notes.length
      ? '<div class="empty"><p class="empty-title">Aucune note ne correspond</p><p>Essaie un autre mot ou un autre thème.</p></div>'
      : '<a class="empty empty-btn" href="../#parler"><span class="empty-title">Pas encore de note vocale</span>Ouvre <b>Do It</b>, appuie sur la bulle et raconte : ta note arrive ici, déjà réécrite.</a>';
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
  $('#view').innerHTML = `<article class="page note-page">
    ${cover('onde', 'lg')}
    <div class="page-inner">
      <span class="page-icon static">🎙️</span>
      <p class="eyebrow">${longDate(n.createdAt)} · ${timeLabel(n.createdAt)} · ${mood.emoji} ${esc(mood.label)}</p>
      <h1 class="page-title" id="note-title" contenteditable="true" spellcheck="true" data-ph="Sans titre">${attr(n.title)}</h1>
      <div class="tags">${(n.themes || []).map((tid) => {
        const t = themeOf(tid, state.noteThemes);
        return `<span class="tag">${esc(t.emoji)} ${esc(t.label)}</span>`;
      }).join('')}</div>
      <p class="page-meta"><span class="save" id="save-state" data-state="saved">Enregistré dans Do It</span></p>
      <div class="doc" id="note-doc" contenteditable="true" spellcheck="true">${String(n.text || '').split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${attr(p.trim())}</p>`).join('') || '<p><br></p>'}</div>
      ${n.highlights?.length ? `<div class="keypoints"><p class="eyebrow">Points clés</p><ul>${n.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      <div class="note-actions">
        <button class="btn btn-neon" type="button" data-action="note-to-page" data-id="${n.id}">${linked ? `${I.page}Ouvrir la page` : `${I.spark}Transformer en page`}</button>
        <a class="btn" href="../#journal">${I.ext}Voir dans Do It</a>
      </div>
      ${n.segments?.length ? `<details class="raw"><summary>Ce que tu as dit <small>${plural(n.segments.length, 'prise')}</small></summary>${n.segments.map((s) => `<div class="raw-seg">${s.question ? `<p class="raw-q">« ${esc(s.question)} »</p>` : ''}<p>${esc(s.text)}</p></div>`).join('')}</details>` : ''}
    </div>
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

function renderFolders() {
  $('#view').innerHTML = `<section class="view folders">
    <header class="vhead"><p class="eyebrow">Ta bibliothèque</p><h1>Dossiers</h1><p class="vsub">${plural(state.folders.length, 'dossier')} · ${plural(state.pages.length, 'page')}. Glisse une page sur un dossier pour la ranger, ou touche ⋯.</p></header>
    <div class="vactions">
      <button class="btn btn-neon" type="button" data-action="new-folder">${I.folderPlus}Nouveau dossier</button>
      <button class="btn" type="button" data-action="new-page">${I.plus}Nouvelle page</button>
    </div>
    <div class="explorer">${treeHTML()}</div>
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
  $('#view').innerHTML = `<section class="view memory">
    <header class="vhead"><p class="eyebrow">Ce qui est encré reste ancré</p><h1>Mémoire</h1><p class="vsub">Surligne un passage dans une page et touche <b>✦ Retenir</b>. Encré te le reproposera au bon moment : demain, dans 3 jours, dans une semaine…</p></header>
    <div class="mstats">
      <div class="mstat" style="--i:0"><b>${state.cards.length}</b><span>${state.cards.length > 1 ? 'passages retenus' : 'passage retenu'}</span></div>
      <div class="mstat hot" style="--i:1"><b>${due.length}</b><span>à revoir aujourd’hui</span></div>
      <div class="mstat" style="--i:2"><b>${Math.round(100 * avgMastery())}<small>%</small></b><span>de maîtrise</span></div>
    </div>
    ${due.length ? `<button class="btn btn-neon btn-lg" type="button" data-action="start-review">${I.brain}Réviser maintenant</button>` : state.cards.length ? '<p class="calm">Tout est à jour. Reviens demain ✦</p>' : ''}
    <div class="mlist">${sorted.length ? sorted.map((c, i) => {
      const p = findPage(c.pageId);
      const level = Math.round(mastery(c) * 6);
      return `<article class="mcard" style="--i:${Math.min(i, 10)}">
        <p class="mcard-text">« ${esc(c.text)} »</p>
        <footer><span class="level" title="Maîtrise">${Array.from({ length: 6 }, (_, k) => `<i class="${k < level ? 'on' : ''}"></i>`).join('')}</span>
        <span class="mcard-due">${dueLabel(c)}</span>
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
    $('#view').innerHTML = `<section class="view memory"><div class="review-done"><span class="done-orb"></span><h1>Révision terminée</h1><p>${plural(r.remembered, 'passage retenu', 'passages retenus')} sur ${r.queue.length}. Ce qui est encré reste ancré.</p><a class="btn btn-neon" href="#/memoire" data-action="end-review">Retour à la mémoire</a></div></section>`;
    burst();
    return;
  }
  const p = findPage(card.pageId);
  $('#view').innerHTML = `<section class="view memory review">
    <div class="rv-top"><button class="icon-btn" type="button" data-action="end-review" aria-label="Arrêter">${I.close}</button><div class="rv-bar"><i style="width:${(100 * r.index) / r.queue.length}%"></i></div><span>${r.index + 1}/${r.queue.length}</span></div>
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
  return `<header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-sheet-close aria-label="Fermer">${I.close}</button></header>`;
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
    case 'export-all': {
      const data = { app: 'encre', version: 1, exportedAt: new Date().toISOString(), pages: state.pages, folders: state.folders, cards: state.cards };
      download(`encre-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      return;
    }
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
    if (e.target.id === 'home-search') {
      state.query = e.target.value;
      const body = $('#home-body');
      const q = state.query.trim();
      if (q) body.innerHTML = searchResults(q);
      else renderHome();
      if (!q) $('#home-search')?.focus();
    }
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

  // Halo qui suit le doigt ou la souris sur les cartes.
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

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
  const [pages, folders, cards, tabs, notes, noteThemes] = await Promise.all([
    db.getAll('pages'), db.getAll('folders'), db.getAll('cards'), db.getValue('tabs', []), loadVoiceNotes(), loadVoiceThemes(),
  ]);
  Object.assign(state, { pages, folders, cards, notes, noteThemes, tabs: tabs.filter((t) => pages.some((p) => p.id === t)) });
  await seed();
  if (!state.pages.length) state.pages = await db.getAll('pages');
  navigator.storage?.persist?.().catch(() => {});
  document.body.classList.add('is-ready');
  render(true);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  }
}

init();
