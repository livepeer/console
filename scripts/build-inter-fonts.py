#!/usr/bin/env python3
"""Vendor and subset Inter, and generate app/fonts.css.

Inter comes from the typeface author's own distribution (https://rsms.me/inter/).
We self-host rather than CDN-link it: the font then preloads over the connection
that already delivered the HTML instead of waiting on a third-party stylesheet
round-trip, and browser HTTP caches are partitioned per-site anyway, so a shared
CDN buys no cross-site cache reuse.

Two roman faces are served:

  InterVariable-latin.woff2  ~107 KB  latin + the UI symbols the console draws
  InterVariable.woff2         344 KB  the full unmodified file, demand-loaded
                                      only for non-Latin text (user display
                                      names, org names)

The `unicode-range` of each face is derived from the *actual cmap of the built
file*, never hand-written. That matters more than it sounds: declaring a
codepoint on the fallback face that Inter does not contain makes a browser
download all 344 KB, discover the glyph is missing, and only then fall through
to a system font. The console's `✕` (U+2715) and `▾` (U+25BE) are exactly that
case — absent from Inter entirely — and a hand-written blanket range billed
every visitor 344 KB for them.

Usage:
    python3 scripts/build-inter-fonts.py            # fetch, subset, generate
    python3 scripts/build-inter-fonts.py --check     # verify only, no network

Requires fontTools, deliberately *not* a package.json dependency — this is run
by hand when bumping Inter and its output is committed:

    python3 -m pip install 'fonttools[woff]'
"""

from __future__ import annotations

import collections
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata

VERSION = "4.1"
BASE = "https://rsms.me/inter/font-files"
LICENSE_URL = f"https://raw.githubusercontent.com/rsms/inter/v{VERSION}/LICENSE.txt"

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "public" / "fonts"
CSS_OUT = ROOT / "app" / "fonts.css"

# The "latin" block, matching Google Fonts' well-tested range.
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)

# UI symbols the console draws in sans context. Deliberately wider than current
# usage (both arrow directions, Mac modifier keys, comparison operators) so
# routine UI work doesn't push a glyph onto the 344 KB fallback. Anything Inter
# doesn't actually have is silently skipped by the subsetter, which is fine.
SYMBOLS = (
    "U+0394,U+2190-2193,U+21B5,U+21E7,U+2303,U+2318,U+2325,U+232B,"
    "U+238B,U+2260,U+2264-2265,U+25B2-25BE,U+25C0-25C4,U+2713-2717,U+221E"
)

SOURCE_ROOTS = ("app", "components", "lib")
SOURCE_SUFFIXES = {".tsx", ".ts", ".css"}


# ── helpers ──────────────────────────────────────────────────────────────────


def cmap(path: pathlib.Path) -> set[int]:
    from fontTools.ttLib import TTFont

    return set(TTFont(path).getBestCmap())


def to_ranges(codepoints: set[int]) -> list[tuple[int, int]]:
    """Collapse codepoints into exact contiguous ranges — no gap tolerance."""
    cps = sorted(codepoints)
    ranges: list[tuple[int, int]] = []
    start = prev = cps[0]
    for c in cps[1:]:
        if c != prev + 1:
            ranges.append((start, prev))
            start = c
        prev = c
    ranges.append((start, prev))
    return ranges


def format_range(ranges: list[tuple[int, int]], indent: str = "    ") -> str:
    parts = [
        f"U+{lo:04X}" if lo == hi else f"U+{lo:04X}-{hi:04X}" for lo, hi in ranges
    ]
    lines, current = [], indent
    for i, part in enumerate(parts):
        piece = part + ("," if i < len(parts) - 1 else "")
        if len(current) + len(piece) + 1 > 79:
            lines.append(current.rstrip())
            current = indent
        current += piece + " "
    lines.append(current.rstrip())
    return "\n".join(lines)


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", text)


# ── steps ────────────────────────────────────────────────────────────────────


def download(url: str, dest: pathlib.Path) -> None:
    # curl rather than urllib: some Python installs ship without a usable CA
    # bundle, and this script should not need a venv to run.
    subprocess.run(["curl", "-fsS", url, "-o", str(dest)], check=True)


def fetch(tmp: pathlib.Path) -> None:
    print(f"→ fetching Inter v{VERSION} from rsms.me")
    for name in ("InterVariable.woff2", "InterVariable-Italic.woff2"):
        download(f"{BASE}/{name}?v={VERSION}", tmp / name)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    download(LICENSE_URL, FONT_DIR / "OFL.txt")
    # The fallback is the pristine distribution file, copied not subset.
    shutil.copy(tmp / "InterVariable.woff2", FONT_DIR / "InterVariable.woff2")


