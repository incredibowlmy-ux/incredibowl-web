/**
 * dogfood：运行时菜单解析层（menuResolve + buildMenu 非严格模式 + blockedDates 运行时表）。
 * 纯逻辑，不碰 Firebase。npm run dogfood 自动收录。
 */
import { weeklyMenu, buildMenu, MENU_SNAPSHOT_WEEK, DISH_CATALOG_ALL } from '@/data/weeklyMenu';
import { setRuntimeData, EMPTY_RUNTIME, type MenuRuntimeData } from '@/lib/menuRuntimeStore';
import { mondayOf, weekDocFor, menuForDate, menuForWeekdayDates, nextOccurrenceDates, currentMenu } from '@/lib/menuResolve';
import { isDateClosed, isDinnerClosedOn, isDishBlockedOn, upcomingClosures, closureReasonOn } from '@/data/blockedDates';
import { isDishOrderableOn } from '@/lib/cartDateUtils';
import { repriceCart } from '@/lib/cartRepricing';

let fails = 0;
function ok(cond: unknown, msg: string) {
    if (cond) console.log(`  ✓ ${msg}`);
    else { fails++; console.error(`  ✗ ${msg}`); }
}
const ids = (m: { id: number }[]) => m.map(d => d.id);
const snapIds = new Set(DISH_CATALOG_ALL.map(d => d.id));
const pick = (n: number) => [...snapIds][n];

console.log('1. mondayOf');
ok(mondayOf('2026-09-08') === '2026-09-07', '周二 → 本周一');
ok(mondayOf('2026-09-07') === '2026-09-07', '周一 → 自己');
ok(mondayOf('2026-09-12') === '2026-09-14', '周六 → 下周一');
ok(mondayOf('2026-09-13') === '2026-09-14', '周日 → 下周一');

console.log('2. snapshot 模式：一切回代码快照');
setRuntimeData(EMPTY_RUNTIME);
ok(menuForDate('2026-09-08') === weeklyMenu, 'menuForDate 返回 weeklyMenu 同一引用');
ok(currentMenu() === weeklyMenu, 'currentMenu 返回 weeklyMenu 同一引用');
ok(isDateClosed('2026-09-01') === true, '快照 CLOSURES 生效（09-01 放假）');

console.log('3. firestore 模式：两周不同排期');
const wkA = MENU_SNAPSHOT_WEEK;
// 下周：把周一两道菜对调、周五第一道换成本周周四的主打
const wkB = {
    days: { ...wkA.days, 1: [...wkA.days[1]].reverse(), 5: [wkA.days[4][0], ...wkA.days[5].filter(x => x !== wkA.days[4][0])], 4: wkA.days[4].slice(1) },
    daily: wkA.daily,
    paused: wkA.paused,
};
const data: MenuRuntimeData = {
    source: 'firestore',
    weeks: { '2026-09-07': wkA, '2026-09-14': wkB },
    catalog: { [String(wkA.days[2][0])]: { price: 99.9 } },
    closures: { '2026-09-10': { closed: true, reason: 'holiday' }, '2026-09-11': { dinnerClosed: true }, '2026-09-15': { blockedDishIds: [wkB.days[2][0]] } },
    loadedAt: Date.now(),
};
setRuntimeData(data);
ok(weekDocFor(data, '2026-09-09').week === wkA && !weekDocFor(data, '2026-09-09').inherited, '09-09 命中本周文档');
ok(weekDocFor(data, '2026-09-16').week === wkB, '09-16 命中下周文档');
ok(weekDocFor(data, '2026-09-30').week === wkB && weekDocFor(data, '2026-09-30').inherited, '09-30 无文档 → 沿用最近更早一周');
ok(weekDocFor(data, '2026-08-01').week === MENU_SNAPSHOT_WEEK, '早于所有文档 → 代码快照');

const mA = menuForDate('2026-09-07');
const mB = menuForDate('2026-09-14');
ok(mA !== weeklyMenu && mA.length === weeklyMenu.length, '运行时菜单是新数组，条目数与快照一致');
ok(menuForDate('2026-09-09') === mA, '同一周内缓存命中（同引用）');
const heroA = mA.find(d => d.weekday === 1 && d.isPrimary)!;
const heroB = mB.find(d => d.weekday === 1 && d.isPrimary)!;
ok(heroA.id === wkA.days[1][0] && heroB.id === wkA.days[1][1], '两周周一 hero 不同（对调生效）');
ok(mA.find(d => d.id === wkA.days[2][0])!.price === 99.9, '价格覆盖生效');
ok(weeklyMenu.find(d => d.id === wkA.days[2][0])!.price !== 99.9, '快照 weeklyMenu 未被污染');

