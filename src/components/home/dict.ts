// 首页（/ 与 /en）双胞胎组件的中英文案字典。模式照抄 src/components/cart/dict.ts：
// Record<Locale, Shape>，带参数的文案用函数。zh 值全部从原 home/*.tsx 字面量逐字复制，
// en 值全部从原 home-en/*EN.tsx 逐字复制——两边构建产物零变化（C1 合并，2026-09-05）。
// ⚠️ 只翻译「渲染」层：锚点 id / aria / data-* / href 结构留在组件里按 locale 切。
// ⚠️ 相邻文本节点：像 `{COUNT}+ Google 评价` 这种「表达式 + 文本」在 SSR 会插 `<!-- -->`，
//    搬进字典时必须保持两个子节点（`{COUNT}{t.suffix}`），不能合并成一个字符串。
import type { Locale } from '@/lib/locale';

interface FaqHeroStripDict {
    ariaLabel: string;
    question: string;
    /** 手机版一行：`{mobileBefore}<b>Pearl Suria</b>{mobileAfter}` */
    mobileBefore: string;
    mobileAfter: string;
    /** 桌面版整句：`{desktopBefore}<b>Pearl Suria Residence</b>{desktopAfter}` */
    desktopBefore: string;
    desktopAfter: string;
    more: string;
}

interface HeroTrustStripDict {
    ariaLabel: string;
    /** 跟在 `{GOOGLE_REVIEW_COUNT}` 后面的那半句（保持独立子节点，见文件头） */
    googleReviewsSuffix: string;
    neighbours: string;
}

interface CutoffBannerDict {
    /**
     * 截单胶囊的主文案。dayDiff = 今天到截单日的日历天数（0 今日 / 1 明日 / 更远），
     * weekday = 截单日 getDay()。zh 版原来是 `${labelDay} 06:00 截单`，en 版原来
     * 是三句整句——两边都逐字保留。
     */
    label: (dayDiff: number, weekday: number) => string;
    ariaLabel: (label: string, crossesDay: boolean, daysLeft: number, hoursLeft: number, minutesLeft: number) => string;
}

export interface HomeDict {
    faqHeroStrip: FaqHeroStripDict;
    heroTrustStrip: HeroTrustStripDict;
    cutoffBanner: CutoffBannerDict;
}

const ZH_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const HOME_DICT: Record<Locale, HomeDict> = {
    zh: {
        faqHeroStrip: {
            ariaLabel: '跳到常见问题',
            question: '有店面吗？',
            mobileBefore: '没有 · ',
            mobileAfter: ' 私厨，外送 only',
            desktopBefore: '没有 —— 我们是 ',
            desktopAfter: ' 的家庭私厨，只接外送。',
            more: '看更多',
        },
        heroTrustStrip: {
            ariaLabel: '查看 Google 评价与邻居好评',
            googleReviewsSuffix: '+ Google 评价',
            neighbours: '邻居都在吃',
        },
        cutoffBanner: {
            // labelDay reflects the actual cutoff day:
            //   今日 (cutoff is today)
            //   明日 (cutoff is tomorrow, no weekend skip)
            //   周一/二/三/四/五 (any further out, e.g. Fri afternoon → Mon)
            label: (dayDiff, weekday) => {
                let labelDay: string;
                if (dayDiff === 0) labelDay = '今日';
                else if (dayDiff === 1) labelDay = '明日';
                else labelDay = ZH_WEEKDAYS[weekday];
                return `${labelDay} 06:00 截单`;
            },
            ariaLabel: (label, crossesDay, daysLeft, hoursLeft, minutesLeft) =>
                `${label}，还剩${crossesDay ? ` ${daysLeft} 天` : ''} ${hoursLeft} 小时 ${minutesLeft} 分钟。点击查看菜单`,
        },
    },
    en: {
        faqHeroStrip: {
            ariaLabel: 'Jump to FAQ',
            question: 'Shopfront?',
            mobileBefore: 'None · ',
            mobileAfter: ' home kitchen, delivery only',
            desktopBefore: "No — we're a home kitchen in ",
            desktopAfter: ', delivery only.',
            more: 'More',
        },
        heroTrustStrip: {
            ariaLabel: 'See Google reviews and neighbour feedback',
            googleReviewsSuffix: '+ Google reviews',
            neighbours: 'neighbours love it',
        },
        cutoffBanner: {
            label: (dayDiff, weekday) => {
                if (dayDiff === 0) return "Today's cutoff · 06:00";
                if (dayDiff === 1) return 'Next cutoff · 06:00 tomorrow';
                return `Next cutoff · 06:00 ${EN_WEEKDAYS[weekday]}`;
            },
            ariaLabel: (label, crossesDay, daysLeft, hoursLeft, minutesLeft) =>
                `${label}, ${crossesDay ? `${daysLeft}d ` : ''}${hoursLeft}h ${minutesLeft}m left. Tap to view menu.`,
        },
    },
};
