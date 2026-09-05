"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ArrowRight, CalendarCheck, Star, Ticket } from 'lucide-react';
import { weeklyMenu, dishImageAlt, signatureDish } from '@/data/weeklyMenu';
import { getPromoDiscount } from '@/data/promoConfig';
// Single source of truth for "next special" (MYT-anchored, skips weekends,
// excludes retired dishes, honours isPrimary). The EN Hero previously kept its
// own copy that treated `id` as the weekday — which surfaced the retired
// 酱油鸡 (id 1) every Monday. Share the lib version so the two never drift again.
import { computeNextSpecial, type NextSpecial } from '@/lib/nextSpecial';
import { GOOGLE_REVIEW_COUNT } from '@/data/googleReviews';
import type { Locale } from '@/lib/locale';
import { HOME_DICT } from './dict';

// Single fixed hero backdrop. Was an 8-second rotation through every dish in
// weeklyMenu — on mobile each swap pulled a fresh ~130KB optimised image at
// sizes="100vw", so a couple of minutes on the page cost ~2MB for a backdrop
// that sits at opacity 0.18 behind two scrims and is, per the owner, "can't
// really see at mobile". One image, one request, priority-loaded as the LCP
// anchor. Resolved at module scope from build-time constants — never per render.
// Shared by both locales so they hit the same optimised image cache entry.
const HERO_BG =
    (signatureDish.image.startsWith('/')
        ? signatureDish
        : weeklyMenu.find(d => !d.hidden && !d.retired && d.image.startsWith('/')))?.image ?? null;

