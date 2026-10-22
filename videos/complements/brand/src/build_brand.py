#!/usr/bin/env python3
"""Generate the Ambrel brand SVG assets (all text converted to paths).

Outputs (in brand/):
  logo.svg, logo-light.svg, logo-mark.svg
  packshot.svg            jar, transparent background, viewBox 1000x1200
  packshot-body.svg       same canvas, jar without lid (for lid animations)
  packshot-lid.svg        same canvas, lid only
  packshot-square.svg     1080x1080 aesthetic packshot scene (pedestal, light)
  label-wrap.svg          unrolled 360 deg label texture (1748x530) for 3D turntables
  capsule.svg             one vegetable capsule (320x120)

Run:  <venv-with-fonttools>/bin/python brand/src/build_brand.py
Then: node tools/svg2png.mjs ... (see brand/src/render_pngs.sh)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textpath import text_path, text_width, wrap_lines  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# ---------------------------------------------------------------- palette
INK = "#211B16"
AMBER = "#C46F28"
AMBER_DEEP = "#7E3F14"
HONEY = "#EDB467"
CREAM = "#F6EFE4"
LINEN = "#EFE5D6"
STONE = "#D8CEBF"
CLAY = "#A8927A"
CLAY_DARK = "#6E5A45"
MIST = "#C7D2DA"
DAWN = "#4F6175"

NB = " "  # no-break space (narrow NBSP is missing from the font subset)


def P(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def T(text, x, y, fill, **kw):
    d, _ = text_path(text, x, y, **kw)
    return P(d, fill)


def svg_doc(w, h, body, defs="", title="", vb=None):
    vb = vb or f"0 0 {w} {h}"
    t = f"<title>{title}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">'
            f'{t}<defs>{defs}</defs>{body}</svg>\n')


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", os.path.relpath(path, os.path.join(OUT, "..")), f"{len(content)/1024:.0f} KB")


# ---------------------------------------------------------------- logo
def mark_defs(p):
    return (f'<radialGradient id="{p}mg" cx="36%" cy="30%" r="78%">'
            f'<stop offset="0" stop-color="#F6CC86"/><stop offset=".5" stop-color="{AMBER}"/>'
            f'<stop offset="1" stop-color="{AMBER_DEEP}"/></radialGradient>'
            f'<mask id="{p}mm" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">'
            f'<rect width="100" height="100" fill="#fff"/>'
            f'<path d="M31 61 A19 19 0 0 1 69 61 Z" fill="#000"/>'
            f'<rect x="19" y="66" width="62" height="5.2" rx="2.6" fill="#000"/>'
            f'<rect x="29" y="76" width="42" height="4.2" rx="2.1" fill="#000"/>'
            f'</mask>')


PEBBLE = "M51 3 C79 3 97 22 97 50 C97 79 78 97 50 97 C22 97 3 79 3 51 C3 23 23 3 51 3 Z"


def mark(p, x, y, size, mono=None):
    s = size / 100
    fill = mono or f"url(#{p}mg)"
    hl = "" if mono else ('<path d="M22 26 C30 15 42 10 54 10 C40 14 31 20 25 31 Z" fill="#fff" opacity=".35"/>')
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})">'
            f'<path d="{PEBBLE}" fill="{fill}" mask="url(#{p}mm)"/>{hl}</g>')


def wordmark(x, y, size, fill, anchor="start"):
    d, w = text_path("ambrel", x, y, font="fraunces", size=size, wght=600, opsz=144,
                     tracking=-0.012, anchor=anchor)
    return P(d, fill), w


def logo_lockup(p, x, baseline, size, word_fill, mono=None, anchor="start"):
    """Horizontal lockup. size = wordmark font size. Returns (svg, total_width)."""
    msize = size * 0.86
    gap = size * 0.17
    ww = text_width("ambrel", font="fraunces", size=size, wght=600, opsz=144, tracking=-0.012)
    total = msize + gap + ww
    x0 = x - total / 2 if anchor == "middle" else x
    # vertically center the mark on the x-height (~0.5 em above baseline)
    my = baseline - size * 0.36 - msize / 2
    m = mark(p, x0, my, msize, mono)
    wsvg, _ = wordmark(x0 + msize + gap, baseline, size, word_fill)
    return m + wsvg, total


def build_logos():
    size = 120
    p = "amb-logo-"
    body, w = logo_lockup(p, 10, 132, size, INK)
    W, H = math.ceil(w + 20), 170
    write("logo.svg", svg_doc(W, H, body, mark_defs(p), "Ambrel"))
    p = "amb-logol-"
    body, w = logo_lockup(p, 10, 132, size, CREAM)
    write("logo-light.svg", svg_doc(W, H, body, mark_defs(p), "Ambrel (sur fond sombre)"))
    p = "amb-mark-"
    write("logo-mark.svg", svg_doc(200, 200, mark(p, 0, 0, 200), mark_defs(p), "Ambrel, symbole"))


# ---------------------------------------------------------------- capsule
def capsule(p, cx, cy, length, diam, angle=0, opacity=1.0):
    """Two-part vegetable (HPMC) capsule, translucent ivory."""
    L, D = length, diam
    r = D / 2
    x0, y0 = cx - L / 2, cy - r
    cap_len = L * 0.56
    seam = x0 + cap_len
    g = (f'<g transform="rotate({angle} {cx} {cy})" opacity="{opacity}">'
         # body (right part)
         f'<rect x="{x0 + L*0.40:.1f}" y="{y0:.1f}" width="{L*0.60:.1f}" height="{D:.1f}" rx="{r:.1f}" fill="url(#{p}cb)"/>'
         # cap (left part, slightly larger)
         f'<rect x="{x0 - D*0.02:.1f}" y="{y0 - D*0.03:.1f}" width="{cap_len + D*0.02:.1f}" height="{D*1.06:.1f}" rx="{r*1.06:.1f}" fill="url(#{p}cc)"/>'
         f'<rect x="{seam - D*0.05:.1f}" y="{y0 - D*0.03:.1f}" width="{D*0.07:.1f}" height="{D*1.06:.1f}" fill="#000" opacity=".06"/>'
         # highlights
         f'<rect x="{x0 + D*0.25:.1f}" y="{y0 + D*0.16:.1f}" width="{L - D*0.5:.1f}" height="{D*0.16:.1f}" rx="{D*0.08:.1f}" fill="#fff" opacity=".75"/>'
         f'<rect x="{x0 + D*0.35:.1f}" y="{y0 + D*0.74:.1f}" width="{L - D*0.7:.1f}" height="{D*0.07:.1f}" rx="{D*0.035:.1f}" fill="#fff" opacity=".25"/>'
         f'</g>')
    return g


def capsule_defs(p):
    return (f'<linearGradient id="{p}cb" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#FBF7F0"/><stop offset=".45" stop-color="#EFE5D3"/>'
            f'<stop offset="1" stop-color="#CDBDA3"/></linearGradient>'
            f'<linearGradient id="{p}cc" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#FFFDF8"/><stop offset=".45" stop-color="#F4ECDF"/>'
            f'<stop offset="1" stop-color="#D3C4AC"/></linearGradient>')


def build_capsule():
    p = "amb-cap-"
    body = capsule(p, 160, 60, 296, 104)
    write("capsule.svg", svg_doc(320, 120, body, capsule_defs(p), "Gelule vegetale"))


# ---------------------------------------------------------------- label front panel
def label_front(p, cx, y0, band_x0, band_x1, label_h=530):
    """Front panel content. cx: centre x, y0: label top."""
    s = []
    # logo lockup
    lock, _ = logo_lockup(p, cx, y0 + 80, 46, INK, anchor="middle")
    s.append(lock)
    s.append(T("TOUT EST ÉCRIT.", cx, y0 + 108, AMBER_DEEP, font="manrope", size=12.5, wght=700,
               tracking=0.24, anchor="middle"))
    s.append(f'<rect x="{cx-80}" y="{y0+126}" width="160" height="1.8" rx=".9" fill="{AMBER}"/>')
    s.append(T("Magnésium", cx, y0 + 198, INK, font="fraunces", size=66, wght=480, opsz=96,
               tracking=-0.01, anchor="middle"))
    s.append(T("bisglycinate", cx, y0 + 250, AMBER_DEEP, font="fraunces-italic", size=52, wght=400,
               opsz=72, anchor="middle"))
    s.append(T("+ VITAMINE B6", cx, y0 + 292, AMBER_DEEP, font="manrope", size=19, wght=800,
               tracking=0.16, anchor="middle"))
    s.append(f'<rect x="{cx-172}" y="{y0+314}" width="344" height="72" rx="14" fill="none" stroke="{AMBER}" stroke-width="1.6"/>')
    s.append(T(f"300{NB}mg de magnésium · 80{NB}% VNR*", cx, y0 + 344, INK, font="manrope", size=17,
               wght=650, anchor="middle"))
    s.append(T(f"1,4{NB}mg de vitamine B6 · 100{NB}% VNR*", cx, y0 + 371, INK, font="manrope", size=17,
               wght=650, anchor="middle"))
    s.append(T("Sans arôme ni édulcorant", cx, y0 + 414, CLAY_DARK, font="manrope", size=14.5, wght=600,
               anchor="middle"))
    # band
    by = y0 + 432
    s.append(f'<rect x="{band_x0}" y="{by}" width="{band_x1-band_x0}" height="{y0+label_h-by}" fill="{AMBER_DEEP}"/>')
    s.append(T("COMPLÉMENT ALIMENTAIRE", cx, by + 27, CREAM, font="manrope", size=13.5, wght=800,
               tracking=0.2, anchor="middle"))
    s.append(T("60 gélules végétales", cx, by + 63, CREAM, font="fraunces", size=31, wght=500, opsz=48,
               anchor="middle"))
    s.append(T(f"3 gélules par jour · *pour 3 gélules (dose journalière)", cx, by + 86, "#E9D6BF",
               font="manrope", size=12.5, wght=600, anchor="middle"))
    return "".join(s)


# ---------------------------------------------------------------- jar
# geometry (viewBox 1000 x 1200)
BX0, BX1 = 222, 778          # body
LX0, LX1 = 258, 742          # lid
NX0, NX1 = 300, 700          # neck
LID_T, LID_B = 140, 300
NECK_T, NECK_B = 292, 318
SHOULDER_T, SHOULDER_E = 306, 388
LAB_T, LAB_B = 424, 954
BODY_B = 1064
CURVE = 9                    # ellipse sag of horizontal edges (camera slightly above)


def body_path():
    return (f"M{NX0} {SHOULDER_T} L{NX1} {SHOULDER_T} "
            f"C{NX1+58} {SHOULDER_T} {BX1} {SHOULDER_T+30} {BX1} {SHOULDER_E} "
            f"L{BX1} {BODY_B-54} C{BX1} {BODY_B-14} {BX1-34} {BODY_B+CURVE} {BX1-90} {BODY_B+CURVE} "
            f"L{BX0+90} {BODY_B+CURVE} C{BX0+34} {BODY_B+CURVE} {BX0} {BODY_B-14} {BX0} {BODY_B-54} "
            f"L{BX0} {SHOULDER_E} C{BX0} {SHOULDER_T+30} {NX0-58} {SHOULDER_T} {NX0} {SHOULDER_T} Z")


def label_path(x0, x1, t, b):
    mid = (x0 + x1) / 2
    return (f"M{x0} {t} Q{mid} {t + 2*CURVE} {x1} {t} L{x1} {b} Q{mid} {b + 2*CURVE} {x0} {b} Z")


def jar_defs(p):
    return (
        # glass: horizontal cylinder shading
        f'<linearGradient id="{p}glass" x1="{BX0}" x2="{BX1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#2E1405"/><stop offset=".07" stop-color="#5E2C0D"/>'
        f'<stop offset=".2" stop-color="#9C4E19"/><stop offset=".32" stop-color="#C26E2A"/>'
        f'<stop offset=".44" stop-color="#A2521B"/><stop offset=".68" stop-color="#7A3A12"/>'
        f'<stop offset=".88" stop-color="#55270B"/><stop offset="1" stop-color="#2A1204"/></linearGradient>'
        f'<linearGradient id="{p}glassv" x1="0" x2="0" y1="{SHOULDER_T}" y2="{BODY_B}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".12" stop-color="#000" stop-opacity="0"/>'
        f'<stop offset=".9" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>'
        f'<linearGradient id="{p}lid" x1="{LX0}" x2="{LX1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#A99C89"/><stop offset=".12" stop-color="#CFC5B6"/>'
        f'<stop offset=".34" stop-color="#EEE8DE"/><stop offset=".46" stop-color="#F7F2EA"/>'
        f'<stop offset=".72" stop-color="#D9D0C2"/><stop offset=".92" stop-color="#B4A794"/>'
        f'<stop offset="1" stop-color="#8F826F"/></linearGradient>'
        f'<linearGradient id="{p}lidv" x1="0" x2="0" y1="{LID_T}" y2="{LID_B}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".08" stop-color="#fff" stop-opacity="0"/>'
        f'<stop offset=".88" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>'
        f'<linearGradient id="{p}lab" x1="{BX0}" x2="{BX1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#3A1C08" stop-opacity=".62"/><stop offset=".1" stop-color="#3A1C08" stop-opacity=".2"/>'
        f'<stop offset=".26" stop-color="#3A1C08" stop-opacity=".03"/><stop offset=".38" stop-color="#fff" stop-opacity=".14"/>'
        f'<stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#3A1C08" stop-opacity=".1"/>'
        f'<stop offset=".93" stop-color="#3A1C08" stop-opacity=".35"/><stop offset="1" stop-color="#3A1C08" stop-opacity=".66"/></linearGradient>'
        f'<linearGradient id="{p}neck" x1="{NX0}" x2="{NX1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#2A1204"/><stop offset=".3" stop-color="#7C3C12"/>'
        f'<stop offset=".5" stop-color="#5C2B0C"/><stop offset="1" stop-color="#1F0D03"/></linearGradient>'
        f'<filter id="{p}soft" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="5"/></filter>'
        f'<filter id="{p}soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>'
        f'<clipPath id="{p}bodyclip"><path d="{body_path()}"/></clipPath>'
        f'<clipPath id="{p}lidclip"><rect x="{LX0}" y="{LID_T}" width="{LX1-LX0}" height="{LID_B-LID_T}" rx="22"/></clipPath>'
        + capsule_defs(p)
        + mark_defs(p)
        + mark_defs(p + "lf-")
    )


def lid_svg(p):
    s = [f'<g id="{p}lidgroup">']
    s.append(f'<rect x="{LX0}" y="{LID_T}" width="{LX1-LX0}" height="{LID_B-LID_T}" rx="22" fill="url(#{p}lid)"/>')
    # cylindrical ribs: denser near the edges
    ribs = []
    n = 70
    r = (LX1 - LX0) / 2
    cx = (LX0 + LX1) / 2
    for i in range(1, n):
        th = -math.pi / 2 + math.pi * i / n
        x = cx + r * math.sin(th)
        op = 0.05 + 0.07 * (1 - math.cos(th))
        ribs.append(f'<rect x="{x-0.9:.1f}" y="{LID_T+26}" width="1.8" height="{LID_B-LID_T-40}" fill="#3B2E20" opacity="{op:.3f}"/>')
    s.append(f'<g clip-path="url(#{p}lidclip)">' + "".join(ribs) + "</g>")
    s.append(f'<rect x="{LX0}" y="{LID_T}" width="{LX1-LX0}" height="{LID_B-LID_T}" rx="22" fill="url(#{p}lidv)"/>')
    # top rim + bottom edge
    s.append(f'<rect x="{LX0+14}" y="{LID_T+7}" width="{LX1-LX0-28}" height="3" rx="1.5" fill="#fff" opacity=".6"/>')
    s.append(f'<rect x="{LX0+6}" y="{LID_T+22}" width="{LX1-LX0-12}" height="2" fill="#5A4A38" opacity=".18"/>')
    s.append(f'<rect x="{LX0+4}" y="{LID_B-16}" width="{LX1-LX0-8}" height="2" fill="#5A4A38" opacity=".2"/>')
    # specular strip
    s.append(f'<rect x="{LX0+120}" y="{LID_T+30}" width="26" height="{LID_B-LID_T-52}" rx="13" fill="#fff" opacity=".45" filter="url(#{p}soft2)"/>')
    s.append("</g>")
    return "".join(s)


def body_svg(p):
    s = []
    bp = body_path()
    # neck
    s.append(f'<rect x="{NX0}" y="{NECK_T}" width="{NX1-NX0}" height="{NECK_B-NECK_T}" rx="6" fill="url(#{p}neck)"/>')
    s.append(f'<path d="{bp}" fill="url(#{p}glass)"/>')
    # contents seen through the glass (top and bottom of label)
    caps = []
    import random
    rnd = random.Random(7)
    for i in range(18):
        x = rnd.uniform(BX0 + 10, BX1 - 10)
        y = rnd.uniform(SHOULDER_T + 38, LAB_T + 6)
        caps.append(capsule(p, x, y, 74, 27, rnd.uniform(-70, 70), 0.16))
    for i in range(20):
        x = rnd.uniform(BX0 + 10, BX1 - 10)
        y = rnd.uniform(LAB_B + 4, BODY_B - 6)
        caps.append(capsule(p, x, y, 74, 27, rnd.uniform(-30, 30), 0.14))
    s.append(f'<g clip-path="url(#{p}bodyclip)" style="mix-blend-mode:screen">' + "".join(caps) + "</g>")
    s.append(f'<path d="{bp}" fill="#7A3A12" opacity=".35"/>')
    s.append(f'<path d="{bp}" fill="url(#{p}glassv)"/>')
    # label
    lp = label_path(BX0, BX1, LAB_T, LAB_B)
    s.append(f'<clipPath id="{p}labclip"><path d="{lp}"/></clipPath>')
    s.append(f'<g clip-path="url(#{p}labclip)">')
    s.append(f'<rect x="{BX0}" y="{LAB_T}" width="{BX1-BX0}" height="{LAB_B-LAB_T+2*CURVE}" fill="#F4ECDF"/>')
    s.append(label_front(p + "lf-", 500, LAB_T + CURVE * 1.2, BX0, BX1, LAB_B - LAB_T + 2 * CURVE))
    s.append(f'<rect x="{BX0}" y="{LAB_T}" width="{BX1-BX0}" height="{LAB_B-LAB_T+2*CURVE}" fill="url(#{p}lab)"/>')
    s.append("</g>")
    # label edges (thin shadow lines)
    s.append(f'<path d="M{BX0} {LAB_T} Q500 {LAB_T+2*CURVE} {BX1} {LAB_T}" fill="none" stroke="#2A1204" stroke-opacity=".25" stroke-width="2"/>')
    # glass speculars
    s.append(f'<g clip-path="url(#{p}bodyclip)">')
    s.append(f'<rect x="266" y="{SHOULDER_E-30}" width="30" height="{BODY_B-SHOULDER_E-30}" rx="15" fill="#fff" opacity=".38" filter="url(#{p}soft)"/>')
    s.append(f'<rect x="279" y="{SHOULDER_E-10}" width="7" height="{BODY_B-SHOULDER_E-80}" rx="3.5" fill="#fff" opacity=".55" filter="url(#{p}soft2)"/>')
    s.append(f'<rect x="728" y="{SHOULDER_E}" width="12" height="{BODY_B-SHOULDER_E-90}" rx="6" fill="#FFD9A8" opacity=".22" filter="url(#{p}soft)"/>')
    s.append(f'<path d="M{NX0+10} {SHOULDER_T+14} C{NX0-30} {SHOULDER_T+18} {BX0+24} {SHOULDER_T+44} {BX0+20} {SHOULDER_E+6}" fill="none" stroke="#FFE2BC" stroke-opacity=".45" stroke-width="7" stroke-linecap="round" filter="url(#{p}soft2)"/>')
    # thick glass base
    s.append(f'<path d="M{BX0+40} {BODY_B-14} Q500 {BODY_B+2*CURVE+6} {BX1-40} {BODY_B-14}" fill="none" stroke="#E79A4B" stroke-opacity=".35" stroke-width="6" filter="url(#{p}soft2)"/>')
    s.append("</g>")
    return "".join(s)


def build_jar():
    p = "amb-jar-"
    defs = jar_defs(p)
    write("packshot.svg", svg_doc(1000, 1200, body_svg(p) + lid_svg(p), defs,
                                  "Ambrel Magnesium bisglycinate + B6, pot de 60 gelules"))
    write("packshot-body.svg", svg_doc(1000, 1200, body_svg(p), defs, "Ambrel, pot sans couvercle"))
    write("packshot-lid.svg", svg_doc(1000, 1200, lid_svg(p), defs, "Ambrel, couvercle"))

    # aesthetic square packshot scene
    q = "amb-sq-"
    sdefs = jar_defs(q) + (
        f'<linearGradient id="{q}bg" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{CREAM}"/><stop offset=".62" stop-color="#EFE3D2"/><stop offset="1" stop-color="#E2D3BF"/></linearGradient>'
        f'<radialGradient id="{q}sun" cx="50%" cy="50%" r="50%">'
        f'<stop offset="0" stop-color="{HONEY}" stop-opacity=".9"/><stop offset=".55" stop-color="{HONEY}" stop-opacity=".35"/>'
        f'<stop offset="1" stop-color="{HONEY}" stop-opacity="0"/></radialGradient>'
        f'<linearGradient id="{q}ped" x1="210" x2="870" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="#B9AC99"/><stop offset=".35" stop-color="#E4DBCE"/><stop offset=".55" stop-color="#EAE2D6"/>'
        f'<stop offset="1" stop-color="#A89A86"/></linearGradient>'
        f'<radialGradient id="{q}shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3A2614" stop-opacity=".45"/>'
        f'<stop offset="1" stop-color="#3A2614" stop-opacity="0"/></radialGradient>'
        f'<filter id="{q}blur20"><feGaussianBlur stdDeviation="18"/></filter>'
        f'<linearGradient id="{q}xtal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="{MIST}"/></linearGradient>'
    )
    scene = [f'<rect width="1080" height="1080" fill="url(#{q}bg)"/>',
             f'<circle cx="560" cy="430" r="360" fill="url(#{q}sun)"/>',
             # pedestal
             f'<rect x="210" y="868" width="660" height="240" fill="url(#{q}ped)"/>',
             f'<ellipse cx="540" cy="868" rx="330" ry="44" fill="#EEE7DC"/>',
             f'<ellipse cx="540" cy="868" rx="330" ry="44" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>',
             f'<ellipse cx="548" cy="874" rx="230" ry="30" fill="url(#{q}shadow)" filter="url(#{q}blur20)"/>']
    sc = 0.72
    tx = 540 - 500 * sc
    ty = 872 - (BODY_B + CURVE) * sc
    scene.append(f'<g transform="translate({tx:.1f} {ty:.1f}) scale({sc})">{body_svg(q)}{lid_svg(q)}</g>')
    # props: two capsules and a small mineral crystal
    scene.append(capsule(q, 300, 893, 104, 38, -12))
    scene.append(capsule(q, 365, 912, 104, 38, 18))
    scene.append(f'<g transform="translate(790 880)">'
                 f'<path d="M-44 6 L-30 -46 L-8 -70 L10 -40 L4 8 Z" fill="url(#{q}xtal)" opacity=".95"/>'
                 f'<path d="M-8 -70 L10 -40 L4 8 L-6 -20 Z" fill="#B7C4CE" opacity=".8"/>'
                 f'<path d="M6 8 L18 -30 L40 -44 L50 -10 L38 10 Z" fill="url(#{q}xtal)" opacity=".9"/>'
                 f'<path d="M40 -44 L50 -10 L38 10 L34 -16 Z" fill="#AEBCC7" opacity=".85"/>'
                 f'<ellipse cx="0" cy="12" rx="62" ry="8" fill="#3A2614" opacity=".12"/></g>')
    write("packshot-square.svg", svg_doc(1080, 1080, "".join(scene), sdefs, "Ambrel, packshot"))


# ---------------------------------------------------------------- label wrap texture
def build_label_wrap():
    p = "amb-wrap-"
    W = 1748   # ~ pi * 556 (body diameter) -> 1:1 with the front view scale
    H = 530
    cx = W / 2
    s = [f'<rect width="{W}" height="{H}" fill="#F4ECDF"/>']
    s.append(label_front(p + "f-", cx, 0, 0, W, H))
    band_y = 432

    def para(text, x, y, width, size=13.5, wght=550, fill=INK, lh=1.42):
        out = []
        for i, line in enumerate(wrap_lines(text, width, font="manrope", size=size, wght=wght)):
            out.append(T(line, x, y + i * size * lh, fill, font="manrope", size=size, wght=wght))
        return "".join(out), y + len(out) * size * lh

    # left panel: composition
    lx = cx - 580 - 220
    s.append(T("Composition", lx, 66, INK, font="fraunces", size=32, wght=500, opsz=48))
    s.append(T("pour 3 gélules (dose journalière)", lx, 92, CLAY_DARK, font="manrope", size=13.5, wght=600))
    ty = 128
    cols = [lx, lx + 190, lx + 360]
    s.append(f'<rect x="{lx}" y="{ty-20}" width="440" height="1.4" fill="{INK}" opacity=".7"/>')
    for i, h in enumerate(["Nutriment", "Par dose journalière", "% VNR*"]):
        s.append(T(h, cols[i], ty, INK, font="manrope", size=12.5, wght=800))
    s.append(f'<rect x="{lx}" y="{ty+12}" width="440" height="1" fill="{INK}" opacity=".35"/>')
    rows = [("Magnésium", f"300{NB}mg", f"80{NB}%"), ("Vitamine B6", f"1,4{NB}mg", f"100{NB}%")]
    for r, row in enumerate(rows):
        yy = ty + 40 + r * 30
        for i, c in enumerate(row):
            s.append(T(c, cols[i], yy, INK, font="manrope", size=14, wght=600))
        s.append(f'<rect x="{lx}" y="{yy+11}" width="440" height="1" fill="{INK}" opacity=".2"/>')
    s.append(T("*VNR : valeurs nutritionnelles de référence.", lx, ty + 118, CLAY_DARK, font="manrope",
               size=12, wght=600))
    txt, _ = para("Ingrédients : bisglycinate de magnésium ; enveloppe de la gélule : "
                  "hydroxypropylméthylcellulose (gélule d’origine végétale) ; vitamine B6 "
                  "(chlorhydrate de pyridoxine).", lx, ty + 160, 440)
    s.append(txt)
    # right panel: usage + precautions
    rx = cx + 580 - 220
    s.append(T("Conseils d’utilisation", rx, 66, INK, font="fraunces", size=28, wght=500, opsz=48))
    txt, y = para("3 gélules par jour, à avaler avec un grand verre d’eau, de préférence au cours d’un repas.",
                  rx, 96, 440)
    s.append(txt)
    s.append(T("Précautions", rx, y + 26, INK, font="fraunces", size=24, wght=500, opsz=48))
    txt, y = para("Ne pas dépasser la dose journalière recommandée. Tenir hors de portée des jeunes enfants. "
                  "Réservé à l’adulte. Un complément alimentaire ne se substitue pas à une alimentation "
                  "variée et équilibrée et à un mode de vie sain. À conserver au sec, à l’abri de la "
                  "chaleur et de la lumière.", rx, y + 52, 440, size=12.8)
    s.append(txt)
    txt, y = para(f"60 gélules végétales · Poids net : 51{NB}g. Lot et date de durabilité minimale : "
                  "voir le fond du pot.", rx, y + 8, 440, size=12.2, fill=CLAY_DARK)
    s.append(txt)
    # band texts on side panels
    s.append(T("Ambrel est une marque fictive créée pour une démonstration · produit non commercialisé",
               lx, band_y + 58, "#E9D6BF", font="manrope", size=12, wght=600))
    lock, _ = logo_lockup(p + "rl-", rx, band_y + 64, 30, CREAM)
    s.append(lock)
    s.append(T("magnésium bisglycinate + vitamine B6", rx + 150, band_y + 58, "#E9D6BF", font="manrope",
               size=13, wght=700))
    defs = mark_defs(p + "f-") + mark_defs(p + "rl-")
    write("label-wrap.svg", svg_doc(W, H, "".join(s), defs, "Ambrel, etiquette deroulee 360 degres"))


if __name__ == "__main__":
    build_logos()
    build_capsule()
    build_jar()
    build_label_wrap()
