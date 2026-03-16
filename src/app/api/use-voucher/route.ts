import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        const { voucherCode, userId } = await request.json();
        if (!voucherCode || !userId) {
            return NextResponse.json({ error: 'Missing voucherCode or userId' }, { status: 400 });
        }

        const db = getAdminDb();
        const voucherRef = db.collection('vouchers').doc(voucherCode.trim().toUpperCase());

        // Atomic transaction: check then mark used
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(voucherRef);
            if (!snap.exists) throw new Error('优惠码不存在');
            if (snap.data()?.isUsed) throw new Error('优惠码已被使用');
            tx.update(voucherRef, {
                isUsed: true,
                usedBy: userId,
                usedAt: FieldValue.serverTimestamp(),
            });
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || '操作失败' }, { status: 400 });
    }
}
