#!/usr/bin/env node
// Original music beds synthesised with ffmpeg aevalsrc (no samples). Called by tools/music.sh.
//   node tools/lib/music.mjs <mood calm|pulse> <dur> <out_raw.wav> [bpm] [key]
// calm  : slow evolving pad (I-vi-IV-Vsus, crossfaded voicings, detuned partials) + soft sub,
//         convolution reverb with a synthetic noise impulse response.
// pulse : same pad (pumped) + soft sine kick, filtered noise hats, plucked 8th-note arpeggio
//         and an 8th-note bass, ~118-124 BPM.
import { spawnSync } from 'node:child_process';

const [mood = 'calm', durS = '15', out, bpmS, keyS] = process.argv.slice(2);
if (!out) { console.error('usage: music.mjs <calm|pulse> <dur> <out.wav> [bpm] [key]'); process.exit(2); }
const DUR = +durS + 2.5; // render a tail, music.sh trims to dur
const BPM = +(bpmS || (mood === 'pulse' ? 120 : 72));
const KEYS = { C: -2, 'C#': -1, Db: -1, D: 0, 'D#': 1, Eb: 1, E: 2, F: 3, 'F#': 4, Gb: 4, G: 5, 'G#': -6, Ab: -6, A: -5, 'A#': -4, Bb: -4, B: -3 };
const KEY = KEYS[keyS || 'D'] ?? 0;
const B = 60 / BPM;                // beat
const C = 8 * B;                   // chord length: 2 bars
const f = (m) => (440 * Math.pow(2, (m + KEY - 69) / 12)).toFixed(4);

// D major: Dmaj9 - Bm7 - Gmaj7 - Asus2 (midi notes) + bass roots
const CHORDS = [
  [50, 54, 57, 61, 64],
  [47, 50, 54, 57, 62],
  [43, 47, 50, 54, 59],
  [45, 52, 57, 59, 61],
];
const BASS = [38, 35, 43 - 12, 45 - 12];
const ARP = [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]];

// nested if selecting value table[k] where k is the expression `kExpr` (0..3)
const sel = (kExpr, vals) => vals.slice(0, -1).reduceRight((acc, v, i) => `if(eq(${kExpr},${i}),${v},${acc})`, vals[vals.length - 1]);

function padExpr(det, ph, gain, pump) {
  // vars: 0 = chord A index, 1 = chord B index, 2 = env A, 3 = env B, 4 = freq, 5 = sum
  const parts = [
    `st(0,mod(floor(t/${C}),4))`, `st(1,mod(floor(t/${C}+0.5),4))`,
    `st(2,pow(sin(PI*t/${C}),2))`, `st(3,1-ld(2))`, 'st(5,0)',
  ];
  const voice = (amp) => `${amp}*(sin(2*PI*ld(4)*t)+0.55*sin(2*PI*ld(4)*${det}*t+${ph})+0.14*sin(4*PI*ld(4)*t+${ph * 0.5}))`;
  for (let j = 0; j < 5; j++) {
    const vals = CHORDS.map((c) => f(c[j]));
    const amp = j === 0 ? 0.11 : j === 4 ? 0.06 : 0.085;
    parts.push(`st(4,${sel('ld(0)', vals)})`, `st(5,ld(5)+ld(2)*${voice(amp)})`);
    parts.push(`st(4,${sel('ld(1)', vals)})`, `st(5,ld(5)+ld(3)*${voice(amp)})`);
  }
  const bv = BASS.map(f);
  const bassVoice = `0.16*(sin(2*PI*ld(4)*t)+0.25*sin(4*PI*ld(4)*t))`;
  parts.push(`st(4,${sel('ld(0)', bv)})`, `st(5,ld(5)+ld(2)*${bassVoice})`);
  parts.push(`st(4,${sel('ld(1)', bv)})`, `st(5,ld(5)+ld(3)*${bassVoice})`);
  const breath = '(0.86+0.14*sin(2*PI*t/9.3))';
  const pumpE = pump ? `*(1-${pump}*exp(-mod(t,${B})*7))` : '';
  parts.push(`ld(5)*${gain}*${breath}${pumpE}`);
  return parts.join(';');
}

