/**
 * 重建 Firestore 的 menu.costPrice / addons.costPrice。
 *
 * 为什么有这个脚本：2026-09-15 22:57 dashboard 读到 menu/addons 空集合 → 走 auto-seed
 * 整体重建 → 27 道菜 + 77 加料的 costPrice 全部被冲成 0；而 Firestore PITR 是关的
 * （versionRetentionPeriod 1 小时），捞不回来。成本价只活在 Firestore = 没有第二份，
 * 所以这个脚本把「老板的成本表 + 配方」重新算成唯一可重放的还原路径。
 * 老板补完成本表里缺的菜之后，直接重跑这一条命令即可。
 *
 * ── 数据来源与口径（会写进日志，事后可追溯）────────────────────────────────
 *   主菜 = 老板 Costing v5「Dish Costing 菜品成本」区块的**版本 A**，每份，
 *          **已剔除包装/餐具**（包装在 dashboard 是独立口径 packaging.ts /
 *          ingredientStock，算进 costPrice 会双算）
 *   加料 = addOnRecipes 配方 × Ingredient Costing「True Cost/Unit 实际单价」
 *          加料多是单一食材，两边口径基本重合；**主菜不能这样算** —— 主菜配方按设计
 *          不含油/盐/胡椒/蒜（见 dishIngredients.ts 开头），实测比老板成本表平均低 ~9%。
 *          加料算的是**边际**成本，如「换糙米」= +糙米90g −白饭80g 的净额（dashboard 是
 *          在主菜成本之上加加料成本，所以边际才是对的口径）。
 *
 * ── 护栏 ──────────────────────────────────────────────────────────────
 *   · 单价行号与成本表逐行核名（老板增删行会移位），对不上 exit 1
 *   · 单位不兼容（表按 pcs 计价、配方按 g）→ 判缺数据，绝不硬乘
 *   · 自洽校验：我加总的食材 RM 必须等于老板那行合计(±0.02)，否则弃用该版本
 *   · 无可靠来源的一律**不写**（留 0 = dashboard 明确标「缺成本」并排除出毛利计算，
 *     比写一个偏低的数字安全 —— 低估成本 = 高估毛利）
 *   · 默认 dry-run；--commit 才写，并把每个文档的旧值写进 scripts/logs/ 回滚日志
 *
 * 用法：
 *   npx tsx scripts/restore-cost-prices.mts            # dry-run，只打印
 *   npx tsx scripts/restore-cost-prices.mts --commit   # 真写
 */
import fs from 'fs';
import admin from 'firebase-admin';
// @ts-expect-error —— 零依赖 xlsx 读取器，纯 JS
import { readSheet } from './lib/xlsx.mjs';
import { addOnRecipes } from '../src/data/dishIngredients';
import { DISH_ADDONS_BY_NAME } from '../src/data/dishAddonMap.generated';

const COMMIT = process.argv.includes('--commit');
const XLSX = process.env.COSTING_V5
  ?? 'C:/Users/User/Desktop/Incredibowl Services/Costing/incredibowl_costing_v5.xlsx';
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';

type Row = { r: number; c: string[] };
const at = (rw: Row, i: number) => (rw.c[i] ?? '').trim();
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r4 = (x: number) => Math.round(x * 10000) / 10000;

// ═══════════════ 1. 食材真单价（Ingredient Costing）═══════════════
// 列：A 序号 | B 食材 | C 类别 | D 单位 | E 包装数量 | F 单价 | G 总价 | H 出成率 | I 可用量 | J 实际单价
type Ing = { row: number; name: string; unit: string; true: number };
const ING: Ing[] = [];
for (const rw of readSheet(XLSX, 'Ingredient Costing') as Row[]) {
  if (!/^\d+$/.test(at(rw, 0))) continue;          // 跳过分类标题行
  const name = at(rw, 1), unit = at(rw, 3), tru = num(at(rw, 9));
  if (!name || !Number.isFinite(tru) || tru <= 0) continue;
  ING.push({ row: rw.r, name, unit, true: tru });
}

