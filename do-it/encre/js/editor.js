// Éditeur de pages d'Encré : un seul bloc éditable, des blocs façon Notion.
// Menu « / », raccourcis Markdown (#, -, 1., [], >, !, ---), barre de mise en forme,
// surlignage, passages « à retenir », insertion de texte dicté.
import { fold } from '../../js/themes.js';

export const BLOCKS = [
  { id: 'p', label: 'Texte', hint: 'Paragraphe', icon: '¶', keys: 'texte paragraphe normal' },
  { id: 'h1', label: 'Grand titre', hint: '#', icon: 'H1', keys: 'titre heading h1' },
  { id: 'h2', label: 'Titre', hint: '##', icon: 'H2', keys: 'titre heading h2' },
  { id: 'h3', label: 'Sous-titre', hint: '###', icon: 'H3', keys: 'sous titre heading h3' },
  { id: 'ul', label: 'Liste à puces', hint: '-', icon: '•', keys: 'liste puces bullet' },
  { id: 'ol', label: 'Liste numérotée', hint: '1.', icon: '1.', keys: 'liste numero ordonnee' },
  { id: 'todo', label: 'Cases à cocher', hint: '[]', icon: '☐', keys: 'taches todo cocher checklist' },
  { id: 'quote', label: 'Citation', hint: '>', icon: '❝', keys: 'citation quote' },
  { id: 'callout', label: 'Encadré', hint: '!', icon: '✦', keys: 'encadre callout important note' },
  { id: 'hr', label: 'Séparateur', hint: '---', icon: '—', keys: 'separateur ligne divider' },
  { id: 'date', label: 'Date du jour', hint: '', icon: '◷', keys: 'date jour aujourd hui' },
  { id: 'voice', label: 'Note vocale', hint: 'Do It', icon: '◉', keys: 'note vocale do it inserer' },
  { id: 'dictate', label: 'Dicter ici', hint: 'Micro', icon: '🎙', keys: 'dicter dictee micro voix' },
];

const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'DIV', 'HR', 'B', 'I', 'U', 'S', 'MARK', 'BR', 'CODE']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'IMG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS', 'HEAD', 'TITLE']);
const RENAME = { STRONG: 'B', EM: 'I', STRIKE: 'S', DEL: 'S', INS: 'U', H4: 'H3', H5: 'H3', H6: 'H3' };
const TOP_BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'DIV', 'HR']);

const PLACEHOLDERS = {
  P: 'Écris, ou tape « / » pour insérer un bloc',
  H1: 'Grand titre',
  H2: 'Titre',
  H3: 'Sous-titre',
  LI: 'Élément de liste',
  BLOCKQUOTE: 'Citation',
  DIV: 'Encadré',
};

const MARKDOWN = [
  ['###', 'h3'], ['##', 'h2'], ['#', 'h1'], ['-', 'ul'], ['*', 'ul'], ['1.', 'ol'],
  ['[]', 'todo'], ['[ ]', 'todo'], ['>', 'quote'], ['!', 'callout'],
];

function rename(el, tag) {
  const out = document.createElement(tag);
  for (const a of el.attributes) out.setAttribute(a.name, a.value);
  out.append(...el.childNodes);
  el.replaceWith(out);
  return out;
}

function unwrap(el) {
  el.replaceWith(...el.childNodes);
}

function cleanTree(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    let el = child;
    const tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) {
      el.remove();
      continue;
    }
    if (RENAME[tag]) el = rename(el, RENAME[tag]);
    cleanTree(el);
    if (!ALLOWED.has(el.tagName)) {
      unwrap(el);
      continue;
    }
    if (el.tagName === 'DIV' && el.getAttribute('class') !== 'callout') el = rename(el, 'P');
    for (const a of [...el.attributes]) {
      const keep =
        (el.tagName === 'DIV' && a.name === 'class' && a.value === 'callout') ||
        (el.tagName === 'UL' && a.name === 'class' && a.value === 'todo') ||
        (el.tagName === 'LI' && a.name === 'data-done' && a.value === 'true') ||
        (el.tagName === 'MARK' && a.name === 'data-card' && /^[\w-]{1,64}$/.test(a.value));
      if (!keep) el.removeAttribute(a.name);
    }
  }
}

