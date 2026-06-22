"use client";

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

const DISHES = [
    {
        name: "Angelica Steamed Whole Chicken Leg",
        nameZh: "招牌原盅当归蒸鸡全腿",
        price: 18.5,
        image: "/angelica_chicken.webp",
        tags: ["Angelica blood tonic", "45g+ protein", "Warming"],
        hook: "BowlMama's signature",
        msg:
            "Hi BowlMama! I came from your FB ad. I'd like to order Angelica Steamed Whole Chicken Leg (RM 18.50) 🔥 Please share delivery time + address details 🙏",
    },
    {
        name: "Soy Sauce Chicken Whole Leg",
        nameZh: "阿嫲古早味酱油鸡全腿",
        price: 18.5,
        image: "/soy_sauce_chicken_leg.webp",
        tags: ["48g+ protein", "Cantonese classic", "Soy-infused"],
        hook: "Grandma's recipe",
        msg:
            "Hi BowlMama! I came from your FB ad. I'd like to order Soy Sauce Chicken Whole Leg (RM 18.50) 🔥 Please share delivery time + address details 🙏",
    },
    {
        name: "Natto Tsukimi Seaweed Rice",
        nameZh: "纳豆月见海苔饭",
        price: 16.9,
        image: "/natto_bowl.webp",
        tags: ["25g+ protein", "Nattokinase", "Stringy & soulful"],
        hook: "Easy starter",
        msg:
            "Hi BowlMama! I came from your FB ad. I'd like to order Natto Tsukimi Seaweed Rice (RM 16.90) 🔥 Please share delivery time + address details 🙏",
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
        return `Hi BowlMama! I came from your FB ad. My address: ${a} (within 5km · RM 3 free over RM 20 within 2.5km / RM 5 free over RM 30 within 2.5–5km ✓). I'd like to see today's / tomorrow's menu 🔥`;
    }
    if (r.tier === "outside") {
        return `Hi BowlMama! My address is ${a} (${r.distanceKm} km away). Can you see if there's a way to deliver? 🙏`;
    }
    return `Hi BowlMama! I came from your FB ad. My address: ${a} (${r.distanceKm} km away · delivery fee RM ${r.fee}). I'd like to see today's / tomorrow's menu 🔥`;
};