// ── 配方食材名 → 成本表行号（行号锁定；跑前按名字核一遍，对不上直接停）───────
const MAP: Record<string, number> = {
  '西兰花': 36, '鸡蛋(生)': 26, '白饭': 28, '糙米': 29, '马铃薯': 39,
  '毛豆': 45, '玉米': 46, '樱桃番茄': 35, '鸡扒': 7, '鸡全腿': 5,
  '顶级无皮五花肉': 14, '顶级有皮五花肉': 15, '鸡胸肉': 6, '椰菜花': 37,
  '云耳': 52, '海苔': 53, '酱油': 68, '豆腐': 65, '巴丁鱼片': 17,
  '葱': 43, '姜': 55, '当归': 54, '白萝卜': 38, '山药': 44,
  '顶级梅花肉片': 8,
  '黄洋葱': 42, '红萝卜': 41, '黑橄榄': 47, '纳豆': 63, '臭豆': 48,
  'PD31/40 虾': 20, 'PD51/60 虾': 23, '澳洲和牛饼': 18,
  // 下面两项成本表按 pcs 计价、配方按 g → 会被单位检查判为缺数据（故意的，见文件头）
  '三文鱼': 16, '柠檬': 31,
};
const ALIAS: Record<string, string> = {
  '西兰花': '西兰花', '鸡蛋(生)': '鸡蛋', '白饭': '白米', '糙米': '糙米', '马铃薯': '马铃薯',
  '毛豆': '毛豆', '玉米': '玉米', '樱桃番茄': '樱桃番茄', '鸡扒': '鸡扒', '鸡全腿': '鸡腿',
  '顶级无皮五花肉': '无皮五花', '顶级有皮五花肉': '有皮五花', '鸡胸肉': '鸡胸', '椰菜花': '椰菜花',
  '云耳': '云耳', '海苔': '海苔', '酱油': '酱油', '豆腐': '豆腐', '巴丁鱼片': '巴丁鱼',
  '葱': 'Scallion', '姜': 'Ginger', '当归': '当归', '白萝卜': '白萝卜', '山药': '山药',
  '顶级梅花肉片': '西班牙花肉(涮)',
  '黄洋葱': 'Onion', '红萝卜': 'Carrot', '黑橄榄': '黑橄榄', '纳豆': 'Natto', '臭豆': 'Petai',
  'PD31/40 虾': 'PD31/40', 'PD51/60 虾': 'PD51/60', '澳洲和牛饼': 'Wagyu Patty',
  '三文鱼': '三文鱼', '柠檬': 'Lemon',
};
{
  const bad: string[] = [];
  for (const [k, row] of Object.entries(MAP)) {
    const ing = ING.find(i => i.row === row);
    const want = ALIAS[k] ?? k;
    if (!ing) bad.push(`${k} -> 行 ${row} 不存在`);
    else if (!ing.name.includes(want)) bad.push(`${k} -> 行 ${row} 是「${ing.name}」，不含「${want}」`);
  }
  if (bad.length) {
    console.error(`❌ MAP 行号与成本表对不上（老板动过行？）先修 MAP 再跑：\n  ${bad.join('\n  ')}`);
    process.exit(1);
  }
}
// 成本表没单列但有确定来源的（绝不自己推）
const FIXED: Record<string, { per: number; unit: string; src: string }> = {
  '温泉蛋': { per: 1.1 * 0.438596, unit: '颗', src: '生鸡蛋C 0.4386 x 1.1 破损率（老板 2026-08-10）' },
  '鳗鱼':   { per: 5.225 / 0.5,    unit: '片', src: '半片进价 RM5.225（老板 2026-07-31）' },
};
// 配方存生重，成本表真单价已是熟重/可用重 → 换算系数
const COOKED: Record<string, number> = {
  '顶级无皮五花肉': 0.625, '顶级有皮五花肉': 0.641,
  '白饭': 150 / 70, '糙米': 150 / 90, '顶级梅花肉片': 70 / 125,
};
const PCS = new Set(['只', '块', '颗', '片', '包', '盒', '份', 'pcs', 'pkt']);
const factor = (iu: string, ru: string): number | null =>
  iu === 'kg' && ru === 'g' ? 0.001 : iu === ru ? 1
    : (iu === 'pcs' || iu === 'pkt') && PCS.has(ru) ? 1 : null;

