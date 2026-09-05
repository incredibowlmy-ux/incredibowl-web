// 首页（/ 与 /en）双胞胎组件的中英文案字典。模式照抄 src/components/cart/dict.ts：
// Record<Locale, Shape>，带参数的文案用函数。zh 值全部从原 home/*.tsx 字面量逐字复制，
// en 值全部从原 home-en/*EN.tsx 逐字复制——两边构建产物零变化（C1 合并，2026-09-05）。
// ⚠️ 只翻译「渲染」层：锚点 id / aria / data-* / href 结构留在组件里按 locale 切。
// ⚠️ 相邻文本节点：像 `{COUNT}+ Google 评价` 这种「表达式 + 文本」在 SSR 会插 `<!-- -->`，
//    搬进字典时必须保持两个子节点（`{COUNT}{t.suffix}`），不能合并成一个字符串。
import type { Locale } from '@/lib/locale';
import {
    DELIVERY_SUMMARY_ZH, DELIVERY_SUMMARY_EN,
    DISTANCE_BASIS_ZH, DISTANCE_BASIS_EN,
    BEYOND_DELIVERY_NOTE_ZH, BEYOND_DELIVERY_NOTE_EN,
    BEYOND_DELIVERY_SHORT_ZH, BEYOND_DELIVERY_SHORT_EN,
    freeOverPhraseZh, freeOverPhraseEn,
    type DeliveryTierCopy,
} from '@/lib/deliveryCopy';

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

interface FooterDict {
    /** 页脚导航的 href：/ 与 /en 两套路径（menu 是 `/#menu` vs `/en#menu`，不是简单加前缀） */
    links: { menu: string; vouchers: string; member: string; blog: string; catering: string; privacy: string; terms: string; refund: string };
    dailyMenu: string;
    mealVouchers: string;
    member: string;
    catering: string;
    contactUs: string;
    /** 紧跟在 <MapPin /> 后面、带前导空格——原文「图标 + 同行文本」是一个文本子节点 */
    servingAround: string;
    tierRange: (t: DeliveryTierCopy) => string;
    tierFreeOver: (t: DeliveryTierCopy) => string;
    beyondShort: string;
    coverageHeading: string;
    promiseHeading: string;
    noMsg: string;
    dailyFresh: string;
    mumsRecipe: string;
    copyright: string;
}

interface NavBarDict {
    /** 顶栏整句，带尾随空格——后面紧跟 <span>|</span>（原文是一个文本子节点） */
    topNotice: string;
    /** 手机跑马灯：en 是另一句短文案直接拼运费摘要（没有 | 分隔 span）；zh 与桌面同句、走 topNotice */
    marqueeNotice: string;
    deliverySummary: string;
    homeHref: string;
    homeAriaLabel: string;
    brandName: string;
    dailyMenu: string;
    vouchersHref: string;
    mealVouchers: string;
    /** 桌面锚点行的「好评」（en: Reviews）与手机面板里的（en: Neighbour Reviews）历史上不同 */
    reviews: string;
    panelReviews: string;
    contact: string;
    memberHref: string;
    memberAria: string;
    memberTitle: string;
    member: string;
    /** 登录按钮 aria：en 版手机 / 桌面两个不同，zh 版三处同一句 */
    signInMobileAria: string;
    signInDesktopAria: string;
    signInLabel: string;
    openMenu: string;
    closeMenu: string;
    cartAria: (count: number, total: string) => string;
    cartEmptyAria: string;
    languageLabel: string;
}

