/**
 * Dogfood：周订阅「餐券不够 → 差额按原价现金收」（src/lib/subscriptionVoucherPlan.ts）
 *
 * 老板 2026-08-02 拍板的两条口径：
 *   1. 分不到券的份按**那道菜的原价**收现金，不打折
 *   2. **券优先抵贵的菜**，最便宜的那几份走现金（客户最省）
 *
 * 打的是生产真函数 allocateVouchers，场景全是构造的 —— 生产库里凑不齐
 * 「刚好够 / 差两张 / 一张没有 / 同道菜半份用券」这些情况。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-subscription-voucher-shortfall.mts
 */

import { allocateVouchers, round2, type PlannedDay, type PlannedUnit } from '@/lib/subscriptionVoucherPlan';
import { weeklyMenu, dishVoucherValue } from '@/data/weeklyMenu';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

// ── 真菜价（从生产菜单目录现取，菜换了这里自动跟上）──
function dishByName(name: string) {
    const d = weeklyMenu.find(x => x.name === name);
    if (!d) throw new Error(`菜单里没有「${name}」—— 换菜后请更新本 dogfood 的样本菜`);
    return d;
}
const NATTO = dishByName('纳豆月见海苔饭');       // RM16.90 全菜单最便宜
const CHICKEN = dishByName('香煎金黄鸡扒饭');      // RM18.50
const PORK = dishByName('家乡豆酱焖花肉');         // RM19.90
const SALMON = dishByName('柠香香煎三文鱼饭');     // RM24.90，券面值 19.90 + 补 RM5
console.log(`样本菜价：纳豆 ${NATTO.price} / 鸡扒 ${CHICKEN.price} / 豆酱 ${PORK.price} / 三文鱼 ${SALMON.price}（券面值 ${dishVoucherValue(SALMON.price, SALMON)} + 补 ${SALMON.voucherTopUp}）\n`);

function unit(dish: typeof NATTO): PlannedUnit {
    return {
        dishName: dish.name,
        price: dish.price,
        voucherValue: dishVoucherValue(dish.price, dish),
        voucherTopUp: dish.voucherTopUp ?? 0,
        ...(dish.topUpAddonId ? { topUpAddonId: dish.topUpAddonId } : {}),
        useVoucher: false,
    };
}

/** 造一天的单：dishes 是当天的份（同一道菜出现两次 = qty 2），fee = 运费 */
function day(date: string, dishes: (typeof NATTO)[], opts: { fee?: number; blocked?: boolean; addOnSum?: number } = {}): PlannedDay {
    const units = dishes.map(unit);
    const addOnSum = opts.addOnSum ?? 0;
    return {
        date, weekday: Number(date.slice(-1)), meal: 'lunch', time: '12:00',
        items: [], units,
        vCount: 0, coverage: 0, cashUnits: 0, cashUnitsAmount: 0,
        originalTotal: round2(units.reduce((s, u) => s + u.price, 0) + addOnSum),
        deliveryFee: opts.fee ?? 0,
        cashDue: 0,
        upgradeNeeds: [], addonNeeds: [], upgradeUsed: [], upgradeCoverage: 0,
        warnings: [], blocked: opts.blocked ?? false,
    };
}

const sum = (days: PlannedDay[], f: (d: PlannedDay) => number) => round2(days.reduce((s, d) => s + f(d), 0));

// ═══ 1) 券刚好够 —— 必须与改动前行为一字不差（回归保护）═══
console.log('■ 1) 券刚好够（5 份 5 张）');
{
    const days = [day('2026-08-03', [NATTO]), day('2026-08-04', [CHICKEN, PORK]), day('2026-08-05', [SALMON]), day('2026-08-06', [PORK])];
    allocateVouchers(days, 5);
    check('全部 5 份都用券', sum(days, d => d.vCount) === 5);
    check('零现金份', sum(days, d => d.cashUnits) === 0);
    check('coverage = Σ 券面值 16.90+18.50+19.90+19.90+19.90 = 95.10', sum(days, d => d.coverage) === 95.10, `实得 ${sum(days, d => d.coverage)}`);
    check('三文鱼那天登记 1 份 salmon 补差', days[2].upgradeNeeds.some(n => n.addonId === 'salmon-upgrade' && n.count === 1 && n.source === 'topup'));
    // 无加料无运费，唯一现金 = 三文鱼那份的 RM5 top-up（下一步 allocateUpgradeCredits
    // 有储值就抵掉、没储值就收现金）—— 与改动前口径一致
    check('cashDue 只剩三文鱼补差 RM5', sum(days, d => d.cashDue) === 5, `实得 ${sum(days, d => d.cashDue)}`);
    check('其余四天 cashDue 归零', [0, 1, 3].every(i => days[i].cashDue === 0));
}