// 逐食材的单位换算豁免 —— 只放**老板明确给过的**换算，绝不自己推。
// 没有条目的单位冲突一律判缺数据（宁可留 0 让 dashboard 标「缺成本」）。
const UNIT_OVERRIDE: Record<string, { ingUnit: string; recUnit: string; f: number; src: string }> = {
  // 老板 2026-07-14 把小番茄份量全局从 40g 改成 20g（价不变），每份 2 颗；
  // 2026-09-17 再确认「2 pcs」→ 1 颗 = 10g。成本表按 kg 计价，故 颗→kg = 10 × 0.001。
  // ⚠️ 老板成本表「香煎金黄鸡扒饭」区块仍写着 40g（07-14 之前的旧份量），那道菜的成本
  //    直接取自该区块，所以会略偏高 —— 偏高是安全方向，不动他的表。
  '樱桃番茄': { ingUnit: 'kg', recUnit: '颗', f: 10 * 0.001, src: '1 颗 = 10g（老板 07-14 定 20g/份 = 2 颗；09-17 确认 2 pcs）' },
  // 老板 2026-09-17 确认：一份三文鱼 = 生重 120g（熟重 70g，失水 ~42%，与 08-01 口径一致）。
  // 成本表按 pcs 计 RM6 → 1 pcs = 120g 生重。配方存的就是生重 120g。
  '三文鱼': { ingUnit: 'pcs', recUnit: 'g', f: 1 / 120, src: '1 pcs = 120g 生重 / 70g 熟重（老板 2026-09-17 确认）' },
};

// 配方**本身**已知不完整的加料 —— missing 检查抓不到（缺的那行被注释掉了，不在配方里），
// 但照算会得出假精确的高毛利。明确挡掉，等老板给数。
const RECIPE_INCOMPLETE: Record<string, string> = {
  'cherry-tomato-salad': '配方里洋葱克数是 TODO_CONFIRM（src/data/dishIngredients.ts:563），只算番茄会严重低估',
};

function recipeCost(lines: { name: string; qty: number; unit: string }[]) {
  let rm = 0; const missing: string[] = [];
  for (const l of lines) {
    const fx = FIXED[l.name];
    if (fx) {
      if (factor(fx.unit, l.unit) === null) missing.push(`${l.name}(单位${l.unit}!=${fx.unit})`);
      else rm += l.qty * fx.per;
      continue;
    }
    const ing = MAP[l.name] ? ING.find(i => i.row === MAP[l.name]) : undefined;
    if (!ing) { missing.push(`${l.name}(无单价)`); continue; }
    const ov = UNIT_OVERRIDE[l.name];
    const f = ov && ov.ingUnit === ing.unit && ov.recUnit === l.unit ? ov.f : factor(ing.unit, l.unit);
    if (f === null) { missing.push(`${l.name}(配方${l.unit}/表${ing.unit})`); continue; }
    rm += l.qty * (COOKED[l.name] ?? 1) * ing.true * f;
  }
  return { rm: Math.round(rm * 100) / 100, missing };
}

// ═══════════════ 2. 菜品区块（Dish Costing 菜品成本）═══════════════
// 一个 🥣 区块 = 一道菜；区块第二行是口径声明（"Batch成本 | ÷5份" 或 "Per Portion"）。
// 区块里可能塞了不止一张表（r319 姜葱鱼片饭的下半截 r351 起是另一道三文鱼饭，没有自己
// 的 🥣 标题）→ 按「食材 Ingredient」表头切子表，每张单独算。
// 同一张表里 用量/RM 成对出现（F,G / H,I / J,K …）= 版本 A/B/C/D/E。
// 合计单元格跨列合并（版本A常落在 C 列，B/C/D 落在 H/J/L）→ 扫全行按值找。
const PACK = new RegExp([   // 包装/餐具明确清单，对应 Ingredient Costing r92~r107
  'Paper Bag', 'Wooden Spoon', 'Pulp Box', 'Paper Bowl', 'Soup Tub', 'Single Tray',
  'Glass Bottle', 'Plastic Spoon', 'Bamboo Chopstick', 'Plastic Food Container',
  'PP Cup', 'Paper Straw', 'Cup Holder', 'Paper Sheet', 'Coffee Cup',
  '餐盒', '打包碗', '纸袋', '餐具',
].join('|'), 'i');

