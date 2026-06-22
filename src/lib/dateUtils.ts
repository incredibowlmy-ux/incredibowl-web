import { MenuItem } from '@/data/weeklyMenu';
import { isDishBlockedOn, isDateClosed } from '@/data/blockedDates';
import { AdminOrder } from '@/types';

// Shape of per-dish date info computed for the menu
export interface MenuDateInfo {
    topTag: string;
    btnText: string;
    disabled: boolean;
    actualDate: string;
    /** Short disabled-reason for the cramped mobile button (falls back to 已截单). */
    reasonShort?: string;
}

const CUTOFF_HOUR = 6;
const CUTOFF_MINUTE = 0;

export function formatYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMD(d: Date): string {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** English month-day, e.g. "Jun 22". Mirror of formatMD for the EN locale. */
export function formatMDEn(d: Date): string {
    return `${MONTH_EN[d.getMonth()]} ${d.getDate()}`;
}

export function formatCreatedAt(order: AdminOrder): string {
    if (!order.createdAt) return '—';
    // Firebase Admin SDK serializes as _seconds; client SDK uses seconds
    const secs = order.createdAt.seconds ?? order.createdAt._seconds;
    if (!secs) return '—';
    const ts = new Date(secs * 1000);
    return ts.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function computeMenuDates(
    dishes: MenuItem[],
    locale: 'zh' | 'en' = 'zh',
): { menuDates: Record<number, MenuDateInfo>; minDate: string } {
    const en = locale === 'en';
    const now = new Date();
    const isPastCutoff = now.getHours() > CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() >= CUTOFF_MINUTE);

    const nextAvail = new Date(now);
    nextAvail.setDate(now.getDate() + (isPastCutoff ? 1 : 0));
    if (nextAvail.getDay() === 6) nextAvail.setDate(nextAvail.getDate() + 2);
    else if (nextAvail.getDay() === 0) nextAvail.setDate(nextAvail.getDate() + 1);

    // Skip whole-day closures (售罄 / 老板停一天) — roll forward to the next open
    // weekday so daily dishes become orderable for that day instead of Friday.
    let closedSafety = 14;
    while (closedSafety-- > 0 && isDateClosed(formatYMD(nextAvail))) {
        nextAvail.setDate(nextAvail.getDate() + 1);
        if (nextAvail.getDay() === 6) nextAvail.setDate(nextAvail.getDate() + 2);
        else if (nextAvail.getDay() === 0) nextAvail.setDate(nextAvail.getDate() + 1);
    }

    const nextAvailStr = formatYMD(nextAvail);

    const nowMid = new Date(now).setHours(0, 0, 0, 0);
    const nextAvailMid = new Date(nextAvail).setHours(0, 0, 0, 0);
    const diffDays = Math.round((nextAvailMid - nowMid) / 86400000);
    let relativeDay = '今天';
    if (diffDays === 1) relativeDay = '明天';
    else if (diffDays === 2) relativeDay = '后天';
    else if (diffDays > 2) relativeDay = formatMD(nextAvail);

    // English "add to … order" phrasing for the daily-dish CTA on the EN locale.
    const dailyOrderEn =
        diffDays === 0 ? "Add to today's order"
            : diffDays === 1 ? "Add to tomorrow's order"
                : diffDays === 2 ? 'Add to day-after order'
                    : `Add to ${formatMDEn(nextAvail)} order`;

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const menuDates: Record<number, MenuDateInfo> = {};

    dishes.forEach(dish => {
        // Retired dishes: shown on the menu but never orderable (greyed card + note).
        if (dish.retired) {
            menuDates[dish.id] = {
                topTag: en ? 'Paused' : '暂别 · Paused',
                btnText: en ? (dish.unavailableNoteEn ?? 'Paused — back soon') : (dish.unavailableNote ?? '暂时下架'),
                disabled: true,
                actualDate: '',
                reasonShort: en ? 'Paused' : '暂别',
            };
            return;
        }
        // Daily/permanent items are identified by their day field, not hardcoded IDs
        if (dish.day === 'Daily / 常驻') {
            // A daily dish may be restricted to a subset of weekdays
            // (e.g. 马铃薯炖花肉片 = 周四五供应). It still SHOWS — just greyed-out +
            // not orderable when the next delivery date falls outside that set.
            // Also unavailable on a one-off blocked date (boss put on hold).
            const allowList = dish.availableWeekdays;
            const topTag = allowList && allowList.length
                ? (en
                    ? allowList.map(d => wdEn[d]).join(' & ')
                    : `${allowList.map(d => wdCn[d]).join('、')} · ${allowList.map(d => wdEn[d]).join(' & ')}`)
                : (en ? 'Mon–Fri' : '周一至五 · Mon–Fri');
            const dayAllowed = !allowList || allowList.length === 0 || allowList.includes(nextAvail.getDay());
            const blockedToday = isDishBlockedOn(dish.id, nextAvailStr);
            if (!dayAllowed || blockedToday) {
                const note = !dayAllowed
                    ? (en ? (dish.unavailableNoteEn ?? 'Not available') : (dish.unavailableNote ?? '当日不供应'))
                    : (en ? 'Paused today' : '当日暂停');
                menuDates[dish.id] = {
                    topTag,
                    btnText: note,
                    disabled: true,
                    actualDate: nextAvailStr,
                    reasonShort: note,
                };
            } else {
                menuDates[dish.id] = {
                    topTag,
                    btnText: en ? dailyOrderEn : `加入${relativeDay}的预订 · RM ${dish.price.toFixed(2)}`,
                    disabled: false,
                    actualDate: nextAvailStr,
                };
            }
            return;
        }
        const targetWd = dish.weekday;
        if (targetWd === undefined || targetWd < 0 || targetWd > 6) return; // not a weekly special
        const targetDate = new Date(now);
        // Do not add +1 forcefully anymore, allow today
        while (targetDate.getDay() !== targetWd) targetDate.setDate(targetDate.getDate() + 1);

        // Skip explicitly blocked dates for this dish (boss-stopped / sold-out).
        // Roll +7 to the next same-weekday occurrence; cap iterations defensively.
        let blockSafety = 26;
        while (blockSafety-- > 0 && (isDishBlockedOn(dish.id, formatYMD(targetDate)) || isDateClosed(formatYMD(targetDate)))) {
            targetDate.setDate(targetDate.getDate() + 7);
        }

        const cutoffForTarget = new Date(targetDate);
        // Cutoff is ON the same day 
        cutoffForTarget.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

        let isDisabled = false;
        let btnText = '';
        if (now >= cutoffForTarget) {
            targetDate.setDate(targetDate.getDate() + 7);
            isDisabled = true;
            btnText = en
                ? `Closed today · order ${formatMDEn(targetDate)} (${wdEn[targetWd]})`
                : `今日已截单 · 可预订 ${formatMD(targetDate)} (${wdCn[targetWd]})`;
        } else {
            const isToday = diffDays === 0 && targetDate.getDate() === now.getDate();
            btnText = en
                ? `Order ${isToday ? 'today ' : ''}${formatMDEn(targetDate)} (${wdEn[targetWd]})`
                : `预订 ${isToday ? '今日' : ''}${formatMD(targetDate)} (${wdCn[targetWd]}) · RM ${dish.price.toFixed(2)}`;
        }

        const topTag = en
            ? `${formatMDEn(targetDate)} · ${wdEn[targetWd]}`
            : `${formatMD(targetDate)} ${wdCn[targetWd]} · ${wdEn[targetWd]}`;
        menuDates[dish.id] = { topTag, btnText, disabled: isDisabled, actualDate: formatYMD(targetDate) };
    });

    return { menuDates, minDate: nextAvailStr };
}
