/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Tiers (2026-05-16, split 2026-05-17):
 *   0   – 2.5 km → RM 5  (free  when freeDeliveryBasis ≥ RM 20 — saves RM 5)
 *   2.5 – 5   km → RM 5  (free  when freeDeliveryBasis ≥ RM 30 — saves RM 5)
 *   5   – 8   km → RM 15 (RM 5  when freeDeliveryBasis ≥ RM 40 — saves RM 10)
 *   8 km +       → RM 25 (RM 15 when freeDeliveryBasis ≥ RM 40 — saves RM 10)
 *
 * Both inner-near (0–2.5km) and outer-near (2.5–5km) report tier === 'near'
 * to keep downstream UI simple; the threshold is resolved from distance via
 * thresholdForDistance(km).
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
 * History:
 *   - 2026-05-12 — RM 40 rule extended to mid/far with a flat RM 10 off.
 *   - 2026-05-12 — Neighbour special: 2–5 km gets a lower RM 20 threshold.
 *   - 2026-05-16 — Collapsed the 0–2 km free tier into 0–5 km @ RM 5 (free at
 *     RM 20+). Existing customers (createdAt < cutoff) grandfathered onto the
 *     old 0–2 km free tier via resolveDeliveryFee().
 *   - 2026-05-17 — Split the near tier in half by distance: 0–2.5 km keeps the
 *     RM 20 threshold; 2.5–5 km gets a higher RM 30 threshold (longer routes
 *     need a slightly bigger basket to justify free delivery).
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
// Inner near (0–2.5km) gets the lower RM 20 free-delivery threshold; outer
// near (2.5–5km) gets the higher RM 30 threshold. Same base fee (RM 5) and
// same tier value ('near') — only the threshold splits.
export const INNER_NEAR_RADIUS_KM = 2.5;
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
// Inner near (0–2.5km): RM 20 — neighbour-special, one main + one add-on hits it.
// Outer near (2.5–5km): RM 30 — slightly bigger basket for the longer ride.
// Mid/far stay at RM 40 because long-route cost can't absorb a low-AOV waiver.
export const FREE_DELIVERY_THRESHOLD_NEAR_RM = 20;
export const FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM = 30;
export const FREE_DELIVERY_THRESHOLD_MID_RM = 40;
export const FREE_DELIVERY_THRESHOLD_FAR_RM = 40;
// Backwards-compat: callers that still want a single "rule of thumb" number
// (e.g. footer copy, EN nav) get the strictest threshold so anything we
// haven't migrated to per-tier still shows a conservative figure.
export const FREE_DELIVERY_THRESHOLD_RM = FREE_DELIVERY_THRESHOLD_MID_RM;
export const DELIVERY_FEE_NEAR_RM = 5;
export const DELIVERY_FEE_MID_RM = 15;
export const DELIVERY_FEE_FAR_RM = 25;
// Flat discount applied to mid/far when basis ≥ threshold. Near is capped
// to RM 0 (becomes free) via Math.max in calcDeliveryFee.
export const DELIVERY_THRESHOLD_DISCOUNT_RM = 10;

// Backwards-compat alias used by older imports.
export const DELIVERY_FEE_OUTSIDE_RM = DELIVERY_FEE_NEAR_RM;

/**
 * Threshold (in RM) at which the given tier's delivery-fee discount kicks in.
 *
 * Note: since 2026-05-17 the 'near' tier has a split threshold (RM 20 for
 * 0–2.5km, RM 30 for 2.5–5km). This function returns the *inner* (RM 20)
 * threshold by default — use thresholdForDistance(km) when distance is known
 * for the accurate per-user threshold.
 */
export function thresholdForTier(tier: DeliveryTier): number {
    switch (tier) {
        case 'free': return 0;
        case 'near': return FREE_DELIVERY_THRESHOLD_NEAR_RM;
        case 'mid':  return FREE_DELIVERY_THRESHOLD_MID_RM;
        case 'far':  return FREE_DELIVERY_THRESHOLD_FAR_RM;
    }
}

