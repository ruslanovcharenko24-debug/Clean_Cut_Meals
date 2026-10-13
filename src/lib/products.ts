import type { ImageMetadata } from 'astro';
import data from '../../data/products.json';
import orderData from '../../data/order-links.json';

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

// Pack photos and the logo are kept out of the public repository (rights for public reuse not confirmed,
// docs/OPEN_QUESTIONS.md Q8). Without the files the pages build with a text-only replacement.
export function packImage(p: Product): ImageMetadata | null {
  return images[`../../${p.image.file}`]?.default ?? null;
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

export const channels = data.channels;

// One page per product; the template was first checked on Spaghetti Bolognese.
export const pageProducts = products;

// Order links (data/order-links.json): only links checked for this exact meal and service are shown.

export type OrderLevel = 'exact_product' | 'store_search' | 'store_page';
export interface OrderLink {
  service: string;
  serviceName: string;
  level: OrderLevel;
  url: string;
  store: string;
  location: string;
  label: string;
}

const LEVELS: OrderLevel[] = ['exact_product', 'store_search', 'store_page'];

export function orderLinks(p: Product): OrderLink[] {
  return orderData.links
    .filter((l) => l.product === p.slug && l.status === 'verified')
    .map((l) => {
      if (!l.url || !l.url.startsWith('https://') || !LEVELS.includes(l.level as OrderLevel) || l.checks.length === 0 || !('label' in l) || !l.label) {
        throw new Error(`Order link for ${p.slug}/${l.service} is marked verified but is incomplete`);
      }
      const service = orderData.services[l.service as keyof typeof orderData.services];
      return {
        service: l.service,
        serviceName: service.name,
        level: l.level as OrderLevel,
        url: l.url,
        store: l.store ?? '',
        location: l.location ?? '',
        label: l.label as string,
      };
    });
}
