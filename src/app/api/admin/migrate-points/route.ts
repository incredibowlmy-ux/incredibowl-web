import { NextRequest, NextResponse } from 'next/server';

// Read-only points report. Returns every customer with points > 0, plus
// the suggested RM amount, suggested voucher code, and a ready-to-paste
// WhatsApp message. The admin handles voucher creation manually using the
// existing admin voucher tools — this endpoint never writes to Firestore.
//
// Decided 2026-05-18 (sunset rolled back from auto-commit to report-only:
// the boss wants per-customer judgement before minting any voucher).
//
// Phase 2 (2026-05-31): delete this route + the /admin/migrate-points page.
// See tasks/points-sunset-plan.md.

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const maxDuration = 60;

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

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildCode(nameClean: string, rm: number): string {
  return `LP${nameClean}${rm}`;
}

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
 * Read-only. Returns the full points report. Body is ignored (kept POST
 * to match the existing admin Bearer-token plumbing).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  try {
    const db = await getDb();
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

    // Sort by points DESC so the biggest balances come first.
    candidates.sort((a, b) => b.pointsBefore - a.pointsBefore);

    const summary = {
      eligibleCustomers: candidates.length,
      skipped: skipped.length,
      totalPoints: candidates.reduce((s, c) => s + c.pointsBefore, 0),
      totalVoucherRM: candidates.reduce((s, c) => s + c.voucherRM, 0),
    };

    return corsify(NextResponse.json({
      ok: true,
      summary,
      candidates,
      skipped,
    }));
  } catch (err) {
    console.error('migrate-points report error:', err);
    const msg = err instanceof Error ? err.message : '查询失败';
    return corsify(NextResponse.json({ ok: false, error: msg }, { status: 500 }));
  }
}
