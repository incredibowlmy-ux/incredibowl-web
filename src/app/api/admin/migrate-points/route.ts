import { NextRequest, NextResponse } from 'next/server';

// One-shot migration: convert every customer's loyalty points balance into
// a permanent RM voucher, then zero out the balance. Decided 2026-05-17.
// See tasks/points-sunset-plan.md for the full rollout plan.
//
// Mode 'dry-run' (default): read-only. Returns the would-be voucher list,
// collisions, and per-customer WhatsApp messages — writes NOTHING.
// Mode 'commit': for each candidate, runs a transaction that creates the
// voucher doc and zeros user.points. Returns the same payload but with
// status='created' / 'failed' per row.
//
// Phase 2 (2026-05-31): delete this route + the /admin/migrate-points page.

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const maxDuration = 60; // Vercel: allow up to 60s for the batch.

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

const VOUCHER_SOURCE = 'points-migration-2026-05';

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildCode(nameClean: string, rm: number): string {
  return `LP${nameClean}${rm}`;
}

// Mirrors the customer-facing WhatsApp template the boss is going to send.
// Kept here (not in a shared util) so the route is self-contained — when
// Phase 2 deletes this file in 2026-05-31, the template goes with it.
function buildMessage({
  displayName,
  points,
  rm,
  code,
}: {
  displayName: string;
  points: number;
  rm: number;
  code: string;
}): string {
  const firstName = (displayName || '').trim().split(/\s+/)[0] || displayName;
  return [
    `Hi ${firstName}，跟你说一件 update 🙏`,
    `碗妈在简化奖励制度——餐券（5/10/20 packs）会是主要的省钱方式（最多省 10%），积分制度会逐步退掉。`,
    ``,
    `时间线：`,
    `📌 即日起：积分可查看，暂停兑换`,
    `📌 5月31日：积分系统正式下线`,
    ``,
    `你的积分没有 lost——直接转成 voucher 给你 💛`,
    ``,
    `你的账户：`,
    `🌟 ${points} 积分 → RM ${rm} voucher`,
    `🎫 Code: ${code}`,
    `无期限、无低消、所有菜都能用`,
    ``,
    `任何问题 WhatsApp 或 call 010-337 0197 🙏`,
    `谢谢一直支持碗妈 💛`,
    `—— 碗妈`,
  ].join('\n');
}

type Candidate = {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  pointsBefore: number;
  voucherRM: number;
  code: string;
  whatsapp: string;
};

