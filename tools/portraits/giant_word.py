"""
The hero's giant outlined word as SVG paths (Phase 19), so it renders exactly like the site's display type but is
not text: an SVG <text> that big becomes the page's Largest Contentful Paint element, and the hero portrait must be.

    python tools/portraits/giant_word.py ENTREPRENEUR

Reads the site's own Bricolage Grotesque (node_modules/@fontsource-variable/bricolage-grotesque, the latin file the
site loads), sets it like .hero-giant (weight 700, the optical size at 100 px, letter-spacing -0.02em, with the
font's kerning) and writes src/lib/giant-word.json: { "d": path data, "width", "height", "baseline" } in units of a
100 px font size.
"""
import json
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONT = os.path.join(ROOT, "node_modules", "@fontsource-variable", "bricolage-grotesque", "files", "bricolage-grotesque-latin-opsz-normal.woff2")
OUT = os.path.join(ROOT, "src", "lib", "giant-word.json")
SIZE = 100.0
TRACKING = -0.02  # em


def kerning(font):
    """Pair kerning from GPOS (format 1 and 2 pair adjustments), in font units."""
    pairs = {}
    if "GPOS" not in font:
        return lambda a, b: 0
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, "LookupType", lookup.LookupType) != 2:
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for i, first in enumerate(cov):
                    for rec in st.PairSet[i].PairValueRecord:
                        v = rec.Value1.XAdvance if rec.Value1 and hasattr(rec.Value1, "XAdvance") else 0
                        pairs.setdefault((first, rec.SecondGlyph), v)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs
                c2 = st.ClassDef2.classDefs
                for first in cov:
                    k1 = c1.get(first, 0)
                    row = st.Class1Record[k1].Class2Record
                    for second, k2 in list(c2.items()):
                        v = row[k2].Value1.XAdvance if row[k2].Value1 and hasattr(row[k2].Value1, "XAdvance") else 0
                        if v:
                            pairs.setdefault((first, second), v)
    return lambda a, b: pairs.get((a, b), 0)


def main(word):
    font = TTFont(FONT)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes}
    loc = {}
    if "wght" in axes:
        loc["wght"] = min(max(700, axes["wght"][0]), axes["wght"][1])
    if "opsz" in axes:
        loc["opsz"] = min(max(SIZE, axes["opsz"][0]), axes["opsz"][1])
    font = instantiateVariableFont(font, loc)
    upm = font["head"].unitsPerEm
    scale = SIZE / upm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]
    kern = kerning(font)
    pen = SVGPathPen(glyphs)
    x = 0.0
    names = [cmap[ord(c)] for c in word]
    for i, name in enumerate(names):
        # font units → px, y flipped (SVG y grows down), baseline at y = 0
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        x += hmtx[name][0] * scale + TRACKING * SIZE
        if i + 1 < len(names):
            x += kern(name, names[i + 1]) * scale
    width = x - TRACKING * SIZE  # no tracking after the last letter
    ascent = font["OS/2"].sCapHeight * scale if hasattr(font["OS/2"], "sCapHeight") else 0.72 * SIZE
    data = {"word": word, "d": pen.getCommands(), "width": round(width, 2), "capHeight": round(ascent, 2), "font": f"Bricolage Grotesque {loc}"}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f)
        f.write("\n")
    print(f"{word}: width {width:.1f}, cap height {ascent:.1f} at {SIZE:.0f}px, {len(data['d'])} chars of path data, {loc}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ENTREPRENEUR")
