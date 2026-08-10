/**
 * 价格单一来源守门人：webapp 的价目表 → dashboard HTML（+ Firestore 菜品价）。
 *
 *   源头（唯一权威）
 *     · 加料/套餐  src/data/addOnsConfig.ts 的 ADD_ON_PRICES
 *     · 主菜        src/data/weeklyMenu.ts 的 weeklyMenu[].price
 *
 *   下游（派生副本，本脚本负责改写／校验）
 *     ① dashboard HTML 里所有 `{ id: 'xxx', … price: N }` 单行字面量
 *        —— ADDON_SEED / DISH_ADDON_MAP / UNIVERSAL_ADDONS / DEFAULT_ADDONS /
 *           PREPAID_ADDON_OPTIONS_DASHBOARD 全都是这个形状，所以不用逐个表登记
 *     ② dashboard HTML 的 MENU_SEED（数字 id，经 WEBAPP_TO_DASH 映射）
 *     ③ webapp 自己的 p()/rm() 兜底值（AddOnModal 里 `p('id', 4.00)` 的第二个参数）
 *     ④ Firestore `menu` 集合的主菜 price（dashboard 实际读它渲染，MENU_SEED 只是兜底）
 *
 * 为什么要它：改一个加料价原来要手动摸六个触点（[[project_addon_combo_six_touchpoints]]），
 * 漏一处就出现「网站 RM4，dashboard 还收 RM3.50」。现在改 ADD_ON_PRICES 一处，跑一条命令。
 *
 * 用法：
 *   node scripts/sync-dashboard-prices.mts              # 只报告（有漂移 → 退出码 1）
 *   node scripts/sync-dashboard-prices.mts --fix        # 改写 dashboard HTML + webapp 兜底值
 *   node scripts/sync-dashboard-prices.mts --fix --commit  # 再把主菜价推进 Firestore
 *
 * `npm run sync:dashboard` 已内置 --fix，所以「同步到 public/」这条路上价格不可能是旧的。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_ON_PRICES } from '../src/data/addOnsConfig.ts';
import { weeklyMenu } from '../src/data/weeklyMenu.ts';

const FIX = process.argv.includes('--fix');
const COMMIT = process.argv.includes('--commit');

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DASHBOARD = process.env.DASHBOARD_SRC
  || 'C:/Users/User/Desktop/Incredibowl Services/incredibowl-dashboard.html';
/** webapp 里也存着价格兜底值的文件（p('id', N) / rm('id', N)）。 */
const WEBAPP_FALLBACK_FILES = ['src/components/menu/AddOnModal.tsx'];

/** webapp 菜品 id → dashboard 菜品 id（历史遗留，只有这 5 个不同）。与 sync-menu-to-firestore 同表。 */
const WEBAPP_TO_DASH: Record<number, number> = { 1: 14, 2: 13, 4: 2, 13: 4, 14: 1 };
const DASH_TO_WEBAPP = new Map<number, number>(
  Object.entries(WEBAPP_TO_DASH).map(([w, d]) => [d, Number(w)]),
);
/** identity 的那些：dash id 就是 webapp id（但要排除被上面占用的目标 id）。 */
function webappIdOfDash(dashId: number): number | null {
  if (DASH_TO_WEBAPP.has(dashId)) return DASH_TO_WEBAPP.get(dashId)!;
  if (dashId in WEBAPP_TO_DASH) return null;  // 该 webapp id 已映射到别处，dash 侧此号另有其人
  return dashId;
}

/**
 * 必须永远同价的别名对（同一样东西的不同下单 id）。
 * 左边是 canonical，右边跟着走。ADDON_ID_ALIASES 在 dashboard 侧是同一套。
 */
const ALIAS_PAIRS: [string, string][] = [
  ['potato-egg', 'potato-egg-alacarte'],
  ['sunny-egg', 'sunny-egg-alacarte'],
  ['onsen-egg', 'onsen-egg-side'],
  ['extra-edamame', 'extra-edamame-side'],
  ['extra-corn', 'extra-corn-side'],
];

/**
 * dashboard 的「+ 加菜品」选单（DISH_LIBRARY）用的是 legacy `addon-*` id
 * ——同一样东西的旧编号，只作成本表预填值，不参与下单。
 * 2026-08-10 老板拍板：它们也跟网站现价走，一并自动同步（先前只报告不改）。
 */
const LEGACY_LIBRARY_MAP: Record<string, string> = {
  'addon-sunny-egg': 'sunny-egg', 'addon-onsen-egg': 'onsen-egg', 'addon-potato-egg': 'potato-egg',
  'addon-extra-rice': 'extra-rice', 'addon-brown-rice': 'brown-rice', 'addon-less-rice': 'less-rice',
  'addon-extra-potato': 'extra-potato', 'addon-corn': 'extra-corn', 'addon-edamame': 'extra-edamame',
  'addon-cherry-tomato': 'cherry-tomato', 'addon-cauliflower': 'extra-cauliflower-80g',
  'addon-black-olive': 'extra-black-olive-12g', 'addon-extra-chicken-breast': 'extra-greek-chicken-180g',
  'addon-extra-chicken-chop': 'extra-chicken-chop', 'addon-extra-pork-belly': 'extra-pork-belly',
  'addon-extra-prawns': 'extra-prawns', 'addon-extra-fungus': 'extra-fungus', 'addon-extra-yam': 'extra-yam',
  'addon-extra-scallion-chop': 'extra-scallion-chop-side', 'addon-extra-herbal-leg': 'extra-herbal-leg-1',
  'addon-natto-side': 'natto-side', 'addon-nori': 'nori',
};

// ─────────────────────────────────────────────────────────────────────────────

interface Drift {
  file: string;
  line: number;
  id: string;
  was: number;
  want: number;
  context: string;
}
const drift: Drift[] = [];
const advisory: string[] = [];
const unmanaged = new Map<string, number>();   // dashboard 独有、网站没有权威价的 id
let scanned = 0;

const money = (n: number) => n.toFixed(2);
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;   // 只比到分

/**
 * 把一行里的 `price: <旧值>` 换成新值，并尽量保持后面的列对齐
 * （dashboard 用空格排版，长度变了会把整块注释推歪）。
 */
function replacePrice(line: string, matchStart: number, oldNum: string, want: number): string {
  const idx = line.indexOf(`price:`, matchStart);
  const numIdx = line.indexOf(oldNum, idx);
  const next = money(want);
  const delta = next.length - oldNum.length;
  let out = line.slice(0, numIdx) + next + line.slice(numIdx + oldNum.length);
  if (delta !== 0) {
    // 数字后面通常是 `,` + 若干空格；在那段空白上补/减，列就不会漂
    const after = numIdx + next.length;
    const m = /^(,?)( {2,})/.exec(out.slice(after));
    if (m) {
      const keep = Math.max(1, m[2].length - delta);
      out = out.slice(0, after) + m[1] + ' '.repeat(keep) + out.slice(after + m[0].length);
    }
  }
  return out;
}

// ── ① + ② dashboard HTML ────────────────────────────────────────────────────
if (!fs.existsSync(DASHBOARD)) {
  console.error(`✗ 找不到 dashboard 源文件：${DASHBOARD}`);
  console.error('  文件挪了就用 DASHBOARD_SRC 环境变量指过去。');
  process.exit(2);
}
const dashRaw = fs.readFileSync(DASHBOARD, 'utf-8');
const DASH_EOL = dashRaw.includes('\r\n') ? '\r\n' : '\n';   // 原样写回，别把整个文件的换行改掉
const dashLines = dashRaw.split(/\r?\n/);

/** 单行对象字面量里同时带 id 和 price。`[^{}]*?` 保证不跨对象。 */
const RE_STR_ID = /\{\s*id:\s*'([^']+)'[^{}]*?\bprice:\s*(\d+(?:\.\d+)?)/g;
const RE_NUM_ID = /\{\s*id:\s*(\d+)\s*,[^{}]*?\bprice:\s*(\d+(?:\.\d+)?)/g;

const webappPriceByDashId = new Map<number, { price: number; name: string }>();
for (const item of weeklyMenu) {
  webappPriceByDashId.set(WEBAPP_TO_DASH[item.id] ?? item.id, { price: item.price, name: item.name });
}

let dashChanged = 0;
for (let i = 0; i < dashLines.length; i++) {
  let line = dashLines[i];
  if (!line.includes('price:')) continue;

  // 字符串 id（加料 / 套餐 / 餐券包 / DISH_LIBRARY）
  RE_STR_ID.lastIndex = 0;
  for (let m = RE_STR_ID.exec(line); m; m = RE_STR_ID.exec(line)) {
    const [, id, numStr] = m;
    const was = Number(numStr);
    // legacy `addon-*` 是同一样东西的旧编号 → 按 canonical 的价来
    const canonId = LEGACY_LIBRARY_MAP[id];
    const want = canonId ? ADD_ON_PRICES[canonId] : ADD_ON_PRICES[id];
    if (want === undefined) {                 // dashboard 独有（off-menu 汤、饮品、退役项…）
      if (/^[a-z][a-z0-9-]*$/.test(id)) unmanaged.set(id, was);
      continue;
    }
    scanned++;
    if (near(want, was)) continue;
    const label = canonId ? `${id}（legacy → ${canonId}）` : id;
    drift.push({ file: 'dashboard', line: i + 1, id: label, was, want, context: line.trim().slice(0, 70) });
    if (FIX) { line = replacePrice(line, m.index, numStr, want); dashChanged++; RE_STR_ID.lastIndex = 0; }
  }

  // 数字 id（MENU_SEED 主菜）
  RE_NUM_ID.lastIndex = 0;
  for (let m = RE_NUM_ID.exec(line); m; m = RE_NUM_ID.exec(line)) {
    const [, idStr, numStr] = m;
    const dashId = Number(idStr);
    const was = Number(numStr);
    const webappId = webappIdOfDash(dashId);
    const ref = webappPriceByDashId.get(dashId);
    if (webappId === null || !ref) continue;  // dashboard 独有的菜，网站没有 → 不管
    scanned++;
    if (near(ref.price, was)) continue;
    drift.push({ file: 'dashboard', line: i + 1, id: `菜#${dashId} ${ref.name}`, was, want: ref.price, context: line.trim().slice(0, 70) });
    if (FIX) { line = replacePrice(line, m.index, numStr, ref.price); dashChanged++; RE_NUM_ID.lastIndex = 0; }
  }

  dashLines[i] = line;
}
if (FIX && dashChanged > 0) fs.writeFileSync(DASHBOARD, dashLines.join(DASH_EOL), 'utf-8');

// ── ③ webapp 自己的 p()/rm() 兜底值 ─────────────────────────────────────────
const RE_FALLBACK = /\b(?:p|rm)\('([^']+)',\s*(\d+(?:\.\d+)?)\)/g;
for (const rel of (process.env.PRICE_SYNC_SKIP_WEBAPP ? [] : WEBAPP_FALLBACK_FILES)) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) continue;
  const raw = fs.readFileSync(abs, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    RE_FALLBACK.lastIndex = 0;
    for (let m = RE_FALLBACK.exec(line); m; m = RE_FALLBACK.exec(line)) {
      const [, id, numStr] = m;
      const want = ADD_ON_PRICES[id];
      if (want === undefined) { advisory.push(`${rel}:${i + 1} 兜底价引用了未登记的 add-on「${id}」`); continue; }
      scanned++;
      const was = Number(numStr);
      if (near(want, was)) continue;
      drift.push({ file: rel, line: i + 1, id: `${id}（兜底值）`, was, want, context: line.trim().slice(0, 70) });
      if (FIX) {
        const at = line.indexOf(numStr, m.index);
        line = line.slice(0, at) + money(want) + line.slice(at + numStr.length);
        changed++; RE_FALLBACK.lastIndex = 0;
      }
    }
    lines[i] = line;
  }
  if (FIX && changed > 0) fs.writeFileSync(abs, lines.join(eol), 'utf-8');
}

// ── 别名对必须同价 ──────────────────────────────────────────────────────────
for (const [canon, alias] of ALIAS_PAIRS) {
  const a = ADD_ON_PRICES[canon], b = ADD_ON_PRICES[alias];
  if (a === undefined || b === undefined) continue;
  if (!near(a, b)) {
    advisory.push(`别名不同价：「${canon}」RM${money(a)} vs「${alias}」RM${money(b)} —— 同一样东西，改价时两个都要动（在 addOnsConfig.ts 里改）`);
  }
}

