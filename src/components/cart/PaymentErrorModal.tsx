"use client";

import React, { useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';
import { useModalA11y } from '@/components/ui/useModalA11y';

/**
 * FPX 回跳失败弹窗（取代首页里 ZH / EN 各一套硬编码的失败 overlay，2026-09-05 F3）。
 *
 * 为什么是弹窗不是 alert（沿用 08 月的理由）：客户刚从银行页回来最慌的那一秒，
 * 不该吃一个顶着域名前缀、文字选不中的系统灰框。支付编号可一键复制 + 一键发给碗妈。
 *
 * 文案全部走 cart/dict.ts 的 paymentError；三种失败由调用方选 kind。
 */
export type PaymentErrorKind = 'fpxNotCompleted' | 'verifyFailed' | 'confirmFailed';

export interface PaymentErrorInfo {
    kind: PaymentErrorKind;
    paymentId?: string;
}

const MAMA_WHATSAPP = '60103370197';

export default function PaymentErrorModal({
    error,
    onClose,
    locale = 'zh',
}: {
    error: PaymentErrorInfo;
    onClose: () => void;
    locale?: Locale;
}) {
    const t = CART_DICT[locale].paymentError;
    const [copied, setCopied] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    useModalA11y({ open: true, onClose, panelRef });

    const msg = t[error.kind];
    const waHref = error.paymentId
        ? `https://wa.me/${MAMA_WHATSAPP}?text=${encodeURIComponent(`${t.waPrefix}\n${msg}\n${t.waIdLine(error.paymentId)}`)}`
        : '';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="payment-error-title"
                className="bg-white rounded-3xl p-7 text-center max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={36} className="text-red-500" />
                </div>
                <h3 id="payment-error-title" className="text-xl font-black text-ink mb-2">{msg}</h3>
                {error.paymentId ? (
                    <>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">{t.maybeCharged}</p>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
                            <span className="text-[10px] font-medium text-gray-400 shrink-0">{t.paymentIdLabel}</span>
                            <code className="flex-1 min-w-0 truncate text-[11px] font-bold text-ink text-left">{error.paymentId}</code>
                            <button
                                type="button"
                                onClick={() => { navigator.clipboard?.writeText(error.paymentId!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }}
                                className="shrink-0 min-h-[36px] px-3 rounded-lg bg-ink text-white text-[11px] font-bold"
                            >
                                {copied ? t.copied : t.copy}
                            </button>
                        </div>
                        <a
                            href={waHref}
                            target="_blank" rel="noopener noreferrer"
                            className="block w-full py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-black hover:bg-[#1EBE57] transition-colors"
                        >
                            {t.waSend}
                        </a>
                    </>
                ) : (
                    <p className="text-xs text-gray-500 leading-relaxed">{t.notCharged}</p>
                )}
                <button onClick={onClose} className="mt-4 min-h-[44px] px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors">{t.close}</button>
            </div>
        </div>
    );
}
