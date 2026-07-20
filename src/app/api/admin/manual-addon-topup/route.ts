import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { mintAddonCredits, type ResolvedPrepaidAddon } from '@/lib/addonCreditUtils';
import { getAddOnPrice, getPrepaidAddonOption } from '@/data/addOnsConfig';
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
 * POST /api/admin/manual-addon-topup
 * Auth: admin email
 *
 * Standalone prepaid add-on top-up — a customer pays extra cash for add-on
 * credits (e.g. week 2: "upgrade my remaining meals + add eggs") WITHOUT
 * buying more vouchers. Mirrors the add-on half of manual-voucher-purchase:
 *   1. Find user by normalizedPhone — must already exist (no stub creation;
 *      manual orders / voucher sales create the account first)
 *   2. Expiry: customer HAS live vouchers → align to the LATEST voucher
 *      expiresAt (credits never outlive the vouchers they serve). No live
 *      vouchers → 30 days from top-up (老板 2026-07-21 拍板，与最小餐券包同口径).
 *   3. Create mealVoucherPurchases doc: type='addon-topup', voucherCount=0,
 *      amountPaid=0 (bundle cash), addOnAmountPaid=cash received. Add-on cash
 *      is a contract liability (MFRS 15) recognised at redemption — same as
 *      bundled prepaid add-ons, so every KPI/P&L path works unchanged.
 *   4. Mint credits via mintAddonCredits (idempotent per purchaseId)
 *   5. Bump user.totalSpent by the cash received
 *
 * Body:
 *   - phone: string (required)
 *   - prepaidAddOns: [{ addonId, quantity }] (required, non-empty) — addonId
 *     must be in PREPAID_ADDON_OPTIONS; price is server-authoritative
 *   - paymentMethod: 'cash' | 'qr' | 'fpx-manual' | 'whatsapp' | 'other' (required)
 *   - channel?: 'whatsapp' | 'walkin' | 'cash' | 'other'
 *   - paidAtMs?: number (defaults to now)
 *   - note?: string
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { phone, prepaidAddOns, paymentMethod, channel, paidAtMs, note } = body || {};

    if (!phone || typeof phone !== 'string') {
      return corsify(NextResponse.json({ error: '缺少客户电话' }, { status: 400 }));
    }
    const phoneNormalized = normalizePhone(phone);
    if (!phoneNormalized) {
      return corsify(NextResponse.json({ error: '电话格式无效' }, { status: 400 }));
    }

    if (!['cash', 'qr', 'fpx-manual', 'whatsapp', 'other'].includes(paymentMethod)) {
      return corsify(NextResponse.json({ error: '无效的支付方式' }, { status: 400 }));
    }

    // ── Validate add-ons (required here, unlike the bundle sale) ──
    if (!Array.isArray(prepaidAddOns) || prepaidAddOns.length === 0) {
      return corsify(NextResponse.json({ error: '至少选一个加料' }, { status: 400 }));
    }
    const resolvedAddOns: ResolvedPrepaidAddon[] = [];
    for (const raw of prepaidAddOns) {
      const addonId = String(raw?.addonId || '');
      const quantity = Number(raw?.quantity);
      const opt = getPrepaidAddonOption(addonId);
      const price = getAddOnPrice(addonId);
      if (!opt || typeof price !== 'number') {
        return corsify(NextResponse.json({ error: `不支持预付的加料：${addonId}` }, { status: 400 }));
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return corsify(NextResponse.json({ error: `加料数量无效：${opt.name}` }, { status: 400 }));
      }
      resolvedAddOns.push({ addonId, addonName: opt.name, unitPriceRM: price, quantity });
    }
    const addOnAmountPaid = Number(
      resolvedAddOns.reduce((s, a) => s + a.unitPriceRM * a.quantity, 0).toFixed(2),
    );

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    // ── 1. Find user — must exist (no stub: top-up implies prior bundle sale) ──
    const userSnap = await db.collection('users')
      .where('phoneNormalized', '==', phoneNormalized)
      .limit(1)
      .get();
    if (userSnap.empty) {
      return corsify(NextResponse.json({
        error: '找不到该电话的客户账号 — 请确认电话；新客户先录一笔手动单或卖餐券建档',
      }, { status: 404 }));
    }
    const userDoc = userSnap.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data() || {};

    // ── 2. Expiry: has live vouchers → align to latest voucher expiry;
    //    no vouchers → 30 days from top-up (与最小餐券包同口径) ──
    const NO_VOUCHER_VALIDITY_DAYS = 30;
    const nowMs = Date.now();
    const voucherSnap = await db.collection('mealVouchers')
      .where('userId', '==', userId)
      .where('status', '==', 'available')
      .get();
    let latestExpiryMs = 0;
    for (const d of voucherSnap.docs) {
      const exp = d.data().expiresAt as Timestamp | undefined;
      if (exp && exp.toMillis() > nowMs && exp.toMillis() > latestExpiryMs) {
        latestExpiryMs = exp.toMillis();
      }
    }

    // ── 3. Purchase record (paid manual record; bundle cash = 0) ──
    const purchasedAt = typeof paidAtMs === 'number' && paidAtMs > 0
      ? Timestamp.fromMillis(paidAtMs)
      : Timestamp.now();
    const creditExpiryMs = latestExpiryMs > 0
      ? latestExpiryMs
      : purchasedAt.toMillis() + NO_VOUCHER_VALIDITY_DAYS * 86_400_000;
    const validityDays = Math.ceil((creditExpiryMs - purchasedAt.toMillis()) / 86_400_000);

    const purchaseDoc: Record<string, any> = {
      userId,
      userName: userData.displayName || '',
      userEmail: userData.email || '',
      userPhone: phone,
      type: 'addon-topup',
      bundleId: 'addon-topup',
      voucherCount: 0,
      amountPaid: 0,
      addOnAmountPaid,
      totalAmountPaid: addOnAmountPaid,
      prepaidAddOns: resolvedAddOns,
      originalPrice: 0,
      validityDays,
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

    // ── 4. Mint credits at the exact expiry resolved above ──
    const addonCreditIds = await mintAddonCredits(db, {
      userId,
      purchaseId: purchaseRef.id,
      prepaidAddOns: resolvedAddOns,
      purchasedAtMs: purchasedAt.toMillis(),
      validityDays,
      expiresAtMs: creditExpiryMs,
    });
    await purchaseRef.update({ addonCreditIds, updatedAt: FieldValue.serverTimestamp() });

    // ── 5. Bump LTV by real cash received ──
    await db.collection('users').doc(userId).update({
      totalSpent: FieldValue.increment(addOnAmountPaid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return corsify(NextResponse.json({
      success: true,
      purchaseId: purchaseRef.id,
      addonCreditIds,
      userId,
      userName: userData.displayName || '',
      addOnAmountPaid,
      totalAmountPaid: addOnAmountPaid,
      expiresAtMs: creditExpiryMs,
    }));
  } catch (err: any) {
    console.error('admin manual-addon-topup error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
