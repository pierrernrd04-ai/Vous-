"""Text -> SVG path conversion (HarfBuzz shaping + fontTools pens).

Used by build_brand.py so that logo.svg / packshot.svg / label-wrap.svg contain
no <text> and no font dependency (they render identically as <img>, in canvas,
as WebGL textures or in any SVG viewer).

Requires: fonttools, brotli, uharfbuzz (see brand/src/README section in
tools/README.md for the venv command).
"""
import io
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")

FONT_FILES = {
    "fraunces": "Fraunces-Variable-latin.woff2",
    "fraunces-italic": "Fraunces-Italic-Variable-latin.woff2",
    "manrope": "Manrope-Variable-latin.woff2",
}

_cache = {}


def _load(key):
    if key in _cache:
        return _cache[key]
    tt = TTFont(os.path.join(FONT_DIR, FONT_FILES[key]))
    tt.flavor = None
    buf = io.BytesIO()
    tt.save(buf)
    data = buf.getvalue()
    face = hb.Face(hb.Blob(data))
    cmap = tt.getBestCmap()
    upem = tt["head"].unitsPerEm
    _cache[key] = (face, cmap, upem)
    return _cache[key]


def _fmt(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class _RoundingPen(SVGPathPen):
    def __init__(self):
        super().__init__(None, ntos=_fmt)


def shape(text, font="manrope", size=24, wght=400, opsz=None, tracking=0.0):
    """Return (glyph list, total advance in px). tracking in em."""
    face, cmap, upem = _load(font)
    # Replace characters missing from the subset (e.g. U+202F) by NBSP
    clean = "".join(ch if ord(ch) in cmap else (" " if ch.isspace() else ch) for ch in text)
    hbfont = hb.Font(face)
    var = {"wght": wght}
    if font.startswith("fraunces"):
        var["opsz"] = opsz if opsz is not None else max(9, min(144, size))
    hbfont.set_variations(var)
    buf = hb.Buffer()
    buf.add_str(clean)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    scale = size / upem
    glyphs = []
    x = 0.0
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        glyphs.append((info.codepoint, x + pos.x_offset * scale, pos.y_offset * scale))
        x += pos.x_advance * scale
        if i < n - 1:
            x += tracking * size
    return hbfont, glyphs, x, scale


def text_path(text, x, y, font="manrope", size=24, wght=400, opsz=None,
              tracking=0.0, anchor="start"):
    """SVG path 'd' for text with baseline at y. anchor: start|middle|end."""
    hbfont, glyphs, width, scale = shape(text, font, size, wght, opsz, tracking)
    if anchor == "middle":
        x0 = x - width / 2
    elif anchor == "end":
        x0 = x - width
    else:
        x0 = x
    pen = _RoundingPen()
    for gid, gx, gy in glyphs:
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x0 + gx, y - gy))
        hbfont.draw_glyph_with_pen(gid, tpen)
    return pen.getCommands(), width


def text_width(text, font="manrope", size=24, wght=400, opsz=None, tracking=0.0):
    return shape(text, font, size, wght, opsz, tracking)[2]


def wrap_lines(text, max_width, **kw):
    """Greedy word wrap using real advances."""
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if cur and text_width(trial, **kw) > max_width:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines
