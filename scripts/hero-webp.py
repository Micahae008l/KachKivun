"""Regenerate the responsive WebP copies of the site photos (run after adding or replacing a photo).

    python scripts/hero-webp.py

Writes <name>-<width>.webp next to each JPG; idf-photo-catalog.ts and features/gibush/photos.ts
pick them up by glob.
"""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "src" / "assets"
# (folder, pattern, widths, quality). The gibush photos sit under a dark layer or fill half the
# screen at most, so they stop at 1280 and compress harder.
SETS = (
    ("hero-slideshow", "slide-*.jpg", (640, 960, 1280, 1920), 72),
    ("gibush", "*.jpg", (640, 1280), 62),
)
# Fine-grained textures shown only as dimmed backdrops: grain costs bytes nobody sees.
QUALITY = {"ripples": 40, "tracks": 40}

for folder, pattern, widths, quality in SETS:
    for jpg in sorted((ASSETS / folder).glob(pattern)):
        im = Image.open(jpg).convert("RGB")
        q = QUALITY.get(jpg.stem, quality)
        # Never upscale: a master narrower than the largest width gets a copy at its own width.
        for w in sorted({min(w, im.width) for w in widths}):
            out = jpg.parent / f"{jpg.stem}-{w}.webp"
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=q, method=6)
            print(f"{folder}/{out.name}: {out.stat().st_size // 1024} KB")