const run = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
};

const SR_PAD = 32000;
const pad = (gain, pump) => `aevalsrc=exprs='${padExpr(1.0035, 1.3, gain, pump)}|${padExpr(0.9966, 2.1, gain, pump)}':s=${SR_PAD}:d=${DUR}`;
const ir = `aevalsrc=exprs='(random(0)*2-1)*exp(-t*2.6)|(random(1)*2-1)*exp(-t*2.6)':s=48000:d=2.6`;

if (mood === 'calm') {
  run([
    '-f', 'lavfi', '-i', pad(1.0, 0),
    '-f', 'lavfi', '-i', ir,
    '-filter_complex',
    `[0:a]aresample=48000,highpass=f=35,lowpass=f=3600,equalizer=f=320:t=q:w=1:g=-2[p];` +
    `[1:a]lowpass=f=5200,highpass=f=180[irf];` +
    `[p][irf]afir=dry=6:wet=3:gtype=peak[r];[r]alimiter=limit=0.9:level=false[o]`,
    '-map', '[o]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', out,
  ]);
} else if (mood === 'pulse') {
  const kick = `aevalsrc=exprs='st(0,mod(t,${B}));0.95*sin(2*PI*(52*ld(0)+(165-52)/32*(1-exp(-32*ld(0)))))*exp(-ld(0)*8.5)':s=48000:d=${DUR}`;
  const hats = `aevalsrc=exprs='st(0,mod(t+${B / 2},${B}));st(1,mod(t,${B / 4}));(random(2)*2-1)*(0.55*exp(-ld(0)*75)+0.12*exp(-ld(1)*140))':s=48000:d=${DUR}`;
  const arpK = `mod(floor(t/${C}),4)`;
  const arpI = `mod(floor(t/${B / 2}),4)`;
  const arpF = sel(arpK, ARP.map((ch) => sel(arpI, ch.map(f))));
  const arp = `aevalsrc=exprs='st(0,mod(t,${B / 2}));st(1,${arpF});(1-exp(-ld(0)*500))*exp(-ld(0)*7.5)*(sin(2*PI*ld(1)*t)+0.33*sin(4*PI*ld(1)*t)+0.1*sin(6*PI*ld(1)*t))*0.5':s=48000:d=${DUR}`;
  const bassF = sel(`mod(floor(t/${C}),4)`, BASS.map((m) => f(m + 12)));
  const bass = `aevalsrc=exprs='st(0,mod(t,${B / 2}));st(1,${bassF});(1-exp(-ld(0)*300))*exp(-ld(0)*4.5)*(sin(2*PI*ld(1)*t)+0.3*sin(4*PI*ld(1)*t))*0.6':s=48000:d=${DUR}`;
  run([
    '-f', 'lavfi', '-i', pad(0.75, 0.38),
    '-f', 'lavfi', '-i', kick,
    '-f', 'lavfi', '-i', hats,
    '-f', 'lavfi', '-i', arp,
    '-f', 'lavfi', '-i', bass,
    '-f', 'lavfi', '-i', ir,
    '-filter_complex',
    `[0:a]aresample=48000,highpass=f=60,lowpass=f=3400[p];` +
    `[1:a]lowpass=f=900,aformat=channel_layouts=stereo,volume=0.55[k];` +
    `[2:a]highpass=f=6500,aformat=channel_layouts=stereo,volume=0.32[h];` +
    `[3:a]lowpass=f=3800,aformat=channel_layouts=stereo,aecho=0.9:0.55:${Math.round(B * 750)}|${Math.round(B * 1500)}:0.32|0.18,volume=0.42[a];` +
    `[4:a]lowpass=f=600,aformat=channel_layouts=stereo,volume=0.45[b];` +
    `[5:a]lowpass=f=5000,highpass=f=200[irf];` +
    `[p][irf]afir=dry=7:wet=2:gtype=peak[pr];` +
    `[pr][k][h][a][b]amix=inputs=5:normalize=0,alimiter=limit=0.9:level=false[o]`,
    '-map', '[o]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', out,
  ]);
} else {
  console.error(`unknown mood '${mood}' (calm|pulse)`); process.exit(2);
}
