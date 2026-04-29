import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

type VoucherAction = 'reset' | 'markUsed' | 'extend' | 'delete';

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
        const { code, action, reason, extendDays } = body as {
            code?: string;
            action?: VoucherAction;
            reason?: string;
            extendDays?: number;
        };

        if (!code || typeof code !== 'string') {
            return NextResponse.json({ error: '缺少券码' }, { status: 400 });
        }
        if (!action || !['reset', 'markUsed', 'extend', 'delete'].includes(action)) {
            return NextResponse.json({ error: '无效的操作' }, { status: 400 });
        }
        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return NextResponse.json({ error: '请填写操作原因' }, { status: 400 });
        }

        const db = await getDb();
        const codeUpper = code.trim().toUpperCase();
        const voucherRef = db.collection('vouchers').doc(codeUpper);
        const voucherSnap = await voucherRef.get();
        if (!voucherSnap.exists) {
            return NextResponse.json({ error: '券码不存在' }, { status: 404 });
        }
        const current = voucherSnap.data() || {};

        const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
        const auditRef = db.collection('voucherAuditLog').doc();
        const auditPayload: Record<string, unknown> = {
            voucherCode: codeUpper,
            action,
            changedBy: admin.email,
            changedAt: FieldValue.serverTimestamp(),
            reason: reason.trim(),
        };

        const batch = db.batch();

        const currentMax = typeof current.maxUses === 'number' && current.maxUses > 0 ? current.maxUses : 1;
        const currentUsed = typeof current.usedCount === 'number' ? current.usedCount : (current.isUsed ? 1 : 0);

        if (action === 'reset') {
            if (currentUsed === 0) {
                return NextResponse.json({ error: '此券未被使用，无需重置' }, { status: 400 });
            }
            const before = { isUsed: !!current.isUsed, usedCount: currentUsed, usedBy: current.usedBy || '', usedAt: current.usedAt || null };
            batch.update(voucherRef, {
                isUsed: false,
                usedCount: 0,
                usedBy: '',
                usedAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            auditPayload.before = before;
            auditPayload.after = { isUsed: false, usedCount: 0, usedBy: '', usedAt: null };
        } else if (action === 'markUsed') {
            if (currentUsed >= currentMax) {
                return NextResponse.json({ error: '此券已被用完' }, { status: 400 });
            }
            batch.update(voucherRef, {
                isUsed: true,
                usedCount: currentMax,
                usedBy: `admin:${admin.email}`,
                usedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            auditPayload.before = { isUsed: !!current.isUsed, usedCount: currentUsed };
            auditPayload.after = { isUsed: true, usedCount: currentMax, usedBy: `admin:${admin.email}` };
        } else if (action === 'extend') {
            const days = Number(extendDays) > 0 ? Math.floor(Number(extendDays)) : 30;
            // Base from current expiresAt if it's still in the future, otherwise from now
            const now = new Date();
            const currentExp = current.expiresAt?.toDate ? current.expiresAt.toDate() : null;
            const base = currentExp && currentExp > now ? currentExp : now;
            const next = new Date(base);
            next.setDate(next.getDate() + days);
            batch.update(voucherRef, {
                expiresAt: Timestamp.fromDate(next),
                updatedAt: FieldValue.serverTimestamp(),
            });
            auditPayload.before = { expiresAt: currentExp ? currentExp.toISOString() : null };
            auditPayload.after = { expiresAt: next.toISOString(), addedDays: days };
        } else if (action === 'delete') {
            batch.delete(voucherRef);
            auditPayload.before = {
                code: codeUpper,
                discount: current.discount,
                isUsed: current.isUsed,
                maxUses: currentMax,
                usedCount: currentUsed,
                expiresAt: current.expiresAt?.toDate ? current.expiresAt.toDate().toISOString() : null,
            };
            auditPayload.after = null;
        }

        batch.set(auditRef, auditPayload);
        await batch.commit();

        if (action === 'delete') {
            return NextResponse.json({ success: true, deleted: true });
        }

        const fresh = await voucherRef.get();
        return NextResponse.json({ success: true, voucher: { id: codeUpper, ...fresh.data() } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '操作失败';
        console.error('Admin update-voucher error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