interface DeliveryWidgetDict {
    /** WhatsApp 预填（已 URL 编码），后面直接拼 encodeURIComponent(address) */
    whatsAppUrl: string;
    lookupFailed: string;
    networkError: string;
    heading: string;
    sub: string;
    placeholder: string;
    addressAria: string;
    clearAria: string;
    checking: string;
    check: string;
    /** `{feeBefore}{fee}{feeMid}{km}{feeAfter}` */
    feeBefore: string;
    feeMid: string;
    feeAfter: string;
    /** `{nearBefore}<b>RM {threshold}{thresholdPlus}</b>{nearMid}<b>{nearFree}</b>`；zh 的 thresholdPlus 是空串 */
    nearBefore: string;
    thresholdPlus: string;
    nearMid: string;
    nearFree: string;
    /** `{midBefore}<b>RM {threshold}{thresholdPlus}</b>{midMid}<b>RM {feeAtThreshold}</b>` */
    midBefore: string;
    midMid: string;
    /** `{farBefore}<b>Grab</b>{farMid}<b>RM {fee}</b>{farAfter}` */
    farBefore: string;
    farMid: string;
    farAfter: string;
    /** `{outsideBefore}{km}{outsideAfter}` */
    outsideBefore: string;
    outsideAfter: string;
    cateringCta: string;
    feeTable: string;
    hideFees: string;
    showFees: string;
    distanceBasis: string;
    tierRange: (t: DeliveryTierCopy) => string;
    /** ⚠️ en 版 widget 的免运短语（`RM 20+ → free`）与 Footer 的 freeOverPhraseEn 不同——历史如此，原样保留 */
    tierFreeOver: (t: DeliveryTierCopy) => string;
    beyondNote: string;
    cutoffHeading: string;
    cutoffTitle: string;
    cutoffSub: string;
    windowsTitle: string;
}

interface AboutBowlMamaDict {
    heading: string;
    /** 签名行两个 span：破折号 + 名字（zh「——」是两个全角横杠，en 是一个 &mdash;） */
    signatureDash: string;
    signatureName: string;
    photoAlt: string;
    photoCaption: string;
}

interface FaqSectionDict {
    heading: string;
    sub: string;
}

interface FeedbackSectionDict {
    /** 相对时间：diffDays = 距今天数（负数/0 都算「今天」） */
    relativeTime: (diffDays: number) => string;
    /** SSR 首帧（mounted 前）Google 评价日期的占位 */
    recently: string;
    heading: string;
    sub: string;
    /** 跟在 `{allMessages.length}` 后面，保持独立子节点（见文件头） */
    reviewsCountSuffix: string;
    statsFrom: string;
    readMore: string;
    fiveStars: string;
    /** 跟在 <Plus /> 后面、带前导空格——原文「图标 + 同行文本」是一个文本子节点 */
    leaveReview: string;
    close: string;
    formTitle: string;
    formSub: string;
    nameLabel: string;
    namePlaceholder: string;
    textLabel: string;
    textPlaceholder: string;
    submitting: string;
    submit: string;
    submitSuccess: string;
    submitError: string;
}

interface HeroSectionDict {
    /** 定位胶囊两个 span：主句 + 中点后的副句 */
    locationBadge: string;
    locationSub: string;
    /** 跟在 `{GOOGLE_REVIEW_COUNT}` 后面的那半句（保持独立子节点，见文件头） */
    reviewsSuffix: string;
    /** 主 CTA 按钮里的文字；zh 原来是「中文 + 桌面才显示的英文小字」两个 span，en 只有一个 span——
     *  结构差异留在组件里按 locale 切，这里只放字符串。 */
    primaryCta: string;
    whatsappHref: string;
    whatsappCta: string;
    voucherCta: string;
    /** 明日特餐卡的小标题（<p uppercase>）：zh 原来是 `{labelZh ?? '明日特餐'}` 一个子节点，
     *  en 原来是 `{labelEn 改写 ?? "Tomorrow"} pick` 两个子节点——两种表达式留在组件里按 locale 切。 */
    seeSpecial: string;
}

interface SubscribeModalDict {
    /** WhatsApp 预填句（末尾 🍱 是来源暗号，见组件注释） */
    prefilled: string;
    close: string;
    photoAlt: string;
    badge: string;
    title: string;
    body: string;
    /** 跟在 <Check /> 后面、带前导空格——原文「图标 + 同行文本」是一个文本子节点 */
    claimedTitle: string;
    /** `{claimedSubBefore}{FIRST_ORDER_PROMO_CODE}{claimedSubAfter}`（三个子节点，见文件头） */
    claimedSubBefore: string;
    claimedSubAfter: string;
    /** `{claimBefore}{FIRST_ORDER_PROMO_RM}{claimAfter}` */
    claimBefore: string;
    claimAfter: string;
    or: string;
    whatsappCta: string;
    later: string;
}

