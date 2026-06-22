import { NextResponse } from 'next/server';

// Public read of per-dish remaining stock for the menu UI. Returns a map
// { [dishIdString]: remaining } containing ONLY limited dishes; dishes absent
// from the map are unlimited. Fails open ({}) so a read error never blocks the
// menu — the server-side reserve in /api/submit-order is the real guard.

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

export async function GET() {
  try {
    const db = await getDb();
    const { getAllDishStock } = await import('@/lib/stockUtils');
    const stock = await getAllDishStock(db);
    return NextResponse.json(stock, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('dish-stock GET error:', err);
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }
}
