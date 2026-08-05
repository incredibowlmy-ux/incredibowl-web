/**
 * Meal-voucher → delivery-group allocation.
 *
 * A single checkout can span several delivery dates/slots ("multi-part"):
 * submit-order writes ONE order doc per group. This module decides which
 * servings the vouchers cover and therefore **which part owns which voucher**.
 *
 * Why it exists (2026-08-04, order #C77ODR):
 *   The old code collected every serving's voucher value into a plain
 *   `number[]`, sorted it, and took the top N. That sort threw away "which
 *   delivery group did this serving belong to" — so the claimed voucher IDs
 *   were all attached to part 1 and the other parts only carried a
 *   subtotal-proportional `mealVoucherDiscount` figure. Cancelling such an
 *   "orphan part" made orderRollback read an empty claimedMealVoucherIds and
 *   release ZERO vouchers: the customer's vouchers silently evaporated, and
 *   the group's recognized revenue stayed booked on part 1.
 *
 * The money is unchanged — still "best deal first", the top N highest-value
 * servings. The only difference is that the group each chosen serving came
 * from is now carried through, so every part can own its own vouchers.
 *
 * Mirrors the shape of `planAddonCreditDeduction` (addonCreditMath.ts), which
 * already allocated per-group exactly; `groupKey` MUST be the same
 * `${date}|${time}` string used by submit-order's order-doc split.
 *
 * Pure — no firebase, no I/O. Directly testable (scripts/dogfood-multipart-voucher.mjs).
 */

export interface VoucherServing {
  /** `${selectedDate}|${selectedTime}` — same key as the order-doc split. */
  groupKey: string;
  /** dishVoucherValue(unitPrice, dish): unit price minus per-dish top-up. */
  value: number;
}

export interface GroupVoucherShare {
  /** How many vouchers this delivery group consumes. */
  count: number;
  /** RM covered by those vouchers for this group. */
  discountRM: number;
}

export interface VoucherAllocation {
  /** Total RM covered — identical to the pre-2026-08-04 single-number result. */
  totalDiscount: number;
  /** groupKey → that group's share. Groups covering no serving are absent. */
  perGroup: Record<string, GroupVoucherShare>;
  /**
   * The chosen servings in the order the vouchers should be handed out.
   * Claimed voucher IDs are sliced against this order, so a group's vouchers
   * are contiguous — see submit-order's claim write-back.
   */
  chosen: VoucherServing[];
}

/**
 * Pick the `voucherCount` best-value servings and report the per-group split.
 *
 * `Array.prototype.sort` has been stable since ES2019, so equal-value servings
 * keep cart order — replaying the same cart yields byte-identical allocation.
 */
export function allocateVouchersByGroup(
  servings: VoucherServing[],
  voucherCount: number,
): VoucherAllocation {
  const empty: VoucherAllocation = { totalDiscount: 0, perGroup: {}, chosen: [] };
  if (!Array.isArray(servings) || servings.length === 0) return empty;
  const n = Math.max(0, Math.floor(voucherCount) || 0);
  if (n === 0) return empty;

  // Best deal first — a voucher is worth the same whatever it covers, so it
  // should cover the priciest serving available.
  const chosen = [...servings].sort((a, b) => b.value - a.value).slice(0, n);

  const perGroup: Record<string, GroupVoucherShare> = {};
  let totalDiscount = 0;
  for (const s of chosen) {
    const g = (perGroup[s.groupKey] ||= { count: 0, discountRM: 0 });
    g.count += 1;
    g.discountRM = Number((g.discountRM + s.value).toFixed(2));
    totalDiscount += s.value;
  }

  return { totalDiscount: Number(totalDiscount.toFixed(2)), perGroup, chosen };
}
