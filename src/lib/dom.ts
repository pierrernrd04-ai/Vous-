/**
 * Petits utilitaires DOM sans dépendance.
 *
 * - `h()` construit un élément typé (attributs, classes, écouteurs, enfants).
 *   Le texte passe toujours par des nœuds texte : aucune injection HTML possible.
 * - Les styles en ligne passent par `style.setProperty` : compatible avec la CSP
 *   (`style-src 'self'`, sans `'unsafe-inline'`), qui bloque l'attribut `style`.
 *
 * Aucun accès au DOM au chargement du module : importable depuis Node (tests).
 */

export type Child = Node | string | number | false | null | undefined | readonly Child[];

type AttrValue = string | number | boolean | null | undefined;

type Listeners = {
  [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

export interface ElementProps {
  class?: string | readonly (string | false | null | undefined)[];
  id?: string;
  /** Contenu texte (ajouté avant les enfants). */
  text?: string;
  /** Attributs HTML ; `true` → attribut vide, `false`/`null`/`undefined` → absent. */
  attrs?: Record<string, AttrValue>;
  dataset?: Record<string, string>;
  /** Propriétés CSS (y compris variables `--x`), posées via `setProperty`. */
  style?: Record<string, string>;
  on?: Listeners;
}

function classList(value: ElementProps['class']): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return value.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}

/** Ajoute des enfants (tableaux aplatis, valeurs vides ignorées). */
export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      append(parent, ...(child as readonly Child[]));
    } else if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else {
      parent.appendChild(child as Node);
    }
  }
}

function applyProps(el: Element, props: ElementProps): void {
  const cls = classList(props.class);
  if (cls) el.setAttribute('class', cls);
  if (props.id) el.id = props.id;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    for (const [name, value] of Object.entries(props.dataset ?? {})) el.dataset[name] = value;
    for (const [name, value] of Object.entries(props.style ?? {})) el.style.setProperty(name, value);
  }
  for (const [type, listener] of Object.entries(props.on ?? {})) {
    if (listener) el.addEventListener(type, listener as EventListener);
  }
  if (props.text !== undefined) el.appendChild(document.createTextNode(props.text));
}

/** Crée un élément HTML typé. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, ...children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crée un élément SVG. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: (SVGElement | null | undefined | false)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, { attrs });
  for (const child of children) if (child) el.appendChild(child);
  return el;
}

/** Vide un élément. */
export function clear(el: Element): void {
  el.replaceChildren();
}

/** Remplace le contenu d'un élément. */
export function render(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, ...children);
}

/** `querySelector` typé. */
export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

/** `querySelectorAll` typé, en tableau. */
export function qsa<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** `querySelector` qui lève une erreur explicite si l'élément manque (structure de page attendue). */
export function must<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Élément introuvable : ${selector}`);
  return el;
}

/** Exécute `fn` une fois le DOM prêt. */
export function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

let liveRegion: HTMLElement | null = null;

/**
 * Annonce un message aux lecteurs d'écran via une région `aria-live` globale.
 * `assertive` pour les erreurs bloquantes, `polite` sinon.
 */
export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  if (!liveRegion || !liveRegion.isConnected) {
    liveRegion = h('div', { class: 'sr-only', attrs: { 'aria-live': politeness, 'aria-atomic': 'true' } });
    document.body.appendChild(liveRegion);
  }
  liveRegion.setAttribute('aria-live', politeness);
  liveRegion.textContent = '';
  // Laisser un tour de boucle pour que le changement soit bien perçu.
  window.setTimeout(() => {
    if (liveRegion) liveRegion.textContent = message;
  }, 60);
}

let toastTimer = 0;

/** Petit message temporaire en bas d'écran (annoncé aux lecteurs d'écran). */
export function toast(message: string, tone: 'ok' | 'error' = 'ok'): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.tone = tone;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('is-visible'), 3200);
}

/** Copie un texte dans le presse-papiers (API moderne, sinon repli `execCommand`). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Repli ci-dessous.
  }
  try {
    const area = h('textarea', { class: 'sr-only', attrs: { readonly: true, 'aria-hidden': 'true' } });
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Déclenche le téléchargement d'un Blob sous le nom donné. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = h('a', { attrs: { href: url, download: filename, hidden: true } });
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Vrai si l'utilisateur préfère réduire les animations. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
