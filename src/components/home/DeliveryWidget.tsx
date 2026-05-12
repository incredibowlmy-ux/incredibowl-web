import React from 'react';
import { Phone } from 'lucide-react';

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20BowlMama!%20%E7%9C%8B%E4%BA%86%E4%BD%A0%E7%9A%84%E8%8F%9C%E5%8D%95%E6%9E%81%E5%BA%A6%E6%83%B3%E5%BF%B5%20home-cooked%20food%20%EF%BC%8C%E6%83%B3%E7%A1%AE%E8%AE%A4%E6%88%91%E8%BF%99%E8%BE%B9%E7%9A%84%E5%9C%B0%E5%9D%80%E6%9C%89%E6%B2%A1%E6%9C%89%E5%9C%A8%20delivery%20coverage%20%E9%87%8C%E9%9D%A2%E5%91%A2%EF%BC%9F%0A%E6%88%91%E7%9A%84%E5%9C%B0%E5%9D%80/Condo%E6%98%AF%20%EF%BC%9A";

export default function DeliveryWidget() {
    return (
        <div className="order-last lg:order-none lg:col-span-5 lg:col-start-1 lg:row-start-4 mt-4">
            <div className="bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm h-full">
                {/* Mobile: vertical. Tablet (md): 3-col horizontal. Desktop lg+: 2×2 grid */}
                <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:items-start gap-0">

                    {/* Block 1: Coverage info — desktop RIGHT (lg:order-2) */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left md:max-w-[210px] lg:order-2 lg:items-start lg:text-left lg:max-w-none lg:bg-[#E8F5E3]/70 lg:border lg:border-green-200/50 lg:rounded-2xl lg:p-4 lg:h-full lg:justify-center">
                        <p className="font-black text-[#1A2D23] text-[15px] mb-1 leading-snug">Pearl Point 方圆 2km 内</p>
                        <p className="font-extrabold text-green-600 text-[15px] mb-3 leading-snug">免运费 🛵</p>
                        <p className="text-[13px] text-gray-500 leading-relaxed">
                            <span className="font-semibold">2–5km：</span>满 RM 40 <span className="text-[#FF6B35] font-bold">→ 免运</span> <span className="text-gray-300 mx-0.5">·</span> 不到 <span className="text-gray-700 font-bold">RM 6</span>
                        </p>
                        <p className="text-[12px] text-gray-400 leading-relaxed mt-0.5">
                            <span className="font-semibold">5–8km：</span><span className="text-amber-600 font-bold">RM 15</span> <span className="text-gray-400">(满 40 → RM 5)</span>
                        </p>
                        <p className="text-[12px] text-gray-400 leading-relaxed mt-0.5">
                            <span className="font-semibold">8km+：</span><span className="text-red-500 font-bold">RM 25</span> <span className="text-gray-400">(满 40 → RM 15)</span>
                        </p>
                    </div>

                    {/* Mobile divider only */}
                    <div className="md:hidden w-full border-t border-gray-100 my-6" />

                    {/* Block 2: Time details — desktop LEFT (lg:order-first) */}
                    <div className="text-left w-full space-y-3 md:border-l md:border-r md:border-gray-100 md:px-8 lg:order-first lg:border-l-0 lg:border-r-0 lg:px-0">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">⏰</span>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-gray-700 leading-snug">每天早上 06:00 截单</p>
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">06:00 前下单当日配送</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">🚚</span>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-gray-700 leading-snug">配送时间</p>
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">11AM-1PM &nbsp;·&nbsp; 5PM-8PM</p>
                            </div>
                        </div>
                    </div>

                    {/* Mobile spacer only */}
                    <div className="md:hidden h-6" />

                    {/* Block 3: WhatsApp CTA — spans both cols on desktop, stacked + full-width button */}
                    <div className="flex flex-col items-center md:items-start md:max-w-[220px] lg:order-3 lg:col-span-2 lg:items-stretch lg:border-t lg:border-gray-100 lg:pt-5 lg:max-w-none lg:gap-3">
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-1 text-center md:text-left lg:text-left lg:mb-0">🤔 不确定你家在不在范围内？</p>
                        </div>
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full md:w-auto md:px-6 py-3.5 lg:py-4 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold text-base lg:text-[17px] flex justify-center items-center gap-2 lg:gap-2.5 transition-transform active:scale-95 shadow-md shadow-[#25D366]/20 whitespace-nowrap"
                        >
                            <Phone size={16} className="lg:w-[18px] lg:h-[18px]" /> WhatsApp 问碗妈
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
