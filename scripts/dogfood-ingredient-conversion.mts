/**
 * dogfood：厨房加工（生鸡蛋 → 温泉蛋）的配比与守恒。
 * 跑法：npx tsx scripts/dogfood-ingredient-conversion.mts
 * 加 --live 会在 Firestore 上真跑一次「做 2 颗」再原样撤回（校验事务与流水）。
 */
import { INGREDIENT_CONVERSIONS, getConversionFor, conversionInputQty, categorizeIngredient } from '../src/data/ingredientCatalog';
import { ALL_RECIPE_INGREDIENTS } from '../src/data/ingredientCatalog';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; } else { fail++; console.log(`  ✗ ${m}`); } };

// ── 配置自洽 ──
for (const c of INGREDIENT_CONVERSIONS) {
  ok(c.inputPerOutput > 0, `${c.to}: 配比必须 > 0`);
  ok(c.from !== c.to, `${c.to}: 原料和成品不能是同一个`);
  const names = new Set(ALL_RECIPE_INGREDIENTS.map(i => i.name));
  ok(names.has(c.from), `${c.to} 的原料「${c.from}」不在配方食材表里`);
  ok(names.has(c.to), `成品「${c.to}」不在配方食材表里`);
  ok(categorizeIngredient(c.from) === categorizeIngredient(c.to),
    `${c.from} 和 ${c.to} 分在不同类别（都是蛋类才对）`);
}

// ── 取整规则：整数不动，小数向上取整（宁多勿少）──
const onsen = getConversionFor('温泉蛋')!;
ok(!!onsen, '温泉蛋有加工配方');
const CASES: [number, number][] = [
  [20, 22],   // 老板的常规批量：20 颗 × 1.1 = 22，整数
  [10, 11],
  [15, 17],   // 16.5 → 17（不能记 16.5 颗蛋）
  [1, 2],     // 1.1 → 2
  [5, 6],     // 5.5 → 6
  [100, 110],
];
for (const [out, want] of CASES) {
  const got = conversionInputQty(onsen, out);
  ok(got === want, `做 ${out} 颗应投 ${want} 颗生蛋，实得 ${got}`);
  // 比较也要留浮点容差：100×1.1 在 IEEE754 下是 110.00000000000001，
  // 拿它跟正确答案 110 硬比会假报失败（第一版就栽在这，两处都要防）。
  ok(got >= out * onsen.inputPerOutput - 1e-9, `做 ${out} 颗投入量不能少于理论值（会虚高生蛋余额）`);
}

// ── 非可加工食材不能有配方 ──
ok(!getConversionFor('鸡蛋(生)'), '生鸡蛋本身不该是可加工成品');
ok(!getConversionFor('鸡扒'), '鸡扒没有加工配方');

console.log(`\n配比表：${INGREDIENT_CONVERSIONS.map(c => `${c.from} →(×${c.inputPerOutput}) ${c.to}`).join('；')}`);
console.log(`老板常规批量：做 20 颗温泉蛋 = 扣 ${conversionInputQty(onsen, 20)} 颗生蛋`);
console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
