#!/usr/bin/env node
/**
 * Génère les icônes de l'app et l'image de partage dans public/icons/ :
 *
 * - favicon.svg (onglet), icon.svg (logo maître, aussi déclaré dans le manifeste) ;
 * - icon-192.png, icon-512.png (« any », coins arrondis transparents) ;
 * - icon-maskable-512.png (pleine page, logo dans la zone sûre de 80 %) ;
 * - apple-touch-icon.png (180 × 180, pleine page : iOS arrondit lui-même) ;
 * - favicon-32.png (repli pour les navigateurs sans favicon SVG) ;
 * - og-image.png (1200 × 630, aperçu des liens partagés).
 *
 * Rendu par le Chromium de Playwright (devDependency, rien à installer) :
 *   node scripts/generate-icons.mjs
 * Si la révision de Chromium ne correspond pas : PW_CHROMIUM_PATH=/opt/pw-browsers/chromium.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/icons');
const FONT = resolve(ROOT, 'src/styles/fonts/bricolage-grotesque-latin.woff2');

const C = {
  bg: '#050f15',
  bgTop: '#0b2029',
  line: '#1d3640',
  green: '#2be39b',
  accent: '#25c98f',
  blue: '#1ea6d0',
  ink: '#e6f2f0',
  ink2: '#c3d6d4',
  muted: '#8aa4a3',
};

/** La boucle Traceo (grille 64 × 64) : départ et arrivée au même point, depuis ta porte. */
const LOOP = 'M20 44c-6-4-7-14-1-20 5-5 12-4 15 1 2 4 6 5 9 2 4-3 9 0 9 5 0 9-11 16-22 16-4 0-7-1-10-4z';
/** Centre visuel de la boucle (trait et point de départ compris). */
const LOOP_CENTER = { x: 32.5, y: 34 };

/**
 * Logo au format SVG, dans une grille 64 × 64.
 * @param {{ shape: 'rounded' | 'square', scale: number, streets: boolean, glow: boolean, stroke?: number, id?: string }} o
 */
function logoSvg(o) {
  const id = o.id ?? 'j24';
  const stroke = o.stroke ?? 5;
  const rx = o.shape === 'rounded' ? 14 : 0;
  const mark = `translate(32 32) scale(${o.scale}) translate(${-LOOP_CENTER.x} ${-LOOP_CENTER.y})`;
  const streets = o.streets
    ? `<g clip-path="url(#${id}-clip)" stroke="${C.line}" stroke-width="0.7" fill="none" opacity="0.9">
    <path d="M-2 13h68M-2 29h68M-2 47h68M17-2v68M35-2v68M53-2v68"/>
    <path d="M-2 62L40-4M30 66L66 22" opacity="0.7"/>
  </g>`
    : '';
  const glow = o.glow
    ? `<rect width="64" height="64" rx="${rx}" fill="url(#${id}-glow-a)"/>
  <rect width="64" height="64" rx="${rx}" fill="url(#${id}-glow-b)"/>`
    : '';
  const routeGlow = o.glow
    ? `<path d="${LOOP}" fill="none" stroke="${C.accent}" stroke-opacity="0.35" stroke-width="${stroke + 4}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-blur)"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bgTop}"/>
      <stop offset="1" stop-color="${C.bg}"/>
    </linearGradient>
    <linearGradient id="${id}-route" x1="0.1" y1="0.2" x2="0.9" y2="0.8">
      <stop offset="0" stop-color="${C.green}"/>
      <stop offset="1" stop-color="${C.blue}"/>
    </linearGradient>
    <radialGradient id="${id}-glow-a" cx="0.78" cy="0.2" r="0.6">
      <stop offset="0" stop-color="${C.accent}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-glow-b" cx="0.12" cy="0.9" r="0.55">
      <stop offset="0" stop-color="${C.blue}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${C.blue}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}-clip"><rect width="64" height="64" rx="${rx}"/></clipPath>
    <filter id="${id}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>
  </defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#${id}-bg)"/>
  ${glow}
  ${streets}
  <g transform="${mark}">
    ${routeGlow}
    <path d="${LOOP}" fill="none" stroke="url(#${id}-route)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="20" cy="44" r="5.2" fill="${C.bg}"/>
    <circle cx="20" cy="44" r="3.6" fill="${C.green}"/>
  </g>
</svg>
`;
}

const VARIANTS = {
  favicon: logoSvg({ id: 'fav', shape: 'rounded', scale: 1.08, streets: false, glow: false, stroke: 5.6 }),
  any: logoSvg({ id: 'any', shape: 'rounded', scale: 1, streets: true, glow: true }),
  maskable: logoSvg({ id: 'msk', shape: 'square', scale: 0.78, streets: true, glow: true }),
  apple: logoSvg({ id: 'apl', shape: 'square', scale: 0.9, streets: true, glow: true }),
};