export default function HeroSection({ locale }: { locale: Locale }) {
    const t = HOME_DICT[locale].heroSection;
    // Computed client-side: the page is statically prerendered, and the special
    // is date-dependent, so computing it during render would bake the build-day
    // special into the static HTML and mismatch on hydration the next day. The
    // stable LCP anchor is instead the date-independent hero backdrop below.
    const [nextSpecial, setNextSpecial] = useState<NextSpecial | null>(null);

    useEffect(() => {
        setNextSpecial(computeNextSpecial());
    }, []);

    const scrollToMenu = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });

    const discount = getPromoDiscount();
    // Fall back to the signature dish price (not 0) so the prerendered HTML shows
    // a real "RM 18.50" instead of "RM 0.00" to crawlers/AI before hydration.
    const finalPrice = (nextSpecial?.dish.price ?? signatureDish.price) - discount;

    return (
        <>
            {/* Hero Bento 1: Brand Statement + Primary CTA */}
            <div className="lg:col-span-7 bg-[#E3EADA] rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[460px]">
                {/* Background image — pushed to right side, much dimmer */}
                <div className="absolute inset-0 pointer-events-none">
                    {HERO_BG && (
                        <div className="absolute inset-0">
                            {/* ⚠️ sizes 必须如实描述元素的渲染宽度，不是「这张图我多想省」。
                                这个容器在 lg 以下是满宽的（lg:col-span-7 只在 lg+ 生效），
                                手机上实测渲染 358px ≈ 92vw。之前钉死 60vw 等于谎报：
                                priority 生成的 preload 按 60vw 抓了 w=256，元素实际用
                                w=828 → 那张 256w 白下载，console 报 "preloaded but not
                                used"。想省字节要用 quality / 换图，别拿 sizes 撒谎。 */}
                            <Image src={HERO_BG} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover object-right mix-blend-multiply opacity-[0.18]" priority />
                        </div>
                    )}
                    {/* Strong left-side scrim so text area is always readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E3EADA] from-30% via-[#E3EADA]/85 via-60% to-[#E3EADA]/40 z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#E3EADA] via-[#E3EADA]/20 to-transparent z-10" />
                </div>

                <div className="relative z-20 max-w-xl lg:max-w-2xl">
                    {/* Trust badges row */}
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        {/* Location badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/70 backdrop-blur-md rounded-full text-xs font-bold text-[#1A2D23] shadow-sm">
                            <MapPin size={12} className="text-[#FF6B35]" />
                            <span>{t.locationBadge}</span>
                            <span className="text-[#1A2D23]/40">·</span>
                            <span className="text-[#1A2D23]/70">{t.locationSub}</span>
                        </div>
                        {/* Social proof badge → scrolls to feedback section */}
                        <button
                            type="button"
                            onClick={() => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF6B35]/15 text-[#C84518] rounded-full text-xs font-bold shadow-sm hover:bg-[#FF6B35]/25 transition-colors active:scale-95"
                        >
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            <span>{GOOGLE_REVIEW_COUNT}{t.reviewsSuffix}</span>
                        </button>
                    </div>

                    {/* Main title — page H1 (was H2; brand name in NavBar should not be H1).
                        zh: H1 + 行动副标题两段；en: 英文 H1 + 中文小字，再英文副标题 + 中文小字
                        （C1 合并按 locale 原样保留，两边 mb-* 间距也各自不同）。 */}
                    {locale === 'en' ? (
                        <>
                            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-2 text-[#1A2D23] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                                Home-cooked taste,<br />
                                sourced fresh daily.
                            </h1>
                            <p lang="zh" className="text-base md:text-lg font-bold text-[#1A2D23]/65 tracking-wide mb-8">
                                家的味道，每天新鲜采购
                            </p>

                            <p className="text-2xl md:text-3xl font-black text-[#1A2D23]/95 leading-snug tracking-tight mb-3 max-w-md lg:max-w-xl">
                                At the market by <span className="text-[#FF6B35]">6 AM</span>,<br className="md:hidden" />
                                at your door by noon.
                            </p>
                            <p lang="zh" className="text-[13px] md:text-sm font-semibold text-[#1A2D23]/55 leading-relaxed mb-8 max-w-md lg:max-w-xl">
                                凌晨 6 点去巴刹，中午送到你手上
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 lang="zh" className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6 text-[#1A2D23] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                                家的味道，<br />
                                每天新鲜采购。
                            </h1>

                            {/* Action-anchored sub-headline — promoted from body copy to bridge brand slogan ↔ CTA */}
                            <p lang="zh" className="text-2xl md:text-3xl font-black text-[#1A2D23]/95 leading-snug tracking-tight mb-7 max-w-md lg:max-w-xl">
                                凌晨 <span className="text-[#FF6B35]">6 点</span>去巴刹，<br className="md:hidden" />
                                中午送到你手上。
                            </p>
                        </>
                    )}

                    {/* CTA pair: 1 primary orange + 1 secondary outlined WhatsApp (Sonner/Linear/Vercel pattern) */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Primary CTA — prominent orange.
                            zh/en 的 padding / 阴影 / hover:scale 类名历史上就不同，按 locale 原样保留。 */}
                        <div className="relative inline-block group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B35]/60 to-[#FF9B50]/60 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-500 animate-breathe" />
                            <button
                                type="button"
                                onClick={scrollToMenu}
                                className={locale === 'en'
                                    ? "relative inline-flex items-center gap-3 pl-7 pr-3 py-3 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full font-black text-base md:text-lg shadow-xl shadow-[#FF6B35]/30 transition-[transform,background-color,box-shadow] duration-200 ease-out transform group-hover:-translate-y-0.5 active:scale-[0.97] active:brightness-95"
                                    : "relative inline-flex items-center gap-3 pl-8 pr-3 py-3.5 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-full font-black text-base md:text-lg shadow-[0_10px_28px_-8px_rgba(255,107,53,0.55)] hover:shadow-[0_14px_32px_-6px_rgba(255,107,53,0.65)] transition-[transform,background-color,box-shadow] duration-200 ease-out transform group-hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.97] active:brightness-95"}
                            >
                                {locale === 'en' ? (
                                    <span className="tracking-tight">{t.primaryCta}</span>
                                ) : (
                                    <>
                                        <span lang="zh" className="tracking-tight">{t.primaryCta}</span>
                                        <span lang="en" className="hidden md:inline text-sm font-bold text-white/80">· See Tomorrow&apos;s Menu</span>
                                    </>
                                )}
                                <span className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white flex items-center justify-center text-[#FF6B35] shadow-md">
                                    <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                                </span>
                            </button>
                        </div>

                        {/* Secondary CTA — outlined WhatsApp (low contrast, supporting role) */}
                        <a
                            href={t.whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-transparent border-2 border-[#1A2D23]/15 hover:border-[#1A2D23]/35 hover:bg-white/40 text-[#1A2D23] rounded-full font-bold text-sm transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.97]"
                        >
                            <svg viewBox="0 0 32 32" className="w-4 h-4 fill-[#25D366]" aria-hidden="true">
                                <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.638 3.41 4.673 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.49-1.318.158-.386.216-.815.216-1.231 0-.817-.27-.99-.974-1.318-.388-.198-1.005-.43-1.477-.687zM16.205 28.997c-2.262 0-4.49-.617-6.418-1.792l-.46-.273-4.762 1.247 1.273-4.633-.302-.476a12.652 12.652 0 0 1-1.946-6.747c0-7 5.674-12.673 12.673-12.673 3.387 0 6.57 1.32 8.96 3.71a12.595 12.595 0 0 1 3.7 8.97c0 7.001-5.778 12.667-12.776 12.667zm10.79-23.461A14.864 14.864 0 0 0 16.207 1.205C7.965 1.205 1.252 7.918 1.236 16.16c0 2.64.69 5.215 2 7.49l-2.131 7.79 7.97-2.09a15.122 15.122 0 0 0 7.122 1.817h.014c8.244 0 15.07-6.713 15.07-14.957 0-3.998-1.65-7.752-4.487-10.575z"/>
                            </svg>
                            {locale === 'en' ? <span>{t.whatsappCta}</span> : <span lang="zh">{t.whatsappCta}</span>}
                        </a>

                        {/* Tertiary CTA — meal voucher bundles (outlined, below primary in hierarchy) */}
                        <Link
                            href={locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers'}
                            className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 bg-white/50 border-2 border-[#FF6B35]/25 hover:border-[#FF6B35]/60 hover:bg-white/70 text-[#1A2D23] rounded-full font-bold text-sm transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.97]"
                        >
                            <Ticket size={15} className="text-[#FF6B35]" />
                            {locale === 'en' ? <span>{t.voucherCta}</span> : <span lang="zh">{t.voucherCta}</span>}
                        </Link>
                    </div>

                    {/* Delivery fees intentionally NOT shown here: the NavBar marquee
                        (both breakpoints) and the DeliveryWidget right below the hero
                        already carry the full tier table — keep the hero on brand + CTA. */}
                </div>
            </div>

            {/* Hero Bento 2: Tomorrow's Special preview */}
            <div className="lg:col-span-5">
                <button
                    type="button"
                    onClick={scrollToMenu}
                    className="group w-full text-left bg-white rounded-[32px] overflow-hidden shadow-lg shadow-[#1A2D23]/5 border border-[#1A2D23]/5 hover:shadow-2xl hover:shadow-[#FF6B35]/10 hover:-translate-y-1 transition-[transform,box-shadow] duration-300 ease-out active:scale-[0.99] flex flex-col h-full min-h-[460px]"
                >
                    {/* Image area */}
                    <div className="relative w-full h-56 md:h-64 lg:h-72 overflow-hidden bg-[#E3EADA]">
                        {nextSpecial && (
                            nextSpecial.dish.image.startsWith('/') ? (
                                <Image
                                    src={nextSpecial.dish.image}
                                    alt={dishImageAlt(nextSpecial.dish, locale)}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    sizes="(min-width: 1024px) 33vw, 100vw"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-7xl">{nextSpecial.dish.image}</div>
                            )
                        )}
                        {/* Top label */}
                        <div className="absolute top-4 left-4 z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2D23] text-white rounded-full shadow-md">
                                <CalendarCheck size={13} strokeWidth={3} />
                                <span className="text-xs font-black tracking-wider uppercase">
                                    {nextSpecial?.labelEn ?? "TOMORROW'S SPECIAL"}
                                </span>
                            </div>
                        </div>
                        {/* Date pill bottom-right */}
                        {nextSpecial && (
                            <div className="absolute bottom-3 right-3 z-10">
                                <span className="inline-block px-2.5 py-1 bg-white/90 backdrop-blur-sm text-[#1A2D23] rounded-full text-xs font-black tracking-wide shadow-md">
                                    {locale === 'en' ? nextSpecial.dateLineEn : nextSpecial.dateLine}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 p-6 md:p-7 flex flex-col">
                        <p className="text-xs font-medium text-[#FF6B35] tracking-[0.2em] uppercase mb-2">
                            {locale === 'en'
                                ? <>{nextSpecial?.labelEn.replace("'S SPECIAL", "").replace(" SPECIAL", "").toLowerCase().replace(/^./, c => c.toUpperCase()) ?? "Tomorrow"} pick</>
                                : (nextSpecial?.labelZh ?? '明日特餐')}
                        </p>
                        {/* zh: 中文名 H2 + 英文名副标；en: 英文名 H2 + 中文名副标（lang="zh"） */}
                        {locale === 'en' ? (
                            <>
                                <h2 className="text-xl md:text-2xl font-black text-[#1A2D23] leading-tight mb-1">
                                    {nextSpecial?.dish.nameEn ?? signatureDish.nameEn}
                                </h2>
                                <p lang="zh" className="text-xs md:text-sm font-semibold text-[#1A2D23]/55 italic mb-4">
                                    {nextSpecial?.dish.name ?? signatureDish.name}
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl md:text-2xl font-black text-[#1A2D23] leading-tight mb-1">
                                    {nextSpecial?.dish.name ?? signatureDish.name}
                                </h2>
                                <p className="text-xs md:text-sm font-semibold text-[#1A2D23]/55 italic mb-4">
                                    {nextSpecial?.dish.nameEn ?? signatureDish.nameEn}
                                </p>
                            </>
                        )}

                        {/* Tags */}
                        {nextSpecial && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {(locale === 'en' ? (nextSpecial.dish.tagsEn ?? nextSpecial.dish.tags) : nextSpecial.dish.tags).slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-[#E3EADA] text-[#1A2D23]/85 rounded-full text-xs font-bold">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Chef's note — fills bottom whitespace, gives card more soul */}
                        {locale === 'en' ? (
                            nextSpecial?.dish.descEn && (
                                <p className="hidden lg:block text-[13px] text-[#1A2D23]/65 leading-relaxed italic mb-5 line-clamp-3">
                                    &ldquo;{nextSpecial.dish.descEn}&rdquo;
                                </p>
                            )
                        ) : (
                            nextSpecial?.dish.desc && (
                                <p className="hidden lg:block text-[13px] text-[#1A2D23]/65 leading-relaxed italic mb-5 line-clamp-3">
                                    &ldquo;{nextSpecial.dish.desc}&rdquo;
                                </p>
                            )
                        )}

                        {/* Mobile/Tablet: price + circle arrow (preserved) */}
                        <div className="mt-auto flex items-end justify-between pt-3 border-t border-[#1A2D23]/8 lg:hidden">
                            <p className="text-2xl md:text-3xl font-black text-[#FF6B35] tracking-tight leading-none">
                                RM {finalPrice.toFixed(2)}
                            </p>
                            <div className="w-11 h-11 rounded-full bg-[#1A2D23] flex items-center justify-center text-white group-hover:bg-[#FF6B35] group-hover:scale-110 transition-[transform,background-color] duration-300 ease-out shrink-0">
                                <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>

                        {/* Desktop: price + full-width secondary CTA (dark green) — pairs with primary orange CTA on left */}
                        <div className="hidden lg:flex mt-auto flex-col gap-3.5 pt-3 border-t border-[#1A2D23]/8">
                            <p className="text-3xl font-black text-[#FF6B35] tracking-tight leading-none">
                                RM {finalPrice.toFixed(2)}
                            </p>
                            <span className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1A2D23] group-hover:bg-[#243A2D] text-white rounded-xl text-[15px] font-black shadow-md shadow-[#1A2D23]/15 group-hover:shadow-lg group-hover:shadow-[#1A2D23]/25 transition-[background-color,box-shadow] duration-200 ease-out">
                                {t.seeSpecial}
                                <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                            </span>
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
}
