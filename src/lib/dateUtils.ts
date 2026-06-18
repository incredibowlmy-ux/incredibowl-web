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

export function formatCreatedAt(order: AdminOrder): string {
    if (!order.createdAt) return '—';
    // Firebase Admin SDK serializes as _seconds; client SDK uses seconds
    const secs = order.createdAt.seconds ?? order.createdAt._seconds;
    if (!secs) return '—';
    const ts = new Date(secs * 1000);
    return ts.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function computeMenuDates(dishes: MenuItem[]): { menuDates: Record<number, MenuDateInfo>; minDate: string } {
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

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const menuDates: Record<number, MenuDateInfo> = {};

    dishes.forEach(dish => {
        // Retired dishes: shown on the menu but never orderable (greyed card + note).
        if (dish.retired) {
            menuDates[dish.id] = {
                topTag: '暂别 · Paused',
                btnText: dish.unavailableNote ?? '暂时下架',
                disabled: true,
                actualDate: '',
                reasonShort: '暂别',
            };
            return;
        }
        // Daily/permanent items are identified by their day field, not hardcoded IDs
        if (dish.day === 'Daily / 常驻') {
            // A daily dish can be unavailable on a specific weekday (e.g. 马铃薯
            // 周二不供应). It still SHOWS — just greyed-out + not orderable when the
            // next delivery date falls on that weekday.
            // Unavailable when the next delivery date is either a recurring excluded
            // weekday (e.g. 马铃薯 周二) OR a one-off blocked date (boss put on hold).
            const excludedToday = dish.excludeWeekday !== undefined && nextAvail.getDay() === dish.excludeWeekday;
            const blockedToday = isDishBlockedOn(dish.id, nextAvailStr);
            if (excludedToday || blockedToday) {
                const note = excludedToday ? (dish.unavailableNote ?? '当日不供应') : '当日暂停';
                menuDates[dish.id] = {
                    topTag: '周一至五 · Mon–Fri',
                    btnText: note,
                    disabled: true,
                    actualDate: nextAvailStr,
                    reasonShort: note,
                };
            } else {
                menuDates[dish.id] = {
                    topTag: '周一至五 · Mon–Fri',
                    btnText: `加入${relativeDay}的预订 · RM ${dish.price.toFixed(2)}`,
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
            btnText = `今日已截单 · 可预订 ${formatMD(targetDate)} (${wdCn[targetWd]})`;
        } else {
            const prefix = diffDays === 0 && targetDate.getDate() === now.getDate() ? '今日' : '';
            btnText = `预订 ${prefix}${formatMD(targetDate)} (${wdCn[targetWd]}) · RM ${dish.price.toFixed(2)}`;
        }

        menuDates[dish.id] = { topTag: `${formatMD(targetDate)} ${wdCn[targetWd]} · ${wdEn[targetWd]}`, btnText, disabled: isDisabled, actualDate: formatYMD(targetDate) };
    });

    return { menuDates, minDate: nextAvailStr };
}
