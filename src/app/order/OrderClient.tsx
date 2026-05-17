"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import {
    ChevronDown,
    MapPin,
    Search,
    Loader2,
    Truck,
    AlertTriangle,
} from "lucide-react";

const WA = "60103370197";

// Wrap fbq + gtag in a single fire-and-forget call.
// Lead is fired on every WhatsApp click so FB Ads can optimize on
// LP→Lead instead of LP→Purchase (which is currently broken at the
// website's registration wall).
const fireLead = (source: string, value = 0) => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
        fbq("track", "Lead", {
            content_name: source,
            value,
            currency: "MYR",
        });
    }
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
        gtag("event", "whatsapp_click", { source, value });
    }
};

const wa = (msg: string) =>
    `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

const DISHES = [
    {
        name: "招牌原盅当归蒸鸡全腿",
        nameEn: "Angelica Steamed Chicken Leg",
        price: 18.5,
        image: "/angelica_chicken.webp",
        tags: ["当归补血", "高蛋白 45g+", "暖身滋补"],
        hook: "碗妈拿手菜",
        msg:
            "Hi 碗妈！我从广告来的，想订招牌原盅当归蒸鸡全腿 (RM 18.50) 🔥 请告诉我配送时间和地址要求 🙏",
    },
    {
        name: "阿嫲古早味酱油鸡全腿",
        nameEn: "Soy Sauce Chicken Whole Leg",
        price: 18.5,
        image: "/soy_sauce_chicken_leg.webp",
        tags: ["高蛋白 48g+", "广式经典", "酱香入骨"],
        hook: "阿嫲手艺",
        msg:
            "Hi 碗妈！我从广告来的，想订阿嫲古早味酱油鸡全腿 (RM 18.50) 🔥 请告诉我配送时间和地址要求 🙏",
    },
    {
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Seaweed Rice",
        price: 16.9,
        image: "/natto_bowl.webp",
        tags: ["高蛋白 25g+", "纳豆激酶", "拉丝拌饭魂"],
        hook: "入门首选",
        msg:
            "Hi 碗妈！我从广告来的，想订纳豆月见海苔饭 (RM 16.90) 🔥 请告诉我配送时间和地址要求 🙏",
    },
];

type DeliveryResult = {
    tier: "near" | "mid" | "far" | "outside";
    distanceKm: number;
    fee?: number;
    feeAtThreshold?: number;
    threshold?: number;
    formattedAddress?: string;
};

const tierWaMsg = (r: DeliveryResult, addr: string) => {
    const a = r.formattedAddress || addr;
    if (r.tier === "near") {
        return `Hi 碗妈！我从 FB 广告来的，地址：${a}（5km 内 · RM 5，2.5km 内满 RM 20 / 2.5-5km 满 RM 30 免运 ✓），想看今天 / 明天的菜单 🔥`;
    }
    if (r.tier === "outside") {
        return `Hi 碗妈！我地址是 ${a}（离你 ${r.distanceKm} km），看看你能不能想办法送 🙏`;
    }
    return `Hi 碗妈！我从 FB 广告来的，地址：${a}（离你 ${r.distanceKm} km · 配送费 RM ${r.fee}），想看今天 / 明天的菜单 🔥`;
};

const FAQ = [
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
];

function WaIcon({ className = "w-6 h-6" }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" className={`${className} fill-white`} aria-hidden="true">
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z" />
        </svg>
    );
}

export default function OrderClient() {
    const [address, setAddress] = useState("");
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<DeliveryResult | null>(null);
    const [checkError, setCheckError] = useState("");
    const [faqOpen, setFaqOpen] = useState<number | null>(0);

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
                setCheckError(data.error || "查询失败，请重试");
                return;
            }
            setCheckResult(data);
            fireLead("zone_check");
        } catch {
            setCheckError("网络异常，请稍后重试");
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
                        <span>Pearl Point 私厨外送 · Kuala Lumpur</span>
                    </div>
                    <h1 className="text-[42px] lg:text-6xl font-black leading-[1.02] tracking-tight mb-3">
                        家的味道，
                        <br />
                        <span className="text-[#FF6B35]">午晚都送。</span>
                    </h1>
                    <p className="text-lg lg:text-2xl font-black text-[#1A2D23]/80 leading-snug mb-2">
                        凌晨 6 点去巴刹，不加味精
                    </p>
                    <p className="text-base lg:text-lg text-[#1A2D23]/60 font-bold mb-7">
                        <span className="text-[#1A2D23] font-black">RM 16.90 起</span> · 2.5km 内满 RM 20 / 2.5–5km 满 RM 30 免运 · 私厨现煮
                    </p>

                    <a
                        href={wa("Hi 碗妈！我从 FB 广告看到，想了解今天 / 明天的菜单和配送细节 🔥")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("hero_cta")}
                        className="group relative block w-full text-center bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="absolute inset-0 rounded-2xl bg-[#25D366] animate-ping opacity-20" />
                        <span className="relative flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            WhatsApp 一句话下单
                        </span>
                        <span className="relative block text-[11px] lg:text-xs font-bold opacity-90 mt-1">
                            不需要注册 · 不下载 App · 5 秒搞定
                        </span>
                    </a>

                    <div className="grid grid-cols-3 gap-2 mt-6">
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">6+</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">邻居好评</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">2 餐</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">午 + 晚送达</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">0</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">不加味精</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ZONE CHECK — real address-to-tier lookup */}
            <section className="px-5 py-9 bg-white border-y border-[#E3EADA]">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        你住哪里？
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-5">
                        30 秒查一下你属于哪个配送区
                    </p>

                    <form onSubmit={checkDelivery} className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="例: Pearl Suria, OUG Parklane, 58200..."
                                aria-label="输入你的地址或邮编"
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
                                    aria-label="清空"
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
                                    查询中
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    查一下
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
                                配送费 RM {checkResult.fee} · 离碗妈 {checkResult.distanceKm} km
                            </p>
                            <p className="text-xs text-amber-800/80 mt-1.5 font-bold">
                                满 <span className="font-black">RM {checkResult.threshold}</span> 即享 <span className="font-black">免运</span>
                            </p>
                            {checkResult.formattedAddress && (
                                <p className="text-[11px] text-amber-700/60 mt-1 truncate">{checkResult.formattedAddress}</p>
                            )}
                            <a
                                href={wa(tierWaMsg(checkResult, address))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_near")}
                                className="block mt-3 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                WhatsApp 看菜单 →
                            </a>
                        </div>
                    )}

                    {checkResult && (checkResult.tier === "mid" || checkResult.tier === "far") && (
                        <div className="mt-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200">
                            <p className="text-base font-black text-orange-800 flex items-center gap-1.5">
                                <Truck size={18} strokeWidth={2.5} />
                                配送费 RM {checkResult.fee} · 离碗妈 {checkResult.distanceKm} km
                            </p>
                            <p className="text-xs text-orange-800/80 mt-1.5 font-bold">
                                满 <span className="font-black">RM {checkResult.threshold}</span> 配送费降至 <span className="font-black">RM {checkResult.feeAtThreshold}</span>
                            </p>
                            {checkResult.formattedAddress && (
                                <p className="text-[11px] text-orange-700/60 mt-1 truncate">{checkResult.formattedAddress}</p>
                            )}
                            <a
                                href={wa(tierWaMsg(checkResult, address))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_far")}
                                className="block mt-3 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                            >
                                WhatsApp 看菜单 →
                            </a>
                        </div>
                    )}

                    {checkResult && checkResult.tier === "outside" && (
                        <div className="mt-4 p-4 rounded-2xl bg-gray-50 border-2 border-gray-200">
                            <p className="text-sm font-black text-gray-700">
                                抱歉，你的地址离碗妈 {checkResult.distanceKm} km，超出配送范围
                            </p>
                            <a
                                href={wa(tierWaMsg(checkResult, address))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_outside")}
                                className="inline-flex items-center gap-1.5 mt-2 text-sm font-black text-green-700 hover:text-green-800"
                            >
                                WhatsApp 问问看 →
                            </a>
                        </div>
                    )}
                </div>
            </section>

            {/* DISHES */}
            <section className="px-5 py-12">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        今天 / 明天能吃什么
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-7">
                        选一道，WhatsApp 一下就好
                    </p>

                    <div className="space-y-5">
                        {DISHES.map((d) => (
                            <div
                                key={d.name}
                                className="bg-white rounded-2xl overflow-hidden shadow-lg shadow-[#1A2D23]/5 border border-[#E3EADA]"
                            >
                                <div className="relative w-full aspect-[4/3]">
                                    <Image
                                        src={d.image}
                                        alt={d.name}
                                        fill
                                        sizes="(min-width: 1024px) 640px, 100vw"
                                        className="object-cover"
                                    />
                                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full text-xs font-black text-[#1A2D23] shadow">
                                        {d.hook}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-[#FF6B35] text-white px-3 py-1.5 rounded-full text-base font-black shadow-lg">
                                        RM {d.price.toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-4 lg:p-5">
                                    <h3 className="text-lg lg:text-xl font-black leading-tight">{d.name}</h3>
                                    <p className="text-xs lg:text-sm italic text-[#1A2D23]/55 font-semibold mt-0.5">
                                        {d.nameEn}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {d.tags.map((t) => (
                                            <span
                                                key={t}
                                                className="px-2 py-0.5 bg-[#E3EADA] text-[#1A2D23]/85 rounded-full text-[10px] lg:text-xs font-bold"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                    <a
                                        href={wa(d.msg)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => fireLead(`dish_${d.nameEn}`, d.price)}
                                        className="block mt-4 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm lg:text-base shadow-md transition-all active:scale-[0.98]"
                                    >
                                        WhatsApp 订这道 →
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="px-5 py-10 bg-[#E3EADA]/40">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-6 tracking-tight">
                        3 个常见疑问
                    </h2>
                    <div className="space-y-2">
                        {FAQ.map((f, i) => (
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
                        还在想
                        <br />
                        <span className="text-[#FF6B35]">吃什么？</span>
                    </h2>
                    <p className="text-base lg:text-lg font-bold text-[#1A2D23]/65 mb-7 leading-relaxed">
                        WhatsApp 一句「碗妈我想吃饭」就好。
                        <br />
                        碗妈会推荐今天最新鲜的给你。
                    </p>
                    <a
                        href={wa("Hi 碗妈！我想吃饭，推荐我一道今天最新鲜的吧 🔥")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("final_cta")}
                        className="block w-full bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            WhatsApp 碗妈
                        </span>
                    </a>
                </div>
            </section>

            {/* STICKY WA BAR */}
            <a
                href={wa("Hi 碗妈！我从 FB 广告来的，想了解菜单和配送 🔥")}
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
                            WhatsApp 碗妈 · 立即下单
                        </p>
                        <p className="text-[11px] lg:text-xs text-white/60 truncate font-bold">
                            凌晨 6 点采买 · 午晚送达
                        </p>
                    </div>
                    <span className="shrink-0 px-3.5 py-2 lg:px-4 lg:py-2.5 bg-[#FF6B35] text-white rounded-full text-xs lg:text-sm font-black shadow">
                        下单 →
                    </span>
                </div>
            </a>
        </div>
    );
}
