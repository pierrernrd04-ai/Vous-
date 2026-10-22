# Ambrel video toolkit

Code-only pipeline for the 4 Ambrel demo videos (fictional brand, see `../brand/brand-system.md`).
HTML scenes → headless Chromium → H.264; Piper voice + music synthesized with ffmpeg → mix → MP4 for social.
Nothing to install: playwright-core comes from `/home/user/Vous-/node_modules`, Chromium from
`/opt/pw-browsers`, Piper and the French voices from the session scratchpad.
**Do not run `npm install` or `playwright install`.**

All commands run from `videos/complements/`.

```
videos/complements/
  brand/            brand-system.md, brand.css (tokens + components), brand.js (texts, claims, lint),
                    fonts/ (local woff2), logo*.svg, packshot*.svg, label-wrap.svg, capsule.svg, png/
  tools/            this toolkit
  v1-static-ad/ …   one folder per video (suggested): scene.html, v1.vo.json, audio/, out/
```

## End-to-end in 6 commands

```bash
cd /home/user/Vous-/videos/complements
node tools/vo-build.mjs v1-static-ad/v1.vo.json                     # VO track + word timings
node tools/render.mjs v1-static-ad/scene.html v1-static-ad/out/v1-video.mp4 --w 1080 --h 1920 --fps 30 --dur 15
tools/music.sh v1-static-ad/audio/music.wav 15 pulse 120             # original bed
tools/sfx.sh whoosh v1-static-ad/audio/whoosh.wav                    # optional effects
tools/mux.sh v1-static-ad/out/v1-video.mp4 v1-static-ad/audio/v1.wav v1-static-ad/audio/music.wav \
             v1-static-ad/out/ambrel-v1-static-probleme-solution-9x16.mp4 v1-static-ad/audio/sfx.list
tools/qa.sh v1-static-ad/out/ambrel-v1-static-probleme-solution-9x16.mp4 --at 1.0,7.5
```

Toolkit self-test (2 s sample, about 25 s): `bash tools/test/run-sample.sh` → `tools/test/out/sample.mp4`.

## Scenes: the `__seek` contract

A scene is an HTML page that draws **any frame from its time `t` alone**:

| Global | Meaning |
|---|---|
| `window.__seek(t)` | draw frame at `t` seconds (may return a Promise). Pure function of `t`: no `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date`, `Math.random`, no CSS transitions. |
| `window.__ready` | Promise: fonts, images, canvases ready. |
| `window.__duration` | default duration (s). `render.mjs --dur` wins. |
| `window.__RENDER` | `true` when driven by render/snap (no preview UI). |

`SK.scene({...})` from `lib/scene-kit.js` sets all of this up, plus a **preview player** when you open the page
in a browser (file:// works): play/pause, scrubber, space and arrow keys. URL params: `?safe=1` safe-zone overlay,
`?t=3.2` frozen frame, `?w=&h=` size, `?dur=` duration.

Start from **`tools/scene-template.html`** (copy it to `vN/scene.html`, every relative path keeps working
one level under `videos/complements/`). It shows: brand CSS/fonts, `brand.js` texts, preloaded packshot,
deterministic particles (`SK.rng`), spring entrance, staggered headline, kinetic captions bound to
`vo-build` timings, opening disclosure + permanent AI/ad badge, legal end card, optional grain.

Loading brand assets: `<link rel="stylesheet" href="../brand/brand.css">` (declares Fraunces + Manrope from
`brand/fonts/*.woff2`), `<script src="../brand/brand.js">` (`window.AMBREL`), images by relative path
(`AMBREL.assets.packshot` = `../brand/png/packshot-transparent-2400.png`). Use classic `<script>` tags:
ES modules are blocked on file:// (they work under render.mjs, which serves `videos/complements/` over a local
http server, but then your preview breaks).

### scene-kit API (`window.SK`)

| | |
|---|---|
| `SK.scene({stage, width, height, duration, ready, seek, fonts, safePreset})` | register the scene |
| `SK.prog(t,a,b)` | 0→1 progress of `t` in `[a,b]`, clamped |
| `SK.seg(t,a,b,ease)` | eased progress |
| `SK.ease.*` | linear, in/out/inOut Quad/Cubic/Quart, outQuint, outExpo, inOutExpo, inOutSine, outSine, `outBack(x, s)` |
| `SK.spring(t, t0, freq=2.2, damping=.42)` | damped spring 0→1 from `t0` (slight overshoot) |
| `SK.kf(t, [[t0,v0],[t1,v1]…], ease)` | keyframes (numbers or arrays) |
| `SK.win(t, a, b, fadeIn, fadeOut)` | 0..1 visibility window |
| `SK.set(el, {x, y, s, sx, sy, r, o, blur})` | set transform/opacity/filter |
| `SK.rng(seed)` | deterministic PRNG → `()=>[0,1)` |
| `SK.noise1(x, seed)`, `SK.handheld(t, amp, speed, seed)` | smooth noise, camera shake `{x, y, r}` |
| `SK.typewriter(text, p)` | text reveal |
| `SK.syncCSS(t)` | pause all CSS animations at `t` (lets you use `@keyframes`) |
| `SK.loadImages({k: url})` | preload + decode → `{k: HTMLImageElement}` |
| `new SK.Captions(el, cues, {maxWords: 4, maxChars: 16, lead: .08, hold: .35, emphasis: [...], mode: 'highlight'|'reveal'})` + `.update(t)` | kinetic word-by-word captions (2-4 words, max 2 lines, current word in honey, 80 ms early). Style: `.ak-captions`, `.is-pill`, `.is-wide` (16:9) |
| `SK.estimateWords(text, start, end)` | word timings without audio |
| `new SK.Grain(canvas, {amount})` + `.draw(t, fps)` | deterministic film grain (lo-fi look) |
| `SK.safeZones(stage, '9:16'|'16:9'|'4:5')`, `SK.SAFE` | overlay / numbers |

