/**
 * 订单确认 → 把对应的碗妈对话标成「已成交」。
 *
 * 为什么要有：收件箱的「已成交」筛选只认 waLeads.status === 'ordered'，而 2026-09-30 之前
 * 没有任何一条路会写它（n8n 的 action=ordered 从没被调用）→ 那个 tab 永远是空的，
 * 且已下单的客户照样被追单。这里把「订单第一次确认」接上去。
 *
 * 只动**已经存在**的 waLeads 文档：没跟碗妈聊过的客户不该凭空出现在收件箱里。
 * 手动录的单不经过 /api/confirm-order，靠收件箱的「标记成交」按钮补。
 * 所有失败只记日志，绝不影响订单确认本身。
 */
import { appendTurn } from '@/lib/waWebhook';
import { mutateLead } from '@/lib/waInbox';

const COL = 'waLeads';

/** 订单上的电话 → waLeads 的 doc id（国际格式纯数字）。认不出就回空串。 */
export function leadPhoneId(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '60' + d.slice(1);
  return d.length >= 9 && d.length <= 15 ? d : '';
}

/** 订单短号：与 dashboard / 收据一致（末 6 位大写）。 */
const shortId = (id: string) => String(id || '').slice(-6).toUpperCase();

/**
 * 对一批「第一次确认」的订单，把同号码的对话标成已成交。回标记了几条，不抛。
 * 同一个号码一批里只处理一次（多日单共用一个电话）。
 */
export async function markLeadsOrdered(
  db: FirebaseFirestore.Firestore,
  orders: Array<{ id: string; data: Record<string, any> }>,
): Promise<number> {
  const seen = new Set<string>();
  let marked = 0;
  for (const { id, data } of orders) {
    const phone = leadPhoneId(data?.userPhone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    try {
      const ref = db.collection(COL).doc(phone);
      const now = Date.now();
      let done = false;
      await mutateLead(ref, (prev, exists) => {
        done = exists;
        if (!exists) return null;
        return {
          status: 'ordered',
          nextNudgeMs: 0,
          closedReason: 'order_confirmed',
          orderId: String(id).slice(0, 64),
          closedAtMs: now,
          updatedAtMs: now,
          // 常客天天下单：已经是已成交就不再叠系统行，免得把真实对话挤出 turns 上限
          ...(prev.status === 'ordered' ? {} : {
            turns: appendTurn(prev.turns, 'sys', `订单 #${shortId(id)} 已确认，自动标记成交，停止追单`, now),
          }),
        };
      });
      if (done) marked++;
    } catch (e: any) {
      console.warn('[waLeadStatus] 标记成交失败', phone, String(e?.message || e).slice(0, 160));
    }
  }
  return marked;
}