// ═══ 2) 券差两张 —— 贵的用券，最便宜的两份收原价现金 ═══
console.log('\n■ 2) 券差两张（5 份 3 张）');
{
    const days = [day('2026-08-03', [NATTO]), day('2026-08-04', [CHICKEN, PORK]), day('2026-08-05', [SALMON]), day('2026-08-06', [PORK])];
    allocateVouchers(days, 3);
    check('用掉 3 张券', sum(days, d => d.vCount) === 3);
    check('2 份走现金', sum(days, d => d.cashUnits) === 2);
    const cashNames = days.flatMap(d => d.units).filter(u => !u.useVoucher).map(u => u.dishName).sort();
    check('走现金的正是最便宜的纳豆 + 鸡扒', JSON.stringify(cashNames) === JSON.stringify([NATTO.name, CHICKEN.name].sort()), cashNames.join('、'));
    check('现金份金额 = 16.90 + 18.50 = 35.40', sum(days, d => d.cashUnitsAmount) === 35.40, `实得 ${sum(days, d => d.cashUnitsAmount)}`);
    check('现金份按原价不打折（纳豆那天 cashDue = 16.90）', days[0].cashDue === 16.90, `实得 ${days[0].cashDue}`);
    check('券抵掉 19.90×3 = 59.70', sum(days, d => d.coverage) === 59.70, `实得 ${sum(days, d => d.coverage)}`);
    check('三文鱼用了券 → 仍要 1 份 salmon 补差', days[2].upgradeNeeds.some(n => n.addonId === 'salmon-upgrade' && n.count === 1));
}

// ═══ 3) 一张券都没有 —— 整周全现金，不再拦确认 ═══
console.log('\n■ 3) 一张券都没有（3 份 0 张）');
{
    const days = [day('2026-08-03', [NATTO], { fee: 3 }), day('2026-08-04', [SALMON], { fee: 3 })];
    allocateVouchers(days, 0);
    check('vCount 全 0', sum(days, d => d.vCount) === 0);
    check('coverage 全 0', sum(days, d => d.coverage) === 0);
    check('cashDue = 原价 + 运费（16.90+3 / 24.90+3）', days[0].cashDue === 19.90 && days[1].cashDue === 27.90, `${days[0].cashDue} / ${days[1].cashDue}`);
    check('没用券的三文鱼不产生 salmon 补差需求（绝不白扣储值）', days[1].upgradeNeeds.length === 0, JSON.stringify(days[1].upgradeNeeds));
}

// ═══ 4) 同一天同一道菜：半份用券半份现金 ═══
console.log('\n■ 4) 同道菜 qty=2 但只剩 1 张券');
{
    const days = [day('2026-08-03', [SALMON, SALMON])];
    allocateVouchers(days, 1);
    check('1 份用券 1 份现金', days[0].vCount === 1 && days[0].cashUnits === 1);
    check('券抵 19.90，现金份 24.90', days[0].coverage === 19.90 && days[0].cashUnitsAmount === 24.90);
    check('salmon 补差只按用券的 1 份算（不是 2）', days[0].upgradeNeeds.find(n => n.addonId === 'salmon-upgrade')?.count === 1,
        JSON.stringify(days[0].upgradeNeeds));
    check('cashDue = 49.80 − 19.90 = 29.90', days[0].cashDue === 29.90, `实得 ${days[0].cashDue}`);
}

// ═══ 5) blocked 天不占券 ═══
console.log('\n■ 5) blocked 天（停业/停菜）不该抢走券');
{
    const days = [day('2026-08-03', [PORK], { blocked: true }), day('2026-08-04', [NATTO]), day('2026-08-05', [CHICKEN])];
    allocateVouchers(days, 2);
    check('两张券全给了能建单的两天', days[1].vCount === 1 && days[2].vCount === 1);
    check('两天都没有现金份', days[1].cashUnits === 0 && days[2].cashUnits === 0);
    check('blocked 天保留原口径显示（vCount=1，不显示成全现金）', days[0].vCount === 1 && days[0].cashUnits === 0);
}

