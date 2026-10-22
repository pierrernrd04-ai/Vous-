#!/usr/bin/env bash
# Rebuild brand SVGs (needs a Python with fonttools+brotli+uharfbuzz) and PNG renders.
#   PY=/path/to/venv/bin/python bash brand/src/render_pngs.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
B="$HERE/.."
T="$HERE/../../tools"
PY="${PY:-python3}"
if "$PY" -c "import fontTools, uharfbuzz, brotli" 2>/dev/null; then
  "$PY" "$HERE/build_brand.py"
else
  echo "skip SVG rebuild (fonttools/uharfbuzz/brotli missing for $PY); rendering existing SVGs" >&2
fi
mkdir -p "$B/png"
node "$T/svg2png.mjs" "$B/packshot.svg"        "$B/png/packshot-transparent-1200.png" --w 1000 --h 1200
node "$T/svg2png.mjs" "$B/packshot.svg"        "$B/png/packshot-transparent-2400.png" --w 2000 --h 2400
node "$T/svg2png.mjs" "$B/packshot-body.svg"   "$B/png/packshot-body-2400.png"        --w 2000 --h 2400
node "$T/svg2png.mjs" "$B/packshot-lid.svg"    "$B/png/packshot-lid-2400.png"         --w 2000 --h 2400
node "$T/svg2png.mjs" "$B/packshot-square.svg" "$B/png/packshot-1080.png"             --w 1080 --h 1080 --bg '#F6EFE4'
node "$T/svg2png.mjs" "$B/label-wrap.svg"      "$B/png/label-wrap-2x.png"             --w 3496 --h 1060 --bg '#F4ECDF'
node "$T/svg2png.mjs" "$B/logo.svg"            "$B/png/logo-1200.png"                 --w 1200
node "$T/svg2png.mjs" "$B/logo-light.svg"      "$B/png/logo-light-1200.png"           --w 1200
node "$T/svg2png.mjs" "$B/logo-mark.svg"       "$B/png/logo-mark-512.png"             --w 512
node "$T/svg2png.mjs" "$B/capsule.svg"         "$B/png/capsule-640.png"               --w 640
