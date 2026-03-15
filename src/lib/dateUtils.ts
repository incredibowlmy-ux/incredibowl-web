import { MenuItem } from '@/data/weeklyMenu';
import { AdminOrder } from '@/types';

// Shape of per-dish date info computed for the menu
export interface MenuDateInfo {
    topTag: string;
    btnText: string;
    disabled: boolean;
    actualDate: string;
}

const CUTOFF_HOUR = 23;
const CUTOFF_MINUTE = 0;

export function formatYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMD(d: Date): string {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatCreatedAt(order: AdminOrder): string {
    if (!order.createdAt) return '—';
    const ts = new Date(order.createdAt.seconds * 1000);
    return ts.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function computeMenuDates(dishes: MenuItem[]): { menuDates: Record<number, MenuDateInfo>; minDate: string } {
    const now = new Date();
    const isPastCutoff = now.getHours() > CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() >= CUTOFF_MINUTE);

    let nextAvail = new Date(now);
    nextAvail.setDate(now.getDate() + (isPastCutoff ? 2 : 1));
    if (nextAvail.getDay() === 6) nextAvail.setDate(nextAvail.getDate() + 2);
    else if (nextAvail.getDay() === 0) nextAvail.setDate(nextAvail.getDate() + 1);

    const nextAvailStr = formatYMD(nextAvail);

    const nowMid = new Date(now).setHours(0, 0, 0, 0);
    const nextAvailMid = new Date(nextAvail).setHours(0, 0, 0, 0);
    const diffDays = Math.round((nextAvailMid - nowMid) / 86400000);
    let relativeDay = '明天';
    if (diffDays === 2) relativeDay = '后天';
    else if (diffDays > 2) relativeDay = formatMD(nextAvail);

    const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wdEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const menuDates: Record<number, MenuDateInfo> = {};

    dishes.forEach(dish => {
        // Daily/permanent items are identified by their day field, not hardcoded IDs
        if (dish.day === 'Daily / 常驻') {
            menuDates[dish.id] = {
                topTag: '常驻供应 · Daily',
                btnText: `加入${relativeDay}的预订 · RM ${dish.price.toFixed(2)}`,
                disabled: false,
                actualDate: nextAvailStr
            };
            return;
        }
        // Weekly specials: dish.id must be a valid weekday (0–6)
        const targetWd = dish.id;
        if (targetWd < 0 || targetWd > 6) return; // guard against invalid IDs
        let targetDate = new Date(now);
        targetDate.setDate(now.getDate() + 1);
        while (targetDate.getDay() !== targetWd) targetDate.setDate(targetDate.getDate() + 1);

        const cutoffForTarget = new Date(targetDate);
        cutoffForTarget.setDate(targetDate.getDate() - 1);
        cutoffForTarget.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

        let isDisabled = false;
        let btnText = '';
        if (now >= cutoffForTarget) {
            targetDate.setDate(targetDate.getDate() + 7);
            isDisabled = true;
            btnText = `明日已截单 · 可预订 ${formatMD(targetDate)} (${wdCn[targetWd]})`;
        } else {
            btnText = `预订 ${formatMD(targetDate)} (${wdCn[targetWd]}) · RM ${dish.price.toFixed(2)}`;
        }

        menuDates[dish.id] = { topTag: `${formatMD(targetDate)} ${wdCn[targetWd]} · ${wdEn[targetWd]}`, btnText, disabled: isDisabled, actualDate: formatYMD(targetDate) };
    });

    return { menuDates, minDate: nextAvailStr };
}