// ═══ 6) 加料/运费仍全额现金收 ═══
console.log('\n■ 6) 加料与运费不受券影响');
{
    const days = [day('2026-08-03', [PORK], { fee: 5, addOnSum: 4 })];
    allocateVouchers(days, 1);
    check('主菜用券后 cashDue = 加料 4 + 运费 5 = 9', days[0].cashDue === 9, `实得 ${days[0].cashDue}`);
    const days2 = [day('2026-08-03', [PORK], { fee: 5, addOnSum: 4 })];
    allocateVouchers(days2, 0);
    check('没券时 cashDue = 19.90 + 4 + 5 = 28.90', days2[0].cashDue === 28.90, `实得 ${days2[0].cashDue}`);
}

// ═══ 7) 防御：负数 / 小数 / 券多于份数 ═══
console.log('\n■ 7) 边界输入');
{
    const mk = () => [day('2026-08-03', [NATTO, PORK])];
    const neg = mk(); allocateVouchers(neg, -3);
    check('available 负数当 0 处理', neg[0].vCount === 0 && neg[0].cashUnits === 2);
    const frac = mk(); allocateVouchers(frac, 1.9);
    check('available 小数向下取整（1.9 → 1 张）', frac[0].vCount === 1);
    const many = mk(); allocateVouchers(many, 99);
    check('券多于份数只用掉需要的 2 张', many[0].vCount === 2 && many[0].cashUnits === 0);
}

// ═══ 8) 幂等 / 可复现 ═══
console.log('\n■ 8) 同输入跑两次结果一致');
{
    const snap = (ds: PlannedDay[]) => JSON.stringify(ds.map(d => [d.vCount, d.coverage, d.cashUnits, d.cashUnitsAmount, d.cashDue, d.upgradeNeeds]));
    const a = [day('2026-08-03', [NATTO, SALMON]), day('2026-08-04', [PORK, CHICKEN])];
    allocateVouchers(a, 2); const first = snap(a);
    allocateVouchers(a, 2);
    check('同一批对象重跑不漂移', snap(a) === first);
    const b = [day('2026-08-03', [NATTO, SALMON]), day('2026-08-04', [PORK, CHICKEN])];
    allocateVouchers(b, 2);
    check('另造一批同样输入结果相同', snap(b) === first);
}

// ═══ 9) 对拍：贪心「贵的先用券」= 穷举最优（客户最省）═══
console.log('\n■ 9) 穷举对拍 —— 券抵掉的钱确实是所有组合里最多的');
{
    // 固定种子 LCG，结果可复现
    let seed = 20260802;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pool = [NATTO, CHICKEN, PORK, SALMON, dishByName('古早味照烧鳗鱼饭')];
    let worst = '';
    for (let round = 0; round < 200 && !worst; round++) {
        const n = 3 + rnd(4);                       // 3~6 份
        const picks = Array.from({ length: n }, () => pool[rnd(pool.length)]);
        const k = rnd(n + 1);                       // 0~n 张券
        const days = [day('2026-08-03', picks.slice(0, Math.ceil(n / 2))), day('2026-08-04', picks.slice(Math.ceil(n / 2)))];
        allocateVouchers(days, k);
        const got = sum(days, d => d.coverage);
        // 穷举 C(n,k) 取 voucherValue 最大和
        const vals = picks.map(p => dishVoucherValue(p.price, p));
        let best = 0;
        for (let mask = 0; mask < (1 << n); mask++) {
            let bits = 0, s = 0;
            for (let i = 0; i < n; i++) if (mask & (1 << i)) { bits++; s += vals[i]; }
            if (bits === k && s > best) best = s;
        }
        if (Math.abs(got - round2(best)) > 0.001) worst = `n=${n} k=${k} 贪心 ${got} < 最优 ${round2(best)}`;
    }
    check('200 轮随机组合，贪心结果 = 穷举最优', worst === '', worst);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} 过 / ${fail} 挂`);
process.exit(fail === 0 ? 0 : 1);
