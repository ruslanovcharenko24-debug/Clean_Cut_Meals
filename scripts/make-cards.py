"""Share card per meal: one 1200×630 image used as the link preview (og:image).

Usage: python3 scripts/make-cards.py
Writes public/cards/<slug>-share.jpg. No QR, no printed URL: the link travels with the message.
Layout is HTML/CSS (Lexend, brand colours) rendered by the local Google Chrome; QR by OpenCV. No installs.
Figures come only from data/products.json; the pack photo file is used unchanged (only its white margin is cropped by CSS).
"""
import base64
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT = ROOT / 'public' / 'cards'

SHORT_NAME = {'butter-chicken': 'Butter Chicken', 'beef-stroganoff': 'Beef Stroganoff', 'spaghetti-bolognese': 'Spaghetti Bolognese'}
BAND = {'butter-chicken': '#FFBD83', 'beef-stroganoff': '#FFA0D0', 'spaghetti-bolognese': '#E4B8D9'}
EXPECTED = {  # brief of 13 Oct 2026; a mismatch with products.json stops that card
    'beef-stroganoff': ('37g', '485kcal', '400 g'),
    'spaghetti-bolognese': ('33g', '480kcal', '400 g'),
    'butter-chicken': ('52g', '524kcal', '400 g'),
}


def data_uri(path: Path, mime: str) -> str:
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


FONT_CSS = """
@font-face { font-family: Lexend; font-weight: 400 700; font-display: block; src: url(FONT) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
html, body { width: W; height: H; overflow: hidden; }
body { font-family: Lexend, sans-serif; color: #24014C; background: #fff; -webkit-font-smoothing: antialiased; }
.pack { display: block; object-fit: contain; object-position: 50% 50%; }
.name { font-weight: 700; text-transform: uppercase; line-height: .95; letter-spacing: -.01em; }
.num { font-weight: 700; line-height: 1; letter-spacing: -.02em; }
.unit { font-weight: 700; }
.lbl { font-weight: 500; }
"""


def og_html(p, c) -> str:
    return f"""<!doctype html><meta charset="utf-8"><style>{FONT_CSS.replace('W', '1200px').replace('H', '630px').replace('FONT', c['font'])}
body {{ display: grid; grid-template-columns: 600px 600px; }}
.left {{ position: relative; background: #fff; }}
.logo {{ position: absolute; left: 48px; top: 40px; width: 190px; }}
.left .pack {{ position: absolute; left: 50px; top: 118px; width: 520px; height: 460px; }}
.right {{ background: {c['band']}; padding: 0 56px 0 44px; display: flex; flex-direction: column; justify-content: center; }}
.name {{ font-size: {c['name_px']}px; }}
.stats {{ margin-top: 34px; display: grid; gap: 14px; }}
.stat {{ display: flex; align-items: baseline; gap: 14px; background: #fff; border-radius: 18px; padding: 16px 22px; width: fit-content; }}
.stat .num {{ font-size: 76px; }}
.stat .unit {{ font-size: 40px; }}
.stat .lbl {{ font-size: 28px; }}
.pack-w {{ margin-top: 18px; font-size: 28px; font-weight: 600; }}
</style>
<div class="left"><img class="logo" src="{c['logo']}" alt=""><img class="pack" src="{c['pack']}" alt=""></div>
<div class="right">
  <div class="name">{c['name']}</div>
  <div class="stats">
    <div class="stat"><span class="num">{c['protein']}</span><span class="unit">g</span><span class="lbl">protein</span></div>
    <div class="stat"><span class="num">{c['kcal']}</span><span class="unit">kcal</span></div>
  </div>
  <div class="pack-w">{c['weight']} pack</div>
</div>"""


def render(html: str, size: tuple[int, int], out_jpg: Path, tmp: Path) -> None:
    page = tmp / (out_jpg.stem + '.html')
    png = tmp / (out_jpg.stem + '.png')
    page.write_text(html, encoding='utf-8')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--window-size={size[0]},{size[1]}', '--virtual-time-budget=3000', f'--screenshot={png}',
                    '--user-data-dir=' + str(tmp / 'profile'), page.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    img = Image.open(png).convert('RGB')
    assert img.size == size, (out_jpg.name, img.size)
    img.save(out_jpg, 'JPEG', quality=88, optimize=True, progressive=True)


def short_name(p):
    return SHORT_NAME.get(p['slug']) or re.sub(r'\s*\(.*?\)\s*$', '', re.sub(r'^Clean Cut (Meals )?', '', p['official_name']))


def main() -> None:
    products = json.loads((ROOT / 'data/catalog.json').read_text())['products']
    legacy = {p['slug']: p for p in json.loads((ROOT / 'data/products.json').read_text())['products']}
    font = data_uri(ROOT / 'src/assets/fonts/lexend-latin.woff2', 'font/woff2')
    logo = data_uri(ROOT / 'assets/brand/ccm-logo.png', 'image/png')
    OUT.mkdir(parents=True, exist_ok=True)
    ok = True
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for p in products:
            slug = p['slug']; n = p['nutrition']
            protein = n['Protein'][-1]; kcal = n['kcal'][-1]
            if slug in EXPECTED and (protein, kcal, p['size']) != EXPECTED[slug]:  # cross-check the three original meals
                print(f'STOP {slug}: catalog {(protein, kcal, p["size"])} != {EXPECTED[slug]}'); ok = False; continue
            c = {'font': font, 'logo': logo, 'band': BAND.get(slug, '#E0A0C9'),
                 'pack': data_uri(ROOT / p['image']['trimmed'], 'image/jpeg'), 'name': short_name(p), 'name_px': 56 if len(short_name(p)) <= 26 else 44,
                 'protein': protein.removesuffix('g'), 'kcal': kcal.removesuffix('kcal'), 'weight': p['size']}
            render(og_html(p, c), (1200, 630), OUT / f'{slug}-share.jpg', tmp)
        print('cards written', len(list(OUT.glob('*-share.jpg'))))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