console.log('4. 停业日运行时表覆盖快照');
ok(isDateClosed('2026-09-10') === true && closureReasonOn('2026-09-10') === 'holiday', '09-10 整天停（holiday）');
ok(isDateClosed('2026-09-01') === false, '快照里的 09-01 在 firestore 模式下不再生效');
ok(isDinnerClosedOn('2026-09-11') === true && isDateClosed('2026-09-11') === false, '09-11 只关晚市');
ok(isDishBlockedOn(wkB.days[2][0], '2026-09-15') === true, '单菜停某天');
ok(isDishBlockedOn(12, '2026-06-12') === false, '快照 BLOCKED_DATES 不再生效');
ok(upcomingClosures('2026-09-08').map(c => c.date).join() === '2026-09-10', 'upcomingClosures 走运行时');

console.log('5. 下单校验按所属周');
const thuHeroA = wkA.days[4][0];
const dishA = mA.find(d => d.id === thuHeroA)!;
const dishB = mB.find(d => d.id === thuHeroA)!;
ok(isDishOrderableOn(dishA, '2026-09-10').ok === true, '本周四主打在 09-10（本周四）可下单');
ok(isDishOrderableOn(dishB, '2026-09-17').ok === false && isDishOrderableOn(dishB, '2026-09-18').ok === true, '同一道菜下周挪到周五：09-17 拒、09-18 可');
ok(isDishOrderableOn(mB.find(d => d.id === wkB.days[2][0])!, '2026-09-15').reason === 'dish_blocked', '单菜停某天 → dish_blocked');

console.log('6. 合成周 + 去重');
const dates = { 1: '2026-09-14', 2: '2026-09-08', 3: '2026-09-09', 4: '2026-09-10', 5: '2026-09-11' };
const comp = menuForWeekdayDates(dates);
ok(comp.find(d => d.weekday === 1 && d.isPrimary)!.id === wkB.days[1][0], '周一取下周文档（周一已过）');
ok(comp.find(d => d.weekday === 4 && d.isPrimary)!.id === wkA.days[4][0], '周四取本周文档');
const dup = comp.filter(d => d.id === thuHeroA);
ok(dup.length === 1, '同一道菜不重复出现');
ok(new Set(ids(comp)).size === comp.length, '合成周无重复 id');
ok(menuForWeekdayDates(dates) === comp, '合成周缓存命中');

console.log('7. nextOccurrenceDates（截单前后、跳周末、跳停业日）');
const tueEarly = Date.UTC(2026, 8, 8, 5, 0) - 8 * 3600e3;  // MYT 周二 05:00
const tueLate = Date.UTC(2026, 8, 8, 7, 0) - 8 * 3600e3;   // MYT 周二 07:00
ok(nextOccurrenceDates(tueEarly)[2] === '2026-09-08', '截单前：周二就是今天');
ok(nextOccurrenceDates(tueLate)[2] === '2026-09-15', '截单后：周二滚到下周');
ok(nextOccurrenceDates(tueLate)[1] === '2026-09-14', '周一滚到下周一');
ok(nextOccurrenceDates(tueLate, isDateClosed)[4] === '2026-09-17', '周四 09-10 停业 → 滚到 09-17');
const cm = currentMenu(tueLate, isDateClosed);
ok(cm.find(d => d.weekday === 4 && d.isPrimary)!.id === wkB.days[4][0], 'currentMenu 周四拿的是下周文档（因 09-10 停业）');

