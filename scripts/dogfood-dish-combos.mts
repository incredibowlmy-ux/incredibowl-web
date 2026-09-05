/**
 * Dogfood：按菜品定制的加料配置（src/data/dishCombos.ts）与它的组装器
 * buildAddOnSections（src/components/menu/addOnSections.ts）。
 *
 * 2026-09-05 C2 把 AddOnModal 里 18 个 `if (dish.id === N)` 分支搬成数据后，套餐的
 * comboWorth 组件表不再是 AddOnModal.tsx 里的源码行 —— dogfood-combo-components 的
 * 第 ③ 段（grep AddOnModal.tsx 源码）从此扫不到东西，这里用真实数据把同一条不变式
 * 接回来（套餐组成 vs COMBO_COMPONENTS），再守住几条数据层面的一致性：
 *
 *   · 每道菜都能组装出分区，且同一道菜里 item id / section id 不重复
 *     （alacarteExclude 存在的意义就是这个：温泉蛋挪进配菜后单点区必须滤掉）
 *   · 配置里出现的每个加料 id 都在 ADD_ON_PRICES 里有价，兜底价 = 现价
 *     （sync-dashboard-prices 只扫 AddOnModal.tsx 的 p() 兜底值，搬走后由这里守）
 *   · 每个套餐都登记在 COMBO_COMPONENTS，组成与 parts 一致（备餐拆解靠它）
 *   · 套餐 name 里的「(原价 RM x)」= 组件现价合计；titleEn 里的「(+ RM x)」= 套餐现价
 *     （这两处是静态文案，调价忘改就会在弹窗里当场穿帮）
 */
import { DISH_COMBOS } from '@/data/dishCombos';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { COMBO_COMPONENTS, resolveAddOnAlias } from '@/data/dishIngredients';
import { DISH_ADDONS_BY_NAME } from '@/data/dishAddonMap.generated';
import { weeklyMenu } from '@/data/weeklyMenu';
import { buildAddOnSections, defaultAddOnSections } from '@/components/menu/addOnSections';

