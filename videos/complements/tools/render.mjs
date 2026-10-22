#!/usr/bin/env node
// Render a seekable HTML scene to H.264 MP4 (frame-accurate, deterministic).
//
//   node tools/render.mjs <scene.html> <out.mp4> --w 1080 --h 1920 --fps 30 --dur 12
//
// Options
//   --w --h          viewport in CSS px (default 1080x1920)
//   --fps            frames per second (default 30)
//   --dur            seconds (default: window.__duration declared by the scene)
//   --start          first time to render, seconds (default 0)
//   --workers N      parallel Chromium pages, each encodes a chunk, then lossless concat (default 1)
//   --crf 18 --preset medium      x264 settings
//   --downscale 0.5  preview render at half size (iterate cheap, like the 480p pass of the method)
//   --query "a=1&b=2"             extra URL params passed to the scene
//   --frames <dir>   also keep every captured frame in <dir> (debug)
//   --lossless       capture PNG frames instead of JPEG q96 (about 1.6x slower, rarely visible)
//   --quality 96     JPEG capture quality
//   --file           open the scene through file:// instead of the local http server
//
// The scene must define window.__seek(t) (pure function of t) and may define window.__ready
// (Promise) and window.__duration. tools/lib/scene-kit.js (SK.scene) does it for you.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openScene, parseArgs, sceneUrl } from './lib/browser.mjs';

const { pos, opt } = parseArgs(process.argv.slice(2));
if (pos.length < 2) {
  console.error('usage: render.mjs <scene.html> <out.mp4> [--w 1080 --h 1920 --fps 30 --dur 12 --workers 2 ...]');
  process.exit(2);
}
const [scene, outArg] = pos;
const out = path.resolve(outArg);
const W = +(opt.w || 1080), H = +(opt.h || 1920), FPS = +(opt.fps || 30);
const START = +(opt.start || 0);
const WORKERS = Math.max(1, +(opt.workers || 1));
const CRF = String(opt.crf ?? 18), PRESET = opt.preset || 'medium';
const DOWN = opt.downscale ? +opt.downscale : 1;
const FRAMES_DIR = typeof opt.frames === 'string' ? path.resolve(opt.frames) : null;
const FMT = opt.lossless ? 'png' : 'jpeg';
const QUALITY = +(opt.quality || 96);
const extraQ = typeof opt.query === 'string' ? opt.query.replace(/^\?/, '') : '';

fs.mkdirSync(path.dirname(out), { recursive: true });
if (FRAMES_DIR) fs.mkdirSync(FRAMES_DIR, { recursive: true });

function ffmpegEncoder(file) {
  // JPEG frames from Chromium are full-range BT.601 YCbCr; PNG frames are RGB.
  const inCs = FMT === 'jpeg' ? 'in_color_matrix=bt601:in_range=full:' : '';
  const size = DOWN !== 1 ? `trunc(iw*${DOWN}/2)*2:trunc(ih*${DOWN}/2)*2:flags=lanczos` : 'trunc(iw/2)*2:trunc(ih/2)*2';
  const scale = `scale=${size}:${inCs}out_color_matrix=bt709:out_range=tv`;
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', FMT === 'jpeg' ? 'mjpeg' : 'png', '-i', '-',
    '-vf', `${scale},format=yuv420p`,
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(FPS * 2), '-r', String(FPS), '-movflags', '+faststart', file,
  ];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.stdin.on('error', (e) => console.error('ffmpeg stdin:', e.message));
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return { p, done };
}

function write(stream, buf) {
  return new Promise((res) => { if (stream.write(buf)) res(); else stream.once('drain', res); });
}

const t0 = Date.now();
const browser = await launch();
const query = `w=${W}&h=${H}&fps=${FPS}&render=1${opt.dur ? `&dur=${opt.dur}` : ''}${extraQ ? '&' + extraQ : ''}`;
const { url, close } = await sceneUrl(scene, { mode: opt.file ? 'file' : 'http', query });
let exitCode = 0;
const partsDir = `${out}.parts-${process.pid}`;
try {
  const first = await openScene(browser, url, { w: W, h: H });
  if (!first.info.hasSeek) throw new Error('scene does not define window.__seek(t)');
  const DUR = opt.dur ? +opt.dur : first.info.duration;
  if (!DUR) throw new Error('no duration: pass --dur or set window.__duration');
  const N = Math.round((DUR - START) * FPS);
  console.log(`render ${path.basename(scene)} -> ${path.relative(process.cwd(), out)}  ${W}x${H}${DOWN !== 1 ? ` (x${DOWN})` : ''} ${FPS} fps, ${(N / FPS).toFixed(2)} s = ${N} frames, ${WORKERS} worker(s), ${FMT} capture`);
  if (first.info.fonts.length) console.log(`fonts: ${[...new Set(first.info.fonts)].join(', ')}`);

  const chunks = [];
  const per = Math.ceil(N / WORKERS);
  for (let k = 0; k < WORKERS; k++) {
    const a = k * per, b = Math.min(N, (k + 1) * per);
    if (a < b) chunks.push([a, b]);
  }
  if (chunks.length > 1) fs.mkdirSync(partsDir, { recursive: true });
  let doneFrames = 0, lastLog = Date.now();

  async function worker(k, [a, b]) {
    const sc = k === 0 ? first : await openScene(browser, url, { w: W, h: H });
    const cdp = await sc.ctx.newCDPSession(sc.page);
    const file = chunks.length > 1 ? path.join(partsDir, `part-${String(k).padStart(3, '0')}.mp4`) : out;
    const enc = ffmpegEncoder(file);
    for (let i = a; i < b; i++) {
      const t = START + i / FPS;
      await sc.page.evaluate((tt) => window.__seek(tt), t);
      const { data } = await cdp.send('Page.captureScreenshot', { format: FMT, quality: FMT === 'jpeg' ? QUALITY : undefined, optimizeForSpeed: true, captureBeyondViewport: false });
      const buf = Buffer.from(data, 'base64');
      if (FRAMES_DIR) fs.writeFileSync(path.join(FRAMES_DIR, `frame_${String(i).padStart(5, '0')}.${FMT === 'jpeg' ? 'jpg' : 'png'}`), buf);
      await write(enc.p.stdin, buf);
      doneFrames++;
      if (Date.now() - lastLog > 2000) {
        lastLog = Date.now();
        const el = (Date.now() - t0) / 1000;
        console.log(`  ${doneFrames}/${N} frames  ${(doneFrames / el).toFixed(1)} fps`);
      }
    }
    enc.p.stdin.end();
    await enc.done;
    if (sc.errors.length) throw new Error(`scene error during render: ${sc.errors[0].message}`);
    return file;
  }

  const files = await Promise.all(chunks.map((c, k) => worker(k, c)));
  if (files.length > 1) {
    const list = path.join(partsDir, 'list.txt');
    fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    await new Promise((res, rej) => {
      const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
        '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed'))));
    });
  }
  const el = (Date.now() - t0) / 1000;
  console.log(`done ${out}  ${N} frames in ${el.toFixed(1)} s (${(N / el).toFixed(1)} fps)`);
} catch (e) {
  console.error('render failed:', e.message);
  exitCode = 1;
} finally {
  fs.rmSync(partsDir, { recursive: true, force: true });
  await close();
  await browser.close();
}
process.exit(exitCode);
