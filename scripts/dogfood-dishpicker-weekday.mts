/**
 * dogfood：DishPicker 按天置顶 + 默认菜 —— 直接对着 weeklyMenu 真值断言。
 * 换菜后重跑这个脚本，能立刻看出下拉分组是否跟上了新排期。
 * 跑法：npx tsx scripts/dogfood-dishpicker-weekday.mts
 */
import { weeklyMenu } from '../src/data/weeklyMenu';
import { servesOnWeekday } from '../src/lib/cartDateUtils';

const WD_CN: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };
let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => {
    if (cond) { pass++; console.log(`  ✓ ${msg}`); }
    else { fail++; console.log(`  ✗ ${msg}`); }
};

// 复刻 DishPicker.buildGroups 的置顶组 + defaultDishForWeekday
const topGroup = (wd: number) =>
    weeklyMenu.filter(d => !d.hidden && !d.retired && servesOnWeekday(d, wd)).map(d => d.name);
const defaultDish = (wd: number) =>
    weeklyMenu.find(d => !d.hidden && !d.retired && d.weekday === wd && d.isPrimary)?.name
    ?? weeklyMenu.find(d => !d.hidden && !d.retired && servesOnWeekday(d, wd))?.name
    ?? weeklyMenu.find(d => !d.hidden && !d.retired)?.name;

for (const wd of [1, 2, 3, 4, 5]) {
    console.log(`\n=== ${WD_CN[wd]} ===`);
    const top = topGroup(wd);
    console.log(`  置顶组(${top.length}): ${top.join('、')}`);
    console.log(`  默认菜: ${defaultDish(wd)}`);

    ok(top.length > 0, '置顶组非空');

    // 当天特餐必须在置顶组
    const specials = weeklyMenu.filter(d => !d.hidden && !d.retired && d.weekday === wd);
    ok(specials.every(s => top.includes(s.name)),
        `当天特餐全在置顶组 (${specials.map(s => s.name).join('、') || '无'})`);

    // 别天的特餐绝不能混进来
    const foreign = weeklyMenu.filter(d =>
        !d.hidden && !d.retired && typeof d.weekday === 'number' && d.weekday !== wd);
    ok(!foreign.some(f => top.includes(f.name)), '别天的特餐没混进置顶组');

    // 暂别菜绝不能在置顶组
    ok(!weeklyMenu.filter(d => d.retired).some(r => top.includes(r.name)), '暂别菜不在置顶组');

    // 限日常驻菜只在自己的供应日出现
    for (const d of weeklyMenu.filter(x => !x.hidden && !x.retired && x.availableWeekdays?.length)) {
        const should = d.availableWeekdays!.includes(wd);
        ok(top.includes(d.name) === should,
            `限日菜「${d.name}」(限${d.availableWeekdays!.map(w => WD_CN[w]).join('/')}) ${should ? '在' : '不在'}置顶组`);
    }

    // 全周常驻必须每天都在
    for (const d of weeklyMenu.filter(x =>
        !x.hidden && !x.retired && x.day === 'Daily / 常驻' && !x.availableWeekdays?.length)) {
        ok(top.includes(d.name), `全周常驻「${d.name}」在置顶组`);
    }

    // 默认菜必须是当天真能下单的
    const def = defaultDish(wd);
    ok(!!def && top.includes(def), `默认菜「${def}」当天可下单`);
}

console.log(`\n=== ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
