/**
 * Image story 1080 × 1920 (« Ma prépa commence lundi ») dessinée dans un canvas,
 * puis partagée (Web Share, fichiers) ou téléchargée en PNG.
 * Aucun accès au DOM au chargement du module.
 */
import type { Phase } from '../shared/api-types';
import { announce, downloadBlob, h, toast } from './dom';
import { icon } from './icons';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export interface StoryBar {
  phase: Phase;
  km: number;
  deload: boolean;
  current?: boolean;
}

export interface StoryData {
  /** Petite ligne en capitales au-dessus du titre (course et date). */
  eyebrow: string;
  /** Titre, en blanc. */
  headline: string;
  /** Fin du titre, en dégradé (ex. « lundi. »). */
  highlight: string;
  /** Ligne sous le titre. */
  subline: string;
  /** Une barre par semaine (volume), colorée par phase. */
  bars: StoryBar[];
  /** Jusqu'à 3 chiffres clés. */
  stats: { value: string; label: string }[];
  /** Pied de l'image (adresse du site). */
  footer: string;
}

const COLORS = {
  bg: '#050f15',
  ink: '#e6f2f0',
  ink2: '#c3d6d4',
  muted: '#8aa4a3',
  accent: '#2be39b',
  accent2: '#1ea6d0',
  line: '#1d3640',
  surface: 'rgba(14, 30, 37, 0.86)',
  phase: {
    base: '#1ea6d0',
    developpement: '#25c98f',
    specifique: '#ffc24b',
    affutage: '#b28dff',
  } satisfies Record<Phase, string>,
};

const DISPLAY_FONT = '"Bricolage Grotesque", "Arial Narrow", system-ui, sans-serif';
const BODY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

