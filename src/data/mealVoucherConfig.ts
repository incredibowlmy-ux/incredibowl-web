/**
 * Meal Voucher (餐券预付包) — central pricing & policy config.
 *
 * 1 voucher = 1 main dish (any dish from weeklyMenu, not add-ons).
 * Pre-paid in bundles. Vouchers do NOT cover add-ons — those still
 * require cash payment at checkout.
 *
 * Pricing decided 2026-05-10, discounts compressed 2026-06-03 (margin/positioning):
 *  - 5  vouchers @ RM 92.50  (face value, 0% off — entry tier)
 *  - 10 vouchers @ RM 180.00 (~3% off, save RM 5.00,  RM 18.00/voucher)
 *  - 20 vouchers @ RM 350.00 (~5% off, save RM 20.00, RM 17.50/voucher)
 *
 * Validity (decided 2026-05-16):
 *  - 5  / 10 张装：30 天（鼓励频次，避免囤货沉睡）
 *  - 20    张装：60 天（重度用户多给一倍时间消耗）
 */

export interface MealVoucherBundle {
  id: '1' | '5' | '10' | '20';
  voucherCount: number;
  price: number;          // RM total
  pricePerVoucher: number;
  faceValue: number;      // voucherCount × FACE_VALUE_RM
  savings: number;        // faceValue - price
  savingsPercent: number; // 0–100
  validityDays: number;   // days until each voucher in this bundle expires
  label: string;
  highlight?: string;
}

/** Reference price for a single main dish (used to display "savings"). */
export const FACE_VALUE_RM = 18.50;

/** Hard policy: vouchers + RM-promo codes are mutually exclusive per order. */
export const VOUCHERS_BLOCK_PROMO_CODE = true;

function buildBundle(
  id: '1' | '5' | '10' | '20',
  voucherCount: number,
  price: number,
  validityDays: number,
  highlight?: string,
): MealVoucherBundle {
  const faceValue = voucherCount * FACE_VALUE_RM;
  const savings = Math.max(0, faceValue - price);
  const savingsPercent = faceValue > 0 ? Math.round((savings / faceValue) * 100) : 0;
  const pricePerVoucher = Number((price / voucherCount).toFixed(2));
  return {
    id,
    voucherCount,
    price,
    pricePerVoucher,
    faceValue,
    savings,
    savingsPercent,
    validityDays,
    label: `${voucherCount} 张餐券`,
    highlight,
  };
}

export const MEAL_VOUCHER_BUNDLES: MealVoucherBundle[] = [
  buildBundle('5',  5,  92.50,  30),
  buildBundle('10', 10, 180.00, 30, '人气之选'),
  buildBundle('20', 20, 350.00, 60, '最划算'),
];

// ⚠️ 临时测试套餐 — RM1 / 1 张，仅供 admin 验证 FPX→webhook 铸券链路用最小金额跑通。
// 故意不放进 MEAL_VOUCHER_BUNDLES，所以它【永远不会渲染给客户】；只有
// MealVouchersView 在 admin 邮箱登录时手动追加显示。服务端 getBundle()/有效期解析
// 会认它（否则下单校验过不了）。⛔ 测试完请删掉本常量 + 视图里的追加逻辑。
export const TEST_MEAL_VOUCHER_BUNDLE: MealVoucherBundle = buildBundle('1', 1, 1.00, 30);

// 公开 + 隐藏测试，仅用于服务端查表 / 校验（不用于渲染）。
const ALL_BUNDLES: MealVoucherBundle[] = [...MEAL_VOUCHER_BUNDLES, TEST_MEAL_VOUCHER_BUNDLE];

export function getBundle(bundleId: string): MealVoucherBundle | undefined {
  return ALL_BUNDLES.find(b => b.id === bundleId);
}

/**
 * Validity for a given bundle. Falls back to the longest configured validity
 * (60 days) when the bundle ID can't be resolved — safer to over-grant than
 * silently expire a real customer's voucher.
 */
export function getValidityDaysForBundle(bundleId: string): number {
  const b = getBundle(bundleId);
  if (b) return b.validityDays;
  return Math.max(...MEAL_VOUCHER_BUNDLES.map(x => x.validityDays));
}
