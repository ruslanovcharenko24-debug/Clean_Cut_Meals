import type { ImageMetadata } from 'astro';
import data from '../../data/products.json';
import orderData from '../../data/order-links.json';
import shortData from '../../data/short-links.json';
import cookingData from '../../data/cooking-instructions.json';

// Product data comes only from data/products.json (SuperValu SKU cards, 13 Oct 2026).
// Nothing here adds claims that the source does not contain.

export type Product = (typeof data.products)[number];

export const DATA_DATE_LABEL = '13 Oct 2026';

// Navigation band colours sampled from each pack (docs/BRAND_RULES.md §2).
const BAND: Record<string, string> = {
  'butter-chicken': '#FFBD83',
  'beef-stroganoff': '#FFA0D0',
  'spaghetti-bolognese': '#E4B8D9',
};

const SHORT_NAME: Record<string, string> = {
  'butter-chicken': 'Butter Chicken',
  'beef-stroganoff': 'Beef Stroganoff',
  'spaghetti-bolognese': 'Spaghetti Bolognese',
};

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../../assets/products/supervalu/*.jpg',
  { eager: true },
);
// Derived copies with only the empty white background cropped away (pack untouched); originals are kept.
const trimmed = import.meta.glob<{ default: ImageMetadata }>(
  '../../assets/products/supervalu-trimmed/*.jpg',
  { eager: true },
);

export const products: Product[] = [...data.products].sort((a, b) =>
  SHORT_NAME[a.slug].localeCompare(SHORT_NAME[b.slug]),
);

export function band(p: Product): string {
  return BAND[p.slug];
}

export function shortName(p: Product): string {
  return SHORT_NAME[p.slug];
}

// Official card name without the trailing "(400 g)", which is shown separately.
export function officialName(p: Product): string {
  return p.official_name.replace(/\s*\(400 g\)$/, '');
}

// Pack photo for pages: trimmed copy first, original as fallback. Returns null if neither file is present.
export function packImage(p: Product): ImageMetadata | null {
  return (
    trimmed[`../../assets/products/supervalu-trimmed/${p.slug}.jpg`]?.default ??
    images[`../../${p.image.file}`]?.default ??
    null
  );
}

export const hasPackImages = products.every((p) => packImage(p) !== null);

// Joins a site path with the configured base (GitHub Pages serves the site under /<repo>/).
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// Absolute URL for Share and link previews; `path` already includes the base. `site` is the origin from astro.config.
export function absoluteUrl(path: string, site: URL | undefined): string | null {
  return site ? new URL(path, site).href : null;
}

export function perPack(p: Product, key: 'Protein' | 'kcal'): string {
  // Card units are kept; only a space is added between number and unit for reading.
  return p.nutrition[key].per_pack.replace(/^([\d.]+)\s*(g|kcal)$/, '$1 $2');
}

export function others(p: Product): Product[] {
  return products.filter((o) => o.slug !== p.slug);
}

export function mealPath(p: Product): string {
  return withBase(`/meals/${p.slug}/`);
}

// Short share links /s/<short>/ (data/short-links.json); same page as /meals/<slug>/.
export function shortSlug(p: Product): string {
  return shortData.links[p.slug as keyof typeof shortData.links];
}

export function shortPath(p: Product): string {
  return withBase(`/s/${shortSlug(p)}/`);
}

// 1200×630 share card made by scripts/make-cards.py (public/cards/), used as the link preview image.
export function cardPath(p: Product): string {
  return withBase(`/cards/${p.slug}-share.jpg`);
}

// Invite flow (static routes so link previews get their own title without JavaScript):
//   /invite/<short>/        recipient's view of an invitation, starting on this meal
//   /invite/<short>/choose/ other meals, staying in invite mode
//   /pick/<short>/          link sent back by the recipient ("This one for me, please")
export type MealMode = 'standard' | 'invite' | 'pick';

export function invitePath(p: Product): string {
  return withBase(`/invite/${shortSlug(p)}/`);
}

export function pickPath(p: Product): string {
  return withBase(`/pick/${shortSlug(p)}/`);
}

// Message texts; the preview card carries the meal name and figures, so they are not repeated here.
export const INVITE_TEXT = 'What would you like for lunch or dinner? Pick your meal:';
export const REPLY_TEXT = 'This one for me, please:';

export const channels = data.channels;

// One page per product; the template was first checked on Spaghetti Bolognese.
export const pageProducts = products;

// Order links (data/order-links.json): only links checked for this exact meal and service are shown.

export type OrderLevel = 'exact_product' | 'store_search' | 'store_page';
export interface ServiceStyle {
  service: string;
  serviceName: string;
  logo: string;
  bg: string;
  fg: string;
}
export interface OrderLink extends ServiceStyle {
  level: OrderLevel;
  url: string;
  store: string;
  location: string;
  label: string;
}
export interface DemoService extends ServiceStyle {
  label: string;
}

const LEVELS: OrderLevel[] = ['exact_product', 'store_search', 'store_page'];

function serviceStyle(service: string): ServiceStyle {
  const s = orderData.services[service as keyof typeof orderData.services];
  return { service, serviceName: s.name, logo: s.logo, bg: s.bg, fg: s.fg };
}

export function orderLinks(p: Product): OrderLink[] {
  return orderData.links
    .filter((l) => l.product === p.slug && l.status === 'verified')
    .map((l) => {
      if (!l.url || !l.url.startsWith('https://') || !LEVELS.includes(l.level as OrderLevel) || l.checks.length === 0 || !l.label) {
        throw new Error(`Order link for ${p.slug}/${l.service} is marked verified but is incomplete`);
      }
      return {
        ...serviceStyle(l.service),
        level: l.level as OrderLevel,
        url: l.url,
        store: l.store ?? '',
        location: l.location ?? '',
        label: l.label,
      };
    });
}

// Services shown for the showcase as a labelled demo: no link and no availability claim.
export function demoServices(p: Product): DemoService[] {
  return orderData.links
    .filter((l) => l.product === p.slug && l.status === 'demo')
    .map((l) => ({ ...serviceStyle(l.service), label: l.label ?? 'Demo' }));
}

// Pack cooking instructions (data/cooking-instructions.json): only a record confirmed for this exact meal.
export type Cooking = (typeof cookingData.records)[number];
export function cookingFor(p: Product): Cooking | null {
  return cookingData.records.find((r) => (r.product as string | null) === p.slug && r.product_confirmed) ?? null;
}
