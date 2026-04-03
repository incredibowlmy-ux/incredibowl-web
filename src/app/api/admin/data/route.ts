import { NextRequest, NextResponse } from 'next/server';

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
    const [ordersSnap, usersSnap, feedbacksSnap] = await Promise.all([
      db.collection('orders').orderBy('createdAt', 'desc').get(),
      db.collection('users').orderBy('createdAt', 'desc').get(),
      db.collection('feedbacks').get(),
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

    return NextResponse.json({ orders, users, feedbacks });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ error: err.message || '数据获取失败' }, { status: 500 });
  }
}
