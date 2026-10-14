"""Regenerate the responsive WebP copies of the site photos (run after adding or replacing a slide-N.jpg).

    python scripts/hero-webp.py

Writes slide-N-<width>.webp next to each JPG; idf-photo-catalog.ts picks them up by glob.
"""
from pathlib import Path

from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "hero-slideshow"
WIDTHS = (640, 960, 1280, 1920)

for jpg in sorted(DIR.glob("slide-*.jpg")):
    im = Image.open(jpg).convert("RGB")
    for w in WIDTHS:
        out = DIR / f"{jpg.stem}-{w}.webp"
        h = round(im.height * w / im.width)
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=72, method=6)
        print(f"{out.name}: {out.stat().st_size // 1024} KB")
