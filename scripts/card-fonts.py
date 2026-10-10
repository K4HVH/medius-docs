"""The fonts the link cards are drawn in (server/og/fonts), made from the woff2 files the site ships, so a
card sets type exactly as the page does. resvg reads TrueType, not woff2, and takes one weight per file:
Inter's variable font is cut at 400 and 700. Their glyph substitutions (GSUB: Inter's contextual
alternates) are dropped, so a card's text is set glyph for glyph, the width measured is the width drawn,
and opentype.js, which can't read Inter's GSUB, measures it. Kerning (GPOS) stays. Run again when
public/fonts changes.

    python3 -m pip install --user fonttools brotli
    python3 scripts/card-fonts.py
"""

import pathlib

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "fonts"
OUT = ROOT / "server" / "og" / "fonts"


def save(font: TTFont, name: str) -> None:
    font.flavor = None
    if "GSUB" in font:
        del font["GSUB"]
    font.save(OUT / name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in (400, 700):
        font = TTFont(SRC / "inter-latin-var.woff2")
        instantiateVariableFont(font, {"wght": weight}, inplace=True)
        save(font, f"inter-{weight}.ttf")
    save(TTFont(SRC / "ibm-plex-mono-latin-500.woff2"), "plex-mono-500.ttf")
    for f in sorted(OUT.glob("*.ttf")):
        print(f.relative_to(ROOT), f.stat().st_size)


if __name__ == "__main__":
    main()
