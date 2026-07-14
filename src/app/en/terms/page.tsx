import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { TIER_INNER, TIER_OUTER, TIER_MID } from '@/lib/deliveryCopy';
import { MID_RADIUS_KM } from '@/lib/deliveryUtils';
import SetHtmlLang from '@/components/home-en/SetHtmlLang';

// 英文版服务条款：内容 = /terms 中英对照页的英文半，条款事实（截单时间、
// 运费档位、餐券规则）全部同源（deliveryCopy 常量），不新增任何主张。
export const metadata: Metadata = {
    title: 'Terms & Conditions · Incredibowl',
    description: 'Incredibowl Terms & Conditions: ordering, delivery, payment and meal voucher rules.',
    alternates: {
        canonical: '/en/terms',
        languages: { 'zh-MY': '/terms', 'en-MY': '/en/terms', 'x-default': '/terms' },
    },
};

export default function TermsAndConditionsEN() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <SetHtmlLang />
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/en" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home</Link>
                <h1 className="text-4xl font-black mb-4 text-[#E76F51]">Terms & Conditions</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date: 11 May 2026</p>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Operational Model</h2>
                        <p>Incredibowl is a home-based food delivery service. We operate on a pre-order basis with a daily rotating menu.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Ordering & Cut-off</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Cut-off time: 06:00 AM on the day of delivery.</li>
                            <li>Subscription orders are automated weekly.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Delivery & Radius</h2>
                        <p>Delivery fees are tiered by straight-line distance from Pearl Point:</p>
                        <ul className="list-disc ml-6 mt-1">
                            <li><b>{TIER_INNER.rangeEn}</b>: RM {TIER_INNER.fee} — waived when cart total ≥ RM {TIER_INNER.freeOver} (after promo-code discount; meal-voucher redemption does NOT affect this threshold)</li>
                            <li><b>{TIER_OUTER.rangeEn}</b>: RM {TIER_OUTER.fee} — waived when cart total ≥ RM {TIER_OUTER.freeOver} (same basis as above)</li>
                            <li><b>{TIER_MID.rangeEn}</b>: RM {TIER_MID.fee} — waived when cart total ≥ RM {TIER_MID.freeOver} (saves RM {TIER_MID.fee}; same basis)</li>
                            <li><b>{MID_RADIUS_KM} km +</b>: not currently delivered — please WhatsApp us for catering orders</li>
                        </ul>
                        <p className="mt-2 italic opacity-70">Existing customers (registered before 2026-05-16) within 2 km are grandfathered onto the previous free-delivery tier.</p>
                        <p className="mt-2 italic opacity-70">Distance is measured by geocoding your saved delivery address. Please verify your address in your profile before checkout.</p>
                        <p className="mt-2 text-[#E76F51] font-bold">Delivery Times:</p>
                        <ul className="list-disc ml-6 mt-1">
                            <li>Lunch: 11:00 AM - 1:00 PM</li>
                            <li>Dinner: 5:00 PM - 8:00 PM</li>
                        </ul>
                        <p className="mt-2 italic opacity-60">Delivery times are estimated and may be affected by traffic/weather.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Health & Allergens</h2>
                        <p>While we avoid MSG and use fresh ingredients, we handle nuts, soy, seafood, and gluten. Please inform us of any severe allergies.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">5. Pricing & Payments</h2>
                        <p>Prices are in RM. We accept Curlec (Online Payment) and DuitNow QR. No 3rd party commission fees are added.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">6. Meal Voucher Bundles</h2>
                        <p>Customers may purchase prepaid meal voucher bundles (5 / 10 / 20 vouchers per bundle) for use on future orders. The following rules govern voucher purchase and redemption:</p>
                        <ul className="list-disc ml-6 mt-2 space-y-2">
                            <li><strong>1 voucher = 1 main dish</strong> (any dish from the daily menu). Premium dishes priced above RM 19.90 use one voucher and require a cash top-up for the difference (the voucher covers RM 19.90). Add-ons such as drinks, extra sides, eggs, and similar items are <strong>not covered</strong> and require cash payment.</li>
                            <li><strong>Validity by bundle:</strong> 5-pack and 10-pack are valid for <strong>30 days</strong> from purchase; 20-pack is valid for <strong>60 days</strong>. Expired vouchers are forfeited and cannot be extended or refunded.</li>
                            <li><strong>Non-transferable</strong> — vouchers may only be redeemed by the purchasing account.</li>
                            <li><strong>Non-refundable in cash</strong>. The only exception is when a QR-payment purchase is rejected by us due to failed verification — in that case, full cash refund within 3 working days via DuitNow.</li>
                            <li><strong>Cannot be combined with promo codes</strong> (referral / points / custom codes) on the same order.</li>
                            <li>If an order paid with vouchers is later cancelled (per the Refund Policy), the vouchers are <strong>returned to the customer&apos;s wallet</strong> with the original expiry date preserved.</li>
                            <li>For the full set of rules including refund handling, see the <Link href="/en/refund" className="text-[#E76F51] underline">Refund Policy</Link>.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">7. Limitation of Liability</h2>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Incredibowl is not liable for allergic reactions if the customer fails to inform us of known allergies prior to ordering.</li>
                            <li>Delivery delays caused by traffic, weather, or other force majeure events are beyond our control. We will do our best to communicate delays promptly.</li>
                            <li>Food is prepared in a home kitchen and is intended for immediate consumption. We are not responsible for food stored improperly after delivery.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">8. Intellectual Property</h2>
                        <p>All content on the Incredibowl website — including brand name, logos, images, food photography, menu descriptions, and recipes — is the property of Incredibowl. Unauthorized reproduction or redistribution is prohibited.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">9. Changes to Terms</h2>
                        <p>We reserve the right to update these terms at any time. Changes will be reflected on this page with an updated effective date. Continued use of our service constitutes acceptance of the revised terms.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
