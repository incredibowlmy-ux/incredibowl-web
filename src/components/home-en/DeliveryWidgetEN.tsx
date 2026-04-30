import React from 'react';
import { Phone } from 'lucide-react';

const WHATSAPP_URL = "https://wa.me/60103370197?text=Hi%20BowlMama!%20I%27d%20like%20to%20check%20if%20my%20address%20is%20within%20your%20delivery%20coverage.%20My%20address%20is%3A%20";

export default function DeliveryWidgetEN() {
    return (
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-4 mt-4">
            <div className="bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm h-full">
                <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:items-start gap-0">

                    <div className="flex flex-col items-center md:items-start text-center md:text-left md:max-w-[210px] lg:order-2 lg:items-start lg:text-left lg:max-w-none lg:bg-[#E8F5E3]/70 lg:border lg:border-green-200/50 lg:rounded-2xl lg:p-4 lg:h-full lg:justify-center">
                        <p className="font-black text-[#1A2D23] text-[15px] mb-1 leading-snug">Within 2km of Pearl Point</p>
                        <p className="font-extrabold text-green-600 text-[15px] mb-3 leading-snug">Free delivery 🛵</p>
                        <p className="text-[13px] text-gray-500 leading-relaxed">
                            <span className="font-semibold">Beyond 2km:</span> 3+ orders <span className="text-gray-700 font-bold">→ from RM5</span> <span className="mx-0.5 text-gray-300">·</span> 6+ orders <span className="text-[#FF6B35] font-bold">→ free</span>
                        </p>
                    </div>

                    <div className="md:hidden w-full border-t border-gray-100 my-6" />

                    <div className="text-left w-full space-y-3 md:border-l md:border-r md:border-gray-100 md:px-8 lg:order-first lg:border-l-0 lg:border-r-0 lg:px-0">
                        <div className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">⏰</span>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-gray-700 leading-snug">Orders close 06:00 daily</p>
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">Order before 06:00 for same-day delivery</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">🚚</span>
                            <div className="flex-1">
                                <p className="text-[15px] font-bold text-gray-700 leading-snug">Delivery windows</p>
                                <p className="text-[13px] text-gray-500 leading-relaxed mt-0.5">11AM-1PM &nbsp;·&nbsp; 4:30PM-7:30PM</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:hidden h-6" />

                    <div className="flex flex-col items-center md:items-start md:max-w-[220px] lg:order-3 lg:col-span-2 lg:items-stretch lg:border-t lg:border-gray-100 lg:pt-5 lg:max-w-none lg:gap-3">
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-1 text-center md:text-left lg:text-left lg:mb-0">🤔 Not sure if we deliver to you?</p>
                        </div>
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full md:w-auto md:px-6 py-3.5 lg:py-4 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold text-base lg:text-[17px] flex justify-center items-center gap-2 lg:gap-2.5 transition-transform active:scale-95 shadow-md shadow-[#25D366]/20 whitespace-nowrap"
                        >
                            <Phone size={16} className="lg:w-[18px] lg:h-[18px]" /> WhatsApp BowlMama
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