/**
 * POST /api/admin/migrate-points
 * Auth: admin email (Bearer Firebase ID token)
 *
 * Body: { mode: 'dry-run' | 'commit' }
 *
 * Returns:
 *   {
 *     mode, summary,
 *     candidates: Candidate[],
 *     skipped: { uid, displayName, email, points, reason }[],
 *     collisions: { code, uids[] }[],           // batch-internal dupes
 *     existingCodeConflicts: { code, uid }[],   // code already in vouchers/
 *     results: { ...Candidate, status: 'created' | 'failed', error?: string }[],
 *   }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  let mode: 'dry-run' | 'commit' = 'dry-run';
  try {
    const body = await req.json();
    if (body?.mode === 'commit') mode = 'commit';
  } catch {
    // Empty / non-JSON body → default to dry-run.
  }

  try {
    const db = await getDb();
    const { Timestamp } = await import('firebase-admin/firestore');

    // 1. Pull every user.
    const snap = await db.collection('users').get();

    const candidates: Candidate[] = [];
    const skipped: { uid: string; displayName: string; email: string; points: number; reason: string }[] = [];

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const points = Number(data.points || 0);
      const email = (data.email || '').toLowerCase();
      const displayName = data.displayName || data.name || '';

      if (points <= 0) continue;
      if (ADMIN_EMAILS.includes(email)) {
        skipped.push({ uid: doc.id, displayName, email, points, reason: 'admin' });
        continue;
      }
      const nameClean = sanitizeName(displayName);
      if (!nameClean) {
        skipped.push({ uid: doc.id, displayName, email, points, reason: 'empty_name_after_sanitize' });
        continue;
      }

      const rm = Math.ceil(points / 10);
      const code = buildCode(nameClean, rm);
      const phone = data.phone || data.phoneNormalized || '';

      candidates.push({
        uid: doc.id,
        displayName,
        email,
        phone,
        pointsBefore: points,
        voucherRM: rm,
        code,
        whatsapp: buildMessage({ displayName, points, rm, code }),
      });
    }

    // 2. Detect within-batch code collisions.
    const codeMap = new Map<string, string>();
    const collisions: { code: string; uids: string[] }[] = [];
    for (const c of candidates) {
      const prev = codeMap.get(c.code);
      if (prev) {
        const existing = collisions.find(x => x.code === c.code);
        if (existing) existing.uids.push(c.uid);
        else collisions.push({ code: c.code, uids: [prev, c.uid] });
      } else {
        codeMap.set(c.code, c.uid);
      }
    }

    // 3. Check Firestore for pre-existing voucher codes (parallel for speed).
    const existsChecks = await Promise.all(
      candidates.map(c => db.collection('vouchers').doc(c.code).get()),
    );
    const existingCodeConflicts: { code: string; uid: string }[] = [];
    candidates.forEach((c, i) => {
      if (existsChecks[i].exists) existingCodeConflicts.push({ code: c.code, uid: c.uid });
    });

    const totalPoints = candidates.reduce((s, c) => s + c.pointsBefore, 0);
    const totalVoucherRM = candidates.reduce((s, c) => s + c.voucherRM, 0);

    const summary = {
      eligibleCustomers: candidates.length,
      skipped: skipped.length,
      totalPoints,
      totalVoucherRM,
      batchCollisions: collisions.length,
      existingCodeConflicts: existingCodeConflicts.length,
    };

    // 4. Abort if any collisions — must be resolved manually before commit.
    if (collisions.length > 0 || existingCodeConflicts.length > 0) {
      return corsify(NextResponse.json({
        ok: false,
        mode,
        error: 'CODE_COLLISION',
        summary,
        candidates,
        skipped,
        collisions,
        existingCodeConflicts,
      }, { status: 409 }));
    }

    if (mode === 'dry-run') {
      return corsify(NextResponse.json({
        ok: true,
        mode,
        summary,
        candidates,
        skipped,
        collisions,
        existingCodeConflicts,
        results: [],
      }));
    }

    // 5. COMMIT — parallel per-customer transactions.
    const now = Timestamp.now();
    const results: (Candidate & { status: 'created' | 'failed'; error?: string })[] = [];

    await Promise.all(candidates.map(async (c) => {
      const voucherRef = db.collection('vouchers').doc(c.code);
      const userRef = db.collection('users').doc(c.uid);
      try {
        await db.runTransaction(async (tx) => {
          const [vSnap, uSnap] = await Promise.all([tx.get(voucherRef), tx.get(userRef)]);
          if (vSnap.exists) throw new Error('VOUCHER_ALREADY_EXISTS');
          if (!uSnap.exists) throw new Error('USER_DISAPPEARED');
          const live = uSnap.data() || {};
          const livePoints = Number(live.points || 0);
          if (livePoints !== c.pointsBefore) {
            throw new Error(`POINTS_DRIFTED (was ${c.pointsBefore}, now ${livePoints})`);
          }

          tx.set(voucherRef, {
            code: c.code,
            discount: c.voucherRM,
            isUsed: false,
            usedBy: '',
            source: VOUCHER_SOURCE,
            redeemedBy: c.uid,
            migratedFromPoints: c.pointsBefore,
            createdAt: now,
            // No expiresAt → permanent (voucherValidation.ts skips check).
          });
          tx.update(userRef, {
            points: 0,
            pointsMigratedAt: now,
            pointsMigratedToVoucher: c.code,
            pointsMigratedRM: c.voucherRM,
          });
        });
        results.push({ ...c, status: 'created' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ ...c, status: 'failed', error: msg });
      }
    }));

    const created = results.filter(r => r.status === 'created').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return corsify(NextResponse.json({
      ok: failed === 0,
      mode,
      summary: { ...summary, created, failed },
      candidates,
      skipped,
      collisions,
      existingCodeConflicts,
      results,
    }));
  } catch (err) {
    console.error('migrate-points error:', err);
    const msg = err instanceof Error ? err.message : '迁移失败';
    return corsify(NextResponse.json({ ok: false, error: msg }, { status: 500 }));
  }
}
