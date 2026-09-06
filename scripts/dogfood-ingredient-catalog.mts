/**
 * dogfood：食材分类 + 「配方食材全覆盖」。
 * 加新菜/新加料后重跑，能立刻看出新食材有没有归错类或漏进盘点表。
 * 跑法：npx tsx scripts/dogfood-ingredient-catalog.mts
 */
import { dishRecipes, addOnRecipes } from '../src/data/dishIngredients';
import {
    ALL_RECIPE_INGREDIENTS, categorizeIngredient, CATEGORY_ORDER, categoryRank,
} from '../src/data/ingredientCatalog';
import { PACKAGING_ITEMS } from '../src/data/packaging';

let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => {
    if (cond) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); }
};

// ── 1. 覆盖：配方里每一个食材都必须在 ALL_RECIPE_INGREDIENTS 里 ──
const fromRecipes = new Set<string>();
for (const r of dishRecipes) for (const l of r.ingredients) fromRecipes.add(l.name);
for (const lines of Object.values(addOnRecipes)) for (const l of lines) fromRecipes.add(l.name);
const catalogNames = new Set(ALL_RECIPE_INGREDIENTS.map(i => i.name));
for (const n of fromRecipes) ok(catalogNames.has(n), `配方食材「${n}」不在 ALL_RECIPE_INGREDIENTS`);
for (const p of PACKAGING_ITEMS) ok(catalogNames.has(p.name), `打包耗材「${p.name}」不在 ALL_RECIPE_INGREDIENTS`);
ok(catalogNames.size === fromRecipes.size + PACKAGING_ITEMS.length, `数量对不上：目录 ${catalogNames.size} vs 配方 ${fromRecipes.size} + 包装 ${PACKAGING_ITEMS.length}`);

// ── 2. 每个食材都有单位（未建档的靠它才能 g→kg 换算）──
for (const i of ALL_RECIPE_INGREDIENTS) ok(!!i.unit, `「${i.name}」没有单位`);

// ── 3. 没有食材落进「其他」——落进去说明规则该补了 ──
const others = ALL_RECIPE_INGREDIENTS.filter(i => i.category === '其他');
ok(others.length === 0, `这些食材没归类，请在 EXPLICIT_CATEGORY 补: ${others.map(o => o.name).join('、')}`);

// ── 4. 关键词规则对「假想新食材」的判断（防止顺序写反）──
const RULE_CASES: [string, string][] = [
    ['鸭腿', '肉类'], ['牛小排', '肉类'], ['午餐肉', '肉类'],
    ['鲈鱼片', '海鲜'], ['带子', '海鲜'], ['大虾', '海鲜'],
    ['鹌鹑蛋', '蛋类'], ['咸蛋黄', '蛋类'],
    ['菜心', '蔬菜'], ['紫洋葱', '蔬菜'], ['金针菇', '蔬菜'], ['青椒', '蔬菜'],
    ['泰国香米', '米·主食'], ['乌冬', '米·主食'],
    ['蚝油', '调味·干货'], ['白胡椒', '调味·干货'], ['米酒', '调味·干货'],
];
for (const [name, want] of RULE_CASES) {
    const got = categorizeIngredient(name);
    ok(got === want, `新食材「${name}」归类成「${got}」，应为「${want}」`);
}

// ── 5. 排序稳定：categoryRank 覆盖所有已用类别 ──
for (const i of ALL_RECIPE_INGREDIENTS) {
    ok(categoryRank(i.category) < CATEGORY_ORDER.length, `类别「${i.category}」不在 CATEGORY_ORDER`);
}

// ── 打印分组总览（肉眼复核用）──
console.log(`\n共 ${ALL_RECIPE_INGREDIENTS.length} 种食材：`);
for (const { key, icon } of CATEGORY_ORDER) {
    const items = ALL_RECIPE_INGREDIENTS.filter(i => i.category === key);
    if (!items.length) continue;
    console.log(`\n${icon} ${key}（${items.length}）`);
    console.log('   ' + items.map(i => `${i.name}(${i.unit})`).join('、'));
}

console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
