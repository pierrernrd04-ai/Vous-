// Writes 02-packshot-3d.srt (from audio/v2-timings.json) and 02-packshot-3d.caption.txt (from brand/brand.js).
//   node 02-packshot-3d/make-texts.mjs   (run from videos/complements/)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sb = {}; sb.window = sb;
vm.runInNewContext(fs.readFileSync(path.join(HERE, '../brand/brand.js'), 'utf8'), sb);
const A = sb.AMBREL;
const tim = JSON.parse(fs.readFileSync(path.join(HERE, 'audio/v2-timings.json'), 'utf8'));
const w = tim.cues[0].words;
const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
// subtitle chunks follow the on-screen headline: "Ambrel." / "Magnésium bisglycinate" / "et vitamine B6."
const chunks = [[0, 0], [1, 2], [3, 5]];
const srt = chunks.map(([a, b], i) => {
  const start = w[a].start - 0.08, end = i < chunks.length - 1 ? w[chunks[i + 1][0]].start - 0.08 : tim.cues[0].end + 0.3;
  return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${w.slice(a, b + 1).map((x) => x.w).join(' ')}\n`;
}).join('\n');
fs.writeFileSync(path.join(HERE, '02-packshot-3d.srt'), srt);
const p = A.product;
const caption = [
  A.mentions.v2.open,
  '',
  `${A.name}. ${p.name}. ${A.tagline}`,
  `${p.dose}${A.NB}: ${p.magnesium} et ${p.b6}. ${p.format}, ${p.free.charAt(0).toLowerCase() + p.free.slice(1)}.`,
  '',
  `${A.cta.main}${A.NB}: ${A.cta.alt[2].toLowerCase()}.`,
  '',
  A.legal.short,
  A.legal.fictive,
  '',
  '#publicité #complémentalimentaire #magnésium #packshot',
].join('\n') + '\n';
fs.writeFileSync(path.join(HERE, '02-packshot-3d.caption.txt'), caption);
console.log(srt); console.log(caption);