/** HTML d'une page réduit aux balises et attributs connus. */
export function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  cleanTree(tpl.content);
  flattenBlocks(tpl.content);
  wrapLoose(tpl.content);
  return tpl.innerHTML;
}

/** Un paragraphe, titre ou encadré qui contient d'autres blocs est dissous. */
function flattenBlocks(root) {
  let again = true;
  while (again) {
    again = false;
    for (const el of [...root.children]) {
      if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV'].includes(el.tagName) && [...el.children].some((c) => TOP_BLOCKS.has(c.tagName))) {
        unwrap(el);
        again = true;
      }
    }
  }
}

/** Texte ou éléments en ligne posés à la racine : regroupés dans des paragraphes. */
function wrapLoose(root) {
  let p = null;
  for (const node of [...root.childNodes]) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && TOP_BLOCKS.has(node.tagName);
    if (isBlock) {
      p = null;
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim() && !p) {
      node.remove();
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LI') {
      const ul = document.createElement('ul');
      node.replaceWith(ul);
      ul.append(node);
      p = null;
      continue;
    }
    if (!p) {
      p = document.createElement('p');
      node.replaceWith(p);
    }
    p.append(node);
  }
}

export function htmlToText(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return [...tpl.content.childNodes].map((n) => n.textContent.trim()).filter(Boolean).join('\n\n');
}

