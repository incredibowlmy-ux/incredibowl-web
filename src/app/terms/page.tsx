"use client";

import React from 'react';
import Link from 'next/link';

export default function TermsAndConditions() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/v3" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-10 text-[#E76F51]">Terms & Conditions / 服务条款</h1>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Operational Model / 运营模式</h2>
                        <p>Incredibowl is a home-based food delivery service. We operate on a pre-order basis with a daily rotating menu. / Incredibowl 是一家基于家庭环境的餐饮外送服务，采用每日轮换菜单的预订模式。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Ordering & Cut-off / 订餐与截止</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Cut-off time: 22:30 the night before delivery. / 订餐截止：送餐前一晚 22:30。</li>
                            <li>Subscription orders are automated weekly. / 订阅用户每周自动排单。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Delivery & Radius / 配送范围</h2>
                        <p>Our core 3km radius includes Pearl Suria, Millerz Square, and OUG. Delivery times are estimated and may be affected by traffic/weather. / 核心 3公里配送圈包括 Pearl Suria, Millerz Square, 及 OUG。配送时间仅为预计，可能受交通/天气影响。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Health & Allergens / 健康与过敏</h2>
                        <p>While we avoid MSG and use fresh ingredients, we handle nuts, soy, seafood, and gluten. Please inform us of any severe allergies. / 尽管我们无味精且用料新鲜，但在处理过程中可能涉及坚果、大豆、海鲜及面粉。如有严重过敏请告知。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">5. Pricing & Payments / 定价与支付</h2>
                        <p>Prices are in RM. We accept Curlec (Online Payment) and Bank QR. No 3rd party commission fees are added. / 价格以令吉标示。支持 Curlec 及银行扫码支付。</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
