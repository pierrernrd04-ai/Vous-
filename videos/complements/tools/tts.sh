#!/usr/bin/env bash
# French voice-over with Piper (local neural TTS), cleaned and loudness-normalised.
#
#   tools/tts.sh "<text>" <female|male> <out.wav> [length_scale]
#
#   female = fr_FR-siwis-medium, male = fr_FR-tom-medium (or pass a path to any .onnx)
#   length_scale: >1 slower (1.15 = calm/cinematic), <1 faster (0.92 = punchy UGC). Default 1.0
#
# Output: 48 kHz mono 16-bit WAV, about -16 LUFS, peak <= -1.5 dBFS, leading/trailing
# silence trimmed then HEAD_PAD/TAIL_PAD seconds added (default 0.03 / 0.08).
# Prints the final duration on stdout (last line: "duration=<s>").
#
# Env: NORMALIZE=0 (keep text as is), SENTENCE_SILENCE=0.18, NOISE=0.6, NOISE_W=0.8,
#      TARGET_LUFS=-16, HEAD_PAD=0.03, TAIL_PAD=0.08, PIPER=..., VOICES_DIR=...
#
# Text normalisation (NORMALIZE=1, default) so Piper/espeak reads like a human:
#   "300 mg" -> "300 milligrammes", "1,4 mg" -> "1,4 milligramme", "bisglycinate" -> "bisse-glycinate"
#   (else espeak says "biz"), "…" -> "." (real pause), "·" -> ",". Numbers, "%", "B6" are fine.
#   Write "V N R" or "valeurs nutritionnelles de référence" yourself if you want it spoken.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/audio.sh"

if [ $# -lt 3 ]; then
  sed -n '2,20p' "$0"; exit 2
fi
TEXT="$1"; VOICE="$2"; OUT="$3"; LS="${4:-1.0}"
SCRATCH=/tmp/claude-0/-home-user-Vous-/f35a64a3-575c-568b-a719-88930a70516c/scratchpad
PIPER="${PIPER:-$SCRATCH/venv/bin/piper}"
VOICES_DIR="${VOICES_DIR:-$SCRATCH/voices}"
case "$VOICE" in
  female|f|siwis|femme) MODEL="$VOICES_DIR/fr_FR-siwis-medium.onnx" ;;
  male|m|tom|homme)     MODEL="$VOICES_DIR/fr_FR-tom-medium.onnx" ;;
  *.onnx)               MODEL="$VOICE" ;;
  *) echo "unknown voice '$VOICE' (female|male|path.onnx)" >&2; exit 2 ;;
esac
[ -x "$PIPER" ] || { echo "piper not found at $PIPER" >&2; exit 1; }
[ -f "$MODEL" ] || { echo "voice model not found: $MODEL" >&2; exit 1; }

if [ "${NORMALIZE:-1}" = "1" ]; then
  TEXT="$(TTS_TEXT="$TEXT" python3 -I -c '
import os, re
t = os.environ["TTS_TEXT"]
def mg(m):
    v = m.group(1); n = float(v.replace(",", "."))
    return v + (" milligramme" if n < 2 else " milligrammes")
t = re.sub(r"(\d+(?:,\d+)?)\s*mg\b", mg, t)
t = re.sub(r"(\d+(?:,\d+)?)\s*µg\b", lambda m: m.group(1) + " microgrammes", t)
t = re.sub(r"(?i)\bbisglycinate", lambda m: ("B" if m.group(0)[0] == "B" else "b") + "isse-glycinate", t)
t = t.replace("…", ".").replace("·", ",").replace(" ", " ").replace(" ", " ")
print(t)
')"
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf '%s\n' "$TEXT" | "$PIPER" -m "$MODEL" -f "$TMP/raw.wav" \
  --length-scale "$LS" --sentence-silence "${SENTENCE_SILENCE:-0.18}" \
  --noise-scale "${NOISE:-0.6}" --noise-w-scale "${NOISE_W:-0.8}" >/dev/null 2>"$TMP/piper.log" \
  || { cat "$TMP/piper.log" >&2; exit 1; }

# clean-up chain: 48 kHz, rumble cut, small presence lift, gentle compression, trim silences
HP="${HEAD_PAD:-0.03}"; TPd="${TAIL_PAD:-0.08}"
$FF -y -i "$TMP/raw.wav" -af "aresample=48000,highpass=f=70,equalizer=f=220:t=q:w=1.0:g=-1.5,equalizer=f=3400:t=q:w=1.4:g=2,\
acompressor=threshold=-22dB:ratio=2.2:attack=6:release=120:makeup=1.5,\
silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,\
silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,\
adelay=$(awk -v p="$HP" 'BEGIN{printf "%d", p*1000}'):all=1,apad=pad_dur=$TPd" \
  -ac 1 -ar 48000 -c:a pcm_s16le "$TMP/clean.wav"

mkdir -p "$(dirname "$OUT")"
norm_to "$TMP/clean.wav" "$OUT" "${TARGET_LUFS:--16}" -2 -ac 1 -ar 48000 -c:a pcm_s16le
echo "$(wav_info "$OUT")  <- \"$TEXT\"" >&2
printf 'duration=%.3f\n' "$(duration "$OUT")"
