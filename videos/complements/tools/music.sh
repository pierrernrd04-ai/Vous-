#!/usr/bin/env bash
# Original music bed, synthesised with ffmpeg (no samples, no copyrighted material).
#
#   tools/music.sh <out.wav> <dur_seconds> <mood: calm|pulse> [bpm] [key]
#
#   calm  : soft evolving pad, 72 BPM harmonic rhythm (chord every 2 bars), reverb. V4 / V2 / V3.
#   pulse : light pulse 120 BPM (sine kick, noise hats, pluck arpeggio, bass) over the pad. V1 / V2.
#   key   : C D E F G A Bb ... (default D). bpm default 72 (calm) / 120 (pulse).
#
# Output: 48 kHz stereo 16-bit WAV, exactly <dur> s, about -20 LUFS, peak <= -2 dBFS,
# fade in/out (env FADE_IN, FADE_OUT; defaults calm 1.5/2.0 s, pulse 0.15/1.2 s).
# Env TARGET_LUFS (default -20).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/audio.sh"
if [ $# -lt 3 ]; then sed -n '2,15p' "$0"; exit 2; fi
OUT="$1"; DUR="$2"; MOOD="$3"; BPM="${4:-}"; KEY="${5:-D}"
case "$MOOD" in
  calm)  FI="${FADE_IN:-1.5}"; FO="${FADE_OUT:-2.0}" ;;
  pulse) FI="${FADE_IN:-0.15}"; FO="${FADE_OUT:-1.2}" ;;
  *) echo "mood must be calm or pulse" >&2; exit 2 ;;
esac
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node "$HERE/lib/music.mjs" "$MOOD" "$DUR" "$TMP/raw.wav" "$BPM" "$KEY"
FOST=$(awk -v d="$DUR" -v f="$FO" 'BEGIN{s=d-f; if (s<0) s=0; printf "%.3f", s}')
$FF -y -i "$TMP/raw.wav" -af "atrim=0:$DUR,asetpts=N/SR/TB,afade=t=in:st=0:d=$FI:curve=qsin,afade=t=out:st=$FOST:d=$FO:curve=qsin" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$TMP/cut.wav"
mkdir -p "$(dirname "$OUT")"
norm_to "$TMP/cut.wav" "$OUT" "${TARGET_LUFS:--20}" -2 -ar 48000 -ac 2 -c:a pcm_s16le
echo "$(wav_info "$OUT")  <- music $MOOD ${BPM:-default} BPM key $KEY" >&2
