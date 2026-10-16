// "My picks": a wish list of a few products with a number of packs each, sent back to the person who sent the
// invitation. Not a shop basket: no prices, no order, nothing passed to SuperValu, Uber Eats or Just Eat.
// Pure functions only (no catalogue import), so this module is small enough for the browser.
//
// Shared link (static site, no server), format version 1: <base>/picks/view/?c=1<items><check>
//   1      format version
//   items  per product, in the order chosen: 2-letter code from data/pick-codes.json (fixed, never reused) +
//          number of packs as one base-36 digit (1–9, a = 10 … k = 20)
//   check  6 base-36 characters: FNV-1a of the version and items, so a cut or changed link is detected
// Lowercase letters and digits only: one short word that needs no escaping (30 products: 97 characters instead of
// about 400), without the long runs of digits of the old format.
// Old links /picks/view/?p=<id>-<packs>.<id>-<packs>… (10-digit SuperValu id) are still read; the draft on this
// device keeps that format. Names, sizes and photos always come from the catalogue, never from the link.

export interface PickProduct {
  id: string;
  slug: string;
  /** Short name used across the site, e.g. "Spaghetti Bolognese" */
  name: string;
  /** Pack size as on the product card, e.g. "400 g" */
  size: string;
  /** Short route name used in /invite/<short>/ */
  short: string;
  /** Invitation page of this product (with base) */
  invite: string;
  /** What one unit is: "tub" for ice cream (the card's nutrition column says "Per Tub"), otherwise "pack" */
  unit: 'pack' | 'tub';
  /** Same-origin JPEG of the whole pack photo for the picture card, or null */
  card: string | null;
  /** Fixed 2-letter code used in shared links (data/pick-codes.json) */
  code: string;
}
export interface Pick {
  id: string;
  packs: number;
}

export const MAX_PACKS = 20;
/** One entry per product at most, and the catalogue has 30 products. */
export const MAX_ITEMS = 30;
/** 30 entries × "1234567890-20." is 420 characters; anything much longer is not ours. */
export const MAX_PARAM_LENGTH = 450;

const ENTRY = /^(\d{10})-([1-9]\d?)$/;

export function encodePicks(picks: Pick[]): string {
  return picks.map((p) => `${p.id}-${p.packs}`).join('.');
}

/**
 * Reads a list from a link or from storage. Unknown products, repeats, malformed entries, zero, fractions and
 * more than MAX_PACKS are skipped (the first valid entry for a product wins) and counted in `skipped`.
 */
export function decodePicks(raw: string | null | undefined, known: ReadonlySet<string>): { picks: Pick[]; skipped: number } {
  if (!raw) return { picks: [], skipped: 0 };
  if (raw.length > MAX_PARAM_LENGTH) return { picks: [], skipped: 1 };
  const picks: Pick[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const part of raw.split('.')) {
    const m = ENTRY.exec(part);
    const packs = m ? Number(m[2]) : 0;
    if (!m || !known.has(m[1]) || seen.has(m[1]) || packs > MAX_PACKS || picks.length >= MAX_ITEMS) {
      skipped++;
      continue;
    }
    seen.add(m[1]);
    picks.push({ id: m[1], packs });
  }
  return { picks, skipped };
}

export function totalPacks(picks: Pick[]): number {
  return picks.reduce((n, p) => n + p.packs, 0);
}

// Labels on screen keep the number with its word (no-break space); the sent message does not use them.
export function packsLabel(n: number): string {
  return `${n}\u00a0${n === 1 ? 'pack' : 'packs'}`;
}

/** "1 pack", "2 packs", "1 tub", "2 tubs": number of units of this product, never grams or servings. */
export function unitLabel(n: number, unit: PickProduct['unit']): string {
  return `${n}\u00a0${unit}${n === 1 ? '' : 's'}`;
}

/** "400 g per pack", "500 ml per tub": the size of one unit as printed on the product card. */
export function sizeLabel(product: PickProduct): string {
  return `${product.size} per ${product.unit}`;
}

export function summaryLabel(picks: Pick[]): string {
  const n = picks.length;
  return `${n}\u00a0${n === 1 ? 'product' : 'products'} · ${packsLabel(totalPacks(picks))}`;
}

export const LINK_VERSION = '1';
const CHECK_LEN = 6;

function checkOf(body: string): string {
  // FNV-1a, 32 bit, reduced to 6 base-36 characters (about 2 × 10⁹ values).
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 36 ** CHECK_LEN).toString(36).padStart(CHECK_LEN, '0');
}

/** The compact list code: version + (code, packs) per product + check. */
export function encodeLink(picks: Pick[], byId: ReadonlyMap<string, PickProduct>): string {
  const body = LINK_VERSION + picks.map((p) => byId.get(p.id)!.code + p.packs.toString(36)).join('');
  return body + checkOf(body);
}

const ITEM = /^([a-z]{2})([1-9a-k])/;

/**
 * Reads a compact list code. `damaged` is true when the check, the version or the item layout does not match (a cut
 * or changed link): the products that can still be read from the start are returned, and the page must say the list
 * may be incomplete. Unknown codes and repeats are never shown.
 */
