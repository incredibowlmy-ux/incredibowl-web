/**
 * Centralized promotion configuration.
 * Change promo settings here — all frontend displays and server validation
 * read from this single source of truth.
 */

export const OPENING_PROMO = {
  /** Discount amount in RM per dish */
  amount: 1,
  /** Master on/off switch */
  active: true,
  /** ISO date string — promo auto-disables after this date (MYT) */
  expiresAt: '2026-04-15',
  /** Display label used in UI */
  label: '立减RM1',
};

/**
 * Returns the current promo discount amount (0 if inactive or expired).
 */
export function getPromoDiscount(): number {
  if (!OPENING_PROMO.active) return 0;
  const expiry = new Date(OPENING_PROMO.expiresAt + 'T23:59:59+08:00');
  if (new Date() > expiry) return 0;
  return OPENING_PROMO.amount;
}

/**
 * Returns the effective dish price after promo discount.
 */
export function getDishPrice(menuPrice: number): number {
  return menuPrice - getPromoDiscount();
}
