#!/usr/bin/env node
// Grab still frames of a scene (fast check without rendering the video).
//   node tools/snap.mjs <scene.html> <out.png> --t 2.5 [--w 1080 --h 1920] [--query "safe=1"]
//   node tools/snap.mjs <scene.html> <out-prefix> --t 0,2.5,7     -> out-prefix_t0.00.png ...
//   --sheet   also writes <out-prefix>_sheet.png (all times side by side, 360 px wide each)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openScene, parseArgs, sceneUrl } from './lib/browser.mjs';

const { pos, opt } = parseArgs(process.argv.slice(2));
if (pos.length < 2 || opt.t === undefined) {
  console.error('usage: snap.mjs <scene.html> <out.png|prefix> --t 0,2.5 [--w 1080 --h 1920 --query safe=1 --sheet]');
  process.exit(2);
}
const [scene, outArg] = pos;
const W = +(opt.w || 1080), H = +(opt.h || 1920);
const times = String(opt.t).split(',').map(Number);
const extraQ = typeof opt.query === 'string' ? opt.query.replace(/^\?/, '') : '';
const browser = await launch();
const { url, close } = await sceneUrl(scene, { query: `w=${W}&h=${H}&render=1${extraQ ? '&' + extraQ : ''}` });
let code = 0;
try {
  const { page } = await openScene(browser, url, { w: W, h: H });
  const files = [];
  for (const t of times) {
    await page.evaluate((tt) => window.__seek(tt), t);
    const file = times.length === 1 && outArg.endsWith('.png') ? outArg : `${outArg.replace(/\.png$/, '')}_t${t.toFixed(2)}.png`;
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    await page.screenshot({ path: file });
    files.push(file);
    console.log(file);
  }
  if (opt.sheet && files.length > 1) {
    const sheet = `${outArg.replace(/\.png$/, '')}_sheet.png`;
    const inputs = files.flatMap((f) => ['-i', f]);
    const fc = files.map((_, i) => `[${i}:v]scale=360:-2[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `hstack=inputs=${files.length}`;
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, sheet], { stdio: 'inherit' });
    console.log(sheet);
  }
} catch (e) {
  console.error('snap failed:', e.message); code = 1;
} finally {
  await close(); await browser.close();
}
process.exit(code);
