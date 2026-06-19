/**
 * Server-side helpers for PREPAID add-on credits.
 *
 * Mirrors the meal-voucher lifecycle (see mealVoucherUtils.ts), but for
 * add-ons (e.g. a customer prepays "19 sunny eggs + 1 salmon upgrade" as part
 * of a bundle sale). The prepaid cash is a contract liability (MFRS 15);
 * revenue is recognised as each credit is consumed at redemption.
 *
 * Storage: collection `mealVoucherAddonCredits`, ONE batch doc per
 * (purchase, addonId) — not one-per-unit — with a `quantityRemaining` counter
 * decremented FIFO (oldest expiry first) at redemption.
 *
 * Pure server use — firebase-admin Firestore.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** One prepaid add-on line, already resolved + priced server-side. */
export interface ResolvedPrepaidAddon {
  addonId: string;
  addonName: string;
  unitPriceRM: number;
  quantity: number;
}

export interface MintAddonCreditsInput {
  userId: string;
  purchaseId: string;
  prepaidAddOns: ResolvedPrepaidAddon[];
  /** Defaults to now. */
  purchasedAtMs?: number;
  /** Days until each credit batch expires (same as the bundle's vouchers). */
  validityDays: number;
}

/**
 * Create one batch doc per prepaid add-on, linked to the purchase.
 * Returns the created credit doc IDs.
 *
 * Idempotent: if credits already exist for this purchaseId, returns their IDs
 * instead of double-minting (guards against retry / double-click).
 */
