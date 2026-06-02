import { NextRequest, NextResponse } from 'next/server';
import { aggregateIngredients, isLunchOrder, PrepOrder } from '@/lib/prepIngredients';

/**
 * POST /api/admin/daily-prep
 * Auth: admin Firebase ID token (Bearer). CORS '*' so the standalone
 * dashboard (served from file:// or a different host) can call it — same
 * pattern as the other /api/admin/* routes.
 *
 * Body: { date: "YYYY-MM-DD" }
 * Returns lunch/dinner ingredient roll-ups for the dashboard's "打印备餐单":
 *   { date, lunch: { count, ingredientText }, dinner: { count, ingredientText } }
 *
 * Recipe + aggregation logic is shared with /api/n8n/daily-prep via
 * src/lib/prepIngredients.ts — guaranteed identical to BowlMama's brief.
 */

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const CORS_HEADERS: Record<string, string> = {
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

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  try {
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    return !!decoded.email && ADMIN_EMAILS.includes(decoded.email);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));
  }

  let date: string;
  try {
    const body = await req.json();
    date = String(body?.date || '').trim();
  } catch {
    return corsify(NextResponse.json({ error: '请求格式错误' }, { status: 400 }));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return corsify(NextResponse.json({ error: '日期格式应为 YYYY-MM-DD' }, { status: 400 }));
  }

  try {
    const db = await getDb();
    const snap = await db.collection('orders').where('deliveryDate', '==', date).get();
    const orders = snap.docs
      .map(d => d.data() as PrepOrder)
      .filter(o => o.status !== 'cancelled');

    const lunch = orders.filter(isLunchOrder);
    const dinner = orders.filter(o => !isLunchOrder(o));

    return corsify(NextResponse.json({
      date,
      lunch: { count: lunch.length, ingredientText: aggregateIngredients(lunch).text },
      dinner: { count: dinner.length, ingredientText: aggregateIngredients(dinner).text },
    }));
  } catch (err) {
    console.error('[admin/daily-prep] failed:', err);
    const msg = err instanceof Error ? err.message : '获取食材清单失败';
    return corsify(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