console.log('8. buildMenu 非严格：手滑不炸');
const bad = buildMenu({ days: { 1: [999, wkA.days[1][0]], 2: [wkA.days[1][0]] }, daily: [], paused: [] });
ok(bad.some(d => d.id === wkA.days[1][0] && d.weekday === 1), '不存在的 id 跳过、重复 id 只留第一次');
ok(bad.filter(d => d.day.startsWith('Unscheduled')).every(d => d.hidden), '没排期的菜自动 hidden');
let threw = false;
try { buildMenu({ days: { 1: [999] }, daily: [], paused: [] }, { strict: true }); } catch { threw = true; }
ok(threw, 'strict 模式仍然 throw');
let threwUnsched = false;
try { buildMenu({ days: { 1: [wkA.days[1][0]] }, daily: [], paused: [] }, { strict: true }); } catch { threwUnsched = true; }
ok(threwUnsched, 'strict：目录里的菜没排期也没 hidden → throw（代码快照）');
const lenient = buildMenu({ days: { 1: [wkA.days[1][0]] }, daily: [], paused: [] }, { strict: true, allowUnscheduled: true });
ok(lenient.filter(d => d.day.startsWith('Unscheduled')).every(d => d.hidden) && lenient.some(d => d.id === wkA.days[1][0] && !d.hidden), 'strict+allowUnscheduled（dashboard 保存校验）：未排期的当 hidden，不 throw');

console.log('9. repriceCart 按每项日期取所属周');
const bundle = (dish: typeof dishA, selectedDate: string) => ({
    cartItemId: 'x', dish, dishQty: 1, addOns: [], price: dish.price, quantity: 1, selectedDate, selectedTime: 'lunch', note: '',
} as unknown as Parameters<typeof repriceCart>[0][number]);
const priced = repriceCart([bundle(weeklyMenu.find(d => d.id === wkA.days[2][0])!, '2026-09-08')]);
ok(priced.changes.length === 1 && Math.abs(priced.cart[0].price - 99.9) < 0.001, '价格覆盖后购物车刷到 99.9');
const cross = repriceCart([bundle(dishA, '2026-09-18')]);
ok(cross.cart[0].dish.weekday === 5, '下周的单：dish 快照刷成下周的 weekday');

console.log('9b. 排定生效：到点前用现行，到点后自动换');
{
    const heroNow = wkA.days[3][0], heroLater = wkA.days[3][1];
    const at = new Date(Date.now() + 60_000).toISOString();
    const withSched: MenuRuntimeData = {
        ...data,
        weeks: { ...data.weeks, '2026-09-07': { ...wkA, scheduled: { at, days: { ...wkA.days, 3: [heroLater, heroNow] }, daily: wkA.daily, paused: wkA.paused } } },
    };
    setRuntimeData(withSched);
    ok(weekDocFor(withSched, '2026-09-09').week.days[3][0] === heroNow, '到点前：周三主打仍是现行');
    ok(weekDocFor(withSched, '2026-09-09', Date.now() + 120_000).week.days[3][0] === heroLater, '到点后：周三主打换成排定的');
    ok(menuForDate('2026-09-09').find(d => d.weekday === 3 && d.isPrimary)!.id === heroNow, 'menuForDate 到点前走现行');
    const past: MenuRuntimeData = { ...withSched, weeks: { ...withSched.weeks, '2026-09-07': { ...withSched.weeks['2026-09-07'], scheduled: { ...withSched.weeks['2026-09-07'].scheduled!, at: new Date(Date.now() - 1000).toISOString() } } } };
    setRuntimeData(past);
    ok(menuForDate('2026-09-09').find(d => d.weekday === 3 && d.isPrimary)!.id === heroLater, '排定到点 → menuForDate 自动换');
    setRuntimeData(data);
}

console.log('9c. 推荐加料覆盖（加料曝光实验）');
{
    const id = wkA.days[1][0];
    const m = buildMenu(wkA, { overrides: { [String(id)]: { recommendedAddOns: ['sunny-egg', 'onsen-egg', 'extra-rice', 'brown-rice'] } } });
    ok(m.find(d => d.id === id)!.recommendedAddOns!.join() === 'sunny-egg,onsen-egg,extra-rice', '覆盖进 MenuItem，最多 3 个');
    ok(m.find(d => d.id === wkA.days[1][1])!.recommendedAddOns === undefined, '没覆盖的菜没有该字段');
    ok(weeklyMenu.find(d => d.id === id)!.recommendedAddOns === undefined, '快照 weeklyMenu 未被污染');
}

console.log('10. 回到 snapshot');
setRuntimeData(EMPTY_RUNTIME);
ok(menuForDate('2026-09-08') === weeklyMenu, '恢复快照');
ok(pick(0) !== undefined, 'catalog 非空');

if (fails) { console.error(`\n✗ ${fails} 条失败`); process.exit(1); }
console.log('\n✓ menuResolve dogfood 全过');
