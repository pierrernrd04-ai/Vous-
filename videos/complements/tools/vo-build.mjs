#!/usr/bin/env node
// Build a full voice-over track + word timings (for kinetic captions) from a script JSON.
//
//   node tools/vo-build.mjs <script.vo.json> [--out <dir>] [--var VO_TIMINGS]
//
// script.vo.json:
// {
//   "voice": "female",            // female | male | path.onnx  (per-line override allowed)
//   "length_scale": 1.0,          // Piper speed (per-line override allowed)
//   "duration": 15,               // track length (default: last line end + 0.5 s)
//   "gap": 0.2,                   // gap used when a line has no "start"
//   "lines": [
//     { "id": "hook", "start": 0.15, "text": "Cinq flacons. Aucune idée de ce qu’il y a dedans." },
//     { "id": "dose", "text": "Trois cents milligrammes de magnésium.", "caption": "300 mg de magnésium." }
//   ]
// }
// "text" is what is spoken; optional "caption" is what is shown (digits, units...).
//
// Writes into --out (default: <json dir>/audio):
//   <name>.wav             48 kHz mono, all lines placed at their start times (-16 LUFS lines)
//   <name>-timings.json    {duration, cues:[{id,start,end,text,spoken,file,words:[{w,start,end}]}]}
//   <name>-timings.js      window.VO_TIMINGS = {...}   (load with a classic <script>, works on file://)
//   lines/<id>-<hash>.wav  one clip per line (cached: unchanged lines are not re-synthesised)
// <name> = json file name without .json / .vo (e.g. v1.vo.json -> audio/v1.wav, audio/v1-timings.js).
// Word times come from the audio itself: pauses detected in each clip are matched to the
// punctuation of the text, words inside a phrase are spread by syllable count.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { pos, opt } = parseArgs(process.argv.slice(2));
if (!pos[0]) { console.error('usage: vo-build.mjs <script.vo.json> [--out dir] [--var VO_TIMINGS]'); process.exit(2); }
const jsonPath = path.resolve(pos[0]);
const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const outDir = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(path.dirname(jsonPath), 'audio'));
const name = path.basename(jsonPath).replace(/\.json$/, '').replace(/\.vo$/, '');
const VAR = typeof opt.var === 'string' ? opt.var : 'VO_TIMINGS';
fs.mkdirSync(path.join(outDir, 'lines'), { recursive: true });
const SR = 48000;

// ---------------------------------------------------------------- wav io
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = b.subarray(p + 8, p + 8 + sz); break; }
    p += 8 + sz + (sz % 2);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.ch !== 1 || fmt.sr !== SR) throw new Error(`unexpected wav format in ${file}`);
  const n = data.length / 2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}
function writeWav(file, f32) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

// ---------------------------------------------------------------- text helpers
const VOW = /[aeiouyàâäéèêëîïôöùûüœæ]+/gi;
function syl(w) {
  const s = w.toLowerCase().replace(/[^a-zà-ÿœæ0-9]/g, '');
  if (/^\d+$/.test(s)) return Math.max(1, s.length);
  let n = (s.match(VOW) || ['x']).length;
  if (n > 1 && /[^aeiouyàâäéèêëîïôöùûüœæ](e|es|ent)$/.test(s)) n -= 1;
  return Math.max(1, n);
}
const isBreak = (w) => /[.!?…,;:]$/.test(w);
function phrases(text) {
  const words = text.split(/\s+/).filter(Boolean), out = [];
  let cur = [];
  words.forEach((w) => { cur.push(w); if (isBreak(w)) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}
function spread(words, a, b) {
  const wts = words.map((w) => syl(w) + 0.35);
  const tot = wts.reduce((x, y) => x + y, 0);
  let t = a;
  return words.map((w, i) => { const s = t; t += ((b - a) * wts[i]) / tot; return { w, start: +s.toFixed(3), end: +t.toFixed(3) }; });
}

// ---------------------------------------------------------------- audio analysis
function analyse(samples) {
  const hop = SR / 100; // 10 ms
  const n = Math.floor(samples.length / hop), rms = new Float32Array(n);
  let mx = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < hop; j++) { const v = samples[i * hop + j]; s += v * v; }
    rms[i] = Math.sqrt(s / hop); mx = Math.max(mx, rms[i]);
  }
  const thr = Math.max(0.004, mx * 0.05);
  let first = 0, last = n - 1;
  while (first < n && rms[first] < thr) first++;
  while (last > first && rms[last] < thr) last--;
  const gaps = [];
  let i = first;
  while (i <= last) {
    if (rms[i] < thr) { let j = i; while (j <= last && rms[j] < thr) j++; if (j - i >= 9) gaps.push({ a: i / 100, b: j / 100 }); i = j; } else i++;
  }
  return { start: first / 100, end: (last + 1) / 100, gaps, rms };
}
function wordTimes(spoken, caption, clip) {
  const an = analyse(clip);
  const sp = phrases(spoken);
  // expected boundary positions (fraction of speech) by syllable weight + pause weight
  const w = sp.map((p) => p.reduce((s, x) => s + syl(x) + 0.35, 0));
  const pause = 1.0, tot = w.reduce((a, b) => a + b, 0) + pause * (sp.length - 1);
  const span = an.end - an.start;
  const bounds = []; // [{a,b}] gap used for each boundary
  let acc = 0, used = new Set();
  for (let k = 0; k < sp.length - 1; k++) {
    acc += w[k];
    const exp = an.start + (span * (acc + pause * (k + 0.5))) / tot;
    let best = null, bd = 0.5;
    an.gaps.forEach((g, gi) => {
      if (used.has(gi)) return;
      if (bounds.length && g.a <= bounds[bounds.length - 1].b) return;
      const d = Math.abs((g.a + g.b) / 2 - exp);
      if (d < bd) { bd = d; best = gi; }
    });
    if (best !== null) { used.add(best); bounds.push(an.gaps[best]); }
    else bounds.push({ a: exp - 0.04, b: exp + 0.04 });
  }
  const segs = sp.map((_, k) => ({ a: k === 0 ? an.start : bounds[k - 1].b, b: k === sp.length - 1 ? an.end : bounds[k].a }));
  const cp = phrases(caption);
  if (cp.length === sp.length) {
    return cp.flatMap((p, k) => {
      const ws = spread(p, segs[k].a, segs[k].b);
      // snap inner word boundaries to the energy minimum within +/- 90 ms
      for (let i = 1; i < ws.length; i++) {
        const c = Math.round(ws[i].start * 100);
        let best = c, bv = Infinity;
        for (let j = Math.max(Math.round(ws[i - 1].start * 100) + 4, c - 9); j <= Math.min(Math.round(ws[i].end * 100) - 4, c + 9); j++) {
          if (an.rms[j] !== undefined && an.rms[j] < bv) { bv = an.rms[j]; best = j; }
        }
        ws[i].start = best / 100; ws[i - 1].end = best / 100;
      }
      return ws;
    });
  }
  // different structure: spread caption words over the whole speech span
  return spread(caption.split(/\s+/).filter(Boolean), an.start, an.end);
}

