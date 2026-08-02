/**
 * Owner (BowlMama) new-order alert — the missing real-time ping so a QR order
 * placed at midnight never sits unseen until morning.
 *
 * Why QR specifically: a QR order is written to Firestore as `status: 'pending'`
 * by /api/submit-order and is ONLY moved to `confirmed` when the owner manually
 * verifies the DuitNow receipt in the dashboard. Nothing else nudges the owner —
 * so without this alert the order is invisible until someone happens to open the
 * dashboard. (FPX auto-confirms via the payment callback + shows in the 06:30
 * prep brief, so it isn't the gap.)
 *
 * Two channels, both best-effort:
 *   Telegram — Bot API sendMessage. Env: TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID.
 *              Primary channel: phone push with sound = actually wakes you.
 *   Email    — Resend REST (same transport as receiptEmail.ts). Env: RESEND_API_KEY
 *              (already used for customer receipts). To: OWNER_NOTIFY_EMAIL
 *              (defaults to incredibowl.my@gmail.com). Backup channel.
 *
 * MUST stay best-effort: a customer's order must never fail because a Telegram
 * or email send hiccupped. Every path logs and swallows. Missing env → silent
 * skip (so a deploy without the keys doesn't break checkout).
 */

const FROM_DEFAULT = 'Incredibowl 碗妈 <orders@incredibowl.my>';
const OWNER_EMAIL_DEFAULT = 'incredibowl.my@gmail.com';
const WHATSAPP = '60103370197';

interface NotifyOrder {
    id: string;
    data: Record<string, any>;
}

// Matches the dashboard / receipt #XXXXXX short-id convention (last 6, upper).
const shortId = (id: string) => id.slice(-6).toUpperCase();
const rm = (n: unknown) => `RM ${(Number(n) || 0).toFixed(2)}`;

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TIME_LABEL: Record<string, string> = {
    'Lunch (11AM-1PM)': '🌞 午餐 11AM–1PM',
    'Dinner (5PM-8PM)': '🌙 晚餐 5PM–8PM',
};
const timeLabel = (t: unknown) => TIME_LABEL[String(t)] ?? String(t ?? '');

/**
 * 这封提醒的收件人是老板，永远中文 —— 但英文站下的单要标出来，否则碗妈
 * 会用中文去 WhatsApp 回一个英文客户。locale 由 submit-order 落库。
 */
const isEnCustomer = (d: Record<string, any>) => d?.locale === 'en';

/** One-order block in plain text (Telegram) — items, totals, receipt link. */
function orderLinesText(o: NotifyOrder): string[] {
    const d = o.data;
    const items: any[] = Array.isArray(d.items) ? d.items : [];
    const lines: string[] = [];
    lines.push(`🧾 订单 #${shortId(o.id)}`);
    lines.push(`👤 ${String(d.userName || '客户')} · ${String(d.userPhone || '')}`.trim());
    if (isEnCustomer(d)) lines.push('🗣 客户语言：English —— 请用英文回复');
    if (d.userAddress) lines.push(`📍 ${String(d.userAddress)}`);
    lines.push(`🗓 ${String(d.deliveryDate || '')} ${timeLabel(d.deliveryTime)}`.trim());
    for (const it of items) {
        lines.push(`   • ${String(it.name ?? '')} ×${Number(it.quantity) || 1}`);
    }
    const fee = Number(d.deliveryFee) || 0;
    const grand = (Number(d.total) || 0) + fee;
    lines.push(`💰 合计 ${rm(grand)}${fee > 0 ? `（含运费 ${rm(fee)}）` : ''}`);
    if (d.receiptUrl) lines.push(`📸 收据：${String(d.receiptUrl)}`);
    return lines;
}

function buildTelegramText(orders: NotifyOrder[]): string {
    const sep = '━━━━━━━━━━━━━━━━━━━━';
    const head = orders.length > 1
        ? `🔔 新 QR 订单待核对收款（${orders.length} 单）`
        : '🔔 新 QR 订单待核对收款';
    const blocks = orders.map(o => orderLinesText(o).join('\n'));
    return [head, sep, blocks.join(`\n${sep}\n`), sep,
        '⚠️ 请核对收款后到 Dashboard 确认此单'].join('\n');
}

