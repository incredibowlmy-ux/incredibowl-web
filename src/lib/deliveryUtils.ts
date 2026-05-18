/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Tiers (2026-05-18 — competitive repositioning):
 *   0   – 2   km → RM 3  (free  when freeDeliveryBasis ≥ RM 20 — saves RM 3)
 *   2   – 5   km → RM 5  (free  when freeDeliveryBasis ≥ RM 30 — saves RM 5)
 *   5   – 8   km → RM 15 (RM 5  when freeDeliveryBasis ≥ RM 40 — saves RM 10)
 *   8 km +       → not served (was RM 25 — 0 actual customers, removed)
 *
 * Both inner-near (0–2 km) and outer-near (2–5 km) report tier === 'near' to
 * keep downstream UI simple; both fee AND threshold are resolved by distance
 * via feeForDistance(km) + thresholdForDistance(km).
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
 * The 'far' tier value is retained in the DeliveryTier union for backward
 * compat with stored order documents (admin tier badges read tier from old
 * data). New orders never produce 'far' — geocode rejects > 8 km upstream
 * and tierFromDistance never returns 'far' anymore.
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
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
// Inner near (0–2 km) gets RM 3 / RM 20 threshold (邻里特惠 — neighbour radius
// matches grandfather radius). Outer near (2–5 km) gets RM 5 / RM 30 threshold.
// Both report tier === 'near' — fee + threshold resolved by distance.
export const INNER_NEAR_RADIUS_KM = 2;
export const NEAR_RADIUS_KM = 5;
export const MID_RADIUS_KM = 8;

// Customers whose Firestore profile `createdAt` is BEFORE this cutoff are
// treated as "existing" and grandfathered onto the pre-2026-05-16 pricing
// (0–2 km = free). Customers created on/after the cutoff get the new flat
// 0–5 km @ RM 5 (free at RM 20+) rule.
//
// Date.UTC(year, monthIndex, day) → ms since epoch. Month is 0-indexed.
export const PRICING_V2_CUTOFF_MS = Date.UTC(2026, 4, 16); // 2026-05-16 00:00 UTC
// Per-distance free-delivery thresholds.
// Inner near (0–2 km): RM 20 — neighbour-special, one main + one add-on hits it.
// Outer near (2–5 km): RM 30 — slightly bigger basket for the longer ride.
// Mid (5–8 km): RM 40 — long-route cost can't absorb a low-AOV waiver.
export const FREE_DELIVERY_THRESHOLD_NEAR_RM = 20;
export const FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM = 30;
export const FREE_DELIVERY_THRESHOLD_MID_RM = 40;
// Backwards-compat: callers that still want a single "rule of thumb" number
// (e.g. footer copy, EN nav) get the strictest threshold so anything we
// haven't migrated to per-tier still shows a conservative figure.
export const FREE_DELIVERY_THRESHOLD_RM = FREE_DELIVERY_THRESHOLD_MID_RM;
// Per-distance base fees. Inner near (0–2 km) RM 3 —邻里特惠. Outer near
// (2–5 km) RM 5. Mid (5–8 km) RM 15. 8 km+ is not served (see MAX_DELIVERY_KM
// in /api/check-delivery).
export const DELIVERY_FEE_INNER_NEAR_RM = 3;
export const DELIVERY_FEE_OUTER_NEAR_RM = 5;
export const DELIVERY_FEE_MID_RM = 15;
// Legacy alias for the outer-near fee. Existing call sites that import
// DELIVERY_FEE_NEAR_RM (now ambiguous after the inner/outer split) get the
// outer value, which is the historical RM 5. New code should call
// feeForDistance(km) instead.
/** @deprecated Use feeForDistance(km) — this returns the outer-near fee (RM 5). */
export const DELIVERY_FEE_NEAR_RM = DELIVERY_FEE_OUTER_NEAR_RM;
// Flat discount applied to mid when basis ≥ threshold. Inner/outer near is
// capped to RM 0 (becomes free) via Math.max in calcDeliveryFee.
export const DELIVERY_THRESHOLD_DISCOUNT_RM = 10;

// Backwards-compat alias used by older imports.
export const DELIVERY_FEE_OUTSIDE_RM = DELIVERY_FEE_OUTER_NEAR_RM;

/**
 * Threshold (in RM) at which the given tier's delivery-fee discount kicks in.
 *
 * Note: the 'near' tier has a split threshold (RM 20 for 0–2 km, RM 30 for
 * 2–5 km). This function returns the *inner* (RM 20) threshold by default —
 * use thresholdForDistance(km) when distance is known for the accurate
 * per-user threshold. 'far' is legacy (never produced by tierFromDistance
 * anymore) and falls back to the mid threshold.
 */
