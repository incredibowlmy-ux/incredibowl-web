"use client";

import React, { useEffect, useState } from 'react';
import { CheckCircle, Ticket } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';
import type { CartBundle } from '@/types';

interface CartSuccessProps {
    // Snapshot taken at submit time — the live cart is cleared the moment
    // the order succeeds, so this screen must not read from it.
    orderSuccess: { id: string; items: CartBundle[]; total: number; trackInfo?: { token: string; date: string; time: string }[] };
    userProfile?: any;
    /**
     * FPX 回跳成功（2026-09-05 F3）：银行跳回来时购物车早已清空，只有下单前存在
     * localStorage 的快照 summary（菜名 / 份数 / 日期 / 加料），没有 cart item。
     * 传了它就按「已付款、已确认」渲染：标题换成 FPX 成功、不再显示「碗妈正在核对
     * 截图」、明细走这份 summary。total 为 null = 快照丢了（换浏览器付的），只报成功不报金额。
     */
    fpx?: {
        items: { name: string; nameEn?: string; qty: number; date: string; addOns?: string[]; addOnsEn?: string[] }[];
        total: number | null;
    };
    onDone: () => void;
    locale?: Locale;
    // Firebase auth user (may be anonymous / null for guests). Used to
    // re-fetch the *post-order* voucher balance — the drawer's cached count
    // is stale once this order has consumed vouchers.
    currentUser?: any;
    // Whether this order redeemed any meal vouchers — lets us surface the
    // balance card even when the customer just depleted their wallet to 0.
    voucherUsed?: boolean;
}

interface VoucherBalance {
    availableCount: number;
    soonestDaysLeft: number | null;
}

const WHATSAPP_NUMBER = '60165119118';

