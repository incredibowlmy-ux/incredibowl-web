/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Tiers (2026-07-29 — far tier reopened, delivered by Grab):
 *   0   – 2.5 km → RM 3  (free when freeDeliveryBasis ≥ RM 20 — saves RM 3)
 *   2.5 – 5   km → RM 5  (free when freeDeliveryBasis ≥ RM 30 — saves RM 5)
 *   5   – 7.5 km → RM 12 (free when freeDeliveryBasis ≥ RM 45 — saves RM 12)
 *   7.5 km +     → RM 18 FLAT — no free-delivery threshold, ever. Fulfilled
 *                  by Grab rather than our own runs (a 7.5 km+ round trip eats
 *                  ~1 h of kitchen time that would otherwise serve 3–4 near
 *                  orders). Owner decision 2026-07-29.
 *
 * Why the far tier has NO threshold (deliberate, not an oversight): a "spend
 * RM X → free" rule on a long route is self-harming — the customer pads the
 * basket to dodge RM 18 and we eat the full Grab fare on a longer trip. Near
 * tiers keep thresholds because padding a short route is cheap for us.
 *
 * Every other tier goes to RM 0 once its threshold is met — a clean "pay the
 * base fee, or hit the threshold and pay nothing" model.
 *
 * Both inner-near (0–2.5 km) and outer-near (2.5–5 km) report tier === 'near'
 * to keep downstream UI simple; both fee AND threshold are resolved by
 * distance via feeForDistance(km) + thresholdForDistance(km).
 *
 * Grandfathering ("existing customer didn't get affected"):
 *   Customers whose Firestore profile `createdAt` is BEFORE
 *   PRICING_V2_CUTOFF_MS (2026-05-16) keep the OLD 0–2 km = free tier.
 *   Two paths:
 *     - Geocoded existing customer at ≤ 2 km → free (resolveDeliveryFee)
 *     - Pre-geocode legacy (deliveryZone-only) within2km → free
 *   Everyone else falls into the distance-based tiers above.
 *
 * `freeDeliveryBasis` definition (decided 2026-05-11):
 *   cartTotal − promoDiscount  (RM-discount codes only)
 *   NOT subtracted: mealVoucherDiscount (prepaid meal vouchers don't game it)
 *
 * Rationale: meal vouchers are already paid revenue — burning one to redeem a
 * main dish shouldn't shrink the cart back below the threshold. RM-promo
 * codes ARE subtracted because they reduce real revenue per order.
 *
 * The 'far' tier was dormant between 2026-05-18 and 2026-07-29 (kept in the
 * union only for old order documents). It is now live again with different
 * semantics: RM 18 flat, no threshold, Grab-fulfilled.
 *
 * History:
 *   - 2026-05-12 — RM 40 rule extended to mid/far with a flat RM 10 off.
 *   - 2026-05-12 — Neighbour special: 2–5 km gets a lower RM 20 threshold.
 *   - 2026-05-16 — Collapsed the 0–2 km free tier into 0–5 km @ RM 5 (free at
 *     RM 20+). Existing customers (createdAt < cutoff) grandfathered onto the
 *     old 0–2 km free tier via resolveDeliveryFee().
 *   - 2026-05-17 — Split the near tier in half by distance: 0–2.5 km keeps the
 *     RM 20 threshold; 2.5–5 km gets a higher RM 30 threshold (longer routes
 *     need a slightly bigger basket to justify free delivery).
 *   - 2026-05-18 — Competitive repositioning: 0–2 km drops to RM 3 (Hometaste
 *     sells RM 2 city-wide; we can't price-war but can shrink the premium).
 *     Inner-near radius tightened 2.5 → 2 km to align with grandfather radius.
 *     8 km+ tier removed (0 actual customers, was carrying UI/code overhead).
 *   - 2026-05-19 — Boundary tweak: inner-near widened back 2 → 2.5 km (the
 *     RM 3 邻里特惠 should cover the obvious immediate-neighbour zone, not
 *     just a token 2 km radius). Mid ceiling tightened 8 → 7.5 km (matches
 *     actual route reach; the last 500 m never had customers anyway).
 *   - 2026-05-19 (later) — Mid tier repriced + discount logic unified.
 *     Mid fee 15 → 12, threshold 40 → 45, AND满-threshold benefit now waives
 *     the fee entirely (was "drops to RM 5"). DELIVERY_THRESHOLD_DISCOUNT_RM
 *     dropped — calcDeliveryFee simplified to "threshold met → 0, else
 *     baseFee". One mental model for all tiers.
 *   - 2026-07-29 — Far tier (7.5 km+) reopened at RM 18 flat, no threshold,
 *     Grab-fulfilled. This ALSO closes a live loophole: between 2026-05-19 and
 *     today, tierFromDistance() had no ceiling, so a 15 km address quietly fell
 *     into the mid tier and paid RM 12 (or RM 0 past RM 45) while every
 *     customer-facing surface said "7.5 km+ not delivered". Only the public
 *     /api/check-delivery preview enforced the ceiling; the geocode → profile →
 *     checkout path never did.
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
// Inner near (0–2.5 km) gets RM 3 / RM 20 threshold (邻里特惠). Outer near
// (2.5–5 km) gets RM 5 / RM 30 threshold. Both report tier === 'near' —
// fee + threshold resolved by distance. NOTE: INNER_NEAR_RADIUS_KM (2.5)
// is intentionally wider than FREE_DELIVERY_RADIUS_KM (2). The latter is
// the grandfather radius for pre-2026-05-16 customers (they stay free);
// the former is the new-rule邻里特惠 zone.
export const INNER_NEAR_RADIUS_KM = 2.5;
export const NEAR_RADIUS_KM = 5;
export const MID_RADIUS_KM = 7.5;

// Customers whose Firestore profile `createdAt` is BEFORE this cutoff are
// treated as "existing" and grandfathered onto the pre-2026-05-16 pricing
// (0–2 km = free). Customers created on/after the cutoff get the new flat
// 0–5 km @ RM 5 (free at RM 20+) rule.
//
// Date.UTC(year, monthIndex, day) → ms since epoch. Month is 0-indexed.
export const PRICING_V2_CUTOFF_MS = Date.UTC(2026, 4, 16); // 2026-05-16 00:00 UTC
// Per-distance free-delivery thresholds.
// Inner near (0–2.5 km): RM 20 — neighbour-special, one main + one add-on hits it.
// Outer near (2.5–5 km): RM 30 — slightly bigger basket for the longer ride.
// Mid (5–7.5 km): RM 45 — longer route needs a bigger basket to fully waive.
export const FREE_DELIVERY_THRESHOLD_NEAR_RM = 20;
export const FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM = 30;
export const FREE_DELIVERY_THRESHOLD_MID_RM = 45;
// Backwards-compat: callers that still want a single "rule of thumb" number
// (e.g. footer copy, EN nav) get the strictest threshold so anything we
// haven't migrated to per-tier still shows a conservative figure.
export const FREE_DELIVERY_THRESHOLD_RM = FREE_DELIVERY_THRESHOLD_MID_RM;
// Per-distance base fees. Inner near (0–2.5 km) RM 3 —邻里特惠. Outer near
// (2.5–5 km) RM 5. Mid (5–7.5 km) RM 12. Far (7.5 km+) RM 18 flat, Grab-run.
export const DELIVERY_FEE_INNER_NEAR_RM = 3;
export const DELIVERY_FEE_OUTER_NEAR_RM = 5;
export const DELIVERY_FEE_MID_RM = 12;
// Far tier (7.5 km+). Flat — thresholdForDistance() returns null past
// MID_RADIUS_KM so no basket size can ever waive it. Fulfilled by Grab.
export const DELIVERY_FEE_FAR_RM = 18;
// Legacy alias for the outer-near fee. Existing call sites that import
// DELIVERY_FEE_NEAR_RM (now ambiguous after the inner/outer split) get the
// outer value, which is the historical RM 5. New code should call
// feeForDistance(km) instead.
/** @deprecated Use feeForDistance(km) — this returns the outer-near fee (RM 5). */
export const DELIVERY_FEE_NEAR_RM = DELIVERY_FEE_OUTER_NEAR_RM;

// Backwards-compat alias used by older imports.
export const DELIVERY_FEE_OUTSIDE_RM = DELIVERY_FEE_OUTER_NEAR_RM;

/**
 * Threshold (in RM) at which the given tier's delivery-fee discount kicks in.
 * `null` means the tier has NO free-delivery threshold — no basket size waives
 * the fee (the far tier, by design).
 *
 * Note: the 'near' tier has a split threshold (RM 20 for 0–2 km, RM 30 for
 * 2.5–5 km). This function returns the *inner* (RM 20) threshold by default —
 * use thresholdForDistance(km) when distance is known for the accurate
 * per-user threshold.
 */
export function thresholdForTier(tier: DeliveryTier): number | null {
    switch (tier) {
        case 'free': return 0;
        case 'near': return FREE_DELIVERY_THRESHOLD_NEAR_RM;
        case 'mid':  return FREE_DELIVERY_THRESHOLD_MID_RM;
        case 'far':  return null; // flat RM 18 — never waived
    }
}

/**
 * Per-distance threshold, accurate within the split near tier.
 * Returns null past MID_RADIUS_KM — the far tier's RM 18 is flat, so there is
 * no amount to spend toward. Callers must handle null rather than defaulting
 * to a number, or they'd silently re-introduce free delivery at 15 km.
 */
export function thresholdForDistance(km: number): number | null {
    if (km <= INNER_NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_NEAR_RM;
    if (km <= NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM;
    if (km <= MID_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_MID_RM;
    return null;
}

/** Per-distance base fee. RM 3 inner / RM 5 outer / RM 12 mid / RM 18 far. */
export function feeForDistance(km: number): number {
    if (km <= INNER_NEAR_RADIUS_KM) return DELIVERY_FEE_INNER_NEAR_RM;
    if (km <= NEAR_RADIUS_KM) return DELIVERY_FEE_OUTER_NEAR_RM;
    if (km <= MID_RADIUS_KM) return DELIVERY_FEE_MID_RM;
    return DELIVERY_FEE_FAR_RM;
}

/** Coarse zone label (binary), kept for UX labels and order docs. */
export type DeliveryZone = 'within2km' | 'outside2km';

/** Granular fee tier — drives pricing. */
export type DeliveryTier = 'free' | 'near' | 'mid' | 'far';

/** Great-circle distance in km using the Haversine formula. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceFromPearlPointKm(lat: number, lng: number): number {
    return haversineKm(PEARL_POINT_LAT, PEARL_POINT_LNG, lat, lng);
}

export function zoneFromDistance(km: number): DeliveryZone {
    return km <= FREE_DELIVERY_RADIUS_KM ? 'within2km' : 'outside2km';
}

export function tierFromDistance(km: number): DeliveryTier {
    // 'near' (0–5 km) / 'mid' (5–7.5 km) / 'far' (7.5 km+, RM 18 flat).
    // 'free' is NOT produced here — it only comes from the legacy grandfathering
    // branch in resolveDeliveryFee() (pre-2026-05-16 customer within 2 km).
    //
    // The far branch is what closes the old "no ceiling" hole: before
    // 2026-07-29 anything past 5 km fell through to 'mid', so a 15 km address
    // paid RM 12 (or nothing past RM 45) despite the site saying we don't
    // deliver there.
    if (km <= NEAR_RADIUS_KM) return 'near';
    if (km <= MID_RADIUS_KM) return 'mid';
    return 'far';
}

/**
 * Calculate delivery fee in RM.
 *
 * @param distanceKm           distance from Pearl Point in km
 * @param freeDeliveryBasis    cartTotal − promoDiscount  (meal voucher NOT subtracted)
 */
export function calcDeliveryFee(distanceKm: number, freeDeliveryBasis: number): number {
    const tier = tierFromDistance(distanceKm);
    if (tier === 'free') return 0;
    // Hit the threshold → free, otherwise pay the base fee. Both fee AND
    // threshold resolve from distance — inner-near (0–2.5 km) RM 3 / RM 20,
    // outer-near (2.5–5 km) RM 5 / RM 30, mid (5–7.5 km) RM 12 / RM 45.
    // Far (7.5 km+) has threshold === null → always pays the flat RM 18.
    const threshold = thresholdForDistance(distanceKm);
    if (threshold !== null && freeDeliveryBasis >= threshold) return 0;
    return feeForDistance(distanceKm);
}

/**
 * RM amount the customer needs to add to hit their threshold and trigger
 * the delivery discount. Returns 0 if already past threshold, in the free
 * tier, or the basis is irrelevant.
 *
 * Threshold + benefit by distance:
 *   0–2.5 km  → RM 20 threshold → free (saves RM 3)
 *   2.5–5 km  → RM 30 threshold → free (saves RM 5)
 *   5–7.5 km  → RM 45 threshold → free (saves RM 12)
 *   7.5 km +  → no threshold — RM 18 flat, always returns 0 shortfall
 *
 * @param freeDeliveryBasis  cartTotal − promoDiscount  (meal voucher NOT subtracted)
 */
export function freeDeliveryShortfall(distanceKm: number, freeDeliveryBasis: number): number {
    const tier = tierFromDistance(distanceKm);
    if (tier === 'free') return 0;
    const threshold = thresholdForDistance(distanceKm);
    // Far tier: nothing to spend toward, so no "add RM X for free delivery"
    // nudge should ever render.
    if (threshold === null) return 0;
    if (freeDeliveryBasis >= threshold) return 0;
    return Math.max(0, threshold - freeDeliveryBasis);
}

export function zoneLabelZh(zone: DeliveryZone): string {
    return zone === 'within2km' ? '免运区（2km 内）' : '配送区（2km 外）';
}

export function tierLabelZh(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return '免运区（老客户）';
        case 'near': return '近距离（5km 内）';
        case 'mid': return '中距离（5–7.5km）';
        case 'far': return `远距离（${MID_RADIUS_KM}km 以上）`;
    }
}

/**
 * Friendly per-tier price hint. Pass the customer's distanceKm when known so
 * the split near tier shows the right threshold (RM 20 inner / RM 30 outer);
 * without it we fall back to the inner threshold.
 */
export function tierFeeHintZh(tier: DeliveryTier, distanceKm?: number): string {
    switch (tier) {
        case 'free': return '免运费';
        case 'near': {
            // When distance known, show the accurate inner/outer fee + threshold.
            // Without distance we fall back to inner (the friendliest figure).
            const fee = typeof distanceKm === 'number'
                ? feeForDistance(distanceKm)
                : DELIVERY_FEE_INNER_NEAR_RM;
            const threshold = typeof distanceKm === 'number'
                ? thresholdForDistance(distanceKm)
                : FREE_DELIVERY_THRESHOLD_NEAR_RM;
            return `RM ${fee} · 满 RM ${threshold} → 免运`;
        }
        case 'mid': return `RM ${DELIVERY_FEE_MID_RM} · 满 RM ${FREE_DELIVERY_THRESHOLD_MID_RM} → 免运`;
        case 'far': return `RM ${DELIVERY_FEE_FAR_RM} 固定 · 不设免运（Grab 配送）`;
    }
}

export function tierLabelEn(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return 'Free zone (legacy customer)';
        case 'near': return 'Near (within 5km)';
        case 'mid': return 'Mid (5–7.5km)';
        case 'far': return `Far (beyond ${MID_RADIUS_KM}km)`;
    }
}

/** See tierFeeHintZh — same per-distance handling for the split near tier. */
export function tierFeeHintEn(tier: DeliveryTier, distanceKm?: number): string {
    switch (tier) {
        case 'free': return 'Free delivery';
        case 'near': {
            const fee = typeof distanceKm === 'number'
                ? feeForDistance(distanceKm)
                : DELIVERY_FEE_INNER_NEAR_RM;
            const threshold = typeof distanceKm === 'number'
                ? thresholdForDistance(distanceKm)
                : FREE_DELIVERY_THRESHOLD_NEAR_RM;
            return `RM ${fee} · free over RM ${threshold}`;
        }
        case 'mid': return `RM ${DELIVERY_FEE_MID_RM} · free over RM ${FREE_DELIVERY_THRESHOLD_MID_RM}`;
        case 'far': return `RM ${DELIVERY_FEE_FAR_RM} flat · no free-delivery threshold (Grab)`;
    }
}

/**
 * Resolve fee + tier with legacy + grandfathering fallback.
 *
 * Pricing changed on 2026-05-16: 0-2 km free was collapsed into 0-5 km @ RM 5
 * (free at RM 20+). To honour "existing client remains the same":
 *   - Customers whose Firestore createdAt < PRICING_V2_CUTOFF_MS AND who are
 *     within 2 km keep their grandfathered free delivery.
 *   - Customers created on/after the cutoff get the new flat 0-5 km rule.
 *
 * Legacy users (registered before the geocode flow) have only the binary
 * deliveryZone field, no addressDistanceKm — they're always pre-cutoff so
 * the within2km branch grandfathers them too.
 *
 * @param customerCreatedAtMs  user.createdAt converted to epoch ms, or null
 *                             for anonymous/guest flow (defaults to new rule)
 *
 * Returns null if the user has neither distance nor zone — in that case
 * checkout is blocked and they're prompted to verify their address.
 */
export function resolveDeliveryFee(
    distanceKm: number | null | undefined,
    zone: DeliveryZone | null | undefined,
    freeDeliveryBasis: number,
    customerCreatedAtMs?: number | null,
): { fee: number; tier: DeliveryTier; isLegacy: boolean } | null {
    const isExistingCustomer =
        typeof customerCreatedAtMs === 'number' && customerCreatedAtMs < PRICING_V2_CUTOFF_MS;

    if (typeof distanceKm === 'number') {
        // Existing customer within 2 km → grandfathered free.
        if (isExistingCustomer && distanceKm <= FREE_DELIVERY_RADIUS_KM) {
            return { fee: 0, tier: 'free', isLegacy: false };
        }
        return {
            fee: calcDeliveryFee(distanceKm, freeDeliveryBasis),
            tier: tierFromDistance(distanceKm),
            isLegacy: false,
        };
    }
    // Legacy zone-only path: pre-geocode users are inherently "existing".
    if (zone === 'within2km') {
        return { fee: 0, tier: 'free', isLegacy: true };
    }
    if (zone === 'outside2km') {
        // Legacy pre-geocode user. Preserve their prior experience exactly:
        // RM 5 fee + RM 20 free threshold (matches the 2026-05-16 rule they
        // signed up under). Don't apply the new RM 3 inner-near fee because
        // "outside 2 km" semantically excludes the inner zone.
        return {
            fee: freeDeliveryBasis >= FREE_DELIVERY_THRESHOLD_NEAR_RM ? 0 : DELIVERY_FEE_OUTER_NEAR_RM,
            tier: 'near',
            isLegacy: true,
        };
    }
    return null;
}

/**
 * Per-delivery fee for a multi-day / multi-slot order.
 *
 * An order can split into several deliveries — one per (date + lunch/dinner)
 * group — each of which is a separate kitchen trip. Each trip is charged
 * independently: its own basis is judged against its own distance threshold,
 * so a RM 25 lunch and a RM 25 dinner on different days each pay their own
 * fee rather than being combined into one basis that clears the threshold.
 *
 * Promo discount (RM-codes) is allocated across groups proportionally to each
 * group's food subtotal, with the LAST group absorbing the rounding remainder.
 * This allocation is byte-for-byte identical to the order-document promo split
 * in /api/submit-order, so the per-group basis (subtotal − allocated promo)
 * matches on both client and server. Meal vouchers are NOT subtracted from the
 * basis (same rule as calcDeliveryFee — prepaid voucher revenue is booked).
 *
 * CRITICAL: client (CartDrawer) and server (submit-order) MUST both call this
 * with the SAME group ordering and the SAME totals, or the server's anti-tamper
 * fee comparison (tolerance RM 0.02) will reject the order.
 *
 * @param groupSubtotals  food subtotal per delivery group, in a stable order
 * @param cartTotal       sum of all group subtotals (denominator for promo split)
 * @param promoDiscount   total RM-promo discount to spread across groups
 * @returns fees[] (aligned to groupSubtotals), total (sum), tier (same for all
 *          groups — distance-driven), and resolvable (false ⇒ address not
 *          confirmed, callers should block checkout)
 */
export function calcPerDeliveryFees(
    groupSubtotals: number[],
    cartTotal: number,
    promoDiscount: number,
    distanceKm: number | null | undefined,
    zone: DeliveryZone | null | undefined,
    customerCreatedAtMs?: number | null,
): { fees: number[]; bases: number[]; total: number; tier: DeliveryTier | null; resolvable: boolean } {
    const fees: number[] = [];
    const bases: number[] = [];
    let tier: DeliveryTier | null = null;
    let resolvable = groupSubtotals.length === 0; // empty cart: nothing to block on
    let remainingPromo = promoDiscount;

    for (let i = 0; i < groupSubtotals.length; i++) {
        // Proportional promo split — identical to the order-doc split in
        // submit-order: every group but the last gets a rounded proportional
        // slice; the last group absorbs whatever's left.
        let groupPromo = 0;
        if (promoDiscount > 0 && cartTotal > 0) {
            if (i === groupSubtotals.length - 1) {
                groupPromo = Number(remainingPromo.toFixed(2));
            } else {
                groupPromo = Number(((groupSubtotals[i] / cartTotal) * promoDiscount).toFixed(2));
                remainingPromo -= groupPromo;
            }
        }
        const basis = Math.max(0, groupSubtotals[i] - groupPromo);
        bases.push(basis);
        const resolved = resolveDeliveryFee(distanceKm, zone, basis, customerCreatedAtMs);
        if (resolved) {
            fees.push(resolved.fee);
            tier = resolved.tier;
            resolvable = true;
        } else {
            // Address not confirmed (no distance + no zone). Fee can't be
            // computed; push 0 and let the caller block on resolvable=false.
            fees.push(0);
        }
    }

    return { fees, bases, total: fees.reduce((sum, f) => sum + f, 0), tier, resolvable };
}

/** Shortfall to free delivery — mirrors resolveDeliveryFee's grandfathering. */
export function resolveShortfallToFree(
    distanceKm: number | null | undefined,
    zone: DeliveryZone | null | undefined,
    freeDeliveryBasis: number,
    customerCreatedAtMs?: number | null,
): number {
    const isExistingCustomer =
        typeof customerCreatedAtMs === 'number' && customerCreatedAtMs < PRICING_V2_CUTOFF_MS;

    if (typeof distanceKm === 'number') {
        // Existing within 2 km → already free, no shortfall.
        if (isExistingCustomer && distanceKm <= FREE_DELIVERY_RADIUS_KM) return 0;
        return freeDeliveryShortfall(distanceKm, freeDeliveryBasis);
    }
    // Legacy outside2km maps onto the near tier → RM 20 threshold.
    if (zone === 'outside2km' && freeDeliveryBasis < FREE_DELIVERY_THRESHOLD_NEAR_RM) {
        return FREE_DELIVERY_THRESHOLD_NEAR_RM - freeDeliveryBasis;
    }
    return 0;
}