/** One-order block as HTML (email). */
function orderBlockHtml(o: NotifyOrder): string {
    const d = o.data;
    const items: any[] = Array.isArray(d.items) ? d.items : [];
    const rows = items.map(it =>
        `<tr><td style="padding:4px 0;color:#1A2D23;">${escapeHtml(String(it.name ?? ''))} × ${Number(it.quantity) || 1}</td></tr>`
    ).join('');
    const fee = Number(d.deliveryFee) || 0;
    const grand = (Number(d.total) || 0) + fee;
    return `
    <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:12px 0;background:#fff;">
        <p style="margin:0 0 6px;font-weight:bold;color:#FF6B35;">订单 #${shortId(o.id)}</p>
        <p style="margin:0 0 4px;color:#1A2D23;font-size:14px;">👤 ${escapeHtml(String(d.userName || '客户'))} · ${escapeHtml(String(d.userPhone || ''))}</p>
        ${isEnCustomer(d) ? `<p style="margin:0 0 4px;color:#FF6B35;font-size:13px;font-weight:bold;">🗣 客户语言：English —— 请用英文回复</p>` : ''}
        <p style="margin:0 0 4px;color:#666;font-size:13px;">📍 ${escapeHtml(String(d.userAddress || ''))}</p>
        <p style="margin:0 0 8px;color:#666;font-size:13px;">🗓 ${escapeHtml(String(d.deliveryDate || ''))} ${escapeHtml(timeLabel(d.deliveryTime))}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
        <hr style="border:none;border-top:1px dashed #ddd;margin:8px 0;" />
        <p style="margin:0;font-weight:bold;color:#1A2D23;">💰 合计 ${rm(grand)}${fee > 0 ? `<span style="font-weight:normal;color:#666;">（含运费 ${rm(fee)}）</span>` : ''}</p>
        ${d.receiptUrl ? `<p style="margin:8px 0 0;font-size:13px;">📸 收据：<a href="${escapeHtml(String(d.receiptUrl))}" style="color:#FF6B35;">查看转账截图</a></p>` : ''}
    </div>`;
}

async function sendTelegram(orders: NotifyOrder[]): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // TELEGRAM_OWNER_CHAT_ID may be a comma-separated list of chat ids so more
    // than one person gets the alert (e.g. owner + BowlMama). Each recipient
    // must have started a chat with the bot first (Telegram won't let a bot
    // message a user who never initiated). One bad id can't block the others.
    const chatIds = (process.env.TELEGRAM_OWNER_CHAT_ID || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    if (!token || chatIds.length === 0) {
        console.log('[ownerNotify] TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID not set — skipping Telegram');
        return;
    }
    const text = buildTelegramText(orders);
    await Promise.allSettled(chatIds.map(async (chatId) => {
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                console.warn(`[ownerNotify] telegram send to ${chatId} failed (${res.status}): ${body}`);
            } else {
                console.log(`[ownerNotify] telegram sent to ${chatId} (${orders.length} order(s))`);
            }
        } catch (e) {
            console.warn(`[ownerNotify] telegram error for ${chatId} (never blocks order):`, e);
        }
    }));
}

async function sendEmail(orders: NotifyOrder[]): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log('[ownerNotify] RESEND_API_KEY not set — skipping owner email');
        return;
    }
    const to = process.env.OWNER_NOTIFY_EMAIL || OWNER_EMAIL_DEFAULT;
    const first = orders[0];
    const subject = orders.length > 1
        ? `🔔 新 QR 订单 ${orders.length} 单待核对 · Incredibowl`
        : `🔔 新 QR 订单 #${shortId(first.id)} 待核对 · Incredibowl`;
    const html = `
<div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;background:#FDFBF7;padding:24px;border-radius:16px;">
    <h2 style="color:#1A2D23;margin:0 0 4px;">🔔 新 QR 订单待核对收款</h2>
    <p style="color:#666;font-size:14px;margin:0 0 8px;">有顾客用 QR 转账下单并上传了收据，请核对收款后到 Dashboard 确认。</p>
    ${orders.map(orderBlockHtml).join('')}
    <p style="color:#999;font-size:12px;margin:16px 0 0;">
        WhatsApp 顾客：<a href="https://wa.me/${WHATSAPP}" style="color:#FF6B35;">+${WHATSAPP}</a><br/>
        Incredibowl · 后台提醒 · incredibowl.my
    </p>
</div>`;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: process.env.RECEIPT_FROM_EMAIL || FROM_DEFAULT,
                to: [to],
                subject,
                html,
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[ownerNotify] owner email failed (${res.status}): ${body}`);
        } else {
            console.log(`[ownerNotify] owner email sent to ${to} (${orders.length} order(s))`);
        }
    } catch (e) {
        console.warn('[ownerNotify] owner email error (never blocks order):', e);
    }
}

/**
 * Alert the owner about newly-placed QR order(s). One Telegram message + one
 * email covering all order docs in the batch (a multi-day QR checkout creates
 * several docs under one payment — the owner wants one alert, not five).
 *
 * Best-effort: never throws, never blocks the order. Callers should still
 * `await` it (Vercel freezes the serverless instance after the response, which
 * would kill an un-awaited fetch mid-flight).
 */
export async function notifyOwnerNewQrOrder(orders: NotifyOrder[]): Promise<void> {
    try {
        if (!orders || orders.length === 0) return;
        await Promise.allSettled([sendTelegram(orders), sendEmail(orders)]);
    } catch (e) {
        console.warn('[ownerNotify] unexpected error (never blocks order):', e);
    }
}
