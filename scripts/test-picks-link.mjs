// Round trip and damage tests for the compact list link (src/lib/picks.ts). Run from the project folder:
//   node --experimental-strip-types --no-warnings scripts/test-picks-link.mjs
import { readFileSync } from 'node:fs';
import { encodeLink, decodeLink, viewLink, decodePicks, encodePicks } from '../src/lib/picks.ts';
const P = decodeURIComponent(new URL('..', import.meta.url).pathname);
const cat = JSON.parse(readFileSync(P + 'data/catalog.json')).products;
const codes = JSON.parse(readFileSync(P + 'data/pick-codes.json')).codes;
const byId = new Map(cat.map((p) => [p.id, { id: p.id, code: codes[p.id] }]));
const byCode = new Map(cat.map((p) => [codes[p.id], p.id]));
const known = new Set(cat.map((p) => p.id));
const VIEW = 'https://ruslanovcharenko24-debug.github.io/Clean_Cut_Meals/picks/view/';
// a fixed shuffled order, quantities 1..20 incl. 20
const order = [...cat].sort((a, b) => ((+a.id * 7919) % 1009) - ((+b.id * 7919) % 1009)).map((p) => p.id);
const make = (n, q) => order.slice(0, n).map((id, i) => ({ id, packs: q ?? ((i * 7) % 20) + 1 }));
const same = (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i].id && x.packs === b[i].packs);
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('FAIL', msg); } };
for (const [n, q] of [[1, undefined], [1, 20], [8, undefined], [16, undefined], [30, undefined], [30, 20], [30, 1]]) {
  const picks = make(n, q);
  const url = viewLink(VIEW, picks, byId);
  const c = new URL(url).searchParams.get('c');
  const r = decodeLink(c, byCode);
  const legacy = `${VIEW}?p=${encodePicks(picks)}`;
  ok(same(r.picks, picks) && !r.damaged, `round trip ${n}`);
  ok(/^[0-9a-z]+$/.test(c) && !/\s/.test(url), `charset ${n}`);
  const lr = decodePicks(new URL(legacy).searchParams.get('p'), known);
  ok(same(lr.picks, picks) && lr.skipped === 0, `legacy ${n}`);
  console.log(`n=${n} packs=${q ?? 'mixed 1-20'}: new url ${url.length} chars (param ${c.length}), old url ${legacy.length} chars (param ${legacy.split('?p=')[1].length}); restored ${r.picks.length}/${n} exact=${same(r.picks, picks)}; longest digit run new ${Math.max(...(c.match(/\d+/g) || ['']).map((s) => s.length))}, old 10`);
  // every truncation must be flagged as damaged, and never show more than the real items
  let undetected = 0;
  for (let k = 1; k < c.length; k++) {
    const t = decodeLink(c.slice(0, k), byCode);
    if (!t.damaged) undetected++;
    if (!t.picks.every((p, i) => p.id === picks[i].id && p.packs === picks[i].packs)) { fail++; console.log('wrong item after cut', n, k); break; }
  }
  ok(undetected === 0, `truncation detected ${n} (${undetected} undetected)`);
  // every single-character change must be flagged
  let changed = 0, missed = 0;
  const alpha = '0123456789abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < c.length; i++) for (const ch of alpha) {
    if (ch === c[i]) continue;
    changed++;
    if (!decodeLink(c.slice(0, i) + ch + c.slice(i + 1), byCode).damaged) missed++;
  }
  ok(missed === 0, `changes detected ${n}`);
  console.log(`   cuts tested ${c.length - 1}, undetected ${undetected}; single-char changes ${changed}, undetected ${missed}`);
}
// legacy cut at an item boundary: old format shows fewer items without any warning (the reported symptom)
const p30 = make(30);
const leg = encodePicks(p30);
const cut = leg.slice(0, leg.indexOf('.', 150));
const lc = decodePicks(cut, known);
console.log(`legacy link cut at a boundary: ${lc.picks.length}/30 shown, skipped=${lc.skipped} (no warning)`);
console.log('sample 8:', viewLink(VIEW, make(8), byId));
console.log('sample 30:', viewLink(VIEW, make(30), byId));
console.log(fail ? `FAILURES ${fail}` : 'ALL TESTS PASSED');