let pass = 0, fail = 0;
const t = (label: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${label}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

// ── ① 每道菜都能组装，且不出现重复 id ───────────────────────────────────
console.log('① buildAddOnSections：weeklyMenu 每道菜（含 hidden / retired）');
const menuIds = new Set(weeklyMenu.map(d => d.id));
for (const dish of weeklyMenu) {
  let sections: ReturnType<typeof buildAddOnSections> | null = null;
  let threw = '';
  try { sections = buildAddOnSections(dish); } catch (e) { threw = String(e); }
  t(`#${dish.id} ${dish.name}：不抛、返回非空数组${threw ? `（${threw}）` : ''}`, Array.isArray(sections) && sections.length > 0);
  if (!sections) continue;
  const itemIds = sections.flatMap(s => s.items.map(i => i.id));
  const dupItems = itemIds.filter((id, i) => itemIds.indexOf(id) !== i);
  t(`#${dish.id}：加料 id 不重复${dupItems.length ? `（重复：${dupItems.join('、')}）` : ''}`, dupItems.length === 0);
  const secIds = sections.map(s => s.id);
  t(`#${dish.id}：分区 id 不重复`, new Set(secIds).size === secIds.length);
  const hasCfg = dish.id in DISH_COMBOS;
  t(`#${dish.id}：${hasCfg ? '有配置 → 不返回默认分区引用' : '无配置 → 原样返回默认分区（同一引用）'}`,
    hasCfg ? sections !== defaultAddOnSections : sections === defaultAddOnSections);
}

// ── ② DISH_COMBOS 的键与加料 id ────────────────────────────────────────
console.log('\n② DISH_COMBOS 数据一致性');
const cfgKeys = Object.keys(DISH_COMBOS).map(Number);
t(`${cfgKeys.length} 个配置键都是 weeklyMenu 里存在的菜 id`, cfgKeys.every(k => menuIds.has(k)));

const defs: { where: string; id: string; fallback: number }[] = [];
for (const [k, cfg] of Object.entries(DISH_COMBOS)) {
  for (const c of cfg.combos ?? []) {
    defs.push({ where: `#${k} 套餐 ${c.item.id}`, id: c.item.id, fallback: c.item.fallback });
    c.parts.forEach(pt => defs.push({ where: `#${k} 套餐 ${c.item.id} 组件`, id: pt.id, fallback: pt.fallback }));
  }
  (cfg.sides?.items ?? []).forEach(s => defs.push({ where: `#${k} 配菜`, id: s.id, fallback: s.fallback }));
}
const noPrice = defs.filter(d => ADD_ON_PRICES[d.id] === undefined);
t(`配置里 ${defs.length} 处加料 id 全部在 ADD_ON_PRICES 有价${noPrice.length ? `（缺：${noPrice.map(d => `${d.where} ${d.id}`).join('、')}）` : ''}`, noPrice.length === 0);
const drift = defs.filter(d => ADD_ON_PRICES[d.id] !== undefined && !near(ADD_ON_PRICES[d.id], d.fallback));
t(`兜底价 fallback 与 ADD_ON_PRICES 现价一致${drift.length ? `（漂：${drift.map(d => `${d.id} fb=${d.fallback} live=${ADD_ON_PRICES[d.id]}`).join('、')}）` : ''}`, drift.length === 0);

// ── ③ 每个套餐：备餐拆解表 + 静态价文案 ────────────────────────────────
console.log('\n③ 套餐 vs COMBO_COMPONENTS / 「原价」/ 「+ RM」文案');
const idToLabel = new Map<string, string>();
for (const opts of Object.values(DISH_ADDONS_BY_NAME)) for (const o of opts) if (!idToLabel.has(o.id)) idToLabel.set(o.id, o.label);
// 与 dogfood-combo-components 同一张表：这几个 -side 变体在 dashboard 加料表里没有独立 label。
const EXTRA_ID_LABEL: Record<string, string> = { 'onsen-egg-side': '温泉蛋', 'extra-edamame-side': '清甜水煮毛豆仁', 'extra-corn-side': '玉米' };
let combos = 0;
for (const [k, cfg] of Object.entries(DISH_COMBOS)) {
  for (const c of cfg.combos ?? []) {
    combos++;
    const label = idToLabel.get(c.item.id);
    t(`#${k} ${c.item.id}：在 DISH_ADDONS_BY_NAME 有 label`, !!label);
    const registered = label ? COMBO_COMPONENTS[resolveAddOnAlias(label)] : undefined;
    t(`#${k} ${c.item.id}：已登记 COMBO_COMPONENTS`, !!registered);
    const expect = c.parts.map(pt => idToLabel.get(pt.id) || EXTRA_ID_LABEL[pt.id] || `?${pt.id}`);
    t(`#${k} ${c.item.id}：组成 = ${expect.join(' + ')}`, !!registered && registered.join('|') === expect.join('|'));

    const orig = Number((c.item.name.match(/\(原价 RM ([\d.]+)\)/) || [])[1]);
    const liveTotal = c.parts.reduce((s, pt) => s + (ADD_ON_PRICES[pt.id] ?? pt.fallback), 0);
    t(`#${k} ${c.item.id}：name「原价 RM ${orig}」= 组件现价合计 ${liveTotal.toFixed(2)}`, near(orig, liveTotal));
    const titlePrice = Number((c.titleEn.match(/\(\+ RM ([\d.]+)\)/) || [])[1]);
    const livePrice = ADD_ON_PRICES[c.item.id] ?? c.item.fallback;
    t(`#${k} ${c.item.id}：titleEn「+ RM ${titlePrice}」= 套餐现价 ${livePrice}`, near(titlePrice, livePrice));
    t(`#${k} ${c.item.id}：套餐价 < 组件合计（不然「立省」是负数）`, livePrice < liveTotal);
  }
}
t(`共 ${combos} 个在售套餐被检查（探针：0 个 = 配置读错了）`, combos > 0);

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