// ---------------------------------------------------------------- build
const gap = spec.gap ?? 0.2;
let cursor = 0;
const cues = [];
for (const [idx, line] of spec.lines.entries()) {
  const id = line.id || `l${idx + 1}`;
  const voice = line.voice || spec.voice || 'female';
  const ls = String(line.length_scale ?? spec.length_scale ?? 1.0);
  const key = JSON.stringify([voice, ls, line.text, process.env.NORMALIZE || '1', process.env.SENTENCE_SILENCE || '']);
  const h = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
  const file = path.join(outDir, 'lines', `${id}-${h}.wav`);
  if (!fs.existsSync(file)) {
    const r = spawnSync('bash', [path.join(HERE, 'tts.sh'), line.text, voice, file, ls], { stdio: ['ignore', 'pipe', 'inherit'] });
    if (r.status !== 0) { console.error(`tts failed for line ${id}`); process.exit(1); }
  } else console.error(`cached  ${path.relative(outDir, file)}`);
  const clip = readWav(file);
  const dur = clip.length / SR;
  const start = line.start ?? (cues.length ? cursor + gap : 0);
  const words = wordTimes(line.text, line.caption || line.text, clip).map((w) => ({ w: w.w, start: +(w.start + start).toFixed(3), end: +(w.end + start).toFixed(3) }));
  cues.push({ id, start: +start.toFixed(3), end: +(start + dur).toFixed(3), text: line.caption || line.text, spoken: line.text, file: path.relative(outDir, file), words, _clip: clip });
  cursor = start + dur;
}
const D = spec.duration ?? +(cursor + 0.5).toFixed(3);
const track = new Float32Array(Math.ceil(D * SR));
cues.forEach((c, i) => {
  const off = Math.round(c.start * SR);
  for (let j = 0; j < c._clip.length && off + j < track.length; j++) track[off + j] += c._clip[j];
  if (c.end - 0.1 > D) console.error(`WARNING line ${c.id} ends at ${c.end}s, after duration ${D}s (cut)`);
  if (i && c.start < cues[i - 1].end) console.error(`WARNING line ${c.id} starts at ${c.start}s, overlaps ${cues[i - 1].id} (ends ${cues[i - 1].end}s)`);
  delete c._clip;
});
const wav = path.join(outDir, `${name}.wav`);
writeWav(wav, track);
const timings = { duration: D, voice: spec.voice || 'female', source: path.basename(jsonPath), cues };
fs.writeFileSync(path.join(outDir, `${name}-timings.json`), JSON.stringify(timings, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, `${name}-timings.js`), `window.${VAR} = ${JSON.stringify(timings)};\n`);
console.log(`vo: ${wav}  (${D}s, ${cues.length} lines)`);
for (const c of cues) console.log(`  ${c.id.padEnd(10)} ${c.start.toFixed(2)} -> ${c.end.toFixed(2)} s  ${c.spoken}`);
