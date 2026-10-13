"""Build data/catalog.json from SuperValu card captures (data/sources/supervalu-cards-2026-10-13.json),
download each official pack image and make a trimmed copy (white background only).
Usage: python3 scripts/build-catalog.py"""
import json, re, subprocess
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CARDS = json.loads((ROOT / 'data/sources/supervalu-cards-2026-10-13.json').read_text())
CAT = {
    'meals': ['1934793000', '1934808000', '1934813000', '1934860000', '1934867000', '1934872000', '1934904000', '1955749000', '1955758000', '1955838000', '2008382000', '2026761000', '2026763000', '2026815000'],
    'fakeaway': ['1934876000', '2008367000', '2008355000', '2026792000', '2008333000'],
    'protein-pots': ['2002847000', '2026768000', '2002848000', '2026777000'],
    'breakfast': ['1956937000', '1956942000', '1954317001', '1954317000'],
    'ice-cream': ['2008637000', '2008637002', '2008637001'],
}
KEEP_SLUG = {'1955758000': 'butter-chicken', '1934793000': 'beef-stroganoff', '1934872000': 'spaghetti-bolognese'}
LAB = {'Energy': 'kcal', 'Fat': 'Fat', 'of which saturates': 'of which saturates', 'Carbohydrate': 'Carbohydrate',
       'of which sugars': 'of which sugars', 'Fibre': 'Fibre', 'Protein': 'Protein', 'Salt': 'Salt'}
GENERIC = 'A decade ago, Clean Cut Meals began'
cat_of = {i: k for k, ids in CAT.items() for i in ids}

def slugify(t):
    t = re.sub(r'^Clean Cut (Meals )?', '', t); t = re.sub(r'\s*\(.*?\)\s*$', '', t)
    return re.sub(r'[^a-z0-9]+', '-', t.lower().replace('&', 'and')).strip('-')

out = []
for c in CARDS:
    pid = re.search(r'id-(\d+)', c['url']).group(1)
    title = c['title']; size = re.search(r'\((\d+)\s*(g|ml)\)\s*$', title)
    n = c['nutrition']; ncol = len(n['rows'][-1]) - 1; cols = [h.strip(': ') for h in n['header'][-ncol:]]
    nutr = {}
    for row in n['rows']:
        key = LAB[row[0]]; vals = row[1:]
        if row[0] == 'Energy':  # kJ values first, then kcal
            nutr['kJ'] = vals[:ncol]; vals = vals[ncol:2 * ncol]
        nutr[key] = vals
    feats = c['features'] or []
    desc = next((f for f in feats if len(f) > 40), None) or (None if c['description'].startswith(GENERIC) else c['description'] or None)
    ready = next((f for f in feats if re.match(r'ready in', f, re.I)), None)
    slug = KEEP_SLUG.get(pid) or slugify(title)
    out.append({
        'id': pid, 'slug': slug, 'category': cat_of[pid], 'official_name': title,
        'size': f'{size.group(1)} {size.group(2)}', 'size_unit': size.group(2),
        'description': desc, 'card_claims': feats, 'ready_claim': ready,
        'ingredients': c['ingredients'] or None,
        'allergens': {'contains': c['contains'], 'may_contain': c['may_contain']},
        'nutrition_columns': cols, 'nutrition': nutr,
        'storage': c['storage'] or None, 'storage_type': c['storage_type'].replace('Type ', '') or None,
        'cooking_instructions': None,
        'origin_statements': re.findall(r'Irish [A-Z][a-z]+(?: [A-Z][a-z]+)? \(\d+%\)', c['ingredients'] or ''),
        'card_url': f"https://shop.supervalu.ie/sm/delivery/rsid/5550/product/{c['url'].split('/product/')[1]}",
        'image': {'source_url': f'https://images.cdn.shop.supervalu.ie/{pid}_1', 'file': f'assets/products/supervalu/{slug}_{pid}_1.jpg',
                  'trimmed': f'assets/products/supervalu-trimmed/{slug}.jpg'},
        'source': {'type': 'SuperValu product card', 'captured': '2026-10-13', 'listing': 'https://shop.supervalu.ie/sm/delivery/rsid/5550/clean-cut-bundles'},
        'gaps': [g for g, v in [('ingredients', c['ingredients']), ('description', desc), ('storage', c['storage'])] if not v] + ['cooking instructions'],
    })

for p in out:
    f = ROOT / p['image']['file']
    if not f.exists():
        subprocess.run(['curl', '-sfL', '-m', '60', '-o', str(f), p['image']['source_url']], check=True)
    t = ROOT / p['image']['trimmed']
    if not t.exists():
        im = Image.open(f).convert('RGB'); a = np.asarray(im)
        m = a.min(axis=2) < 235; rows = np.where(m.sum(axis=1) > 3)[0]; cols = np.where(m.sum(axis=0) > 3)[0]
        box = (max(0, cols[0] - 12), max(0, rows[0] - 12), min(im.width, cols[-1] + 13), min(im.height, rows[-1] + 13))
        im.crop(box).save(t, 'JPEG', quality=92)
    p['image']['size_px'] = list(Image.open(f).size)

(ROOT / 'data/catalog.json').write_text(json.dumps({'data_date': '2026-10-13', 'source': 'SuperValu Online, Clean Cut listing (rsid 5550)',
    'not_found': [{'name': 'Southern Fried Chicken & Mash', 'note': 'In the user snapshot (31 items) but not in the SuperValu listing or search on 2026-10-13'}],
    'products': out}, ensure_ascii=False, indent=1) + '\n')
print('products', len(out), {k: len(v) for k, v in CAT.items()}, 'slugs unique', len({p['slug'] for p in out}) == len(out))
