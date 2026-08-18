/**
 * 守住备餐单「套餐展开」的三条不变式。
 * 跑：node --import ./scripts/_register-alias.mjs scripts/dogfood-combo-components.mts
 *
 * 备餐单在算食材之前会把套餐拆成组成项（COMBO_COMPONENTS），这样套餐里的荷包蛋
 * 才能和独立点的荷包蛋并成一行（老板 2026-08-18）。拆解要成立必须同时满足：
 *
 *   ① 展开加总 === 套餐自己那行手写配方  —— 否则拆开会改变采购量
 *   ② 每个组成项都查得到配方           —— 否则 prepUnits 静默整套回落，白改
 *   ③ 组成表与 AddOnModal 的 comboWorth 一致 —— 那是算「原价 RM x」的权威表，
 *      套餐内容变了必然改它；这里对不上就是组成表漂了
 *
 * 新增套餐忘了登记 COMBO_COMPONENTS 也会在 ③ 被点名。
 */
import fs from 'node:fs';
import { COMBO_COMPONENTS, getAddOnRecipe, resolveAddOnAlias } from '@/data/dishIngredients';
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

console.log('\n③ 组成表 vs AddOnModal 的 comboWorth（权威定价表）');
const SRC = fs.readFileSync('src/components/menu/AddOnModal.tsx', 'utf-8');
const idToLabel = new Map<string, string>();
for (const opts of Object.values(DISH_ADDONS_BY_NAME)) for (const o of opts) if (!idToLabel.has(o.id)) idToLabel.set(o.id, o.label);
const EXTRA_ID_LABEL: Record<string, string> = { 'onsen-egg-side': '温泉蛋', 'extra-edamame-side': '清甜水煮毛豆仁', 'extra-corn-side': '玉米' };
let checked = 0;
for (const line of SRC.split('\n')) {
  const m = line.match(/comboWorth\(\s*'([^']+)'/);
  if (!m) continue;
  const partIds = [...line.matchAll(/\['([^']+)',\s*[\d.]+\]/g)].map(x => x[1]);
  if (!partIds.length) continue;
  const comboLabel = idToLabel.get(m[1]);
  if (!comboLabel) { bad(`套餐 id ${m[1]} 在 DISH_ADDONS_BY_NAME 里找不到 label（dashboard 加料表没同步？）`); continue; }
  const registered = COMBO_COMPONENTS[resolveAddOnAlias(comboLabel)];
  if (!registered) { bad(`「${comboLabel}」在售但没登记 COMBO_COMPONENTS → 备餐单不会拆它`); continue; }
  const expect = partIds.map(p => idToLabel.get(p) || EXTRA_ID_LABEL[p] || `?${p}`);
  checked++;
  if (expect.join('|') !== registered.join('|')) bad(`「${comboLabel}」组成漂了\n       comboWorth = ${expect.join(' + ')}\n       组成表     = ${registered.join(' + ')}`);
}
ok(`${checked} 个在售套餐与 comboWorth 一致`);

console.log(`\n${fails.length ? '❌' : '✅'} ${pass} 通过 / ${fails.length} 失败`);
process.exit(fails.length ? 1 : 0);