interface MenuCarouselDict {
    /** 周几短标签（下标 = getDay()） */
    wdLabel: string[];
    upNext: string;
    tomorrowTag: string;
    soldOut: string;
    stockLeft: (n: number) => string;
    /** 手机卡片被禁用时的兜底字：zh 原来是 `dInfo?.reasonShort ?? '已截单'`，en 原来写死 'Closed'
     *  ——组件里按 locale 决定要不要先取 reasonShort，这里只放兜底字符串。 */
    closed: string;
    orderTomorrow: string;
    addToOrder: string;
    closedToday: string;
    /** 日期头分隔符：zh topTag 是 "6月30日 周一 · Mon" 按 ' ' 切，en 是 "Jun 30 · Mon" 按 ' · ' 切 */
    dayDateSubSep: string;
    whatsappHref: string;
    nextWeekEyebrow: string;
    nextWeekQuestion: string;
    nextWeekEyebrowDesktop: string;
    /** 桌面 CTA 两行：`{nextWeekLine1}<br /><b>{nextWeekLine2}</b>` */
    nextWeekLine1: string;
    nextWeekLine2: string;
    /** 跟在 <Phone /> 后面、带前导空格 */
    notifyMe: string;
    heading: string;
    subMobile: string;
    subDesktop: string;
    dailyHeading: string;
    retiredTitle: string;
    /** `{retiredCountBefore}{groups.retired.length}{retiredCountAfter}`（三个子节点） */
    retiredCountBefore: string;
    retiredCountAfter: string;
    collapse: string;
    expand: string;
    voucherTitle: string;
    voucherSub: string;
    /** 后面紧跟 `<span className="hidden lg:inline"> →</span>` */
    voucherCta: string;
}

