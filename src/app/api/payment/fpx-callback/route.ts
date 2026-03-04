import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifyAndRedirect(
    origin: string,
    razorpay_payment_id: string | null,
    razorpay_order_id: string | null,
    razorpay_signature: string | null
) {
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
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
    dest.searchParams.set("fpx_sig", razorpay_signature);
    return NextResponse.redirect(dest.toString());
}

// Razorpay sends a POST (form-encoded) in production.
export async function POST(request: NextRequest) {
    const origin = new URL(request.url).origin;
    try {
        const body = await request.text();
        const params = new URLSearchParams(body);
        return verifyAndRedirect(
            origin,
            params.get("razorpay_payment_id"),
            params.get("razorpay_order_id"),
            params.get("razorpay_signature")
        );
    } catch (err) {
        console.error("FPX callback POST error:", err);
        return NextResponse.redirect(`${origin}/?fpx_error=1`);
    }
}

// In test mode Razorpay sometimes does a GET redirect with query params instead of POST.
export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;
    try {
        const { searchParams } = new URL(request.url);
        return verifyAndRedirect(
            origin,
            searchParams.get("razorpay_payment_id"),
            searchParams.get("razorpay_order_id"),
            searchParams.get("razorpay_signature")
        );
    } catch (err) {
        console.error("FPX callback GET error:", err);
        return NextResponse.redirect(`${origin}/?fpx_error=1`);
    }
}
