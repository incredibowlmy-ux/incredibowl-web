import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Razorpay POSTs here (application/x-www-form-urlencoded) after FPX bank redirect.
// We verify the HMAC signature and redirect back to the home page with the result.
export async function POST(request: NextRequest) {
    const origin = new URL(request.url).origin;
    try {
        const body = await request.text();
        const params = new URLSearchParams(body);

        const razorpay_payment_id = params.get("razorpay_payment_id");
        const razorpay_order_id = params.get("razorpay_order_id");
        const razorpay_signature = params.get("razorpay_signature");

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            // Payment failed or was cancelled
            return NextResponse.redirect(`${origin}/?fpx_error=cancelled`);
        }

        const expectedSig = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const expectedBuf = Buffer.from(expectedSig, "hex");
        const receivedBuf = Buffer.from(razorpay_signature, "hex");

        if (
            expectedBuf.length !== receivedBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, receivedBuf)
        ) {
            return NextResponse.redirect(`${origin}/?fpx_error=invalid`);
        }

        const dest = new URL("/", origin);
        dest.searchParams.set("fpx_ok", "1");
        dest.searchParams.set("fpx_pid", razorpay_payment_id);
        dest.searchParams.set("fpx_oid", razorpay_order_id);
        return NextResponse.redirect(dest.toString());
    } catch (err) {
        console.error("FPX callback error:", err);
        return NextResponse.redirect(`${origin}/?fpx_error=1`);
    }
}