const FAQ = [
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
                setCheckError(data.error || "Check failed, please try again");
                return;
            }
            setCheckResult(data);
            fireLead("zone_check");
        } catch {
            setCheckError("Network error, please try again");
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
                        <span>Pearl Point Home Kitchen · Kuala Lumpur</span>
                    </div>
                    <h1 className="text-[42px] lg:text-6xl font-black leading-[1.02] tracking-tight mb-3">
                        Tastes like home,
                        <br />
                        <span className="text-[#FF6B35]">lunch + dinner.</span>
                    </h1>
                    <p className="text-lg lg:text-2xl font-black text-[#1A2D23]/80 leading-snug mb-2">
                        6 AM market run · no MSG
                    </p>
                    <p className="text-base lg:text-lg text-[#1A2D23]/60 font-bold mb-7">
                        <span className="text-[#1A2D23] font-black">From RM 16.90</span> · Within 2.5km RM 3 (free over RM 20) / 2.5–5km free over RM 30 · Fresh-cooked
                    </p>

                    <a
                        href={wa("Hi BowlMama! I came from your FB ad and want to learn about today's / tomorrow's menu and delivery details 🔥")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("hero_cta")}
                        className="group relative block w-full text-center bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="absolute inset-0 rounded-2xl bg-[#25D366] animate-ping opacity-20" />
                        <span className="relative flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            WhatsApp to order
                        </span>
                        <span className="relative block text-[11px] lg:text-xs font-bold opacity-90 mt-1">
                            No signup · No app · 5 seconds
                        </span>
                    </a>

                    <div className="grid grid-cols-3 gap-2 mt-6">
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">10+</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">Neighbour reviews</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">2x</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">Lunch + Dinner</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl lg:text-3xl font-black text-[#FF6B35] leading-none">0</p>
                            <p className="text-[10px] lg:text-xs font-bold text-[#1A2D23]/60 mt-1.5">MSG added</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ZONE CHECK */}
            <section className="px-5 py-9 bg-white border-y border-[#E3EADA]">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        Where are you?
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-5">
                        Quick 30-second check on your delivery tier
                    </p>

                    <form onSubmit={checkDelivery} className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="street-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="e.g. Pearl Suria, OUG Parklane, 58200..."
                                aria-label="Enter your address or postcode"
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
                                    aria-label="Clear"
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
                                    Checking
                                </>
                            ) : (
                                <>
                                    <Search size={16} strokeWidth={2.75} />
                                    Check
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
                                Delivery fee RM {checkResult.fee} · {checkResult.distanceKm} km away
                            </p>
                            <p className="text-xs text-amber-800/80 mt-1.5 font-bold">
                                Spend <span className="font-black">RM {checkResult.threshold}</span> for <span className="font-black">free delivery</span>
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
                                WhatsApp to see menu →
                            </a>
                        </div>
                    )}

                    {checkResult && (checkResult.tier === "mid" || checkResult.tier === "far") && (
                        <div className="mt-4 p-4 rounded-2xl bg-orange-50 border-2 border-orange-200">
                            <p className="text-base font-black text-orange-800 flex items-center gap-1.5">
                                <Truck size={18} strokeWidth={2.5} />
                                Delivery fee RM {checkResult.fee} · {checkResult.distanceKm} km away
                            </p>
                            <p className="text-xs text-orange-800/80 mt-1.5 font-bold">
                                Spend <span className="font-black">RM {checkResult.threshold}</span> to drop delivery fee to <span className="font-black">RM {checkResult.feeAtThreshold}</span>
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
                                WhatsApp to see menu →
                            </a>
                        </div>
                    )}

                    {checkResult && checkResult.tier === "outside" && (
                        <div className="mt-4 p-4 rounded-2xl bg-gray-50 border-2 border-gray-200">
                            <p className="text-sm font-black text-gray-700">
                                Sorry — your address is {checkResult.distanceKm} km away, out of our delivery range
                            </p>
                            <a
                                href={wa(tierWaMsg(checkResult, address))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => fireLead("zone_result_outside")}
                                className="inline-flex items-center gap-1.5 mt-2 text-sm font-black text-green-700 hover:text-green-800"
                            >
                                WhatsApp to ask anyway →
                            </a>
                        </div>
                    )}
                </div>
            </section>

            {/* DISHES */}
            <section className="px-5 py-12">
                <div className="max-w-md lg:max-w-2xl mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-black text-center mb-1 tracking-tight">
                        On the menu today / tomorrow
                    </h2>
                    <p className="text-sm lg:text-base font-bold text-center text-[#1A2D23]/55 mb-7">
                        Pick one, WhatsApp away
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
                                        {d.nameZh}
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
                                        onClick={() => fireLead(`dish_${d.name}`, d.price)}
                                        className="block mt-4 bg-[#25D366] hover:bg-[#20BE5A] text-white text-center py-3.5 rounded-xl font-black text-sm lg:text-base shadow-md transition-all active:scale-[0.98]"
                                    >
                                        WhatsApp this one →
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
                        3 quick FAQs
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
                        Still deciding
                        <br />
                        <span className="text-[#FF6B35]">what to eat?</span>
                    </h2>
                    <p className="text-base lg:text-lg font-bold text-[#1A2D23]/65 mb-7 leading-relaxed">
                        Just WhatsApp &ldquo;BowlMama, I&apos;m hungry&rdquo;.
                        <br />
                        She&apos;ll recommend today&apos;s freshest catch.
                    </p>
                    <a
                        href={wa("Hi BowlMama! I'm hungry — recommend today's freshest please 🔥")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => fireLead("final_cta")}
                        className="block w-full bg-[#25D366] hover:bg-[#20BE5A] text-white py-5 px-6 rounded-2xl shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition-all active:scale-[0.98]"
                    >
                        <span className="flex items-center justify-center gap-3 text-lg lg:text-xl font-black">
                            <WaIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                            WhatsApp BowlMama
                        </span>
                    </a>
                </div>
            </section>

            {/* STICKY WA BAR */}
            <a
                href={wa("Hi BowlMama! I came from your FB ad and want to know more about the menu and delivery 🔥")}
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
                            WhatsApp BowlMama · Order now
                        </p>
                        <p className="text-[11px] lg:text-xs text-white/60 truncate font-bold">
                            6 AM market run · lunch + dinner
                        </p>
                    </div>
                    <span className="shrink-0 px-3.5 py-2 lg:px-4 lg:py-2.5 bg-[#FF6B35] text-white rounded-full text-xs lg:text-sm font-black shadow">
                        Order →
                    </span>
                </div>
            </a>
        </div>
    );
}