async function ensureFonts(): Promise<void> {
  try {
    if (!document.fonts) return;
    await Promise.race([
      Promise.all([
        document.fonts.load(`800 120px ${DISPLAY_FONT}`),
        document.fonts.load(`700 40px ${DISPLAY_FONT}`),
      ]),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Police de repli : l'image reste lisible.
  }
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(5, 15, 21, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  };
  glow(860, 380, 760, 'rgba(37, 201, 143, 0.30)');
  glow(120, 1380, 700, 'rgba(30, 166, 208, 0.22)');

  // Grande boucle décorative (le parcours), en fond.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const grad = ctx.createLinearGradient(380, 120, 1080, 900);
  grad.addColorStop(0, COLORS.accent);
  grad.addColorStop(1, COLORS.accent2);
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.moveTo(560, 760);
  ctx.bezierCurveTo(380, 620, 420, 300, 640, 230);
  ctx.bezierCurveTo(820, 170, 900, 320, 980, 300);
  ctx.bezierCurveTo(1120, 270, 1160, 520, 1040, 640);
  ctx.bezierCurveTo(930, 750, 760, 860, 560, 760);
  ctx.stroke();
  ctx.restore();
}

function drawBrand(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // Pastille logo : boucle + point de départ.
  roundRect(ctx, 80, 96, 88, 88, 24);
  ctx.fillStyle = '#0e1e25';
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  const grad = ctx.createLinearGradient(96, 110, 152, 170);
  grad.addColorStop(0, COLORS.accent);
  grad.addColorStop(1, COLORS.accent2);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(106, 162);
  ctx.bezierCurveTo(92, 150, 94, 126, 110, 118);
  ctx.bezierCurveTo(124, 111, 134, 122, 138, 130);
  ctx.bezierCurveTo(142, 137, 150, 134, 154, 132);
  ctx.bezierCurveTo(160, 150, 136, 168, 106, 162);
  ctx.stroke();
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(106, 162, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 44px ${DISPLAY_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Pass J-24', 196, 128);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 30px ${BODY_FONT}`;
  ctx.fillText('par Traceo', 196, 168);
  ctx.restore();
}

function drawHeadline(ctx: CanvasRenderingContext2D, data: StoryData): number {
  const left = 80;
  const maxWidth = STORY_WIDTH - 2 * left;
  let y = 360;

  ctx.save();
  ctx.fillStyle = COLORS.accent;
  ctx.font = `800 36px ${BODY_FONT}`;
  setSpacing(ctx, 5);
  ctx.textBaseline = 'alphabetic';
  for (const line of wrap(ctx, data.eyebrow.toUpperCase(), maxWidth)) {
    ctx.fillText(line, left, y);
    y += 50;
  }
  setSpacing(ctx, 0);
  y += 70;

  let size = 150;
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  let lines = wrap(ctx, data.headline, maxWidth);
  let highlightLines = wrap(ctx, data.highlight, maxWidth);
  while (lines.length + highlightLines.length > 4 && size > 96) {
    size -= 8;
    ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
    lines = wrap(ctx, data.headline, maxWidth);
    highlightLines = wrap(ctx, data.highlight, maxWidth);
  }
  const lineHeight = size * 1.02;
  setSpacing(ctx, -3);
  ctx.fillStyle = COLORS.ink;
  for (const line of lines) {
    ctx.fillText(line, left, y);
    y += lineHeight;
  }
  const grad = ctx.createLinearGradient(left, y - size, left + maxWidth * 0.8, y);
  grad.addColorStop(0, COLORS.accent);
  grad.addColorStop(0.55, '#22d3c5');
  grad.addColorStop(1, COLORS.accent2);
  ctx.fillStyle = grad;
  for (const line of highlightLines) {
    ctx.fillText(line, left, y);
    y += lineHeight;
  }
  setSpacing(ctx, 0);

  y += 10;
  ctx.fillStyle = COLORS.ink2;
  ctx.font = `600 42px ${BODY_FONT}`;
  for (const line of wrap(ctx, data.subline, maxWidth)) {
    ctx.fillText(line, left, y);
    y += 56;
  }
  ctx.restore();
  return y;
}

function drawBars(ctx: CanvasRenderingContext2D, bars: StoryBar[], top: number): number {
  if (bars.length === 0) return top;
  const left = 80;
  const width = STORY_WIDTH - 2 * left;
  const height = 300;
  const panelPad = 36;
  const panelTop = top;
  const panelHeight = height + panelPad * 2 + 70;

  ctx.save();
  roundRect(ctx, left, panelTop, width, panelHeight, 36);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerLeft = left + panelPad;
  const innerWidth = width - panelPad * 2;
  const baseY = panelTop + panelPad + height;
  const maxKm = Math.max(...bars.map((b) => b.km), 1);
  const gap = bars.length > 20 ? 8 : 12;
  const barWidth = (innerWidth - gap * (bars.length - 1)) / bars.length;

  bars.forEach((bar, i) => {
    const barHeight = Math.max(14, (bar.km / maxKm) * (height - 20));
    const x = innerLeft + i * (barWidth + gap);
    roundRect(ctx, x, baseY - barHeight, barWidth, barHeight, Math.min(10, barWidth / 2));
    ctx.globalAlpha = bar.deload ? 0.45 : 1;
    ctx.fillStyle = COLORS.phase[bar.phase] ?? COLORS.accent;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (bar.current) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  });

  // Légende des phases présentes.
  const phases: Phase[] = ['base', 'developpement', 'specifique', 'affutage'];
  const names: Record<Phase, string> = {
    base: 'Base',
    developpement: 'Développement',
    specifique: 'Spécifique',
    affutage: 'Affûtage',
  };
  ctx.font = `700 28px ${BODY_FONT}`;
  ctx.textBaseline = 'middle';
  let x = innerLeft;
  const legendY = baseY + 50;
  for (const phase of phases.filter((p) => bars.some((b) => b.phase === p))) {
    ctx.fillStyle = COLORS.phase[phase];
    ctx.beginPath();
    ctx.arc(x + 9, legendY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink2;
    ctx.fillText(names[phase], x + 28, legendY);
    x += 28 + ctx.measureText(names[phase]).width + 34;
  }
  ctx.restore();
  return panelTop + panelHeight;
}

function drawStats(ctx: CanvasRenderingContext2D, stats: StoryData['stats'], top: number): number {
  const items = stats.slice(0, 3);
  if (items.length === 0) return top;
  const left = 80;
  const gap = 24;
  const width = (STORY_WIDTH - 2 * left - gap * (items.length - 1)) / items.length;
  const height = 210;
  ctx.save();
  items.forEach((stat, i) => {
    const x = left + i * (width + gap);
    roundRect(ctx, x, top, width, height, 32);
    ctx.fillStyle = COLORS.surface;
    ctx.fill();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    let size = 64;
    ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
    while (ctx.measureText(stat.value).width > width - 48 && size > 34) {
      size -= 4;
      ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
    }
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(stat.value, x + 28, top + 104);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 28px ${BODY_FONT}`;
    const labelLines = wrap(ctx, stat.label, width - 56).slice(0, 2);
    labelLines.forEach((line, j) => ctx.fillText(line, x + 28, top + 150 + j * 34));
  });
  ctx.restore();
  return top + height;
}

function drawFooter(ctx: CanvasRenderingContext2D, footer: string): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.ink;
  ctx.font = `800 40px ${DISPLAY_FONT}`;
  ctx.fillText(footer, 80, STORY_HEIGHT - 150);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 28px ${BODY_FONT}`;
  ctx.fillText('Programme généré automatiquement · une boucle par séance', 80, STORY_HEIGHT - 100);
  ctx.restore();
}

/** Dessine l'image story dans un nouveau canvas 1080 × 1920. */
export async function drawStory(data: StoryData): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  drawBackground(ctx);
  drawBrand(ctx);
  const afterHeadline = drawHeadline(ctx, data);
  const barsTop = Math.max(afterHeadline + 40, 1010);
  const afterBars = drawBars(ctx, data.bars, barsTop);
  drawStats(ctx, data.stats, Math.min(afterBars + 40, STORY_HEIGHT - 460));
  drawFooter(ctx, data.footer);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** Partage natif si possible (mobile), sinon téléchargement. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/**
 * Bloc « Mon image story » : bouton de création, aperçu, partage et téléchargement.
 * `getData` est appelé au clic (données toujours à jour).
 */
export function createStoryPanel(getData: () => StoryData | null, filename = 'ma-prepa-j24.png'): HTMLElement {
  const preview = h('img', {
    class: 'story-panel__preview',
    attrs: { alt: '', width: 270, height: 480, hidden: true },
  });
  const status = h('p', { class: 'hint', attrs: { role: 'status', 'aria-live': 'polite' } });
  const shareBtn = h('button', { class: 'btn btn--primary', attrs: { type: 'button', hidden: true } }, icon('share'), 'Partager');
  const downloadBtn = h(
    'button',
    { class: 'btn', attrs: { type: 'button', hidden: true } },
    icon('download'),
    'Télécharger',
  );
  const createBtn = h('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, icon('image'), 'Créer mon image story');

  let blob: Blob | null = null;
  let previewUrl = '';

  const canShareFiles = (): boolean => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  };

  createBtn.addEventListener('click', async () => {
    const data = getData();
    if (!data) return;
    createBtn.setAttribute('aria-busy', 'true');
    createBtn.disabled = true;
    status.textContent = 'Création de ton image…';
    try {
      const canvas = await drawStory(data);
      blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('blob');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      preview.src = previewUrl;
      preview.alt = `Aperçu de ton image story : ${data.headline} ${data.highlight}`;
      preview.hidden = false;
      shareBtn.hidden = !canShareFiles();
      downloadBtn.hidden = false;
      createBtn.replaceChildren(icon('refresh'), 'Recréer l’image');
      status.textContent = 'Ton image est prête : partage-la en story ou télécharge-la.';
    } catch {
      status.textContent = 'Impossible de créer l’image sur cet appareil. Essaie depuis un autre navigateur.';
    } finally {
      createBtn.disabled = false;
      createBtn.removeAttribute('aria-busy');
    }
  });

  shareBtn.addEventListener('click', async () => {
    if (!blob) return;
    const result = await shareOrDownload(blob, filename, 'Ma prépa commence lundi.');
    if (result === 'downloaded') toast('Image téléchargée.');
  });
  downloadBtn.addEventListener('click', () => {
    if (!blob) return;
    downloadBlob(blob, filename);
    announce('Image téléchargée.');
    toast('Image téléchargée.');
  });

  return h(
    'div',
    { class: 'story-panel' },
    h('div', { class: 'story-panel__actions cluster' }, createBtn, shareBtn, downloadBtn),
    status,
    preview,
  );
}
