"use client";

import React from 'react';
import Image from 'next/image';
import { CheckCircle, Loader2, Plus } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { CART_DICT } from './dict';

interface QRPaymentSectionProps {
    receiptUploaded: boolean;
    receiptUrl: string;
    uploading: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    locale?: Locale;
}

export default function QRPaymentSection({ receiptUploaded, receiptUrl, uploading, onUpload, locale = 'zh' }: QRPaymentSectionProps) {
    const t = CART_DICT[locale].qr;
    return (
        <div className="space-y-2 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl border border-line p-2 max-w-[200px] mx-auto shadow-sm">
                <Image src="/duitnow_qr.png" alt="DuitNow QR - INCREDIBOWL SERVICES" width={400} height={550} className="w-full h-auto rounded-lg" />
            </div>

            <div className="bg-[#F5F3EF] rounded-lg px-3 py-2 text-[10px] text-ink/60 space-y-0.5">
                <p>{t.merchantLabel}<strong className="text-ink">INCREDIBOWL SERVICES</strong></p>
                <p>{t.bankLabel}<strong className="text-ink">Hong Leong Bank</strong></p>
                <p>{t.support}</p>
            </div>

            {receiptUploaded && receiptUrl ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2">
                    <div className="relative w-12 h-12">
                        <Image src={receiptUrl} alt="Receipt" fill unoptimized className="rounded-lg object-cover border border-green-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> {t.uploaded}</p>
                        <p className="text-[10px] text-green-600/60 truncate">{t.reupload}</p>
                    </div>
                    <label className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-green-200">
                        {t.changeImage}
                        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                    </label>
                </div>
            ) : (
                <label className={`w-full py-2.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${uploading ? 'bg-orange-50 border-orange-200' : 'bg-paper border-line hover:border-primary'}`}>
                    {uploading ? (
                        <><Loader2 size={16} className="text-primary animate-spin" /><span className="font-bold text-primary text-xs">{t.uploading}</span></>
                    ) : (
                        <><Plus size={16} className="text-primary" /><span className="font-bold text-primary text-xs">{t.uploadReceipt}</span></>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
                </label>
            )}
        </div>
    );
}
