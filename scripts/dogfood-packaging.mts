/**
 * dogfood：打包碗计数（packagingLines）。
 * 跑法：npx tsx scripts/dogfood-packaging.mts
 */
import { packagingLines, aggregateStockNeeds, aggregateIngredients } from '../src/lib/prepIngredients';
import { BOWL_1000, BOWL_750 } from '../src/data/packaging';

let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };
const count = (orders: Parameters<typeof packagingLines>[0], name: string) =>
    packagingLines(orders).find(l => l.name === name)?.qty ?? 0;

// 网页单：主菜 2 碗 + ↳ 西兰花炒蛋 1 + ↳ 家乡下饭王套 1 + ↳ 荷包蛋（不用碗）
const web = [{ items: [
    { name: '家乡豆酱焖花肉饭', quantity: 2 },
    { name: '↳ 蒜蓉西兰花炒蛋', quantity: 1 },
    { name: '↳ 家乡下饭王套 (原价 RM 15.40)', quantity: 1 },
    { name: '↳ 古早味荷包蛋', quantity: 1 },
] }];
ok(count(web, BOWL_1000) === 2, `网页单 1000ml 应 2，得 ${count(web, BOWL_1000)}`);
ok(count(web, BOWL_750) === 2, `网页单 750ml 应 2，得 ${count(web, BOWL_750)}`);

// 手动单：嵌套 addOns，短 label + id 两种写法；柠香双蛋白套（含炒蛋）；姜葱下饭套短 label
const manual = [{ items: [
    { name: '香煎三文鱼饭', quantity: 1, addOns: [
        { id: 'broccoli-egg', label: '西兰花蛋', quantity: 2 },
        { id: 'salmon-protein-duo-combo', label: '柠香双蛋白套', quantity: 1 },
        { id: 'onsen-egg', label: '温泉蛋', quantity: 1 },
    ] },
    { name: '姜葱鱼片饭', quantity: 3, addOns: [{ id: 'ginger-fish-rice-king-combo', label: '姜葱下饭套', quantity: 1 }] },
] }];
ok(count(manual, BOWL_1000) === 4, `手动单 1000ml 应 4，得 ${count(manual, BOWL_1000)}`);
ok(count(manual, BOWL_750) === 4, `手动单 750ml 应 4，得 ${count(manual, BOWL_750)}`);

// 不含炒蛋的套餐/加料不用 750ml
const none = [{ items: [
    { name: '猪扒饭', quantity: 1 },
    { name: '↳ 猪扒干饭套 (原价 RM 7.00)', quantity: 1 },
    { name: '↳ 鲜虾西兰花滑蒸蛋', quantity: 1 },
] }];
ok(count(none, BOWL_750) === 0, `无炒蛋单 750ml 应 0，得 ${count(none, BOWL_750)}`);

// 0 数量不计；空单不出行
ok(packagingLines([{ items: [{ name: 'x', quantity: 0 }] }]).length === 0, '0 数量不应出行');

// aggregateStockNeeds = 食材 + 碗；aggregateIngredients 本身不含碗（备餐单不显示）
ok(!aggregateIngredients(web).lines.some(l => l.name.includes('打包碗')), 'aggregateIngredients 不应含碗');
const needs = aggregateStockNeeds(web);
ok(needs.some(l => l.name === BOWL_1000) && needs.some(l => l.name === BOWL_750), 'aggregateStockNeeds 应含两种碗');
ok(needs.length === aggregateIngredients(web).lines.length + 2, 'aggregateStockNeeds 行数 = 食材 + 2');

console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
