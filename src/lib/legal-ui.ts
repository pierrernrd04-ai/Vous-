/**
 * Rendu des pages légales : valeurs tirées de src/legal.ts, et mise en évidence
 * visible des valeurs « À COMPLÉTER » pour que l'éditeur sache quoi renseigner.
 */
import { formatDate } from './format';
import { TO_COMPLETE, isToComplete, legal } from '../legal';
import { h, type Child } from './dom';

/** Valeur légale, ou marqueur « À COMPLÉTER » surligné. */
export function legalValue(value: string): Node {
  if (isToComplete(value)) {
    return h('mark', { class: 'todo', attrs: { title: 'Valeur à renseigner dans src/legal.ts' }, text: TO_COMPLETE });
  }
  return document.createTextNode(value);
}

/** Lien `mailto:` vers l'adresse, ou marqueur « À COMPLÉTER ». */
export function legalEmail(email: string): Node {
  if (isToComplete(email) || !email.includes('@')) return legalValue(TO_COMPLETE);
  return h('a', { attrs: { href: `mailto:${email}` }, text: email });
}

/** Lien externe, ou marqueur « À COMPLÉTER ». */
export function legalLink(url: string, label?: string): Node {
  if (isToComplete(url)) return legalValue(TO_COMPLETE);
  return h('a', { attrs: { href: url, rel: 'noopener' }, text: label ?? url.replace(/^https?:\/\//, '') });
}

/** « Pierre Renard EI » */
export function editorName(): Node[] {
  return [legalValue(legal.editor.name), document.createTextNode(` ${legal.editor.status}`)];
}

/** Paire libellé / valeur pour une liste de définitions. */
export function defRow(label: string, ...value: Child[]): HTMLElement {
  return h('div', { class: 'legal-dl__row' }, h('dt', { text: label }), h('dd', {}, ...value));
}

export interface LegalSection {
  id: string;
  title: string;
  body: Child[];
}

/** Monte une page légale : sommaire, sections, date de mise à jour. */
export function renderLegalPage(
  main: HTMLElement,
  page: { eyebrow: string; title: string; intro: Child[]; sections: LegalSection[] },
): void {
  const toc = h(
    'nav',
    { class: 'legal-toc', attrs: { 'aria-label': 'Sommaire' } },
    h('p', { class: 'legal-toc__title', text: 'Sommaire' }),
    h(
      'ol',
      {},
      page.sections.map((section) => h('li', {}, h('a', { attrs: { href: `#${section.id}` }, text: section.title }))),
    ),
  );
  const content = h(
    'div',
    { class: 'legal prose' },
    page.sections.map((section) =>
      h(
        'section',
        { id: section.id, class: 'legal__section', attrs: { 'aria-labelledby': `${section.id}-title` } },
        h('h2', { id: `${section.id}-title`, text: section.title }),
        ...section.body,
      ),
    ),
  );
  main.replaceChildren(
    h(
      'div',
      { class: 'wrap wrap--narrow section legal-page' },
      h('p', { class: 'eyebrow', text: page.eyebrow }),
      h('h1', { text: page.title }),
      h('p', { class: 'legal-updated muted', text: `Dernière mise à jour : ${formatDate(legal.lastUpdated)}` }),
      h('div', { class: 'lead legal-intro' }, ...page.intro),
      toc,
      content,
    ),
  );
}
