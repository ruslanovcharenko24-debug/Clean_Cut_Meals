(async () => {
  for (let i = 0; i < 20 && !document.querySelector('h1'); i++) await new Promise((r) => setTimeout(r, 300));
  const heads = [...document.querySelectorAll('h2,h3,h4')].map((h) => h.innerText.trim()).filter(Boolean);
  const H = new Set(heads);
  const lines = document.body.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
  const sec = (name) => { const i = lines.indexOf(name); if (i < 0) return null; const out = []; for (let j = i + 1; j < lines.length && !H.has(lines[j]); j++) out.push(lines[j]); return out; };
  const allergy = sec('Allergy Advice') || []; const contains = [], may = [];
  for (let k = 0; k + 1 < allergy.length; k += 2) { if (/^contains$/i.test(allergy[k + 1])) contains.push(allergy[k]); else if (/^may contain$/i.test(allergy[k + 1])) may.push(allergy[k]); }
  const LAB = ['Energy', 'Fat', 'of which saturates', 'Carbohydrate', 'of which sugars', 'Fibre', 'Protein', 'Salt'];
  const nl = sec('Nutrition Information'); let nutrition = null;
  if (nl) { const header = []; let k = 0; while (k < nl.length && !LAB.includes(nl[k])) header.push(nl[k++]);
    const rows = []; while (k < nl.length) { if (LAB.includes(nl[k])) { rows.push([nl[k]]); } else if (rows.length) rows[rows.length - 1].push(nl[k]); k++; }
    nutrition = { header, rows }; }
  const cook = heads.find((h) => /cooking|preparation|heating|instructions|how to/i.test(h) && !/cookie|storage|recycl/i.test(h));
  const h1 = [...document.querySelectorAll('h1,h2')].map((h) => h.innerText.trim()).find((t) => /\(\d/.test(t) && !/Storefront/.test(t));
  return JSON.stringify({ url: location.href, title: h1, features: sec('Features'), description: (sec('Description') || []).join(' '), ingredients: (sec('Ingredients') || []).join(' '),
    contains, may_contain: may, allergy_raw: allergy, nutrition, storage: (sec('Storage Guidelines') || []).join(' '), storage_type: (sec('Storage Type') || []).join(' '),
    cooking_heading: cook || null, cooking: cook ? (sec(cook) || []).join(' ') : null,
    image: [...document.images].map((i) => i.src).find((s) => /images\.cdn\.shop\.supervalu\.ie\/detail\//.test(s)) || null, headings: [...H] });
})()
