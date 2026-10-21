"""Splits Vazirmatn into a Latin and an Arabic-script subset (variable axes and all OpenType
features kept, weights 400 to 850), so each page first loads only the script it shows.

usage: python scripts/subset-font.py   (needs fonttools and brotli)
"""
from pathlib import Path
from fontTools import subset
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'fonts' / 'Vazirmatn-Variable.woff2'
OUT = ROOT / 'src' / 'static' / 'assets' / 'fonts'

# Keep these ranges in sync with the @font-face rules in src/styles/01-base.css.
RANGES = {
    'Latin': 'U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+200C-200F,U+2010-205E,U+20AC,U+2122,U+2190-2199,U+2212,U+2605,U+2713',
    'Arabic': 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F',
}

for name, ranges in RANGES.items():
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(str(SRC), opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(ranges))
    s.subset(font)
    # The site uses weights 400 to 850 only.
    font = instancer.instantiateVariableFont(font, {'wght': (400, 850)})
    out = OUT / f'Vazirmatn-{name}.woff2'
    font.flavor = 'woff2'
    font.save(str(out))
    print(out.name, out.stat().st_size)