function ogHtml(fontDataUrl) {
  const logo = VARIANTS.any.replace('<svg ', '<svg width="76" height="76" ');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  @font-face { font-family: "Bricolage Grotesque"; font-weight: 600 800; src: url("${fontDataUrl}") format("woff2"); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden; color: ${C.ink};
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background:
      radial-gradient(520px 420px at 1010px 120px, rgba(37, 201, 143, 0.30), transparent 70%),
      radial-gradient(520px 420px at 90px 640px, rgba(30, 166, 208, 0.22), transparent 70%),
      ${C.bg};
  }
  .streets { position: absolute; inset: 0; }
  .route { position: absolute; right: -40px; top: 40px; width: 560px; height: 560px; }
  .content { position: absolute; left: 80px; top: 64px; width: 820px; }
  .brand { display: flex; align-items: center; gap: 18px; font: 800 30px/1 "Bricolage Grotesque", sans-serif; letter-spacing: -0.01em; }
  .brand small { font: 600 20px/1 system-ui, sans-serif; color: ${C.muted}; letter-spacing: 0; }
  h1 { margin-top: 44px; font: 800 84px/1 "Bricolage Grotesque", sans-serif; letter-spacing: -0.035em; }
  h1 span { background: linear-gradient(100deg, #2be39b, #22d3c5 55%, #1ea6d0); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { margin-top: 26px; max-width: 640px; font-size: 28px; line-height: 1.35; color: ${C.ink2}; }
  .chips { position: absolute; left: 80px; bottom: 56px; display: flex; gap: 12px; }
  .chip { padding: 11px 18px; border: 2px solid ${C.line}; border-radius: 999px; background: rgba(14, 30, 37, 0.85); font: 700 20px/1 system-ui, sans-serif; color: ${C.ink2}; }
  .chip--accent { border-color: rgba(37, 201, 143, 0.55); color: ${C.green}; }
  .badge { position: absolute; right: 56px; bottom: 52px; padding: 14px 22px; border-radius: 18px; background: ${C.green}; color: #03140d; font: 800 26px/1 "Bricolage Grotesque", sans-serif; box-shadow: 0 16px 40px rgba(37, 201, 143, 0.35); }
</style></head><body>
  <svg class="streets" viewBox="0 0 1200 630" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="${C.line}" stroke-width="2" fill="none" opacity="0.55">
      <path d="M640 120H1200M640 300H1200M640 480H1200M760 0V630M940 0V630M1120 0V630"/>
      <path d="M620 630L1000 0M900 630L1200 180" opacity="0.7"/>
    </g>
  </svg>
  <svg class="route" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="og-route" x1="0.1" y1="0.2" x2="0.9" y2="0.8"><stop offset="0" stop-color="${C.green}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
      <filter id="og-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>
    </defs>
    <path d="${LOOP}" fill="none" stroke="${C.accent}" stroke-opacity="0.4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#og-blur)"/>
    <path d="${LOOP}" fill="none" stroke="url(#og-route)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="20" cy="44" r="3.4" fill="${C.bg}"/>
    <circle cx="20" cy="44" r="2.3" fill="${C.green}"/>
  </svg>
  <span class="badge">Boucle de 10 km</span>
  <div class="content">
    <div class="brand">${logo}<span>Pass J-24 <small>par Traceo</small></span></div>
    <h1>Ta prépa commence<br><span>lundi.</span></h1>
    <p>24 semaines, et chaque séance devient une boucle prête à courir depuis ta porte.</p>
  </div>
  <div class="chips">
    <span class="chip">Marathon · 4 avril 2027</span>
    <span class="chip">Semi · 7 mars 2027</span>
    <span class="chip chip--accent">Semaine 1 offerte</span>
  </div>
</body></html>`;
}

function svgPage(svg, size) {
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden}svg{display:block}</style></head><body>${sized}</body></html>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'favicon.svg'), VARIANTS.favicon);
  writeFileSync(resolve(OUT, 'icon.svg'), VARIANTS.any);

  const fallback = '/opt/pw-browsers/chromium';
  const executablePath = process.env.PW_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : existsSync(fallback) ? fallback : undefined);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const pngs = [
      { file: 'favicon-32.png', svg: VARIANTS.favicon, size: 32 },
      { file: 'icon-192.png', svg: VARIANTS.any, size: 192 },
      { file: 'icon-512.png', svg: VARIANTS.any, size: 512 },
      { file: 'icon-maskable-512.png', svg: VARIANTS.maskable, size: 512 },
      { file: 'apple-touch-icon.png', svg: VARIANTS.apple, size: 180 },
    ];
    for (const { file, svg, size } of pngs) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(svgPage(svg, size));
      await page.screenshot({ path: resolve(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      console.log(`✓ public/icons/${file} (${size}×${size})`);
    }

    const font = `data:font/woff2;base64,${readFileSync(FONT).toString('base64')}`;
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(ogHtml(font));
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({ path: resolve(OUT, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log('✓ public/icons/og-image.png (1200×630)');
  } finally {
    await browser.close();
  }
  console.log('✓ public/icons/favicon.svg, public/icons/icon.svg');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
