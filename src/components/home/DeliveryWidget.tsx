import React from 'react';
import { MapPin, CheckCircle2, Phone } from 'lucide-react';

const DELIVERY_LOCATIONS = [
    'Pearl Point', 'Meadow Park Condo 1, 2 & 3', 'Millerz Square',
    'The Scott Garden', "D'Ivoz Residences", 'Verve Suites',
    'The Harmony', 'Platinum Arena', 'Citizen 1&2',
    'Petalz', "D'Sands", 'SkyVille 8 @ Benteng',
];

export default function DeliveryWidget() {
    return (
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="md:col-span-2 bg-[#1A2D23] text-white rounded-[32px] p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
                <div className="w-40 h-40 bg-[#FF6B35] rounded-full blur-3xl opacity-20 absolute -bottom-10 -right-10 pointer-events-none" />
                <div className="flex items-center gap-3 mb-4">
                    <MapPin size={24} className="text-[#FF6B35]" />
                    <h3 className="font-extrabold text-2xl tracking-tight">阿姨的配送范围 / Delivery Coverage</h3>
                </div>
                <p className="text-white/80 font-medium text-sm leading-relaxed mb-6 max-w-xl">
                    阿姨骑着小电驴，只送家门口的邻居。<br />
                    新鲜现煮，不跑远路，味道不打折。<br />
                    <span className="text-xs text-white/50 italic mt-1 block">Auntie delivers on her trusty e-bike — only to neighbours within reach, so every meal arrives hot & fresh.</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs font-bold text-white/90">
                    {DELIVERY_LOCATIONS.map(loc => (
                        <div key={loc} className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-[#FF6B35] shrink-0" />
                            <span className="truncate">{loc}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-1 bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col justify-center text-center items-center">
                <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center text-[#FF6B35] mb-4">
                    <MapPin size={24} />
                </div>
                <p className="font-extrabold text-[#1A2D23] text-sm mb-1">以 Pearl Point 为中心，</p>
                <p className="font-extrabold text-[#1A2D23] text-sm mb-2">方圆 2 公里内的公寓邻居。</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6 border-b border-gray-100 pb-4 w-full">Within 2km along Old Klang Road</p>

                <p className="text-xs font-bold text-gray-500 mb-1">🤔 不确定你家在不在范围内？</p>
                <p className="text-[10px] text-gray-400 italic mb-4">Not sure if we deliver to you?</p>

                <a
                    href="https://wa.me/60103370197?text=Hi%20Auntie%21%20%E7%9C%8B%E4%BA%86%E4%BD%A0%E7%9A%84%E8%8F%9C%E5%8D%95%E6%9E%81%E5%BA%A6%E6%83%B3%E5%BF%B5%20home-cooked%20food%20%F0%9F%8D%B3%EF%BC%8C%E6%83%B3%E7%A1%AE%E8%AE%A4%E6%88%91%E8%BF%99%E8%BE%B9%E7%9A%84%20condo%20%E6%9C%89%E6%B2%A1%E6%9C%89%E5%9C%A8%20delivery%20coverage%20%E9%87%8C%E9%9D%A2%E5%91%A2%EF%BC%9F"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-md shadow-[#25D366]/20"
                >
                    <Phone size={16} /> WhatsApp 问阿姨
                </a>
            </div>
        </div>
    );
}