export async function mintAddonCredits(
  db: Firestore,
  input: MintAddonCreditsInput,
): Promise<string[]> {
  const { userId, purchaseId, prepaidAddOns, validityDays } = input;
  if (!prepaidAddOns || prepaidAddOns.length === 0) return [];

  // Idempotency: bail if this purchase already minted addon credits.
  const existing = await db.collection('mealVoucherAddonCredits')
    .where('purchaseId', '==', purchaseId)
    .get();
  if (!existing.empty) {
    return existing.docs.map(d => d.id);
  }

  const purchasedAt = input.purchasedAtMs
    ? Timestamp.fromMillis(input.purchasedAtMs)
    : Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    purchasedAt.toMillis() + validityDays * 86_400_000,
  );

  const batch = db.batch();
  const ids: string[] = [];
  for (const a of prepaidAddOns) {
    if (a.quantity <= 0) continue;
    const ref = db.collection('mealVoucherAddonCredits').doc();
    ids.push(ref.id);
    // No discount is allocated to add-ons in our model, so the per-unit
    // contract-liability value === the face price the customer paid per unit.
    const unitAllocatedRM = Number(a.unitPriceRM.toFixed(4));
    batch.set(ref, {
      userId,
      purchaseId,
      addonId: a.addonId,
      addonName: a.addonName,
      unitPriceRM: Number(a.unitPriceRM.toFixed(2)),
      unitAllocatedRM,
      quantityTotal: a.quantity,
      quantityRemaining: a.quantity,
      status: 'available',
      purchasedAt,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (ids.length === 0) return [];
  await batch.commit();
  return ids;
}

export interface AvailableAddonCredit {
  addonId: string;
  addonName: string;
  remaining: number;
  unitAllocatedRM: number;
}

/**
 * Sum each add-on's currently-claimable quantity for a user (across batches),
 * filtering out expired / used-up. For the dashboard redemption picker.
 */
export async function getAvailableAddonCredits(
  db: Firestore,
  userId: string,
): Promise<AvailableAddonCredit[]> {
  const now = Timestamp.now();
  const snap = await db.collection('mealVoucherAddonCredits')
    .where('userId', '==', userId)
    .where('status', '==', 'available')
    .get();

  const byAddon = new Map<string, AvailableAddonCredit>();
  for (const doc of snap.docs) {
    const v = doc.data() || {};
    const exp = v.expiresAt as Timestamp | undefined;
    const remaining = Number(v.quantityRemaining) || 0;
    if (!exp || exp.toMillis() <= now.toMillis() || remaining <= 0) continue;
    const id = String(v.addonId);
    const prev = byAddon.get(id);
    if (prev) {
      prev.remaining += remaining;
    } else {
      byAddon.set(id, {
        addonId: id,
        addonName: String(v.addonName || id),
        remaining,
        unitAllocatedRM: Number(v.unitAllocatedRM) || 0,
      });
    }
  }
  return [...byAddon.values()];
}

/** One consumed add-on, aggregated across batches — for the order line + receipt. */
export interface ClaimedAddonLine {
  addonId: string;
  addonName: string;
  count: number;
}

export interface ClaimAddonResult {
  recognizedRevenueRM: number;
  lines: ClaimedAddonLine[];
}

/**
 * FIFO-claim prepaid add-on credits (oldest expiry first) for an order.
 * Atomic via a single Firestore transaction across every batch touched.
 * Throws if the user doesn't have enough of any requested add-on.
 *
 * Returns the recognised revenue (MFRS 15 — sum of consumed units ×
 * unitAllocatedRM) and aggregated lines for appending RM0 items to the order.
 */
export async function claimAddonCredits(
  db: Firestore,
  userId: string,
  items: Array<{ addonId: string; count: number }>,
  orderId: string,
): Promise<ClaimAddonResult> {
  const wanted = (items || []).filter(i => i && i.count > 0);
  if (wanted.length === 0) return { recognizedRevenueRM: 0, lines: [] };

  const now = Timestamp.now();

  // Pre-read candidate batches per add-on (admin tx can't run queries).
  type PlanEntry = { id: string; take: number; addonId: string; addonName: string; unitAllocatedRM: number };
  const plan: PlanEntry[] = [];

  for (const { addonId, count } of wanted) {
    const snap = await db.collection('mealVoucherAddonCredits')
      .where('userId', '==', userId)
      .where('addonId', '==', addonId)
      .where('status', '==', 'available')
      .get();

    const candidates = snap.docs
      .filter(d => {
        const v = d.data() || {};
        const exp = v.expiresAt as Timestamp | undefined;
        return exp && exp.toMillis() > now.toMillis() && (Number(v.quantityRemaining) || 0) > 0;
      })
      .sort((a, b) =>
        (a.data().expiresAt as Timestamp).toMillis() - (b.data().expiresAt as Timestamp).toMillis(),
      );

    const totalAvail = candidates.reduce((s, d) => s + (Number(d.data().quantityRemaining) || 0), 0);
    if (totalAvail < count) {
      const name = candidates[0]?.data()?.addonName || addonId;
      throw new Error(`预付「${name}」不足：需要 ${count} 个，账户里只有 ${totalAvail} 个`);
    }

    let need = count;
    for (const d of candidates) {
      if (need <= 0) break;
      const v = d.data() || {};
      const rem = Number(v.quantityRemaining) || 0;
      const take = Math.min(rem, need);
      plan.push({
        id: d.id,
        take,
        addonId,
        addonName: String(v.addonName || addonId),
        unitAllocatedRM: Number(v.unitAllocatedRM) || 0,
      });
      need -= take;
    }
  }

  let recognized = 0;
  const linesByAddon = new Map<string, ClaimedAddonLine>();

  await db.runTransaction(async (tx) => {
    const refs = plan.map(p => db.collection('mealVoucherAddonCredits').doc(p.id));
    const fresh = await Promise.all(refs.map(r => tx.get(r)));
    // Verify every batch still has enough before mutating any.
    for (let i = 0; i < fresh.length; i++) {
      const v = fresh[i].data() || {};
      if (!fresh[i].exists || v.status !== 'available') {
        throw new Error('预付加料抢占失败（可能在另一个会话被使用了），请重试');
      }
      const exp = v.expiresAt as Timestamp | undefined;
      if (!exp || exp.toMillis() <= now.toMillis()) {
        throw new Error('预付加料抢占失败（部分已过期），请刷新');
      }
      if ((Number(v.quantityRemaining) || 0) < plan[i].take) {
        throw new Error('预付加料抢占失败（余额不足），请刷新重试');
      }
    }
    for (let i = 0; i < refs.length; i++) {
      const p = plan[i];
      const v = fresh[i].data() || {};
      const rem = Number(v.quantityRemaining) || 0;
      const after = rem - p.take;
      tx.update(refs[i], {
        quantityRemaining: after,
        status: after <= 0 ? 'used-up' : 'available',
        lastRedeemedOrderId: orderId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      recognized += p.take * p.unitAllocatedRM;
      const line = linesByAddon.get(p.addonId);
      if (line) line.count += p.take;
      else linesByAddon.set(p.addonId, { addonId: p.addonId, addonName: p.addonName, count: p.take });
    }
  });

  return {
    recognizedRevenueRM: Number(recognized.toFixed(2)),
    lines: [...linesByAddon.values()],
  };
}
