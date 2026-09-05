"use client";

/**
 * /order 与 /en/order 共用的付费广告落地页。
 *
 * 两件事以前是坏的，这个文件把它们一次修掉：
 *
 *   1. **菜单是手抄的**。原本这里有一份写死的三道菜数组（名字/价格/标签全手打），
 *      跟 `src/data/weeklyMenu.ts` 没有任何关系。每周换菜之后这一页就悄悄过期，
 *      而它承接的是**付费 Facebook 流量** —— 广告点进来看到的菜和价，可能已经
 *      不在菜单上了。现在 DISH 列表由 weeklyMenu 现推（排除 retired / hidden），
 *      换菜自动跟上，零维护。
 *   2. **中英各一份组件**。/en/order 是这一份的 543 行复制品，任何修复都要改两次，
 *      漂移已经发生过（见下方 DISH_HOOKS 注释里 #2 的英文名分裂）。现在照 /o 的
 *      做法：一份组件 + `locale` prop，文案全部走 DICT。
 *
 * ⚠️ 归因/measurement 相关的东西一律**原样保留**：WhatsApp 号码、每一条深链文案、
 *    fbq/gtag 的事件名与 source 标签、页面 metadata。这一页的转化数据是广告投放的
 *    唯一依据，动它等于把历史数据切断。
 */

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import {
    ChevronDown,
    MapPin,
    Search,
    Loader2,
    Truck,
    AlertTriangle,
} from "lucide-react";
import { DELIVERY_PROSE_SHORT_ZH, DELIVERY_PROSE_SHORT_EN } from "@/lib/deliveryCopy";
import type { Locale } from "@/lib/locale";
import { weeklyMenu, type MenuItem } from "@/data/weeklyMenu";

const WA = "60103370197";

const fireLead = (source: string, value = 0) => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
        fbq(
            "track",
            "Lead",
            { content_name: source, value, currency: "MYR" },
            { eventID: `lead_${source}_${Date.now()}` },
        );
    }
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
        gtag("event", "whatsapp_click", { source, value });
    }
};

const fireViewContent = () => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
        fbq(
            "track",
            "ViewContent",
            { content_name: "Order Landing", content_category: "menu", currency: "MYR" },
            { eventID: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
        );
    }
};

