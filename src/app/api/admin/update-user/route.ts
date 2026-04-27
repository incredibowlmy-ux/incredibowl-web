import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

const TEXT_FIELDS = ['displayName', 'phone', 'address'] as const;
const NUMBER_FIELDS = ['points', 'totalSpent', 'totalOrders'] as const;
const ALLOWED_FIELDS = [...TEXT_FIELDS, ...NUMBER_FIELDS] as const;
type AllowedField = typeof ALLOWED_FIELDS[number];

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

export async function POST(req: NextRequest) {
    const admin = await verifyAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: '未授权访问' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { uid, updates, reason } = body as {
            uid?: string;
            updates?: Record<string, unknown>;
            reason?: string;
        };

        if (!uid || typeof uid !== 'string') {
            return NextResponse.json({ error: '缺少 uid' }, { status: 400 });
        }
        if (!updates || typeof updates !== 'object') {
            return NextResponse.json({ error: '缺少 updates' }, { status: 400 });
        }
        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return NextResponse.json({ error: '请填写变更原因（用于审计）' }, { status: 400 });
        }

        const db = await getDb();
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: '客户不存在' }, { status: 404 });
        }
        const currentData = userSnap.data() || {};

        const sanitized: Record<string, unknown> = {};
        const changes: Record<string, { from: unknown; to: unknown }> = {};

        for (const [key, val] of Object.entries(updates)) {
            if (!(ALLOWED_FIELDS as readonly string[]).includes(key)) continue;

            if ((NUMBER_FIELDS as readonly string[]).includes(key)) {
                const num = Number(val);
                if (Number.isNaN(num)) {
                    return NextResponse.json({ error: `${key} 必须是数字` }, { status: 400 });
                }
                if (num < 0) {
                    return NextResponse.json({ error: `${key} 不能为负数` }, { status: 400 });
                }
                const currentNum = Number(currentData[key]) || 0;
                if (currentNum === num) continue;
                sanitized[key] = num;
                changes[key] = { from: currentNum, to: num };
            } else {
                const str = val == null ? '' : String(val).trim();
                const currentStr = String(currentData[key] || '');
                if (currentStr === str) continue;
                sanitized[key] = str;
                changes[key] = { from: currentStr, to: str };
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json({ error: '没有变更' }, { status: 400 });
        }

        const { FieldValue } = await import('firebase-admin/firestore');
        sanitized.updatedAt = FieldValue.serverTimestamp();

        const auditRef = userRef.collection('auditLog').doc();
        const batch = db.batch();
        batch.update(userRef, sanitized);
        batch.set(auditRef, {
            changedBy: admin.email,
            changedAt: FieldValue.serverTimestamp(),
            reason: reason.trim(),
            changes,
        });
        await batch.commit();

        const fresh = await userRef.get();
        return NextResponse.json({ user: { id: uid, ...fresh.data() } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '更新失败';
        console.error('Admin update-user error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
