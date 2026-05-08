/**
 * Date validity helpers for cart items, shared between client and server.
 *
 * Customer adds items to cart with `selectedDate = "YYYY-MM-DD"`. The cart
 * persists in localStorage, so a customer can come back the next day and
 * the dates have silently rotted. Without these guards, the order goes
 * through with a past delivery date and the kitchen has no idea.
 *
 * Rules:
 *   - selectedDate must be today or later (in MY time, UTC+8)
 *   - if selectedDate is today, the 6 AM cutoff must not have passed
 *   - delivery only on Mon–Fri (Sat/Sun rejected)
 *
 * Server-side validation in /api/submit-order is the source of truth.
 * Client-side check in CartDrawer auto-cleans stale items as a UX courtesy.
 */

const CUTOFF_HOUR_MY = 6;

/** Format a Date as "YYYY-MM-DD" using its local components. */
export function formatYMDLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the current moment as a Date whose UTC components reflect MY time
 * (UTC+8). Useful for getting "today's date in KL" regardless of where the
 * server runs (Vercel = UTC) or what TZ the client browser is in.
 */
export function nowInMY(): Date {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

/** "YYYY-MM-DD" of today in MY time. */
export function todayInMY(): string {
    const my = nowInMY();
    // We offset to UTC+8 above, so use UTC components to read MY time.
    return `${my.getUTCFullYear()}-${String(my.getUTCMonth() + 1).padStart(2, '0')}-${String(my.getUTCDate()).padStart(2, '0')}`;
}

/** True if it's currently past 6:00 AM Malaysia time. */
export function past6AmCutoffMY(): boolean {
    const my = nowInMY();
    return my.getUTCHours() >= CUTOFF_HOUR_MY;
}

export type DateInvalidReason =
    | 'invalid_format'
    | 'past'
    | 'today_after_cutoff'
    | 'weekend';

export type DateValidity =
    | { ok: true }
    | { ok: false; reason: DateInvalidReason; message: string };

/** Validate a "YYYY-MM-DD" cart item delivery date. */
export function isOrderDateValid(selectedDate: string | null | undefined): DateValidity {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        return { ok: false, reason: 'invalid_format', message: '日期格式无效' };
    }
    const today = todayInMY();
    if (selectedDate < today) {
        return { ok: false, reason: 'past', message: `${selectedDate} 是过去日期` };
    }
    if (selectedDate === today && past6AmCutoffMY()) {
        return { ok: false, reason: 'today_after_cutoff', message: `${selectedDate} 已过 6AM 截单` };
    }
    // Parse as local date — month is 0-indexed in JS Date constructor
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) {
        return { ok: false, reason: 'weekend', message: `${selectedDate} 周末不配送` };
    }
    return { ok: true };
}