### Jar turntable (`lib/jar3d.js` → `window.Jar3D`)

Real 360° rotation of the jar on a 2D canvas: the unrolled label `brand/png/label-wrap-2x.png` is mapped
on the cylinder column by column; glass, lid and speculars stay fixed to the light. The lid is a separate
layer (lift, tilt, fade). Check: `tools/test/jar3d-check.html`.

```js
const imgs = await SK.loadImages({ body: AMBREL.assets.jarBody, lid: AMBREL.assets.jarLid, label: AMBREL.assets.labelWrap });
const jar = new Jar3D(imgs);
jar.draw(ctx, { x, y, scale: 0.6, rot: t * 1.2, lidLift: 80, lidTilt: 6, light: 0.4 });
// rot 0 = front, -2.1 = composition/ingredients panel, +2.1 = usage/precautions panel
```

### Brand components (`brand/brand.css`)

`.ak-stage` (root, 1080×1920 by default), `.ak-h1 .ak-h2 .ak-h3 .ak-body .ak-kicker .ak-claim`,
`.ak-badge` (permanent ad/AI badge, `.is-light`, `.is-wide`), `.ak-disclosure` (opening line 0-2.2 s),
`.ak-captions`, `.ak-cta`, `.ak-legal` (`.is-dark`, `.is-wide`, `.ak-fictive`), `.ak-chip`.
Colors: `var(--ink) --amber --amber-deep --honey --cream --linen --stone --clay --clay-dark --mist --dawn --night --problem`.

### Performance tips (software rendering, about 80-150 ms per 1080×1920 frame)

- Animate `transform` / `opacity`; do not re-style big gradients or `box-shadow` every frame.
- Use the smallest image that covers its on-screen size (`packshot1200` up to 1200 px tall).
- Avoid full-screen `mix-blend-mode` / `filter: blur()` layers unless needed; pre-render them.
- Canvas / WebGL are fine (WebGL via SwiftShader, see `tools/test/webgl-check.html`).
- Iterate cheap: `--downscale 0.5 --fps 15` (the "480p first" step of the method), `snap.mjs` for stills.

## Commands

### `render.mjs`: scene → MP4
```
node tools/render.mjs <scene.html> <out.mp4> --w 1080 --h 1920 --fps 30 --dur 12
  [--start 0] [--workers 1] [--crf 18] [--preset medium] [--downscale 0.5]
  [--query "k=v&k2=v2"] [--frames dir] [--lossless] [--quality 96] [--file]
```
Calls `__seek(t)` for every frame, captures the viewport (JPEG q96 by default, `--lossless` = PNG),
pipes to ffmpeg → H.264 High, yuv420p, BT.709 tags, CRF 18, GOP 2 s, `+faststart`. No audio track
(add it with `mux.sh`). `--workers N` renders contiguous chunks in N pages and concatenates them losslessly
(little gain on 4 cores: keep 1-2). Scene errors stop the render.

### `snap.mjs`: stills
```
node tools/snap.mjs <scene.html> out.png --t 2.5 [--w --h] [--query safe=1]
node tools/snap.mjs <scene.html> out/prefix --t 0,2.5,7 --sheet     # prefix_t2.50.png … + prefix_sheet.png
```

### `tts.sh`: one line of French voice
```
tools/tts.sh "<text>" <female|male|path.onnx> <out.wav> [length_scale]
```
Piper `fr_FR-siwis-medium` (female) / `fr_FR-tom-medium` (male) → 48 kHz mono, rumble cut, presence EQ,
light compression, leading/trailing silence trimmed (+30 ms head, 80 ms tail), **-16 LUFS**, peak ≤ -2 dBFS.
Prints `duration=…`. `length_scale` 0.92 punchy UGC, 1.0 neutral, 1.1-1.25 calm or cinematic.
Text normalization (`NORMALIZE=0` to disable): `300 mg` → "300 milligrammes", `1,4 mg` → "1,4 milligramme",
`bisglycinate` → "bisse-glycinate" (otherwise espeak says "biz-"), `…` → `.`, `·` → `,`.
Checked pronunciations: "B6" → "bé six", "%" → "pour cent", "magnésium" OK, "VNR" is spelled letter by letter.
Env: `SENTENCE_SILENCE` (0.18 s), `NOISE`, `NOISE_W`, `TARGET_LUFS`, `HEAD_PAD`, `TAIL_PAD`.

