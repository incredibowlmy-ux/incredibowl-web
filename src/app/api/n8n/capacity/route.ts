import { NextRequest, NextResponse } from 'next/server';
import { isDateClosed } from '@/data/blockedDates';
import { bowlsInOrder } from '@/lib/bowlCount';

/**
 * GET /api/n8n/capacity?date=YYYY-MM-DD[&days=N] —— 团餐档期自查。
 *
 * 老板给的团餐规则是「没有硬门槛，看档期」+「一天最多 50 份」。问题是那 50 份
 * **含散客**：日均已经 ~33 碗，再接一单 32 份团餐就是 65 份，厨房直接爆。
 * 所以 bot 报团餐价之前必须先问这里 —— 这不是锦上添花，是防止 bot 替老板
 * 答应做不了的单（接了做不出比不成交严重得多）。
 *
 * 碗数口径见 lib/bowlCount.ts（加料行不算碗）。
 *
 * 返回 ready-to-use 的判断结果，n8n 不做算术：
 *   remaining / cateringMaxPax / canQuote / reason
 *
 * Auth：Bearer N8N_API_KEY（无 PII，但仍走同一套 header-only 口径）。
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/** 老板 2026-08-16 定：厨房一天最多 50 份（含散客）。 */
export const DAILY_CAPACITY = 50;
/** 老板 2026-08-16 定：周末/公假可以做团餐，但 20 份起才开火。 */
export const WEEKEND_MIN_PAX = 20;
/** 剩余低于这个数就不当场承诺，改推工单给老板人工判。 */
const TIGHT_THRESHOLD = 10;

const CANCELLED = new Set(['cancelled']);
const WD_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function ymdPlus(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}
function todayKL(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!process.env.N8N_API_KEY && !process.env.N8N_INBOUND_SECRET) {
    return NextResponse.json({ error: 'N8N_API_KEY not configured on server' }, { status: 500 });
  }
  // AI 工具节点（check_capacity）只能带 N8N_INBOUND_SECRET，见 src/lib/n8nAuth.ts
  const { n8nBearerOk } = await import('@/lib/n8nAuth');
  if (!n8nBearerOk(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dateRaw = String(url.searchParams.get('date') || '').trim();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayKL();
  const daysRaw = Number(url.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.min(14, Math.max(1, Math.floor(daysRaw))) : 1;
  const to = ymdPlus(from, days - 1);

  try {
    const db = await getDb();
    const snap = await db.collection('orders')
      .where('deliveryDate', '>=', from)
      .where('deliveryDate', '<=', to)
      .get();

    // 按日期 + 午/晚累计碗数
    const booked: Record<string, { total: number; lunch: number; dinner: number }> = {};
    for (const doc of snap.docs) {
      const o = doc.data() as Record<string, any>;
      if (CANCELLED.has(String(o.status || ''))) continue;
      const ymd = String(o.deliveryDate || '');
      if (!ymd) continue;
      const n = bowlsInOrder(o.items);
      if (n <= 0) continue;
      const slot = booked[ymd] ||= { total: 0, lunch: 0, dinner: 0 };
      slot.total += n;
      if (/dinner/i.test(String(o.deliveryTime || o.mealType || ''))) slot.dinner += n;
      else slot.lunch += n;
    }

    const out = [];
    for (let i = 0; i < days; i++) {
      const ymd = ymdPlus(from, i);
      const wd = weekdayOf(ymd);
      const isWeekend = wd === 0 || wd === 6;
      const closed = isDateClosed(ymd);
      const b = booked[ymd] || { total: 0, lunch: 0, dinner: 0 };
      const remaining = Math.max(0, DAILY_CAPACITY - b.total);

      // 团餐能不能当场报价 —— bot 直接读这两个字段，不自己判断
      let canQuote = true;
      let reason = '';
      let cateringMaxPax = remaining;
      if (closed) {
        canQuote = false; reason = '这天整天暂停接单'; cateringMaxPax = 0;
      } else if (remaining <= 0) {
        canQuote = false; reason = '这天已经排满了'; cateringMaxPax = 0;
      } else if (remaining < TIGHT_THRESHOLD) {
        canQuote = false; reason = `这天只剩 ${remaining} 份，档期很紧`;
      } else if (isWeekend) {
        // 周末能做但 20 份起；剩余不足 20 就连门槛都够不着
        if (remaining < WEEKEND_MIN_PAX) {
          canQuote = false; reason = `周末要 ${WEEKEND_MIN_PAX} 份起，这天只剩 ${remaining} 份`;
          cateringMaxPax = 0;
        } else {
          reason = `周末可以做，${WEEKEND_MIN_PAX} 份起`;
        }
      }

      out.push({
        date: ymd,
        weekday: wd,
        weekdayZh: WD_CN[wd],
        isWeekend,
        isClosed: closed,
        booked: b.total,
        bookedLunch: b.lunch,
        bookedDinner: b.dinner,
        capacity: DAILY_CAPACITY,
        remaining,
        canQuote,
        cateringMinPax: isWeekend ? WEEKEND_MIN_PAX : 0,
        cateringMaxPax,
        reason,
      });
    }

    return NextResponse.json(
      { generated_at: new Date().toISOString(), from, to, days: out },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('[n8n/capacity] failed:', err);
    // ⚠️ fail-CLOSED：档期查不到时**绝不能**让 bot 当场承诺团餐。
    // 这跟菜单端点的 fail-open 相反 —— 那边最坏是少报一道菜，这边最坏是接下做不出的单。
    return NextResponse.json({
      error: err?.message || 'capacity lookup failed',
      days: [{
        date: from, canQuote: false, cateringMaxPax: 0,
        reason: '档期系统暂时查不到，先别承诺，转老板确认',
      }],
    }, { status: 200 });
  }
}
