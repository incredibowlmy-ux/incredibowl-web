/**
 * 新客首单赠品 —— 判定「谁是新客」。
 *
 * 老板 2026-08-10 定的规矩：每位新客户的第一张单，白送一份马铃薯煎蛋B
 * (马铃薯 37.5g + 鸡蛋 0.5 颗，见 dishIngredients.NEW_CUSTOMER_GIFT_RECIPE)。
 *
 * ── 为什么不把赠品写进订单 ──────────────────────────────────
 * 订单的 items 数组会原样出现在成功页、邮件收据、/track 追踪页和会员订单
 * 历史里 —— 塞一行进去，客人立刻看得到，而老板要的是「客人不用知道」。
 * 更糟的是它会污染一串下游口径：加料渗透率、dishStock 扣减、营收公式、
 * Meta catalogue。所以赠品**只在备餐层派生**：订单数据一个字节都不改，
 * 由这里按订单历史算出「这张单是不是某人的首单」，备餐/采购/盘点三个消费方
 * 各自把那份料加进去。要停掉这个活动 → 把 NEW_CUSTOMER_GIFT_SINCE 改成
 * 未来某天（或删掉调用），历史数据零残留。
 *
 * ── 客户身份为什么用电话不用 uid ──────────────────────────
 * 同一个人在库里可能挂多个 uid：手动单 stub (`manual_<电话>`)、匿名访客每次
 * 下单都是新 uid、匿名账号后来绑 Google 又是一个。实测 912 张单里有 8 位
 * 客户跨 2 个 uid —— 按 uid 判定这 8 位会被重复当成新客再送一次。
 * 电话优先归并是本项目一贯口径（见 manualStubAdoption / voucherValidation）。
 */
import type { Firestore } from 'firebase-admin/firestore';
import { normalizePhone } from './phoneUtils';

/**
 * 只有配送日 >= 这天的首单才送（活动起始日）。
 *
 * ⚠️ 判定「谁的首单」时会扫**全部**历史订单，这个日期只用来过滤结果 ——
 * 老客户 7 月就下过单，他今天这张不是首单，不会因为活动开始就补送。
 * 反过来，翻看活动前的备餐单也不会凭空多出赠品。
 */
export const NEW_CUSTOMER_GIFT_SINCE = '2026-08-10';

/** 订单里能认出「这是同一个人」的键：电话优先，退回 uid。认不出 → 空串。 */
export function customerKeyOf(o: {
  userPhone?: string | null;
  userId?: string | null;
}): string {
  return normalizePhone(o?.userPhone) || String(o?.userId || '').trim();
}

/** Firestore Timestamp / 序列化过的 Timestamp / 空 → 毫秒。 */
function toMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; _seconds?: number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  const s = t._seconds ?? t.seconds;
  return typeof s === 'number' ? s * 1000 : 0;
}

export interface Candidate {
  id: string;
  /** customerKeyOf() 的结果：电话优先，退回 uid */
  key: string;
  deliveryDate: string;
  createdAtMs: number;
}

/**
 * 谁更早？按 **配送日** 排先后，不是下单时间 ——「首单赠品」要落在客人**第一次
 * 吃到**的那碗上。同一天下两张（拆单/订阅批量建单）再看 createdAt，最后按 id
 * 定序保证结果稳定：同样的数据永远选中同一张单，不会今天标 A 明天标 B。
 */
function isEarlier(a: Candidate, b: Candidate): boolean {
  const da = a.deliveryDate || '9999-99-99';
  const dbb = b.deliveryDate || '9999-99-99';
  if (da !== dbb) return da < dbb;
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs < b.createdAtMs;
  return a.id < b.id;
}

// 全量扫一次 orders（select 只取 5 个字段，实测 912 单 ≈ 600ms）。备餐单和
// 库存盘点可能被连着点几次，加个短缓存挡住重复扫；60 秒足够短，新下的单
// 最多迟一分钟才被认出来，而备餐单本来就不是秒级刷新的东西。
const CACHE_TTL_MS = 60_000;
let cache: { at: number; ids: Set<string> } | null = null;

/**
 * 纯函数：从**全部在效订单**里挑出应当赠送的 doc id。
 *
 * 每位客户只留最早的一张，再按活动起始日过滤。抽成纯函数是为了能被 dogfood
 * 直打 —— 判定错一次就是漏送或重复送，不该只能靠线上数据事后发现。
 */
export function selectFirstOrderIds(candidates: Candidate[]): Set<string> {
  const firstByCustomer = new Map<string, Candidate>();
  for (const c of candidates) {
    if (!c.key) continue; // 认不出是谁 → 不送，好过乱送
    const cur = firstByCustomer.get(c.key);
    if (!cur || isEarlier(c, cur)) firstByCustomer.set(c.key, c);
  }
  const ids = new Set<string>();
  for (const c of firstByCustomer.values()) {
    if (c.deliveryDate >= NEW_CUSTOMER_GIFT_SINCE) ids.add(c.id);
  }
  return ids;
}

/**
 * 返回**应当赠送**的订单 doc id 集合 = 每位客户最早的一张在效单，且配送日
 * 落在活动期内。
 *
 * 已取消的单不算历史 —— 下过一单又取消（没吃到）的人再来，仍按新客待遇。
 */
export async function loadNewCustomerFirstOrderIds(
  db: Firestore,
  opts: { force?: boolean } = {},
): Promise<Set<string>> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.at < CACHE_TTL_MS) return cache.ids;

  const snap = await db
    .collection('orders')
    .select('userPhone', 'userId', 'deliveryDate', 'createdAt', 'status')
    .get();

  const candidates: Candidate[] = [];
  for (const doc of snap.docs) {
    const o = doc.data() || {};
    if (o.status === 'cancelled') continue;
    candidates.push({
      id: doc.id,
      key: customerKeyOf(o),
      deliveryDate: String(o.deliveryDate || ''),
      createdAtMs: toMillis(o.createdAt),
    });
  }

  const ids = selectFirstOrderIds(candidates);
  cache = { at: now, ids };
  return ids;
}

/** 测试用：清掉缓存，让下一次调用真的重扫。 */
export function _resetNewCustomerGiftCache(): void {
  cache = null;
}
