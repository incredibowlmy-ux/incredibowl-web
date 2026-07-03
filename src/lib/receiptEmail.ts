/**
 * Customer order-receipt email — the first customer-facing automated touch
 * after payment. Sent when an order transitions to 'confirmed' (browser
 * callback, admin confirm, or the payment webhook fallback all funnel through
 * /api/confirm-order, which calls this).
 *
 * Transport: Resend REST API via fetch — no SDK dependency.
 * Config (Vercel env):
 *   RESEND_API_KEY     — required to actually send; absent → silent no-op so
 *                        deploys without the key never break checkout.
 *   RECEIPT_FROM_EMAIL — optional, defaults below. The domain must be verified
 *                        in Resend (SPF/DKIM) or mail lands in spam.
 *
 * MUST stay best-effort: a paid order can never fail to confirm because an
 * email bounced. Every path swallows errors after logging.
 */

const FROM_DEFAULT = 'Incredibowl 碗妈 <orders@incredibowl.my>';
const WHATSAPP = '60103370197';

interface ReceiptOrder {
    id: string;
    data: Record<string, any>;
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rm = (n: unknown) => `RM ${(Number(n) || 0).toFixed(2)}`;

// Matches the dashboard's #XXXXXX short-id convention (last 6, uppercased).
const shortId = (id: string) => id.slice(-6).toUpperCase();

const PAYMENT_LABEL: Record<string, string> = {
    fpx: 'FPX 网上银行',
    curlec: 'FPX 网上银行',
    voucher: '餐券抵扣',
    qr: '银行转账',
};

const TIME_LABEL: Record<string, string> = {
    'Lunch (11AM-1PM)': '🌞 午餐 11AM–1PM',
    'Dinner (5PM-8PM)': '🌙 晚餐 5PM–8PM',
};

function orderSectionHtml(o: ReceiptOrder): string {
    const d = o.data;
    const items: any[] = Array.isArray(d.items) ? d.items : [];
    const rows = items.map(it =>
        `<tr>
            <td style="padding:6px 0;color:#1A2D23;">${escapeHtml(String(it.name ?? ''))} × ${Number(it.quantity) || 1}</td>
            <td style="padding:6px 0;text-align:right;color:#1A2D23;">${rm((Number(it.price) || 0) * (Number(it.quantity) || 1))}</td>
        </tr>`
    ).join('');
    const fee = Number(d.deliveryFee) || 0;
    return `
    <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0;background:#fff;">
        <p style="margin:0 0 8px;font-weight:bold;color:#FF6B35;">
            订单 #${shortId(o.id)} · ${escapeHtml(String(d.deliveryDate ?? ''))} ${escapeHtml(TIME_LABEL[String(d.deliveryTime)] ?? String(d.deliveryTime ?? ''))}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
        <hr style="border:none;border-top:1px dashed #ddd;margin:8px 0;" />
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="color:#666;">餐费</td><td style="text-align:right;">${rm(d.total)}</td></tr>
            ${fee > 0 ? `<tr><td style="color:#666;">运费</td><td style="text-align:right;">${rm(fee)}</td></tr>` : ''}
        </table>
    </div>`;
}

/**
 * Send ONE receipt email per customer covering all order docs confirmed in
 * this batch (a multi-day checkout creates several docs under one payment —
 * customers should get one email, not five).
 */
export async function sendOrderReceiptEmails(orders: ReceiptOrder[]): Promise<void> {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            if (orders.length) console.log('[receipt] RESEND_API_KEY not set — skipping receipt email');
            return;
        }

        // Group by recipient; skip docs with no usable email (manual/stub users).
        const byEmail = new Map<string, ReceiptOrder[]>();
        for (const o of orders) {
            const email = String(o.data.userEmail || '').trim();
            if (!email || !email.includes('@')) continue;
            const list = byEmail.get(email) || [];
            list.push(o);
            byEmail.set(email, list);
        }

        for (const [email, group] of byEmail) {
            const first = group[0].data;
            const grand = group.reduce(
                (s, o) => s + (Number(o.data.total) || 0) + (Number(o.data.deliveryFee) || 0), 0);
            const payLabel = PAYMENT_LABEL[String(first.paymentMethod)] ?? String(first.paymentMethod ?? '');

            const html = `
<div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;background:#FDFBF7;padding:24px;border-radius:16px;">
    <h2 style="color:#1A2D23;margin:0 0 4px;">🍛 订单确认 · Order Confirmed</h2>
    <p style="color:#666;font-size:14px;margin:0 0 16px;">
        ${escapeHtml(String(first.userName || ''))} 你好，碗妈已收到你的订单，按时给你送到 👇
    </p>
    ${group.map(orderSectionHtml).join('')}
    <table style="width:100%;font-size:15px;font-weight:bold;color:#1A2D23;">
        <tr><td>合计（含运费）</td><td style="text-align:right;color:#FF6B35;">${rm(grand)}</td></tr>
        <tr><td style="font-weight:normal;color:#666;font-size:13px;">付款方式</td>
            <td style="text-align:right;font-weight:normal;color:#666;font-size:13px;">${escapeHtml(payLabel)}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;margin:16px 0 0;">📍 配送地址：${escapeHtml(String(first.userAddress || ''))}</p>
    <p style="color:#999;font-size:12px;margin:16px 0 0;">
        有任何调整，WhatsApp 碗妈：<a href="https://wa.me/${WHATSAPP}" style="color:#FF6B35;">+${WHATSAPP}</a><br/>
        Incredibowl · 家的味道 · incredibowl.my
    </p>
</div>`;

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: process.env.RECEIPT_FROM_EMAIL || FROM_DEFAULT,
                    to: [email],
                    subject: `订单确认 #${shortId(group[0].id)} · Incredibowl 碗妈`,
                    html,
                }),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.warn(`[receipt] send to ${email} failed (${res.status}): ${body}`);
            } else {
                console.log(`[receipt] sent to ${email} (${group.length} order part(s))`);
            }
        }
    } catch (e) {
        console.warn('[receipt] unexpected error (never blocks confirm):', e);
    }
}
