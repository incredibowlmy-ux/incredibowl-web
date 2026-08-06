/**
 * Dogfood：编辑订单不得改写 total（2026-08-06）
 *
 * 重演事故路径：dashboard 编辑一张餐券单时，#moVouchersUsed 每次开 modal 都被
 * 重置为 0，且编辑模式禁止填券数 —— 所以 mealVoucherDiscount / prepaidCoverage
 * 恒为 0，`total - 0 - 0 - 0` 把 total 从「面值−抵扣」静默改回**全额面值**。
 * 而 mealVoucherDiscount 等字段是条件写入、编辑时不在 updateFields 里，于是
 * 订单自相矛盾：total 说客户付了全款、券字段说抵了大半 →
 * 营收公式 total + allocatedRevenue 把同一笔钱算两遍。
 *
 * 这里用真实订单形态验证「编辑时沿用原单抵扣额重算」的逻辑（与 dashboard 里
 * effMealVoucherDiscount / origCreditCoverageOf 的算法逐字一致）。
 *
 * 跑法：node --import ./scripts/_register-alias.mjs scripts/dogfood-edit-order-total.mts
 */

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n       got  ${g}\n       want ${w}`); }
};

// ── dashboard 里的两个函数（逐字复刻，改任一边都要同步）─────────────
function creditDiscountOf(o: any): number {
  if (!o) return 0;
  const singular = Number(o.addonCreditDiscount);
  if (Number.isFinite(singular) && singular > 0) return singular;
  return Number(o.addonCreditsDiscount) || 0;
}
function origCreditCoverageOf(o: any): number {
  if (!o) return 0;
  const explicit = Number(o.addonCreditDiscount ?? o.addonCreditsDiscount);
  if (Number.isFinite(explicit)) return explicit;
  if (!Array.isArray(o.addonCreditsUsed) || !o.addonCreditsUsed.length) return 0;
  const orig = Number(o.originalTotal) || 0;
  if (orig <= 0) return 0;
  const back = orig
    - (Number(o.mealVoucherDiscount) || 0)
    - (Number(o.promoDiscount || o.discount) || 0)
    - (Number(o.total) || 0);
  return back > 0.01 ? Number(back.toFixed(2)) : 0;
}
/** 编辑保存时算 total —— 与 dashboard 的 cashFoodTotal 同款。 */
function editTotal(orig: any, newMenuTotal: number, promoDiscount = 0): number {
  const effMV = Number(orig?.mealVoucherDiscount) || 0;
  const effAC = origCreditCoverageOf(orig);
  return Number(Math.max(0, newMenuTotal - effMV - promoDiscount - effAC).toFixed(2));
}
/** 修复前的算法（券/credit 归零）—— 用来证明事故确实存在。 */
const buggyTotal = (newMenuTotal: number) => Math.max(0, newMenuTotal - 0 - 0 - 0);

console.log('\n=== 1. 餐券全覆盖单（total=0）改地址 —— 最危险的一类 ===');
{
  // 真实形态：#YHYCY0 Candise Chan，菜款 44.80，2 张券抵 39.80，credit 抵 5.00
  const o = {
    originalTotal: 44.80, total: 0,
    mealVoucherDiscount: 39.80, mealVouchersUsed: 2, mealVoucherAllocatedRevenue: 36,
    addonCreditsUsed: [{ addonId: 'sunny-egg', count: 2 }],
    // 老订阅单没有 discount 字段 → 靠反推
  };
  eq('反推出 credit 抵扣额 5.00', origCreditCoverageOf(o), 5);
  eq('编辑（菜没变）后 total 仍是 0', editTotal(o, 44.80), 0);
  eq('修复前会变成全额 44.80（事故）', buggyTotal(44.80), 44.80);
  const revenueFixed = editTotal(o, 44.80) + o.mealVoucherAllocatedRevenue;
  const revenueBuggy = buggyTotal(44.80) + o.mealVoucherAllocatedRevenue;
  eq('营收保持 36（不是双计的 80.80）', [revenueFixed, revenueBuggy], [36, 80.8]);
}

console.log('\n=== 2. 部分现金的餐券单（total>0）===');
{
  // 真实形态：#MYCGVI 三文鱼×2(当时 23.90) + 西兰花炒蛋，券 39.80，credit 8.00
  const o = {
    originalTotal: 58.70, total: 10.90,
    mealVoucherDiscount: 39.80, mealVouchersUsed: 2, mealVoucherAllocatedRevenue: 35,
    addonCreditsUsed: [{ addonId: 'salmon-upgrade', count: 2 }],
    addonCreditsAllocatedRevenue: 8,
  };
  // ⚠️ 关键：不能用「明细 × 当前价格表」——salmon-upgrade 07-26 从 4.00 涨到
  // 5.00，那样会算成 10.00 → 假的 RM2 差额。反推拿到的是**当时**的真实抵扣额。
  eq('反推出当时的 credit 抵扣额 8.00（不是今天价的 10.00）', origCreditCoverageOf(o), 8);
  eq('编辑后 total 仍是 10.90', editTotal(o, 58.70), 10.90);
  eq('修复前会变成 58.70（多计 47.80）', buggyTotal(58.70), 58.70);
}

console.log('\n=== 3. 新格式订阅单（已落库 addonCreditsDiscount）===');
{
  // 2026-08-06 起订阅建单会写这个字段 → 直接读，不必反推
  const o = {
    originalTotal: 58.40, total: 0,
    mealVoucherDiscount: 39.80, mealVouchersUsed: 2, mealVoucherAllocatedRevenue: 35,
    addonCreditsUsed: [{ addonId: 'salmon-upgrade', count: 1 }, { addonId: 'shrimp-broccoli-steamed-egg', count: 2 }],
    addonCreditsAllocatedRevenue: 17.60,   // 摊销收入 ≠ 抵扣额
    addonCreditsDiscount: 18.60,           // ← 真正的抵扣额
  };
  eq('直接读到 18.60（不是摊销的 17.60）', origCreditCoverageOf(o), 18.60);
  eq('编辑后 total 仍是 0', editTotal(o, 58.40), 0);
}

console.log('\n=== 4. 普通现金单不受影响 ===');
{
  const o = { originalTotal: 42.80, total: 42.80 };
  eq('没有抵扣 → total 原样', editTotal(o, 42.80), 42.80);
  eq('改了菜品 → total 跟着变', editTotal(o, 24.90), 24.90);
}

console.log('\n=== 5. 编辑真的改了菜品时，抵扣仍按原值扣 ===');
{
  const o = {
    originalTotal: 44.80, total: 5.00,
    mealVoucherDiscount: 39.80, mealVouchersUsed: 2,
  };
  eq('菜款涨到 50 → 现金 10.20', editTotal(o, 50.00), 10.20);
  eq('菜款降到 39.80 → 现金 0（不会变负）', editTotal(o, 39.80), 0);
  eq('菜款低于券面值也不为负', editTotal(o, 20.00), 0);
}

console.log('\n=== 6. 确认框：0 元单的金额变动必须弹窗 ===');
{
  const shouldConfirm = (origTotal: number, newTotal: number) => origTotal > 0
    ? Math.abs(newTotal - origTotal) / origTotal > 0.15
    : Math.abs(newTotal - origTotal) > 0.01;
  eq('0 元单变 44.80 → 弹（旧写法恒不弹）', shouldConfirm(0, 44.80), true);
  eq('0 元单没变 → 不弹', shouldConfirm(0, 0), false);
  eq('10.90 → 58.70 变动 >15% → 弹', shouldConfirm(10.90, 58.70), true);
  eq('42.80 → 42.90 微调 → 不弹', shouldConfirm(42.80, 42.90), false);
}

console.log(`\n${'='.repeat(52)}`);
console.log(fail === 0 ? `✅ 全部通过（${pass}/${pass + fail}）` : `❌ ${fail} 项失败（${pass}/${pass + fail}）`);
process.exit(fail === 0 ? 0 : 1);
