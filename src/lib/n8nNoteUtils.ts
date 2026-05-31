/**
 * Shared helpers used by BOTH n8n endpoints (daily-prep / daily-recap)
 * so the same rule applies to BowlMama's prep brief and the boss recap.
 *
 * - Critical-note keyword detection (⚠️ flag)
 * - Admin-bookkeeping note scrubbing
 * - Stale FPX pending order detection (so abandoned FPX checkouts don't
 *   pollute prep counts / recap KPIs)
 *
 * Anything that would silently drift if duplicated belongs here.
 */

/** Notes that would actually hurt the customer if missed: allergies, hard
 *  "don't" constraints, dietary restrictions, urgency. Keep this list
 *  tight — every false-positive trains the reader to ignore ⚠️. */
export const CRITICAL_NOTE_PATTERNS: RegExp[] = [
  /过敏|敏感|allergy|allergic/i,
  /不要|不能|不吃|别加|别放|别用/,
  /无糖|无油|无盐|无麻|走油|少油/,
  /素食|全素|蛋奶素|vegan|vegetarian/i,
  /戒口|忌口|禁忌/,
  /婴儿|宝宝|孕妇/,
  /急|赶时间|提前|urgent|asap/i,
];

/** Does this customer note match any critical-keyword pattern? */
export function isCriticalNote(note: string): boolean {
  return CRITICAL_NOTE_PATTERNS.some(rx => rx.test(note));
}

/** Bookkeeping markers like "手动录入 · whatsapp" are admin-side noise
 *  and should never reach BowlMama / boss as a "customer note". */
export function isAdminBookkeepingNote(note: string): boolean {
  return /手动录入/.test(note);
}

/** How long an FPX-pending order can sit before we treat it as abandoned.
 *  Mirrors the auto-cancel window in src/app/api/admin/data/route.ts. */
export const STALE_FPX_PENDING_MS = 10 * 60 * 1000;

/** Structural shape — both daily-prep's FirestoreOrder and daily-recap's
 *  OrderShape satisfy it, so this single helper covers both endpoints. */
interface OrderForStaleCheck {
  status?: string;
  paymentMethod?: string;
  createdAt?: { _seconds?: number; seconds?: number };
}

/** Pending FPX orders that the customer started but never completed are
 *  garbage from BowlMama's perspective — she'd over-prep for a customer
 *  who never paid. QR pending is NOT stale (customer paid, admin reviewing). */
export function isStaleFpxPending(o: OrderForStaleCheck, nowMs: number): boolean {
  if (o.status !== 'pending') return false;
  if (o.paymentMethod !== 'fpx') return false;
  const createdMs = ((o.createdAt?._seconds ?? o.createdAt?.seconds ?? 0)) * 1000;
  return createdMs > 0 && createdMs < nowMs - STALE_FPX_PENDING_MS;
}
