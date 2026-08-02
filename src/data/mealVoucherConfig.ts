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
  id: '5' | '10' | '20';
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
  id: '5' | '10' | '20',
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

export function getBundle(bundleId: string): MealVoucherBundle | undefined {
  return MEAL_VOUCHER_BUNDLES.find(b => b.id === bundleId);
}

/**
 * 客户真正拿到的折扣 —— 分母是「一张券最多能兑掉多少钱的菜」，不是面值。
 *
 * 面值口径（faceValue / savings / savingsPercent，上面 buildBundle 算的那套）
 * 把 5 张装算成 0% 折扣，因为它拿 RM 18.50 当分母。但券的价值从来不是面值：
 * 一张 RM 17.50 的券能兑一份 RM 19.90 的菜，实际省 RM 2.40 = 12.1%，
 * 面值口径只报 5%。
 *
 * `redeemValue` 由调用方从 weeklyMenu 现算（见 MealVouchersView 的
 * bestVoucherValue），换菜自动跟上，不写死。
 *
 * ⚠️ 这是「最高」折扣，只在兑最贵的可兑主菜时成立 —— 兑 RM 18.50 的菜折扣更低。
 * 所有文案必须带「最高」字样，别写成无条件承诺。
 *
 * 面值口径仍是会计口径（MFRS 15 负债按 FACE_VALUE_RM 计），别混用。
 */
export interface BundleRedeemSavings {
  perMeal: number;   // 每份最多省多少 RM
  total: number;     // 整包最多省多少 RM
  percent: number;   // 0–100，保留一位小数
}

export function bundleRedeemSavings(
  bundle: MealVoucherBundle,
  redeemValue: number,
): BundleRedeemSavings {
  const perMeal = Math.max(0, redeemValue - bundle.pricePerVoucher);
  const percent = redeemValue > 0 ? (perMeal / redeemValue) * 100 : 0;
  return {
    perMeal: Number(perMeal.toFixed(2)),
    total: Number((perMeal * bundle.voucherCount).toFixed(2)),
    percent: Math.round(percent * 10) / 10,
  };
}

/** 12.1 → "12.1"，7.0 → "7"（不给客户看没意义的小数尾巴）。 */
export function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
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