export function countWords(text) {
  return (String(text || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
}

/**
 * @param {HTMLElement} root
 * @param {{ html?: string, onChange?: (html: string) => void, onDirty?: () => void,
 *   onCommand?: (id: string) => void, onError?: (msg: string) => void, onState?: (s: object) => void }} options
 */
export function createEditor(root, { html = '', onChange = () => {}, onDirty = () => {}, onCommand = () => {}, onError = () => {}, onState = () => {} } = {}) {
  root.contentEditable = 'true';
  root.spellcheck = true;
  root.setAttribute('role', 'textbox');
  root.setAttribute('aria-multiline', 'true');
  root.setAttribute('lang', 'fr');

  const exec = (cmd, value = null) => document.execCommand(cmd, false, value);
  const selection = () => window.getSelection();
  const range = () => {
    const s = selection();
    return s && s.rangeCount ? s.getRangeAt(0) : null;
  };
  const inside = (node) => Boolean(node) && (node === root || root.contains(node));

  function topBlock(node) {
    let n = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (n && n !== root && n.parentNode !== root) n = n.parentNode;
    return n && n !== root ? n : null;
  }

  function blockOf(node) {
    let n = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (n && n !== root) {
      if (n.tagName === 'LI' || n.parentNode === root) return n;
      n = n.parentNode;
    }
    return null;
  }

  const currentBlock = () => {
    const r = range();
    return r && inside(r.startContainer) ? blockOf(r.startContainer) : null;
  };

  function textBefore(block) {
    const r = range();
    if (!r || !block) return '';
    const pre = document.createRange();
    pre.selectNodeContents(block);
    try {
      pre.setEnd(r.startContainer, r.startOffset);
    } catch {
      return '';
    }
    return pre.toString().replace(/ /g, ' ');
  }

  function deleteBefore(block) {
    const r = range();
    const pre = document.createRange();
    pre.selectNodeContents(block);
    pre.setEnd(r.startContainer, r.startOffset);
    pre.deleteContents();
    if (!block.textContent && !block.querySelector('br')) block.append(document.createElement('br'));
  }

  function caretTo(el, atEnd = true) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!atEnd);
    const s = selection();
    s.removeAllRanges();
    s.addRange(r);
  }

  const isEmpty = (el) => !el.textContent.replace(/​/g, '').trim() && el.tagName !== 'HR';

  function fresh(el) {
    if (!el) return;
    el.classList.add('fresh');
    setTimeout(() => {
      el.classList.remove('fresh');
      if (!el.getAttribute('class')) el.removeAttribute('class');
    }, 700);
  }

  function ensureContent() {
    if (!root.firstElementChild) root.innerHTML = '<p><br></p>';
    if (root.lastElementChild?.tagName === 'HR') root.append(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
  }

  let saveTimer = 0;
  function changed() {
    onDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 500);
    updatePlaceholder();
  }

  function getHTML() {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('[data-ph]').forEach((n) => n.removeAttribute('data-ph'));
    clone.querySelectorAll('.fresh').forEach((n) => n.classList.remove('fresh'));
    return sanitize(clone.innerHTML);
  }

  function flush() {
    clearTimeout(saveTimer);
    onChange(getHTML());
  }

  function setHTML(value) {
    root.innerHTML = sanitize(value) || '<p><br></p>';
    ensureContent();
    updatePlaceholder();
  }

  // ───── Blocs ─────

  function listTypeOf(li) {
    if (!li || li.tagName !== 'LI') return null;
    const list = li.parentNode;
    if (list.tagName === 'OL') return 'ol';
    return list.classList.contains('todo') ? 'todo' : 'ul';
  }

  const isListType = (t) => t === 'ul' || t === 'ol' || t === 'todo';

  function makeList(type) {
    const list = document.createElement(type === 'ol' ? 'ol' : 'ul');
    if (type === 'todo') list.className = 'todo';
    return list;
  }

  function sameList(el, type) {
    if (!el) return false;
    if (type === 'ol') return el.tagName === 'OL';
    return el.tagName === 'UL' && el.classList.contains('todo') === (type === 'todo');
  }

  /** Place le curseur après `offset` caractères dans `el`. */
  function caretAt(el, offset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = offset;
    let node;
    while ((node = walker.nextNode())) {
      if (left <= node.length) {
        const r = document.createRange();
        r.setStart(node, left);
        r.collapse(true);
        selection().removeAllRanges();
        selection().addRange(r);
        return;
      }
      left -= node.length;
    }
    caretTo(el, true);
  }

  function retag(el, tag, cls = '') {
    const out = document.createElement(tag);
    if (cls) out.className = cls;
    out.append(...el.childNodes);
    if (!out.firstChild) out.innerHTML = '<br>';
    el.replaceWith(out);
    return out;
  }

  /** Bloc de premier niveau → élément de liste (fusionné avec la liste précédente si elle est du même type). */
  function blockToList(top, type) {
    const li = document.createElement('li');
    li.append(...top.childNodes);
    if (!li.firstChild) li.innerHTML = '<br>';
    const prev = top.previousElementSibling;
    if (sameList(prev, type)) {
      prev.append(li);
      top.remove();
    } else {
      const list = makeList(type);
      list.append(li);
      top.replaceWith(list);
      fresh(list);
    }
    return li;
  }

  /** Élément de liste → paragraphe, la liste est coupée en deux si besoin. */
  function listToBlock(li) {
    const list = li.parentNode;
    if (list.parentNode !== root) {
      exec('outdent');
      return currentBlock();
    }
    const p = document.createElement('p');
    const nested = [];
    for (const child of [...li.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE && (child.tagName === 'UL' || child.tagName === 'OL')) nested.push(child);
      else p.append(child);
    }
    if (!p.textContent && !p.querySelector('br')) p.innerHTML = '<br>';
    const tail = [];
    for (let n = li.nextElementSibling; n; n = n.nextElementSibling) tail.push(n);
    li.remove();
    list.after(p, ...nested);
    if (tail.length) {
      const rest = list.cloneNode(false);
      rest.append(...tail);
      (nested.at(-1) || p).after(rest);
    }
    if (!list.children.length) list.remove();
    return p;
  }

  function setBlock(type) {
    if (!inside(range()?.startContainer)) root.focus();
    let block = currentBlock();
    if (!block) return;
    const listType = listTypeOf(block);
    const offset = textBefore(block).length;

    if (type === 'hr') {
      const top = topBlock(block);
      const hr = document.createElement('hr');
      const p = Object.assign(document.createElement('p'), { innerHTML: '<br>' });
      if (isEmpty(top) && top.tagName === 'P') top.replaceWith(hr, p);
      else top.after(hr, p);
      fresh(hr);
      caretTo(p, false);
      changed();
      return;
    }

    if (isListType(type)) {
      let target;
      if (listType === type) {
        target = listToBlock(block);
      } else if (listType) {
        const list = block.parentNode;
        if ((type === 'ol') !== (list.tagName === 'OL')) {
          const next = makeList(type);
          next.append(...list.childNodes);
          list.replaceWith(next);
          fresh(next);
        } else if (type === 'todo') list.className = 'todo';
        else list.removeAttribute('class');
        target = block;
      } else {
        target = blockToList(topBlock(block), type);
      }
      caretAt(target, offset);
      changed();
      return;
    }

    if (listType) block = listToBlock(block);
    const top = topBlock(block);
    const tag = { p: 'P', h1: 'H1', h2: 'H2', h3: 'H3', quote: 'BLOCKQUOTE', callout: 'DIV' }[type] || 'P';
    const cls = type === 'callout' ? 'callout' : '';
    const target = top.tagName === tag && top.className === cls ? top : retag(top, tag.toLowerCase(), cls);
    fresh(target);
    caretAt(target, offset);
    changed();
  }

  function blockType() {
    const b = currentBlock();
    if (!b) return 'p';
    const lt = listTypeOf(b);
    if (lt) return lt;
    if (b.tagName === 'BLOCKQUOTE') return 'quote';
    if (b.tagName === 'DIV') return 'callout';
    return b.tagName.toLowerCase();
  }

  // ───── En ligne ─────

  function inline(cmd) {
    if (!inside(range()?.commonAncestorContainer)) return;
    exec(cmd);
    changed();
    emitState();
  }

  function closestTag(node, tag) {
    let n = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (n && n !== root) {
      if (n.tagName === tag) return n;
      n = n.parentNode;
    }
    return null;
  }

  /** Surligne la sélection ; avec `cardId`, le passage devient une carte de mémoire. */
  function mark(cardId = null) {
    const r = range();
    if (!r || !inside(r.commonAncestorContainer)) return null;
    const existing = closestTag(r.commonAncestorContainer, 'MARK');
    if (r.collapsed) {
      if (existing && !cardId) {
        unwrap(existing);
        changed();
      }
      return null;
    }
    if (blockOf(r.startContainer) !== blockOf(r.endContainer)) {
      onError('Sélectionne un passage dans un seul paragraphe.');
      return null;
    }
    if (existing && !cardId) {
      unwrap(existing);
      changed();
      emitState();
      return null;
    }
    const el = document.createElement('mark');
    if (cardId) el.dataset.card = cardId;
    el.append(r.extractContents());
    el.querySelectorAll('mark').forEach(unwrap);
    r.insertNode(el);
    if (existing && existing !== el && existing.contains(el)) unwrap(existing);
    const text = el.textContent.trim();
    const after = document.createRange();
    after.setStartAfter(el);
    after.collapse(true);
    selection().removeAllRanges();
    selection().addRange(after);
    el.classList.add('fresh');
    setTimeout(() => el.classList.remove('fresh'), 900);
    changed();
    emitState();
    return text;
  }

  // ───── Insertion ─────

  let savedRange = null;
  function saveSelection() {
    const r = range();
    savedRange = r && inside(r.startContainer) ? r.cloneRange() : null;
    return savedRange;
  }

  function restoreSelection() {
    if (!savedRange) return false;
    root.focus({ preventScroll: true });
    selection().removeAllRanges();
    selection().addRange(savedRange);
    return true;
  }

  /** Insère des blocs HTML après le bloc courant (ou à sa place s'il est vide). */
  function insertBlocks(htmlBlocks) {
    restoreSelection();
    const tpl = document.createElement('template');
    tpl.innerHTML = sanitize(htmlBlocks);
    const nodes = [...tpl.content.childNodes];
    if (!nodes.length) return;
    const block = currentBlock();
    const top = block ? topBlock(block) : null;
    if (top && isEmpty(top) && top.tagName === 'P') top.replaceWith(...nodes);
    else if (top) top.after(...nodes);
    else root.append(...nodes);
    nodes.forEach((n) => n.nodeType === Node.ELEMENT_NODE && fresh(n));
    const last = nodes[nodes.length - 1];
    if (last.nodeType === Node.ELEMENT_NODE) caretTo(last);
    ensureContent();
    changed();
  }

  function insertText(text) {
    restoreSelection();
    exec('insertText', text);
    changed();
  }

  // ───── Menu « / » ─────

  const menu = document.createElement('div');
  menu.className = 'slash';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  document.body.append(menu);
  let slash = null; // { block, query, index, items }

  function slashItems(query) {
    const q = fold(query.trim());
    return BLOCKS.filter((b) => !q || fold(`${b.label} ${b.keys}`).includes(q));
  }

  function renderSlash() {
    const items = slashItems(slash.query);
    slash.items = items;
    if (!items.length) {
      menu.innerHTML = '<p class="slash-empty">Aucun bloc</p>';
    } else {
      slash.index = Math.min(slash.index, items.length - 1);
      menu.innerHTML = items
        .map((b, i) => `<button type="button" role="option" class="slash-item${i === slash.index ? ' is-active' : ''}" data-block="${b.id}" aria-selected="${i === slash.index}"><span class="slash-ico">${b.icon}</span><span class="slash-label">${b.label}</span><span class="slash-hint">${b.hint}</span></button>`)
        .join('');
      menu.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    }
    positionMenu();
  }

  function positionMenu() {
    const r = range();
    let rect = r?.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) rect = slash.block.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewH = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const menuH = Math.min(320, menu.scrollHeight || 320);
    const below = rect.bottom + 8;
    const top = below + menuH > viewH - 8 ? Math.max(8, rect.top - menuH - 8) : below;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - 272);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  function openSlash(block) {
    slash = { block, query: '', index: 0, items: [] };
    menu.hidden = false;
    renderSlash();
  }

  function closeSlash() {
    slash = null;
    menu.hidden = true;
  }

  function pickSlash(id) {
    if (!slash) return;
    const { block } = slash;
    closeSlash();
    if (textBefore(block).startsWith('/')) deleteBefore(block);
    runBlockCommand(id);
  }

  function runBlockCommand(id) {
    if (id === 'date') {
      const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
      exec('insertText', date.charAt(0).toUpperCase() + date.slice(1));
      changed();
    } else if (id === 'voice' || id === 'dictate') {
      saveSelection();
      onCommand(id);
    } else {
      setBlock(id);
    }
  }

  menu.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const item = e.target.closest('[data-block]');
    if (item) pickSlash(item.dataset.block);
  });

  // ───── Événements ─────

  function updatePlaceholder() {
    root.querySelectorAll('[data-ph]').forEach((n) => n.removeAttribute('data-ph'));
    const only = root.childElementCount === 1 && root.firstElementChild;
    const target = currentBlock() || (only && isEmpty(only) ? only : null);
    if (target && isEmpty(target) && PLACEHOLDERS[target.tagName]) target.dataset.ph = PLACEHOLDERS[target.tagName];
  }

  function emitState() {
    const r = range();
    const active = Boolean(r && inside(r.startContainer));
    onState({
      active,
      collapsed: !r || r.collapsed,
      block: active ? blockType() : null,
      bold: active && document.queryCommandState('bold'),
      italic: active && document.queryCommandState('italic'),
      underline: active && document.queryCommandState('underline'),
      strike: active && document.queryCommandState('strikeThrough'),
      mark: active && Boolean(closestTag(r.startContainer, 'MARK')),
      rect: active && !r.collapsed ? r.getBoundingClientRect() : null,
    });
  }

  root.addEventListener('focus', () => {
    exec('defaultParagraphSeparator', 'p');
    exec('styleWithCSS', false);
  });

  root.addEventListener('input', (e) => {
    const block = currentBlock();
    if (!block) return changed();
    const before = textBefore(block);

    if (slash) {
      if (!before.startsWith('/') || blockOf(range().startContainer) !== slash.block || before.length > 24) closeSlash();
      else {
        slash.query = before.slice(1);
        slash.index = 0;
        renderSlash();
      }
    } else if (e.data === '/' && before === '/') {
      openSlash(block);
    }

    if ((e.data === ' ' || e.data === ' ') && block.tagName === 'P') {
      const typed = before.replace(/\s$/, '');
      const hit = MARKDOWN.find(([marker]) => marker === typed);
      if (hit && before.length === typed.length + 1) {
        deleteBefore(block);
        setBlock(hit[1]);
        return;
      }
    }
    if (e.data === '-' && before === '---' && block.tagName === 'P') {
      deleteBefore(block);
      setBlock('hr');
      return;
    }
    if (block.tagName === 'LI' && block.dataset.done && isEmpty(block)) delete block.dataset.done;
    changed();
  });

  root.addEventListener('keydown', (e) => {
    if (slash) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = slash.items.length || 1;
        slash.index = (slash.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        renderSlash();
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && slash.items.length) {
        e.preventDefault();
        pickSlash(slash.items[slash.index].id);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlash();
        return;
      }
    }

    const block = currentBlock();
    if (!block) return;
    const top = topBlock(block);
    const r = range();

    if (e.key === 'Enter' && !e.shiftKey && r?.collapsed && ['H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV'].includes(top.tagName)) {
      const after = document.createRange();
      after.selectNodeContents(top);
      after.setStart(r.startContainer, r.startOffset);
      if (!after.toString().length) {
        e.preventDefault();
        const p = Object.assign(document.createElement('p'), { innerHTML: '<br>' });
        top.after(p);
        caretTo(p, false);
        fresh(p);
        changed();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && block.tagName === 'LI' && isEmpty(block) && !block.querySelector('ul, ol')) {
      e.preventDefault();
      const p = listToBlock(block);
      caretTo(p, false);
      changed();
      return;
    }

    if (e.key === 'Backspace' && r?.collapsed && !textBefore(block) && ['H1', 'H2', 'H3', 'BLOCKQUOTE', 'DIV', 'LI'].includes(block.tagName)) {
      e.preventDefault();
      setBlock(block.tagName === 'LI' ? listTypeOf(block) : 'p');
      return;
    }

    if (e.key === 'Tab' && block.tagName === 'LI') {
      e.preventDefault();
      exec(e.shiftKey ? 'outdent' : 'indent');
      changed();
    }
  });

  // Cases à cocher : un appui sur la case (à gauche de l'élément) la coche.
  root.addEventListener('pointerdown', (e) => {
    const li = e.target.closest?.('ul.todo > li');
    if (!li || !inside(li)) return;
    const box = li.getBoundingClientRect();
    if (e.clientX - box.left > 30) return;
    e.preventDefault();
    if (li.dataset.done) delete li.dataset.done;
    else li.dataset.done = 'true';
    li.classList.add('tick');
    setTimeout(() => li.classList.remove('tick'), 500);
    changed();
  });

  root.addEventListener('paste', (e) => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const htmlData = data.getData('text/html');
    if (htmlData) exec('insertHTML', sanitize(htmlData));
    else exec('insertText', data.getData('text/plain'));
    changed();
  });

  const onSelection = () => {
    if (slash && !inside(range()?.startContainer)) closeSlash();
    if (inside(range()?.startContainer)) updatePlaceholder();
    emitState();
  };
  document.addEventListener('selectionchange', onSelection);
  const onScroll = () => slash && positionMenu();
  window.addEventListener('scroll', onScroll, { passive: true });
  const onBlur = () => setTimeout(() => {
    if (!root.contains(document.activeElement)) {
      closeSlash();
      flush();
    }
  }, 150);
  root.addEventListener('blur', onBlur);

  setHTML(html);

  return {
    root,
    getHTML,
    setHTML,
    flush,
    setBlock,
    blockType,
    inline,
    mark,
    insertBlocks,
    insertText,
    saveSelection,
    restoreSelection,
    runBlockCommand,
    focusEnd() {
      root.focus();
      const last = root.lastElementChild;
      if (last) caretTo(last);
    },
    text: () => root.innerText,
    destroy() {
      flush();
      document.removeEventListener('selectionchange', onSelection);
      window.removeEventListener('scroll', onScroll);
      menu.remove();
    },
  };
}
