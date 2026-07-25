import { NextRequest, NextResponse } from 'next/server';
import { FACE_VALUE_RM } from '@/data/mealVoucherConfig';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

async function verifyAdmin(req: NextRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    // Ensure Admin app is initialized before calling getAuth()
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: '未授权访问' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const [ordersSnap, usersSnap, feedbacksSnap, mealVoucherPurchasesSnap, mealVouchersSnap, addonCreditsSnap] = await Promise.all([
      db.collection('orders').orderBy('createdAt', 'desc').get(),
      db.collection('users').orderBy('createdAt', 'desc').get(),
      db.collection('feedbacks').get(),
      db.collection('mealVoucherPurchases').orderBy('createdAt', 'desc').get(),
      db.collection('mealVouchers').get(),
      db.collection('mealVoucherAddonCredits').get(),
    ]);

    // ── 清理超时未付的 FPX 单 ───────────────────────────────
    // 2026-07-26 修复（审计 P1-1 + P1-2）。原来这里有两个问题：
    //   ① 门槛 10 分钟，违背老板 07-02 拍板的 1 小时，且抢在 release-stale-fpx
    //      前面把单挪走 —— 实测那个对账任务从上线到今天一次都没扫到过东西。
    //   ② 裸 `doc.ref.update({status:'cancelled'})`，餐券 / 预付 credit /
    //      promo 券 / dishStock / ingredientStock 一样都不退。实测 8 笔漏账
    //      走的就是这条路（猪扒 07-19~23 漏 3 份，直到 07-25 手动重设才抹平）。
    // 现在：门槛对齐 1 小时，并走与 confirm-order / release-stale-fpx 共用的
    // cancelOrderWithRollback（事务幂等，重复刷新 Dashboard 不会重复回补）。
    const staleCutoff = Date.now() - 60 * 60 * 1000;
    const staleIds: string[] = [];
    for (const doc of ordersSnap.docs) {
      const d = doc.data();
      if (d.status !== 'pending' || d.paymentMethod !== 'fpx' || !d.createdAt) continue;
      const orderTime = (d.createdAt._seconds ?? d.createdAt.seconds ?? 0) * 1000;
      if (orderTime > 0 && orderTime < staleCutoff) staleIds.push(doc.id);
    }
    const autoCancelled = new Set<string>();
    if (staleIds.length > 0) {
      const { cancelOrderWithRollback } = await import('@/lib/orderRollback');
      for (const id of staleIds) {
        try {
          const r = await cancelOrderWithRollback(db, id, { reason: 'fpx-timeout-dashboard(1h)' });
          if (r.cancelled) autoCancelled.add(id);
        } catch (e) {
          // 单笔失败不能拖垮整个 dashboard 数据接口
          console.error(`[admin/data] 自动取消 ${id} 失败:`, e);
        }
      }
    }

    const orders = ordersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // 刚被取消的单在本次响应里就反映出来，不用等下次刷新
      ...(autoCancelled.has(doc.id) ? { status: 'cancelled' } : {}),
    }));
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const feedbacks = feedbacksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const mealVoucherPurchases = mealVoucherPurchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ── Meal voucher liability aggregates ─────────────────────
    // Two parallel valuations per voucher:
    //   - Allocated value (MFRS 15 contract liability) = amountPaid / voucherCount
    //   - Face value      (food obligation, marketing) = FACE_VALUE_RM
    // Legacy vouchers (minted before 2026-05-11) have no allocatedValueRM —
    // fall back to face value to avoid under-reporting liability.
    const now = Date.now();
    const FOURTEEN_DAYS_MS = 14 * 86_400_000;
    let outstandingCount = 0;
    let outstandingAllocatedRM = 0;
    let expiringSoonCount = 0;
    let expiringSoonAllocatedRM = 0;
    let redeemedLifetimeCount = 0;
    let redeemedLifetimeAllocatedRM = 0;
    let expiredLifetimeCount = 0;
    let expiredLifetimeAllocatedRM = 0;
    for (const doc of mealVouchersSnap.docs) {
      const v = doc.data() as {
        status?: string;
        expiresAt?: { toMillis?: () => number };
        allocatedValueRM?: number;
      };
      const allocatedRM = typeof v.allocatedValueRM === 'number' ? v.allocatedValueRM : FACE_VALUE_RM;
      const expMs = v.expiresAt?.toMillis ? v.expiresAt.toMillis() : 0;
      const isExpired = !expMs || expMs <= now;
      if (v.status === 'available' && !isExpired) {
        outstandingCount++;
        outstandingAllocatedRM += allocatedRM;
        if (expMs - now < FOURTEEN_DAYS_MS) {
          expiringSoonCount++;
          expiringSoonAllocatedRM += allocatedRM;
        }
      } else if (v.status === 'redeemed') {
        redeemedLifetimeCount++;
        redeemedLifetimeAllocatedRM += allocatedRM;
      } else if (v.status === 'expired' || (v.status === 'available' && isExpired)) {
        expiredLifetimeCount++;
        expiredLifetimeAllocatedRM += allocatedRM;
      }
    }
    const cashCollectedLifetimeRM = mealVoucherPurchases
      .filter((p: any) => p.status === 'paid')
      .reduce((sum: number, p: any) => sum + (Number(p.amountPaid) || 0), 0);
    const mealVoucherStats = {
      outstandingCount,
      outstandingAllocatedRM: Number(outstandingAllocatedRM.toFixed(2)),
      outstandingFaceValueRM: Number((outstandingCount * FACE_VALUE_RM).toFixed(2)),
      expiringSoonCount,
      expiringSoonAllocatedRM: Number(expiringSoonAllocatedRM.toFixed(2)),
      expiringSoonFaceValueRM: Number((expiringSoonCount * FACE_VALUE_RM).toFixed(2)),
      redeemedLifetimeCount,
      redeemedLifetimeAllocatedRM: Number(redeemedLifetimeAllocatedRM.toFixed(2)),
      expiredLifetimeCount,
      expiredLifetimeAllocatedRM: Number(expiredLifetimeAllocatedRM.toFixed(2)),
      cashCollectedLifetimeRM: Number(cashCollectedLifetimeRM.toFixed(2)),
      faceValuePerVoucherRM: FACE_VALUE_RM,
    };

    // ── Prepaid add-on credit liability aggregates ────────────
    // Mirrors meal-voucher accounting: prepaid add-on cash is a contract
    // liability, recognised as each unit is consumed at redemption.
    let addonOutstandingUnits = 0;
    let addonOutstandingLiabilityRM = 0;
    let addonExpiringSoonUnits = 0;
    let addonExpiringSoonLiabilityRM = 0;
    let addonRecognizedLifetimeRM = 0;
    let addonExpiredLifetimeRM = 0;
    const addonByAddon: Record<string, { addonName: string; remaining: number; liabilityRM: number }> = {};
    for (const doc of addonCreditsSnap.docs) {
      const c = doc.data() as {
        addonId?: string;
        addonName?: string;
        status?: string;
        unitAllocatedRM?: number;
        quantityTotal?: number;
        quantityRemaining?: number;
        expiresAt?: { toMillis?: () => number };
      };
      const unit = Number(c.unitAllocatedRM) || 0;
      const total = Number(c.quantityTotal) || 0;
      const remaining = Number(c.quantityRemaining) || 0;
      const consumed = Math.max(0, total - remaining);
      const expMs = c.expiresAt?.toMillis ? c.expiresAt.toMillis() : 0;
      const isExpired = !expMs || expMs <= now;
      // Revenue is recognised whenever a unit is consumed, regardless of batch status.
      addonRecognizedLifetimeRM += consumed * unit;
      if (remaining > 0 && c.status !== 'used-up') {
        if (isExpired) {
          // Unconsumed units that lapsed → breakage.
          addonExpiredLifetimeRM += remaining * unit;
        } else {
          addonOutstandingUnits += remaining;
          addonOutstandingLiabilityRM += remaining * unit;
          const key = String(c.addonId || 'unknown');
          const name = String(c.addonName || key);
          if (!addonByAddon[key]) addonByAddon[key] = { addonName: name, remaining: 0, liabilityRM: 0 };
          addonByAddon[key].remaining += remaining;
          addonByAddon[key].liabilityRM += remaining * unit;
          if (expMs - now < FOURTEEN_DAYS_MS) {
            addonExpiringSoonUnits += remaining;
            addonExpiringSoonLiabilityRM += remaining * unit;
          }
        }
      }
    }
    for (const k of Object.keys(addonByAddon)) {
      addonByAddon[k].liabilityRM = Number(addonByAddon[k].liabilityRM.toFixed(2));
    }
    const addonCashCollectedLifetimeRM = mealVoucherPurchases
      .filter((p: any) => p.status === 'paid')
      .reduce((sum: number, p: any) => sum + (Number(p.addOnAmountPaid) || 0), 0);
    const addonCreditStats = {
      outstandingUnits: addonOutstandingUnits,
      outstandingLiabilityRM: Number(addonOutstandingLiabilityRM.toFixed(2)),
      expiringSoonUnits: addonExpiringSoonUnits,
      expiringSoonLiabilityRM: Number(addonExpiringSoonLiabilityRM.toFixed(2)),
      recognizedLifetimeRM: Number(addonRecognizedLifetimeRM.toFixed(2)),
      expiredLifetimeRM: Number(addonExpiredLifetimeRM.toFixed(2)),
      cashCollectedLifetimeRM: Number(addonCashCollectedLifetimeRM.toFixed(2)),
      byAddon: addonByAddon,
    };

    return NextResponse.json({ orders, users, feedbacks, mealVoucherPurchases, mealVoucherStats, addonCreditStats });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ error: err.message || '数据获取失败' }, { status: 500 });
  }
}
