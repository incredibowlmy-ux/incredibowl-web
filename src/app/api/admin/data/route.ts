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

    const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const feedbacks = feedbacksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ orders, users, feedbacks });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ error: err.message || '数据获取失败' }, { status: 500 });
  }
}
