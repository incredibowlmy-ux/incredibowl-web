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

interface PromoBannerDict {
    badge: string;
    heading: string;
    /** 两行简介：`{introLine1}<br />{introLine2}` */
    introLine1: string;
    introLine2: string;
    free: string;
    freeSideTitle: string;
    freeSideSub: string;
    /** `{readReviewsBefore}{GOOGLE_REVIEW_COUNT}{readReviewsAfter}`（三个子节点，见文件头） */
    readReviewsBefore: string;
    readReviewsAfter: string;
    offerTitle: string;
    /** `{shareBefore}<b>{shareBold}</b>{shareAfter}` */
    shareBefore: string;
    shareBold: string;
    shareAfter: string;
    googleTitle: string;
    googleReviews: string;
    recommended: string;
    howToClaim: string;
    step1: string;
    step2: string;
    step3: string;
    ctaTitle: string;
    ctaSub: string;
}

interface WhatsAppFloatDict {
    /** 按页面区域切换的预填句子；en 三个区域同一句（原 EN 组件只有一句固定文案） */
    messages: { hero: string; menu: string; feedback: string };
    ariaLabel: string;
}

interface WhatsAppStickyBarDict {
    prefilled: string;
    waAriaLabel: string;
    claimed: string;
    /** `{firstOrderBefore}<b>RM {N}</b>{firstOrderAfter}`——zh 文字在前、en 在后，另一侧留空串 */
    firstOrderBefore: string;
    firstOrderAfter: string;
    claimedSub: (code: string) => string;
    claimSub: string;
    order: string;
    claim: string;
    close: string;
}

export interface HomeDict {
    faqHeroStrip: FaqHeroStripDict;
    heroTrustStrip: HeroTrustStripDict;
    cutoffBanner: CutoffBannerDict;
    promoBanner: PromoBannerDict;
    whatsAppFloat: WhatsAppFloatDict;
    whatsAppStickyBar: WhatsAppStickyBarDict;
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
        promoBanner: {
            badge: '街坊回馈',
            heading: '感恩折扣',
            introLine1: '感谢街坊一路支持 🧡',
            introLine2: '你的声音很重要 — 评价送一份惊喜小菜',
            free: '免费',
            freeSideTitle: '惊喜小菜 / Free Side',
            freeSideSub: '好评后下次下单附上 · 碗妈当天配',
            readReviewsBefore: '看 ',
            readReviewsAfter: '+ 邻居怎么说',
            offerTitle: '好评送小菜',
            shareBefore: '分享你的评价，送你 ',
            shareBold: '一份惊喜小菜',
            shareAfter: '。',
            googleTitle: '在 Google 查看评价',
            googleReviews: 'Google 评价',
            recommended: '邻居推荐',
            howToClaim: '如何获得',
            step1: '下单并享用',
            step2: '在 Facebook 留评价（带图更好）',
            step3: '截图发 WhatsApp 给碗妈领小菜',
            ctaTitle: '去看菜单',
            ctaSub: '好评换一份小菜',
        },
        whatsAppFloat: {
            messages: {
                hero:     'Hi 碗妈！我刚看到你的网站，想了解一下你的厨房和这周的菜单。',
                menu:     'Hi 碗妈！我看了菜单，想问下明天的预订和配送细节。',
                feedback: 'Hi 碗妈！我看了邻居的评价想试试，可以推荐一道入门菜吗？',
            },
            ariaLabel: 'WhatsApp 碗妈',
        },
        whatsAppStickyBar: {
            // Trailing 🥡 is a silent source tag — Carmen can tell at-a-glance this came from the sticky bar.
            prefilled: 'Hi 碗妈！我从网站加入，想拿首单 RM 5 voucher，之后有新 Promo 可以通知我 🙏 🥡',
            waAriaLabel: 'WhatsApp 碗妈 · 收新菜通知',
            claimed: '优惠码已领取',
            firstOrderBefore: '首单立减 ',
            firstOrderAfter: '',
            claimedSub: (code) => `${code} · 结账自动帮你用上`,
            claimSub: '点一下就领，结账自动套用',
            order: '去点菜',
            claim: '领取',
            close: '关闭',
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
        promoBanner: {
            badge: 'NEIGHBOUR THANKS',
            heading: 'Thank-you discount',
            introLine1: 'Thank you neighbours for your support 🧡',
            introLine2: 'Your voice matters — leave a review for a surprise side dish',
            free: 'FREE',
            freeSideTitle: 'Surprise Side / Free Side',
            freeSideSub: 'Added to your next order · cooked fresh that day',
            readReviewsBefore: 'Read ',
            readReviewsAfter: '+ neighbour reviews',
            offerTitle: 'Review-for-side-dish',
            shareBefore: 'Share your review, get a ',
            shareBold: 'surprise side dish',
            shareAfter: '.',
            googleTitle: 'View reviews on Google',
            googleReviews: 'Google reviews',
            recommended: 'neighbour-recommended',
            howToClaim: 'How to claim',
            step1: 'Order and enjoy',
            step2: 'Leave a review on Facebook (photos even better)',
            step3: 'WhatsApp BowlMama a screenshot to claim your side dish',
            ctaTitle: 'See the menu',
            ctaSub: 'A review earns a free side',
        },
        whatsAppFloat: {
            // 原 WhatsAppFloatEN 只有这一句固定文案（没有区域观察器）；三个区域填同一句，链接不变。
            messages: {
                hero:     "Hi BowlMama! I'd like to see today's menu.",
                menu:     "Hi BowlMama! I'd like to see today's menu.",
                feedback: "Hi BowlMama! I'd like to see today's menu.",
            },
            ariaLabel: 'WhatsApp BowlMama',
        },
        whatsAppStickyBar: {
            prefilled: "Hi BowlMama! I'd like to claim the RM 5 first-order voucher — please ping me when you have new promos or new dishes. Thanks! 🥡",
            waAriaLabel: 'WhatsApp BowlMama for new-dish alerts',
            claimed: 'Voucher claimed',
            firstOrderBefore: '',
            firstOrderAfter: ' off your first order',
            claimedSub: (code) => `${code} · applied automatically at checkout`,
            claimSub: 'One tap to claim · applied at checkout',
            order: 'Order',
            claim: 'Claim',
            close: 'Close',
        },
    },
};
