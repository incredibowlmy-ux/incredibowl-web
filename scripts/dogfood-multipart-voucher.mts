/**
 * Dogfood：餐券按配送组精确归属（src/lib/voucherGroupAllocation.ts）
 *
 * 重演 2026-08-04 订单 #C77ODR：Alison 一次结账 4 碗菜拆成两个配送日，4 张餐券
 * 的 claim 记录**全挂在 part 1**，part 2 只有一个按 subtotal 比例摊分出来的
 * mealVoucherDiscount(34.65，实际该是 37.00)。取消 part 2 时 orderRollback 读
 * claimedMealVoucherIds 读到空数组 → 退 0 张券，客户 2 张券凭空蒸发。
 *
 * 核心断言：**钱一分没变**（仍是 best-deal-first 取前 N 张），
 *          但每个配送组现在都拿得到属于自己的券。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-multipart-voucher.mts
 */

import { allocateVouchersByGroup, type VoucherServing } from '@/lib/voucherGroupAllocation';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       got  ${g}\n       want ${w}`); }
};
const near = (name: string, got: number, want: number) => {
  if (Math.abs(got - want) < 0.005) { pass++; console.log(`  ✅ ${name} = ${got}`); }
  else { fail++; console.log(`  ❌ ${name}: got ${got}, want ${want}`); }
};

/** 改动前的算法 —— 用来证明总金额口径没变。 */
const legacyTotal = (servings: VoucherServing[], n: number) =>
  Number([...servings].map(s => s.value).sort((a, b) => b - a).slice(0, n)
    .reduce((s, v) => s + v, 0).toFixed(2));

const A = '2026-08-05|Lunch (11AM-1PM)';   // 当归鸡 + 山药
const B = '2026-08-06|Lunch (11AM-1PM)';   // 鳗鱼(topUp 5) + 纳豆

console.log('\n=== 1. #C77ODR 真实重放（4 碗 / 4 券 / 跨两天）===');
{
  // 鳗鱼 24.90 topUp 5 → 券值 19.90；纳豆 16.90；当归鸡 18.50；山药 18.50
  const servings: VoucherServing[] = [
    { groupKey: B, value: 19.90 }, { groupKey: B, value: 16.90 },
    { groupKey: A, value: 18.50 }, { groupKey: A, value: 18.50 },
  ];
  const r = allocateVouchersByGroup(servings, 4);
  near('总折扣与旧口径一致', r.totalDiscount, legacyTotal(servings, 4));
  near('总折扣 = 73.80（线上实测账目）', r.totalDiscount, 73.80);
  eq('B 组（鳗鱼+纳豆）拿 2 张 / 36.80', r.perGroup[B], { count: 2, discountRM: 36.80 });
  eq('A 组（当归鸡+山药）拿 2 张 / 37.00', r.perGroup[A], { count: 2, discountRM: 37.00 });
  // 事故对照：旧比例摊分给 A 组 34.65，与实际该得的 37.00 差 2.35 —— 正是 #C77ODR
  // 账面那笔「不属于它的现金」。修复后 A 组券覆盖 37.00 = 两碗全额，现金 0。
  const legacySplitA = Number(((37.00 / 78.80) * 73.80).toFixed(2));
  near('旧比例摊分确实给了 A 组 34.65（事故值）', legacySplitA, 34.65);
}

console.log('\n=== 2. 券不够覆盖全部 → best-deal-first 仍生效 ===');
{
  const servings: VoucherServing[] = [
    { groupKey: B, value: 19.90 }, { groupKey: B, value: 16.90 },
    { groupKey: A, value: 18.50 }, { groupKey: A, value: 18.50 },
  ];
  const r = allocateVouchersByGroup(servings, 2);
  near('总折扣与旧口径一致', r.totalDiscount, legacyTotal(servings, 2));
  near('取最贵两份 19.90 + 18.50', r.totalDiscount, 38.40);
  eq('B 组 1 张（19.90）', r.perGroup[B], { count: 1, discountRM: 19.90 });
  eq('A 组 1 张（18.50）', r.perGroup[A], { count: 1, discountRM: 18.50 });
}

console.log('\n=== 3. 单 part（非组合单）行为与改动前逐字节一致 ===');
{
  const servings: VoucherServing[] = [
    { groupKey: A, value: 18.50 }, { groupKey: A, value: 24.90 }, { groupKey: A, value: 16.90 },
  ];
  const r = allocateVouchersByGroup(servings, 2);
  near('总折扣与旧口径一致', r.totalDiscount, legacyTotal(servings, 2));
  eq('全部券归唯一的组', r.perGroup[A], { count: 2, discountRM: 43.40 });
  eq('只有一个组', Object.keys(r.perGroup), [A]);
}

console.log('\n=== 4. 某组完全不用券 → 该组不出现（不会写券字段）===');
{
  const servings: VoucherServing[] = [
    { groupKey: A, value: 24.90 }, { groupKey: B, value: 10.00 },
  ];
  const r = allocateVouchersByGroup(servings, 1);
  eq('只有 A 组分到券', Object.keys(r.perGroup), [A]);
  eq('B 组没有条目', r.perGroup[B], undefined);
}

console.log('\n=== 5. 边界：0 张券 / 空车 / 券数超过份数 ===');
{
  eq('0 张券 → 空分配', allocateVouchersByGroup([{ groupKey: A, value: 18.5 }], 0),
    { totalDiscount: 0, perGroup: {}, chosen: [] });
  eq('空 servings → 空分配', allocateVouchersByGroup([], 3),
    { totalDiscount: 0, perGroup: {}, chosen: [] });
  const r = allocateVouchersByGroup([{ groupKey: A, value: 18.5 }], 5);
  near('券数 > 份数 → 只用掉有的份', r.totalDiscount, 18.5);
  eq('chosen 长度受份数限制', r.chosen.length, 1);
}

console.log('\n=== 6. chosen 可按组连续切片（submit-order 就这么切 claim ID）===');
{
  const servings: VoucherServing[] = [
    { groupKey: B, value: 19.90 }, { groupKey: A, value: 18.50 },
    { groupKey: B, value: 16.90 }, { groupKey: A, value: 18.50 },
  ];
  const r = allocateVouchersByGroup(servings, 4);
  const ids = ['v1', 'v2', 'v3', 'v4'];
  const seen = new Set<string>(); let cursor = 0; let ok = true;
  for (const share of Object.values(r.perGroup)) {
    const slice = ids.slice(cursor, cursor + share.count);
    cursor += share.count;
    if (slice.length !== share.count) ok = false;
    slice.forEach(id => { if (seen.has(id)) ok = false; seen.add(id); });
  }
  eq('切分无重复无遗漏，用满全部券', [ok, seen.size, cursor], [true, 4, 4]);
  near('各组 discountRM 之和 === totalDiscount',
    Object.values(r.perGroup).reduce((s, g) => s + g.discountRM, 0), r.totalDiscount);
}

console.log('\n=== 7. 随机对拍 300 组：新旧总折扣必须永远相等 ===');
{
  let mismatch = 0;
  let seed = 42;  // 固定种子 → 可重放
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 300; t++) {
    const count = 1 + Math.floor(rnd() * 8);
    const servings: VoucherServing[] = Array.from({ length: count }, () => ({
      groupKey: rnd() < 0.5 ? A : B,
      value: Number((10 + rnd() * 15).toFixed(2)),
    }));
    const n = Math.floor(rnd() * (count + 2));
    const r = allocateVouchersByGroup(servings, n);
    if (Math.abs(r.totalDiscount - legacyTotal(servings, n)) > 0.005) mismatch++;
    const sum = Object.values(r.perGroup).reduce((s, g) => s + g.discountRM, 0);
    if (Math.abs(sum - r.totalDiscount) > 0.005) mismatch++;   // 不变式：分组之和 === 总额
  }
  eq('300 组随机购物车，新旧口径零差异', mismatch, 0);
}

console.log(`\n${'='.repeat(52)}`);
console.log(fail === 0 ? `✅ 全部通过（${pass}/${pass + fail}）` : `❌ ${fail} 项失败（${pass}/${pass + fail}）`);
process.exit(fail === 0 ? 0 : 1);
