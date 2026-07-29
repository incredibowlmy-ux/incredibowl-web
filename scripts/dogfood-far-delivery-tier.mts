/**
 * Dogfood: far 配送分档（7.5–25km · RM 15/20/25/30 固定 · Grab 配送）
 *
 * 跑法：node scripts/dogfood-far-delivery-tier.mts
 *
 * 背景（2026-07-29 老板拍板，按 189 条真实 Grab 收据定价）：
 *   7.5–10km RM15 · 10–15km RM20 · 15–20km RM25 · 20–25km RM30 · >25km 拒收。
 *   全部不设最低订单、不设免运门槛，由 Grab 送。
 *
 * 这个脚本同时验证被一起堵上的旧洞：
 *   改动前 tierFromDistance() 没有天花板 —— 只要 >5km 一律算 'mid'，所以 15km 的
 *   地址收 RM 12，凑到 RM 45 还直接免运，而全站文案写的是「7.5km 以外暂不配送」。
 *   唯一挡过 7.5km 的只有首页那个免登录查询 widget（/api/check-delivery），真正的
 *   下单链路（geocode → 个人资料 → submit-order）从来没查过距离上限。
 *
 * 下面每个 EXPECT_OLD_BUG 标记的用例，就是改动前会给出的错误答案。
 */
import {
    calcDeliveryFee,
    feeForDistance,
    thresholdForDistance,
    tierFromDistance,
    freeDeliveryShortfall,
    resolveDeliveryFee,
    calcPerDeliveryFees,
    isBeyondServiceRange,
    DELIVERY_FEE_FAR_1_RM,
    DELIVERY_FEE_FAR_2_RM,
    DELIVERY_FEE_FAR_3_RM,
    DELIVERY_FEE_FAR_4_RM,
    MAX_DELIVERY_KM,
    PRICING_V2_CUTOFF_MS,
} from '../src/lib/deliveryUtils.ts';

let pass = 0, fail = 0;

function eq(label: string, actual: unknown, expected: unknown, note = '') {
    const ok = Object.is(actual, expected);
    if (ok) pass++; else fail++;
    console.log(
        `  ${ok ? '✓' : '✗'} ${label}\n` +
        `      → ${JSON.stringify(actual)}${ok ? '' : `   ← 期望 ${JSON.stringify(expected)}`}` +
        `${note ? `\n      ${note}` : ''}`,
    );
}

console.log('\n━━━ 1. 分档边界（7.5km 是 mid/far 的分界，不留空隙）━━━');
eq('2.0km → near', tierFromDistance(2.0), 'near');
eq('5.0km → near（边界含等号）', tierFromDistance(5.0), 'near');
eq('5.01km → mid', tierFromDistance(5.01), 'mid');
eq('7.5km → mid（边界含等号，仍是旧价）', tierFromDistance(7.5), 'mid');
eq('7.51km → far', tierFromDistance(7.51), 'far');
eq('8.0km → far（老板点名的距离）', tierFromDistance(8.0), 'far');
eq('15km → far（改动前会算成 mid）', tierFromDistance(15), 'far');
eq('50km → far（无论多远都不再掉回 mid）', tierFromDistance(50), 'far');

console.log('\n━━━ 2. far 四档阶梯运费（按真实 Grab 收据定价）━━━');
eq('档位常量 15/20/25/30',
    [DELIVERY_FEE_FAR_1_RM, DELIVERY_FEE_FAR_2_RM, DELIVERY_FEE_FAR_3_RM, DELIVERY_FEE_FAR_4_RM].join('/'),
    '15/20/25/30');
eq('7.5km 仍是 RM 12（没有误伤 mid 档）', feeForDistance(7.5), 12);
eq('7.51km → RM 15（far 第一档起）', feeForDistance(7.51), 15);
eq('7.94km → RM 15（Kelly Chok 那批单的距离）', feeForDistance(7.94), 15);
eq('8.39km → RM 15（yvonne 那单的距离）', feeForDistance(8.39), 15);
eq('10km → RM 15（边界含等号）', feeForDistance(10), 15);
eq('10.01km → RM 20', feeForDistance(10.01), 20);
eq('15km → RM 20（边界含等号）', feeForDistance(15), 20);
eq('15.01km → RM 25', feeForDistance(15.01), 25);
eq('20km → RM 25（边界含等号）', feeForDistance(20), 25);
eq('20.01km → RM 30', feeForDistance(20.01), 30);
eq('25km → RM 30（上限当天仍可下单）', feeForDistance(25), 30);

console.log('\n━━━ 3. 核心：far 各档都没有免运门槛，多大的单都照收 ━━━');
eq('8km · 空车', calcDeliveryFee(8, 0), 15);
eq('8km · RM 45（旧规则的 mid 免运线）', calcDeliveryFee(8, 45), 15,
    'EXPECT_OLD_BUG：改动前这里返回 0 —— 凑到 RM 45 就白送一趟 8km');
eq('8.39km · RM 59.70（yvonne 真实那单）', calcDeliveryFee(8.39, 59.70), 15,
    'EXPECT_OLD_BUG：改动前正是这单返回 0，白送一趟到 Jln Tun Razak');
