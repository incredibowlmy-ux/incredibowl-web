"use client";

import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/v3" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-10 text-[#E76F51]">Privacy Policy / 隐私政策</h1>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Data Collection / 信息收集</h2>
                        <p>We collect your Name, Phone Number, and Address solely for order fulfillment. / 我们收集您的姓名、电话和地址，仅用于配送订单。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Usage / 信息使用</h2>
                        <p>Your data is used to process payments (via 3rd party gateways) and WhatsApp order communications. / 您的数据用于支付处理（通过第三方平台）及 WhatsApp 沟通订单信息。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Data Protection / 数据保护</h2>
                        <p>We never sell your data. Only authorized team members access your delivery info. / 我们绝不买卖您的数据。只有授权团队成员可查阅配送信息。</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Your Rights / 您的权利</h2>
                        <p>You may request to view or delete your contact info at any time. / 您可以随时要求查看或删除您的联系信息。</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
