import { NextResponse } from 'next/server';

// Lazy-init Firebase Admin (same pattern as other API routes)
let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

/**
 * GET /api/track?token=<trackToken>
 *
 * PUBLIC (no login) — powers the /track/[token] customer page reached from
 * the WhatsApp confirmation link. Firestore rules block anonymous order
 * reads, so this route reads via Admin SDK and returns ONLY a whitelist:
 * status, delivery slot, item names and (while delivering) the live driver
 * position. Never returns address, phone, price or other customers' data.
 */
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token') || '';
    // trackToken is exactly 16 base62 chars — reject junk before querying
    if (!/^[A-Za-z0-9]{16}$/.test(token)) {
      return NextResponse.json({ error: 'invalid token' }, { status: 404 });
    }

    const db = await getDb();
    const snap = await db.collection('orders').where('trackToken', '==', token).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const orderDoc = snap.docs[0];
    const order = orderDoc.data();

    // Driver live position — only exposed while this order is out for delivery
    let driver: { lat: number; lng: number; updatedAt: number | null } | null = null;
    if (order.status === 'delivering' && order.batchId) {
      const batchSnap = await db.collection('deliveryBatches').doc(order.batchId).get();
      const batch = batchSnap.exists ? batchSnap.data() || {} : {};
      const loc = batch.driverLoc;
      if (batch.status === 'active' && loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        driver = {
          lat: loc.lat,
          lng: loc.lng,
          updatedAt: typeof loc.ts === 'number' ? loc.ts : null,
        };
      }
    }

    // Destination marker for the map — the customer's own verified coords
    // (stored on the user doc by /api/geocode; display-only here)
    let dest: { lat: number; lng: number } | null = null;
    if (order.userId) {
      try {
        const userSnap = await db.collection('users').doc(order.userId).get();
        const u = userSnap.exists ? userSnap.data() || {} : {};
        if (typeof u.addressLat === 'number' && typeof u.addressLng === 'number') {
          dest = { lat: u.addressLat, lng: u.addressLng };
        }
      } catch { /* destination marker is optional */ }
    }

    const items = Array.isArray(order.items)
      ? order.items.map((it: any) => ({
          name: String(it?.name || ''),
          nameEn: String(it?.nameEn || ''),
          quantity: Number(it?.quantity) || 0,
        }))
      : [];

    return NextResponse.json(
      {
        orderNo: orderDoc.id.slice(-6).toUpperCase(),
        status: order.status || 'pending',
        deliveryDate: order.deliveryDate || '',
        deliveryTime: order.deliveryTime || '',
        items,
        driver,
        dest,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    console.error('track error:', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
