/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Tiers (May 2026):
 *   0 – 2 km   → free
 *   2 – 5 km   → RM 6   (waived when freeDeliveryBasis ≥ RM 40)
 *   5 – 8 km   → RM 15  (no free-delivery threshold)
 *   8 km +     → RM 25  (no free-delivery threshold)
 *
 * `freeDeliveryBasis` definition (decided 2026-05-11):
 *   cartTotal − promoDiscount  (RM-discount codes only)
 *   NOT subtracted: mealVoucherDiscount (prepaid meal vouchers don't game it)
 *
 * Rationale: meal vouchers are already paid revenue — burning one to redeem a
 * main dish shouldn't shrink the cart back below the free-delivery threshold.
 * RM-promo codes ARE subtracted because they reduce real revenue per order.
 *
 * The 5+ km tiers do NOT honour the RM 40 free rule because the operating
 * cost (own driver + fuel + time) exceeds the voucher headroom on small
 * orders, and applying free delivery there was a loss-making loophole.
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
export const NEAR_RADIUS_KM = 5;
export const MID_RADIUS_KM = 8;
export const FREE_DELIVERY_THRESHOLD_RM = 40; // applies to NEAR tier only
export const DELIVERY_FEE_NEAR_RM = 6;
export const DELIVERY_FEE_MID_RM = 15;
export const DELIVERY_FEE_FAR_RM = 25;

// Backwards-compat alias used by older imports.
export const DELIVERY_FEE_OUTSIDE_RM = DELIVERY_FEE_NEAR_RM;

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
    if (tier === 'near') {
        return freeDeliveryBasis >= FREE_DELIVERY_THRESHOLD_RM ? 0 : DELIVERY_FEE_NEAR_RM;
    }
    if (tier === 'mid') return DELIVERY_FEE_MID_RM;
    return DELIVERY_FEE_FAR_RM;
}

/**
 * RM amount the customer needs to add to qualify for free delivery — only
 * meaningful in the 2–5 km tier. Returns 0 outside that tier (already free,
 * or free-rule does not apply at this distance).
 *
 * @param freeDeliveryBasis  cartTotal − promoDiscount  (meal voucher NOT subtracted)
 */
export function freeDeliveryShortfall(distanceKm: number, freeDeliveryBasis: number): number {
    if (tierFromDistance(distanceKm) !== 'near') return 0;
    if (freeDeliveryBasis >= FREE_DELIVERY_THRESHOLD_RM) return 0;
    return Math.max(0, FREE_DELIVERY_THRESHOLD_RM - freeDeliveryBasis);
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
        case 'near': return 'RM 6 · 满 RM 40 → 免运';
        case 'mid': return 'RM 15 配送费';
        case 'far': return 'RM 25 配送费';
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
 *   - outside2km → flat RM 6 with the RM 40 free-delivery rule  (matches 'near')
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
            fee: freeDeliveryBasis >= FREE_DELIVERY_THRESHOLD_RM ? 0 : DELIVERY_FEE_NEAR_RM,
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
    // Legacy outside2km also honours the RM 40 rule.
    if (zone === 'outside2km' && freeDeliveryBasis < FREE_DELIVERY_THRESHOLD_RM) {
        return FREE_DELIVERY_THRESHOLD_RM - freeDeliveryBasis;
    }
    return 0;
}
