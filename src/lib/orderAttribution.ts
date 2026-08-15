/**
 * 「这一单是碗妈 bot 带来的吗」—— 归因的客户端粘合层。
 *
 * 背景：v3 方案里唯一没验证过的假设是「客户到底肯不肯点 WhatsApp 里的下单链接」。
 * 要回答它，订单本身必须带上来源标记，否则两周后我们仍然只能靠感觉。
 *
 * 链路：/o 页从 URL 读 ref/lead → 存 sessionStorage → CartDrawer 结账时随
 * payload 上传 → /api/submit-order 落到订单文档的 orderSource / waLeadToken。
 *
 * 用 sessionStorage 而不是 localStorage：归因只该属于「这一次从 WhatsApp 点进来
 * 的浏览会话」。localStorage 会让三周后自己上网站下的单还挂着 bot 的功劳。
 *
 * 安全边界：这两个字段**纯统计**，不参与计价、不参与权限。伪造它最多是把自己
 * 的订单标错来源。服务端仍然会做长度/白名单裁剪。
 */

const KEY = 'incredibowl_order_attribution';

export interface OrderAttribution {
  /** 来源渠道，目前只有 'wa'（碗妈 WhatsApp bot）。 */
  ref: string;
  /** waLeads 文档的 clickToken，用来把订单接回具体那条对话。 */
  leadToken: string;
}

export function setOrderAttribution(a: Partial<OrderAttribution>): void {
  const clean: OrderAttribution = {
    ref: String(a.ref || '').slice(0, 16).replace(/[^a-zA-Z0-9_-]/g, ''),
    leadToken: String(a.leadToken || '').slice(0, 32).replace(/[^a-z0-9]/gi, ''),
  };
  if (!clean.ref && !clean.leadToken) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* 无痕 / storage 满 —— 丢掉归因，绝不阻断下单 */
  }
}

export function readOrderAttribution(): OrderAttribution | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const ref = String(p?.ref || '');
    const leadToken = String(p?.leadToken || '');
    if (!ref && !leadToken) return null;
    return { ref, leadToken };
  } catch {
    return null;
  }
}

export function clearOrderAttribution(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
