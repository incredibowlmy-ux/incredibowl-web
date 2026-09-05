import { NextRequest, NextResponse } from 'next/server';
import { appendTurn, mergeProfileFact, PROFILE_KEYS } from '@/lib/waWebhook';

/**
 * POST /api/admin/wa-lead —— dashboard 的「碗妈对话」面板后端。
 *
 * 一个 POST 端点承载读和写（dashboard 的 callAdminAPI 只会 POST）：
 *   { op: 'get',     phone }                    读 waLeads/{phone}：档案、turns、人工接管状态、追单排程
 *   { op: 'human',   phone, minutes? }          老板接管（bot 静音）
 *   { op: 'release', phone }                    释放
 *   { op: 'note',    phone, key, value }        记备注（key 白名单同 bot）
 *   { op: 'close',   phone }                    关闭 lead（停止追单）
 *
 * 鉴权：与 /api/admin/update-user 同款（Firebase ID token + 管理员邮箱白名单）。
 * CORS：Desktop 版 dashboard 从 file:// 调，必须带 * + OPTIONS（见 memory dashboard 两副本）。
 */

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const COL = 'waLeads';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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
  try {
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

/** dashboard 里的号码可能是 0125230066 / +60 12-523 0066 / 60125230066，统一成国际格式纯数字。 */
function toIntl(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '60' + d.slice(1);
  return d;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  let body: any;
  try { body = await req.json(); } catch {
    return corsify(NextResponse.json({ error: '请求格式错误' }, { status: 400 }));
  }
  const op = String(body?.op || 'get').toLowerCase();
  const phone = toIntl(body?.phone);
  if (!phone) return corsify(NextResponse.json({ error: '缺 phone' }, { status: 400 }));

  try {
    const db = await getDb();
    const ref = db.collection(COL).doc(phone);
    const now = Date.now();
    const snap = await ref.get();
    const d = (snap.exists ? snap.data() : {}) as Record<string, any>;

    if (op === 'get') {
      return corsify(NextResponse.json({
        found: snap.exists,
        phone,
        status: String(d.status || ''),
        lang: String(d.lang || ''),
        intent: String(d.intent || ''),
        name: String(d.name || ''),
        nudgeCount: Number(d.nudgeCount) || 0,
        nextNudgeMs: Number(d.nextNudgeMs) || 0,
        lastMsgMs: Number(d.lastMsgMs) || 0,
        clicked: !!d.clickedAtMs,
        human: (Number(d.humanUntil) || 0) > now,
        humanUntil: Number(d.humanUntil) || 0,
        humanBy: String(d.humanBy || ''),
        profile: (d.profile && typeof d.profile === 'object') ? d.profile : {},
        turns: Array.isArray(d.turns) ? d.turns.slice(-30) : [],
        profileKeys: PROFILE_KEYS,
        now,
      }, { headers: { 'Cache-Control': 'no-store' } }));
    }

    if (op === 'human') {
      const minutes = Math.min(720, Math.max(1, Number(body?.minutes) || 120));
      const humanUntil = now + minutes * 60 * 1000;
      await ref.set({
        phone, humanUntil, humanBy: 'dashboard', humanSetAtMs: now, updatedAtMs: now,
        turns: appendTurn(d.turns, 'sys', `老板在 dashboard 接管 ${minutes} 分钟，bot 静音`, now),
      }, { merge: true });
      return corsify(NextResponse.json({ ok: true, humanUntil }));
    }

    if (op === 'release') {
      const wasHuman = (Number(d.humanUntil) || 0) > now;
      await ref.set({
        phone, humanUntil: wasHuman ? now - 1 : (Number(d.humanUntil) || 0), humanReleasedAtMs: now, updatedAtMs: now,
        ...(wasHuman ? { turns: appendTurn(d.turns, 'sys', '老板在 dashboard 释放，bot 恢复', now) } : {}),
      }, { merge: true });
      return corsify(NextResponse.json({ ok: true, wasHuman }));
    }

    if (op === 'note') {
      const merged = mergeProfileFact(d.profile, String(body?.key || ''), body?.value);
      if (!merged) return corsify(NextResponse.json({ error: `不接受的 key 或空值（可用：${PROFILE_KEYS.join(' / ')}）` }, { status: 400 }));
      await ref.set({ phone, profile: merged, profileUpdatedAtMs: now, profileUpdatedBy: admin.email, updatedAtMs: now }, { merge: true });
      return corsify(NextResponse.json({ ok: true, profile: merged }));
    }

    if (op === 'close') {
      await ref.set({ phone, status: 'closed', nextNudgeMs: 0, closedReason: 'dashboard', closedAtMs: now, updatedAtMs: now }, { merge: true });
      return corsify(NextResponse.json({ ok: true }));
    }

    return corsify(NextResponse.json({ error: `未知 op: ${op}` }, { status: 400 }));
  } catch (err: any) {
    console.error('[admin/wa-lead] failed:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
