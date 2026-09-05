import { NextRequest, NextResponse, after } from 'next/server';
import {
  verifyMetaSignature, splitInbound, buildSinglePayload, decideInbound,
  appendTurn, describeInboundForTurn, SILENT_TYPES,
  type InboundMessage, type RelayFlags,
} from '@/lib/waWebhook';
import { sendTelegramAlert } from '@/lib/telegramAlert';

/**
 * /api/wa/webhook —— Meta WhatsApp webhook 的进入层（v4 relay）。
 *
 * 为什么要在 n8n 前面加这一层（一处改动堵四个缺口）：
 *   1. 验签：X-Hub-Signature-256（App Secret）。n8n 的 Code 节点禁用 crypto，做不了。
 *   2. 拆包：Meta 一个 webhook 可能带多条 messages / 多个 entry。v1–v3 的 Router 只读
 *      messages[0]，第二条静默丢失 —— 这里逐条拆成单消息 payload 转发。
 *   3. 去重 + 限流：msg.id 去重（Meta 重试）和同号每小时上限，状态放 waLeads 文档，
 *      跨并发可靠（n8n 的 $getWorkflowStaticData 不是）。
 *   4. 人工接管：lead 上 humanUntil > now 时把标记带给 n8n，AI 不回、原文转老板。
 *
 * 转发失败**绝不静默**：Telegram 报警 + 附 msg.id 与原文，老板至少知道有人在等。
 *
 * 响应策略：验签通过就立刻 200（Meta 等不到 200 会重试 → 变成重复消息），
 * 真正的处理放进 after()，Vercel 会保住这段执行到结束。
 *
 * 环境变量：
 *   WA_APP_SECRET       Meta App → 设置 → 基本 → 应用密钥（验签用；缺了直接拒收）
 *   WA_VERIFY_TOKEN     自定义字符串，Meta 后台订阅 webhook 时填同一个
 *   N8N_INBOUND_URL     n8n 的 webhook 地址（…/webhook/whatsapp-receive）
 *   N8N_INBOUND_SECRET  转发时带的 Bearer；n8n Webhook 节点开 Header Auth 校验同一个值
 *   WA_BOSS_PHONE       老板号码（限流豁免、不写 turns）；默认 60165014501
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL = 'waLeads';
const BOSS_PHONE_DEFAULT = '60165014501';

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

// ── Meta 订阅验证（GET）────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.WA_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ error: 'verification failed' }, { status: 403 });
}

// ── 消息进入（POST）────────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WA_APP_SECRET || '';

  if (!secret) {
    // fail-closed：没配密钥就不当 webhook。这条报警一小时最多一次。
    console.error('[wa/webhook] WA_APP_SECRET 未配置，拒收');
    after(() => sendTelegramAlert('🚨 WhatsApp relay：WA_APP_SECRET 未配置，所有客户消息正在被拒收！去 Vercel 环境变量补上。', { key: 'no-secret' }));
    return NextResponse.json({ error: 'relay not configured' }, { status: 500 });
  }
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
    after(() => sendTelegramAlert('⚠️ WhatsApp relay 收到签名不对的请求（已拒绝）。若刚换过 App Secret 请同步 Vercel；否则可能有人在乱打这个地址。', { key: 'bad-sig' }));
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const inbound = splitInbound(payload);
  // statuses / 空事件：200 结束，不打 n8n（顺便消掉 Guard 节点那些红色执行）
  if (!inbound.length) return NextResponse.json({ ok: true, forwarded: 0 });

  after(async () => {
    for (const im of inbound) {
      try {
        await handleOne(im);
      } catch (e: any) {
        console.error('[wa/webhook] handleOne failed:', e);
        await sendTelegramAlert(
          `🚨 WhatsApp relay 处理失败，客户消息可能没人回！\n号码：${im.from}\n类型：${im.type}\n原文：${describeInboundForTurn(im.message).slice(0, 200)}\nmsg.id：${im.msgId}\n错误：${String(e?.message || e).slice(0, 200)}`,
        );
      }
    }
  });

  return NextResponse.json({ ok: true, forwarded: inbound.length });
}

async function handleOne(im: InboundMessage): Promise<void> {
  const now = Date.now();
  const bossPhone = (process.env.WA_BOSS_PHONE || BOSS_PHONE_DEFAULT).replace(/\D/g, '');
  const isBoss = im.from === bossPhone;
  const silent = SILENT_TYPES.has(im.type);

  const db = await getDb();
  const ref = db.collection(COL).doc(im.from);

  // 一次事务：读状态 → 决定处置 → 写回（去重 / 限流 / 入站 turn）
  const decision = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const d = decideInbound(prev, im, now, { exempt: isBoss });
    if (d.duplicate) return d;
    const patch: Record<string, unknown> = { ...d.patch, phone: im.from, lastInboundAtMs: now };
    // 入站对话记录：唯一写入点在这里（n8n 侧不再写 in turn）。老板 / 静默类型不记。
    if (!isBoss && !silent && !d.throttled) {
      patch.turns = appendTurn(prev.turns, 'in', describeInboundForTurn(im.message), now);
    }
    tx.set(ref, patch, { merge: true });
    return d;
  });

  if (decision.duplicate) {
    console.log(`[wa/webhook] dup ${im.msgId} from ${im.from} — dropped`);
    return;
  }
  if (silent) {
    console.log(`[wa/webhook] silent type ${im.type} from ${im.from} — not forwarded`);
    return;
  }
  if (decision.throttled && !decision.throttleNotify) {
    console.log(`[wa/webhook] throttled ${im.from} — dropped (already notified this hour)`);
    return;
  }
  if (decision.throttleNotify) {
    await sendTelegramAlert(`⚠️ 号码 ${im.from} 一小时内超过上限，bot 已停止回复该号码到本小时结束。最近一条：${describeInboundForTurn(im.message).slice(0, 120)}`, { key: `throttle:${im.from}` });
  }

  const flags: RelayFlags = {
    relay: 'v4',
    receivedAtMs: now,
    human: decision.human,
    humanUntil: decision.humanUntil,
    throttled: decision.throttled,
    humanEndedRecently: decision.humanEndedRecently,
  };
  await forwardToN8n(buildSinglePayload(im, flags), im);
}

async function forwardToN8n(body: unknown, im: InboundMessage): Promise<void> {
  const url = process.env.N8N_INBOUND_URL;
  const secret = process.env.N8N_INBOUND_SECRET;
  if (!url) throw new Error('N8N_INBOUND_URL 未配置');

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
          'X-Incredibowl-Relay': 'v4',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return;
      lastErr = new Error(`n8n ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`);
      // 4xx（比如 n8n workflow 没 Active / header auth 不对）重试也没用
      if (res.status >= 400 && res.status < 500) break;
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 400 * attempt));
  }
  throw new Error(`转发 n8n 失败（${im.msgId}）：${String((lastErr as any)?.message || lastErr)}`);
}
