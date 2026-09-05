import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import SetHtmlLang from '@/components/home-en/SetHtmlLang';
import PageShell from '@/components/layout/PageShell';

// 英文版退款与取消政策：内容 = /refund 中英对照页的英文半，无新增主张。
export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy · Incredibowl',
    description: 'Incredibowl Refund & Cancellation Policy: order cancellation, refund conditions and process.',
    alternates: {
        canonical: '/en/refund',
        languages: { 'zh-MY': '/refund', 'en-MY': '/en/refund', 'x-default': '/refund' },
    },
};

export default function RefundPolicyEN() {
    return (
        <PageShell locale="en">
          <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans p-8 md:p-20">
              <SetHtmlLang />
              <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                  <h1 className="text-4xl font-black mb-4 text-[#FF6B35]">Refund & Cancellation Policy</h1>
                  <p className="text-sm opacity-60 mb-10">Effective Date: 11 May 2026</p>

                  <div className="space-y-12 leading-relaxed">
                      <section>
                          <h2 className="text-2xl font-bold mb-4">1. Ala Carte Orders</h2>
                          <div className="space-y-4">
                              <p><strong>A. Cancellation:</strong></p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>Orders must be canceled before <strong>06:00 AM</strong> on the day of delivery.</li>
                                  <li>Cancellations before the cutoff will receive <strong>100% Store Credit (Vouchers)</strong>, valid for <strong>30 days</strong>. No cash refunds.</li>
                                  <li>No refunds or credits for cancellations after 06:00 AM.</li>
                              </ul>
                          </div>
                      </section>

                      <section>
                          <h2 className="text-2xl font-bold mb-4">2. Subscription Plans</h2>
                          <div className="space-y-4">
                              <p><strong>A. Cancellation:</strong></p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>Subscription cancellations will be refunded in <strong>100% Store Credit (Vouchers)</strong> for the remaining value, valid for <strong>30 days</strong>. No cash refunds.</li>
                              </ul>
                          </div>
                      </section>

                      <section>
                          <h2 className="text-2xl font-bold mb-4">3. Service Recovery (Our Fault)</h2>
                          <div className="space-y-4">
                              <p>If your order is delayed by more than <strong>90 minutes</strong> or we are unable to fulfill it:</p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>We offer a <strong>100% Cash Refund</strong> OR a <strong>Free Re-delivery/Replacement</strong>.</li>
                              </ul>
                          </div>
                      </section>

                      <section>
                          <h2 className="text-2xl font-bold mb-4">4. Food Quality Issues</h2>
                          <div className="space-y-4">
                              <p>If you receive the wrong dish or encounter a food quality issue:</p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>Please report to us <strong>within the same day of delivery</strong> via WhatsApp with photos if possible.</li>
                                  <li>Verified issues will be compensated with <strong>100% Store Credit</strong> or <strong>Free Re-delivery</strong>.</li>
                              </ul>
                          </div>
                      </section>

                      <section>
                          <h2 className="text-2xl font-bold mb-4">5. Partial Order Issues</h2>
                          <div className="space-y-4">
                              <p>If only part of your order is affected (e.g., 1 out of 3 meals), the refund or credit applies only to the affected item(s).</p>
                          </div>
                      </section>

                      <section>
                          <h2 className="text-2xl font-bold mb-4">6. Meal Voucher Bundles</h2>
                          <div className="space-y-4">
                              <p><strong>A. Voucher Purchase:</strong></p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>Meal voucher bundles (5 / 10 / 20 vouchers) are <strong>prepaid and non-refundable in cash</strong>.</li>
                                  <li>Validity depends on the bundle: <strong>5-pack and 10-pack are valid for 30 days</strong>; <strong>20-pack is valid for 60 days</strong> from the purchase date. Expired vouchers are forfeited; no extensions or partial refunds.</li>
                                  <li>Vouchers are <strong>non-transferable</strong> — they can only be used by the account that purchased them.</li>
                                  <li>If a QR-payment voucher purchase is <strong>rejected by us</strong> due to failed verification (e.g., receipt mismatch), we will issue a <strong>100% cash refund</strong> via DuitNow within 3 working days.</li>
                              </ul>
                              <p className="mt-4"><strong>B. Cancelling a Food Order Paid with Vouchers:</strong></p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li><strong>Customer-initiated cancellation</strong> (before 06:00 AM cutoff): used vouchers are <strong>automatically returned to your wallet</strong> with their original expiry date intact. No cash refund.</li>
                                  <li><strong>Cancellation due to our fault</strong> (kitchen unavailable, more than 90 min delay, etc.): vouchers are returned to wallet AND you may opt for an equivalent cash refund of the food portion.</li>
                              </ul>
                              <p className="mt-4"><strong>C. Voucher Coverage:</strong></p>
                              <ul className="list-disc ml-6 space-y-2">
                                  <li>1 voucher = 1 main dish (any item from the menu). Premium dishes above RM 19.90 use one voucher plus a cash top-up for the difference (the voucher covers RM 19.90). <strong>Add-ons (drinks, sides, eggs, etc.) require cash payment</strong> and are not covered by vouchers.</li>
                                  <li>Vouchers <strong>cannot be combined with promo codes</strong> (referral / points-redemption / custom codes) on the same order.</li>
                              </ul>
                          </div>
                      </section>

                      <section className="bg-orange-50 p-8 rounded-3xl border-2 border-[#F4A261]/20">
                          <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                          <p>For any issues, please WhatsApp us immediately.</p>
                          <p className="text-xl font-bold mt-2">WhatsApp: 010-337 0197</p>
                          <p className="font-bold">Email: hello@incredibowl.my</p>
                      </section>
                  </div>
              </div>
          </div>
        </PageShell>
    );
}
