/**
 * dogfood：每周「开放预订」（menuWeeks.bookable）—— 截单后那一列不再卖下周的沿用/复制菜。
 * 纯逻辑，不碰 Firebase。npm run dogfood 自动收录。
 *
 * 场景照 2026-09-30 线上真实数据：本周 09-28 已排；下周 10-05 老板 00:50 手动清空周一/二、
 * 周三~五是 saveDay 复制来的本周菜，且没开放。
 */
import { setRuntimeData, EMPTY_RUNTIME, type MenuRuntimeData } from '@/lib/menuRuntimeStore';
import { isWeekBookable } from '@/lib/menuResolve';
import { isSpecialOpenOn } from '@/lib/cartDateUtils';
import { computeNextSpecial } from '@/lib/nextSpecial';

let fails = 0;
function ok(cond: unknown, msg: string) {
    if (cond) console.log(`  ✓ ${msg}`);
    else { fails++; console.error(`  ✗ ${msg}`); }
}
/** MYT 墙钟 → epoch ms */
const myt = (iso: string) => Date.parse(`${iso}+08:00`);

const thisWeek = { days: { 1: [2, 35], 2: [21, 40], 3: [28, 39], 4: [27, 38], 5: [14, 29] }, daily: [11, 13], paused: [22, 5, 24] };
const nextWeek = { days: { 1: [], 2: [], 3: [28, 39], 4: [27, 38], 5: [14, 29] }, daily: [11, 13], paused: [22, 5, 24, 2, 35, 21, 40] };
const base: MenuRuntimeData = {
    source: 'firestore',
    weeks: { '2026-09-28': thisWeek, '2026-10-05': nextWeek },
    catalog: { '35': { hidden: false }, '40': { hidden: false }, '38': { hidden: false }, '39': { hidden: false } },
    closures: {},
    loadedAt: 0,
};

console.log('1. isWeekBookable：本周永远可卖，之后的周要开放');
const wed = myt('2026-09-30T03:00:00');
ok(isWeekBookable('2026-09-30', base, wed), '周三凌晨：本周三可卖');
ok(isWeekBookable('2026-10-02', base, wed), '周三凌晨：本周五可卖');
ok(!isWeekBookable('2026-10-05', base, wed), '下周一：文档存在但没开放 → 不卖');
ok(!isWeekBookable('2026-10-07', base, wed), '下周三：复制来的菜 → 不卖');
ok(!isWeekBookable('2026-10-12', base, wed), '下下周：没文档（沿用）→ 不卖');

console.log('2. 周末仍算本周（不能用 mondayOf —— 它把周六日算下周）');
ok(!isWeekBookable('2026-10-05', base, myt('2026-10-03T12:00:00')), '周六：下周一还没开放 → 不卖');
ok(!isWeekBookable('2026-10-05', base, myt('2026-10-04T23:59:00')), '周日 23:59：仍不卖');
ok(isWeekBookable('2026-10-05', base, myt('2026-10-05T00:00:00')), '周一 00:00 进入新的一周 → 可卖');

console.log('3. 老板点了「开放预订」');
const opened: MenuRuntimeData = { ...base, weeks: { ...base.weeks, '2026-10-05': { ...nextWeek, bookable: true } } };
ok(isWeekBookable('2026-10-07', opened, wed), '下周三：已开放 → 可卖');
ok(!isWeekBookable('2026-10-12', opened, wed), '下下周：各周独立，仍不卖');

console.log('4. snapshot 模式（SSR / fetch 失败）一律放行');
ok(isWeekBookable('2026-10-12', EMPTY_RUNTIME, wed), 'snapshot → true');

// 以下走默认 nowMs = Date.now()，把时钟钉在周三凌晨。
const realNow = Date.now;
Date.now = () => wed;
try {
    setRuntimeData(base);
    console.log('5. isSpecialOpenOn：只拦特餐，常驻菜不受限');
    const monSpecial = { name: '招牌原盅当归蒸鸡全腿', weekday: 1 };
    const daily = { name: '纳豆月见海苔饭', weekday: undefined };
    const r = isSpecialOpenOn(monSpecial, '2026-10-05');
    ok(!r.ok && r.reason === 'week_not_open', '下周一的特餐 → week_not_open');
    ok(!r.ok && r.message.includes('还没公布'), `拒收文案：${!r.ok ? r.message : ''}`);
    ok(isSpecialOpenOn(daily, '2026-10-05').ok, '常驻菜订下周一 → 放行');
    ok(isSpecialOpenOn({ name: '豆酱焖排骨', weekday: 3 }, '2026-09-30').ok, '本周三特餐 → 放行');

    console.log('6. Hero：下一餐那周没开放 → 改推常驻菜，不再回落暂别的 #14');
    Date.now = () => myt('2026-10-02T08:00:00'); // 周五截单后，下一餐 = 下周一
    const ns = computeNextSpecial();
    ok(ns.dish.weekday === undefined && !ns.dish.retired, `Hero 推的是常驻菜：${ns.dish.name}`);
    ok(ns.dish.id !== 14, '不是写死的 #14 金黄鸡扒（已暂别）');
    setRuntimeData(opened);
    const ns2 = computeNextSpecial();
    ok(ns2.dish.weekday === 1 || ns2.dish.weekday === undefined, `开放后 Hero 回到下周一：${ns2.dish.name}`);
    Date.now = () => wed;
    setRuntimeData(base);
    const ns3 = computeNextSpecial();
    ok(ns3.dish.weekday === 3, `周三凌晨（本周）Hero 仍是周三特餐：${ns3.dish.name}`);
} finally {
    Date.now = realNow;
    setRuntimeData(EMPTY_RUNTIME);
}

if (fails) { console.error(`\n✗ ${fails} 项失败`); process.exit(1); }
console.log('\n✓ 全部通过');
