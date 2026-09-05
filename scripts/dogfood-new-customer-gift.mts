/**
 * Dogfood：新客首单赠品（马铃薯煎蛋B，老板 2026-08-10 定）
 *
 * 两件事必须钉死，错了就是漏送 / 重复送 / 备错料：
 *   1. 判定 —— 谁是新客（电话优先归并、拆单只算一次、取消单不算历史、活动前不补送）
 *   2. 聚合 —— 赠品按「人」不按「碗」，且在备餐单上带得出来源标签
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-new-customer-gift.mts
 */
import {
  selectFirstOrderIds, customerKeyOf, NEW_CUSTOMER_GIFT_SINCE, type Candidate,
} from '@/lib/newCustomerGift';
import { aggregateIngredients, buildDailyPrepIngredients, type PrepOrder } from '@/lib/prepIngredients';
import { NEW_CUSTOMER_GIFT_RECIPE, NEW_CUSTOMER_GIFT_SOURCE } from '@/data/dishIngredients';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       got  ${g}\n       want ${w}`); }
};
const ok = (name: string, cond: boolean) => eq(name, !!cond, true);

const AFTER = NEW_CUSTOMER_GIFT_SINCE;                       // 活动期内
const BEFORE = '2026-07-01';                                 // 活动之前
const c = (id: string, key: string, deliveryDate: string, createdAtMs = 0): Candidate =>
  ({ id, key, deliveryDate, createdAtMs });
const ids = (s: Set<string>) => [...s].sort();

console.log('\n=== 1. 客户身份：电话优先，退回 uid ===');
{
  eq('电话带国码/横线都归一', customerKeyOf({ userPhone: '+60 10-337 0197' }), '103370197');
  eq('有电话就不看 uid', customerKeyOf({ userPhone: '0103370197', userId: 'manual_0103370197' }), '103370197');
  eq('没电话退回 uid', customerKeyOf({ userPhone: '', userId: 'abc123' }), 'abc123');
  eq('两个都没有 → 空串（不送）', customerKeyOf({}), '');
}

console.log('\n=== 2. 同一个人挂多个 uid（实测 912 单里有 8 位）只送一次 ===');
{
  // 手动单 stub、匿名 uid、绑 Google 后的正式 uid —— 电话相同就是同一个人
  const set = selectFirstOrderIds([
    c('o1', customerKeyOf({ userPhone: '0123372317', userId: 'manual_0123372317' }), AFTER),
    c('o2', customerKeyOf({ userPhone: '+60123372317', userId: 'anon_xyz' }), '2026-08-12'),
    c('o3', customerKeyOf({ userPhone: '123372317', userId: 'google_abc' }), '2026-08-15'),
  ]);
  eq('三张单同一个人 → 只有最早那张送', ids(set), ['o1']);
}

console.log('\n=== 3. 首单按「配送日」算，不是下单时间 ===');
{
  // 客人 8/10 下了一张送 8/20 的单，8/11 又下一张送 8/12 的 →
  // 赠品要落在他**第一次吃到**的 8/12 那碗，而不是先下单的那张
  const set = selectFirstOrderIds([
    c('later-delivery', 'p1', '2026-08-20', 1000),
    c('first-meal', 'p1', '2026-08-12', 2000),
  ]);
  eq('送最早配送日那张', ids(set), ['first-meal']);
}

console.log('\n=== 4. 拆单 / 订阅批量建单：同一天多张只送一份 ===');
{
  const set = selectFirstOrderIds([
    c('part1', 'p2', AFTER, 5000),
    c('part2', 'p2', AFTER, 5000),   // 同秒建的组合单第二段
    c('sub3', 'p2', '2026-08-13', 5000),
  ]);
  eq('三张只中一张', ids(set).length, 1);
  eq('中的是 id 序最小那张（结果稳定，不会今天标 A 明天标 B）', ids(set), ['part1']);
  // 反复算结果必须一致
  const again = selectFirstOrderIds([
    c('sub3', 'p2', '2026-08-13', 5000),
    c('part2', 'p2', AFTER, 5000),
    c('part1', 'p2', AFTER, 5000),
  ]);
  eq('换个输入顺序结果不变', ids(again), ['part1']);
}

console.log('\n=== 5. 老客户不补送，活动前的单不追溯 ===');
{
  const set = selectFirstOrderIds([
    c('old', 'p3', BEFORE),          // 7 月就下过 → 他不是新客
    c('new-today', 'p3', AFTER),
    c('rookie', 'p4', AFTER),        // 第一次来
  ]);
  eq('老客户今天这张不送，新客户送', ids(set), ['rookie']);

  const onlyOld = selectFirstOrderIds([c('old', 'p3', BEFORE)]);
  eq('活动前的首单不会在旧备餐单上凭空多出赠品', ids(onlyOld), []);
}

console.log('\n=== 6. 认不出是谁的单不送（宁可漏，不乱送）===');
{
  const set = selectFirstOrderIds([c('ghost', '', AFTER), c('known', 'p5', AFTER)]);
  eq('无电话无 uid → 跳过', ids(set), ['known']);
}

console.log('\n=== 7. 赠品按「人」算，不按「碗」算 ===');
{
  const oneBowl: PrepOrder = { isNewCustomer: true, items: [{ name: '马铃薯炖花肉片', quantity: 1 }] };
  const threeBowls: PrepOrder = { isNewCustomer: true, items: [{ name: '马铃薯炖花肉片', quantity: 3 }] };
  const potatoOf = (o: PrepOrder) =>
    aggregateIngredients([o]).lines.find(l => l.name === '马铃薯')?.qty ?? 0;
  const eggOf = (o: PrepOrder) =>
    aggregateIngredients([o]).lines.find(l => l.name === '鸡蛋(生)')?.qty ?? 0;

  // 主菜自带马铃薯 100g/份，赠品另加 37.5g（只加一次）
  eq('1 碗：100 + 37.5', potatoOf(oneBowl), 137.5);
  eq('3 碗：300 + 37.5（不是 +112.5）', potatoOf(threeBowls), 337.5);
  eq('赠品的蛋 0.5 颗', eggOf(oneBowl), 0.5);

  const notNew: PrepOrder = { items: [{ name: '马铃薯炖花肉片', quantity: 1 }] };
  eq('不是新客 → 一克都不多', potatoOf(notNew), 100);
  eq('不是新客 → 没有蛋', eggOf(notNew), 0);
}

console.log('\n=== 8. 两位新客 = 一整颗蛋（合并后可采购）===');
{
  const two: PrepOrder[] = [
    { isNewCustomer: true, items: [{ name: '豆酱焖排骨', quantity: 1 }] },
    { isNewCustomer: true, items: [{ name: '豆酱焖排骨', quantity: 1 }] },
  ];
  const lines = aggregateIngredients(two).lines;
  eq('马铃薯 75g', lines.find(l => l.name === '马铃薯')?.qty, 75);
  eq('鸡蛋(生) 1 颗', lines.find(l => l.name === '鸡蛋(生)')?.qty, 1);
  eq('赠品配方本身没被改动', NEW_CUSTOMER_GIFT_RECIPE, [
    { name: '马铃薯', qty: 37.5, unit: 'g' },
    { name: '鸡蛋(生)', qty: 0.5, unit: '颗' },
  ]);
}

console.log('\n=== 9. 备餐单上赠品带来源标签（否则不知道这份是送的）===');
{
  const { lunch } = buildDailyPrepIngredients(
    [{ isNewCustomer: true, deliveryTime: '12:00', items: [{ name: '豆酱焖排骨', quantity: 1 }] }],
    [],
  );
  ok(`加料行标了「${NEW_CUSTOMER_GIFT_SOURCE}」`, lunch.addOnText.includes(NEW_CUSTOMER_GIFT_SOURCE));
  ok('马铃薯出现在加料行', lunch.addOnText.includes('马铃薯 37.5g'));
  console.log(`     加料行实际内容：${lunch.addOnText}`);

  // 客人真花钱加了马铃薯时，两个来源要分开列，不能混成一坨
  const mixed = buildDailyPrepIngredients(
    [
      { isNewCustomer: true, deliveryTime: '12:00', items: [{ name: '豆酱焖排骨', quantity: 1 }] },
      { deliveryTime: '12:00', items: [{ name: '豆酱焖排骨', quantity: 1, addOns: [{ label: '【优质碳水】加马铃薯 (90g)', quantity: 1 }] }] },
    ],
    [],
  ).lunch;
  // 2026-09-05 修断言（不是改行为）：6423a0e「加料按成品聚合」之后，括号里装的是
  // **食材明细**（`加马铃薯 ×1（马铃薯 100g）`），不再是来源名。旧断言找的是
  // `（加马铃薯）` 这种把来源套进括号的老格式，永远匹配不上 —— 一直红着没人看见，
  // 因为当时没有 CI。真正要守的性质是「两个来源各自成段、数量不合并」：自费那份
  // 100g、赠品那份 37.5g 必须分开出现，绝不能糊成一坨 137.5g。
  ok('赠品与客人自费加料分行显示',
    mixed.addOnText.includes('加马铃薯 ×1')
    && mixed.addOnText.includes(`${NEW_CUSTOMER_GIFT_SOURCE} ×1`)
    && mixed.addOnText.includes('马铃薯 100g')
    && mixed.addOnText.includes('马铃薯 37.5g'));
  console.log(`     混合时实际内容：${mixed.addOnText}`);
}

console.log('\n=== 10. 没有新客时，备餐单与改动前逐字节一致 ===');
{
  const plain: PrepOrder[] = [{ deliveryTime: '12:00', items: [{ name: '豆酱焖排骨', quantity: 2 }] }];
  const { lunch } = buildDailyPrepIngredients(plain, []);
  eq('加料行仍是「—」', lunch.addOnText, '—');
  eq('食材合计不含马铃薯', aggregateIngredients(plain).lines.some(l => l.name === '马铃薯'), false);
}

console.log(`\n${'='.repeat(52)}`);
console.log(fail === 0 ? `✅ 全部通过（${pass}/${pass + fail}）` : `❌ ${fail} 项失败（${pass}/${pass + fail}）`);
process.exit(fail === 0 ? 0 : 1);