const dishRows = readSheet(XLSX, 'Dish Costing 菜品成本') as Row[];
const blockStarts = dishRows
  .map((rw, i) => [i, at(rw, 0)] as const)
  .filter(([i, v]) => v.startsWith('🥣') && dishRows[i].r !== 1)
  .map(([i]) => i);

type SubTable = {
  block: string; subTable: number; sheetRow: number; divisor: number | null;
  versions: { v: string; matched: boolean; packaging: number; perPortionExPack: number | null }[];
};
const SUBS: SubTable[] = [];
blockStarts.forEach((s, k) => {
  const seg = dishRows.slice(s, blockStarts[k + 1] ?? dishRows.length);
  const block = at(seg[0], 0).replace(/^🥣\s*/, '');
  const note = at(seg[1], 0);
  const m = note.match(/÷\s*(\d+)\s*份/);
  const divisor = m ? Number(m[1]) : (/Per\s*Portion/i.test(note) ? 1 : NaN);
  const heads = seg.map((rw, i) => (at(rw, 1).startsWith('食材') ? i : -1)).filter(i => i >= 0);

  heads.forEach((h, ti) => {
    const end = heads[ti + 1] ?? seg.length;
    const head = seg[h];
    const rmCols: number[] = [];
    for (let i = 5; i < head.c.length - 1; i += 2)
      if (at(head, i) === '用量' && at(head, i + 1) === 'RM') rmCols.push(i + 1);

    const ings: Row[] = [], totals: Row[] = [];
    for (let i = h + 1; i < end; i++) {
      const rw = seg[i], a = at(rw, 0);
      // 食材行：A 是 ≤60 的序号、B 有名字、D 有单价。中间空行不中断（老板表有断档）。
      if (/^\d+$/.test(a) && Number(a) <= 60 && at(rw, 1) && !Number.isNaN(num(at(rw, 3)))) ings.push(rw);
      else totals.push(rw);
    }
    const sub: SubTable = {
      block, subTable: ti, sheetRow: seg[h].r,
      divisor: Number.isFinite(divisor) ? divisor : null, versions: [],
    };
    rmCols.forEach((rmCol, vi) => {
      let all = 0, pack = 0, used = 0;
      for (const rw of ings) {
        const rm = num(at(rw, rmCol));
        if (!Number.isFinite(rm) || rm === 0) continue;
        all += rm; used++;
        if (PACK.test(at(rw, 1))) pack += rm;
      }
      if (used === 0) return;                       // 整列留空 = 不用这个版本
      let his: number | null = null;
      outer: for (const rw of totals)
        for (let col = 0; col < Math.max(20, rw.c.length); col++) {
          const val = num(at(rw, col));
          if (Number.isFinite(val) && Math.abs(val - all) < 0.02) { his = val; break outer; }
        }
      const ok = his !== null && Number.isFinite(divisor) && divisor > 0;
      sub.versions.push({
        v: String.fromCharCode(65 + vi), matched: his !== null, packaging: r4(pack),
        perPortionExPack: ok ? r4((all - pack) / (divisor as number)) : null,
      });
    });
    SUBS.push(sub);
  });
});

