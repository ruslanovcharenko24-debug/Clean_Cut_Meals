// Picture card(s) of the picks, drawn in the browser on a canvas from the site's own pack photos and font, for the
// share sheet (an attachment, not the link preview). Layout agreed 16.10.2026:
//   "These would be lovely."            (first picture only)
//   two columns: whole pack photo, name, "400 g per pack", "2 packs"
//   "Thank you" + one red heart         (last picture only)
// No totals, prices, nutrition, links, QR codes, buttons or project wording. Long lists are split into several
// pictures of at most PER_PICTURE products (2 × 2), in the same order, without page numbers. Kept close to 4:5:
// taller pictures (up to six products, about 1:2) were cropped top and bottom in chat previews. A single picture
// fits its content; the pictures of a series share one template (same size and scale on every page).
import { sizeLabel, unitLabel, PICKS_HEADING, type Pick, type PickProduct } from './picks';

const INK = '#24014c';
const INK_SOFT = '#4a3a63';
const PHOTO_BG = '#f8eef5'; // soft pink-lilac behind each pack
const HEART = '#e0243c';
const FONT = "Lexend, system-ui, -apple-system, 'Segoe UI', sans-serif";

export const PER_PICTURE = 4;
const W = 1080;
const PAD = 56;
const GAP = 36;
const COL = (W - PAD * 2 - GAP) / 2; // 466
const SINGLE_COL = 600;
const PHOTO_H = 280;
const SINGLE_PHOTO_H = 360;
const PHOTO_INSET = 16;
const NAME = { size: 34, line: 41 };
const SIZE = { size: 27, line: 34 };
const QTY = { size: 40, line: 48 };
const ROW_GAP = 36;
const HEAD = { size: 58, gap: 34 };
const FOOT = { gap: 34, size: 48, heart: 42 };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the column is broken by letters, never cut off.
    line = '';
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > max && line) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Cell {
  product: PickProduct;
  packs: number;
  img: HTMLImageElement | null;
}

// Name block: as many lines as the name needs, or a fixed number of lines in a series (see Template).
function textHeight(nameLines: number): number {
  return nameLines * NAME.line + 8 + SIZE.line + 10 + QTY.line;
}

function cellText(ctx: CanvasRenderingContext2D, cell: Cell, col: number): { name: string[]; height: number } {
  ctx.font = `700 ${NAME.size}px ${FONT}`;
  const name = wrap(ctx, cell.product.name, col);
  return { name, height: textHeight(name.length) };
}

/** One layout for every picture of a series (more than one picture): same canvas, same 2 × 2 slots, room for the
 *  longest catalogue name, heading and thanks areas reserved on every page even where they are not drawn. */
interface Template {
  nameLines: number;
}

function seriesTemplate(products: Iterable<PickProduct>): Template {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `700 ${NAME.size}px ${FONT}`;
  let nameLines = 1;
  for (const p of products) nameLines = Math.max(nameLines, wrap(ctx, p.name, COL).length);
  return { nameLines };
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Vector heart (no emoji font needed), x/y = top-left of a size × size box.
  const s = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(16, 29);
  ctx.bezierCurveTo(5, 21, 0, 15, 0, 9);
  ctx.bezierCurveTo(0, 4, 4, 0, 9, 0);
  ctx.bezierCurveTo(12, 0, 14.5, 1.6, 16, 4);
  ctx.bezierCurveTo(17.5, 1.6, 20, 0, 23, 0);
  ctx.bezierCurveTo(28, 0, 32, 4, 32, 9);
  ctx.bezierCurveTo(32, 15, 27, 21, 16, 29);
  ctx.closePath();
  ctx.fillStyle = HEART;
  ctx.fill();
  ctx.restore();
}

