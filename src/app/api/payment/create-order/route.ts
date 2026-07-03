import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

/**
 * POST /api/payment/create-order — open a Razorpay order for FPX checkout.
 *
 * 🔒 2026-07-03 hardening: the client used to send the AMOUNT — pay RM 1 for a
 * RM 50 order by lying here. Now the client sends its pending orderIds; the
 * server verifies ownership + pending status, sums the AUTHORITATIVE amounts
 * from the order docs (total + deliveryFee), and binds the resulting
 * razorpayOrderId back onto each order so confirm-order can verify the paid
 * Razorpay order is THE one belonging to these order docs.
 */

// Lazy initialization: only create Razorpay instance at runtime, not at build time
let razorpayInstance: Razorpay | null = null;

function getRazorpay() {
    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });
    }
    return razorpayInstance;
}

export async function POST(request: NextRequest) {
    try {
        const { verifyBearerUser } = await import('@/lib/adminApi');
        const auth = await verifyBearerUser(request);
        if (!auth) {
            return NextResponse.json({ error: '请先登录再支付' }, { status: 401 });
        }

        const body = await request.json();
        const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds.filter((x: unknown) => typeof x === 'string') : [];
        if (!orderIds.length || orderIds.length > 10) {
            return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 });
        }

        // Authoritative amount = sum of the customer's own PENDING orders.
        const { getAdminDb } = await import('@/lib/firebase-admin');
        const db = getAdminDb();
        const refs = orderIds.map(id => db.collection('orders').doc(id));
        const snaps = await db.getAll(...refs);

        let totalMYR = 0;
        for (const snap of snaps) {
            if (!snap.exists) {
                return NextResponse.json({ error: '订单不存在' }, { status: 404 });
            }
            const o = snap.data()!;
            if (o.userId !== auth.uid && !auth.isAdmin) {
                return NextResponse.json({ error: '无权支付该订单' }, { status: 403 });
            }
            if (o.status !== 'pending') {
                return NextResponse.json({ error: '订单状态已变更，请刷新后重试' }, { status: 400 });
            }
            totalMYR += (Number(o.total) || 0) + (Number(o.deliveryFee) || 0);
        }

        const amountSen = Math.round(totalMYR * 100);
        if (amountSen < 100) {
            return NextResponse.json(
                { error: "Invalid amount. Minimum is RM 1.00 (100 sen)." },
                { status: 400 }
            );
        }

        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: amountSen, // smallest currency unit (sen)
            currency: "MYR",
            receipt: `rcpt_${Date.now()}`,
            notes: { orderIds: orderIds.join(','), uid: auth.uid },
        });

        // Bind the Razorpay order to our order docs — confirm-order requires the
        // signed razorpayOrderId to MATCH this binding (no cross-order replay).
        const { FieldValue } = await import('firebase-admin/firestore');
        const batch = db.batch();
        for (const ref of refs) {
            batch.update(ref, { razorpayOrderId: order.id, updatedAt: FieldValue.serverTimestamp() });
        }
        await batch.commit();

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error: any) {
        console.error("Razorpay create order error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create payment order" },
            { status: 500 }
        );
    }
}
