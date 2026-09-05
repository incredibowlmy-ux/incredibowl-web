/**
 * Dogfood: isDishOrderableOn（P2-2 修复的核心判定）
 *
 * 跑法：node scripts/dogfood-dish-orderable.mts
 *
 * 覆盖 2026-07 那次事故的原始场景（旧购物车里的暂别菜结账），以及
 * 未上架 / 周特餐串日 / 常驻限日菜 / 当日停售 四类拒收，外加正常路径回归。
 */
import { weeklyMenu } from '../src/data/weeklyMenu.ts';
import { isDishOrderableOn, weekdayOfYMD } from '../src/lib/cartDateUtils.ts';
import { BLOCKED_DATES } from '../src/data/blockedDates.ts';

const byId = new Map(weeklyMenu.map(d => [d.id, d]));
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

let pass = 0, fail = 0;

function check(label: string, dishId: number, date: string, expectOk: boolean) {
    const dish = byId.get(dishId);
    if (!dish) { console.log(`  ✗ ${label} — 菜 id ${dishId} 不在 weeklyMenu`); fail++; return; }
    const r = isDishOrderableOn(dish, date);
    const ok = r.ok === expectOk;
    if (ok) pass++; else fail++;
    const wd = weekdayOfYMD(date);
    console.log(
        `  ${ok ? '✓' : '✗'} ${label}\n` +
        `      ${dish.name}（id ${dishId}）× ${date} ${wd === null ? '' : WD[wd]}` +
        ` → ${r.ok ? '可下单' : `拒收：${(r as any).message}`}` +
        `${ok ? '' : `   ← 期望 ${expectOk ? '可下单' : '拒收'}`}`,
    );
}

// ── 先把当前排期打出来，人肉核对断言用的 id 没写错 ──────────────
console.log('\n当前排期快照：');
for (const d of weeklyMenu) {
    const tag = d.retired ? '暂别' : d.hidden ? '未上架'
        : d.availableWeekdays?.length ? `常驻·限${d.availableWeekdays.map(x => WD[x]).join('')}`
            : typeof d.weekday === 'number' ? `特餐·${WD[d.weekday]}`
                : '常驻·周一至五';
    console.log(`  id ${String(d.id).padStart(2)} ${d.name.padEnd(12, '　')} ${tag}`);
}

// 2026-07-27 是周一 → 27=Mon 28=Tue 29=Wed 30=Thu 31=Fri
const MON = '2026-07-27', TUE = '2026-07-28', WED = '2026-07-29', THU = '2026-07-30', FRI = '2026-07-31';
console.assert(weekdayOfYMD(MON) === 1, 'MON 基准日期算错了');
console.assert(weekdayOfYMD(FRI) === 5, 'FRI 基准日期算错了');

console.log('\n① 暂别菜（事故原始场景：上周旧购物车拿到本周结账）');
for (const d of weeklyMenu.filter(x => x.retired)) {
    check(`暂别菜任何日期都拒收`, d.id, WED, false);
}

console.log('\n② 未上架菜（hidden，emoji 占位图那种）');
const hiddenDishes = weeklyMenu.filter(d => d.hidden);
if (hiddenDishes.length === 0) {
    console.log('  · 当前没有 hidden 菜 —— 跳过（不算失败）');
} else {
    for (const d of hiddenDishes) check('hidden 菜拒收', d.id, WED, false);
}

console.log('\n③ 周特餐只能订自己那天');
for (const d of weeklyMenu.filter(x => !x.retired && !x.hidden && typeof x.weekday === 'number')) {
    const own = [MON, TUE, WED, THU, FRI][d.weekday! - 1];
    const other = d.weekday === 3 ? FRI : WED;
    check('本日可订', d.id, own, true);
    check('串到别的日子拒收', d.id, other, false);
}

console.log('\n④ 常驻限日菜（availableWeekdays）');
for (const d of weeklyMenu.filter(x => !x.retired && !x.hidden && x.availableWeekdays?.length)) {
    const allow = d.availableWeekdays!;
    const okDay = [MON, TUE, WED, THU, FRI][allow[0] - 1];
    const badDay = [MON, TUE, WED, THU, FRI].find((_, i) => !allow.includes(i + 1));
    check('供应日可订', d.id, okDay, true);
    if (badDay) check('非供应日拒收', d.id, badDay, false);
}

console.log('\n⑤ 全周常驻菜（无限制）周一至五都可订');
for (const d of weeklyMenu.filter(x =>
    !x.retired && !x.hidden && x.weekday === undefined && !x.availableWeekdays?.length)) {
    for (const day of [MON, TUE, WED, THU, FRI]) check('常驻可订', d.id, day, true);
}

console.log('\n⑥ BLOCKED_DATES（老板手动停某道菜某天）');
const blockedEntries = Object.entries(BLOCKED_DATES).filter(([id]) => byId.has(Number(id)));
if (blockedEntries.length === 0) {
    console.log('  · BLOCKED_DATES 当前为空 —— 跳过');
} else {
    for (const [id, dates] of blockedEntries) {
        for (const date of dates as string[]) check('被停当天拒收', Number(id), date, false);
    }
}

console.log('\n⑦ 边界：日期格式非法时放行（交给 isOrderDateValid 报错，避免双重报错）');
const anyLive = weeklyMenu.find(d => !d.retired && !d.hidden)!;
check('空日期放行', anyLive.id, '', true);
check('乱码日期放行', anyLive.id, 'not-a-date', true);

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