eq('8km · RM 200（大单也照收）', calcDeliveryFee(8, 200), 15);
eq('12km · RM 500', calcDeliveryFee(12, 500), 20, 'EXPECT_OLD_BUG：改动前返回 0');
eq('18km · RM 500', calcDeliveryFee(18, 500), 25);
eq('24km · RM 500', calcDeliveryFee(24, 500), 30);
eq('8km threshold 必须是 null（不是某个大数字）', thresholdForDistance(8), null,
    '写成大数字兜底 = 凑够钱又变免运，洞会悄悄回来');
eq('24km threshold 也是 null', thresholdForDistance(24), null);

console.log('\n━━━ 3b. 25km 服务上限 ━━━');
eq('MAX_DELIVERY_KM 常量', MAX_DELIVERY_KM, 25);
eq('24.9km 在范围内', isBeyondServiceRange(24.9), false);
eq('25km 在范围内（边界含等号）', isBeyondServiceRange(25), false);
eq('25.01km 超范围', isBeyondServiceRange(25.01), true);
eq('25.01km 仍能算出价（不抛错，交给 API 层拒收）', feeForDistance(25.01), 30,
    '算价不该崩 —— 拒收是 /api/geocode + /api/submit-order 的职责');
eq('历史 Irene Chin 25.01km → 超范围', isBeyondServiceRange(25.01), true,
    '她那两单就是漏进来的，其中一单运费还收了 RM 0');

console.log('\n━━━ 4. 近/中档回归（不能被这次改动带坏）━━━');
eq('2km · 空车 → RM 3', calcDeliveryFee(2, 0), 3);
eq('2km · RM 20 → 免运', calcDeliveryFee(2, 20), 0);
eq('3km · 空车 → RM 5', calcDeliveryFee(3, 0), 5);
eq('3km · RM 30 → 免运', calcDeliveryFee(3, 30), 0);
eq('6km · 空车 → RM 12', calcDeliveryFee(6, 0), 12);
eq('6km · RM 45 → 免运', calcDeliveryFee(6, 45), 0);
eq('7.5km · RM 45 → 免运（mid 档最后一米仍有免运）', calcDeliveryFee(7.5, 45), 0);

console.log('\n━━━ 5. shortfall：far 档不能显示「还差 RM X 免运」━━━');
eq('8km · 空车 shortfall', freeDeliveryShortfall(8, 0), 0,
    '非 0 的话购物车会挂一句永远达不到的诱饵');
eq('8km · RM 30 shortfall', freeDeliveryShortfall(8, 30), 0);
eq('24km · RM 300 shortfall', freeDeliveryShortfall(24, 300), 0);
eq('6km · RM 30 shortfall = 15（mid 档仍要提示）', freeDeliveryShortfall(6, 30), 15);

console.log('\n━━━ 6. 老客户 grandfather 不能把 far 档洗成免运 ━━━');
const OLD_CUSTOMER = PRICING_V2_CUTOFF_MS - 86_400_000; // 老客户（2026-05-16 之前注册）
const r8 = resolveDeliveryFee(8, 'outside2km', 999, OLD_CUSTOMER);
eq('老客户 · 8km · RM 999 → fee', r8?.fee, 15,
    'grandfather 只覆盖 2km 内，不能穿透到 far 档');
eq('老客户 · 8km → tier', r8?.tier, 'far');
eq('老客户 · 22km · RM 999 → fee', resolveDeliveryFee(22, 'outside2km', 999, OLD_CUSTOMER)?.fee, 30);
const r15 = resolveDeliveryFee(1.5, 'within2km', 0, OLD_CUSTOMER);
eq('老客户 · 1.5km → 仍免运（老政策没被误伤）', r15?.fee, 0);

console.log('\n━━━ 7. 多日多趟单：每趟各收，不因总额免掉 ━━━');
const multi = calcPerDeliveryFees([50, 50], 100, 0, 8, 'outside2km', null);
eq('8km · 两趟各 RM 50 → 运费合计', multi.total, 30,
    '两趟 × RM 15；改动前两趟各过 RM 45 线 → 合计 0');
eq('8km · 两趟 → 每趟明细', JSON.stringify(multi.fees), JSON.stringify([15, 15]));
eq('8km · 多趟 tier', multi.tier, 'far');
const multiFar = calcPerDeliveryFees([50, 50], 100, 0, 22, 'outside2km', null);
eq('22km · 两趟 → 合计 RM 60', multiFar.total, 60);

console.log('\n━━━ 8. 旧订单文档兼容（历史 tier:"far" 不能崩）━━━');
eq('legacy zone-only 用户仍走 near 档（无 distance 不当 far 处理）',
    resolveDeliveryFee(null, 'outside2km', 0, null)?.tier, 'near',
    '没有 distanceKm 的老用户不该被误判成远距离多收钱');

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  通过 ${pass} / ${pass + fail}${fail ? `  ✗ 失败 ${fail}` : '  ✅ 全过'}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
process.exit(fail ? 1 : 0);
