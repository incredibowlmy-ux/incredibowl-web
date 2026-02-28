"use client";

import React from 'react';
import Link from 'next/link';

export default function RefundPolicy() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-10 text-[#E76F51]">Refund & Cancellation Policy / 退款与取消政策</h1>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold mb-4">1. Ala Carte Orders / 单点订单</h2>
                        <div className="space-y-4">
                            <p><strong>A. Cancellation / 取消：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Orders must be canceled before <strong>22:30</strong> the night before. / 必须在用餐前一晚 <strong>22:30</strong> 前取消。</li>
                                <li>Cancellations before the cutoff will receive <strong>100% Store Credit (Vouchers)</strong>. No cash refunds. / 截止时间前取消可获得 <strong>100% 店铺抵用券</strong>。不提供现金退款。</li>
                                <li>No refunds or credits for cancellations after 22:30. / 22:30 后取消将不予退款或补偿。</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">2. Subscription Plans / 订阅计划</h2>
                        <div className="space-y-4">
                            <p><strong>A. Cancellation / 取消：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Subscription cancellations will be refunded in <strong>100% Store Credit (Vouchers)</strong> for the remaining value. No cash refunds. / 订阅取消后的余额将以 <strong>100% 店铺抵用券</strong> 形式退还。不提供现金退款。</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">3. Service Recovery (Our Fault) / 服务补偿 (我方责任)</h2>
                        <div className="space-y-4">
                            <p>If your order is delayed by more than <strong>90 minutes</strong> or we are unable to fulfill it: / 若订单延迟超过 <strong>90分钟</strong> 或我方无法履行订单：</p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>We offer a <strong>100% Cash Refund</strong> OR a <strong>Free Re-delivery/Replacement</strong>. / 我们将提供 <strong>100% 现金退款</strong> 或 <strong>免费补送/更换</strong>。</li>
                            </ul>
                        </div>
                    </section>

                    <section className="bg-orange-50 p-8 rounded-3xl border-2 border-[#F4A261]/20">
                        <h2 className="text-2xl font-bold mb-4">Contact Us / 联系我们</h2>
                        <p>For any issues, please WhatsApp us immediately. / 如需协助，请立即联系：</p>
                        <p className="text-xl font-bold mt-2">WhatsApp: 010-337 0197</p>
                        <p className="font-bold">Email: incredibowl.my@gmail.com</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
