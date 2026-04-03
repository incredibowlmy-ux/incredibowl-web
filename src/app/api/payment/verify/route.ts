import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = body;

        // Validate all required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json(
                { error: "Missing payment verification fields" },
                { status: 400 }
            );
        }

        // Generate expected signature
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        // Compare signatures using constant-time comparison to prevent timing attacks
        const expectedBuf = Buffer.from(expectedSignature, "hex");
        const receivedBuf = Buffer.from(razorpay_signature, "hex");

        if (expectedBuf.length !== receivedBuf.length) {
            return NextResponse.json(
                { verified: false, error: "Invalid signature format" },
                { status: 400 }
            );
        }

        const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);

        if (isValid) {
            return NextResponse.json({
                verified: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
            });
        } else {
            return NextResponse.json(
                { verified: false, error: "Payment signature verification failed" },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error("Payment verification error:", error);
        return NextResponse.json(
            { error: error.message || "Verification failed" },
            { status: 500 }
        );
    }
}
