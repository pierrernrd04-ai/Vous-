#!/usr/bin/env node
// Rasterize an SVG (or HTML) file to PNG with headless Chromium.
//   node tools/svg2png.mjs in.svg out.png --w 1080 [--h 1080] [--bg transparent|#hex]
// --w alone keeps the aspect ratio of the SVG width/height attributes.
// Transparent background by default (PNG with alpha).
import fs from 'node:fs';
import path from 'node:path';
import { launch, parseArgs, sceneUrl } from './lib/browser.mjs';

const { pos, opt } = parseArgs(process.argv.slice(2));
if (pos.length < 2) {
  console.error('usage: svg2png.mjs <in.svg> <out.png> --w <px> [--h <px>] [--bg transparent|#hex]');
  process.exit(2);
}
const [src, out] = pos;
const svg = fs.readFileSync(src, 'utf8');
const mW = /<svg[^>]*\swidth="([\d.]+)"/.exec(svg);
const mH = /<svg[^>]*\sheight="([\d.]+)"/.exec(svg);
const sw = mW ? +mW[1] : 1000;
const sh = mH ? +mH[1] : 1000;
const W = opt.w ? +opt.w : sw;
const H = opt.h ? +opt.h : Math.round((W * sh) / sw);
const bg = opt.bg && opt.bg !== 'transparent' ? opt.bg : 'transparent';

// Wrap in a tiny HTML page so we control size + background exactly.
const wrapDir = path.dirname(path.resolve(src));
const wrapper = path.join(wrapDir, `.svg2png-${process.pid}.html`);
fs.writeFileSync(wrapper, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${bg};}
img{display:block;width:${W}px;height:${H}px;object-fit:contain}</style><img src="${encodeURI(path.basename(src))}">`);
const browser = await launch();
const { url, close } = await sceneUrl(wrapper);
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await page.screenshot({ path: out, omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`${out} ${W}x${H}`);
} finally {
  fs.rmSync(wrapper, { force: true });
  await close();
  await browser.close();
}
