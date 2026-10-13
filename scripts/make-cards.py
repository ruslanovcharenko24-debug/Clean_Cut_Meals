"""Meal cards for sharing: 1200×630 link preview and 1080×1920 story card per meal.

Usage: python3 scripts/make-cards.py https://ruslanovcharenko24-debug.github.io/Clean_Cut_Meals
Writes public/cards/<slug>-og.jpg and public/cards/<slug>-story.jpg, then decodes each story QR.
Layout is HTML/CSS (Lexend, brand colours) rendered by the local Google Chrome; QR by OpenCV. No installs.
Figures come only from data/products.json; the pack photo file is used unchanged (only its white margin is cropped by CSS).
"""
import base64
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
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


def qr_png(text: str, path: Path) -> None:
    params = cv2.QRCodeEncoder_Params()
    params.correction_level = cv2.QRCodeEncoder_CORRECT_LEVEL_M
    m = cv2.QRCodeEncoder.create(params).encode(text)
    ys, xs = np.where(m == 0)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    m = np.pad(m, 4, constant_values=255)  # 4-module quiet zone
    scale = max(1, 600 // m.shape[0])
    cv2.imwrite(str(path), np.kron(m, np.ones((scale, scale), dtype=np.uint8)))


FONT_CSS = """
@font-face { font-family: Lexend; font-weight: 400 700; font-display: block; src: url(FONT) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
html, body { width: W; height: H; overflow: hidden; }
body { font-family: Lexend, sans-serif; color: #24014C; background: #fff; -webkit-font-smoothing: antialiased; }
.pack { display: block; object-fit: cover; object-position: 50% 50%; aspect-ratio: 5 / 4; }
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
.left .pack {{ position: absolute; left: 50px; top: 118px; width: 520px; }}
.right {{ background: {c['band']}; padding: 52px 56px 0 44px; position: relative; }}
.name {{ font-size: 64px; }}
.stats {{ margin-top: 34px; display: grid; gap: 14px; }}
.stat {{ display: flex; align-items: baseline; gap: 14px; background: #fff; border-radius: 18px; padding: 16px 22px; width: fit-content; }}
.stat .num {{ font-size: 76px; }}
.stat .unit {{ font-size: 40px; }}
.stat .lbl {{ font-size: 28px; }}
.pack-w {{ margin-top: 18px; font-size: 26px; font-weight: 600; }}
.url {{ position: absolute; left: 44px; right: 40px; bottom: 30px; font-size: 19px; font-weight: 500; line-height: 1.3; }}
</style>
<div class="left"><img class="logo" src="{c['logo']}" alt=""><img class="pack" src="{c['pack']}" alt=""></div>
<div class="right">
  <div class="name">{c['name']}</div>
  <div class="stats">
    <div class="stat"><span class="num">{c['protein']}</span><span class="unit">g</span><span class="lbl">protein</span></div>
    <div class="stat"><span class="num">{c['kcal']}</span><span class="unit">kcal</span></div>
  </div>
  <div class="pack-w">Per {c['weight']} pack</div>
  <div class="url">{c['url_short_html']}</div>
</div>"""


def story_html(p, c) -> str:
    return f"""<!doctype html><meta charset="utf-8"><style>{FONT_CSS.replace('W', '1080px').replace('H', '1920px').replace('FONT', c['font'])}
.top {{ height: 980px; background: #fff; position: relative; }}
.logo {{ position: absolute; left: 80px; top: 170px; width: 300px; }}
.tag {{ position: absolute; right: 80px; top: 184px; font-size: 26px; font-weight: 500; color: #4a3a63;
        border: 2px solid #c9bfd6; border-radius: 999px; padding: 6px 18px; }}
.top .pack {{ position: absolute; left: 110px; top: 272px; width: 860px; }}  /* 5:4 → 688 px tall, ends above the band */
.bottom {{ height: 940px; background: {c['band']}; padding: 44px 80px 0; }}
.name {{ font-size: 112px; }}
.stats {{ margin-top: 40px; display: grid; grid-template-columns: 1.1fr 1.1fr .8fr; gap: 20px; }}
.stat {{ background: #fff; border-radius: 28px; padding: 26px 26px 22px; }}
.stat .num {{ font-size: 96px; }}
.stat .unit {{ font-size: 44px; }}
.stat .lbl {{ display: block; margin-top: 8px; font-size: 30px; }}
.stat.small .num {{ font-size: 64px; }}
.qr {{ margin-top: 36px; display: grid; grid-template-columns: 270px 1fr; gap: 34px; align-items: center;
       background: #fff; border-radius: 28px; padding: 26px; }}
.qr img {{ width: 270px; height: 270px; image-rendering: pixelated; display: block; }}
.qr-h {{ font-size: 40px; font-weight: 700; line-height: 1.12; }}
.qr-u {{ margin-top: 14px; font-size: 24px; font-weight: 500; line-height: 1.3; color: #4a3a63; }}
</style>
<div class="top"><img class="logo" src="{c['logo']}" alt=""><span class="tag">Student concept</span><img class="pack" src="{c['pack']}" alt=""></div>
<div class="bottom">
  <div class="name">{c['name']}</div>
  <div class="stats">
    <div class="stat"><span class="num">{c['protein']}</span> <span class="unit">g</span><span class="lbl">protein</span></div>
    <div class="stat"><span class="num">{c['kcal']}</span><span class="lbl">kcal</span></div>
    <div class="stat small"><span class="num">{c['weight_num']}</span> <span class="unit">g</span><span class="lbl">pack</span></div>
  </div>
  <div class="qr"><img src="{c['qr']}" alt="">
    <div><div class="qr-h">Scan for details &amp; ordering options</div><div class="qr-u">{c['url_short_html']}</div></div>
  </div>
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


def main(base: str) -> None:
    base = base.rstrip('/')
    products = {p['slug']: p for p in json.loads((ROOT / 'data/products.json').read_text())['products']}
    shorts = json.loads((ROOT / 'data/short-links.json').read_text())['links']
    font = data_uri(ROOT / 'src/assets/fonts/lexend-latin.woff2', 'font/woff2')
    logo = data_uri(ROOT / 'assets/brand/ccm-logo.png', 'image/png')
    OUT.mkdir(parents=True, exist_ok=True)
    ok = True
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for slug, p in products.items():
            got = (p['nutrition']['Protein']['per_pack'], p['nutrition']['kcal']['per_pack'], p['weight'])
            if got != EXPECTED[slug]:
                print(f'STOP {slug}: products.json {got} != brief {EXPECTED[slug]}')
                ok = False
                continue
            short_url = f'{base}/s/{shorts[slug]}/'
            host, path = short_url.split('://', 1)[1].split('/', 1)
            qr_path = tmp / f'{slug}-qr.png'
            qr_png(short_url, qr_path)
            c = {
                'font': font, 'logo': logo, 'band': BAND[slug],
                'pack': data_uri(ROOT / p['image']['file'], 'image/jpeg'),
                'qr': data_uri(qr_path, 'image/png'),
                'name': SHORT_NAME[slug],
                'protein': got[0].removesuffix('g'), 'kcal': got[1].removesuffix('kcal'),
                'weight': got[2], 'weight_num': got[2].removesuffix(' g'),
                'url_short_html': f'{host}/<br>{path.rstrip("/")}',
            }
            render(og_html(p, c), (1200, 630), OUT / f'{slug}-og.jpg', tmp)
            story = OUT / f'{slug}-story.jpg'
            render(story_html(p, c), (1080, 1920), story, tmp)
            decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(str(story)))
            match = decoded == short_url
            ok &= match
            print(f'{slug}: og + story written; story QR decodes to {decoded!r} match={match}')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main(sys.argv[1])
