// "My picks": a wish list of a few products with a number of packs each, sent back to the person who sent the
// invitation. Not a shop basket: no prices, no order, nothing passed to SuperValu, Uber Eats or Just Eat.
// Pure functions only (no catalogue import), so this module is small enough for the browser.
//
// Link format (static site, no server): <base>/picks/view/?p=<id>-<packs>.<id>-<packs>…
//   id    the SuperValu product id from data/catalog.json (10 digits, stable)
//   packs whole number of packs, 1–MAX_PACKS
// Only digits, "-" and "." are used, so the link needs no escaping and messengers keep it whole.
// Names, sizes and photos always come from the catalogue, never from the link.

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

export function viewLink(viewUrl: string, picks: Pick[]): string {
  return `${viewUrl}?p=${encodePicks(picks)}`;
}

export const PICKS_HEADING = 'These would be lovely.';
export const PICKS_THANKS = 'Thank you \u2764\uFE0F';

/** Text-only message (when pictures cannot be shared): every product with its number of units, the link, then thanks. */
export function picksMessage(picks: Pick[], byId: ReadonlyMap<string, PickProduct>, viewUrl: string): string {
  const lines = picks.map((p) => {
    const product = byId.get(p.id)!;
    return `${p.packs} × ${product.name} · ${product.size}`;
  });
  return [PICKS_HEADING, ...lines, viewLink(viewUrl, picks), PICKS_THANKS].join('\n');
}

/** Text sent with the pictures: the pictures carry the products, so no list here. The thanks is repeated in case
 *  an app separates the text from the images. */
export function captionMessage(picks: Pick[], viewUrl: string): string {
  return [PICKS_HEADING, viewLink(viewUrl, picks), PICKS_THANKS].join('\n');
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
export function readPicksData(): { products: PickProduct[]; byId: Map<string, PickProduct>; known: Set<string>; viewUrl: string } {
  const el = document.getElementById('picks-data')!;
  const data = JSON.parse(el.textContent || '{}') as { products: PickProduct[]; viewPath: string; viewUrl: string | null };
  const products = data.products;
  return {
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    known: new Set(products.map((p) => p.id)),
    viewUrl: data.viewUrl || new URL(data.viewPath, window.location.origin).href,
  };
}
