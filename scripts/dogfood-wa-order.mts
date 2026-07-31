/**
 * dogfood-wa-order.mts — 碗妈 bot 下单链路的纯函数级验证（不碰 Firestore、不发网络）。
 *
 * 覆盖：
 *  1. resolveDishName（精确/id/唯一模糊/不认识原样透传）
 *  2. resolveAddon（精确/归一化/id/歧义与未知返回 null）
 *  3. buildPlan 计价（菜价×qty + 加料×qty，与 weeklyMenu/目录逐分核对）
 *  4. resolveDeliveryFee 运费口径（档位费、门槛免运、far 永不免运、老客 grandfather）
 *
 * 跑法：npx tsx scripts/dogfood-wa-order.mts
 * 测试数据全部从 weeklyMenu / DISH_ADDONS_BY_NAME 动态取 —— 每周换菜不用改脚本。
 */

import { weeklyMenu } from '@/data/weeklyMenu';
import { DISH_ADDONS_BY_NAME } from '@/data/dishAddonMap.generated';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { resolveAddon, resolveDishName, normalizeLabel } from '@/lib/waOrderResolve';
import { buildPlan, round2 } from '@/lib/manualOrderCore';
import {
  resolveDeliveryFee, feeForDistance, thresholdForDistance,
  DELIVERY_FEE_INNER_NEAR_RM, DELIVERY_FEE_OUTER_NEAR_RM, DELIVERY_FEE_MID_RM,
  DELIVERY_FEE_FAR_1_RM, DELIVERY_FEE_FAR_4_RM,
  FREE_DELIVERY_THRESHOLD_NEAR_RM, FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM,
  PRICING_V2_CUTOFF_MS,
} from '@/lib/deliveryUtils';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`); }
}

// ── 动态取测试对象 ──────────────────────────────────────
const activeDishes = weeklyMenu.filter(d => !d.retired && !d.hidden);
const daily = activeDishes.find(d => d.day === 'Daily / 常驻' && (!d.availableWeekdays || d.availableWeekdays.length === 0));
const special = activeDishes.find(d => d.day !== 'Daily / 常驻' && d.weekday !== undefined);
if (!daily) { console.error('找不到无限定常驻菜，weeklyMenu 结构变了？'); process.exit(1); }

// 找一道加料表里有 onsen-egg 的菜（温泉蛋是最通用加料之一）
const dishWithOnsen = Object.entries(DISH_ADDONS_BY_NAME)
  .find(([name, opts]) => opts.some(o => o.id === 'onsen-egg') && weeklyMenu.some(d => d.name === name));
if (!dishWithOnsen) { console.error('加料生成表里找不到带温泉蛋的菜'); process.exit(1); }
const [onsenDishName, onsenOpts] = dishWithOnsen;
const onsenOpt = onsenOpts.find(o => o.id === 'onsen-egg')!;

// 下周一（避开过去日期警告；周一是常规配送日）
const now = new Date(Date.now() + 8 * 3600 * 1000);
const nextMonday = new Date(now);
nextMonday.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7));
const MON = nextMonday.toISOString().slice(0, 10);

console.log(`\n== 1. resolveDishName（常驻样本「${daily.name}」id=${daily.id}）==`);
check('全名精确命中', resolveDishName(daily.name) === daily.name);
check('数字 id 命中', resolveDishName(daily.id) === daily.name);
check('数字字符串 id 命中', resolveDishName(String(daily.id)) === daily.name);
{
  // 唯一模糊：取菜名去掉首字后的子串，若在全目录唯一则应命中
  const sub = daily.name.slice(1);
  const hits = weeklyMenu.filter(d => normalizeLabel(d.name).includes(normalizeLabel(sub)));
  if (hits.length === 1) check(`唯一子串「${sub}」命中`, resolveDishName(sub) === daily.name);
  else console.log(`  ⏭️  子串「${sub}」命中 ${hits.length} 道，跳过模糊测试`);
}
check('不认识的菜原样透传', resolveDishName('这道菜不存在的啦') === '这道菜不存在的啦');

console.log(`\n== 2. resolveAddon（样本菜「${onsenDishName}」）==`);
check('label 精确命中', resolveAddon(onsenDishName, onsenOpt.label)?.id === 'onsen-egg');
check('id 命中', resolveAddon(onsenDishName, 'onsen-egg')?.id === 'onsen-egg');
check('带空格括号归一化命中', resolveAddon(onsenDishName, ` ${onsenOpt.label}（）`)?.id === 'onsen-egg');
check('未知加料返回 null', resolveAddon(onsenDishName, '火星陨石酱') === null);
{
  // 歧义样本：「蛋」在多数菜的加料里命中多个 → 应返回 null
  const eggHits = onsenOpts.filter(o => normalizeLabel(o.label).includes('蛋'));
  if (eggHits.length > 1) check('歧义词「蛋」返回 null', resolveAddon(onsenDishName, '蛋') === null);
  else console.log('  ⏭️  该菜加料只有一个带「蛋」，跳过歧义测试');
}

console.log('\n== 3. buildPlan 计价 ==');
{
  const addonPrice = ADD_ON_PRICES[onsenOpt.id] ?? onsenOpt.price;
  const dish = weeklyMenu.find(d => d.name === onsenDishName)!;
  const { days, errors } = buildPlan([{
    date: MON, meal: 'lunch',
    items: [{ dishName: onsenDishName, qty: 2, addOns: [{ id: onsenOpt.id, label: onsenOpt.label, price: addonPrice, quantity: 1 }] }],
  }], 0);
  check('无 errors', errors.length === 0, errors.join('；'));
  const expected = round2(dish.price * 2 + addonPrice * 1);
  check(`菜金 = 现价×2 + 加料（RM ${expected}）`, days[0]?.originalTotal === expected, `got ${days[0]?.originalTotal}`);
  check('默认午餐时间 12:00', days[0]?.time === '12:00');
  check('不 blocked', days[0]?.blocked === false);
}
{
  const { days } = buildPlan([{ date: MON, meal: 'lunch', items: [{ dishName: '不存在的菜', qty: 1 }] }], 0);
  check('未知菜 → blocked + 警告', days[0]?.blocked === true && days[0].warnings.some(w => w.includes('不在菜品目录')));
}
if (special && special.weekday !== undefined && special.weekday !== 1) {
  const { days } = buildPlan([{ date: MON, meal: 'dinner', items: [{ dishName: special.name, qty: 1 }] }], 0);
  check(`特餐排错天有警告（「${special.name}」周${special.weekday}≠周一）`,
    days[0]?.warnings.some(w => w.includes('本轮排在')) === true);
  check('晚餐默认 19:00', days[0]?.time === '19:00');
}

console.log('\n== 4. 运费口径（与 deliveryUtils 常量逐项核）==');
{
  const cases: Array<[number, number, number]> = [
    // [距离, 菜金 basis, 期望费]
    [1.5, 10, DELIVERY_FEE_INNER_NEAR_RM],                       // 内近档不够门槛
    [1.5, FREE_DELIVERY_THRESHOLD_NEAR_RM, 0],                   // 内近档踩线免运
    [4.0, 25, DELIVERY_FEE_OUTER_NEAR_RM],                       // 外近档不够门槛
    [4.0, FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM, 0],             // 外近档踩线免运
    [6.0, 40, DELIVERY_FEE_MID_RM],                              // 中档不够门槛
    [9.0, 500, DELIVERY_FEE_FAR_1_RM],                           // far 档：多大都不免
    [22.0, 500, DELIVERY_FEE_FAR_4_RM],                          // far 最高档
  ];
  for (const [km, basis, want] of cases) {
    const r = resolveDeliveryFee(km, km <= 2 ? 'within2km' : 'outside2km', basis, null);
    check(`${km}km / 菜金RM${basis} → RM${want}`, r?.fee === want, `got ${r?.fee}`);
  }
  // 05-16 前老客 ≤2km 免运 grandfather
  const legacy = resolveDeliveryFee(1.5, 'within2km', 5, PRICING_V2_CUTOFF_MS - 1000);
  check('05-16 前老客 1.5km → 免运', legacy?.fee === 0 && legacy?.tier === 'free', `got ${JSON.stringify(legacy)}`);
  // 一致性：resolveDeliveryFee 未触发门槛时应等于 feeForDistance
  const consistent = [1.1, 3.3, 6.6, 8.8, 12, 17, 24].every(km => {
    const r = resolveDeliveryFee(km, 'outside2km', 0.01, null);
    return r?.fee === feeForDistance(km);
  });
  check('各距离与 feeForDistance 一致（basis≈0）', consistent);
  check('far 档 threshold 是 null（绝不给免运门槛）', thresholdForDistance(9) === null && thresholdForDistance(24) === null);
}

console.log(`\n合计：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
