import type { ImageMetadata } from 'astro';
import catalog from '../../data/catalog.json';
import orderData from '../../data/order-links.json';
import shortData from '../../data/short-links.json';
import cookingData from '../../data/cooking-instructions.json';

// Product data comes only from data/catalog.json (SuperValu product cards captured 13 Oct 2026,
// built by scripts/build-catalog.py). Nothing here adds claims that the cards do not contain.

export type Product = (typeof catalog.products)[number];
export type Category = 'meals' | 'fakeaway' | 'protein-pots' | 'breakfast' | 'ice-cream';

export const DATA_DATE_LABEL = '13 Oct 2026';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'meals', label: 'Meals' },
  { id: 'fakeaway', label: 'Fakeaway' },
  { id: 'protein-pots', label: 'Protein Pots' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'ice-cream', label: 'Ice Cream' },
];

// Ice cream and the protein yogurts are cold products: no heating section. Pancakes keep the pack-instructions note.
export function isCold(p: Product): boolean {
  return p.category === 'ice-cream' || /yogurt/i.test(p.official_name);
}

// Band colours sampled from three packs (docs/BRAND_RULES.md §2); other products use the brand pink.
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

const images = import.meta.glob<{ default: ImageMetadata }>('../../assets/products/supervalu/*.jpg', { eager: true });
// Derived copies with only the empty white background cropped away (pack untouched); originals are kept.
const trimmed = import.meta.glob<{ default: ImageMetadata }>('../../assets/products/supervalu-trimmed/*.jpg', { eager: true });

const CAT_ORDER = CATEGORIES.map((c) => c.id as string);
export const products: Product[] = [...catalog.products].sort(
  (a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || shortName(a).localeCompare(shortName(b)),
);

export function band(p: Product): string {
  return BAND[p.slug] ?? '#E0A0C9';
}

export function shortName(p: Product): string {
  return SHORT_NAME[p.slug] ?? p.official_name.replace(/^Clean Cut (Meals )?/, '').replace(/\s*\(.*?\)\s*$/, '');
}

// Official card name without the trailing size, which is shown separately.
export function officialName(p: Product): string {
  return p.official_name.replace(/\s*\(\d+\s*(g|ml)\)$/, '');
}

export function categoryLabel(p: Product): string {
  return CATEGORIES.find((c) => c.id === p.category)!.label;
}

export function packImage(p: Product): ImageMetadata | null {
  return trimmed[`../../${p.image.trimmed}`]?.default ?? images[`../../${p.image.file}`]?.default ?? null;
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

// Value from the card's last nutrition column (per pack / per serving / per pot / per tub), units as printed.
export function perPack(p: Product, key: 'Protein' | 'kcal'): string | null {
  const v = (p.nutrition as Record<string, string[] | undefined>)[key];
  return v ? v[v.length - 1].replace(/^([\d.]+)\s*(g|kcal)$/, '$1 $2') : null;
}

// Label of that column, e.g. "per pack", "per serving", "per tub (275g)".
export function perPackLabel(p: Product): string {
  return p.nutrition_columns[p.nutrition_columns.length - 1].replace(/^\(As (Microwaved|Consumed)\):?\s*/i, '').toLowerCase();
}

export function others(p: Product): Product[] {
  return products.filter((o) => o.slug !== p.slug);
}

export function mealPath(p: Product): string {
  return withBase(`/meals/${p.slug}/`);
}

// Short share links /s/<short>/ (data/short-links.json); same page as /meals/<slug>/.
export function shortSlug(p: Product): string {
  return (shortData.links as Record<string, string>)[p.slug] ?? p.slug;
}

export function shortPath(p: Product): string {
  return withBase(`/s/${shortSlug(p)}/`);
}

// 1200×630 share card made by scripts/make-cards.py (public/cards/), used as the link preview image.
export function cardPath(p: Product): string {
  return withBase(`/cards/${p.slug}-share-v2.jpg`);
}

// Invite flow (static routes so link previews get their own title without JavaScript):
//   /invite/<short>/        recipient's view of an invitation, starting on this meal
//   /invite/<short>/choose/ other meals, staying in invite mode
//   /pick/<short>/          link sent back by the recipient ("This one for me")
export type MealMode = 'standard' | 'invite' | 'pick';

export function invitePath(p: Product): string {
  return withBase(`/invite/${shortSlug(p)}/`);
}

export function pickPath(p: Product): string {
  return withBase(`/pick/${shortSlug(p)}/`);
}

// No emoji in this flow (14.10.2026). Message texts, sent as "<text>\n<link>"; the preview card carries the meal name and figures,
// so they are not repeated here. Nothing promises that the sender has bought or will deliver the meal.
export const INVITE_TEXT = 'Thought of you.\nWhat would you fancy?\nTake a look & choose your favourite:';
export const REPLY_TEXT = 'This one looks lovely. Thank you!';


// One page per product; the template was first checked on Spaghetti Bolognese.
export const pageProducts = products;

// Order links (data/order-links.json): only links checked for this exact meal and service are shown.

export type OrderLevel = 'exact_product' | 'store_search' | 'store_page';
export interface ServiceStyle {
  service: string;
  serviceName: string;
  logo: string;
  bg: string;
  border: string;
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


function serviceStyle(service: string): ServiceStyle {
  const s = orderData.services[service as keyof typeof orderData.services];
  return { service, serviceName: s.name, logo: s.logo, bg: s.bg, border: s.border, fg: s.fg };
}

const UBER = orderData.links.find((l) => l.service === 'uber_eats' && l.status === 'verified')!;

// SuperValu: this product's own card. Uber Eats: the checked store page (no claim that every product is listed).
export function orderLinks(p: Product): OrderLink[] {
  return [
    { ...serviceStyle('supervalu'), level: 'exact_product', url: p.card_url, store: 'SuperValu Online', location: '', label: 'View this meal' },
    { ...serviceStyle('uber_eats'), level: 'store_page', url: UBER.url!, store: UBER.store ?? '', location: UBER.location ?? '', label: UBER.label ?? '' },
  ];
}

// Just Eat stays a labelled demo: no link and no availability claim.
export function demoServices(_p: Product): DemoService[] {
  return [{ ...serviceStyle('just_eat'), label: 'Choose a store' }];
}

// Pack cooking instructions (data/cooking-instructions.json): only a record confirmed for this exact meal.
export type Cooking = (typeof cookingData.records)[number];
export function cookingFor(p: Product): Cooking | null {
  return cookingData.records.find((r) => (r.product as string | null) === p.slug && r.product_confirmed) ?? null;
}

// Creator credit and contacts (published with the creator's permission, 13 Oct 2026).
export const CREATOR = {
  name: 'Ruslan Ovcharenko',
  email: 'ruslanovcharenko24@gmail.com',
  phone: '+353 83 080 4967',
  phoneHref: '+353830804967',
};
