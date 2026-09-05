import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import SetHtmlLang from '@/components/home-en/SetHtmlLang';

// 英文版隐私政策：内容 = /privacy 中英对照页的英文半，无新增主张。
export const metadata: Metadata = {
    title: 'Privacy Policy · Incredibowl',
    description: 'Incredibowl (Incredibowl Services SA0649425-V) Privacy Policy: how we collect, use and protect your personal data.',
    alternates: {
        canonical: '/en/privacy',
        languages: { 'zh-MY': '/privacy', 'en-MY': '/en/privacy', 'x-default': '/privacy' },
    },
};

export default function PrivacyPolicyEN() {
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans p-8 md:p-20">
            <SetHtmlLang />
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/en" className="text-[#FF6B35] font-bold mb-8 inline-block">← Back to Home</Link>
                <h1 className="text-4xl font-black mb-4 text-[#FF6B35]">Privacy Policy</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date: 17 March 2026</p>

                <div className="space-y-12 leading-relaxed text-sm">
                    <section>
                        <h2 className="text-xl font-bold mb-4">1. Data Collection</h2>
                        <p>We collect your Name, Phone Number, and Address solely for order fulfillment.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">2. Usage & Third-Party Services</h2>
                        <p>Your data is used to process payments and communicate order updates. We use the following third-party services:</p>
                        <ul className="list-disc ml-6 mt-2 space-y-2">
                            <li><strong>Firebase (Google)</strong> — Order storage and user authentication</li>
                            <li><strong>Curlec by Razorpay</strong> — Online payment processing</li>
                            <li><strong>WhatsApp (Meta)</strong> — Order communication and customer support</li>
                        </ul>
                        <p className="mt-2">These services have their own privacy policies. We encourage you to review them.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">3. Data Protection</h2>
                        <p>We never sell your data. Only authorized team members access your delivery info.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">4. Your Rights</h2>
                        <p>You may request to view or delete your contact info at any time by contacting us:</p>
                        <ul className="list-disc ml-6 mt-2 space-y-1">
                            <li>WhatsApp: <strong>010-337 0197</strong></li>
                            <li>Email: <strong>hello@incredibowl.my</strong></li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">5. Data Retention</h2>
                        <p>We retain order data for up to 12 months for operational and accounting purposes. After this period, personal data is deleted or anonymized.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-4">6. Cookies & Analytics</h2>
                        <p>Our website may use basic analytics to understand site traffic. We do not use advertising cookies or tracking pixels. No personal data is shared with advertisers.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
