import { NextRequest } from 'next/server';
import { verifyAdminEmail, corsPreflight, adminJson } from '@/lib/adminApi';
import { generateTrackToken } from '@/lib/trackingUtils';

// Lazy-init Firebase Admin (same pattern as other API routes)
let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/**
 * POST /api/admin/delivery-batch — the whole delivery-batch lifecycle.
 * Called by the dashboard (cross-origin, Bearer admin token) and /driver.
 *
 * actions:
 *   start    {orderIds[]}          → create batch, orders → 'delivering' (+batchId,
 *                                    backfill trackToken for manual orders);
 *                                    auto-completes any previous active batch
 *   current  {}                    → active batch + its orders (drives /driver)
 *   location {batchId, lat, lng}   → update live driver position
 *   deliver  {batchId, orderId}    → order → 'delivered'; auto-complete batch
 *                                    when every order is delivered
 *   complete {batchId}             → force-close the batch (drops driverLoc)
 */
export async function OPTIONS() { return corsPreflight(); }

export async function POST(req: NextRequest) {
  try {
    const adminEmail = await verifyAdminEmail(req);
    if (!adminEmail) return adminJson({ error: '未授权' }, 401);

    const body = await req.json();
    const action = String(body.action || '');
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    if (action === 'start') {
      const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds.filter((x: any) => typeof x === 'string') : [];
      if (orderIds.length === 0 || orderIds.length > 30) {
        return adminJson({ error: '请选择 1-30 个订单' }, 400);
      }

      const snaps = await db.getAll(...orderIds.map(id => db.collection('orders').doc(id)));
      const missing = snaps.filter(s => !s.exists).map(s => s.id);
      if (missing.length > 0) {
        return adminJson({ error: `订单不存在: ${missing.join(', ')}` }, 400);
      }

      // Only one batch on the road at a time — close any stale active batch
      const activeSnap = await db.collection('deliveryBatches').where('status', '==', 'active').get();
      for (const doc of activeSnap.docs) {
        await doc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp(), driverLoc: FieldValue.delete() });
      }

      const batchRef = await db.collection('deliveryBatches').add({
        status: 'active',
        orderIds,
        deliveredOrderIds: [],
        startedBy: adminEmail,
        startedAt: FieldValue.serverTimestamp(),
      });

      // Flip orders to delivering; manual dashboard orders have no trackToken
      // yet — backfill so their customers could also be sent a link.
      for (const snap of snaps) {
        const update: Record<string, any> = {
          status: 'delivering',
          batchId: batchRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!snap.data()?.trackToken) update.trackToken = generateTrackToken();
        await snap.ref.update(update);
      }

      return adminJson({ success: true, batchId: batchRef.id });
    }

    if (action === 'current') {
      const activeSnap = await db.collection('deliveryBatches')
        .where('status', '==', 'active').limit(1).get();
      if (activeSnap.empty) return adminJson({ batch: null });
      const batchDoc = activeSnap.docs[0];
      const batch = batchDoc.data();

      const orderSnaps = await db.getAll(...(batch.orderIds as string[]).map((id: string) => db.collection('orders').doc(id)));
      const orders = orderSnaps.filter(s => s.exists).map(s => {
        const o = s.data()!;
        return {
          id: s.id,
          orderNo: s.id.slice(-6).toUpperCase(),
          userName: o.userName || '',
          userPhone: o.userPhone || '',
          userAddress: o.userAddress || '',
          deliveryTime: o.deliveryTime || '',
          status: o.status,
          items: Array.isArray(o.items)
            ? o.items.map((it: any) => `${it.name} ×${it.quantity}`).join('、')
            : '',
          note: o.note || '',
        };
      });

      return adminJson({
        batch: { id: batchDoc.id, orderIds: batch.orderIds, deliveredOrderIds: batch.deliveredOrderIds || [] },
        orders,
      });
    }

    if (action === 'location') {
      const { batchId, lat, lng } = body;
      if (typeof batchId !== 'string' || typeof lat !== 'number' || typeof lng !== 'number'
          || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return adminJson({ error: '参数无效' }, 400);
      }
      await db.collection('deliveryBatches').doc(batchId).update({
        driverLoc: { lat, lng, ts: Date.now() },
      });
      return adminJson({ success: true });
    }

    if (action === 'deliver') {
      const { batchId, orderId } = body;
      if (typeof batchId !== 'string' || typeof orderId !== 'string') {
        return adminJson({ error: '参数无效' }, 400);
      }
      const batchRef = db.collection('deliveryBatches').doc(batchId);
      const batchSnap = await batchRef.get();
      if (!batchSnap.exists) return adminJson({ error: '批次不存在' }, 404);
      const batch = batchSnap.data()!;
      if (!(batch.orderIds as string[]).includes(orderId)) {
        return adminJson({ error: '订单不在此批次' }, 400);
      }

      await db.collection('orders').doc(orderId).update({
        status: 'delivered',
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batchRef.update({ deliveredOrderIds: FieldValue.arrayUnion(orderId) });

      // All delivered → close the batch and stop exposing the driver position
      const after = await batchRef.get();
      const delivered = (after.data()?.deliveredOrderIds || []) as string[];
      const all = (after.data()?.orderIds || []) as string[];
      const done = all.every(id => delivered.includes(id));
      if (done) {
        await batchRef.update({ status: 'completed', completedAt: FieldValue.serverTimestamp(), driverLoc: FieldValue.delete() });
      }
      return adminJson({ success: true, batchCompleted: done });
    }

    if (action === 'complete') {
      const { batchId } = body;
      if (typeof batchId !== 'string') return adminJson({ error: '参数无效' }, 400);
      await db.collection('deliveryBatches').doc(batchId).update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        driverLoc: FieldValue.delete(),
      });
      return adminJson({ success: true });
    }

    return adminJson({ error: '未知 action' }, 400);
  } catch (err: any) {
    console.error('delivery-batch error:', err);
    return adminJson({ error: err?.message || '操作失败' }, 500);
  }
}
