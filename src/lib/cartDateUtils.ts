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

import { isDateClosed, isDishBlockedOn, isDinnerClosedOn } from '@/data/blockedDates';
import type { MenuItem } from '@/data/weeklyMenu';

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
    | 'weekend'
    | 'sold_out';

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
    if (isDateClosed(selectedDate)) {
        return { ok: false, reason: 'sold_out', message: `${selectedDate} 已售罄，当天暂停接单` };
    }
    return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 菜品 × 日期 的可下单校验
//
// isOrderDateValid 只管「这个日期能不能收单」，管不了「这道菜那天卖不卖」。
// 2026-07 事故：购物车存 localStorage，上周加的菜本周已 PAUSED（暂别），
// 客户端只按日期清理、服务端也只查了 availableWeekdays —— 两边都放行，
// 厨房收到一道当天根本没买料的菜。
//
// 这个函数是**唯一**的判定来源：CartDrawer 的购物车清理和 /api/submit-order
// 都调它，两边不可能再漂移。
//
// ⚠️ 传进来的 dish 必须是从当前 weeklyMenu 现查的对象，不能用购物车里
// localStorage 存的那份快照 —— 快照里的 retired/weekday 是加入购物车那天的值。
// ─────────────────────────────────────────────────────────────────────────────

export type DishInvalidReason = 'retired' | 'hidden' | 'dish_blocked' | 'wrong_weekday';

export type DishValidity =
    | { ok: true }
    | { ok: false; reason: DishInvalidReason; message: string };

const WD_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * "YYYY-MM-DD" → 0=周日…6=周六。与时区无关（用 UTC 构造+读取，服务器在
 * UTC、浏览器在 UTC+8 得到同一个答案）。格式非法返回 null。
 */
export function weekdayOfYMD(ymd: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
    if (!m) return null;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/**
 * 这道菜在 selectedDate 能不能下单。
 *
 * 日期本身的合法性（过去 / 已截单 / 周末 / 整日停业）不在这里管，
 * 调用方必须先过 isOrderDateValid —— 所以日期格式非法时这里直接放行，
 * 避免同一个问题报两次互相矛盾的错。
 */
export function isDishOrderableOn(
    dish: Pick<MenuItem, 'id' | 'name' | 'retired' | 'hidden' | 'weekday' | 'availableWeekdays'>,
    selectedDate: string,
): DishValidity {
    if (dish.retired) {
        return { ok: false, reason: 'retired', message: `${dish.name} 已暂别菜单，暂不接单` };
    }
    if (dish.hidden) {
        return { ok: false, reason: 'hidden', message: `${dish.name} 尚未上架` };
    }
    if (isDishBlockedOn(dish.id, selectedDate)) {
        return { ok: false, reason: 'dish_blocked', message: `${dish.name} 在 ${selectedDate} 暂停供应` };
    }

    const wd = weekdayOfYMD(selectedDate);
    if (wd === null) return { ok: true }; // 格式问题交给 isOrderDateValid

    if (!servesOnWeekday(dish, wd)) {
        const allow = dish.availableWeekdays;
        return {
            ok: false,
            reason: 'wrong_weekday',
            message: (allow && allow.length > 0)
                ? `${dish.name} 仅在${allow.map(d => WD_CN[d]).join('、')}供应，无法下单 ${selectedDate}`
                : `${dish.name} 是${WD_CN[dish.weekday as number]}特餐，无法下单 ${selectedDate}`,
        };
    }

    return { ok: true };
}

/**
 * 这道菜在「周几」这一档供应吗 —— 纯 weekday 判定，不看 retired/hidden/
 * blocked（那三层是日期无关的，由 isDishOrderableOn 单独查）。
 *
 * 排期规则的单一来源：isDishOrderableOn 的 weekday 段直接调它，admin 端
 * 的菜品下拉（DishPicker 按当天置顶分组）也调它。两处共用一份规则，
 * 换菜改 weeklyMenu 后两边同时跟上，不会各自漂移。
 *
 * 优先级与排期表一致：availableWeekdays（常驻限日菜，如白萝卜焖花肉
 * 周一/四）> weekday（WEEKLY_SCHEDULE 推导的当日特餐）> 全周常驻。
 */
export function servesOnWeekday(
    dish: Pick<MenuItem, 'weekday' | 'availableWeekdays'>,
    weekday: number,
): boolean {
    const allow = dish.availableWeekdays;
    if (allow && allow.length > 0) return allow.includes(weekday);
    if (typeof dish.weekday === 'number') return weekday === dish.weekday;
    return true;   // 常驻菜：周一至五都能订
}

// ─────────────────────────────────────────────────────────────────────────────
// 时段 × 日期 的可下单校验
//
// 有些日子只做半天（例：长假前最后一天只送午餐）。整天关店走 CLOSED_DATES
// （isOrderDateValid 的 sold_out 分支），这里只管「这天开，但某个时段不开」。
//
// 与 isDishOrderableOn 同样是**唯一**判定来源：AddOnModal 灰掉按钮、
// CartDrawer 清购物车、/api/submit-order 拒收，三处都调它。
// ─────────────────────────────────────────────────────────────────────────────

/** 订单里的时段字面量是否算晚餐。与 prepIngredients.isLunchOrder 的口径一致。 */
export function isDinnerSlot(slot: string | null | undefined): boolean {
    const t = String(slot || '').toLowerCase();
    return t.includes('dinner') || t.includes('晚');
}

export type SlotValidity =
    | { ok: true }
    | { ok: false; reason: 'dinner_closed'; message: string };

/**
 * 这个时段在 selectedDate 能不能下单。
 *
 * 日期本身的合法性（过去 / 已截单 / 周末 / 整日停业）交给 isOrderDateValid，
 * 这里只查时段，避免同一个问题报两次互相矛盾的错。
 */
export function isSlotOrderableOn(selectedDate: string, selectedTime: string | null | undefined): SlotValidity {
    if (isDinnerSlot(selectedTime) && isDinnerClosedOn(selectedDate)) {
        return {
            ok: false,
            reason: 'dinner_closed',
            message: `${selectedDate} 只送午餐，晚市休息，请改选午餐时段`,
        };
    }
    return { ok: true };
}
