"use client";

import React from 'react';
import Link from 'next/link';

export default function RefundPolicy() {
    return (
        <div className="min-h-screen bg-[#FEFAE0] text-[#264653] font-sans p-8 md:p-20">
            <div className="max-w-4xl mx-auto bg-white rounded-[40px] p-12 shadow-xl">
                <Link href="/" className="text-[#E76F51] font-bold mb-8 inline-block">← Back to Home / 返回首页</Link>
                <h1 className="text-4xl font-black mb-4 text-[#E76F51]">Refund & Cancellation Policy / 退款与取消政策</h1>
                <p className="text-sm opacity-60 mb-10">Effective Date / 生效日期：2026年5月11日</p>

                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold mb-4">1. Ala Carte Orders / 单点订单</h2>
                        <div className="space-y-4">
                            <p><strong>A. Cancellation / 取消：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Orders must be canceled before <strong>06:00 AM</strong> on the day of delivery. / 必须在用餐当天 <strong>06:00 AM</strong> 前取消。</li>
                                <li>Cancellations before the cutoff will receive <strong>100% Store Credit (Vouchers)</strong>, valid for <strong>30 days</strong>. No cash refunds. / 截止时间前取消可获得 <strong>100% 店铺抵用券</strong>，有效期 <strong>30天</strong>。不提供现金退款。</li>
                                <li>No refunds or credits for cancellations after 06:00 AM. / 06:00 AM 后取消将不予退款或补偿。</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">2. Subscription Plans / 订阅计划</h2>
                        <div className="space-y-4">
                            <p><strong>A. Cancellation / 取消：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Subscription cancellations will be refunded in <strong>100% Store Credit (Vouchers)</strong> for the remaining value, valid for <strong>30 days</strong>. No cash refunds. / 订阅取消后的余额将以 <strong>100% 店铺抵用券</strong> 形式退还，有效期 <strong>30天</strong>。不提供现金退款。</li>
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

                    <section>
                        <h2 className="text-2xl font-bold mb-4">4. Food Quality Issues / 食品质量问题</h2>
                        <div className="space-y-4">
                            <p>If you receive the wrong dish or encounter a food quality issue: / 若您收到错误的餐品或遇到食品质量问题：</p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Please report to us <strong>within the same day of delivery</strong> via WhatsApp with photos if possible. / 请在<strong>收餐当天内</strong>通过 WhatsApp 联系我们，尽量附上照片。</li>
                                <li>Verified issues will be compensated with <strong>100% Store Credit</strong> or <strong>Free Re-delivery</strong>. / 经核实的问题将获得 <strong>100% 店铺抵用券</strong> 或 <strong>免费补送</strong>。</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">5. Partial Order Issues / 部分订单问题</h2>
                        <div className="space-y-4">
                            <p>If only part of your order is affected (e.g., 1 out of 3 meals), the refund or credit applies only to the affected item(s). / 若订单中仅部分餐品存在问题（如3份中的1份），退款或抵用券仅适用于受影响的餐品。</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4">6. Meal Voucher Bundles / 餐券预付包</h2>
                        <div className="space-y-4">
                            <p><strong>A. Voucher Purchase / 餐券购买：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>Meal voucher bundles (5 / 10 / 20 vouchers) are <strong>prepaid and non-refundable in cash</strong>. / 餐券包（5 / 10 / 20 张装）为<strong>预付商品，不提供现金退款</strong>。</li>
                                <li>Validity depends on the bundle: <strong>5-pack and 10-pack are valid for 30 days</strong>; <strong>20-pack is valid for 60 days</strong> from the purchase date. Expired vouchers are forfeited; no extensions or partial refunds. / 有效期按组合不同：<strong>5 张装和 10 张装有效期 30 天</strong>；<strong>20 张装有效期 60 天</strong>，自购买日起算，过期作废，不可延期或退款。</li>
                                <li>Vouchers are <strong>non-transferable</strong> — they can only be used by the account that purchased them. / 餐券<strong>不可转让</strong>，仅限购买账号本人使用。</li>
                                <li>If a QR-payment voucher purchase is <strong>rejected by us</strong> due to failed verification (e.g., receipt mismatch), we will issue a <strong>100% cash refund</strong> via DuitNow within 3 working days. / 若 QR 付款的餐券购买被我方<strong>拒绝</strong>（如凭证不符），我们将在 3 个工作日内通过 DuitNow <strong>100% 现金退还</strong>。</li>
                            </ul>
                            <p className="mt-4"><strong>B. Cancelling a Food Order Paid with Vouchers / 用券订单取消：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li><strong>Customer-initiated cancellation</strong> (before 06:00 AM cutoff): used vouchers are <strong>automatically returned to your wallet</strong> with their original expiry date intact. No cash refund. / 客户主动取消（06:00 AM 前）：所抵扣的餐券<strong>自动退回钱包</strong>，到期日保持不变。不提供现金退款。</li>
                                <li><strong>Cancellation due to our fault</strong> (kitchen unavailable, more than 90 min delay, etc.): vouchers are returned to wallet AND you may opt for an equivalent cash refund of the food portion. / 我方原因取消（厨房不可用、延误超 90 分钟等）：餐券退回钱包，同时您可选择等额现金退款。</li>
                            </ul>
                            <p className="mt-4"><strong>C. Voucher Coverage / 抵扣范围：</strong></p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li>1 voucher = 1 main dish (any item from the menu). <strong>Add-ons (drinks, sides, eggs, etc.) require cash payment</strong> and are not covered by vouchers. / 1 张餐券 = 1 份主餐（任意菜单菜品）。<strong>加购项（饮料、加料、蛋等）需现金支付</strong>，不在抵扣范围内。</li>
                                <li>Vouchers <strong>cannot be combined with promo codes</strong> (referral / points-redemption / custom codes) on the same order. / 餐券<strong>不可与优惠码同时使用</strong>（包括推荐码、积分券、自定义码）。</li>
                            </ul>
                        </div>
                    </section>

                    <section className="bg-orange-50 p-8 rounded-3xl border-2 border-[#F4A261]/20">
                        <h2 className="text-2xl font-bold mb-4">Contact Us / 联系我们</h2>
                        <p>For any issues, please WhatsApp us immediately. / 如需协助，请立即联系：</p>
                        <p className="text-xl font-bold mt-2">WhatsApp: 010-337 0197</p>
                        <p className="font-bold">Email: hello@incredibowl.my</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
