#!/usr/bin/env bash
# Quick QA of a rendered video: stream summary, loudness, contact sheet, optional stills.
#
#   tools/qa.sh <video.mp4> [--at 1.0,4.5,9] [--sheet out.png] [--n 6]
#
# Prints codec / size / fps / duration / pix_fmt / audio and EBU R128 loudness, writes a
# contact sheet (default <video>.sheet.png, N frames evenly spaced, 270 px wide each) and,
# with --at, full-size stills <video>.t<sec>.png you can open with the Read tool.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/audio.sh"
V="${1:?video}"; shift
AT=""; SHEET="${V%.*}.sheet.png"; N=6
while [ $# -gt 0 ]; do
  case "$1" in --at) AT="$2"; shift 2 ;; --sheet) SHEET="$2"; shift 2 ;; --n) N="$2"; shift 2 ;; *) shift ;; esac
done
echo "== $V"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames,color_space \
  -of default=nw=1 "$V" | paste -sd' ' | sed 's/^/  video: /'
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,bit_rate \
  -of default=nw=1 "$V" | paste -sd' ' | sed 's/^/  audio: /'
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 "$V" | paste -sd' ' | sed 's/^/  file:  /'
if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$V" | grep -q .; then
  m=$(lufs "$V"); echo "  loudness: I=${m% *} LUFS  TP=${m#* } dBTP"
else
  echo "  loudness: (no audio stream)"
fi
D=$(duration "$V")
W=270
FC=""; IN=()
for i in $(seq 0 $((N-1))); do
  t=$(awk -v d="$D" -v i="$i" -v n="$N" 'BEGIN{printf "%.3f", (i+0.5)*d/n}')
  IN+=(-ss "$t" -i "$V")
  FC+="[$i:v]scale=$W:-2,drawtext=text='$(printf '%.1f' "$t") s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6[s$i];"
done
LAB=""; for i in $(seq 0 $((N-1))); do LAB+="[s$i]"; done
$FF -y "${IN[@]}" -filter_complex "${FC}${LAB}hstack=inputs=$N" -frames:v 1 "$SHEET"
echo "  sheet: $SHEET"
if [ -n "$AT" ]; then
  IFS=',' read -ra TS <<< "$AT"
  for t in "${TS[@]}"; do
    o="${V%.*}.t${t}.png"; $FF -y -ss "$t" -i "$V" -frames:v 1 "$o"; echo "  still: $o"
  done
fi
