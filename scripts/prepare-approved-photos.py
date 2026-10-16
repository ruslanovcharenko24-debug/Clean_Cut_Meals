#!/usr/bin/env python3
"""Web copies of the approved pack pictures (Google Drive folder "Clean Cut Pictures", 16.10.2026).

Usage: python3 scripts/prepare-approved-photos.py <folder with the 30 PNG + manifest.json>

- Matches files to the catalogue by product_id AND slug from manifest.json (the PNG numbers are not an order).
- Stops if a file is missing, its size or SHA-256 differs from the manifest, or the product is unknown.
- Only crops the empty white background (pixels lighter than 235 in every channel), keeps a 12 px margin,
  never resizes or retouches; fully opaque alpha is dropped. JPEG q95 without chroma subsampling, so the
  printed QR heart keeps sharp edges. Astro makes the smaller AVIF/WebP sizes from these at build time.
- Writes assets/products/approved-2026-10-16/<slug>.jpg and data/approved-photos-2026-10-16.json.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'assets/products/approved-2026-10-16'
RECORD = ROOT / 'data/approved-photos-2026-10-16.json'
WHITE = 235
MARGIN = 12


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(src: Path) -> None:
    manifest = json.loads((src / 'manifest.json').read_text())
    catalog = {p['id']: p for p in json.loads((ROOT / 'data/catalog.json').read_text())['products']}
    if len(manifest) != len(catalog) or {e['product_id'] for e in manifest} != set(catalog):
        sys.exit('manifest does not cover the catalogue one to one')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    records = []
    for e in sorted(manifest, key=lambda e: catalog[e['product_id']]['slug']):
        product = catalog[e['product_id']]
        if product['slug'] != e['slug']:
            sys.exit(f"{e['file']}: slug {e['slug']} != catalogue {product['slug']}")
        path = src / e['file']
        if path.stat().st_size != e['bytes'] or sha256(path) != e['sha256']:
            sys.exit(f"{e['file']}: size or SHA-256 differs from manifest.json")
        im = Image.open(path)
        if im.mode == 'RGBA':
            if im.getchannel('A').getextrema() != (255, 255):
                sys.exit(f"{e['file']}: has transparency")
        rgb = im.convert('RGB')
        content = Image.eval(rgb, lambda v: 255 if v < WHITE else 0).convert('L').point(lambda v: 255 if v else 0)
        x0, y0, x1, y1 = content.getbbox()
        box = (max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(rgb.width, x1 + MARGIN), min(rgb.height, y1 + MARGIN))
        out = OUT_DIR / f"{product['slug']}.jpg"
        rgb.crop(box).save(out, 'JPEG', quality=95, subsampling=0, optimize=True)
        records.append({
            'slug': product['slug'], 'product_id': e['product_id'], 'source_file': e['file'],
            'source_sha256': e['sha256'], 'source_px': [rgb.width, rgb.height], 'crop_box': list(box),
            'file': str(out.relative_to(ROOT)), 'px': [box[2] - box[0], box[3] - box[1]], 'sha256': sha256(out),
        })
        print(f"{e['file']:>7} -> {out.relative_to(ROOT)} {box[2] - box[0]}x{box[3] - box[1]}")
    RECORD.write_text(json.dumps({
        'source': 'Google Drive folder "Clean Cut Pictures" (1_y5v5CtrhKoYWhrldqnIQaTu7oh7jkjr), 16.10.2026',
        'processing': f'white background cropped (< {WHITE}), {MARGIN} px margin, no resize, JPEG q95 4:4:4',
        'photos': records,
    }, indent=2, ensure_ascii=False) + '\n')
    print(f'{len(records)} photos')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
