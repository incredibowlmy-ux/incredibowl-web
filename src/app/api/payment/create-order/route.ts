import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { amount, currency = "MYR", receipt, notes } = body;

        // Validate amount (minimum RM 1.00 = 100 sen)
        if (!amount || amount < 100) {
            return NextResponse.json(
                { error: "Invalid amount. Minimum is RM 1.00 (100 sen)." },
                { status: 400 }
            );
        }

        const order = await razorpay.orders.create({
            amount: amount, // amount in smallest currency unit (sen for MYR)
            currency: currency,
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: notes || {},
        });

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