def subset(src: pathlib.Path, dest: pathlib.Path) -> None:
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(src),
            f"--output-file={dest}",
            "--flavor=woff2",
            f"--unicodes={LATIN},{SYMBOLS}",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )


def generate_css() -> None:
    full = cmap(FONT_DIR / "InterVariable.woff2")
    latin = cmap(FONT_DIR / "InterVariable-latin.woff2")
    italic = cmap(FONT_DIR / "InterVariable-Italic-latin.woff2")
    fallback = full - latin

    css = f'''/* GENERATED by scripts/build-inter-fonts.py — do not edit by hand.
 *
 * Inter v{VERSION}, self-hosted from https://rsms.me/inter/ (OFL, see
 * public/fonts/OFL.txt). Every `unicode-range` below is derived from the actual
 * cmap of the file it points at, so no face can ever advertise a glyph it does
 * not contain — see the module docstring in the generator for why that would
 * cost every visitor a needless 344 KB.
 *
 * The two roman ranges are disjoint by construction, so declaration order here
 * carries no meaning.
 */

/* Latin + the UI symbols the console draws. The fast path: preloaded in
 * app/layout.tsx and the only sans face most sessions ever fetch. */
@font-face {{
  font-family: InterVariable;
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/InterVariable-latin.woff2") format("woff2");
  unicode-range:
{format_range(to_ranges(latin))};
}}

/* The full unmodified distribution file. Demand-loaded only when a page
 * actually renders Greek, Cyrillic, Vietnamese or Latin-Extended — in practice
 * a non-Latin user display name or org name. */
@font-face {{
  font-family: InterVariable;
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/InterVariable.woff2") format("woff2");
  unicode-range:
{format_range(to_ranges(fallback))};
}}

/* True italic, latin only. The console renders no italics today, so this is
 * never fetched; it exists so a future `<em>` gets Inter's real italic
 * letterforms rather than a synthesised oblique. Non-Latin italic falls back to
 * a synthesised oblique of the roman, which is the graceful outcome. */
@font-face {{
  font-family: InterVariable;
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/InterVariable-Italic-latin.woff2") format("woff2");
  unicode-range:
{format_range(to_ranges(italic))};
}}
'''
    CSS_OUT.write_text(css, encoding="utf-8")
    print(f"→ wrote {CSS_OUT.relative_to(ROOT)}")


def check() -> int:
    """Report any sans-context glyph that would miss the preloaded subset."""
    latin = cmap(FONT_DIR / "InterVariable-latin.woff2")
    full = cmap(FONT_DIR / "InterVariable.woff2")

    on_fallback: collections.Counter[str] = collections.Counter()
    not_in_inter: collections.Counter[str] = collections.Counter()
    where: dict[str, str] = {}

    for root in SOURCE_ROOTS:
        for path in (ROOT / root).rglob("*"):
            if path.suffix not in SOURCE_SUFFIXES:
                continue
            for ch in strip_comments(path.read_text(encoding="utf-8", errors="replace")):
                cp = ord(ch)
                if cp <= 0x7F or cp in latin:
                    continue
                bucket = on_fallback if cp in full else not_in_inter
                bucket[ch] += 1
                where.setdefault(ch, str(path.relative_to(ROOT)))

    def describe(ch: str) -> str:
        try:
            name = unicodedata.name(ch)
        except ValueError:
            name = "?"
        return f"U+{ord(ch):04X} {ch}  {name}  ({where[ch]})"

    if not_in_inter:
        print("\n  note — not present in Inter at any weight, so these render in a")
        print("  system fallback font. Costs no download; listed for awareness:")
        for ch, _ in not_in_inter.most_common():
            print(f"    {describe(ch)}")

    if on_fallback:
        print("\n✗ these live in Inter but outside the subset, so each one forces")
        print("  the 344 KB fallback download on every page that renders it:")
        for ch, _ in on_fallback.most_common():
            print(f"    {describe(ch)}")
        print("\n  → add them to SYMBOLS in this script and re-run it")
        return 1

    print("\n✓ no sans-context glyph forces the 344 KB fallback")
    return 0


def main() -> int:
    if "--check" not in sys.argv:
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td)
            fetch(tmp)
            print("→ subsetting")
            subset(tmp / "InterVariable.woff2", FONT_DIR / "InterVariable-latin.woff2")
            subset(
                tmp / "InterVariable-Italic.woff2",
                FONT_DIR / "InterVariable-Italic-latin.woff2",
            )
        generate_css()
        print()
        print(f"{'FILE':<38}{'SIZE':>9}")
        for f in sorted(FONT_DIR.glob("*.woff2")):
            print(f"{f.name:<38}{f.stat().st_size / 1024:>6.1f} KB")

    return check()


if __name__ == "__main__":
    raise SystemExit(main())
