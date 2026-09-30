/**
 * Dogfood：回头客赠品（薯煎蛋B，老板 2026-09-30 定）
 *
 * 规则：餐券单每 5 个配送日送一份、现金单每 3 个配送日送一份；送完重数；
 * 一天只算一次；上线日所有人从 0 数。判定错一次就是漏送 / 重复送 / 备错料。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-loyalty-gift.mts
 */
import {
  selectLoyaltyGiftIds, loyaltyTypeOf, countsTowardLoyalty,
  LOYALTY_GIFT_SINCE, type LoyaltyCandidate, type LoyaltyType,
} from '@/lib/loyaltyGift';
import { selectFirstOrderIds } from '@/lib/newCustomerGift';
import { aggregateIngredients, buildDailyPrepIngredients, type PrepOrder } from '@/lib/prepIngredients';
import { LOYALTY_GIFT_SOURCE, NEW_CUSTOMER_GIFT_SOURCE } from '@/data/dishIngredients';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       got  ${g}\n       want ${w}`); }
};
const ok = (name: string, cond: boolean) => eq(name, !!cond, true);

/** SINCE 之后第 n 天（n 从 0 起），YYYY-MM-DD */
const day = (n: number) => {
  const d = new Date(LOYALTY_GIFT_SINCE + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const c = (id: string, key: string, deliveryDate: string, type: LoyaltyType = 'payg',
  isLunch = true, createdAtMs = 0): LoyaltyCandidate =>
  ({ id, key, deliveryDate, type, isLunch, createdAtMs });
const ids = (s: Set<string>) => [...s].sort();

console.log('\n=== 1. 分类与计数资格 ===');
{
  eq('用了券 → voucher', loyaltyTypeOf({ mealVouchersUsed: 2 }), 'voucher');
  eq('没用券 → payg', loyaltyTypeOf({ mealVouchersUsed: 0 }), 'payg');
  eq('字段缺失 → payg', loyaltyTypeOf({}), 'payg');
  ok('cancelled 不算', !countsTowardLoyalty({ status: 'cancelled' }));
  ok('refunded 不算', !countsTowardLoyalty({ status: 'refunded' }));
  ok('FPX pending（没付钱）不算', !countsTowardLoyalty({ status: 'pending', paymentMethod: 'fpx' }));
  ok('QR pending（已付待核）算', countsTowardLoyalty({ status: 'pending', paymentMethod: 'qr' }));
  ok('delivered 算', countsTowardLoyalty({ status: 'delivered', paymentMethod: 'fpx' }));
}

console.log('\n=== 2. 现金单每 3 天、送完重数 ===');
{
  const list = Array.from({ length: 7 }, (_, i) => c(`p${i + 1}`, 'A', day(i)));
  eq('第 3、6 天送，第 7 天不送', ids(selectLoyaltyGiftIds(list)), ['p3', 'p6']);
  eq('只有 2 天 → 不送', ids(selectLoyaltyGiftIds(list.slice(0, 2))), []);
}

console.log('\n=== 3. 餐券单每 5 天 ===');
{
  const list = Array.from({ length: 10 }, (_, i) => c(`v${i + 1}`, 'B', day(i), 'voucher'));
  eq('第 5、10 天送', ids(selectLoyaltyGiftIds(list)), ['v10', 'v5']);
  eq('只有 4 天 → 不送', ids(selectLoyaltyGiftIds(list.slice(0, 4))), []);
}

console.log('\n=== 4. 一天只算一次（午+晚两张） ===');
{
  const list = [
    c('d1L', 'A', day(0)), c('d1D', 'A', day(0), 'payg', false),
    c('d2L', 'A', day(1)), c('d2D', 'A', day(1), 'payg', false),
    c('d3D', 'A', day(2), 'payg', false), c('d3L', 'A', day(2), 'payg', true, 999),
  ];
  eq('3 个配送日（6 张单）只送 1 份，挂在第 3 天午餐那张', ids(selectLoyaltyGiftIds(list)), ['d3L']);
  const sameMeal = [
    c('x1', 'A', day(0)), c('x2', 'A', day(1)),
    c('late', 'A', day(2), 'payg', true, 200), c('early', 'A', day(2), 'payg', true, 100),
  ];
  eq('同餐段两张 → createdAt 早的那张', ids(selectLoyaltyGiftIds(sameMeal)), ['early']);
}

console.log('\n=== 5. 餐券单与现金单各数各的 ===');
{
  const list = [
    c('p1', 'A', day(0)), c('v1', 'A', day(1), 'voucher'), c('p2', 'A', day(2)),
    c('v2', 'A', day(3), 'voucher'), c('p3', 'A', day(4)),
  ];
  eq('现金第 3 天送；餐券只有 2 天不送（不合并成 5 天）', ids(selectLoyaltyGiftIds(list)), ['p3']);
  const sameDay = [
    c('p1', 'A', day(0)), c('p2', 'A', day(1)),
    c('p3', 'A', day(2), 'payg', false), c('v1', 'A', day(2), 'voucher', true),
  ];
  eq('同一天午券晚现金 → 现金计数器照样到 3', ids(selectLoyaltyGiftIds(sameDay)), ['p3']);
}

console.log('\n=== 6. 上线日前的单不算、不同客人互不影响、认不出人不送 ===');
{
  const before = [
    c('old1', 'A', '2026-09-28'), c('old2', 'A', '2026-09-29'),
    c('n1', 'A', day(0)), c('n2', 'A', day(1)),
  ];
  eq('上线前 2 单 + 上线后 2 单 → 不送（从 0 数）', ids(selectLoyaltyGiftIds(before)), []);
  const mixed = [
    c('a1', 'A', day(0)), c('b1', 'B', day(0)), c('a2', 'A', day(1)),
    c('b2', 'B', day(1)), c('a3', 'A', day(2)),
  ];
  eq('A 到 3 送，B 只有 2 不送', ids(selectLoyaltyGiftIds(mixed)), ['a3']);
  const anon = [c('z1', '', day(0)), c('z2', '', day(1)), c('z3', '', day(2))];
  eq('key 为空 → 不送', ids(selectLoyaltyGiftIds(anon)), []);
}

console.log('\n=== 7. 稳定性：输入顺序打乱结果不变 ===');
{
  const list = Array.from({ length: 9 }, (_, i) => c(`s${i + 1}`, 'A', day(i)));
  const shuffled = [list[4], list[8], list[0], list[6], list[2], list[7], list[1], list[5], list[3]];
  eq('乱序 = 顺序', ids(selectLoyaltyGiftIds(shuffled)), ids(selectLoyaltyGiftIds(list)));
}

console.log('\n=== 8. 聚合：赠品一份薯煎蛋B，带来源标签 ===');
{
  const base: PrepOrder = { mealType: 'lunch', items: [{ name: '__不存在的菜__', quantity: 2 }] };
  const pick = (o: PrepOrder[], n: string) => aggregateIngredients(o).lines.find(l => l.name === n)?.qty ?? 0;
  eq('无标记 → 0 马铃薯', pick([base], '马铃薯'), 0);
  eq('回头客 → 37.5g（按人不按碗）', pick([{ ...base, isLoyaltyGift: true }], '马铃薯'), 37.5);
  eq('回头客 → 0.5 颗蛋', pick([{ ...base, isLoyaltyGift: true }], '鸡蛋(生)'), 0.5);
  const { lunch } = buildDailyPrepIngredients([{ ...base, isLoyaltyGift: true }, { ...base, isLoyaltyGift: true }], []);
  ok(`备餐单加料行带「${LOYALTY_GIFT_SOURCE} ×2」`, lunch.addOnText.includes(`${LOYALTY_GIFT_SOURCE} ×2`));
  // 同一天一位新客 + 一位回头客（两张不同的单）→ 两个来源各自成行，料共两份
  const day2 = [{ ...base, isNewCustomer: true }, { ...base, isLoyaltyGift: true }];
  eq('同天一位新客 + 一位回头客 → 共 75g', pick(day2, '马铃薯'), 75);
  const text = buildDailyPrepIngredients(day2, []).lunch.addOnText;
  ok('两个来源标签各占一行', text.includes(`${NEW_CUSTOMER_GIFT_SOURCE} ×1`) && text.includes(`${LOYALTY_GIFT_SOURCE} ×1`));
}

console.log('\n=== 9. 新客首单与回头客赠品永不落在同一张单 ===');
{
  // 老板 2026-09-30：一个人要么是新客要么是回头客。首单 = 第 1 个配送日，回头客
  // 赠品最早第 3 个，结构上不可能重叠 —— 这里用随机订单史把这条钉死，防以后改规则时破掉。
  let seed = 20260930;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let overlap = 0, gifted = 0, firsts = 0;
  for (let round = 0; round < 300; round++) {
    const list: LoyaltyCandidate[] = [];
    const n = 5 + rnd(40);
    for (let i = 0; i < n; i++) {
      list.push(c(`r${round}-${i}`, `K${rnd(4)}`, day(rnd(14) - 3), rnd(2) ? 'voucher' : 'payg', !!rnd(2), rnd(1000)));
    }
    const first = selectFirstOrderIds(list.map(x => ({ id: x.id, key: x.key, deliveryDate: x.deliveryDate, createdAtMs: x.createdAtMs })));
    const loyal = selectLoyaltyGiftIds(list);
    firsts += first.size; gifted += loyal.size;
    for (const id of loyal) if (first.has(id)) overlap++;
  }
  ok(`300 轮随机订单史：${firsts} 张首单 × ${gifted} 张回头客单，重叠 0`, overlap === 0 && gifted > 0 && firsts > 0);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
