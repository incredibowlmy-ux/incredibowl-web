/**
 * 付款成功后给客户发 WhatsApp 订单确认（模板 order_confirmed_zh_v1 / _en_v1）。
 *
 * 为什么是模板：客户在网站下单，多半没跟碗妈聊过，24 小时窗口不存在，自由文本
 * 发不出去，只有过审模板能主动送达。费用：客户 24h 内聊过 → 免费；没聊过 → 一条
 * utility 的钱（很便宜，真数看 Meta 定价页）。
 *
 * 开关：WA_ORDER_CONFIRM=1 才发（默认关 —— 这是主动打钱出去的动作，老板拍板再开）。
 * 语言跟着 order.locale 走（memory: 通知语言跟着下单语言走）。
 * 所有失败只记日志，绝不影响订单确认本身。
 */
import { sendTemplate } from '@/lib/waSend';
import { appendTurn } from '@/lib/waWebhook';

export const ORDER_CONFIRM_TEMPLATE = { zh: 'order_confirmed_zh_v1', en: 'order_confirmed_en_v1' } as const;

export function isOrderConfirmEnabled(): boolean {
  return process.env.WA_ORDER_CONFIRM === '1';
}

/** 订单短号：与 dashboard / 收据一致（末 6 位大写）。 */
export const shortId = (id: string) => String(id || '').slice(-6).toUpperCase();

const TIME_ZH: Record<string, string> = { 'Lunch (11AM-1PM)': '午餐 11:00–13:00', 'Dinner (5PM-8PM)': '晚餐 17:00–20:00' };
const TIME_EN: Record<string, string> = { 'Lunch (11AM-1PM)': 'lunch 11:00–13:00', 'Dinner (5PM-8PM)': 'dinner 17:00–20:00' };
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** {{3}} 送达：中文「9 月 10 日午餐 11:00–13:00」/ 英文「Sep 10, lunch 11:00–13:00」。 */
export function deliveryLabel(ymd: string, time: string, locale: 'zh' | 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  const t = locale === 'en' ? (TIME_EN[time] ?? String(time || '')) : (TIME_ZH[time] ?? String(time || ''));
  if (!m) return t || (locale === 'en' ? 'as scheduled' : '按排期');
  const mo = Number(m[2]), d = Number(m[3]);
  return locale === 'en' ? `${MONTH_EN[mo - 1]} ${d}${t ? ', ' + t : ''}` : `${mo} 月 ${d} 日${t}`;
}

/** 三个变量：名字 / 短号 / 送达。名字空则用中性称呼。 */
export function orderConfirmParams(orderId: string, o: Record<string, any>): { locale: 'zh' | 'en'; params: [string, string, string] } {
  const locale: 'zh' | 'en' = o?.locale === 'en' ? 'en' : 'zh';
  const name = String(o?.userName || '').trim() || (locale === 'en' ? 'there' : '朋友');
  return { locale, params: [name.slice(0, 60), shortId(orderId), deliveryLabel(o?.deliveryDate, o?.deliveryTime, locale)] };
}

export function normalizePhone(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '60' + d.slice(1);
  return /^60\d{8,10}$/.test(d) ? d : '';
}

/**
 * 对一批「第一次确认」的订单各发一条。回 {sent, skipped}，不抛。
 * 同一 groupId 的多日单只发第一单（客户一次结账收一条就够了）。
 */
export async function sendOrderConfirmations(
  db: FirebaseFirestore.Firestore,
  orders: Array<{ id: string; data: Record<string, any> }>,
): Promise<{ sent: number; skipped: number }> {
  if (!isOrderConfirmEnabled() || !orders.length) return { sent: 0, skipped: orders.length };
  const seenGroup = new Set<string>();
  let sent = 0, skipped = 0;
  for (const { id, data } of orders) {
    const phone = normalizePhone(data?.userPhone);
    const group = String(data?.groupId || id);
    if (!phone || seenGroup.has(group)) { skipped++; continue; }
    seenGroup.add(group);
    const { locale, params } = orderConfirmParams(id, data);
    try {
      const r = await sendTemplate(phone, ORDER_CONFIRM_TEMPLATE[locale], locale === 'en' ? 'en' : 'zh_CN', params);
      if (!r.ok) { console.warn('[waOrderConfirm] 发送失败', phone, r.error); skipped++; continue; }
      sent++;
      // 记进对话记录（带 wamid → 回执会落回来）；waLeads 不存在就建一个最小文档
      const ref = db.collection('waLeads').doc(phone);
      const snap = await ref.get();
      const prev = (snap.exists ? snap.data() : {}) as Record<string, any>;
      const now = Date.now();
      const text = locale === 'en'
        ? `Hi ${params[0]}, order #${params[1]} is confirmed ✅ Delivery: ${params[2]}. Reply here if anything changes.`
        : `你好 ${params[0]}，订单 #${params[1]} 已收到 ✅ 送达：${params[2]}。有问题直接回复这条消息。`;
      await ref.set({
        phone, lastMsgMs: now, updatedAtMs: now,
        ...(snap.exists ? {} : { name: String(data?.userName || ''), lang: locale, status: 'ordered', firstSeenMs: now }),
        turns: appendTurn(prev.turns, 'out', text, now, r.msgId ? { msgId: r.msgId, status: 'sent', statusAtMs: now } : undefined),
      }, { merge: true });
    } catch (e: any) {
      console.warn('[waOrderConfirm] 异常', phone, String(e?.message || e).slice(0, 160));
      skipped++;
    }
  }
  return { sent, skipped };
}
