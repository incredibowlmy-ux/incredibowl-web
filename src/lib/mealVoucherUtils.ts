/**
 * Server-side helpers for meal voucher minting, claiming, and releasing.
 *
 * Lifecycle:
 *   1. Buy → /api/meal-vouchers/create-purchase creates a `mealVoucherPurchases`
 *      doc with status='pending' (FPX) or status='pending-receipt' (QR).
 *   2. Confirm → mintVouchersForPurchase() creates N `mealVouchers` docs
 *      with status='available' and links them back to the purchase.
 *   3. Redeem at checkout → claimMealVouchers() flips the oldest-expiring N
 *      vouchers to status='redeemed' atomically (FIFO).
 *   4. Order cancel → releaseMealVouchers() flips them back to 'available'.
 *
 * Pure server use — uses firebase-admin Firestore.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getBundle, getValidityDaysForBundle, FACE_VALUE_RM } from '@/data/mealVoucherConfig';
import { claimPromoVoucher } from '@/lib/voucherValidation';

export interface MintInput {
  userId: string;
  purchaseId: string;
  voucherCount: number;
  /** Optional override (used by admin manual confirm). Defaults to 'now'. */
  purchasedAtMs?: number;
}

/**
 * Create N voucher docs in the `mealVouchers` collection, linked back
 * to the purchase. Returns the created voucher IDs.
 *
 * Idempotent: if the purchase already has voucherIds populated, returns
 * them instead of double-minting. This protects against retry storms
 * (admin clicking "confirm" twice, FPX webhook + client double-fire, etc.).
 */
