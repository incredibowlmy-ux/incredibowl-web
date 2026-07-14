// AddOnModal（加料/日期弹窗）的中英文案字典。模式同 member/dict.ts。
// zh 值从原字面量逐字复制（含原本就中英混排的 alert）——中文站零变化。
// 加料 item 的 name 是订单 payload / dishIngredients 的 key，绝不经过这里；
// EN 只在渲染层换 nameEn / titleEn / descEn 的显示优先级。
import type { Locale } from '@/lib/locale';

const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AddOnDictShape {
    nutritionDisclaimer: string;
    scheduleTitle: string;
    weekendAlert: string;
    weekdayOnlyAlert: (allow: number[]) => string;
    dishPausedAlert: string;
    dateClosedAlert: string;
    fixedDateSuffix: string;
    lunchSlot: string;
    dinnerSlot: string;
    noteTitle: string;
    notePlaceholder: string;
    summaryLine: (main: string, addons: string) => string;
    updateCart: (total: string) => string;
    addToCart: (total: string) => string;
    pickTimeFirst: string;
}

export const ADDON_DICT: Record<Locale, AddOnDictShape> = {
    zh: {
        nutritionDisclaimer: '* 营养数据为估算值，实际可能因食材批次略有差异。',
        scheduleTitle: '送达时间 / Delivery Schedule',
        weekendAlert: "周末不对外开灶哦！请选择周一至周五的配送。 (Weekends are only for BowlMama's rest!)",
        weekdayOnlyAlert: (allow) =>
            `这道菜仅周${allow.map(d => WD_CN[d]).join('、周')}供应，请另选日期。 (This dish is served on ${allow.map(d => WD_EN[d]).join(' & ')} only — please pick another day.)`,
        dishPausedAlert: '这道菜该日暂停供应，请另选日期。 (This dish is paused on the selected date — please pick another day.)',
        dateClosedAlert: '该日已售罄，暂停接单，请另选日期。 (That day is sold out — please pick another day.)',
        fixedDateSuffix: '(固定款)',
        lunchSlot: '🌞 午餐 11AM - 1PM',
        dinnerSlot: '🌙 晚餐 5PM - 8PM',
        noteTitle: '备注 / Note to Kitchen',
        notePlaceholder: '告诉碗妈你的要求（如：不放葱、送到门口/家楼下guard house等） Special instructions (e.g., No green onions, leave at door/guard house)...',
        summaryLine: (main, addons) => `主菜 RM ${main} + 加购 RM ${addons}`,
        updateCart: (total) => `更新订单配置 · RM ${total}`,
        addToCart: (total) => `加入预订 · RM ${total}`,
        pickTimeFirst: '请先选择送达时段 👆',
    },
    en: {
        nutritionDisclaimer: '* Nutrition values are estimates and may vary slightly by ingredient batch.',
        scheduleTitle: 'Delivery Schedule',
        weekendAlert: "Weekends are only for BowlMama's rest! Please choose a Monday–Friday delivery.",
        weekdayOnlyAlert: (allow) =>
            `This dish is served on ${allow.map(d => WD_EN[d]).join(' & ')} only — please pick another day.`,
        dishPausedAlert: 'This dish is paused on the selected date — please pick another day.',
        dateClosedAlert: 'That day is sold out — please pick another day.',
        fixedDateSuffix: '(set menu day)',
        lunchSlot: '🌞 Lunch 11AM - 1PM',
        dinnerSlot: '🌙 Dinner 5PM - 8PM',
        noteTitle: 'Note to Kitchen',
        notePlaceholder: 'Special instructions (e.g. no green onions, leave at door / guard house)...',
        summaryLine: (main, addons) => `Main RM ${main} + add-ons RM ${addons}`,
        updateCart: (total) => `Update item · RM ${total}`,
        addToCart: (total) => `Add to order · RM ${total}`,
        pickTimeFirst: 'Pick a delivery slot first 👆',
    },
};
