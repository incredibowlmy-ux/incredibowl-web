import { NextRequest, NextResponse } from 'next/server';
import { mintVouchersForPurchase } from '@/lib/mealVoucherUtils';
import { getBundle, getValidityDaysForBundle } from '@/data/mealVoucherConfig';
import { normalizePhone } from '@/lib/phoneUtils';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

// Allow the standalone admin dashboard (served from file:// or any local origin)
// to hit this endpoint. Real auth is the Firebase Bearer token — without a
// valid admin token, the request is rejected regardless of origin.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

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
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/manual-voucher-purchase
 * Auth: admin email
 *
 * Records an offline voucher sale (WhatsApp / cash / walk-in). Mirrors the
 * web /api/meal-vouchers/confirm-purchase outcome:
 *   1. Find user by normalizedPhone, OR auto-create a stub user
 *   2. Create mealVoucherPurchases doc with status='paid' + isManual=true
 *   3. Mint N mealVouchers docs (reuses mintVouchersForPurchase helper —
 *      same allocatedValueRM calc, same expiresAt logic, same idempotency)
 *   4. Bump user.totalSpent by amountPaid (for CRM/LTV consistency)
 *
 * Body:
 *   - phone: string (required) — accepts any format; normalized server-side
 *   - displayName?: string (used when creating stub; falls back to "客户#xxx")
 *   - bundleId: '5' | '10' | '20' (required)
 *   - paymentMethod: 'cash' | 'qr' | 'fpx-manual' | 'whatsapp' | 'other' (required)
 *   - channel?: 'whatsapp' | 'walkin' | 'cash' | 'other'
 *   - paidAtMs?: number (defaults to now)
 *   - amountPaidOverride?: number (defaults to bundle.price — only used for cash discounts)
 *   - note?: string
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const {
      phone,
      displayName,
      bundleId,
      paymentMethod,
      channel,
      paidAtMs,
      amountPaidOverride,
      note,
    } = body || {};

    if (!phone || typeof phone !== 'string') {
      return corsify(NextResponse.json({ error: '缺少客户电话' }, { status: 400 }));
    }
    const phoneNormalized = normalizePhone(phone);
    if (!phoneNormalized) {
      return corsify(NextResponse.json({ error: '电话格式无效' }, { status: 400 }));
    }

    const bundle = getBundle(bundleId);
    if (!bundle) {
      return corsify(NextResponse.json({ error: '无效的 bundle（应为 5 / 10 / 20）' }, { status: 400 }));
    }

    if (!['cash', 'qr', 'fpx-manual', 'whatsapp', 'other'].includes(paymentMethod)) {
      return corsify(NextResponse.json({ error: '无效的支付方式' }, { status: 400 }));
    }

    // Allow lower (cash discount) but not higher than bundle price — anti-typo
    const amountPaid = typeof amountPaidOverride === 'number' && amountPaidOverride > 0
      ? Number(amountPaidOverride.toFixed(2))
      : bundle.price;
    if (amountPaid > bundle.price + 0.01) {
      return corsify(NextResponse.json({
        error: `amountPaid (RM ${amountPaid}) 大于 bundle 标价 (RM ${bundle.price})，不允许`,
      }, { status: 400 }));
    }

    const db = await getDb();
    const { FieldValue, Timestamp } = await import('firebase-admin/firestore');

    // ── 1. Find or create user ────────────────────────────────────
    const userSnap = await db.collection('users')
      .where('phoneNormalized', '==', phoneNormalized)
      .limit(1)
      .get();

    let userId: string;
    let wasStubCreated = false;
    let userDataSnapshot: Record<string, any> = {};
    if (!userSnap.empty) {
      const doc = userSnap.docs[0];
      userId = doc.id;
      userDataSnapshot = doc.data() || {};
    } else {
      // Create stub user. Marked with `stubFromManualVoucherPurchase: true`
      // so future real auth registration can detect + claim this stub.
      const stubRef = db.collection('users').doc();
      userId = stubRef.id;
      wasStubCreated = true;
      const stubName = (typeof displayName === 'string' && displayName.trim())
        ? displayName.trim()
        : `客户 ${phoneNormalized.slice(-4)}`;
      const stubData = {
        phone,
        phoneNormalized,
        displayName: stubName,
        email: '',
        address: '',
        stubFromManualVoucherPurchase: true,
        createdByAdmin: admin.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await stubRef.set(stubData);
      userDataSnapshot = stubData;
    }

    // ── 2. Create purchase doc (status='paid' from the start — manual record) ──
    const purchasedAt = typeof paidAtMs === 'number' && paidAtMs > 0
      ? Timestamp.fromMillis(paidAtMs)
      : Timestamp.now();

    const purchaseDoc: Record<string, any> = {
      userId,
      userName: userDataSnapshot.displayName || '',
      userEmail: userDataSnapshot.email || '',
      userPhone: phone,
      bundleId: bundle.id,
      voucherCount: bundle.voucherCount,
      amountPaid,
      originalPrice: bundle.price,
      validityDays: getValidityDaysForBundle(bundle.id),
      paymentMethod,
      channel: channel || 'manual',
      status: 'paid',
      isManual: true,
      recordedBy: admin.email,
      paidAt: purchasedAt,
      voucherIds: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (note) purchaseDoc.note = String(note).slice(0, 500);

    const purchaseRef = await db.collection('mealVoucherPurchases').add(purchaseDoc);

    // ── 3. Mint vouchers (reuses MFRS 15 allocated-value calc) ─────
    const voucherIds = await mintVouchersForPurchase(db, {
      userId,
      purchaseId: purchaseRef.id,
      voucherCount: bundle.voucherCount,
      purchasedAtMs: purchasedAt.toMillis(),
    });

    // ── 4. Bump user.totalSpent (mirrors web confirm-purchase behaviour) ──
    await db.collection('users').doc(userId).update({
      totalSpent: FieldValue.increment(amountPaid),
      lastOrderAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return corsify(NextResponse.json({
      success: true,
      purchaseId: purchaseRef.id,
      voucherIds,
      voucherCount: voucherIds.length,
      userId,
      userName: userDataSnapshot.displayName || '',
      wasStubCreated,
      amountPaid,
      allocatedValuePerVoucher: Number((amountPaid / bundle.voucherCount).toFixed(4)),
    }));
  } catch (err: any) {
    console.error('admin manual-voucher-purchase error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
