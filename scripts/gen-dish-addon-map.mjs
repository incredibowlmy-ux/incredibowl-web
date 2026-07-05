// Generate src/data/dishAddonMap.generated.ts from the Desktop dashboard's
// DISH_ADDON_MAP — single source stays in incredibowl-dashboard.html (manual
// order modal), this script derives the per-dish-NAME addon list for the
// /admin/subscriptions template editor. Run after changing dashboard add-ons:
//   node scripts/gen-dish-addon-map.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = 'C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html';
const OUT = path.join(__dirname, '..', 'src', 'data', 'dishAddonMap.generated.ts');

const html = fs.readFileSync(HTML, 'utf-8');

// Slice a JS literal block: from `const NAME = [` / `{` to the matching top-level closer line.
function slice(name, closer) {
  const start = html.indexOf(`const ${name} = `);
  if (start === -1) throw new Error(`找不到 ${name}`);
  const end = html.indexOf(closer, start);
  if (end === -1) throw new Error(`${name} 找不到结束符`);
  return html.slice(start, end + closer.length);
}

const code = [
  slice('MENU_SEED', '\n        ];'),
  slice('DRINKS_PILLS', '\n        ];'),
  slice('DISH_ADDON_MAP', '\n        };'),
  slice('UNIVERSAL_ADDONS', '\n        ];'),
  'RESULT = { MENU_SEED, DISH_ADDON_MAP, UNIVERSAL_ADDONS };',
].join('\n');

const sandbox = { RESULT: null };
vm.runInNewContext(code, sandbox);
const { MENU_SEED, DISH_ADDON_MAP, UNIVERSAL_ADDONS } = sandbox.RESULT;

// Resolve per dish NAME (subscriptions editor picks dishes by weeklyMenu name).
const byName = {};
for (const m of MENU_SEED) {
  const base = DISH_ADDON_MAP[String(m.id)] || [];
  const extras = UNIVERSAL_ADDONS.filter((u) => !base.some((b) => b.id === u.id));
  byName[m.name] = [...base, ...extras].map(({ id, label, price }) => ({ id, label, price }));
}

// Cross-check against weeklyMenu names so drift is loud, not silent.
const weeklyMenuSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'weeklyMenu.ts'), 'utf-8');
const missing = Object.keys(byName).filter((n) => !weeklyMenuSrc.includes(`'${n}'`) && !weeklyMenuSrc.includes(`"${n}"`));
if (missing.length) console.warn('⚠ 这些 dashboard 菜名在 weeklyMenu.ts 里没找到（名字可能不一致）:', missing.join(' / '));

const universal = UNIVERSAL_ADDONS.map(({ id, label, price }) => ({ id, label, price }));

const ts = `/**
 * ⚠ AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Source: Desktop incredibowl-dashboard.html 的 DISH_ADDON_MAP（手动录单同款加料表）。
 * Regenerate: node scripts/gen-dish-addon-map.mjs
 * Generated: ${new Date().toISOString().slice(0, 10)}
 */

export interface DishAddonOption { id: string; label: string; price: number }

/** 每道菜（按菜名）可选的加料，与 dashboard 手动录单完全一致（已含通用加料）。 */
export const DISH_ADDONS_BY_NAME: Record<string, DishAddonOption[]> = ${JSON.stringify(byName, null, 2)};

/** 菜名不在表里时的兜底（通用加料）。 */
export const UNIVERSAL_ADDON_OPTIONS: DishAddonOption[] = ${JSON.stringify(universal, null, 2)};
`;

fs.writeFileSync(OUT, ts);
console.log(`✓ 生成 ${OUT}`);
console.log(`  ${Object.keys(byName).length} 道菜 · 通用加料 ${universal.length} 个`);
