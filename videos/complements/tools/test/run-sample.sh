#!/usr/bin/env bash
# End-to-end toolkit test (2 s sample): VO + timings -> render -> music + sfx -> mux -> QA.
#   bash tools/test/run-sample.sh
set -euo pipefail
T="$(cd "$(dirname "$0")/.." && pwd)"      # tools/
cd "$T/.."                                  # videos/complements/
node tools/vo-build.mjs tools/test/sample.vo.json
node tools/render.mjs tools/scene-template.html tools/test/out/sample-video.mp4 --w 1080 --h 1920 --fps 30 --dur 2 --workers 2
tools/music.sh tools/test/audio/sample-music.wav 2 pulse
tools/sfx.sh pop tools/test/audio/sfx-pop.wav
printf '# offset file gain_dB\n0.12 sfx-pop.wav -6\n' > tools/test/audio/sample-sfx.list
tools/mux.sh tools/test/out/sample-video.mp4 tools/test/audio/sample.wav tools/test/audio/sample-music.wav tools/test/out/sample.mp4 tools/test/audio/sample-sfx.list
tools/qa.sh tools/test/out/sample.mp4 --at 0.5,1.6
node tools/snap.mjs tools/scene-template.html tools/test/out/template-endcard.png --t 6.5
node tools/snap.mjs tools/scene-template.html tools/test/out/template-safe.png --t 1.6 --query safe=1
node tools/snap.mjs tools/test/webgl-check.html tools/test/out/webgl-check.png --t 1
node tools/snap.mjs tools/test/jar3d-check.html tools/test/out/jar3d-check.png --t 1.3 --w 1920 --h 1080
node tools/lint-copy.mjs tools/test/sample.vo.json tools/scene-template.html brand/brand-system.md
echo "OK sample: tools/test/out/sample.mp4"
