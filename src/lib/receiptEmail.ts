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
 * 语言：整封信按订单文档上的 `locale` 字段渲染（下单那一刻由 submit-order /
 * manualOrderCore 盖章）。**不能**靠请求头猜 —— 这封信的触发方可能是 Razorpay
 * webhook，也可能是老板在 dashboard 手动确认 QR 单，那两条路径既没有浏览器也
 * 没有 Accept-Language。缺字段（本次上线前的旧单、外部脚本建的单）→ 'zh'，
 * 行为与改动前逐字一致。
 *
 * MUST stay best-effort: a paid order can never fail to confirm because an
 * email bounced. Every path swallows errors after logging.
 */

const FROM_DEFAULT = 'Incredibowl 碗妈 <orders@incredibowl.my>';
const WHATSAPP = '60103370197';

type Locale = 'zh' | 'en';

interface ReceiptOrder {
    id: string;
    data: Record<string, any>;
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rm = (n: unknown) => `RM ${(Number(n) || 0).toFixed(2)}`;

// Matches the dashboard's #XXXXXX short-id convention (last 6, uppercased).
const shortId = (id: string) => id.slice(-6).toUpperCase();

/** 订单文档 → 语言。未知值一律回落中文。 */
const orderLocale = (d: Record<string, any>): Locale => (d?.locale === 'en' ? 'en' : 'zh');

interface ReceiptDict {
    subject: (id: string) => string;
    heading: string;
    intro: (name: string) => string;
    orderLine: (id: string) => string;
    food: string;
    delivery: string;
    grandTotal: string;
    paymentMethod: string;
    addressLabel: string;
    footer: string;
    fontStack: string;
    payment: Record<string, string>;
    time: Record<string, string>;
}

const DICT: Record<Locale, ReceiptDict> = {
    zh: {
        subject: (id) => `订单确认 #${id} · Incredibowl 碗妈`,
        heading: '🍛 订单确认',
        intro: (name) => `${name} 你好，碗妈已收到你的订单，按时给你送到 👇`,
        orderLine: (id) => `订单 #${id}`,
        food: '餐费',
        delivery: '运费',
        grandTotal: '合计（含运费）',
        paymentMethod: '付款方式',
        addressLabel: '📍 配送地址：',
        footer: '有任何调整，WhatsApp 碗妈：',
        fontStack: `'PingFang SC','Microsoft YaHei',sans-serif`,
        payment: {
            fpx: 'FPX 网上银行',
            curlec: 'FPX 网上银行',
            voucher: '餐券抵扣',
            qr: '银行转账',
        },
        time: {
            'Lunch (11AM-1PM)': '🌞 午餐 11AM–1PM',
            'Dinner (5PM-8PM)': '🌙 晚餐 5PM–8PM',
        },
    },
    en: {
        subject: (id) => `Order confirmed #${id} · Incredibowl`,
        heading: '🍛 Order Confirmed',
        intro: (name) => `Hi ${name}, BowlMama has received your order and will deliver it on time 👇`,
        orderLine: (id) => `Order #${id}`,
        food: 'Food',
        delivery: 'Delivery',
        grandTotal: 'Total (incl. delivery)',
        paymentMethod: 'Payment method',
        addressLabel: '📍 Delivery address: ',
        footer: 'Need to change anything? WhatsApp BowlMama: ',
        fontStack: `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`,
        payment: {
            fpx: 'FPX online banking',
            curlec: 'FPX online banking',
            voucher: 'Meal voucher',
            qr: 'Bank transfer',
        },
        time: {
            'Lunch (11AM-1PM)': '🌞 Lunch 11AM–1PM',
            'Dinner (5PM-8PM)': '🌙 Dinner 5PM–8PM',
        },
    },
};

/** EN 收据显示英文菜名；items[].nameEn 由 submit-order 落库，缺就回落中文名。 */
const itemName = (it: any, locale: Locale) =>
    String((locale === 'en' ? (it?.nameEn || it?.name) : it?.name) ?? '');

function orderSectionHtml(o: ReceiptOrder, locale: Locale): string {
    const t = DICT[locale];
    const d = o.data;
    const items: any[] = Array.isArray(d.items) ? d.items : [];
    const rows = items.map(it =>
        `<tr>
            <td style="padding:6px 0;color:#1A2D23;">${escapeHtml(itemName(it, locale))} × ${Number(it.quantity) || 1}</td>
            <td style="padding:6px 0;text-align:right;color:#1A2D23;">${rm((Number(it.price) || 0) * (Number(it.quantity) || 1))}</td>
        </tr>`
    ).join('');
    const fee = Number(d.deliveryFee) || 0;
    const timeLabel = t.time[String(d.deliveryTime)] ?? String(d.deliveryTime ?? '');
    return `
    <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0;background:#fff;">
        <p style="margin:0 0 8px;font-weight:bold;color:#FF6B35;">
            ${escapeHtml(t.orderLine(shortId(o.id)))} · ${escapeHtml(String(d.deliveryDate ?? ''))} ${escapeHtml(timeLabel)}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
        <hr style="border:none;border-top:1px dashed #ddd;margin:8px 0;" />
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="color:#666;">${t.food}</td><td style="text-align:right;">${rm(d.total)}</td></tr>
            ${fee > 0 ? `<tr><td style="color:#666;">${t.delivery}</td><td style="text-align:right;">${rm(fee)}</td></tr>` : ''}
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
            // 一次结账 = 一种语言，取第一单的即可（多日单是同一个购物车拆出来的）。
            const locale = orderLocale(first);
            const t = DICT[locale];
            const grand = group.reduce(
                (s, o) => s + (Number(o.data.total) || 0) + (Number(o.data.deliveryFee) || 0), 0);
            const payLabel = t.payment[String(first.paymentMethod)] ?? String(first.paymentMethod ?? '');

            const html = `
<div style="font-family:${t.fontStack};max-width:520px;margin:0 auto;background:#FDFBF7;padding:24px;border-radius:16px;">
    <h2 style="color:#1A2D23;margin:0 0 4px;">${t.heading}</h2>
    <p style="color:#666;font-size:14px;margin:0 0 16px;">
        ${escapeHtml(t.intro(String(first.userName || '')))}
    </p>
    ${group.map(o => orderSectionHtml(o, locale)).join('')}
    <table style="width:100%;font-size:15px;font-weight:bold;color:#1A2D23;">
        <tr><td>${t.grandTotal}</td><td style="text-align:right;color:#FF6B35;">${rm(grand)}</td></tr>
        <tr><td style="font-weight:normal;color:#666;font-size:13px;">${t.paymentMethod}</td>
            <td style="text-align:right;font-weight:normal;color:#666;font-size:13px;">${escapeHtml(payLabel)}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;margin:16px 0 0;">${t.addressLabel}${escapeHtml(String(first.userAddress || ''))}</p>
    <p style="color:#999;font-size:12px;margin:16px 0 0;">
        ${t.footer}<a href="https://wa.me/${WHATSAPP}" style="color:#FF6B35;">+${WHATSAPP}</a><br/>
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
                    subject: t.subject(shortId(group[0].id)),
                    html,
                }),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.warn(`[receipt] send to ${email} failed (${res.status}): ${body}`);
            } else {
                console.log(`[receipt] sent to ${email} (${group.length} order part(s), ${locale})`);
            }
        }
    } catch (e) {
        console.warn('[receipt] unexpected error (never blocks confirm):', e);
    }
}
