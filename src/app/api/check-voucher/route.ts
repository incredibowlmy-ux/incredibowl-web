import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const { voucherCode } = await request.json();
        if (!voucherCode) {
            return NextResponse.json({ error: '请输入优惠码' }, { status: 400 });
        }

        const db = getAdminDb();
        const code = voucherCode.trim().toUpperCase();
        const snap = await db.collection('vouchers').doc(code).get();

        if (!snap.exists) {
            return NextResponse.json({ error: '优惠码无效，请检查后重试' }, { status: 404 });
        }

        const data = snap.data()!;

        if (data.isUsed) {
            return NextResponse.json({ error: '此优惠码已被使用' }, { status: 400 });
        }

        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
            return NextResponse.json({ error: '此优惠码已过期' }, { status: 400 });
        }

        const discount = typeof data.discount === 'number' ? data.discount : 1;
        return NextResponse.json({ valid: true, discount });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || '验证失败' }, { status: 500 });
    }
}
