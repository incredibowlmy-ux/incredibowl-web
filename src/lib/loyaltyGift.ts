/**
 * 回头客赠品 —— 判定「哪张单该多送一份薯煎蛋B」。
 *
 * 老板 2026-09-30 定的规矩：
 *   - 用餐券付款的单（Subscription）：每 5 个配送日送一份
 *   - 其余现金 / FPX / QR 单（Pay-as-you-order）：每 3 个配送日送一份
 *   - 送完重新数（= 第 3、6、9… 天送），一个配送日只算 1 次（午+晚也只算 1）
 *   - 上线日所有人从 0 开始数，不追溯历史
 *
 * 与新客首单赠品（lib/newCustomerGift.ts）同一套做法：**只在备餐层派生**，
 * 订单文档一个字节不改，客人端完全看不到。份量也同为薯煎蛋B。
 *
 * ── 口径细节 ──────────────────────────────────────────────
 * - 客户身份用 customerKeyOf（电话优先退回 uid），原因见 newCustomerGift.ts。
 * - 餐券单和现金单**各数各的**：同一个人两种都下，两个计数器互不影响。
 * - 同一天同类单有两张 → 赠品挂在当天最早那张（午先于晚，再看 createdAt、id），
 *   保证同样的数据永远标同一张。
 * - 按配送日数，而新单的配送日总在未来 → 已经送过的日子计数不会被新单改动。
 */
import type { Firestore } from 'firebase-admin/firestore';
import { customerKeyOf } from './newCustomerGift';
import { isLunchOrder } from './prepIngredients';

/** 只数配送日 >= 这天的单（活动起始日，所有人从 0 开始）。 */
export const LOYALTY_GIFT_SINCE = '2026-10-01';

export type LoyaltyType = 'voucher' | 'payg';

/** 每几个配送日送一份。 */
export const LOYALTY_GIFT_EVERY: Record<LoyaltyType, number> = { voucher: 5, payg: 3 };

/** 用了至少一张餐券 = Subscription（含券+现金补差的单）。 */
export function loyaltyTypeOf(o: { mealVouchersUsed?: unknown }): LoyaltyType {
  return Number(o?.mealVouchersUsed) > 0 ? 'voucher' : 'payg';
}

/** 没吃到 / 没付钱的单不算数。 */
export function countsTowardLoyalty(o: { status?: string; paymentMethod?: string }): boolean {
  if (o.status === 'cancelled' || o.status === 'refunded') return false;
  if (o.status === 'pending' && o.paymentMethod === 'fpx') return false;
  return true;
}

export interface LoyaltyCandidate {
  id: string;
  /** customerKeyOf() 的结果 */
  key: string;
  deliveryDate: string;
  type: LoyaltyType;
  isLunch: boolean;
  createdAtMs: number;
}

/** 同一天两张单谁先：午先于晚 → createdAt → id。 */
function isEarlierSameDay(a: LoyaltyCandidate, b: LoyaltyCandidate): boolean {
  if (a.isLunch !== b.isLunch) return a.isLunch;
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs < b.createdAtMs;
  return a.id < b.id;
}

/**
 * 纯函数：从在效订单里挑出应当赠送的 doc id。调用方负责先滤掉
 * countsTowardLoyalty() 为 false 的单。
 */
export function selectLoyaltyGiftIds(candidates: LoyaltyCandidate[]): Set<string> {
  // key|type → 配送日 → 当天代表单
  const buckets = new Map<string, Map<string, LoyaltyCandidate>>();
  for (const c of candidates) {
    if (!c.key || !c.deliveryDate || c.deliveryDate < LOYALTY_GIFT_SINCE) continue;
    const bk = `${c.key}|${c.type}`;
    let days = buckets.get(bk);
    if (!days) buckets.set(bk, (days = new Map()));
    const cur = days.get(c.deliveryDate);
    if (!cur || isEarlierSameDay(c, cur)) days.set(c.deliveryDate, c);
  }

  const ids = new Set<string>();
  for (const days of buckets.values()) {
    const ordered = [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const every = LOYALTY_GIFT_EVERY[ordered[0][1].type];
    ordered.forEach(([, c], i) => {
      if ((i + 1) % every === 0) ids.add(c.id);
    });
  }
  return ids;
}

function toMillis(v: unknown): number {
  if (!v) return 0;
  const t = v as { toMillis?: () => number; _seconds?: number; seconds?: number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  const s = t._seconds ?? t.seconds;
  return typeof s === 'number' ? s * 1000 : 0;
}

// 与 newCustomerGift 同理：备餐单/盘点可能被连点几次，60 秒短缓存挡重复扫。
const CACHE_TTL_MS = 60_000;
let cache: { at: number; ids: Set<string> } | null = null;

/** 返回应当赠送回头客薯煎蛋B的订单 doc id 集合。 */
export async function loadLoyaltyGiftIds(
  db: Firestore,
  opts: { force?: boolean } = {},
): Promise<Set<string>> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.at < CACHE_TTL_MS) return cache.ids;

  const snap = await db
    .collection('orders')
    .where('deliveryDate', '>=', LOYALTY_GIFT_SINCE)
    .select('userPhone', 'userId', 'deliveryDate', 'createdAt', 'status',
      'paymentMethod', 'mealVouchersUsed', 'mealType', 'deliveryTime')
    .get();

  const candidates: LoyaltyCandidate[] = [];
  for (const doc of snap.docs) {
    const o = doc.data() || {};
    if (!countsTowardLoyalty(o)) continue;
    candidates.push({
      id: doc.id,
      key: customerKeyOf(o),
      deliveryDate: String(o.deliveryDate || ''),
      type: loyaltyTypeOf(o),
      isLunch: isLunchOrder(o),
      createdAtMs: toMillis(o.createdAt),
    });
  }

  const ids = selectLoyaltyGiftIds(candidates);
  cache = { at: now, ids };
  return ids;
}

/** 测试用：清掉缓存。 */
export function _resetLoyaltyGiftCache(): void {
  cache = null;
}
