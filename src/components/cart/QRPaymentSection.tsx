"use client";

import React from 'react';
import Image from 'next/image';
import { CheckCircle, Loader2, Plus } from 'lucide-react';

interface QRPaymentSectionProps {
    receiptUploaded: boolean;
    receiptUrl: string;
    uploading: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function QRPaymentSection({ receiptUploaded, receiptUrl, uploading, onUpload }: QRPaymentSectionProps) {
    return (
        <div className="space-y-2 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl border border-[#E3EADA] p-2 max-w-[200px] mx-auto shadow-sm">
                <Image src="/duitnow_qr.png" alt="DuitNow QR - INCREDIBOWL SERVICES" width={400} height={550} className="w-full h-auto rounded-lg" />
            </div>

            <div className="bg-[#F5F3EF] rounded-lg px-3 py-2 text-[10px] text-[#1A2D23]/60 space-y-0.5">
                <p>✅ 商户：<strong className="text-[#1A2D23]">INCREDIBOWL SERVICES</strong></p>
                <p>✅ 合作银行：<strong className="text-[#1A2D23]">Hong Leong Bank</strong></p>
                <p>✅ 支持所有银行 & e-Wallet（TnG, SPay, MAE, Boost 等）</p>
            </div>

            {receiptUploaded && receiptUrl ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2">
                    <div className="relative w-12 h-12">
                        <Image src={receiptUrl} alt="Receipt" fill unoptimized className="rounded-lg object-cover border border-green-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle size={12} /> 凭证已上传</p>
                        <p className="text-[10px] text-green-600/60 truncate">点击重新上传</p>
                    </div>
                    <label className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-green-200">
                        换图
                        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
                    </label>
                </div>
            ) : (
                <label className={`w-full py-2.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${uploading ? 'bg-orange-50 border-orange-200' : 'bg-[#FDFBF7] border-[#E3EADA] hover:border-[#FF6B35]'}`}>
                    {uploading ? (
                        <><Loader2 size={16} className="text-[#FF6B35] animate-spin" /><span className="font-bold text-[#FF6B35] text-xs">上传中...</span></>
                    ) : (
                        <><Plus size={16} className="text-[#FF6B35]" /><span className="font-bold text-[#FF6B35] text-xs">上传付款截图</span></>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
                </label>
            )}
        </div>
    );
}