// Pixel tracking moved to CartDrawer where we have access to the
// CAPI event IDs returned by /api/submit-order and /api/confirm-order
// — needed to deduplicate browser events against the server-side
// Conversions API events fired from those routes.
export default function CartSuccess({ orderSuccess, userProfile, onDone, locale = 'zh', currentUser, voucherUsed, fpx }: CartSuccessProps) {
    const t = CART_DICT[locale].success;
    const voucherHrefUpsell = locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers';
    // 访客 → Google 绑定的结果提示（原来在首页的 FPX overlay 里，现在 QR / FPX 都有）
    const [linkNotice, setLinkNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
    const linkGoogle = async () => {
        try {
            const { linkGuestToGoogle } = await import('@/lib/auth');
            await linkGuestToGoogle();
            setLinkNotice({ kind: 'ok', text: t.linkOk });
        } catch (e: any) {
            setLinkNotice({ kind: 'err', text: e?.code === 'auth/credential-already-in-use' ? t.linkErrInUse : t.linkErrGeneric });
        }
    };
    const fpxItemName = (it: { name: string; nameEn?: string; addOns?: string[]; addOnsEn?: string[] }) => {
        const base = locale === 'en' ? (it.nameEn || it.name) : it.name;
        const addOns = locale === 'en' ? (it.addOnsEn || it.addOns) : it.addOns;
        return addOns?.length ? `${base} + ${addOns.join(' + ')}` : base;
    };
    const { id, items, total, trackInfo } = orderSuccess;

    // Logged-in, non-anonymous customer → they own an account with orders +
    // (possibly) a voucher wallet. Guests (anonymous / null) get neither the
    // balance recap nor the "my orders" link (member page needs a real login).
    const isMember = !!currentUser && !currentUser.isAnonymous;
    const memberHref = locale === 'en' ? '/en/member' : '/member';
    const voucherHref = locale === 'en' ? '/en/meal-vouchers' : '/meal-vouchers';

    // Post-order voucher balance — fetched fresh here (the drawer's cached
    // count predates this order's redemption, so it would over-report).
    const [balance, setBalance] = useState<VoucherBalance | null>(null);
    useEffect(() => {
        if (!isMember) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch('/api/my-meal-vouchers', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                setBalance({
                    availableCount: data.availableCount || 0,
                    soonestDaysLeft: data.soonestDaysLeft ?? null,
                });
            } catch {
                /* best-effort: a failed balance fetch just hides the card */
            }
        })();
        return () => { cancelled = true; };
    }, [isMember, currentUser]);

    // Show the wallet recap only to actual voucher customers: those who still
    // hold vouchers, or who just spent their last ones on this order. A
    // never-voucher customer sees nothing (no unsolicited upsell here).
    const showVoucherCard = !!balance && (balance.availableCount > 0 || !!voucherUsed);
    const lowBalance = !!balance && balance.availableCount <= 2; // renew nudge threshold
    const isGroup = id.startsWith('GRP');
    const displayId = isGroup ? id : id.slice(-6).toUpperCase();
    // 渲染层菜名：EN 显示 nameEn 兜底 name；订单 payload 早已提交，不受影响。
    const dishName = (item: CartBundle) => (locale === 'en'
        ? (item.dish?.nameEn || item.dish?.name || '')
        : (item.dish?.name || ''));

    // Tracking links (one per delivery) — absolute URLs so they survive
    // inside the customer's own WhatsApp chat as their receipt.
    const multiTrack = (trackInfo || []).length > 1;
    // EN 客户拿到的 track 链接带 ?lang=en，打开即英文（页内切换仍可换回）
    const trackQuery = locale === 'en' ? '?lang=en' : '';
    const trackLines = (trackInfo || []).map(tr =>
        t.waTrack(multiTrack, tr.date, t.mealWord(tr.time), `https://www.incredibowl.my/track/${tr.token}${trackQuery}`));

    const waText = (fpx
        ? [
            t.waIntroPaid,
            t.waOrderNo(isGroup, displayId),
            ...fpx.items.map(it => t.waItemPaid(fpxItemName(it), it.qty, it.date)),
            ...(fpx.total != null ? [t.waPaid(fpx.total.toFixed(2))] : []),
            ...trackLines,
        ]
        : [
            t.waIntro,
            t.waOrderNo(isGroup, displayId),
            ...items.map((item) =>
                t.waItem(dishName(item), (item.dishQty || 1) * (item.quantity || 1), item.selectedDate || t.dateTbdWa, t.mealWord(item.selectedTime))),
            `💰 RM ${total.toFixed(2)}`,
            ...trackLines,
        ]).join('\n');
    const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-[#FDFBF7] h-full shadow-2xl flex flex-col items-center justify-center border-l border-[#E3EADA] overflow-y-auto">
                <div className="text-center space-y-5 p-8 animate-in zoom-in-95 duration-500 w-full">
                    <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle size={48} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black text-[#1A2D23]">{fpx ? t.fpxTitle : t.title}</h2>
                    <p className="text-gray-500 flex flex-col items-center gap-1">
                        <span>
                            {t.orderIdLabel(isGroup)}
                            <span className="font-bold text-[#FF6B35]">#{displayId}</span>
                        </span>
                        {isGroup && (
                            <span className="text-[10px] font-bold text-[#FF6B35]/70 bg-[#FF6B35]/10 px-2 py-0.5 rounded-full mt-1">
                                {t.groupSplitNote}
                            </span>
                        )}
                    </p>
                    {fpx ? (
                        (fpx.items.length > 0 || fpx.total != null) && (
                            <div className="bg-white rounded-2xl p-4 border border-[#E3EADA] text-left text-sm text-gray-600 space-y-1">
                                {fpx.items.map((it, i) => (
                                    <div key={i} className="flex justify-between gap-3">
                                        <span>{fpxItemName(it)} ×{it.qty}</span>
                                        <span className="text-gray-400 whitespace-nowrap">{it.date}</span>
                                    </div>
                                ))}
                                {fpx.total != null && (
                                    <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5 font-bold text-[#1A2D23]">
                                        <span>{t.paidTotal}</span>
                                        <span>RM {fpx.total.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="bg-white rounded-2xl p-5 border border-[#E3EADA] text-left space-y-2">
                            <p className="text-sm">
                                <span className="font-bold">{t.deliveryPlan}</span>
                                <span className="text-[#FF6B35] font-black">
                                    {isGroup
                                        ? t.multiDay
                                        : `${items[0]?.selectedDate || t.dateTbd} ${items[0]?.selectedTime?.includes('Lunch') ? t.lunchEmoji : t.dinnerEmoji}`}
                                </span>
                            </p>
                            <p className="text-sm"><span className="font-bold">{t.addressLabel}</span>{userProfile?.address}</p>
                            <p className="text-sm"><span className="font-bold">{t.amountLabel}</span><span className="text-[#FF6B35] font-black">RM {total.toFixed(2)}</span></p>
                        </div>
                    )}

                    {/* Voucher balance recap — the post-order moment is the prime
                        "should I renew?" trigger for voucher customers. */}
                    {showVoucherCard && balance && (
                        <div className="bg-gradient-to-br from-[#FFF3E0] to-[#FFE9D5] rounded-2xl p-4 border border-[#FFD6B0]/70 text-left">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-[#1A2D23] flex items-center gap-1.5">
                                    <Ticket size={16} className="text-[#FF6B35]" />
                                    {t.voucherBalanceLabel}
                                </span>
                                <span className="text-2xl font-black text-[#FF6B35] leading-none">
                                    {balance.availableCount}
                                    <span className="text-xs font-bold text-[#1A2D23]/50 ml-1">{t.voucherUnit}</span>
                                </span>
                            </div>
                            {balance.availableCount > 0 && balance.soonestDaysLeft !== null && balance.soonestDaysLeft <= 7 && (
                                <p className="text-[11px] text-red-500 font-bold mt-2">{t.voucherExpiryWarn(balance.soonestDaysLeft)}</p>
                            )}
                            {balance.availableCount === 0 && (
                                <p className="text-[11px] text-[#E65100] font-bold mt-2">{t.voucherDepleted}</p>
                            )}
                            {lowBalance && (
                                <a
                                    href={voucherHref}
                                    className="mt-3 flex items-center justify-between w-full px-3 py-2 bg-white border border-[#FF6B35]/40 rounded-xl hover:bg-[#FF6B35]/5 transition-colors"
                                >
                                    <span className="text-[11px] text-[#1A2D23]/60 font-bold">{t.voucherRenewSub}</span>
                                    <span className="text-xs text-[#FF6B35] font-black whitespace-nowrap ml-2">{t.voucherRenewCta}</span>
                                </a>
                            )}
                        </div>
                    )}

                    {fpx ? (
                        <p className="text-xs text-gray-400">{t.fpxConfirmedNote}</p>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-[#FF6B35] animate-pulse">{t.verifying}</p>
                            <p className="text-xs text-gray-400">{t.verifiedNote}</p>
                        </>
                    )}

                    {/* WhatsApp confirmation deep link — puts a copy of the order
                        in the customer's own chat (their receipt) and opens the
                        private-domain channel in one tap. Message is prefilled;
                        they only press send. */}
                    <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3.5 bg-[#25D366] text-white rounded-xl text-sm font-black hover:bg-[#1EBE57] transition-colors shadow-lg shadow-[#25D366]/25"
                    >
                        {t.waButton}
                    </a>
                    {(trackInfo || []).length > 0 && (
                        <div className="space-y-2">
                            {(trackInfo || []).map((tr) => (
                                <a
                                    key={tr.token}
                                    href={`/track/${tr.token}${trackQuery}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-3 btn-secondary text-sm font-black"
                                >
                                    {t.trackBtn(multiTrack, tr.date, t.mealWord(tr.time))}
                                </a>
                            ))}
                        </div>
                    )}
                    {/* Feedback 2A: point customers to the (already-existing)
                        order history in the member centre. */}
                    {isMember && (
                        <a
                            href={memberHref}
                            className="block w-full py-3 bg-white border-2 border-[#E3EADA] text-[#1A2D23] rounded-xl text-sm font-black hover:border-[#FF6B35]/40 hover:text-[#FF6B35] transition-colors"
                        >
                            {t.viewMyOrders}
                        </a>
                    )}
                    {/* Guest → Google upgrade: link in place, SAME uid, order history
                        preserved. Only shown to anonymous guests. */}
                    {currentUser?.isAnonymous && (
                        <button
                            type="button"
                            onClick={linkGoogle}
                            className="block w-full py-3 bg-[#1A2D23] text-white rounded-2xl text-sm font-bold hover:bg-[#2A3D33] transition-colors"
                        >
                            {t.linkGoogleBtn}
                        </button>
                    )}
                    {linkNotice && (
                        <p className={`px-3 py-2 rounded-lg text-[11px] font-bold leading-relaxed text-left ${linkNotice.kind === 'ok'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-700'}`}>
                            {linkNotice.text}
                        </p>
                    )}
                    {/* 餐券轻量 upsell：只在 FPX（已付款）这条路上，和以前一样。 */}
                    {fpx && !showVoucherCard && (
                        <a
                            href={voucherHrefUpsell}
                            className="block bg-[#FFF3E0]/60 border border-[#FFD6B0]/60 rounded-xl px-4 py-2.5 text-xs font-bold text-[#1A2D23]/70 hover:border-[#FF6B35]/50 hover:text-[#1A2D23] transition-colors"
                        >
                            {t.voucherUpsellPre}<span className="text-[#FF6B35]">{t.voucherUpsellCta}</span>
                        </a>
                    )}
                    <button
                        onClick={onDone}
                        className="w-full py-2.5 text-sm font-bold text-gray-400 hover:text-[#1A2D23] transition-colors"
                    >
                        {t.done}
                    </button>
                </div>
            </div>
        </div>
    );
}