const wa = (msg: string) =>
    `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

// ═══════════════════════════════════════════════════════════════════
//   菜单数据 —— 唯一来源 weeklyMenu，这一页不再自己存菜
// ═══════════════════════════════════════════════════════════════════

/**
/**
 * 落地页展示哪几道菜 —— **由老板为广告选定**，不是「全菜单」。
 *
 * 2026-09-05：这一页原来把这三道菜的名字/价格/英文名**手抄**在文件里，跟
 * weeklyMenu 没有任何关系，每周换菜后就悄悄过期（承接的还是付费 Facebook
 * 流量）。现在只保留「选哪几道」这个决定，名字/价格/图/标签一律现推 —— 换菜
 * 自动跟上，改价自动跟上。
 *
 * ⚠️ 只改数据来源，不改这一页展示几道菜：把它变成整份 12 道的菜单是另一个
 * 决定（广告落地页的转化设计），得老板拍板，不该顺手做掉。
 * 某道菜被 retired / hidden 之后会自动从这里消失，不会显示一道点不了的菜。
 */
const LANDING_DISH_IDS = [2, 1, 11] as const;

const LANDING_DISHES: MenuItem[] = LANDING_DISH_IDS
    .map((id) => weeklyMenu.find((d) => d.id === id))
    .filter((d): d is MenuItem => !!d && !d.retired && !d.hidden);

/** Hero 的「RM xx 起」同样现算，不再手写一个会过期的数字。 */
const MIN_PRICE_TEXT = Math.min(...LANDING_DISHES.map((d) => d.price)).toFixed(2);

/**
 * 卡片左上角那个手写小徽章。
 *
 * ⚠️ **weeklyMenu 里没有这个字段** —— 它只存菜名 / 价格 / 图 / tags / 简介，
 * 没有营销 hook。所以这里只保留旧版页面上已经存在的三条原文，按菜 id 对应；
 * 没登记的菜不显示徽章。**绝不为新菜编一句营销词**（诚实原则）。要给某道菜加
 * 徽章，请老板给文案后往这里加一条。
 *
 * 顺带记录一个旧漂移：#2 当归蒸鸡在中文版写死的英文名是 "Angelica Steamed
 * Chicken Leg"，英文版写的是 "Angelica Steamed Whole Chicken Leg"，同一道菜
 * 在两个 locale 上报了两个 content_name。改吃 weeklyMenu.nameEn 之后统一了。
 */
const DISH_HOOKS: Record<number, { zh: string; en: string }> = {
    2: { zh: "碗妈拿手菜", en: "BowlMama's signature" },
    1: { zh: "阿嫲手艺", en: "Grandma's recipe" },
    11: { zh: "入门首选", en: "Easy starter" },
};

const dishName = (d: MenuItem, locale: Locale) => (locale === "en" ? d.nameEn : d.name);
/** 卡片副标题：显示「另一种语言」的菜名（中文版给英文名，英文版给中文名）。 */
const dishSubName = (d: MenuItem, locale: Locale) => (locale === "en" ? d.name : d.nameEn);
/** 卡片只放得下三个标签 —— 取 weeklyMenu 里的前三个，不另编。 */
const dishTags = (d: MenuItem, locale: Locale) =>
    ((locale === "en" ? d.tagsEn : d.tags) ?? d.tags).slice(0, 3);

// 2026-07-29: 'outside' now means past the 25km ceiling (was 7.5km).
// 7.5–25km gets the banded 'far' quote instead of a refusal.
type DeliveryResult = {
    tier: "near" | "mid" | "far" | "outside";
    distanceKm: number;
    fee?: number;
    /** null on the far tier — flat fee, no threshold to spend toward. */
    feeAtThreshold?: number | null;
    threshold?: number | null;
    formattedAddress?: string;
};

// ═══════════════════════════════════════════════════════════════════
//   中英文案字典（模式同 /o 的 QuickOrderClient）
//   zh / en 两边都是从原来两份组件里**逐字复制**过来的，没有一句重写。
//   WhatsApp 深链文案属于归因资产，同样一字不改。
// ═══════════════════════════════════════════════════════════════════
const DICT = {
    zh: {
        prose: DELIVERY_PROSE_SHORT_ZH,
        heroBadge: "Pearl Point 私厨外送 · Kuala Lumpur",
        heroTitleA: "家的味道，",
        heroTitleB: "午晚都送。",
        heroSub: "凌晨 6 点去巴刹，不加味精",
        priceFrom: (p: string) => `RM ${p} 起`,
        heroTail: "私厨现煮",
        heroCta: "WhatsApp 一句话下单",
        heroCtaSub: "不需要注册 · 不下载 App · 5 秒搞定",
        heroWa: "Hi 碗妈！我从 FB 广告看到，想了解今天 / 明天的菜单和配送细节 🔥",
        statReviewsValue: "10+",
        statReviewsLabel: "邻居好评",
        statMealsValue: "2 餐",
        statMealsLabel: "午 + 晚送达",
        statMsgValue: "0",
        statMsgLabel: "不加味精",

        zoneTitle: "你住哪里？",
        zoneSub: "30 秒查一下你属于哪个配送区",
        addressPlaceholder: "例: Pearl Suria, OUG Parklane, 58200...",
        addressAria: "输入你的地址或邮编",
        clearAria: "清空",
        checking: "查询中",
        checkCta: "查一下",
        checkFailed: "查询失败，请重试",
        networkError: "网络异常，请稍后重试",
        feeLine: (fee: number | undefined, km: number) => `配送费 RM ${fee} · 离碗妈 ${km} km`,
        nearBefore: "满 ",
        nearMid: " 即享 ",
        nearFree: "免运",
        midBefore: "满 ",
        midMid: " 配送费降至 ",
        farBefore: "远距离由 ",
        farMid: " 配送，运费固定 ",
        farAfter: "，不设免运门槛",
        seeMenuCta: "WhatsApp 看菜单 →",
        outsideLine: (km: number) => `抱歉，你的地址离碗妈 ${km} km，超出 25km 配送范围`,
        outsideCta: "公司团餐？WhatsApp 问问看 →",
        nearWa: (a: string) =>
            `Hi 碗妈！我从 FB 广告来的，地址：${a}（5km 内 · ${DELIVERY_PROSE_SHORT_ZH} ✓），想看今天 / 明天的菜单 🔥`,
        midWa: (a: string, km: number, fee: number | undefined) =>
            `Hi 碗妈！我从 FB 广告来的，地址：${a}（离你 ${km} km · 配送费 RM ${fee}），想看今天 / 明天的菜单 🔥`,
        farWa: (a: string, km: number, fee: number | undefined) =>
            `Hi 碗妈！我从 FB 广告来的，地址：${a}（离你 ${km} km · 远距离 Grab 配送 · 运费 RM ${fee} 固定），想看今天 / 明天的菜单 🔥`,
        outsideWa: (a: string, km: number) =>
            `Hi 碗妈！我地址是 ${a}（离你 ${km} km），超出配送范围，想问公司团餐能不能送 🙏`,

        dishesTitle: "今天 / 明天能吃什么",
        dishesSub: "选一道，WhatsApp 一下就好",
        dishCta: "WhatsApp 订这道 →",
        dishWa: (name: string, price: string) =>
            `Hi 碗妈！我从广告来的，想订${name} (RM ${price}) 🔥 请告诉我配送时间和地址要求 🙏`,

        faqTitle: "3 个常见疑问",
        faq: [
            {
                q: "什么时候送到？",
                a: "前一天 6 AM 截单，隔天午餐 11:30 AM – 1:30 PM 或晚餐 5 PM – 8 PM 送达。WhatsApp 告诉我们地址 + 你选哪一餐，碗妈跟你 confirm 准确时间。",
            },
            {
                q: "怎么付款？",
                a: "WhatsApp 跟碗妈 confirm 菜单后，发你 DuitNow QR 或 FPX 支付链接。30 秒搞定，不需要注册账号。",
            },
            {
                q: "厨房在哪里？",
                a: "Pearl Suria Residence（紧挨着 Pearl Point），Old Klang Road。家庭式私厨 — 只接外送，没有堂食。",
            },
        ],

        finalTitleA: "还在想",
        finalTitleB: "吃什么？",
        finalSubA: "WhatsApp 一句「碗妈我想吃饭」就好。",
        finalSubB: "碗妈会推荐今天最新鲜的给你。",
        finalCta: "WhatsApp 碗妈",
        finalWa: "Hi 碗妈！我想吃饭，推荐我一道今天最新鲜的吧 🔥",

        stickyTitle: "WhatsApp 碗妈 · 立即下单",
        stickySub: "凌晨 6 点采买 · 午晚送达",
        stickyCta: "下单 →",
        stickyWa: "Hi 碗妈！我从 FB 广告来的，想了解菜单和配送 🔥",
    },
    en: {
        prose: DELIVERY_PROSE_SHORT_EN,
        heroBadge: "Pearl Point Home Kitchen · Kuala Lumpur",
        heroTitleA: "Tastes like home,",
        heroTitleB: "lunch + dinner.",
        heroSub: "6 AM market run · no MSG",
        priceFrom: (p: string) => `From RM ${p}`,
        heroTail: "Fresh-cooked",
        heroCta: "WhatsApp to order",
        heroCtaSub: "No signup · No app · 5 seconds",
        heroWa:
            "Hi BowlMama! I came from your FB ad and want to learn about today's / tomorrow's menu and delivery details 🔥",
        statReviewsValue: "10+",
        statReviewsLabel: "Neighbour reviews",
        statMealsValue: "2x",
        statMealsLabel: "Lunch + Dinner",
        statMsgValue: "0",
        statMsgLabel: "MSG added",

        zoneTitle: "Where are you?",
        zoneSub: "Quick 30-second check on your delivery tier",
        addressPlaceholder: "e.g. Pearl Suria, OUG Parklane, 58200...",
        addressAria: "Enter your address or postcode",
        clearAria: "Clear",
        checking: "Checking",
        checkCta: "Check",
        checkFailed: "Check failed, please try again",
        networkError: "Network error, please try again",
        feeLine: (fee: number | undefined, km: number) => `Delivery fee RM ${fee} · ${km} km away`,
        nearBefore: "Spend ",
        nearMid: " for ",
        nearFree: "free delivery",
        midBefore: "Spend ",
        midMid: " to drop delivery fee to ",
        farBefore: "Long-distance orders are delivered by ",
        farMid: " at a flat ",
        farAfter: " — no free-delivery threshold",
        seeMenuCta: "WhatsApp to see menu →",
        outsideLine: (km: number) =>
            `Sorry — your address is ${km} km away, beyond our 25km delivery range`,
        outsideCta: "Catering order? WhatsApp us →",
        nearWa: (a: string) =>
            `Hi BowlMama! I came from your FB ad. My address: ${a} (within 5km · ${DELIVERY_PROSE_SHORT_EN} ✓). I'd like to see today's / tomorrow's menu 🔥`,
        midWa: (a: string, km: number, fee: number | undefined) =>
            `Hi BowlMama! I came from your FB ad. My address: ${a} (${km} km away · delivery fee RM ${fee}). I'd like to see today's / tomorrow's menu 🔥`,
        farWa: (a: string, km: number, fee: number | undefined) =>
            `Hi BowlMama! I came from your FB ad. My address: ${a} (${km} km away · long-distance Grab delivery · flat RM ${fee} fee). I'd like to see today's / tomorrow's menu 🔥`,
        outsideWa: (a: string, km: number) =>
            `Hi BowlMama! My address is ${a} (${km} km away) — outside your range. Could you quote me for a catering order? 🙏`,

        dishesTitle: "On the menu today / tomorrow",
        dishesSub: "Pick one, WhatsApp away",
        dishCta: "WhatsApp this one →",
        dishWa: (name: string, price: string) =>
            `Hi BowlMama! I came from your FB ad. I'd like to order ${name} (RM ${price}) 🔥 Please share delivery time + address details 🙏`,

        faqTitle: "3 quick FAQs",
        faq: [
            {
                q: "When does it arrive?",
                a: "Order by 6 AM the day before. Lunch delivery 11:30 AM – 1:30 PM, dinner delivery 5 PM – 8 PM. WhatsApp us your address + meal slot, we'll confirm exact timing.",
            },
            {
                q: "How do I pay?",
                a: "After we confirm your order on WhatsApp, you'll get a DuitNow QR or FPX payment link. 30 seconds, no account signup needed.",
            },
            {
                q: "Where's the kitchen?",
                a: "Pearl Suria Residence on Old Klang Road, right next to Pearl Point. Home kitchen — delivery only, no dine-in.",
            },
        ],

        finalTitleA: "Still deciding",
        finalTitleB: "what to eat?",
        finalSubA: "Just WhatsApp “BowlMama, I'm hungry”.",
        finalSubB: "She'll recommend today's freshest catch.",
        finalCta: "WhatsApp BowlMama",
        finalWa: "Hi BowlMama! I'm hungry — recommend today's freshest please 🔥",

        stickyTitle: "WhatsApp BowlMama · Order now",
        stickySub: "6 AM market run · lunch + dinner",
        stickyCta: "Order →",
        stickyWa:
            "Hi BowlMama! I came from your FB ad and want to know more about the menu and delivery 🔥",
    },
} as const;

