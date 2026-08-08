import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

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
 * POST /api/admin/adjust-addon-credit
 * Auth: admin email
 *
 * Manually correct a customer's prepaid add-on credit balance (dashboard
 * customer-profile ✎ / 🗑 buttons). DECREASE-ONLY: increases must go through
 * manual-addon-topup so every added unit has a matching cash record.
 *
 * Semantics per touched batch:
 *   - quantityRemaining AND quantityTotal both drop by the removed amount.
 *     `consumed = quantityTotal - quantityRemaining` feeds the recognized-
 *     revenue lifetime figure in /api/admin/data — reducing only `remaining`
 *     would count the write-off as consumption and inflate revenue. Reducing
 *     both also kills the release headroom, so a later order-cancel release
 *     can't resurrect the written-off units.
 *   - batch hits 0 → status 'adjusted-out' (distinct from redemption's
 *     'used-up'; every reader only trusts 'available', so it's ignored
 *     everywhere by construction).
 *   - an `adjustments` entry is appended for audit. Purchase docs and
 *     user.totalSpent are NOT touched — cash actually received stays on the
 *     books; if the original sale record itself was wrong, fix that record.
 *
 * Removal order: newest purchasedAt first (LIFO) — corrections almost always
 * undo the latest top-up mistake, and the customer's earliest-expiring
 * credits stay intact.
 *
 * Body:
 *   - userId: string (required)
 *   - addonId: string (required)
 *   - newRemaining: integer ≥ 0 (required) — target live balance; must be
 *     ≤ current balance
 *   - note?: string
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const body = await req.json();
    const { userId, addonId, newRemaining, note } = body || {};

    if (!userId || typeof userId !== 'string') {
      return corsify(NextResponse.json({ error: '缺少 userId' }, { status: 400 }));
    }
    if (!addonId || typeof addonId !== 'string') {
      return corsify(NextResponse.json({ error: '缺少 addonId' }, { status: 400 }));
    }
    const target = Number(newRemaining);
    if (!Number.isInteger(target) || target < 0) {
      return corsify(NextResponse.json({ error: 'newRemaining 必须是 ≥ 0 的整数' }, { status: 400 }));
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const now = Timestamp.now();

    const snap = await db.collection('mealVoucherAddonCredits')
      .where('userId', '==', userId)
      .where('addonId', '==', addonId)
      .where('status', '==', 'available')
      .get();

    const live = snap.docs.filter((d) => {
      const v = d.data() || {};
      const exp = v.expiresAt as Timestamp | undefined;
      return exp && exp.toMillis() > now.toMillis() && (Number(v.quantityRemaining) || 0) > 0;
    });
    const before = live.reduce((s, d) => s + (Number(d.data().quantityRemaining) || 0), 0);

    if (target > before) {
      return corsify(NextResponse.json({
        error: `只能调低或清零：现在剩 ${before} 个。要加量请用「＋充值加料」（有收钱记录）`,
      }, { status: 400 }));
    }
    if (target === before) {
      return corsify(NextResponse.json({ success: true, addonId, before, after: before, batchesTouched: 0 }));
    }

    // LIFO plan: newest purchase first.
    const candidates = [...live].sort((a, b) => {
      const pa = (a.data().purchasedAt as Timestamp | undefined)?.toMillis() ?? 0;
      const pb = (b.data().purchasedAt as Timestamp | undefined)?.toMillis() ?? 0;
      return pb - pa;
    });
    let delta = before - target;
    const plan: Array<{ id: string; take: number }> = [];
    for (const d of candidates) {
      if (delta <= 0) break;
      const rem = Number(d.data().quantityRemaining) || 0;
      const take = Math.min(rem, delta);
      plan.push({ id: d.id, take });
      delta -= take;
    }

    let writeOffRM = 0;
    await db.runTransaction(async (tx) => {
      const refs = plan.map((p) => db.collection('mealVoucherAddonCredits').doc(p.id));
      const fresh = await Promise.all(refs.map((r) => tx.get(r)));
      for (let i = 0; i < fresh.length; i++) {
        const v = fresh[i].data() || {};
        if (!fresh[i].exists || v.status !== 'available'
          || (Number(v.quantityRemaining) || 0) < plan[i].take) {
          throw new Error('批次状态已变（可能正被下单使用），请刷新后重试');
        }
      }
      for (let i = 0; i < refs.length; i++) {
        const v = fresh[i].data() || {};
        const rem = Number(v.quantityRemaining) || 0;
        const total = Number(v.quantityTotal) || 0;
        const after = rem - plan[i].take;
        writeOffRM += plan[i].take * (Number(v.unitAllocatedRM) || 0);
        tx.update(refs[i], {
          quantityRemaining: after,
          quantityTotal: Math.max(after, total - plan[i].take),
          status: after <= 0 ? 'adjusted-out' : 'available',
          adjustments: FieldValue.arrayUnion({
            atMs: Date.now(),
            by: admin.email,
            removed: plan[i].take,
            remainingBefore: rem,
            remainingAfter: after,
            note: String(note || '').slice(0, 200),
          }),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return corsify(NextResponse.json({
      success: true,
      addonId,
      before,
      after: target,
      batchesTouched: plan.length,
      writeOffRM: Number(writeOffRM.toFixed(2)),
    }));
  } catch (err: any) {
    console.error('admin adjust-addon-credit error:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
