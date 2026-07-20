/**
 * Prepaid add-on credit deduction — SINGLE SOURCE for client AND server.
 *
 * CartDrawer (client display + clientAddonCreditDiscount) and
 * /api/submit-order (authoritative amounts + FIFO claim lines) both import
 * `planAddonCreditDeduction` from here, so the two sides can never drift.
 * The server reconciles the client's number within ±0.02 — any edit to this
 * file is live on both ends by construction.
 *
 * Rules (老板拍板 2026-07-20):
 *  1. Fully automatic — every matching credit is applied, no opt-out.
 *  2. Stacks with meal vouchers AND promo codes.
 *  3. Voucher top-up (wagyu/salmon upgrade) is covered by the matching
 *     upgrade credit ONLY for servings actually covered by a meal voucher;
 *     paying full cash for the dish never consumes an upgrade credit.
 *
 * Pure data deps only (no firebase) — safe in both bundles.
 */

import { ADD_ON_PRICES, getPrepaidAddonOption } from '@/data/addOnsConfig';

export interface CreditBundleInput {
  /** Delivery-group key — MUST match the `${date}|${time}` grouping key used
   *  by submit-order's order-doc split so per-part discounts land correctly. */
  groupKey: string;
  /** dishVoucherValue(unitPrice, dish) — voucher-covered value per serving. */
  voucherValue: number;
  /** dish.topUpAddonId (upgrade-credit pool id), if any. */
  topUpAddonId?: string;
  /** dish.voucherTopUp ?? 0 — cash top-up per voucher-redeemed serving. */
  topUpRM: number;
  /** Main-dish servings in this bundle: dishQty × quantity. */
  units: number;
  /** Cart add-ons, quantities already multiplied by bundle quantity. */
  addOns: Array<{ id: string; totalQty: number }>;
}

export interface AddonCreditPlan {
  /** RM knocked off the bill (rounded to cents). */
  totalDiscount: number;
  /** RM discount per delivery-group key (Σ equals totalDiscount exactly). */
  perGroupDiscount: Record<string, number>;
  /** Aggregated claim lines — shape claimAddonCredits() expects, one row per addonId. */
  lines: Array<{ addonId: string; count: number }>;
  /** Total credit units consumed (for the「N 份」breakdown label). */
  unitsUsed: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function planAddonCreditDeduction(
  bundles: CreditBundleInput[],
  mealVouchersUsed: number,
  availableByAddon: Map<string, number>,
): AddonCreditPlan {
  const remaining = new Map(availableByAddon);
  const perGroup: Record<string, number> = {};
  const lineMap = new Map<string, number>();
  let totalDiscount = 0;
  let unitsUsed = 0;

  const spend = (addonId: string, count: number, rm: number, groupKey: string) => {
    remaining.set(addonId, (remaining.get(addonId) || 0) - count);
    lineMap.set(addonId, (lineMap.get(addonId) || 0) + count);
    perGroup[groupKey] = round2((perGroup[groupKey] || 0) + rm);
    totalDiscount = round2(totalDiscount + rm);
    unitsUsed += count;
  };

  // ── Pass 1: voucher top-up coverage (priority, mirrors订阅引擎) ──
  // Which servings a voucher covers = the best-deal slots: expand every
  // serving in cart order, stable-sort by voucherValue descending, take the
  // first `mealVouchersUsed`. Identical comparator + expansion order on both
  // ends (this IS both ends), so coverage is deterministic.
  if (mealVouchersUsed > 0) {
    const servings: Array<{ voucherValue: number; topUpAddonId?: string; topUpRM: number; groupKey: string }> = [];
    for (const b of bundles) {
      for (let k = 0; k < b.units; k++) {
        servings.push({ voucherValue: b.voucherValue, topUpAddonId: b.topUpAddonId, topUpRM: b.topUpRM, groupKey: b.groupKey });
      }
    }
    const covered = [...servings]
      .sort((a, b) => b.voucherValue - a.voucherValue)
      .slice(0, mealVouchersUsed);
    for (const s of covered) {
      if (!s.topUpAddonId || s.topUpRM <= 0) continue;
      if ((remaining.get(s.topUpAddonId) || 0) <= 0) continue;
      spend(s.topUpAddonId, 1, s.topUpRM, s.groupKey);
    }
  }

  // ── Pass 2: regular prepaid add-ons, in cart order ──
  // Only whitelisted prepaid ids with a positive price (RM0 items like
  // less-rice would burn credits without saving money — skip).
  for (const b of bundles) {
    for (const a of b.addOns) {
      if (a.totalQty <= 0) continue;
      if (!getPrepaidAddonOption(a.id)) continue;
      const price = ADD_ON_PRICES[a.id];
      if (!price || price <= 0) continue;
      const take = Math.min(a.totalQty, remaining.get(a.id) || 0);
      if (take <= 0) continue;
      spend(a.id, take, round2(take * price), b.groupKey);
    }
  }

  return {
    totalDiscount,
    perGroupDiscount: perGroup,
    lines: [...lineMap.entries()].map(([addonId, count]) => ({ addonId, count })),
    unitsUsed,
  };
}