type Dict = (typeof DICT)[Locale];

const tierWaMsg = (r: DeliveryResult, addr: string, t: Dict) => {
    const a = r.formattedAddress || addr;
    if (r.tier === "near") return t.nearWa(a);
    if (r.tier === "far") return t.farWa(a, r.distanceKm, r.fee);
    if (r.tier === "outside") return t.outsideWa(a, r.distanceKm);
    return t.midWa(a, r.distanceKm, r.fee);
};

function WaIcon({ className = "w-6 h-6" }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" className={`${className} fill-white`} aria-hidden="true">
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z" />
        </svg>
    );
}

/**
 * 菜品图。weeklyMenu 的 `image` 允许是 emoji 占位（新菜还没拍照时），直接丢给
 * next/image 会 400 —— 首页轮播 / CartItemCard / /o 都有这个守卫，这里补齐。
 */
function DishImage({ src, alt }: { src: string; alt: string }) {
    if (src.startsWith("/")) {
        return (
            <Image
                src={src}
                alt={alt}
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
            />
        );
    }
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#E3EADA] text-6xl">
            {src}
        </div>
    );
}

interface Props {
    locale?: Locale;
}

export default function OrderClient({ locale = "zh" }: Props) {
    const t = DICT[locale];
    const [address, setAddress] = useState("");
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<DeliveryResult | null>(null);
    const [checkError, setCheckError] = useState("");
    const [faqOpen, setFaqOpen] = useState<number | null>(0);

    useEffect(() => {
        fireViewContent();
    }, []);

    const checkDelivery = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = address.trim();
        if (!trimmed) return;
        setChecking(true);
        setCheckError("");
        setCheckResult(null);
        try {
            const res = await fetch("/api/check-delivery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) {
                setCheckError(data.error || t.checkFailed);
                return;
            }
            setCheckResult(data);
            fireLead("zone_check");
        } catch {
            setCheckError(t.networkError);
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] pb-24">
            {/* HERO */}
            <section className="relative px-5 pt-10 pb-10 lg:pt-16 lg:pb-14 overflow-hidden">
                <div className="absolute inset-0 -z-0 pointer-events-none">
                    <Image
                        src="/angelica_chicken.webp"
                        alt=""
                        fill
                        priority
                        className="object-cover object-right opacity-[0.12] mix-blend-multiply"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FDFBF7] via-[#FDFBF7]/85 to-[#FDFBF7]" />
                </div>
                <div className="relative max-w-md lg:max-w-2xl mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF6B35]/12 text-[#C84518] rounded-full text-xs font-black mb-4">
                        <MapPin size={11} strokeWidth={2.5} />
                        <span>{t.heroBadge}</span>
                    </div>
                    <h1 className="text-[42px] lg:text-6xl font-black leading-[1.02] tracking-tight mb-3">
                        {t.heroTitleA}
                        <br />
                        <span className="text-[#FF6B35]">{t.heroTitleB}</span>
                    </h1>
                    <p className="text-lg lg:text-2xl font-black text-[#1A2D23]/80 leading-snug mb-2">
                        {t.heroSub}
                    </p>
                    <p className="text-base lg:text-lg text-[#1A2D23]/60 font-bold mb-7">
                        <span className="text-[#1A2D23] font-black">{t.priceFrom(MIN_PRICE_TEXT)}</span> · {t.prose} · {t.heroTail}
                    </p>

                    <a
                        href={wa(t.heroWa)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("hero_cta")}
                        className="group relative block w-full text-center bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="absolute inset-0 rounded-2xl bg-[#25D366] animate-ping opacity-20" />
                        <span className="relative flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            {t.heroCta}
                        </span>
                        <span className="relative block text-[11px] lg:text-xs font-bold opacity-90 mt-1">
                            {t.heroCtaSub}
                        </span>
                    </a>

                    <div className="grid grid-cols-3 gap-2 mt-6">
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">{t.statReviewsValue}</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">{t.statReviewsLabel}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">{t.statMealsValue}</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">{t.statMealsLabel}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">{t.statMsgValue}</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">{t.statMsgLabel}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ZONE CHECK — real address-to-tier lookup */}
            <section className="px-5 py-9 bg-white border-y border-[#E3EADA]">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        {t.zoneTitle}
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-5">
                        {t.zoneSub}
                    </p>

                    <form onSubmit={checkDelivery} className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder={t.addressPlaceholder}
                                aria-label={t.addressAria}
                                className="w-full px-4 py-3 pr-10 text-sm bg-[#FDFBF7] border-2 border-[#E3EADA] rounded-xl focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 placeholder:text-gray-400"
                            />
                            {address && !checking && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddress("");
                                        setCheckResult(null);
                                        setCheckError("");
                                    }}
                                    aria-label={t.clearAria}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={checking || !address.trim()}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#E95D31] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-colors active:scale-[0.97] shadow-md shadow-[#FF6B35]/20"
                        >
                            {checking ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" strokeWidth={2.5} />
                                    {t.checking}
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    {t.checkCta}
                                </>
                            )}
                        </button>
                    </form>

                    {checkError && (
                        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 leading-relaxed">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" strokeWidth={2.5} />
                            <span>{checkError}</span>
                        </p>
                    )}

                    {checkResult && checkResult.tier === "near" && (
                        <div className="mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
                            <p className="text-base font-black text-amber-800 flex items-center gap-1.5">
                                <Truck size={18} strokeWidth={2.5} />
                                {t.feeLine(checkResult.fee, checkResult.distanceKm)}
                            </p>
                            <p className="text-xs text-amber-800/80 mt-1.5 font-bold">
                                {t.nearBefore}<span className="font-black">RM {checkResult.threshold}</span>{t.nearMid}<span className="font-black">{t.nearFree}</span>
                            </p>
                            {checkResult.formattedAddress && (
                                <p className="text-[11px] text-amber-700/60 mt-1 truncate">{checkResult.formattedAddress}</p>
                            )}
                            <a
                                href={wa(tierWaMsg(checkResult, address, t))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_near")}
                                className="block mt-3 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                {t.seeMenuCta}
                            </a>
                        </div>
                    )}

                    {checkResult && checkResult.tier === "mid" && (
                        <div className="mt-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200">
                            <p className="text-base font-black text-orange-800 flex items-center gap-1.5">
                                <Truck size={18} strokeWidth={2.5} />
                                {t.feeLine(checkResult.fee, checkResult.distanceKm)}
                            </p>
                            <p className="text-xs text-orange-800/80 mt-1.5 font-bold">
                                {t.midBefore}<span className="font-black">RM {checkResult.threshold}</span>{t.midMid}<span className="font-black">RM {checkResult.feeAtThreshold}</span>
                            </p>
                            {checkResult.formattedAddress && (
                                <p className="text-[11px] text-orange-700/60 mt-1 truncate">{checkResult.formattedAddress}</p>
                            )}
                            <a
                                href={wa(tierWaMsg(checkResult, address, t))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_mid")}
                                className="block mt-3 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                {t.seeMenuCta}
                            </a>
                        </div>
                    )}

                    {/* Far (7.5km+): served via Grab at a flat fee. Ad traffic from
                        this distance used to hit a dead-end "outside our range" card —
                        now it converts like any other tier. */}
                    {checkResult && checkResult.tier === "far" && (
                        <div className="mt-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200">
                            <p className="text-base font-black text-orange-800 flex items-center gap-1.5">
                                <Truck size={18} strokeWidth={2.5} />
                                {t.feeLine(checkResult.fee, checkResult.distanceKm)}
                            </p>
                            <p className="text-xs text-orange-800/80 mt-1.5 font-bold">
                                {t.farBefore}<span className="font-black">Grab</span>{t.farMid}<span className="font-black">RM {checkResult.fee}</span>{t.farAfter}
                            </p>
                            {checkResult.formattedAddress && (
                                <p className="text-[11px] text-orange-700/60 mt-1 truncate">{checkResult.formattedAddress}</p>
                            )}
                            <a
                                href={wa(tierWaMsg(checkResult, address, t))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_far")}
                                className="block mt-3 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                {t.seeMenuCta}
                            </a>
                        </div>
                    )}

                    {/* Past the 25km ceiling — the only distance we still turn away. */}
                    {checkResult && checkResult.tier === "outside" && (
                        <div className="mt-4 p-4 rounded-2xl bg-gray-50 border-2 border-gray-200">
                            <p className="text-sm font-black text-gray-700">
                                {t.outsideLine(checkResult.distanceKm)}
                            </p>
                            <a
                                href={wa(tierWaMsg(checkResult, address, t))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_outside")}
                                className="inline-flex items-center gap-1.5 mt-2 text-sm font-black text-green-700 hover:text-green-800"
                            >
                                {t.outsideCta}
                            </a>
                        </div>
                    )}
                </div>
            </section>

            {/* DISHES */}
            <section className="px-5 py-12">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        {t.dishesTitle}
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-7">
                        {t.dishesSub}
                    </p>

                    <div className="space-y-5">
                        {LANDING_DISHES.map((d) => {
                            const name = dishName(d, locale);
                            const price = d.price.toFixed(2);
                            const hook = DISH_HOOKS[d.id]?.[locale];
                            return (
                                <div
                                    key={d.id}
                                    className="bg-white rounded-2xl overflow-hidden shadow-lg shadow-[#1A2D23]/5 border border-[#E3EADA]"
                                >
                                    <div className="relative w-full aspect-[4/3]">
                                        <DishImage src={d.image} alt={name} />
                                        {hook && (
                                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black text-[#1A2D23] shadow">
                                                {hook}
                                            </div>
                                        )}
                                        <div className="absolute bottom-3 right-3 bg-[#FF6B35] text-white px-3 py-1.5 rounded-full text-base font-black shadow-lg">
                                            RM {price}
                                        </div>
                                    </div>
                                    <div className="p-4 lg:p-5">
                                        <h3 className="text-lg lg:text-xl font-black leading-tight">{name}</h3>
                                        <p className="text-xs lg:text-sm italic text-[#1A2D23]/55 font-semibold mt-0.5">
                                            {dishSubName(d, locale)}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {dishTags(d, locale).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-0.5 bg-[#E3EADA] text-[#1A2D23]/85 rounded-full text-[10px] lg:text-xs font-bold"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <a
                                            href={wa(t.dishWa(name, price))}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => fireLead(`dish_${d.nameEn}`, d.price)}
                                            className="block mt-4 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm lg:text-base shadow-md transition-all active:scale-[0.98]"
                                        >
                                            {t.dishCta}
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="px-5 py-10 bg-[#E3EADA]/40">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-6 tracking-tight">
                        {t.faqTitle}
                    </h2>
                    <div className="space-y-2">
                        {t.faq.map((f, i) => (
                            <div
                                key={i}
                                className="bg-white rounded-xl overflow-hidden border border-[#E3EADA]"
                            >
                                <button
                                    type="button"
                                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                                    className="w-full px-4 py-3.5 flex justify-between items-center text-left"
                                >
                                    <span className="font-black text-sm lg:text-base">{f.q}</span>
                                    <ChevronDown
                                        size={18}
                                        className={`text-[#FF6B35] transition-transform ${
                                            faqOpen === i ? "rotate-180" : ""
                                        }`}
                                    />
                                </button>
                                {faqOpen === i && (
                                    <div className="px-4 pb-4 text-sm lg:text-base text-[#1A2D23]/70 font-medium leading-relaxed">
                                        {f.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="px-5 py-14 bg-gradient-to-br from-[#FFF3E0] to-[#FFE9D5]">
                <div className="max-w-md lg:max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl lg:text-5xl font-black leading-tight mb-3 tracking-tight">
                        {t.finalTitleA}
                        <br />
                        <span className="text-[#FF6B35]">{t.finalTitleB}</span>
                    </h2>
                    <p className="text-base lg:text-lg font-bold text-[#1A2D23]/65 mb-7 leading-relaxed">
                        {t.finalSubA}
                        <br />
                        {t.finalSubB}
                    </p>
                    <a
                        href={wa(t.finalWa)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("final_cta")}
                        className="block w-full bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            {t.finalCta}
                        </span>
                    </a>
                </div>
            </section>

            {/* STICKY WA BAR */}
            <a
                href={wa(t.stickyWa)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fireLead("sticky_bar")}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A2D23] text-white shadow-2xl"
            >
                <div className="max-w-md lg:max-w-2xl mx-auto flex items-center gap-3 px-4 py-3.5 lg:py-4">
                    <span className="w-10 h-10 lg:w-11 lg:h-11 shrink-0 rounded-full bg-[#25D366] flex items-center justify-center shadow-inner">
                        <WaIcon className="w-5 h-5 lg:w-5.5 lg:h-5.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm lg:text-base font-black truncate">
                            {t.stickyTitle}
                        </p>
                        <p className="text-[11px] lg:text-xs text-white/60 truncate font-bold">
                            {t.stickySub}
                        </p>
                    </div>
                    <span className="shrink-0 px-3.5 py-2 lg:px-4 lg:py-2.5 bg-[#FF6B35] text-white rounded-full text-xs lg:text-sm font-black shadow">
                        {t.stickyCta}
                    </span>
                </div>
            </a>
        </div>
    );
}
