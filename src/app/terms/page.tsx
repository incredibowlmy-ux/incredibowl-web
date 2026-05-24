"use client";

import React from 'react';
import Link from 'next/link';

export default function TermsAndConditions() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-4 text-[#E76F51]">Terms & Conditions / 服务条款</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date / 生效日期：2026年5月11日</p>

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
                        <p>Delivery fees are tiered by straight-line distance from Pearl Point: / 配送费按距 Pearl Point 直线距离分档：</p>
                        <ul className="list-disc ml-6 mt-1">
                            <li><b>0–2.5 km</b>：RM 3 — waived when cart total ≥ RM 20 (after promo-code discount; meal-voucher redemption does NOT affect this threshold) / RM 3，使用 promo code 折后满 RM 20 即免运（餐券抵扣不影响门槛）</li>
                            <li><b>2.5–5 km</b>：RM 5 — waived when cart total ≥ RM 30 (same basis as above) / RM 5，使用 promo code 折后满 RM 30 即免运（同一计算基础）</li>
                            <li><b>5–7.5 km</b>：RM 12 — waived when cart total ≥ RM 45 (saves RM 12; same basis) / RM 12，使用 promo code 折后满 RM 45 自动免运（同一计算基础）</li>
                            <li><b>7.5 km +</b>：not currently delivered — please WhatsApp us for catering orders / 暂不配送，公司订餐请 WhatsApp 询价</li>
                        </ul>
                        <p className="mt-2 italic opacity-70">Existing customers (registered before 2026-05-16) within 2 km are grandfathered onto the previous free-delivery tier. / 2026-05-16 之前注册的老客户，2 km 内沿用旧的免运政策。</p>
                        <p className="mt-2 italic opacity-70">Distance is measured by geocoding your saved delivery address. Please verify your address in your profile before checkout. / 距离由您保存的配送地址通过 Google Maps 自动测算。下单前请在个人资料中确认地址。</p>
                        <p className="mt-2 text-[#E76F51] font-bold">Delivery Times / 配送时间：</p>
                        <ul className="list-disc ml-6 mt-1">
                            <li>Lunch / 午餐：11:00 AM - 1:00 PM</li>
                            <li>Dinner / 晚餐：5:00 PM - 8:00 PM</li>
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
                        <h2 className="text-xl font-bold mb-4">6. Meal Voucher Bundles / 餐券预付包</h2>
                        <p>Customers may purchase prepaid meal voucher bundles (5 / 10 / 20 vouchers per bundle) for use on future orders. The following rules govern voucher purchase and redemption: / 客户可购买预付餐券包（每包 5 / 10 / 20 张），用于后续订单抵扣。规则如下：</p>
                        <ul className="list-disc ml-6 mt-2 space-y-2">
                            <li><strong>1 voucher = 1 main dish</strong> (any dish from the daily menu). Add-ons such as drinks, extra sides, eggs, and similar items are <strong>not covered</strong> and require cash payment. / <strong>1 张餐券 = 1 份主餐</strong>（任意菜单菜品）。加购项（饮料、加料、蛋等）<strong>不在抵扣范围内</strong>，需现金支付。</li>
                            <li><strong>Validity by bundle:</strong> 5-pack and 10-pack are valid for <strong>30 days</strong> from purchase; 20-pack is valid for <strong>60 days</strong>. Expired vouchers are forfeited and cannot be extended or refunded. / <strong>按组合不同</strong>：5 张装和 10 张装<strong>有效期 30 天</strong>；20 张装<strong>有效期 60 天</strong>，自购买日起算，过期作废，不可延期或退款。</li>
                            <li><strong>Non-transferable</strong> — vouchers may only be redeemed by the purchasing account. / <strong>不可转让</strong>，仅限购买账号本人使用。</li>
                            <li><strong>Non-refundable in cash</strong>. The only exception is when a QR-payment purchase is rejected by us due to failed verification — in that case, full cash refund within 3 working days via DuitNow. / <strong>不提供现金退款</strong>。唯一例外：QR 付款被我方因凭证不符拒绝的，3 个工作日内通过 DuitNow 全额现金退还。</li>
                            <li><strong>Cannot be combined with promo codes</strong> (referral / points / custom codes) on the same order. / 不可与优惠码（推荐码 / 积分券 / 自定义码）同时使用。</li>
                            <li>If an order paid with vouchers is later cancelled (per the Refund Policy), the vouchers are <strong>returned to the customer&apos;s wallet</strong> with the original expiry date preserved. / 用券订单按退款政策取消的，餐券<strong>退回钱包</strong>，原到期日保持不变。</li>
                            <li>For the full set of rules including refund handling, see the <Link href="/refund" className="text-[#E76F51] underline">Refund Policy</Link>. / 完整规则（含退款处理）见<Link href="/refund" className="text-[#E76F51] underline">退款政策</Link>。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">7. Limitation of Liability / 免责声明</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Incredibowl is not liable for allergic reactions if the customer fails to inform us of known allergies prior to ordering. / 若顾客未在下单前告知已知过敏源，Incredibowl 不承担过敏反应的责任。</li>
                            <li>Delivery delays caused by traffic, weather, or other force majeure events are beyond our control. We will do our best to communicate delays promptly. / 因交通、天气或其他不可抗力导致的配送延迟不在我们的控制范围内，我们会尽快通知。</li>
                            <li>Food is prepared in a home kitchen and is intended for immediate consumption. We are not responsible for food stored improperly after delivery. / 食品在家庭厨房制作，建议即时食用。送达后因不当存放导致的问题，我方不承担责任。</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">8. Intellectual Property / 知识产权</h2>
                        <p>All content on the Incredibowl website — including brand name, logos, images, food photography, menu descriptions, and recipes — is the property of Incredibowl. Unauthorized reproduction or redistribution is prohibited. / Incredibowl 网站上的所有内容——包括品牌名称、标志、图片、菜品摄影、菜单描述及食谱——均为 Incredibowl 所有。未经授权禁止复制或转发。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">9. Changes to Terms / 条款变更</h2>
                        <p>We reserve the right to update these terms at any time. Changes will be reflected on this page with an updated effective date. Continued use of our service constitutes acceptance of the revised terms. / 我们保留随时更新本条款的权利。变更将在此页面更新并标注新的生效日期。继续使用我们的服务即表示接受修订后的条款。</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