### `vo-build.mjs`: full VO track + word timings for captions
```
node tools/vo-build.mjs vN/vN.vo.json [--out vN/audio] [--var VO_TIMINGS]
```
Input: `{voice, length_scale, duration, gap, lines: [{id, start?, text, caption?, voice?, length_scale?}]}`
(ready-made scripts for V1-V4 in `brand-system.md` §14). Output in `vN/audio/`:
`vN.wav` (all lines placed at `start`, 48 kHz mono), `vN-timings.json`, `vN-timings.js`
(`window.VO_TIMINGS = {duration, cues: [{id, start, end, text, spoken, words: [{w, start, end}]}]}`,
loadable with a classic `<script>`), `lines/<id>-<hash>.wav` (cached: edit one line, only that line is
re-synthesized). Word times come from the audio: pauses found in each clip are matched to the
punctuation, words are spread by syllables and snapped to energy dips. `caption` lets the screen show
"300 mg" while the voice says "trois cents milligrammes". Warns on overlaps or lines past `duration`.

### `music.sh`: original music bed (ffmpeg synthesis, no samples)
```
tools/music.sh <out.wav> <dur> <calm|pulse> [bpm] [key]
```
`calm` (default 72 BPM): evolving pad Dmaj9-Bm7-Gmaj7-Asus2, crossfaded voicings, detuned partials, sub,
convolution reverb with a synthetic impulse. `pulse` (default 120 BPM): same pad pumped + sine kick,
noise hats, 8th-note pluck arpeggio, bass. `key` C D E F G A Bb… (default D). Output 48 kHz stereo,
exactly `dur` s, **-20 LUFS**, fades (`FADE_IN`, `FADE_OUT`).

### `sfx.sh`: synthesized effects
```
tools/sfx.sh <click|tick|pop|whoosh|swell|chime|thud|glass|drop|tape|rattle> <out.wav> [dur]
```
48 kHz stereo, peak -3 dBFS. `swell` (2.5 s) ends on the hit: place it so it ends on your reveal.

### `mux.sh`: final mix
```
tools/mux.sh <video.mp4> <vo.wav | vo.list | ''> <music.wav | ''> <out.mp4> [sfx.list]
```
`.list` files: one clip per line, `<start_s> <file.wav> [gain_dB]` (paths relative to the list, `#` comments).
Music gain `MUSIC_DB` (-3 dB), ducked under the voice with `sidechaincompress` (`DUCK=0` to disable,
`DUCK_THRESHOLD`, `DUCK_RATIO`), effects added without ducking, trimmed to the video duration,
**-14 LUFS** integrated (`TARGET_LUFS`), limiter at -1.5 dBFS (`CEILING`, about -1 dBTP), AAC 192 kb/s
48 kHz stereo, video stream copied, `+faststart`. No VO and no music → silent track (platforms want audio).

### `qa.sh`: check a deliverable
```
tools/qa.sh <video.mp4> [--at 1.0,4.5] [--n 6] [--sheet out.png]
```
Video/audio stream summary, EBU R128 loudness (I, true peak), contact sheet of N frames, and full-size
stills at `--at` times (look at them with the Read tool).

### `lint-copy.mjs`: compliance lint
```
node tools/lint-copy.mjs vN/scene.html vN/vN.vo.json
```
Flags forbidden wording from `AMBREL.forbidden` (effect promises, sleep/stress/slimming, disease, doctors,
invented ratings or numbers, absorption, false urgency, results testimonials). Exit code 1 on any error.
Put `lint-ok` on a line (e.g. in a comment) to silence a deliberate quote.

### `svg2png.mjs`: rasterize SVG
```
node tools/svg2png.mjs in.svg out.png --w 1080 [--h 1080] [--bg transparent|#hex]
```

## Brand assets rebuild

`brand/src/build_brand.py` generates every SVG (text converted to paths with HarfBuzz from the local fonts);
`brand/src/render_pngs.sh` renders the PNGs. The Python step needs fonttools, brotli and uharfbuzz
(a venv in the scratchpad: `PY=/tmp/claude-0/-home-user-Vous-/f35a64a3-575c-568b-a719-88930a70516c/scratchpad/ftvenv/bin/python bash brand/src/render_pngs.sh`).
Without it, the script only re-renders the existing SVGs.

## Specs reminder

| | 9:16 | 16:9 |
|---|---|---|
| Size | 1080×1920, 30 fps | 1920×1080, 30 fps |
| Text zone | x 80-950, y 288-1248 (captions down to 1440, nothing important below 1536) | 96 px side margins, 54 px top/bottom; subject in x 656-1264 for a 9:16 recrop |
| Audio | -14 LUFS, ≤ -1 dBTP, VO ~10-12 dB above music | same |
| Legal end card | ≥ 4 s, `.ak-legal`, `AMBREL.legal.full` | same, `.is-wide` |