/** Per-distance threshold, accurate within the split near tier. */
export function thresholdForDistance(km: number): number {
    if (km <= INNER_NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_NEAR_RM;
    if (km <= NEAR_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_OUTER_NEAR_RM;
    if (km <= MID_RADIUS_KM) return FREE_DELIVERY_THRESHOLD_MID_RM;
    return FREE_DELIVERY_THRESHOLD_FAR_RM;
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
    // Distance-based classification no longer returns 'free' — 0-5km is a
    // single 'near' tier (RM 5, free at RM 20+). The 'free' tier value is
    // retained in the union purely for the legacy grandfathering branch
    // in resolveDeliveryFee() which maps within2km zone → free for users
    // registered before the geocode flow existed.
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
    const baseFee =
        tier === 'near' ? DELIVERY_FEE_NEAR_RM :
        tier === 'mid' ? DELIVERY_FEE_MID_RM :
        DELIVERY_FEE_FAR_RM;
    // Use distance-aware threshold so the split near tier (RM 20 vs RM 30)
    // resolves correctly. Mid/far thresholds are tier-uniform.
    const thresholdMet = freeDeliveryBasis >= thresholdForDistance(distanceKm);
    // Near: RM 5 - RM 10 = -5 → max(0, -5) = 0 (free)
    // Mid:  RM 15 - RM 10 = RM 5
    // Far:  RM 25 - RM 10 = RM 15
    if (thresholdMet) return Math.max(0, baseFee - DELIVERY_THRESHOLD_DISCOUNT_RM);
    return baseFee;
}

/**
 * RM amount the customer needs to add to hit their threshold and trigger
 * the delivery discount. Returns 0 if already past threshold, in the free
 * tier, or the basis is irrelevant.
 *
 * Threshold + benefit by distance:
 *   0–2.5 km  → RM 20 threshold → free (saves RM 5)
 *   2.5–5 km  → RM 30 threshold → free (saves RM 5)
 *   5–8 km    → RM 40 threshold → RM 5 (saves RM 10)
 *   8 km +    → RM 40 threshold → RM 15 (saves RM 10)
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
        case 'far': return '远距离（8km 以上）';
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
            const threshold = typeof distanceKm === 'number'
                ? thresholdForDistance(distanceKm)
                : FREE_DELIVERY_THRESHOLD_NEAR_RM;
            return `RM 5 · 满 RM ${threshold} → 免运`;
        }
        case 'mid': return `RM 15 · 满 RM ${FREE_DELIVERY_THRESHOLD_MID_RM} → RM 5`;
        case 'far': return `RM 25 · 满 RM ${FREE_DELIVERY_THRESHOLD_FAR_RM} → RM 15`;
    }
}

export function tierLabelEn(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return 'Free zone (legacy customer)';
        case 'near': return 'Near (within 5km)';
        case 'mid': return 'Mid (5–8km)';
        case 'far': return 'Far (8km+)';
    }
}

/** See tierFeeHintZh — same per-distance handling for the split near tier. */
export function tierFeeHintEn(tier: DeliveryTier, distanceKm?: number): string {
    switch (tier) {
        case 'free': return 'Free delivery';
        case 'near': {
            const threshold = typeof distanceKm === 'number'
                ? thresholdForDistance(distanceKm)
                : FREE_DELIVERY_THRESHOLD_NEAR_RM;
            return `RM 5 · free over RM ${threshold}`;
        }
        case 'mid': return `RM 15 · RM 5 over RM ${FREE_DELIVERY_THRESHOLD_MID_RM}`;
        case 'far': return `RM 25 · RM 15 over RM ${FREE_DELIVERY_THRESHOLD_FAR_RM}`;
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
        return {
            fee: freeDeliveryBasis >= FREE_DELIVERY_THRESHOLD_NEAR_RM ? 0 : DELIVERY_FEE_NEAR_RM,
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