// 成本表子表「区块名|子表序号」→ dashboard menu 文档 id（手写；对不上就停）
const BLOCK2ID: Record<string, string> = {
  '希腊柠香烤鸡胸 Greek Mediterranean Lemon Chicken|0': '3',
  '山药云耳海陆双鲜炒 Surf & Turf Yam Stir-Fry|0': '12',
  '招牌当归原汁蒸鸡全腿 Signature Angelica Steamed Chicken|0': '13',
  '纳豆月见海苔饭 Natto Tsukimi Seaweed Rice Bowl|0': '11',
  '马铃薯炖花肉片 Potato Braised Pork Belly|0': '4',
  '香煎金黄鸡扒饭 Pan-Fried Golden Chicken Chop Rice|0': '1',
  '金黄葱香煎鸡腿汤 Golden Scallion Chicken Soup|0': '5',
  '阿嫲古早味酱油鸡全腿|0': '14',
  '绍兴酒蒸花肉|0': '2',
  '姜葱鱼片饭|0': '20',
  '姜葱鱼片饭|1': '21',   // 该子表没有自己的 🥣 标题，是三文鱼饭（售价列 24.90）
  '和牛肉饼饭|0': '24',
  'D13 臭豆饭|0': '22',
  '豆瓣酱蒸花肉|0': '23',
  '古早味卤三层肉豆腐蛋 Hometown Braised Pork Belly with Tofu & Egg|0': '31',
};
const wbById = new Map<string, SubTable>();
for (const sub of SUBS) {
  const key = `${sub.block}|${sub.subTable}`;
  if (!BLOCK2ID[key]) {
    console.error(`❌ 成本表子表「${key}」没登记（老板新加了菜？）先补 BLOCK2ID 再跑`);
    process.exit(1);
  }
  wbById.set(BLOCK2ID[key], sub);
}

// ═══════════════ 3. 算 + 打印 + 写 ═══════════════
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

const menuSnap = await db.collection('menu').get();
const menu = menuSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  .sort((a, b) => Number(a.id) - Number(b.id));
const dishWrites: any[] = [], dishSkips: any[] = [];
for (const m of menu) {
  const price = Number(m.price) || 0;
  const sub = wbById.get(String(m.id));
  const vA = sub?.versions.find(v => v.v === 'A' && v.matched);
  if (!vA || vA.perPortionExPack === null) {
    dishSkips.push({ id: m.id, name: m.name, price, reason: sub ? '成本表版本A自洽校验不过' : '成本表没有这道菜' });
    continue;
  }
  const cost = vA.perPortionExPack;
  if (!(cost > 0)) { dishSkips.push({ id: m.id, name: m.name, price, reason: '成本表算出 0' }); continue; }
  if (price > 0 && cost / price > 0.85) {
    dishSkips.push({ id: m.id, name: m.name, price, reason: `成本占售价 ${(cost / price * 100).toFixed(0)}% 不合理，人工核` });
    continue;
  }
  dishWrites.push({
    id: m.id, name: m.name, price, old: Number(m.costPrice) || 0, cost,
    gm: price > 0 ? (price - cost) / price : null,
    src: `Costing v5 / Dish Costing r${sub!.sheetRow} 版本A 每份(÷${sub!.divisor}) 剔包装RM${vA.packaging}`,
  });
}

const labelOfId: Record<string, string> = {};
for (const opts of Object.values(DISH_ADDONS_BY_NAME) as any[])
  for (const o of opts) labelOfId[o.id] = o.label;
const addonSnap = await db.collection('addons').get();
const addonWrites: any[] = [], addonSkips: any[] = [];
for (const d of addonSnap.docs) {
  const a: any = { id: d.id, ...d.data() };
  const label = labelOfId[d.id] ?? a.name;
  const full = Object.keys(addOnRecipes).find(k => k.startsWith(label + ' (原价'));
  const key = full || (addOnRecipes[label] ? label : (addOnRecipes[a.name] ? a.name : undefined));
  const recipe = key ? addOnRecipes[key] : undefined;
  const price = Number(a.price) || 0;
  if (RECIPE_INCOMPLETE[d.id]) { addonSkips.push({ id: d.id, name: a.name, price, reason: RECIPE_INCOMPLETE[d.id] }); continue; }
  if (!recipe || recipe.length === 0) { addonSkips.push({ id: d.id, name: a.name, price, reason: '无配方' }); continue; }
  const { rm, missing } = recipeCost(recipe);
  if (missing.length) { addonSkips.push({ id: d.id, name: a.name, price, reason: '配方缺单价: ' + missing.join(' ') }); continue; }
  if (!(rm > 0)) { addonSkips.push({ id: d.id, name: a.name, price, reason: '算出 0（净额抵消）' }); continue; }
  if (price > 0 && rm / price > 1) { addonSkips.push({ id: d.id, name: a.name, price, reason: `成本 RM${rm} > 售价，人工核` }); continue; }
  addonWrites.push({
    id: d.id, name: a.name, price, old: Number(a.costPrice) || 0, cost: rm,
    gm: price > 0 ? (price - rm) / price : null, src: `addOnRecipes「${key}」× Costing v5 真单价（边际口径）`,
  });
}

