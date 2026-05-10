/**
 * Meal Voucher (餐券预付包) — central pricing & policy config.
 *
 * 1 voucher = 1 main dish (any dish from weeklyMenu, not add-ons).
 * Pre-paid in bundles. Vouchers do NOT cover add-ons — those still
 * require cash payment at checkout.
 *
 * Pricing decided 2026-05-10:
 *  - 5  vouchers @ RM 92.50  (face value, 0% off — entry tier)
 *  - 10 vouchers @ RM 175.75 (~5% off, save RM 9.25)
 *  - 20 vouchers @ RM 333.00 (~10% off, save RM 37.00)
 */

export interface MealVoucherBundle {
  id: '5' | '10' | '20';
  voucherCount: number;
  price: number;          // RM total
  pricePerVoucher: number;
  faceValue: number;      // voucherCount × FACE_VALUE_RM
  savings: number;        // faceValue - price
  savingsPercent: number; // 0–100
  label: string;
  highlight?: string;
}

/** Reference price for a single main dish (used to display "savings"). */
export const FACE_VALUE_RM = 18.50;

export const MEAL_VOUCHER_VALIDITY_DAYS = 60;

/** Hard policy: vouchers + RM-promo codes are mutually exclusive per order. */
export const VOUCHERS_BLOCK_PROMO_CODE = true;

function buildBundle(
  id: '5' | '10' | '20',
  voucherCount: number,
  price: number,
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
    label: `${voucherCount} 张餐券`,
    highlight,
  };
}

export const MEAL_VOUCHER_BUNDLES: MealVoucherBundle[] = [
  buildBundle('5',  5,  92.50),
  buildBundle('10', 10, 175.75, '人气之选'),
  buildBundle('20', 20, 333.00, '最划算'),
];

export function getBundle(bundleId: string): MealVoucherBundle | undefined {
  return MEAL_VOUCHER_BUNDLES.find(b => b.id === bundleId);
}