function drawPicture(cells: Cell[], first: boolean, last: boolean, template: Template | null): HTMLCanvasElement {
  const single = cells.length === 1 && !template;
  const width = single ? SINGLE_COL + PAD * 2 : W;
  const col = single ? SINGLE_COL : COL;
  const photoH = single ? SINGLE_PHOTO_H : PHOTO_H;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Measure first. Alone (one picture): rows are as tall as their taller cell. In a series: every row and slot has
  // the template's height and the canvas always holds two rows, heading and thanks areas.
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += single ? 1 : 2) rows.push(cells.slice(i, i + (single ? 1 : 2)));
  const rowText = rows.map((row) => row.map((c) => cellText(ctx, c, col)));
  const slotH = (t: { height: number }[]) => (template ? textHeight(template.nameLines) : Math.max(...t.map((x) => x.height)));
  const rowHeights = rowText.map((t) => photoH + 20 + slotH(t));
  const headH = first || template ? HEAD.size + HEAD.gap : 0;
  const footH = last || template ? FOOT.gap + FOOT.size + 8 : 0;
  const gridH = template
    ? (photoH + 20 + textHeight(template.nameLines)) * 2 + ROW_GAP
    : rowHeights.reduce((a, b) => a + b, 0) + ROW_GAP * (rows.length - 1);
  const height = PAD + headH + gridH + footH + PAD;

  canvas.width = width;
  canvas.height = Math.ceil(height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  let y = PAD;
  if (first) {
    ctx.fillStyle = INK;
    // Smaller only if the picture is narrow (one product), so the heading is never cut at the edges.
    ctx.font = `700 ${HEAD.size}px ${FONT}`;
    const fit = Math.min(HEAD.size, Math.floor((HEAD.size * (width - PAD * 2)) / ctx.measureText(PICKS_HEADING).width));
    ctx.font = `700 ${fit}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(PICKS_HEADING, width / 2, y);
    ctx.textAlign = 'left';
  }
  y += headH;

  rows.forEach((row, r) => {
    // A row with one product (odd count) is centred instead of leaving an empty column.
    const rowW = row.length * col + (row.length - 1) * GAP;
    const x0 = (width - rowW) / 2;
    row.forEach((cell, c) => {
      const x = x0 + c * (col + GAP);
      ctx.fillStyle = PHOTO_BG;
      ctx.fillRect(x, y, col, photoH);
      if (cell.img) {
        // Whole pack, own aspect ratio (contain): never stretched or cropped.
        const bw = col - PHOTO_INSET * 2;
        const bh = photoH - PHOTO_INSET * 2;
        const k = Math.min(bw / cell.img.naturalWidth, bh / cell.img.naturalHeight);
        const iw = cell.img.naturalWidth * k;
        const ih = cell.img.naturalHeight * k;
        ctx.drawImage(cell.img, x + (col - iw) / 2, y + (photoH - ih) / 2, iw, ih);
      }
      let ty = y + photoH + 20;
      ctx.fillStyle = INK;
      ctx.font = `700 ${NAME.size}px ${FONT}`;
      for (const line of rowText[r][c].name) {
        ctx.fillText(line, x, ty);
        ty += NAME.line;
      }
      // In a series the size and quantity sit at the same place in every slot, below the reserved name lines.
      if (template) ty = y + photoH + 20 + template.nameLines * NAME.line;
      ty += 8;
      ctx.fillStyle = INK_SOFT;
      ctx.font = `400 ${SIZE.size}px ${FONT}`;
      ctx.fillText(sizeLabel(cell.product), x, ty);
      ty += SIZE.line + 10;
      ctx.fillStyle = INK;
      ctx.font = `700 ${QTY.size}px ${FONT}`;
      ctx.fillText(unitLabel(cell.packs, cell.product.unit).replace(' ', ' '), x, ty);
    });
    y += rowHeights[r] + (r < rows.length - 1 ? ROW_GAP : 0);
  });

  if (last) {
    // In a series the thanks sits in the reserved footer area, under the grid, whatever the number of rows.
    if (template) y = PAD + headH + gridH;
    y += FOOT.gap;
    ctx.fillStyle = INK;
    ctx.font = `700 ${FOOT.size}px ${FONT}`;
    const thanks = 'Thank you';
    const heart = FOOT.heart;
    const tw = ctx.measureText(thanks).width;
    const total = tw + 16 + heart;
    const tx = (width - total) / 2;
    ctx.fillText(thanks, tx, y);
    drawHeart(ctx, tx + tw + 14, y + 6, heart);
  }
  return canvas;
}

function loadImage(src: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error(`timeout ${src}`)), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      img.decode().then(() => resolve(img), () => resolve(img));
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`load ${src}`));
    };
    img.src = src;
  });
}

/** Splits n products into the fewest pictures of at most PER_PICTURE, sizes differing by one at most (13 -> 4, 3, 3, 3,
 *  never 4, 4, 4, 1), keeping the order. */
export function pictureSizes(n: number): number[] {
  const pictures = Math.ceil(n / PER_PICTURE);
  const small = Math.floor(n / pictures);
  return Array.from({ length: pictures }, (_, i) => small + (i < n % pictures ? 1 : 0));
}

/**
 * Draws the picture(s) for exactly these picks. Waits for the Lexend font and every pack photo; any failure rejects,
 * so a picture with an empty cell is never produced.
 */
export async function renderPicksPictures(
  picks: Pick[],
  byId: ReadonlyMap<string, PickProduct>,
  timeoutMs = 20000,
): Promise<Blob[]> {
  await Promise.all([document.fonts.load(`700 40px Lexend`, 'Aa'), document.fonts.load(`400 30px Lexend`, 'Aa')]);
  const cells: Cell[] = await Promise.all(
    picks.map(async (p) => {
      const product = byId.get(p.id)!;
      if (!product.card) throw new Error(`no photo for ${product.slug}`);
      return { product, packs: p.packs, img: await loadImage(product.card, timeoutMs) };
    }),
  );
  const sizes = pictureSizes(cells.length);
  const template = sizes.length > 1 ? seriesTemplate(byId.values()) : null;
  const blobs: Blob[] = [];
  let start = 0;
  for (let i = 0; i < sizes.length; i++) {
    const canvas = drawPicture(cells.slice(start, start + sizes[i]), i === 0, i === sizes.length - 1, template);
    start += sizes[i];
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('canvas.toBlob failed');
    blobs.push(blob);
  }
  return blobs;
}