const pct = (x: number | null) => (x === null ? '' : (x * 100).toFixed(1) + '%');
console.log(`\n成本表：食材 ${ING.length} 项 / 菜品子表 ${SUBS.length} 张（来自 ${blockStarts.length} 个区块）`);
console.log(`\n═══ 主菜：写 ${dishWrites.length} 道 / 跳过 ${dishSkips.length} 道 ═══`);
console.log('id  菜名                 售价    旧值    新成本   毛利率');
for (const w of dishWrites)
  console.log(`${String(w.id).padStart(2)}  ${w.name.slice(0, 10).padEnd(12)} ${w.price.toFixed(2).padStart(6)}  ${w.old.toFixed(2).padStart(5)}  ${('RM' + w.cost.toFixed(2)).padStart(8)}  ${pct(w.gm).padStart(6)}`);
console.log('\n跳过（不写数字；留 0 = dashboard 会标「缺成本」并排除出毛利计算）：');
const recipeByName = new Map(
  (await import('../src/data/dishIngredients')).dishRecipes.map((d: any) => [d.name, d.ingredients]));
for (const s of dishSkips) {
  // --estimates：顺便打出「配方推算」值给老板参考。⚠️ 只是参考，**不写库** ——
  // 在两边都有数的 7 道菜上实测偏差 -38%~+16%（均值 -9%），因为配方按设计不含油盐蒜胡椒。
  let est = '';
  if (process.argv.includes('--estimates')) {
    const rec = recipeByName.get(s.name);
    if (rec) {
      const { rm, missing } = recipeCost(rec as any);
      est = `  [配方推算 RM${rm.toFixed(2)}${missing.length ? ' ⚠缺:' + missing.join(' ') : ''}]`;
    } else est = '  [无配方]';
  }
  console.log(`  #${String(s.id).padStart(2)} ${s.name.padEnd(14)} RM${s.price.toFixed(2)}  ${s.reason}${est}`);
}

console.log(`\n═══ 加料：写 ${addonWrites.length} 个 / 跳过 ${addonSkips.length} 个 ═══`);
for (const w of addonWrites)
  console.log(`  ${w.id.padEnd(30)} ${w.name.slice(0, 16).padEnd(18)} 价${w.price.toFixed(2).padStart(6)}  成本RM${w.cost.toFixed(2).padStart(6)}  毛利${pct(w.gm)}`);
if (addonSkips.length) {
  console.log('\n加料跳过：');
  for (const s of addonSkips) console.log(`  ${s.id.padEnd(30)} ${s.name.slice(0, 16).padEnd(18)} ${s.reason}`);
}

if (!COMMIT) {
  console.log('\n[dry-run] 没有写任何东西。确认后加 --commit 再跑。');
} else {
  const logPath = `scripts/logs/restore-cost-prices-${Date.now()}.json`;
  fs.writeFileSync(logPath, JSON.stringify({
    ranAt: new Date().toISOString(), script: 'restore-cost-prices.mts',
    reason: '2026-09-15 dashboard 空读 re-seed 把 costPrice 全部清零，按 Costing v5 重建',
    source: { workbook: XLSX, sheets: ['Dish Costing 菜品成本', 'Ingredient Costing'] },
    dishes: dishWrites, addons: addonWrites, skippedDishes: dishSkips, skippedAddons: addonSkips,
  }, null, 1));
  let batch = db.batch(), n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const w of dishWrites) {
    batch.set(db.collection('menu').doc(String(w.id)),
      { costPrice: w.cost, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    if (++n >= 400) await flush();
  }
  for (const w of addonWrites) {
    batch.set(db.collection('addons').doc(w.id),
      { costPrice: w.cost, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    if (++n >= 400) await flush();
  }
  await flush();
  console.log(`\n✅ 已写入：主菜 ${dishWrites.length} 道 + 加料 ${addonWrites.length} 个`);
  console.log(`   回滚日志（含每个文档旧值）：${logPath}`);
}
await admin.app().delete();
