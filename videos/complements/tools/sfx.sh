#!/usr/bin/env bash
# Synthesised sound effects (ffmpeg aevalsrc only, no samples).
#
#   tools/sfx.sh <type> <out.wav> [duration]
#
#   click   tiny UI click (12 ms)            tick    soft sine tick (UI, counters)
#   pop     upward "pop" (caps, bubbles)     whoosh  air sweep L->R (transitions), dur 0.7
#   swell   rising swell before a reveal (dur 2.5, ends on the hit)
#   chime   warm bell / shimmer (reveal, end card), dur 2.5
#   thud    jar set down on stone            glass   glass "tink"
#   drop    water drop                       tape    adhesive tape peel (unboxing), dur 0.9
#   rattle  capsules shaken in the jar, dur 0.5
#
# Output: 48 kHz stereo 16-bit WAV, peak -3 dBFS (env PEAK). Place them with mux.sh's
# 5th argument (sfx list) or bake them into your own track.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib/audio.sh"
if [ $# -lt 2 ]; then sed -n '2,16p' "$0"; exit 2; fi
TYPE="$1"; OUT="$2"; D="${3:-}"
P=1   # helper
case "$TYPE" in
  click)  D=${D:-0.05}; E="(random(0)*2-1)*exp(-t*320)+0.4*sin(2*PI*3200*t)*exp(-t*260)"; F="highpass=f=2500" ;;
  tick)   D=${D:-0.08}; E="sin(2*PI*2200*t)*exp(-t*90)*(1-exp(-t*3000))"; F="lowpass=f=6000" ;;
  pop)    D=${D:-0.12}; E="sin(2*PI*(380*t+720*t*t/0.12))*(1-exp(-t*900))*exp(-t*38)"; F="highpass=f=150" ;;
  whoosh) D=${D:-0.7};  E="(random(0)*2-1)*pow(sin(PI*t/$D),2.5)*(1-t/$D)|(random(1)*2-1)*pow(sin(PI*t/$D),2.5)*(t/$D)"; F="bandpass=f=1100:width_type=o:w=2.2,lowpass=f=5000" ;;
  swell)  D=${D:-2.5};  E="(0.5*(random(0)*2-1)+0.6*sin(2*PI*(220*t+0.5*440*t*t/$D)))*pow(t/$D,3)*(1-exp(-($D-t)*60))"; F="lowpass=f=4200,highpass=f=120" ;;
  chime)  D=${D:-2.5};  E="(sin(2*PI*1318.5*t)+0.6*sin(2*PI*1975.5*t)+0.35*sin(2*PI*2637*t)+0.18*sin(2*PI*1318.5*3.76*t)*exp(-t*6))*exp(-t*2.2)*(1-exp(-t*700))"; F="lowpass=f=9000,aecho=0.8:0.5:90|170:0.3|0.2" ;;
  thud)   D=${D:-0.35}; E="(sin(2*PI*(62*t+40*(1-exp(-t*30))/30))*exp(-t*13)+0.25*(random(0)*2-1)*exp(-t*60))"; F="lowpass=f=1200" ;;
  glass)  D=${D:-0.6};  E="(sin(2*PI*3150*t)*exp(-t*9)+0.6*sin(2*PI*4870*t)*exp(-t*13)+0.35*sin(2*PI*6930*t)*exp(-t*20))*(1-exp(-t*4000))"; F="highpass=f=1500" ;;
  drop)   D=${D:-0.18}; E="sin(2*PI*(600*t+1000*t*t/0.08))*(1-exp(-t*1500))*exp(-t*28)"; F="highpass=f=300,lowpass=f=5000" ;;
  tape)   D=${D:-0.9};  E="(random(0)*2-1)*if(gt(random(1),0.82),1,0.18)*pow(sin(PI*t/$D),0.6)"; F="highpass=f=1400,lowpass=f=9000" ;;
  rattle) D=${D:-0.5};  E="(random(0)*2-1)*pow(abs(sin(2*PI*21*t+4*sin(2*PI*6.3*t))),36)*pow(sin(PI*t/$D),0.8)"; F="highpass=f=900,lowpass=f=7000" ;;
  *) echo "unknown sfx type: $TYPE" >&2; exit 2 ;;
esac
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
case "$E" in *"|"*) EX="$E" ;; *) EX="$E|$E" ;; esac
$FF -y -f lavfi -i "aevalsrc=exprs='$EX':s=48000:d=$D" -af "$F,afade=t=out:st=$(awk -v d="$D" 'BEGIN{printf "%.3f", d*0.85}'):d=$(awk -v d="$D" 'BEGIN{printf "%.3f", d*0.15}')" -ar 48000 -ac 2 -c:a pcm_s16le "$TMP/raw.wav"
mkdir -p "$(dirname "$OUT")"
peak_to "$TMP/raw.wav" "$OUT" "${PEAK:--3}" -ar 48000 -ac 2 -c:a pcm_s16le
echo "$OUT ($TYPE, ${D} s)" >&2