export async function mintVouchersForPurchase(
  db: Firestore,
  input: MintInput,
): Promise<string[]> {
  const { userId, purchaseId, voucherCount } = input;

  // Idempotency check
  const purchaseRef = db.collection('mealVoucherPurchases').doc(purchaseId);
  const existing = await purchaseRef.get();
  if (!existing.exists) throw new Error(`Purchase ${purchaseId} not found`);
  const existingData = existing.data() || {};
  if (Array.isArray(existingData.voucherIds) && existingData.voucherIds.length > 0) {
    return existingData.voucherIds;
  }

  const purchasedAt = input.purchasedAtMs
    ? Timestamp.fromMillis(input.purchasedAtMs)
    : Timestamp.now();
  // Validity is per-bundle: 5/10 → 30 days, 20 → 60 days.
  // Resolve from bundleId on the purchase doc; if a legacy doc is missing
  // bundleId, fall back to the explicit validityDays field, then to the
  // longest-configured validity (safer to over-grant than expire prematurely).
  const bundleId = typeof existingData.bundleId === 'string' ? existingData.bundleId : '';
  const legacyValidity = Number(existingData.validityDays);
  const validityDays = getBundle(bundleId)
    ? getValidityDaysForBundle(bundleId)
    : (Number.isFinite(legacyValidity) && legacyValidity > 0
        ? legacyValidity
        : getValidityDaysForBundle(''));
  const expiresAt = Timestamp.fromMillis(
    purchasedAt.toMillis() + validityDays * 86_400_000,
  );

  // MFRS 15 / IFRS 15 transaction-price allocation:
  // contract liability per voucher = amountPaid / voucherCount (NOT face value).
  // This is what the books actually owe — face value is just marketing copy.
  // Store on each voucher doc so admin liability + future revenue recognition
  // can sum without round-tripping to the purchase doc.
  const amountPaid = Number(existingData.amountPaid) || 0;
  const purchasedCount = Number(existingData.voucherCount) || voucherCount;
  const allocatedValueRM = purchasedCount > 0
    ? Number((amountPaid / purchasedCount).toFixed(4))
    : 0;

  const batch = db.batch();
  const ids: string[] = [];
  for (let i = 0; i < voucherCount; i++) {
    const ref = db.collection('mealVouchers').doc();
    ids.push(ref.id);
    batch.set(ref, {
      userId,
      purchaseId,
      purchasedAt,
      expiresAt,
      status: 'available',
      allocatedValueRM,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Link IDs back on the purchase + flag as paid (callers may also bump
  // status to 'paid' separately — this just records the IDs).
  batch.update(purchaseRef, {
    voucherIds: ids,
    mintedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return ids;
}

/**
 * Finalize a paid meal-voucher purchase: mint vouchers (idempotent), flip the
 * purchase to status='paid', bump the buyer's LTV, and burn any promo code.
 *
 * This is the SINGLE source of truth shared by every "money has settled" path:
 *   - /api/meal-vouchers/confirm-purchase  (browser handler, after sig verify)
 *   - /api/payment/webhook                 (Curlec server-to-server, FPX/App safe)
 * Keeping both on this one function is what stops the two paths from drifting.
 *
 * Idempotent end-to-end:
 *   - minting is guarded by purchase.voucherIds inside mintVouchersForPurchase()
 *   - the status flip + totalSpent bump run in a transaction guarded by
 *     status==='paid', so concurrent webhook + browser fires don't double-count.
 *
 * userId is read from the purchase doc itself (NOT passed in) so the webhook —
 * which has no authenticated user — finalizes for the correct owner.
 */
export interface FinalizePayment {
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  /** Audit tag recorded on the purchase, e.g. 'client-confirm' | 'webhook:payment.captured'. */
  source: string;
}

export async function finalizeMealVoucherPurchase(
  db: Firestore,
  purchaseId: string,
  payment: FinalizePayment,
): Promise<{ voucherIds: string[]; alreadyPaid: boolean }> {
  const purchaseRef = db.collection('mealVoucherPurchases').doc(purchaseId);
  const snap = await purchaseRef.get();
  if (!snap.exists) throw new Error(`Purchase ${purchaseId} not found`);
  const d = snap.data() || {};
  const userId: string = d.userId;
  if (!userId) throw new Error(`Purchase ${purchaseId} missing userId`);

  // Mint first (idempotent — returns existing IDs on retry).
  const voucherIds = await mintVouchersForPurchase(db, {
    userId,
    purchaseId,
    voucherCount: Number(d.voucherCount) || 0,
  });

  // Atomic status flip + LTV bump, guarded by status==='paid' for idempotency.
  let shouldClaimPromo = false;
  let alreadyPaid = false;
  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(purchaseRef);
    if (!fresh.exists) return;
    const fd = fresh.data() || {};
    if (fd.status === 'paid') { alreadyPaid = true; return; }
    shouldClaimPromo = !!fd.promoCode;
    tx.update(purchaseRef, {
      status: 'paid',
      ...(payment.razorpayPaymentId ? { razorpayPaymentId: payment.razorpayPaymentId } : {}),
      ...(payment.razorpaySignature ? { razorpaySignature: payment.razorpaySignature } : {}),
      paidAt: FieldValue.serverTimestamp(),
      finalizedBy: payment.source,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      totalSpent: FieldValue.increment(Number(fd.amountPaid) || 0),
    });
  });

  // Burn the promo voucher only on the first paid transition. Best-effort: a
  // flaky claim must not fail a purchase the customer already paid for.
  if (shouldClaimPromo && d.promoCode) {
    try {
      await claimPromoVoucher(db, d.promoCode, userId);
    } catch (e) {
      console.warn('Failed to claim promo voucher on meal-voucher finalize:', e);
    }
  }

  return { voucherIds, alreadyPaid };
}

/**
 * Count the user's currently-claimable vouchers.
 * Filters out: redeemed, expired, refunded.
 */
export async function countAvailableVouchers(
  db: Firestore,
  userId: string,
): Promise<number> {
  const now = Timestamp.now();
  const snap = await db.collection('mealVouchers')
    .where('userId', '==', userId)
    .where('status', '==', 'available')
    .get();
  let count = 0;
  for (const doc of snap.docs) {
    const v = doc.data() || {};
    const exp = v.expiresAt as Timestamp | undefined;
    if (!exp || exp.toMillis() <= now.toMillis()) continue;
    count++;
  }
  return count;
}

/**
 * FIFO-claim N vouchers (oldest expiry first) for a given order.
 * Atomic via Firestore transaction. Throws if user doesn't have enough.
 *
 * Returns:
 *   - ids: claimed voucher IDs (for the order doc + release-on-cancel)
 *   - allocatedTotalRM: sum of allocatedValueRM across claimed vouchers
 *     = MFRS 15 revenue contribution from these vouchers when redeemed.
 *     Legacy vouchers without allocatedValueRM fall back to FACE_VALUE_RM.
 */
export async function claimMealVouchers(
  db: Firestore,
  userId: string,
  count: number,
  orderId: string,
): Promise<{ ids: string[]; allocatedTotalRM: number }> {
  if (count <= 0) return { ids: [], allocatedTotalRM: 0 };

  // Read candidates outside transaction (Firestore Admin transactions can't
  // do queries — they only support .get() on document refs). We read the
  // pool, then transactionally lock each doc in turn.
  const now = Timestamp.now();
  const snap = await db.collection('mealVouchers')
    .where('userId', '==', userId)
    .where('status', '==', 'available')
    .get();

  const candidates = snap.docs
    .filter(d => {
      const v = d.data() || {};
      const exp = v.expiresAt as Timestamp | undefined;
      return exp && exp.toMillis() > now.toMillis();
    })
    .sort((a, b) => {
      const aExp = (a.data().expiresAt as Timestamp).toMillis();
      const bExp = (b.data().expiresAt as Timestamp).toMillis();
      return aExp - bExp;
    });

  if (candidates.length < count) {
    throw new Error(`餐券不足：需要 ${count} 张，账户里只有 ${candidates.length} 张`);
  }

  const targets = candidates.slice(0, count);
  const claimedIds: string[] = [];
  let allocatedTotal = 0;

  await db.runTransaction(async (tx) => {
    // Re-read each doc inside the tx and verify still 'available'.
    // If anyone else snatched one (e.g. concurrent checkout in two tabs),
    // we abort the whole claim.
    const refs = targets.map(t => db.collection('mealVouchers').doc(t.id));
    const fresh = await Promise.all(refs.map(r => tx.get(r)));
    for (let i = 0; i < fresh.length; i++) {
      const f = fresh[i];
      const v = f.data() || {};
      if (!f.exists || v.status !== 'available') {
        throw new Error('餐券抢占失败（可能在另一个会话被使用了），请重试');
      }
      const exp = v.expiresAt as Timestamp | undefined;
      if (!exp || exp.toMillis() <= now.toMillis()) {
        throw new Error('餐券抢占失败（部分已过期），请刷新');
      }
    }
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      const v = fresh[i].data() || {};
      const allocatedRM = typeof v.allocatedValueRM === 'number' ? v.allocatedValueRM : FACE_VALUE_RM;
      allocatedTotal += allocatedRM;
      tx.update(r, {
        status: 'redeemed',
        redeemedOrderId: orderId,
        redeemedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      claimedIds.push(r.id);
    }
  });

  return { ids: claimedIds, allocatedTotalRM: Number(allocatedTotal.toFixed(2)) };
}

/**
 * Release previously-claimed vouchers back to 'available' (used when an order
 * is cancelled). Skips vouchers that have since expired.
 */
export async function releaseMealVouchers(
  db: Firestore,
  voucherIds: string[],
): Promise<void> {
  if (!voucherIds || voucherIds.length === 0) return;
  const now = Timestamp.now();
  const batch = db.batch();
  for (const id of voucherIds) {
    const ref = db.collection('mealVouchers').doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const v = snap.data() || {};
    if (v.status !== 'redeemed') continue;
    const exp = v.expiresAt as Timestamp | undefined;
    if (!exp || exp.toMillis() <= now.toMillis()) {
      batch.update(ref, {
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp(),
      });
      continue;
    }
    batch.update(ref, {
      status: 'available',
      redeemedOrderId: FieldValue.delete(),
      redeemedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * Validate a bundle ID + price match. Used by create-purchase to harden
 * against a tampered client.
 */
export function validateBundleClientPrice(bundleId: string, clientPrice: number): {
  ok: boolean;
  expectedPrice?: number;
  voucherCount?: number;
  error?: string;
} {
  const bundle = getBundle(bundleId);
  if (!bundle) return { ok: false, error: 'Bundle 不存在' };
  if (Math.abs(bundle.price - clientPrice) > 0.01) {
    return { ok: false, error: `价格不一致：服务器 RM ${bundle.price.toFixed(2)}，客户端 RM ${clientPrice.toFixed(2)}`, expectedPrice: bundle.price };
  }
  return { ok: true, expectedPrice: bundle.price, voucherCount: bundle.voucherCount };
}
