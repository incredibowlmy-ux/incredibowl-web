// Sync the standalone ops dashboard from the desktop working file into /public.
// Run: npm run sync:dashboard
//
// Override the source path with DASHBOARD_SRC env var if you move the file:
//   DASHBOARD_SRC=/some/other/path.html npm run sync:dashboard
//
// The destination filename must match the dashboard URL the dashboard is served at.
// Update DST_NAME here if you ever rotate the obscure URL slug.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SRC = 'C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html';
const DST_NAME = 'dashboard-h7x2q9.html';

const src = process.env.DASHBOARD_SRC || DEFAULT_SRC;
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dst = path.join(repoRoot, 'public', DST_NAME);

if (!fs.existsSync(src)) {
  console.error(`✗ Source not found: ${src}`);
  console.error('  Set DASHBOARD_SRC env var if the file has moved.');
  process.exit(1);
}

const srcBytes = fs.statSync(src).size;
fs.copyFileSync(src, dst);

// Re-inject the noindex meta tags (they're stripped if user resaves from raw editor).
let html = fs.readFileSync(dst, 'utf-8');
if (!html.includes('name="robots"')) {
  html = html.replace(
    '<title>Incredibowl · 数据看板</title>',
    '<meta name="robots" content="noindex, nofollow, noarchive" />\n    <meta name="googlebot" content="noindex, nofollow, noarchive" />\n    <title>Incredibowl · 数据看板</title>',
  );
  fs.writeFileSync(dst, html);
  console.log('  ↳ re-injected noindex meta tags');
}

console.log(`✓ Synced ${(srcBytes / 1024).toFixed(1)} KB`);
console.log(`  ${src}`);
console.log(`  → ${dst}`);
console.log('\nNext: git add public/, commit, push.');