export function decodeLink(
  raw: string | null | undefined,
  byCode: ReadonlyMap<string, string>,
): { picks: Pick[]; damaged: boolean } {
  if (!raw) return { picks: [], damaged: false };
  const intact =
    raw.length <= 1 + MAX_ITEMS * 3 + CHECK_LEN &&
    /^[0-9a-z]+$/.test(raw) &&
    raw.startsWith(LINK_VERSION) &&
    (raw.length - 1 - CHECK_LEN) % 3 === 0 &&
    checkOf(raw.slice(0, -CHECK_LEN)) === raw.slice(-CHECK_LEN);
  // Another format version is not guessed at.
  if (!raw.startsWith(LINK_VERSION)) return { picks: [], damaged: true };
  // Intact: everything between the version and the check. Damaged: read from the start (leaving out the last six
  // characters when they can only be the check) and stop at the first piece that is not a whole known item.
  const withoutCheck = !intact && (raw.length - 1) % 3 !== 0 && raw.length >= 1 + CHECK_LEN + 3;
  let rest = raw.slice(1, intact || withoutCheck ? -CHECK_LEN : raw.length);
  const picks: Pick[] = [];
  const seen = new Set<string>();
  let bad = !intact;
  while (rest.length && picks.length < MAX_ITEMS) {
    const m = ITEM.exec(rest);
    const id = m && byCode.get(m[1]);
    if (!m || !id || seen.has(id)) {
      bad = true;
      break;
    }
    seen.add(id);
    picks.push({ id, packs: parseInt(m[2], 36) });
    rest = rest.slice(3);
  }
  if (rest.length) bad = true;
  return { picks, damaged: bad };
}

/** The one place the shared link is made: Share with pictures, Share as text and Copy all use it. */
export function viewLink(viewUrl: string, picks: Pick[], byId: ReadonlyMap<string, PickProduct>): string {
  return `${viewUrl}?c=${encodeLink(picks, byId)}`;
}

export const PICKS_HEADING = 'These would be lovely.';
export const PICKS_THANKS = 'Thank you \u2764\uFE0F';

/** Text-only message (when pictures cannot be shared): every product with its number of units, the link, then thanks. */
export function picksMessage(picks: Pick[], byId: ReadonlyMap<string, PickProduct>, viewUrl: string): string {
  const lines = picks.map((p) => {
    const product = byId.get(p.id)!;
    return `${p.packs} × ${product.name} · ${product.size}`;
  });
  return [PICKS_HEADING, ...lines, viewLink(viewUrl, picks, byId), PICKS_THANKS].join('\n');
}

/** Text sent with the pictures: the pictures carry the products, so no list here. The thanks is repeated in case
 *  an app separates the text from the images. */
export function captionMessage(picks: Pick[], byId: ReadonlyMap<string, PickProduct>, viewUrl: string): string {
  return [PICKS_HEADING, viewLink(viewUrl, picks, byId), PICKS_THANKS].join('\n');
}

// Draft kept on this device only, for convenience while choosing. Opening someone else's list never writes here.
const DRAFT_KEY = 'ccm-picks-draft-v1';
let memoryDraft = '';

function storage(): Storage | null {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const s = window[name];
      s.setItem('ccm-picks-test', '1');
      s.removeItem('ccm-picks-test');
      return s;
    } catch {
      // Blocked or full: try the next one, then keep the draft in memory for this page only.
    }
  }
  return null;
}

export function loadDraft(known: ReadonlySet<string>): Pick[] {
  let raw = memoryDraft;
  try {
    raw = storage()?.getItem(DRAFT_KEY) ?? memoryDraft;
  } catch {
    // Keep the in-memory copy.
  }
  return decodePicks(raw, known).picks;
}

export function saveDraft(picks: Pick[]): void {
  const raw = encodePicks(picks);
  memoryDraft = raw;
  try {
    const s = storage();
    if (!s) return;
    if (raw) s.setItem(DRAFT_KEY, raw);
    else s.removeItem(DRAFT_KEY);
  } catch {
    // The in-memory copy still works on this page.
  }
}

/** Adds one pack (or the product, at one pack), up to MAX_PACKS; keeps the order products were added in. */
export function changePacks(picks: Pick[], id: string, delta: number): Pick[] {
  const i = picks.findIndex((p) => p.id === id);
  if (i === -1) return delta > 0 ? [...picks, { id, packs: 1 }] : picks;
  const packs = Math.min(MAX_PACKS, picks[i].packs + delta);
  if (packs <= 0) return picks.filter((p) => p.id !== id);
  return picks.map((p, j) => (j === i ? { id, packs } : p));
}

/** Reads the catalogue slice printed by PicksData.astro. */
export function readPicksData(): {
  products: PickProduct[];
  byId: Map<string, PickProduct>;
  byCode: Map<string, string>;
  known: Set<string>;
  viewUrl: string;
} {
  const el = document.getElementById('picks-data')!;
  const data = JSON.parse(el.textContent || '{}') as { products: PickProduct[]; viewPath: string; viewUrl: string | null };
  const products = data.products;
  return {
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    byCode: new Map(products.map((p) => [p.code, p.id])),
    known: new Set(products.map((p) => p.id)),
    viewUrl: data.viewUrl || new URL(data.viewPath, window.location.origin).href,
  };
}
