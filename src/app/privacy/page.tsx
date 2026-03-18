"use client";

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-4 text-[#E76F51]">Privacy Policy / 隐私政策</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date / 生效日期：2026年3月17日</p>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Data Collection / 信息收集</h2>
                        <p>We collect your Name, Phone Number, and Address solely for order fulfillment. / 我们收集您的姓名、电话和地址，仅用于配送订单。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Usage & Third-Party Services / 信息使用与第三方服务</h2>
                        <p>Your data is used to process payments and communicate order updates. We use the following third-party services: / 您的数据用于支付处理及订单沟通。我们使用以下第三方服务：</p>
                        <ul className="list-disc ml-6 mt-2 space-y-2">
                            <li><strong>Firebase (Google)</strong> — Order storage and user authentication / 订单存储与用户认证</li>
                            <li><strong>Curlec by Razorpay</strong> — Online payment processing / 在线支付处理</li>
                            <li><strong>WhatsApp (Meta)</strong> — Order communication and customer support / 订单沟通与客服支持</li>
                        </ul>
                        <p className="mt-2">These services have their own privacy policies. We encourage you to review them. / 以上服务各有其隐私政策，建议您自行查阅。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Data Protection / 数据保护</h2>
                        <p>We never sell your data. Only authorized team members access your delivery info. / 我们绝不买卖您的数据。只有授权团队成员可查阅配送信息。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Your Rights / 您的权利</h2>
                        <p>You may request to view or delete your contact info at any time by contacting us: / 您可以随时通过以下方式联系我们，要求查看或删除您的联系信息：</p>
                        <ul className="list-disc ml-6 mt-2 space-y-1">
                            <li>WhatsApp: <strong>010-337 0197</strong></li>
                            <li>Email: <strong>hello@incredibowl.my</strong></li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">5. Data Retention / 数据保留</h2>
                        <p>We retain order data for up to 12 months for operational and accounting purposes. After this period, personal data is deleted or anonymized. / 我们保留订单数据最长12个月，用于运营及会计用途。超过此期限后，个人数据将被删除或匿名化处理。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">6. Cookies & Analytics / Cookies 与分析工具</h2>
                        <p>Our website may use basic analytics to understand site traffic. We do not use advertising cookies or tracking pixels. No personal data is shared with advertisers. / 我们的网站可能使用基本分析工具来了解流量。我们不使用广告 Cookies 或追踪像素，不会与广告商分享个人数据。</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