// ── 输出 ────────────────────────────────────────────────────────────────────
console.log(`\n=== 价格同步检查 ${FIX ? '【--fix 已改写】' : '【只读】'} ===`);
console.log(`权威源：ADD_ON_PRICES ${Object.keys(ADD_ON_PRICES).length} 项 · weeklyMenu ${weeklyMenu.length} 道菜`);
console.log(`扫描到受管价格字面量 ${scanned} 处\n`);

if (drift.length === 0) {
  console.log('✅ 全部一致，没有旧价。\n');
} else {
  console.log(`${FIX ? '🔧 已修正' : '✗ 漂移'} ${drift.length} 处：`);
  for (const d of drift) {
    console.log(`   ${d.file}:${d.line}  ${d.id}  RM${money(d.was)} → RM${money(d.want)}`);
    console.log(`      ${d.context}`);
  }
  console.log('');
}

if (unmanaged.size) {
  console.log(`ℹ️ dashboard 独有、网站无权威价（本脚本不管，改价请直接改 dashboard）：`);
  console.log('   ' + [...unmanaged].map(([id, p]) => `${id} RM${money(p)}`).join(' · ') + '\n');
}
if (advisory.length) {
  console.log('⚠️ 需人工确认：');
  advisory.forEach(a => console.log(`   ${a}`));
  console.log('');
}

// ── ④ Firestore 主菜价（dashboard 实际读的是它，MENU_SEED 只是兜底） ────────
if ((COMMIT || FIX) && !process.env.PRICE_SYNC_SKIP_FIRESTORE) {
  const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
  if (!fs.existsSync(KEY)) {
    console.log('ℹ️ 无 Firebase 服务账号密钥，跳过 Firestore 主菜价检查。\n');
  } else try {
    const admin = (await import('firebase-admin')).default;
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
    const db = admin.firestore();
    const snap = await db.collection('menu').get();
    const fsDrift: { dashId: string; name: string; was: number; want: number }[] = [];
    for (const item of weeklyMenu) {
      const dashId = String(WEBAPP_TO_DASH[item.id] ?? item.id);
      const doc = snap.docs.find(d => d.id === dashId);
      if (!doc) continue;
      const data = doc.data() as { name?: string; price?: number };
      if (data.name && data.name !== item.name) continue;   // ID 映射漂移，交给 sync:menu 报警
      const was = Number(data.price);
      if (!Number.isFinite(was) || near(was, item.price)) continue;
      fsDrift.push({ dashId, name: item.name, was, want: item.price });
    }
    if (fsDrift.length === 0) {
      console.log('✅ Firestore 主菜价与网站一致。\n');
    } else {
      console.log(`${COMMIT ? '🔧 Firestore 已更新' : '✗ Firestore 主菜价漂移'} ${fsDrift.length} 道：`);
      for (const f of fsDrift) console.log(`   菜#${f.dashId} ${f.name}  RM${money(f.was)} → RM${money(f.want)}`);
      if (COMMIT) {
        for (const f of fsDrift) {
          await db.collection('menu').doc(f.dashId).set(
            { price: f.want, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
        }
      } else {
        console.log('   ▶ 加 --commit 才真写 Firestore。');
      }
      console.log('');
    }
    await admin.app().delete();
  } catch (e) {
    // 断网/权限问题不能把 sync:dashboard 卡死 —— 本地文件那部分已经做完了。
    console.log(`⚠️ Firestore 主菜价这一段没跑成（${e instanceof Error ? e.message : e}），本地文件不受影响。\n`);
  }
}

if (FIX && (dashChanged > 0)) {
  console.log(`▶ dashboard HTML 已改 ${dashChanged} 处，记得 npm run sync:dashboard 推到 public/。\n`);
}

// 只读模式下有漂移就退出码 1（给 sync:dashboard / CI 当闸门）
process.exit(!FIX && drift.length > 0 ? 1 : 0);
