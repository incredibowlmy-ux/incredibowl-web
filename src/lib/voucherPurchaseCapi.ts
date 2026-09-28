/**
 * 餐券包购买 → Meta CAPI Purchase 的**唯一入口**
 * ---------------------------------------------------------------
 * 2026-09-29 修的漏：在这之前，买餐券包一个 Purchase 事件都不发
 * （create-purchase / confirm-purchase / webhook / admin 两条确认路，
 * 全都没有 sendCapiEvent 也没有 fbq）。而 confirm-order 里对「用券
 * 付清、现金 0」的订单是**故意跳过** Purchase 的，注释写的理由是
 * 「买券时已经发过了」—— 那个前提当时并不成立。
 *
 * 两头都不发 = 餐券这条现金流对 Meta 完全隐形。每周 RM1,200–2,700
 * 的券款算不进 ROAS，Meta 学到的客单价只有补差额那几块钱，于是按
 * 一个错的目标去找人。这就是 09 月上报客单价只有 RM10.63 的来源。
 *
 * 修法：券款在「首次转成 paid」的那一刻发一次 Purchase，value = 实付
 * 金额。事件 id 固定为 `voucher_<purchaseId>`，所以 FPX 浏览器确认与
 * Razorpay webhook 抢着跑、或 admin 重复点确认，Meta 都会收敛成一条。
 * 修完之后 confirm-order 那个「用券下单跳过」才真的是对的，不会双算。
 *
 * ⚠️ action_source 必须诚实：网站上买的是 'website'，老板在 dashboard
 * 手工开的券（客户从 WhatsApp 谈成）是 'business_messaging'。给手工单
 * 传 'website' 会把线下成交混进网站漏斗的统计里。
 *
 * ⚠️ 绝不要把**老板**的 fbp/fbc/IP/UA 当成客户的传进来。QR 核收据和
 * 手工开券这两条路，发起请求的浏览器是老板的；那种情况只传客户的
 * 身份字段（email / phone / uid），浏览器上下文留空。
 */

import { sendCapiEvent, type CapiActionSource } from '@/lib/meta-capi';

export interface VoucherPurchaseCapiInput {
  /** mealVoucherPurchases 文档 id —— 同时是事件去重键。 */
  purchaseId: string;
  /** 客户实付（已扣优惠码）。<= 0 不发事件。 */
  amountPaid: number;
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  /** 默认 'website'。手工开券传 'business_messaging'。 */
  actionSource?: CapiActionSource;
  /**
   * 只有「客户自己的浏览器发起的请求」才填这个。webhook（Razorpay 的
   * IP）、admin 核收据（老板的浏览器）一律留空。
   */
  browser?: {
    fbp?: string;
    fbc?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    eventSourceUrl?: string;
  };
}

/**
 * 发一条餐券购买的 Purchase。永不抛错 —— 券已经铸出来、钱已经收了，
 * 一个追踪事件失败不能把流程带崩。
 */
export async function sendVoucherPurchaseCapi(
  input: VoucherPurchaseCapiInput,
): Promise<void> {
  const value = Number(input.amountPaid) || 0;
  if (value <= 0) return; // 全额优惠码抵掉 = 没有现金流入，不该报给 Meta

  try {
    await sendCapiEvent({
      eventName: 'Purchase',
      // 固定 id：跨路径、跨重放都收敛成一条
      eventId: `voucher_${input.purchaseId}`,
      actionSource: input.actionSource || 'website',
      eventSourceUrl: input.browser?.eventSourceUrl,
      userData: {
        email: input.userEmail || undefined,
        phone: input.userPhone || undefined,
        externalId: input.userId || undefined,
        fbp: input.browser?.fbp,
        fbc: input.browser?.fbc,
        clientIpAddress: input.browser?.clientIpAddress || '',
        clientUserAgent: input.browser?.clientUserAgent || '',
      },
      customData: {
        currency: 'MYR',
        value,
        orderId: input.purchaseId,
      },
    });
  } catch (e) {
    console.warn(`[voucher-capi] purchase ${input.purchaseId} 事件发送失败:`, e);
  }
}
