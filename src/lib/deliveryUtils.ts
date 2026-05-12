/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Tiers (May 2026):
 *   0 – 2 km   → free
 *   2 – 5 km   → RM 6   (free  when freeDeliveryBasis ≥ RM 20 — saves RM 6)
 *   5 – 8 km   → RM 15  (RM 5  when freeDeliveryBasis ≥ RM 40 — saves RM 10)
 *   8 km +     → RM 25  (RM 15 when freeDeliveryBasis ≥ RM 40 — saves RM 10)
 *
 * `freeDeliveryBasis` definition (decided 2026-05-11):
 *   cartTotal − promoDiscount  (RM-discount codes only)
 *   NOT subtracted: mealVoucherDiscount (prepaid meal vouchers don't game it)
 *
 * Rationale: meal vouchers are already paid revenue — burning one to redeem a
 * main dish shouldn't shrink the cart back below the threshold. RM-promo
 * codes ARE subtracted because they reduce real revenue per order.
 *
 * Threshold benefits:
 *   - 2026-05-12 — RM 40 rule extended to mid/far with a flat RM 10 off so
 *     longer routes still reward larger baskets (operating cost doesn't drop
 *     to zero out far).
 *   - 2026-05-12 (later) — Neighbour special: 2–5 km gets a lower RM 20
 *     threshold ("邻里特惠"). One main + 1 add-on is enough; designed to lift
 *     near-zone order frequency. Mid/far keep RM 40 because the unit-economics
 *     of long routes can't absorb a low-AOV waiver.
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
export const NEAR_RADIUS_KM = 5;
export const MID_RADIUS_KM = 8;
// Per-tier free-delivery thresholds. Near gets the neighbour-special RM 20;
// mid/far stay at RM 40 because long-route cost can't absorb a low-AOV waiver.
export const FREE_DELIVERY_THRESHOLD_NEAR_RM = 20;
export const FREE_DELIVERY_THRESHOLD_MID_RM = 40;
export const FREE_DELIVERY_THRESHOLD_FAR_RM = 40;
// Backwards-compat: callers that still want a single "rule of thumb" number
// (e.g. footer copy, EN nav) get the strictest threshold so anything we
// haven't migrated to per-tier still shows a conservative figure.
export const FREE_DELIVERY_THRESHOLD_RM = FREE_DELIVERY_THRESHOLD_MID_RM;
export const DELIVERY_FEE_NEAR_RM = 6;
export const DELIVERY_FEE_MID_RM = 15;
export const DELIVERY_FEE_FAR_RM = 25;
// Flat discount applied to mid/far when basis ≥ threshold. Near is capped
// to RM 0 (becomes free) via Math.max in calcDeliveryFee.
export const DELIVERY_THRESHOLD_DISCOUNT_RM = 10;

// Backwards-compat alias used by older imports.
export const DELIVERY_FEE_OUTSIDE_RM = DELIVERY_FEE_NEAR_RM;

/** Threshold (in RM) at which the given tier's delivery-fee discount kicks in. */
export function thresholdForTier(tier: DeliveryTier): number {
    switch (tier) {
        case 'free': return 0;
        case 'near': return FREE_DELIVERY_THRESHOLD_NEAR_RM;
        case 'mid':  return FREE_DELIVERY_THRESHOLD_MID_RM;
        case 'far':  return FREE_DELIVERY_THRESHOLD_FAR_RM;
    }
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
    if (km <= FREE_DELIVERY_RADIUS_KM) return 'free';
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
    const thresholdMet = freeDeliveryBasis >= thresholdForTier(tier);
    // Near: RM 6 - RM 10 = -4 → max(0, -4) = 0 (free)
    // Mid:  RM 15 - RM 10 = RM 5
    // Far:  RM 25 - RM 10 = RM 15
    if (thresholdMet) return Math.max(0, baseFee - DELIVERY_THRESHOLD_DISCOUNT_RM);
    return baseFee;
}

/**
 * RM amount the customer needs to add to hit their tier's threshold and
 * trigger the delivery discount. Returns 0 if already past threshold, in the
 * free tier, or the basis is irrelevant.
 *
 * Threshold + benefit by tier:
 *   near → RM 20 threshold → free (saves RM 6)
 *   mid  → RM 40 threshold → RM 5 (saves RM 10)
 *   far  → RM 40 threshold → RM 15 (saves RM 10)
 *
 * @param freeDeliveryBasis  cartTotal − promoDiscount  (meal voucher NOT subtracted)
 */
export function freeDeliveryShortfall(distanceKm: number, freeDeliveryBasis: number): number {
    const tier = tierFromDistance(distanceKm);
    if (tier === 'free') return 0;
    const threshold = thresholdForTier(tier);
    if (freeDeliveryBasis >= threshold) return 0;
    return Math.max(0, threshold - freeDeliveryBasis);
}

export function zoneLabelZh(zone: DeliveryZone): string {
    return zone === 'within2km' ? '免运区（2km 内）' : '配送区（2km 外）';
}

export function tierLabelZh(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return '免运区（2km 内）';
        case 'near': return '近距离（2–5km）';
        case 'mid': return '中距离（5–8km）';
        case 'far': return '远距离（8km 以上）';
    }
}

export function tierFeeHintZh(tier: DeliveryTier): string {
    switch (tier) {
        case 'free': return '免运费';
        case 'near': return `RM 6 · 满 RM ${FREE_DELIVERY_THRESHOLD_NEAR_RM} → 免运 🏘️`;
        case 'mid': return `RM 15 · 满 RM ${FREE_DELIVERY_THRESHOLD_MID_RM} → RM 5`;
        case 'far': return `RM 25 · 满 RM ${FREE_DELIVERY_THRESHOLD_FAR_RM} → RM 15`;
    }
}

/**
 * Resolve fee + tier with legacy fallback.
 *
 * New users have addressDistanceKm saved (geocode flow) — use accurate tiers.
 * Legacy users (registered before geocode) only have the binary deliveryZone
 * field. Grandfather them in with the OLD pricing model so they don't get
 * blocked at checkout demanding re-verification:
 *   - within2km  → free  (matches new 'free' tier)
 *   - outside2km → flat RM 6 with the near-tier RM 20 rule  (matches 'near')
 *
 * Returns null if the user has neither — in that case checkout is blocked
 * and they're prompted to verify their address.
 */
export function resolveDeliveryFee(
    distanceKm: number | null | undefined,
    zone: DeliveryZone | null | undefined,
    freeDeliveryBasis: number,
): { fee: number; tier: DeliveryTier; isLegacy: boolean } | null {
    if (typeof distanceKm === 'number') {
        return {
            fee: calcDeliveryFee(distanceKm, freeDeliveryBasis),
            tier: tierFromDistance(distanceKm),
            isLegacy: false,
        };
    }
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

/** Shortfall to free delivery — handles legacy fallback the same way. */
export function resolveShortfallToFree(
    distanceKm: number | null | undefined,
    zone: DeliveryZone | null | undefined,
    freeDeliveryBasis: number,
): number {
    if (typeof distanceKm === 'number') {
        return freeDeliveryShortfall(distanceKm, freeDeliveryBasis);
    }
    // Legacy outside2km maps onto the near tier → RM 20 threshold.
    if (zone === 'outside2km' && freeDeliveryBasis < FREE_DELIVERY_THRESHOLD_NEAR_RM) {
        return FREE_DELIVERY_THRESHOLD_NEAR_RM - freeDeliveryBasis;
    }
    return 0;
}
