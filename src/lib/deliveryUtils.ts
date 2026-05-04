/**
 * Delivery zone + fee calculation, shared between client and server.
 *
 * Rules (May 2026):
 *   - Within 2km of Pearl Point  → free delivery
 *   - Beyond 2km                 → RM 6 delivery fee
 *     (waived when subtotal AFTER voucher discount ≥ RM 40)
 *
 * "After voucher" matters: it ties free-delivery reward to actual revenue,
 * not to a pre-discount cart amount that vouchers can game.
 */

// Verified centroid (provided by Carmen via Google Maps right-click).
// Earlier value (3.1100, 101.6708) was off by ~3km — caused all customers
// to be measured from a point near KL Sentral instead of Pearl Point.
export const PEARL_POINT_LAT = 3.0853475861917716;
export const PEARL_POINT_LNG = 101.67428154483449;

export const FREE_DELIVERY_RADIUS_KM = 2;
export const FREE_DELIVERY_THRESHOLD_RM = 40; // subtotal AFTER discount
export const DELIVERY_FEE_OUTSIDE_RM = 6;

export type DeliveryZone = 'within2km' | 'outside2km';

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

/**
 * Calculate delivery fee in RM.
 * @param zone               'within2km' or 'outside2km'
 * @param subtotalAfterDiscount  subtotal MINUS any voucher discount
 */
export function calcDeliveryFee(zone: DeliveryZone, subtotalAfterDiscount: number): number {
    if (zone === 'within2km') return 0;
    if (subtotalAfterDiscount >= FREE_DELIVERY_THRESHOLD_RM) return 0;
    return DELIVERY_FEE_OUTSIDE_RM;
}

/**
 * RM amount the customer needs to add (after discount) to qualify for free delivery.
 * Returns 0 if already qualified or within free zone.
 */
export function freeDeliveryShortfall(zone: DeliveryZone, subtotalAfterDiscount: number): number {
    if (zone === 'within2km') return 0;
    if (subtotalAfterDiscount >= FREE_DELIVERY_THRESHOLD_RM) return 0;
    return Math.max(0, FREE_DELIVERY_THRESHOLD_RM - subtotalAfterDiscount);
}

export function zoneLabelZh(zone: DeliveryZone): string {
    return zone === 'within2km' ? '免运区（2km 内）' : '配送区（2km 外）';
}