export interface HomeDict {
    faqHeroStrip: FaqHeroStripDict;
    heroTrustStrip: HeroTrustStripDict;
    cutoffBanner: CutoffBannerDict;
    promoBanner: PromoBannerDict;
    whatsAppFloat: WhatsAppFloatDict;
    whatsAppStickyBar: WhatsAppStickyBarDict;
    footer: FooterDict;
    navBar: NavBarDict;
    deliveryWidget: DeliveryWidgetDict;
    aboutBowlMama: AboutBowlMamaDict;
    faqSection: FaqSectionDict;
    feedbackSection: FeedbackSectionDict;
    heroSection: HeroSectionDict;
    subscribeModal: SubscribeModalDict;
    menuCarousel: MenuCarouselDict;
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
        footer: {
            links: { menu: '/#menu', vouchers: '/meal-vouchers', member: '/member', blog: '/blog', catering: '/catering', privacy: '/privacy', terms: '/terms', refund: '/refund' },
            dailyMenu: '每日菜单',
            mealVouchers: '餐券预付包',
            member: '会员中心',
            catering: 'Catering 到会',
            contactUs: 'Contact Us / 联系我们',
            servingAround: ' Serving Our Neighbours Around',
            tierRange: (t) => t.rangeZh,
            tierFreeOver: freeOverPhraseZh,
            beyondShort: BEYOND_DELIVERY_SHORT_ZH,
            coverageHeading: '服务范围 / Coverage',
            promiseHeading: '品质承诺 / Our Promise',
            noMsg: 'No MSG · 不加味精',
            dailyFresh: 'Daily Fresh · 每日新鲜采购',
            mumsRecipe: "Mum's Recipe · 妈妈的味道",
            copyright: '© 2026 Incredibowl. 家的味道，每天新鲜采购。',
        },
        navBar: {
            topNotice: '温馨提示：每天早上 06:00 截单（06:00 前下单 当日配送） ',
            marqueeNotice: '温馨提示：每天早上 06:00 截单（06:00 前下单 当日配送） ',
            deliverySummary: DELIVERY_SUMMARY_ZH,
            homeHref: '/',
            homeAriaLabel: 'Incredibowl 碗妈的厨房 首页',
            brandName: '碗妈的厨房',
            dailyMenu: '每日菜单',
            vouchersHref: '/meal-vouchers',
            mealVouchers: '餐券预付包',
            reviews: '邻居好评',
            panelReviews: '邻居好评',
            contact: '联系碗妈',
            memberHref: '/member',
            memberAria: '进入会员中心',
            memberTitle: '进入会员中心 · 查看订单与 voucher',
            member: '会员中心',
            signInMobileAria: '登录 / 邻里会员',
            signInDesktopAria: '登录 / 邻里会员',
            signInLabel: '登录 / 邻里会员',
            openMenu: '打开菜单',
            closeMenu: '关闭菜单',
            cartAria: (count, total) => `打开购物车（${count} 件 · RM ${total}）`,
            cartEmptyAria: '打开购物车',
            languageLabel: '语言 / Language',
        },
        deliveryWidget: {
            whatsAppUrl: "https://wa.me/60103370197?text=Hi%20%E7%A2%97%E5%A6%88%EF%BC%8C%E6%88%91%E7%9A%84%E5%9C%B0%E5%9D%80%E5%9C%A8%20%EF%BC%9A",
            lookupFailed: '查询失败，请重试',
            networkError: '网络异常，请稍后重试',
            heading: '我家能送吗？',
            sub: '30 秒查一下你属于哪个配送区',
            placeholder: '例: Pearl Suria, OUG Parklane, 58200...',
            addressAria: '输入你的地址或邮编',
            clearAria: '清空',
            checking: '查询中',
            check: '查一下',
            feeBefore: '配送费 RM ',
            feeMid: ' · 离碗妈 ',
            feeAfter: ' km',
            nearBefore: '满 ',
            thresholdPlus: '',
            nearMid: ' 即享 ',
            nearFree: '免运',
            midBefore: '满 ',
            midMid: ' 配送费降至 ',
            farBefore: '远距离由 ',
            farMid: ' 配送，运费固定 ',
            farAfter: '，不设免运门槛',
            outsideBefore: '抱歉，你的地址离碗妈 ',
            outsideAfter: ' km，超出 25km 配送范围',
            cateringCta: '公司团餐？WhatsApp 问问看 →',
            feeTable: '配送费一览',
            hideFees: '收起 ▴',
            showFees: '查看 ▾',
            distanceBasis: DISTANCE_BASIS_ZH,
            tierRange: (t) => t.rangeZh,
            tierFreeOver: freeOverPhraseZh,
            beyondNote: BEYOND_DELIVERY_NOTE_ZH,
            cutoffHeading: '截单与配送时段',
            cutoffTitle: '每天 06:00 截单',
            cutoffSub: '06:00 前下单当日配送',
            windowsTitle: '配送时段',
        },
        aboutBowlMama: {
            heading: '关于碗妈',
            signatureDash: '——',
            signatureName: '碗妈',
            photoAlt: '碗妈每天凌晨 6 点到巴刹挑食材',
            photoCaption: '凌晨 6 点的巴刹，手挑番茄 · RM 3.60 / 600g',
        },
        faqSection: {
            heading: '常见问题',
            sub: '邻居都在问',
        },
        feedbackSection: {
            relativeTime: (diffDays) => {
                if (diffDays < 1) return "今天";
                if (diffDays === 1) return "昨天";
                if (diffDays < 7) return `${diffDays} 天前`;
                if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
                if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
                return `${Math.floor(diffDays / 365)} 年前`;
            },
            recently: '近期',
            heading: '隔壁邻居怎么说',
            sub: 'Old Klang Road 邻居真实留言 · 没有网红，没有广告',
            reviewsCountSuffix: ' 条留言',
            statsFrom: '来自 Pearl Point / Millerz / Citizen 1 & 2 等社区',
            readMore: '阅读全文 →',
            fiveStars: '5 星好评',
            leaveReview: ' 写下您的留言',
            close: '关闭',
            formTitle: '留下真实评价',
            formSub: '分享您的用餐体验给邻居们吧',
            nameLabel: '你的称呼 (选填居住地)',
            namePlaceholder: '例如: Amy Tan (Pearl Point)',
            textLabel: '留言内容',
            textPlaceholder: '碗妈煮的菜好吃吗？',
            submitting: '提交中...',
            submit: '提交留言',
            submitSuccess: '留言提交成功！感谢您的真实反馈。',
            submitError: '提交失败，请重试。',
        },
        heroSection: {
            locationBadge: 'Old Klang Road 邻里私房菜',
            locationSub: 'Pearl Point Home Kitchen',
            reviewsSuffix: '+ 邻居好评',
            primaryCta: '看明天可以吃什么',
            whatsappHref: 'https://wa.me/60103370197?text=Hi%20%E7%A2%97%E5%A6%88%EF%BC%81%E6%88%91%E6%83%B3%E4%BA%86%E8%A7%A3%E4%B8%80%E4%B8%8B%E4%BB%8A%E5%A4%A9%E7%9A%84%E8%8F%9C%E5%8D%95%E3%80%82',
            whatsappCta: 'WhatsApp 问碗妈',
            voucherCta: '先囤券更划算',
            seeSpecial: '查看明日特餐',
        },
        subscribeModal: {
            prefilled: 'Hi 碗妈！我从网站加入，想拿首单 RM 5 voucher，之后有新 Promo 可以通知我 🙏 🍱',
            close: '关闭',
            photoAlt: '碗妈每天新鲜手作',
            badge: '首单立减 RM 5',
            title: '首单立减 RM 5 · 现在就能用',
            body: '点一下就领，结账时自动帮你用上，不用等回复。Pearl Point / OUG / Citizen 1 & 2 邻居都在吃。',
            claimedTitle: ' 已领取，去点菜',
            claimedSubBefore: '优惠码 ',
            claimedSubAfter: ' · 结账自动套用',
            claimBefore: '领取 RM ',
            claimAfter: ' 首单折扣',
            or: '或者',
            whatsappCta: '加 WhatsApp 收新菜通知',
            later: '下次再说',
        },
        menuCarousel: {
            wdLabel: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
            upNext: '✨ 下一餐',
            tomorrowTag: '✨ 明天',
            soldOut: '售罄',
            stockLeft: (n) => `仅剩 ${n} 份`,
            closed: '已截单',
            orderTomorrow: '加入明天',
            addToOrder: '加入预订',
            closedToday: '今日已截单',
            dayDateSubSep: ' ',
            whatsappHref: 'https://wa.me/60103370197?text=Hi%20BowlMama!%20%E6%83%B3%E7%AC%AC%E4%B8%80%E6%97%B6%E9%97%B4%E6%94%B6%E5%88%B0%E4%B8%8B%E5%91%A8%E8%8F%9C%E5%8D%95%E6%9B%B4%E6%96%B0%EF%BC%8C%E5%8F%AF%E4%BB%A5%E9%80%9A%E7%9F%A5%E6%88%91%E5%90%97%EF%BC%9F',
            nextWeekEyebrow: '下周预告',
            nextWeekQuestion: '想第一时间收到下周菜单？',
            nextWeekEyebrowDesktop: '✨ 下周预告',
            nextWeekLine1: '碗妈每周更新菜单',
            nextWeekLine2: '想第一时间收到通知？',
            notifyMe: ' WhatsApp 通知我',
            heading: '每日精选 / Weekly Rotation',
            subMobile: '一菜一天 · 碗妈每周为你换一轮，常驻菜天天都有',
            subDesktop: '一菜一天，周一到周五每天一道特餐 · 常驻菜天天供应，碗妈每周更新',
            dailyHeading: '⭐ 常驻 · 天天都有',
            retiredTitle: '🕰 往期人气菜 · 敬请期待',
            retiredCountBefore: '（',
            retiredCountAfter: ' 道）',
            collapse: '收起 ▲',
            expand: '展开看看 ▼',
            voucherTitle: '餐券预付包 · 一次买，慢慢吃',
            voucherSub: '任意主菜都能兑 · 20 张装单券低至 RM 17.50 · 30 / 60 天有效',
            voucherCta: '去看餐券包',
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
        footer: {
            links: { menu: '/en#menu', vouchers: '/en/meal-vouchers', member: '/en/member', blog: '/en/blog', catering: '/en/catering', privacy: '/en/privacy', terms: '/en/terms', refund: '/en/refund' },
            dailyMenu: 'Daily Menu',
            mealVouchers: 'Meal Vouchers',
            member: 'Member',
            catering: 'Catering',
            contactUs: 'Contact us',
            servingAround: ' Serving our neighbours around',
            tierRange: (t) => t.rangeEn,
            tierFreeOver: freeOverPhraseEn,
            beyondShort: BEYOND_DELIVERY_SHORT_EN,
            coverageHeading: 'Coverage area',
            promiseHeading: 'Our promise',
            noMsg: 'No MSG',
            dailyFresh: 'Daily fresh from the wet market',
            mumsRecipe: "Mum's recipe, mum's heart",
            copyright: '© 2026 Incredibowl. Home-cooked taste, sourced fresh daily.',
        },
        navBar: {
            topNotice: 'Heads up: orders close 06:00 daily (place before 06:00 for same-day delivery) ',
            marqueeNotice: 'Orders close 06:00 · ',
            deliverySummary: DELIVERY_SUMMARY_EN,
            homeHref: '/en',
            homeAriaLabel: 'Incredibowl BowlMama Kitchen home',
            brandName: "BowlMama's Kitchen",
            dailyMenu: 'Daily Menu',
            vouchersHref: '/en/meal-vouchers',
            mealVouchers: 'Meal Vouchers',
            reviews: 'Reviews',
            panelReviews: 'Neighbour Reviews',
            contact: 'Contact BowlMama',
            memberHref: '/en/member',
            memberAria: 'Open member centre',
            memberTitle: 'Member centre · orders & vouchers',
            member: 'Member',
            signInMobileAria: 'Sign in',
            signInDesktopAria: 'Sign in / Neighbourhood member',
            signInLabel: 'Sign in / Member',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            cartAria: (count, total) => `Open cart (${count} items · RM ${total})`,
            cartEmptyAria: 'Open cart',
            languageLabel: 'Language / 语言',
        },
        deliveryWidget: {
            whatsAppUrl: "https://wa.me/60103370197?text=Hi%20BowlMama%2C%20my%20address%20is%3A%20",
            lookupFailed: 'Lookup failed, please try again',
            networkError: 'Network error, please try again later',
            heading: 'Can we deliver to you?',
            sub: '30-second check — see your delivery zone',
            placeholder: 'e.g. Pearl Suria, OUG Parklane, 58200...',
            addressAria: 'Enter your address or postcode',
            clearAria: 'Clear',
            checking: 'Checking',
            check: 'Check',
            feeBefore: 'Delivery fee RM ',
            feeMid: ' · ',
            feeAfter: ' km away',
            nearBefore: 'Spend ',
            thresholdPlus: '+',
            nearMid: " and it's ",
            nearFree: 'free',
            midBefore: 'Spend ',
            midMid: ' and the fee drops to ',
            farBefore: 'Long-distance orders are delivered by ',
            farMid: ' at a flat ',
            farAfter: ' — no free-delivery threshold',
            outsideBefore: "Sorry, you're ",
            outsideAfter: ' km away — beyond our 25km delivery range',
            cateringCta: 'Catering order? WhatsApp us →',
            feeTable: 'Delivery fee at a glance',
            hideFees: 'Hide ▴',
            showFees: 'View ▾',
            distanceBasis: DISTANCE_BASIS_EN,
            tierRange: (t) => t.rangeEn,
            tierFreeOver: (t) => (t.freeOver === null ? freeOverPhraseEn(t) : `RM ${t.freeOver}+ → free`),
            beyondNote: BEYOND_DELIVERY_NOTE_EN,
            cutoffHeading: 'Cutoff & delivery windows',
            cutoffTitle: 'Orders close 06:00 daily',
            cutoffSub: 'Order before 06:00 for same-day delivery',
            windowsTitle: 'Delivery windows',
        },
        aboutBowlMama: {
            heading: 'About BowlMama',
            signatureDash: '—',
            signatureName: 'BowlMama',
            photoAlt: 'BowlMama picks produce at the wet market at 6 AM',
            photoCaption: '6 AM at the wet market — picking tomatoes by hand',
        },
        faqSection: {
            heading: 'FAQ',
            sub: 'What neighbours often ask',
        },
        feedbackSection: {
            relativeTime: (diffDays) => {
                if (diffDays < 1) return "today";
                if (diffDays === 1) return "yesterday";
                if (diffDays < 7) return `${diffDays} days ago`;
                if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
                return `${Math.floor(diffDays / 365)} years ago`;
            },
            recently: 'recently',
            heading: 'What our neighbours say',
            sub: 'Real reviews from Old Klang Road locals · No influencers, no ads',
            reviewsCountSuffix: ' real reviews',
            statsFrom: 'From Pearl Point / Millerz / Citizen 1 & 2 and nearby',
            readMore: 'Read more →',
            fiveStars: '5 star rating',
            leaveReview: ' Leave a review',
            close: 'Close',
            formTitle: 'Leave an honest review',
            formSub: 'Share your experience with the neighbourhood',
            nameLabel: 'Your name (optional area)',
            namePlaceholder: 'e.g. Amy Tan (Pearl Point)',
            textLabel: 'Your review',
            textPlaceholder: 'How was the food?',
            submitting: 'Submitting…',
            submit: 'Submit review',
            submitSuccess: 'Submitted! Thank you for the honest review.',
            submitError: 'Submit failed. Please try again.',
        },
        heroSection: {
            locationBadge: 'Old Klang Road home kitchen',
            locationSub: 'Pearl Point',
            reviewsSuffix: '+ neighbours love it',
            primaryCta: "See Tomorrow's Menu",
            whatsappHref: 'https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20see%20today%27s%20menu.',
            whatsappCta: 'Ask BowlMama on WhatsApp',
            voucherCta: 'Meal vouchers — from RM 17.50 a meal',
            seeSpecial: "See tomorrow's special",
        },
        subscribeModal: {
            prefilled: "Hi BowlMama! I'd like to claim the RM 5 first-order voucher — please ping me when you have new promos or new dishes. Thanks! 🍱",
            close: 'Close',
            photoAlt: "BowlMama's daily home-cooked dish",
            badge: 'RM 5 off your first order',
            title: 'RM 5 off your first order — claim it right here',
            body: 'One tap to claim; we apply it automatically at checkout — no waiting for a reply. Pearl Point / OUG / Citizen 1 & 2 neighbours are already eating.',
            claimedTitle: ' Claimed — go pick a dish',
            claimedSubBefore: 'Code ',
            claimedSubAfter: ' · applied at checkout',
            claimBefore: 'Claim RM ',
            claimAfter: ' off',
            or: 'or',
            whatsappCta: 'Add WhatsApp for new-dish alerts',
            later: 'Maybe later',
        },
        menuCarousel: {
            wdLabel: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            upNext: '✨ Up next',
            tomorrowTag: '✨ Tomorrow',
            soldOut: 'Sold out',
            stockLeft: (n) => `${n} left`,
            closed: 'Closed',
            orderTomorrow: 'Order tmrw',
            addToOrder: 'Add to order',
            closedToday: 'Closed for today',
            dayDateSubSep: ' · ',
            whatsappHref: 'https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20be%20notified%20when%20next%20week%27s%20menu%20is%20updated.%20Could%20you%20let%20me%20know%3F',
            nextWeekEyebrow: 'Next Week',
            nextWeekQuestion: 'Get a heads-up when next week’s menu drops?',
            nextWeekEyebrowDesktop: '✨ NEXT WEEK',
            nextWeekLine1: 'BowlMama refreshes the menu weekly.',
            nextWeekLine2: 'Want to be notified?',
            notifyMe: ' Notify me on WhatsApp',
            heading: 'Daily Picks · Weekly Rotation',
            subMobile: 'A different special each weekday — plus daily dishes, always available. BowlMama refreshes weekly.',
            subDesktop: 'One special per weekday, Mon–Fri — daily dishes available every day. BowlMama refreshes the menu weekly.',
            dailyHeading: '⭐ Daily · Always available',
            retiredTitle: '🕰 Past favourites · Back soon',
            retiredCountBefore: '(',
            retiredCountAfter: ')',
            collapse: 'Hide ▲',
            expand: 'Take a look ▼',
            voucherTitle: 'Meal Voucher Bundles · Buy once, eat anytime',
            voucherSub: 'Any main dish · 20-pack from RM 17.50 a voucher · Valid 30 / 60 days',
            voucherCta: 'View bundles',
        },
    },
};
