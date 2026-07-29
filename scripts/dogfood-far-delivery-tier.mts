/**
 * Dogfood: far 配送档（7.5km+ · RM 18 固定 · Grab 配送）
 *
 * 跑法：node scripts/dogfood-far-delivery-tier.mts
 *
 * 背景（2026-07-29 老板拍板）：
 *   7.5km 以上恢复接单，RM 18 固定运费、不设最低订单、不设免运门槛，由 Grab 送。
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
    DELIVERY_FEE_FAR_RM,
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

console.log('\n━━━ 2. far 档基础运费 = RM 18 ━━━');
eq('DELIVERY_FEE_FAR_RM 常量', DELIVERY_FEE_FAR_RM, 18);
eq('8km 基础运费', feeForDistance(8), 18);
eq('7.5km 仍是 RM 12（没有误伤 mid 档）', feeForDistance(7.5), 12);

console.log('\n━━━ 3. 核心：far 档没有免运门槛，多大的单都收 RM 18 ━━━');
eq('8km · 空车', calcDeliveryFee(8, 0), 18);
eq('8km · RM 20', calcDeliveryFee(8, 20), 18);
eq('8km · RM 45（旧规则的 mid 免运线）', calcDeliveryFee(8, 45), 18,
    'EXPECT_OLD_BUG：改动前这里返回 0 —— 凑到 RM 45 就白送一趟 8km');
eq('8km · RM 200（大单也照收）', calcDeliveryFee(8, 200), 18);
eq('15km · RM 500', calcDeliveryFee(15, 500), 18,
    'EXPECT_OLD_BUG：改动前返回 0');
eq('8km threshold 必须是 null（不是某个大数字）', thresholdForDistance(8), null,
    '写成大数字兜底 = 凑够钱又变免运，洞会悄悄回来');

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
eq('6km · RM 30 shortfall = 15（mid 档仍要提示）', freeDeliveryShortfall(6, 30), 15);

console.log('\n━━━ 6. 老客户 grandfather 不能把 far 档洗成免运 ━━━');
const OLD_CUSTOMER = PRICING_V2_CUTOFF_MS - 86_400_000; // 老客户（2026-05-16 之前注册）
const r8 = resolveDeliveryFee(8, 'outside2km', 999, OLD_CUSTOMER);
eq('老客户 · 8km · RM 999 → fee', r8?.fee, 18,
    'grandfather 只覆盖 2km 内，不能穿透到 far 档');
eq('老客户 · 8km → tier', r8?.tier, 'far');
const r15 = resolveDeliveryFee(1.5, 'within2km', 0, OLD_CUSTOMER);
eq('老客户 · 1.5km → 仍免运（老政策没被误伤）', r15?.fee, 0);

console.log('\n━━━ 7. 多日多趟单：每趟各收 RM 18，不因总额免掉 ━━━');
const multi = calcPerDeliveryFees([50, 50], 100, 0, 8, 'outside2km', null);
eq('8km · 两趟各 RM 50 → 运费合计', multi.total, 36,
    '两趟 × RM 18；改动前两趟各过 RM 45 线 → 合计 0');
eq('8km · 两趟 → 每趟明细', JSON.stringify(multi.fees), JSON.stringify([18, 18]));
eq('8km · 多趟 tier', multi.tier, 'far');

console.log('\n━━━ 8. 旧订单文档兼容（历史 tier:"far" 不能崩）━━━');
eq('legacy zone-only 用户仍走 near 档（无 distance 不当 far 处理）',
    resolveDeliveryFee(null, 'outside2km', 0, null)?.tier, 'near',
    '没有 distanceKm 的老用户不该被误判成远距离多收钱');

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  通过 ${pass} / ${pass + fail}${fail ? `  ✗ 失败 ${fail}` : '  ✅ 全过'}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
process.exit(fail ? 1 : 0);
