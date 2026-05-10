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
    const [ordersSnap, usersSnap, feedbacksSnap, mealVoucherPurchasesSnap, mealVouchersSnap] = await Promise.all([
      db.collection('orders').orderBy('createdAt', 'desc').get(),
      db.collection('users').orderBy('createdAt', 'desc').get(),
      db.collection('feedbacks').get(),
      db.collection('mealVoucherPurchases').orderBy('createdAt', 'desc').get(),
      db.collection('mealVouchers').get(),
    ]);

    // Auto-cancel FPX pending orders older than 10 minutes (QR orders unaffected)
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const cancelPromises: Promise<any>[] = [];
    for (const doc of ordersSnap.docs) {
      const d = doc.data();
      if (d.status === 'pending' && d.paymentMethod === 'fpx' && d.createdAt) {
        const orderTime = (d.createdAt._seconds ?? d.createdAt.seconds ?? 0) * 1000;
        if (orderTime > 0 && orderTime < tenMinAgo) {
          cancelPromises.push(doc.ref.update({ status: 'cancelled', updatedAt: new Date() }));
        }
      }
    }
    if (cancelPromises.length > 0) await Promise.all(cancelPromises);

    const orders = ordersSnap.docs.map(doc => {
      const data = doc.data();
      // Reflect just-cancelled orders in the response
      const cancelled = cancelPromises.length > 0 && data.status === 'pending' && data.paymentMethod === 'fpx';
      return { id: doc.id, ...data, ...(cancelled && (data.createdAt?._seconds ?? data.createdAt?.seconds ?? 0) * 1000 < tenMinAgo ? { status: 'cancelled' } : {}) };
    });
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

    return NextResponse.json({ orders, users, feedbacks, mealVoucherPurchases, mealVoucherStats });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ error: err.message || '数据获取失败' }, { status: 500 });
  }
}
