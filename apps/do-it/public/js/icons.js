// Icônes SVG en ligne (trait 1,8 px, héritent de la couleur du texte).

const svg = (body, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/>'),
  grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  sparkle: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  flame: svg('<path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6-4-8-.3 2-1.3 3.2-2.5 3.8C12.8 7.5 11 4.6 8.5 2.5 8.7 6 5 8.6 5 14.5 5 18.8 8 22 12 22z"/>', 16),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 18),
  reply: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/>', 18),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', 18),
  upload: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>', 18),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 18),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 18),
  wand: svg('<path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10"/><path d="M18.5 3.5l1 1M10.5 3.5l1 1M18.5 8.5l1-1"/>', 18),
};
