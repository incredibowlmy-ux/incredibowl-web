import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * 客户付款前所在的语言站点 → 回跳落地页。
 *
 * 原来这里 5 条 redirect 全部写死 `/`：英文客户从 /en 结账、从银行回来一律
 * 落在中文首页，看到的是中文成功弹窗和中文报错 —— 而 /en 那份英文弹窗
 * （en/page.tsx）明明早就写好了，只是永远没机会执行。
 *
 * locale 由 CartDrawer 挂在 callback_url 的 query 上带过来。Razorpay 是否在
 * 所有支付方式下都原样回传这个 query 尚未实测，所以 page.tsx 里另有一道读
 * localStorage 快照的兜底重定向；两条都失效才会回落中文（快照也丢了的情况
 * 本来就无从得知语言）。
 */
const localeHome = (locale: string | null) => (locale === "en" ? "/en" : "/");

function verifyAndRedirect(
    origin: string,
    locale: string | null,
    razorpay_payment_id: string | null,
    razorpay_order_id: string | null,
    razorpay_signature: string | null
) {
    const home = localeHome(locale);

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return NextResponse.redirect(`${origin}${home}?fpx_error=cancelled`, { status: 303 });
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
        return NextResponse.redirect(`${origin}${home}?fpx_error=invalid`, { status: 303 });
    }

    const dest = new URL(home, origin);
    dest.searchParams.set("fpx_ok", "1");
    dest.searchParams.set("fpx_pid", razorpay_payment_id);
    dest.searchParams.set("fpx_oid", razorpay_order_id);
    dest.searchParams.set("fpx_sig", razorpay_signature);
    return NextResponse.redirect(dest.toString(), { status: 303 });
}

// Razorpay sends a POST (form-encoded) in production.
export async function POST(request: NextRequest) {
    const reqUrl = new URL(request.url);
    const origin = reqUrl.origin;
    const locale = reqUrl.searchParams.get("locale");
    try {
        const body = await request.text();
        const params = new URLSearchParams(body);
        return verifyAndRedirect(
            origin,
            locale,
            params.get("razorpay_payment_id"),
            params.get("razorpay_order_id"),
            params.get("razorpay_signature")
        );
    } catch (err) {
        console.error("FPX callback POST error:", err);
        return NextResponse.redirect(`${origin}${localeHome(locale)}?fpx_error=1`, { status: 303 });
    }
}

// In test mode Razorpay sometimes does a GET redirect with query params instead of POST.
export async function GET(request: NextRequest) {
    const reqUrl = new URL(request.url);
    const origin = reqUrl.origin;
    const locale = reqUrl.searchParams.get("locale");
    try {
        const { searchParams } = reqUrl;
        return verifyAndRedirect(
            origin,
            locale,
            searchParams.get("razorpay_payment_id"),
            searchParams.get("razorpay_order_id"),
            searchParams.get("razorpay_signature")
        );
    } catch (err) {
        console.error("FPX callback GET error:", err);
        return NextResponse.redirect(`${origin}${localeHome(locale)}?fpx_error=1`, { status: 303 });
    }
}
