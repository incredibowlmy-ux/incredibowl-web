/**
 * dogfood：价格同步守门人（sync-dashboard-prices.mts）真能抓到、也真能改对。
 * 跑法：node scripts/dogfood-price-sync.mts
 *
 * 手法：把 dashboard 原件复制到临时目录 → 故意把几处价格改旧 → 跑检查（必须全部报出来）
 * → 跑 --fix → 结果必须与**原件逐字节相同**（改回去了、且没顺手动别的地方）。
 * 全程不碰真文件，不写 Firestore。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DESKTOP = 'C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html';
// 2026-09-05：CI（或任何没有 Desktop 源文件的机器）退回仓库里的派生副本 public/。
// 这个测试只关心「守门人抓得到、改得对」，喂哪份 dashboard 都成立。
const SRC = process.env.DASHBOARD_SRC
  || (fs.existsSync(DESKTOP) ? DESKTOP : path.join(repoRoot, 'public', 'dashboard-h7x2q9.html'));
const SCRIPT = path.join(repoRoot, 'scripts', 'sync-dashboard-prices.mts');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; } else { fail++; console.log(`  ✗ ${m}`); } };

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pricesync-'));
const tmp = path.join(tmpDir, 'dashboard.html');
const pristine = fs.readFileSync(SRC, 'utf-8');

/** 跑守门人，回 { code, out }。永远指向临时文件，永远跳过 webapp/Firestore。 */
function run(args: string[]) {
  const env = { ...process.env, DASHBOARD_SRC: tmp, PRICE_SYNC_SKIP_WEBAPP: '1', PRICE_SYNC_SKIP_FIRESTORE: '1' };
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { code: err.status ?? -1, out: err.stdout ?? '' };
  }
}

// ── 0. 原件本身必须是干净的（否则后面的「改回原样」断言没意义）──
fs.writeFileSync(tmp, pristine);
const clean = run([]);
ok(clean.code === 0, `原件应无漂移，实得退出码 ${clean.code}`);
ok(/✅ 全部一致/.test(clean.out), '原件应报「全部一致」');

// ── 1. 故意把价格改旧 ──
//    覆盖三种形状：ADDON_SEED(name+category) / DISH_ADDON_MAP(label) / MENU_SEED(数字 id)
interface Corruption { find: string; replace: string; expectId: string; was: string; want: string }
const CORRUPTIONS: Corruption[] = [
  { find: `{ id: 'potato-egg',                  name: '马铃薯煎蛋',                            price: 4.00,`,
    replace: `{ id: 'potato-egg',                  name: '马铃薯煎蛋',                            price: 3.50,`,
    expectId: 'potato-egg', was: '3.50', want: '4.00' },
  { find: `{ id: 'extra-pork-chop',             name: '加甜酸猪扒 (1块)',                      price: 14.90, category:`,
    replace: `{ id: 'extra-pork-chop',             name: '加甜酸猪扒 (1块)',                      price: 11.90, category:`,
    expectId: 'extra-pork-chop', was: '11.90', want: '14.90' },
  { find: `{ id: 27, name: '家乡甜酸洋葱猪扒', nameEn: 'Hometown Sweet & Sour Onion Pork Chop', price: 19.90,`,
    replace: `{ id: 27, name: '家乡甜酸洋葱猪扒', nameEn: 'Hometown Sweet & Sour Onion Pork Chop', price: 18.50,`,
    expectId: '菜#27', was: '18.50', want: '19.90' },
  // legacy DISH_LIBRARY：id 是旧编号（addon-corn），价要按 canonical（extra-corn）来
  { find: `{ id: 'addon-corn', name: '加玉米', price: 2.50,`,
    replace: `{ id: 'addon-corn', name: '加玉米', price: 2.00,`,
    expectId: 'addon-corn（legacy → extra-corn）', was: '2.00', want: '2.50' },
];

let corrupted = pristine;
for (const c of CORRUPTIONS) {
  ok(corrupted.includes(c.find), `锚点仍存在于 dashboard：${c.expectId}（改版后要更新本用例）`);
  corrupted = corrupted.replace(c.find, c.replace);
}
// DISH_ADDON_MAP 里 potato-egg 出现 21 次（每道菜一份），全部改旧，验证「一处都不漏」
const mapBefore = (corrupted.match(/id: 'potato-egg',\s+label: '马铃薯煎蛋', price: 4\.00/g) || []).length;
ok(mapBefore >= 15, `DISH_ADDON_MAP 里 potato-egg 应有 15+ 处，实得 ${mapBefore}`);
corrupted = corrupted.replace(/(id: 'potato-egg',\s+label: '马铃薯煎蛋', price: )4\.00/g, '$13.50');
fs.writeFileSync(tmp, corrupted);

// ── 2. 只读检查：必须全报出来，退出码 1 ──
const check = run([]);
ok(check.code === 1, `有漂移时退出码应为 1（给 sync:dashboard 当闸门），实得 ${check.code}`);
const reported = (check.out.match(/RM[\d.]+ → RM[\d.]+/g) || []).length;
ok(reported === CORRUPTIONS.length + mapBefore,
   `应报出 ${CORRUPTIONS.length + mapBefore} 处漂移，实得 ${reported}`);
for (const c of CORRUPTIONS) {
  ok(check.out.includes(`${c.expectId}`) && check.out.includes(`RM${c.was} → RM${c.want}`),
     `应报出 ${c.expectId}  RM${c.was} → RM${c.want}`);
}

// ── 3. --fix：改完必须与原件逐字节相同 ──
const fixed = run(['--fix']);
ok(fixed.code === 0, `--fix 应正常退出，实得 ${fixed.code}`);
const after = fs.readFileSync(tmp, 'utf-8');
ok(after === pristine, '修完应与原件逐字节相同（改回去了、且没误伤别处）');
if (after !== pristine) {
  const a = after.split('\n'), b = pristine.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) { console.log(`     首个差异 行${i + 1}:\n       修后: ${a[i]}\n       原件: ${b[i]}`); break; }
  }
}

// ── 4. 再跑一次必须干净（幂等）──
const again = run([]);
ok(again.code === 0 && /✅ 全部一致/.test(again.out), '修完再检查应干净（幂等）');

// ── 5. 列宽保护：长度变化时不能把后面的注释推歪 ──
//     14.90 → 7.90 少一位，看看整行长度是否被空白补回来
fs.writeFileSync(tmp, pristine.replace(
  `{ id: 'extra-shaoxing-pork-100g',    name: '【酒香入魂】加绍兴花肉 (100g)',         price: 14.90,`,
  `{ id: 'extra-shaoxing-pork-100g',    name: '【酒香入魂】加绍兴花肉 (100g)',         price: 7.90,`));
run(['--fix']);
ok(fs.readFileSync(tmp, 'utf-8') === pristine, '位数变化（7.90 → 14.90）也应还原成原件排版');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
