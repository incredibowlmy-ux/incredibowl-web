import React from 'react';
import { MapPin, Phone } from 'lucide-react';

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20BowlMama!%20%E7%9C%8B%E4%BA%86%E4%BD%A0%E7%9A%84%E8%8F%9C%E5%8D%95%E6%9E%81%E5%BA%A6%E6%83%B3%E5%BF%B5%20home-cooked%20food%20%EF%BC%8C%E6%83%B3%E7%A1%AE%E8%AE%A4%E6%88%91%E8%BF%99%E8%BE%B9%E7%9A%84%E5%9C%B0%E5%9D%80%E6%9C%89%E6%B2%A1%E6%9C%89%E5%9C%A8%20delivery%20coverage%20%E9%87%8C%E9%9D%A2%E5%91%A2%EF%BC%9F%0A%E6%88%91%E7%9A%84%E5%9C%B0%E5%9D%80/Condo%E6%98%AF%20%EF%BC%9A";

export default function DeliveryWidget() {
    return (
        <div className="lg:col-span-5 mt-4">
            <div className="bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm h-full">
                {/* Mobile: vertical. Tablet (md): 3-col horizontal. Desktop lg+ (col-span-5 narrow): back to vertical */}
                <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 lg:flex lg:flex-col lg:gap-5 lg:items-stretch gap-0">
                    {/* Block 1: Icon + Headline */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left md:max-w-[210px] lg:items-center lg:text-center lg:max-w-none">
                        <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center text-[#FF6B35] mb-4 md:mb-3">
                            <MapPin size={24} />
                        </div>
                        <p className="font-black text-[#1A2D23] text-[15px] mb-1 leading-snug">Pearl Point 方圆 2km 内</p>
                        <p className="font-extrabold text-green-600 text-[15px] mb-3 leading-snug">免运费 🛵 Free Delivery</p>
                        <p className="text-[13px] text-gray-500 leading-relaxed">
                            <span className="font-semibold">2km 外：</span>满 3 份 <span className="text-gray-700 font-bold">→ RM5 起送</span> <span className="mx-0.5 text-gray-300">·</span> 满 6 份 <span className="text-[#FF6B35] font-bold">→ 免运</span>
                        </p>
                    </div>

                    {/* Mobile divider (also shown on lg vertical layout) */}
                    <div className="md:hidden lg:block w-full border-t border-gray-100 my-6 lg:my-0" />

                    {/* Block 2: Time details */}
                    <div className="text-left w-full space-y-3 md:border-l md:border-r md:border-gray-100 md:px-8 lg:border-l-0 lg:border-r-0 lg:px-0">
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
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">11AM-1PM &nbsp;·&nbsp; 4:30PM-7:30PM</p>
                            </div>
                        </div>
                    </div>

                    {/* Mobile spacer (also lg vertical) */}
                    <div className="md:hidden lg:block h-6 lg:h-0" />

                    {/* Block 3: WhatsApp CTA */}
                    <div className="flex flex-col items-center md:items-start md:max-w-[220px] lg:items-stretch lg:max-w-none">
                        <p className="text-xs font-bold text-gray-500 mb-1 text-center md:text-left lg:text-center">🤔 不确定你家在不在范围内？</p>
                        <p className="text-xs text-gray-500 italic mb-4 text-center md:text-left lg:text-center">Not sure if we deliver to you?</p>

                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full md:w-auto md:px-6 lg:w-full lg:px-6 py-3.5 lg:py-4 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold text-base lg:text-[17px] flex justify-center items-center gap-2 lg:gap-2.5 transition-transform active:scale-95 shadow-md shadow-[#25D366]/20 whitespace-nowrap"
                        >
                            <Phone size={16} className="lg:w-[18px] lg:h-[18px]" /> WhatsApp 问碗妈
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
