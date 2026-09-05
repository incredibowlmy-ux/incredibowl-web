/**
 * 守住备餐单「套餐展开」的三条不变式。
 * 跑：node --import ./scripts/_register-alias.mjs scripts/dogfood-combo-components.mts
 *
 * 备餐单在算食材之前会把套餐拆成组成项（COMBO_COMPONENTS），这样套餐里的荷包蛋
 * 才能和独立点的荷包蛋并成一行（老板 2026-08-18）。拆解要成立必须同时满足：
 *
 *   ① 展开加总 === 套餐自己那行手写配方  —— 否则拆开会改变采购量
 *   ② 每个组成项都查得到配方           —— 否则 prepUnits 静默整套回落，白改
 *   ③ 组成表与 DISH_COMBOS（src/data/dishCombos.ts）的 parts 一致 —— 那是弹窗里
 *      「包含：」和「原价 RM x」的权威表，套餐内容变了必然改它；对不上就是组成表漂了
 *      （2026-09-05 C2 之前这段是 grep AddOnModal.tsx 源码里的 comboWorth 行，搬家后
 *      扫到 0 个却照样报绿 —— 现在改读数据，且 0 个一律判失败）
 *
 * 新增套餐忘了登记 COMBO_COMPONENTS 也会在 ③ 被点名。
 */
import { COMBO_COMPONENTS, getAddOnRecipe, resolveAddOnAlias } from '@/data/dishIngredients';
import { DISH_COMBOS } from '@/data/dishCombos';
import { DISH_ADDONS_BY_NAME } from '@/data/dishAddonMap.generated';
import type { IngredientLine } from '@/data/dishIngredients';

let pass = 0; const fails: string[] = [];
const ok = (msg: string) => { pass++; console.log(`  ✅ ${msg}`); };
const bad = (msg: string) => { fails.push(msg); console.log(`  ❌ ${msg}`); };

const key = (l: { name: string; unit: string }) => `${l.name}|${l.unit}`;
const fmt = (m: Map<string, number>) => [...m.entries()].filter(([, q]) => q !== 0).sort()
  .map(([k, q]) => `${k.split('|')[0]} ${q}${k.split('|')[1]}`).join(' · ') || '（空）';
const sum = (lines: IngredientLine[], into = new Map<string, number>()) => {
  lines.forEach(l => into.set(key(l), (into.get(key(l)) || 0) + l.qty)); return into;
};

console.log('① 展开加总 === 手写配方（拆开不改变采购量）');
for (const [combo, parts] of Object.entries(COMBO_COMPONENTS)) {
  const written = getAddOnRecipe(combo);
  if (!written) { bad(`${combo}：套餐自己那行手写配方查不到`); continue; }
  const derived = new Map<string, number>(); const missing: string[] = [];
  for (const p of parts) { const r = getAddOnRecipe(p); if (r) sum(r, derived); else missing.push(p); }
  if (missing.length) { bad(`${combo}：组成项无配方 → ${missing.join('、')}（会整套回落，拆解失效）`); continue; }
  const w = sum(written);
  const diff = [...new Set([...w.keys(), ...derived.keys()])]
    .filter(k => Math.abs((w.get(k) || 0) - (derived.get(k) || 0)) > 1e-6);
  if (diff.length) bad(`${combo}\n       手写 = ${fmt(w)}\n       展开 = ${fmt(derived)}`);
  else ok(`${combo.replace(/\s*\([^)]*\)$/, '').padEnd(12)} = ${parts.join(' + ')}`);
}

console.log('\n② 组成项 label 都能被 resolveAddOnAlias 认出（手动单短 label 也要通）');
const allParts = [...new Set(Object.values(COMBO_COMPONENTS).flat())];
const unresolved = allParts.filter(p => !getAddOnRecipe(resolveAddOnAlias(p)));
if (unresolved.length) bad(`别名解析不了：${unresolved.join('、')}`);
else ok(`${allParts.length} 个组成项全部可解析`);

console.log('\n③ 组成表 vs DISH_COMBOS 的 parts（弹窗「包含：」/「原价」的权威表）');
const idToLabel = new Map<string, string>();
for (const opts of Object.values(DISH_ADDONS_BY_NAME)) for (const o of opts) if (!idToLabel.has(o.id)) idToLabel.set(o.id, o.label);
const EXTRA_ID_LABEL: Record<string, string> = { 'onsen-egg-side': '温泉蛋', 'extra-edamame-side': '清甜水煮毛豆仁', 'extra-corn-side': '玉米' };
let checked = 0;
const seenCombo = new Set<string>();
for (const cfg of Object.values(DISH_COMBOS)) {
  for (const combo of cfg.combos || []) {
    // 同一个套餐可能挂在多道菜下（14/26 共用一条配置），只校一次
    if (seenCombo.has(combo.item.id)) continue;
    seenCombo.add(combo.item.id);
    const partIds = combo.parts.map(p => p.id);
    if (!partIds.length) { bad(`套餐 ${combo.item.id} 没有 parts`); continue; }
    const comboLabel = idToLabel.get(combo.item.id);
    if (!comboLabel) { bad(`套餐 id ${combo.item.id} 在 DISH_ADDONS_BY_NAME 里找不到 label（dashboard 加料表没同步？）`); continue; }
    const registered = COMBO_COMPONENTS[resolveAddOnAlias(comboLabel)];
    if (!registered) { bad(`「${comboLabel}」在售但没登记 COMBO_COMPONENTS → 备餐单不会拆它`); continue; }
    const expect = partIds.map(p => idToLabel.get(p) || EXTRA_ID_LABEL[p] || `?${p}`);
    checked++;
    if (expect.join('|') !== registered.join('|')) bad(`「${comboLabel}」组成漂了\n       DISH_COMBOS = ${expect.join(' + ')}\n       组成表      = ${registered.join(' + ')}`);
  }
}
// 探针自检：扫到 0 个套餐不是「全过」，是读错了地方
if (checked === 0) bad('DISH_COMBOS 里一个套餐都没扫到 —— 探针失效，不当通过');
else ok(`${checked} 个在售套餐与 DISH_COMBOS 一致`);

console.log(`\n${fails.length ? '❌' : '✅'} ${pass} 通过 / ${fails.length} 失败`);
process.exit(fails.length ? 1 : 0);
