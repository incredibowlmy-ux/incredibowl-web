// Build-time WebP → JPEG conversion for the Meta catalogue feed.
//
// Meta's product catalogue only accepts JPG/PNG images and rejects WebP, but
// every dish photo in /public is a .webp. This script (wired as the npm
// `prebuild` hook, so it runs on every Vercel deploy) converts each
// public/*.webp into public/meta-jpg/<name>.jpg. The product feed
// (/api/meta/product-feed) points image_link at /meta-jpg/<name>.jpg, so new
// dish photos keep being added as WebP only — the JPEG rendition regenerates
// automatically at build time with zero extra steps.
//
// public/meta-jpg/ is gitignored: it's a pure build artifact.

import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname
  // Windows: strip the leading slash from /C:/...
  .replace(/^\/([A-Za-z]:)/, '$1');
const OUT_DIR = path.join(PUBLIC_DIR, 'meta-jpg');

const files = (await readdir(PUBLIC_DIR)).filter(f => f.endsWith('.webp'));
await mkdir(OUT_DIR, { recursive: true });

let converted = 0;
for (const f of files) {
  const src = path.join(PUBLIC_DIR, f);
  const out = path.join(OUT_DIR, f.replace(/\.webp$/, '.jpg'));

  // Skip if the JPEG already exists and is newer than its source.
  try {
    const [s, o] = await Promise.all([stat(src), stat(out)]);
    if (o.mtimeMs >= s.mtimeMs) continue;
  } catch { /* out missing → convert */ }

  await sharp(src).jpeg({ quality: 88 }).toFile(out);
  converted++;
}

console.log(`meta-jpg: ${files.length} webp sources, ${converted} converted, output → public/meta-jpg/`);
