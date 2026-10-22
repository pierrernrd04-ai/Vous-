# Shared audio helpers (sourced by tts.sh, music.sh, sfx.sh, mux.sh). Bash.
# Loudness is measured with ffmpeg ebur128 and set with a static gain + lookahead limiter
# (predictable, no pumping, unlike single-pass loudnorm).

FF="ffmpeg -hide_banner -nostdin -loglevel error"

# lufs <file> -> prints "I TP" (integrated LUFS, true peak dBTP)
lufs() {
  ffmpeg -hide_banner -nostdin -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '
    /Integrated loudness:/ {sec="i"} /True peak:/ {sec="p"}
    sec=="i" && $1=="I:" {I=$2}
    sec=="p" && $1=="Peak:" {P=$2}
    END {printf "%s %s\n", (I==""?"-70":I), (P==""?"-70":P)}'
}

# duration <file> -> seconds
duration() { ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }

# norm_to <in> <out> <target LUFS> <ceiling dBFS> [extra output args...]
# Static gain to reach target, then limiter at ceiling. Output keeps input channels/rate
# unless extra args say otherwise.
norm_to() {
  local in="$1" out="$2" target="$3" ceil="$4"; shift 4
  local m; m=$(lufs "$in"); local I=${m% *}
  local gain; gain=$(awk -v t="$target" -v i="$I" 'BEGIN{ if (i<-69) print 0; else printf "%.2f", t-i }')
  local lim; lim=$(awk -v c="$ceil" 'BEGIN{ v=10^(c/20); if (v<0.0625) v=0.0625; if (v>1) v=1; printf "%.4f", v }')
  $FF -y -i "$in" -af "volume=${gain}dB,alimiter=limit=${lim}:attack=2:release=60:level=false:latency=true" "$@" "$out"
}

# wav_info <file>: "dur=… I=… TP=…"
wav_info() { local m; m=$(lufs "$1"); printf 'dur=%.3f s  I=%s LUFS  TP=%s dBTP\n' "$(duration "$1")" "${m% *}" "${m#* }"; }

# peak_to <in> <out> <peak dBFS> [extra output args...]  (simple peak normalisation)
peak_to() {
  local in="$1" out="$2" pk="$3"; shift 3
  local mx; mx=$(ffmpeg -hide_banner -nostdin -i "$in" -af volumedetect -f null - 2>&1 | awk '/max_volume/{print $5}')
  local gain; gain=$(awk -v p="$pk" -v m="${mx:--91}" 'BEGIN{ if (m<-90) print 0; else printf "%.2f", p-m }')
  $FF -y -i "$in" -af "volume=${gain}dB" "$@" "$out"
}
