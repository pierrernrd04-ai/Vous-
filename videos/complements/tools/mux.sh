#!/usr/bin/env bash
# Final audio mix + mux for social (TikTok / Reels / Shorts).
#
#   tools/mux.sh <video.mp4> <vo.wav | vo.list | ''> <music.wav | ''> <out.mp4> [sfx.list]
#
#   vo.wav   pre-built VO track (e.g. from vo-build.mjs), starts at t=0 (env VO_OFFSET to shift)
#   vo.list  offset list, one clip per line:   <start_seconds> <file.wav> [gain_dB]
#   sfx.list same format, mixed on top WITHOUT ducking (clicks, whooshes, chimes...)
#   ''       no VO / no music. A video with neither gets a silent track (platforms want audio).
#   Paths inside .list files are relative to the list file. Lines starting with # are ignored.
#
# Mix: music gain MUSIC_DB (default -3 dB) then ducked under the voice with sidechaincompress
# (about -6 to -8 dB while speaking; DUCK=0 disables), everything summed, trimmed to the video
# duration, normalised to TARGET_LUFS (default -14 LUFS integrated) with a limiter at
# CEILING (default -1.5 dBFS, about -1 dBTP), AAC 192 kb/s 48 kHz stereo, video stream copied,
# +faststart. Prints the measured loudness of the result.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/audio.sh"
if [ $# -lt 4 ]; then sed -n '2,19p' "$0"; exit 2; fi
VIDEO="$1"; VO="$2"; MUSIC="$3"; OUT="$4"; SFX="${5:-}"
[ -f "$VIDEO" ] || { echo "video not found: $VIDEO" >&2; exit 1; }
D=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=nw=1:nk=1 "$VIDEO")
case "$D" in ''|N/A) D=$(duration "$VIDEO") ;; esac
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
AF="aformat=sample_rates=48000:channel_layouts=stereo:sample_fmts=fltp"

# build_list <list> <out.wav>: place clips at offsets
build_list() {
  local list="$1" outw="$2" dir; dir="$(cd "$(dirname "$list")" && pwd)"
  local inputs=() fc="" labels="" n=0
  while read -r off file gain _; do
    [[ -z "${off:-}" || "$off" == \#* ]] && continue
    [[ "$file" = /* ]] || file="$dir/$file"
    [ -f "$file" ] || { echo "missing clip in $list: $file" >&2; exit 1; }
    inputs+=(-i "$file")
    local ms; ms=$(awk -v o="$off" 'BEGIN{printf "%d", o*1000}')
    fc+="[$n:a]$AF,volume=${gain:-0}dB,adelay=${ms}:all=1[c$n];"
    labels+="[c$n]"; n=$((n+1))
  done < "$list"
  [ "$n" -gt 0 ] || { echo "empty list: $list" >&2; exit 1; }
  $FF -y "${inputs[@]}" -filter_complex "${fc}${labels}amix=inputs=$n:normalize=0:duration=longest,apad,atrim=0:$D" -c:a pcm_f32le "$outw"
}

HAS_VO=0; HAS_MUS=0
if [ -n "$VO" ]; then
  case "$VO" in
    *.list|*.txt) build_list "$VO" "$TMP/vo.wav" ;;
    *) ms=$(awk -v o="${VO_OFFSET:-0}" 'BEGIN{printf "%d", o*1000}')
       $FF -y -i "$VO" -af "$AF,adelay=${ms}:all=1,apad,atrim=0:$D" -c:a pcm_f32le "$TMP/vo.wav" ;;
  esac
  HAS_VO=1
fi
if [ -n "$MUSIC" ]; then
  MD=$(duration "$MUSIC")
  FADE=""
  if awk -v m="$MD" -v d="$D" 'BEGIN{exit !(m > d + 0.05)}'; then
    FADE=",afade=t=out:st=$(awk -v d="$D" 'BEGIN{printf "%.3f", d-0.8}'):d=0.8"
  fi
  $FF -y -i "$MUSIC" -af "$AF,volume=${MUSIC_DB:--3}dB,apad,atrim=0:$D$FADE" -c:a pcm_f32le "$TMP/music.wav"
  HAS_MUS=1
fi

if [ $HAS_VO = 1 ] && [ $HAS_MUS = 1 ]; then
  if [ "${DUCK:-1}" = "1" ]; then
    $FF -y -i "$TMP/music.wav" -i "$TMP/vo.wav" -filter_complex \
      "[1:a]asplit=2[vk][vm];[0:a][vk]sidechaincompress=threshold=${DUCK_THRESHOLD:-0.03}:ratio=${DUCK_RATIO:-5}:attack=25:release=420[md];[md][vm]amix=inputs=2:normalize=0:duration=first" \
      -c:a pcm_f32le "$TMP/bed.wav"
  else
    $FF -y -i "$TMP/music.wav" -i "$TMP/vo.wav" -filter_complex "amix=inputs=2:normalize=0:duration=first" -c:a pcm_f32le "$TMP/bed.wav"
  fi
elif [ $HAS_VO = 1 ]; then cp "$TMP/vo.wav" "$TMP/bed.wav"
elif [ $HAS_MUS = 1 ]; then cp "$TMP/music.wav" "$TMP/bed.wav"
else
  $FF -y -f lavfi -i "anullsrc=r=48000:cl=stereo" -t "$D" -c:a pcm_f32le "$TMP/bed.wav"
fi

if [ -n "$SFX" ]; then
  build_list "$SFX" "$TMP/sfx.wav"
  $FF -y -i "$TMP/bed.wav" -i "$TMP/sfx.wav" -filter_complex "amix=inputs=2:normalize=0:duration=first" -c:a pcm_f32le "$TMP/mix.wav"
else
  mv "$TMP/bed.wav" "$TMP/mix.wav"
fi

if [ $HAS_VO = 0 ] && [ $HAS_MUS = 0 ] && [ -z "$SFX" ]; then
  cp "$TMP/mix.wav" "$TMP/final.wav"
else
  norm_to "$TMP/mix.wav" "$TMP/final.wav" "${TARGET_LUFS:--14}" "${CEILING:--1.5}" -ar 48000 -ac 2 -c:a pcm_s16le
fi
mkdir -p "$(dirname "$OUT")"
$FF -y -i "$VIDEO" -i "$TMP/final.wav" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$D" -movflags +faststart "$OUT"
echo "mux: $OUT  ($(printf '%.2f' "$D") s)  $(wav_info "$OUT" | sed 's/^dur=[^ ]* s  //')" >&2
