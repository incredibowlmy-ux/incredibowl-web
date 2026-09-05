/**
 * telegramAlert.ts —— 给老板发一条 Telegram 文字（best-effort，永不抛错）。
 *
 * ownerNotify.ts 那份是「新 QR 订单」专用（带邮件 + 订单格式化）；这里是给
 * 基础设施报警用的通用版：WhatsApp relay 转发失败、验签失败、限流触发。
 * 环境变量与 ownerNotify 相同：TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID（可逗号分隔多人）。
 *
 * 内存级节流：同一 key 在 windowMs 内只发一条（Vercel 每个实例各自计数，
 * 所以是「大致」节流，够用 —— 目的只是别让一次故障刷屏几百条）。
 */
const lastSent = new Map<string, number>();

export async function sendTelegramAlert(text: string, opts: { key?: string; windowMs?: number } = {}): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = (process.env.TELEGRAM_OWNER_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!token || chatIds.length === 0) {
      console.log('[telegramAlert] TELEGRAM_BOT_TOKEN / TELEGRAM_OWNER_CHAT_ID 未设置 —— 跳过:', text.slice(0, 80));
      return false;
    }
    if (opts.key) {
      const now = Date.now();
      const prev = lastSent.get(opts.key) || 0;
      if (now - prev < (opts.windowMs ?? 60 * 60 * 1000)) return false;
      lastSent.set(opts.key, now);
    }
    const results = await Promise.allSettled(chatIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true }),
      }).then(r => { if (!r.ok) console.warn(`[telegramAlert] ${chatId} → ${r.status}`); return r.ok; }),
    ));
    return results.some(r => r.status === 'fulfilled' && r.value === true);
  } catch (e) {
    console.warn('[telegramAlert] 发送失败（已吞掉）:', e);
    return false;
  }
}
