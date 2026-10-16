"""Makes the fonts the link cards are drawn in (server/og/fonts) from the woff2 files the site ships, so a
card sets type as the page does. opentype.js, which measures and draws the cards' text, reads TrueType (not
woff2), one weight per file. So Inter's variable font is cut at 400 and 700, and each face's Latin and Latin
Extended files are merged into one, letting a card draw any Latin letter the page does. Glyph substitutions
(GSUB: Inter's contextual alternates) are dropped, since opentype.js can't read Inter's; kerning (GPOS)
stays. Run again when public/fonts changes.

    python3 -m pip install --user fonttools brotli
    python3 scripts/card-fonts.py
"""

import pathlib
import tempfile

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "fonts"
OUT = ROOT / "server" / "og" / "fonts"


def ttf(font: TTFont, path: pathlib.Path) -> pathlib.Path:
    font.flavor = None
    if "GSUB" in font:
        del font["GSUB"]
    font.save(path)
    return path


def merge(parts: list[TTFont], name: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        paths = [ttf(f, pathlib.Path(tmp) / f"{i}.ttf") for i, f in enumerate(parts)]
        Merger().merge([str(p) for p in paths]).save(OUT / name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in (400, 700):
        parts = [TTFont(SRC / f"inter-{s}-var.woff2") for s in ("latin", "latin-ext")]
        for f in parts:
            instantiateVariableFont(f, {"wght": weight}, inplace=True)
        merge(parts, f"inter-{weight}.ttf")
    merge([TTFont(SRC / f"ibm-plex-mono-{s}-500.woff2") for s in ("latin", "latin-ext")], "plex-mono-500.ttf")
    for f in sorted(OUT.glob("*.ttf")):
        print(f.relative_to(ROOT), f.stat().st_size)


if __name__ == "__main__":
    main()
