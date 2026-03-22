"use client";

import React from 'react';
import Link from 'next/link';

export default function TermsAndConditions() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-4 text-[#E76F51]">Terms & Conditions / 服务条款</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date / 生效日期：2026年3月17日</p>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Operational Model / 运营模式</h2>
                        <p>Incredibowl is a home-based food delivery service. We operate on a pre-order basis with a daily rotating menu. / Incredibowl 是一家基于家庭环境的餐饮外送服务，采用每日轮换菜单的预订模式。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Ordering & Cut-off / 订餐与截止</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Cut-off time: 06:00 AM on the day of delivery. / 订餐截止：送餐当天早上 06:00 AM。</li>
                            <li>Subscription orders are automated weekly. / 订阅用户每周自动排单。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Delivery & Radius / 配送范围</h2>
                        <p>Our core coverage provides <b>Free Delivery</b> within a 2km radius around Pearl Point. Deliveries beyond 2km require a minimum of 3 meals and will incur an RM5 delivery fee, which is waived for orders of 6 meals or more. / 我们的核心配送圈为 Pearl Point 方圆 2km 内（免运费）。超出 2km 的地区需满 3 份起送，运费为 RM5，满 6 份免运费。</p>
                        <p className="mt-2 text-[#E76F51] font-bold">Delivery Times / 配送时间：</p>
                        <ul className="list-disc ml-6 mt-1">
                            <li>Lunch / 午餐：11:00 AM - 1:00 PM</li>
                            <li>Dinner / 晚餐：5:30 PM - 8:00 PM</li>
                        </ul>
                        <p className="mt-2 italic opacity-60">Delivery times are estimated and may be affected by traffic/weather. / 配送时间仅为预计，可能受交通/天气影响。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Health & Allergens / 健康与过敏</h2>
                        <p>While we avoid MSG and use fresh ingredients, we handle nuts, soy, seafood, and gluten. Please inform us of any severe allergies. / 尽管我们无味精且用料新鲜，但在处理过程中可能涉及坚果、大豆、海鲜及面粉。如有严重过敏请告知。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">5. Pricing & Payments / 定价与支付</h2>
                        <p>Prices are in RM. We accept Curlec (Online Payment) and DuitNow QR. No 3rd party commission fees are added. / 价格以令吉标示。支持 Curlec 在线支付及 DuitNow QR 扫码支付。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">6. Limitation of Liability / 免责声明</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Incredibowl is not liable for allergic reactions if the customer fails to inform us of known allergies prior to ordering. / 若顾客未在下单前告知已知过敏源，Incredibowl 不承担过敏反应的责任。</li>
                            <li>Delivery delays caused by traffic, weather, or other force majeure events are beyond our control. We will do our best to communicate delays promptly. / 因交通、天气或其他不可抗力导致的配送延迟不在我们的控制范围内，我们会尽快通知。</li>
                            <li>Food is prepared in a home kitchen and is intended for immediate consumption. We are not responsible for food stored improperly after delivery. / 食品在家庭厨房制作，建议即时食用。送达后因不当存放导致的问题，我方不承担责任。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">7. Intellectual Property / 知识产权</h2>
                        <p>All content on the Incredibowl website — including brand name, logos, images, food photography, menu descriptions, and recipes — is the property of Incredibowl. Unauthorized reproduction or redistribution is prohibited. / Incredibowl 网站上的所有内容——包括品牌名称、标志、图片、菜品摄影、菜单描述及食谱——均为 Incredibowl 所有。未经授权禁止复制或转发。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">8. Changes to Terms / 条款变更</h2>
                        <p>We reserve the right to update these terms at any time. Changes will be reflected on this page with an updated effective date. Continued use of our service constitutes acceptance of the revised terms. / 我们保留随时更新本条款的权利。变更将在此页面更新并标注新的生效日期。继续使用我们的服务即表示接受修订后的条款。</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
