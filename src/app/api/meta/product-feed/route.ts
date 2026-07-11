import { NextResponse } from 'next/server';
import { weeklyMenu } from '@/data/weeklyMenu';

/**
 * GET /api/meta/product-feed
 *
 * Meta (Facebook/Instagram) Commerce Catalogue product feed — CSV format per
 * https://www.facebook.com/business/help/120325381656392
 *
 * Single source of truth: derives every product row from weeklyMenu.ts, so the
 * weekly menu rotation flows into the Meta catalogue automatically (the feed
 * is registered in Commerce Manager with a daily fetch schedule — no manual
 * catalogue edits on menu change).
 *
 * Inclusion rules:
 *   - hidden dishes  → excluded (not on the website either)
 *   - retired dishes → excluded (暂别菜 shouldn't appear in ads)
 *   - emoji-placeholder images → excluded (Meta requires a real image_link;
 *     the dish auto-joins the feed once a real /xxx.webp photo lands)
 *
 * No auth: the menu is already public on the website, and Meta's fetcher
 * works best against a plain public URL.
 */

const SITE = 'https://www.incredibowl.my';

/** RFC-4180 CSV field: always quoted, inner quotes doubled, newlines flattened. */
function csv(field: string): string {
  return `"${field.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

export async function GET() {
  const header = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];

  const rows = weeklyMenu
    .filter(d => !d.hidden && !d.retired && d.image.startsWith('/'))
    .map(d => [
      `dish-${d.id}`,
      `${d.name}｜${d.nameEn}`,
      d.desc,
      'in stock',
      'new',
      `${d.price.toFixed(2)} MYR`,
      `${SITE}/?dish=${d.id}&utm_source=meta&utm_medium=catalog`,
      // Meta's catalogue rejects WebP (JPG/PNG only) — point at the JPEG
      // rendition generated at build time by scripts/generate-meta-jpgs.mjs.
      `${SITE}/meta-jpg/${d.image.slice(1).replace(/\.webp$/, '.jpg')}`,
      'Incredibowl 碗妈私厨',
    ].map(csv).join(','));

  const body = [header.join(','), ...rows].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Fresh enough for Meta's daily fetch; static data means this route is
      // prerendered at build time and updates on every deploy anyway.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
