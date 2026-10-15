/**
 * Jeu d'icônes SVG au trait (24 × 24), dessinées pour le Pass J-24.
 * Décoratives par défaut (`aria-hidden`) ; passer `label` pour une icône porteuse de sens.
 */
import { s } from './dom';

type Shape =
  | { el: 'path'; d: string }
  | { el: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  | { el: 'rect'; x: number; y: number; width: number; height: number; rx: number };

const ICONS = {
  check: [{ el: 'path', d: 'M5 12.5l4.5 4.5L19 7.5' }],
  lock: [
    { el: 'rect', x: 5, y: 11, width: 14, height: 10, rx: 2.5 },
    { el: 'path', d: 'M8 11V8a4 4 0 0 1 8 0v3' },
  ],
  calendar: [
    { el: 'rect', x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 },
    { el: 'path', d: 'M3.5 10h17M8 3v4M16 3v4' },
  ],
  printer: [
    { el: 'path', d: 'M7 9V3.5h10V9' },
    { el: 'rect', x: 3.5, y: 9, width: 17, height: 8, rx: 2 },
    { el: 'path', d: 'M7 14h10v6.5H7z' },
  ],
  download: [{ el: 'path', d: 'M12 4v11M7 10.5l5 5 5-5M5 20h14' }],
  share: [{ el: 'path', d: 'M12 3.5v11M8 7.5l4-4 4 4M5.5 12v6.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V12' }],
  copy: [
    { el: 'rect', x: 9, y: 9, width: 11, height: 11, rx: 2.5 },
    { el: 'path', d: 'M5 15V6a2 2 0 0 1 2-2h8' },
  ],
  loop: [
    {
      el: 'path',
      d: 'M6.5 17.5c-2.6-1.6-3.2-5.5-.9-8 2-2.2 5.2-1.9 6.6.2 1 1.6 2.8 1.9 4.1.8 1.8-1.4 4.2 0 4.2 2.2 0 4-5 7.3-10 7.3-1.6 0-3-.3-4-.5z',
    },
    { el: 'circle', cx: 6.5, cy: 17.5, r: 2, fill: true },
  ],
  arrowRight: [{ el: 'path', d: 'M5 12h14M13 6l6 6-6 6' }],
  chevronDown: [{ el: 'path', d: 'M6 9l6 6 6-6' }],
  close: [{ el: 'path', d: 'M6 6l12 12M18 6L6 18' }],
  info: [
    { el: 'circle', cx: 12, cy: 12, r: 9 },
    { el: 'path', d: 'M12 11v5.5M12 7.6v.1' },
  ],
  alert: [
    { el: 'path', d: 'M12 3.5l9.5 16.5h-19z' },
    { el: 'path', d: 'M12 10v4.5M12 17.4v.1' },
  ],
  clock: [
    { el: 'circle', cx: 12, cy: 12, r: 9 },
    { el: 'path', d: 'M12 7v5l3.2 2' },
  ],
  phone: [
    { el: 'rect', x: 6.5, y: 2.5, width: 11, height: 19, rx: 2.5 },
    { el: 'path', d: 'M12 7v7M9.5 11.5L12 14l2.5-2.5' },
  ],
  external: [{ el: 'path', d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }],
  mail: [
    { el: 'rect', x: 3, y: 5, width: 18, height: 14, rx: 2.5 },
    { el: 'path', d: 'M3.5 7l8.5 6 8.5-6' },
  ],
  plusSquare: [
    { el: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3.5 },
    { el: 'path', d: 'M12 8.5v7M8.5 12h7' },
  ],
  refresh: [{ el: 'path', d: 'M20 11.5a8 8 0 1 0-2.4 5.8M20 4.5v7h-7' }],
  settings: [
    { el: 'path', d: 'M4 7h9M17 7h3M4 17h3M11 17h9' },
    { el: 'circle', cx: 15, cy: 7, r: 2.2 },
    { el: 'circle', cx: 9, cy: 17, r: 2.2 },
  ],
  image: [
    { el: 'rect', x: 3.5, y: 3.5, width: 17, height: 17, rx: 2.5 },
    { el: 'circle', cx: 9, cy: 9, r: 1.8 },
    { el: 'path', d: 'M20.5 15.5l-5-5-9.5 10' },
  ],
  flag: [{ el: 'path', d: 'M5 21V4M5 4.5h11l-2 4 2 4H5' }],
  heart: [{ el: 'path', d: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z' }],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;

/** Construit une icône SVG. */
export function icon(name: IconName, options: { label?: string; class?: string } = {}): SVGSVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    class: options.class ? `icon ${options.class}` : 'icon',
    focusable: 'false',
    ...(options.label ? { role: 'img', 'aria-label': options.label } : { 'aria-hidden': 'true' }),
  });
  for (const shape of ICONS[name] as readonly Shape[]) {
    if (shape.el === 'path') {
      svg.appendChild(s('path', { d: shape.d }));
    } else if (shape.el === 'circle') {
      svg.appendChild(
        s('circle', { cx: shape.cx, cy: shape.cy, r: shape.r, class: shape.fill ? 'icon-fill' : undefined }),
      );
    } else {
      svg.appendChild(
        s('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: shape.rx }),
      );
    }
  }
  return svg;
}