export function thresholdForTier(tier: DeliveryTier): number {
    switch (tier) {
        case 'free': return 0;
        case 'near': return FREE_DELIVERY_THRESHOLD_NEAR_RM;
        case 'mid':  return FREE_DELIVERY_THRESHOLD_MID_RM;
        case 'far':  return FREE_DELIVERY_THRESHOLD_MID_RM;
    }
}

/** Per-distance threshold, accurate within the split near tier. */
export function thresholdForDistance(km: number): number {
    if (km <= INNER_NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_NEAR_RM;
    if (km <= NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM;
    return FREE_DELIVERY_THRESHOLD_MID_RM;
}

/** Per-distance base fee. RM 3 inner / RM 5 outer / RM 15 mid. */
export function feeForDistance(km: number): number {
    if (km <= INNER_NEAR_RADIUS_KM) return DELIVERY_FEE_INNER_NEAR_RM;
    if (km <= NEAR_RADIUS_KM) return DELIVERY_FEE_OUTER_NEAR_RM;
    return DELIVERY_FEE_MID_RM;
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
    // Distance-based classification returns 'near' (0–5 km) or 'mid' (5–8 km).
    // 'free' is retained in the type for the legacy grandfathering branch in
    // resolveDeliveryFee() (within2km zone → free for pre-geocode users).
    // 'far' is retained in the type for backward compat with stored order
    // documents written before 2026-05-18, but is never produced here —
    // > 8 km is rejected upstream in /api/check-delivery (MAX_DELIVERY_KM=8).
    if (km <= NEAR_RADIUS_KM) return 'near';
    return 'mid';
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
    // Both fee AND threshold resolve from distance — inner-near (0–2 km) RM 3
    // / RM 20, outer-near (2–5 km) RM 5 / RM 30, mid (5–8 km) RM 15 / RM 40.
    const baseFee = feeForDistance(distanceKm);
    const thresholdMet = freeDeliveryBasis >= thresholdForDistance(distanceKm);
    // Inner near: RM 3 - RM 10 = -7  → max(0, -7) = 0 (free, saves RM 3)
    // Outer near: RM 5 - RM 10 = -5  → max(0, -5) = 0 (free, saves RM 5)
    // Mid:        RM 15 - RM 10 = RM 5     (saves RM 10)
    if (thresholdMet) return Math.max(0, baseFee - DELIVERY_THRESHOLD_DISCOUNT_RM);
    return baseFee;
}

/**
 * RM amount the customer needs to add to hit their threshold and trigger
 * the delivery discount. Returns 0 if already past threshold, in the free
 * tier, or the basis is irrelevant.
 *
 * Threshold + benefit by distance:
 *   0–2 km   → RM 20 threshold → free (saves RM 3)
 *   2–5 km   → RM 30 threshold → free (saves RM 5)
 *   5–8 km   → RM 40 threshold → RM 5 (saves RM 10)
 *   8 km +   → not served (geocode rejects upstream)
 *
 * @param freeDeliveryBasis  cartTotal − promoDiscount  (meal voucher NOT subtracted)
 */
export function freeDeliveryShortfall(distanceKm: number, freeDeliveryBasis: number): number {
    const tier = tierFromDistance(distanceKm);
    if (tier === 'free') return 0;
    const threshold = thresholdForDistance(distanceKm);
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
        case 'mid': return '中距离（5–8km）';
        // Legacy — never produced by tierFromDistance since 2026-05-18; shown
        // only for old order documents stored with tier:'far' (8 km+).
        case 'far': return '远距离（旧规则）';
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
        case 'mid': return `RM 15 · 满 RM ${FREE_DELIVERY_THRESHOLD_MID_RM} → RM 5`;
        // Legacy — shown only on old order docs with tier:'far'.
        case 'far': return '旧规则 8km+ 订单';
    }
}

export function tierLabelEn(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return 'Free zone (legacy customer)';
        case 'near': return 'Near (within 5km)';
        case 'mid': return 'Mid (5–8km)';
        // Legacy — never produced by tierFromDistance since 2026-05-18.
        case 'far': return 'Far (legacy 8km+ order)';
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
        case 'mid': return `RM 15 · RM 5 over RM ${FREE_DELIVERY_THRESHOLD_MID_RM}`;
        // Legacy — shown only on old order docs with tier:'far'.
        case 'far': return 'Legacy 8km+ order';
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
