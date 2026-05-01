import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateVoucher } from '@/lib/voucherValidation';

export async function POST(request: NextRequest) {
    try {
        const { voucherCode, userId } = await request.json();
        if (!voucherCode) {
            return NextResponse.json({ error: '请输入优惠码' }, { status: 400 });
        }

        const db = getAdminDb();
        const result = await validateVoucher(db, voucherCode, { userId });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            valid: true,
            discount: result.discount,
            remainingUses: result.remainingUses,
            maxUses: result.maxUses,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '验证失败';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
