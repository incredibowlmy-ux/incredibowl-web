import { NextRequest, NextResponse } from 'next/server';
import {
  computeNextNudge,
  isWithinWindow,
  MAX_NUDGES,
  WINDOW_MS,
} from '@/lib/waLeadSchedule';
import { appendTurn, mergeProfileFact, type TurnRole } from '@/lib/waWebhook';

/**
 * /api/n8n/lead —— 碗妈 bot 的 lead 状态机（v4：+ 对话记录 / 人工接管 / 客户备注 / 警报映射）。
 *
 * 为什么要有这个：v2 的「客户聊完就消失」全靠老板人肉跟进，因为对话状态只活在
 * AI 的 memory buffer 里，没有任何东西能在客户沉默后醒过来。追单必须有一份
 * **可查询、可排程**的状态，这就是它。v4 又把「AI 的记忆」也搬进同一份文档：
 * n8n 的 Window Buffer Memory 只活在进程内存里，n8n 一重启、跨天换 key 就全忘。
 *
 * 集合 `waLeads`，doc id = 纯数字手机号（天然幂等，n8n 拿 msg.from 直接就能查）。
 * 集合 `waAlerts`，doc id = 发给老板的那条 WhatsApp 消息 id（老板引用回复时反查客户）。
 *
 * POST { action }：
 *   touch    客户来消息 → upsert + 刷新 24h 窗口锚点 + 重算下次追单（入站 turn 由 relay 写）
 *   reply    bot / 老板 / 追单 发出了一条 → 记 turn（role: out | boss | nudge）
 *   human    人工接管 minutes 分钟（默认 120，上限 720）→ AI 静音、追单暂停
 *   release  解除人工接管
 *   note     bot 或 dashboard 记客户备注（key 白名单见 waWebhook.PROFILE_KEYS）
 *   alert    发给老板的警报消息 id ↔ 客户号码（取代 Google Sheet 的「报警消息ID」列）
 *   ordered  已成交 → 关闭，停止一切追单
 *   close    客户明确拒绝 / 转人工 → 关闭
 * GET：
 *   ?action=due   到点该追的 lead（**claim-on-read**：读到即计数，见下）
 *   ?phone=60…    读单个 lead（含 profile / turns / human 状态）
 *   ?alert=<id>   按警报消息 id 反查客户
 *
 * ⚠️ claim-on-read 是刻意的「至多一次」语义：GET due 的那一刻就把 nudgeCount+1、
 * 重排下一次。若 n8n 随后发送失败，这一次追单就永久丢了 —— 这是对的。反过来做
 * （发完再回报）一旦 n8n 中途崩溃就会重复发给客户，骚扰真人比少发一条严重得多。
 *
 * Auth：与 /api/n8n/customer 同款 —— 只收 Authorization 头（?key= 会漏进访问日志）
 * + 常数时间比较。这里能读到客户手机号，属于 PII 端点。
 */

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

const COL = 'waLeads';
const ALERTS = 'waAlerts';
/** 一次 cron 最多认领多少条，防止某次积压把 WhatsApp 打成刷屏。 */
const DUE_LIMIT = 30;
/** 刚发过追单的 lead 在这个时间内不再认领（防 cron 重叠执行）。 */
const RECLAIM_GUARD_MS = 10 * 60 * 1000;
/** 未处理消息缓冲上限（客户连发太多时只保留最近的）。 */
const PENDING_MAX = 10;
/** 单条消息进缓冲时的长度上限。 */
const PENDING_TEXT_MAX = 500;
/** 人工接管默认 / 上限时长。 */
const HUMAN_DEFAULT_MIN = 120;
const HUMAN_MAX_MIN = 720;

type Lang = 'zh' | 'en';
type Intent = 'retail' | 'catering';
type Status = 'engaged' | 'clicked' | 'ordered' | 'closed';

/** N8N_API_KEY 或 N8N_INBOUND_SECRET 任一即可（AI 工具节点只能用后者，见 src/lib/n8nAuth.ts）。 */
async function authOk(req: NextRequest): Promise<boolean> {
  const { n8nBearerOk } = await import('@/lib/n8nAuth');
  return n8nBearerOk(req.headers);
}

function randomToken(): string {
  // 只用于「点击回传」的不可枚举标识，不是凭据 —— 泄露最多让人误标一条 clicked。
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function digitsOf(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** 对外暴露给 n8n 的形状（刻意不回传全部内部字段）。 */
function publicLead(id: string, d: Record<string, any>, now = Date.now()) {
  const humanUntil = Number(d.humanUntil) || 0;
  return {
    phone: d.phone || id,
    lang: (d.lang === 'en' ? 'en' : 'zh') as Lang,
    intent: (d.intent === 'catering' ? 'catering' : 'retail') as Intent,
    status: (d.status || 'engaged') as Status,
    name: String(d.name || ''),
    isReturning: d.isReturning === true,
    nudgeCount: Number(d.nudgeCount) || 0,
    clickToken: String(d.clickToken || ''),
    clicked: !!d.clickedAtMs,
    lastMsgMs: Number(d.lastMsgMs) || 0,
    firstSeenMs: Number(d.firstSeenMs) || 0,
    human: humanUntil > now,
    humanUntil,
    humanBy: String(d.humanBy || ''),
    profile: (d.profile && typeof d.profile === 'object') ? d.profile : {},
    nextNudgeMs: Number(d.nextNudgeMs) || 0,
  };
}

// ────────────────────────────────────────────────────────────
// GET
// ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await authOk(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const action = String(url.searchParams.get('action') || '').toLowerCase();

  try {
    const db = await getDb();
    const now = Date.now();

    // ── 警报 id → 客户（老板引用回复时反查）────────────────
    const alertId = String(url.searchParams.get('alert') || '').trim();
    if (alertId) {
      const snap = await db.collection(ALERTS).doc(alertId).get();
      if (!snap.exists) return NextResponse.json({ found: false }, { headers: { 'Cache-Control': 'no-store' } });
      const a = snap.data() as Record<string, any>;
      return NextResponse.json({
        found: true,
        alertId,
        phone: String(a.phone || ''),
        customerMsg: String(a.customerMsg || ''),
        kind: String(a.kind || ''),
        ts: Number(a.ts) || 0,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ── 单个 lead（可同时当「防抖闸门」用）─────────────────
    //
    // 带 sinceTs 时顺便回答一个问题：**「我是不是这个客户最新的一条消息？」**
    // 这就是防抖：客户 3 秒内连发三条，三个 n8n 执行都会问这一句，只有最后一条
    // 得到 isLatest=true 继续往下走，前两条静默退出 —— 客户只会收到一条回复。
    //
    // ⚠️ 判定和取合并文本必须在**同一次调用**里做完（服务端原子完成）。
    if (action !== 'due') {
      const phone = digitsOf(url.searchParams.get('phone'));
      if (!phone) return NextResponse.json({ error: '缺 phone' }, { status: 400 });
      const snap = await db.collection(COL).doc(phone).get();
      if (!snap.exists) return NextResponse.json({ found: false, isLatest: true, mergedText: '' });

      const d = snap.data() as Record<string, any>;
      const sinceRaw = url.searchParams.get('sinceTs');
      const wantsGate = sinceRaw !== null;
      const sinceTs = Number(sinceRaw) || 0;
      const lastMsgMs = Number(d.lastMsgMs) || 0;
      const isLatest = !wantsGate || !(lastMsgMs > sinceTs);

      let mergedText = '';
      if (wantsGate && isLatest && url.searchParams.get('consume') === '1') {
        const pending: { ts: number; text: string }[] = Array.isArray(d.pending) ? d.pending : [];
        mergedText = pending
          .slice()
          .sort((a, b) => (Number(a?.ts) || 0) - (Number(b?.ts) || 0))
          .map(p => String(p?.text || '').trim())
          .filter(Boolean)
          .join('\n');
        if (pending.length) {
          // 消费掉：这些消息即将交给 AI 一起回答，不能在下一轮再被合并一次
          await snap.ref.update({ pending: [], pendingConsumedAtMs: now });
        }
      }

      const turns = Array.isArray(d.turns) ? d.turns.slice(-30) : [];
      return NextResponse.json({
        found: true,
        isLatest,
        mergedText,
        lead: publicLead(snap.id, d, now),
        turns,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // ── 到点该追的 lead（claim-on-read）────────────────────
    // 只用 nextNudgeMs 一个字段做范围查询（单字段索引自动存在，不需要建复合索引）；
    // status / 窗口 / 冷却 / 人工接管全部在内存里过滤 —— 待追 lead 的量级是几十，不是几万。
    const q = await db.collection(COL)
      .where('nextNudgeMs', '>', 0)
      .where('nextNudgeMs', '<=', now)
      .orderBy('nextNudgeMs')
      .limit(DUE_LIMIT * 3)
      .get();

    const claimed: any[] = [];
    const batch = db.batch();
    let writes = 0;

    for (const doc of q.docs) {
      if (claimed.length >= DUE_LIMIT) break;
      const d = doc.data() as Record<string, any>;
      const status: Status = d.status || 'engaged';
      const lastMsgMs = Number(d.lastMsgMs) || 0;
      const nudgeCount = Number(d.nudgeCount) || 0;
      const lastNudgeMs = Number(d.lastNudgeMs) || 0;

      // 已成交 / 已关闭 / 追满 → 清掉排程，永不再扫到
      if (status === 'ordered' || status === 'closed' || nudgeCount >= MAX_NUDGES) {
        batch.update(doc.ref, { nextNudgeMs: 0 }); writes++;
        continue;
      }
      // 超出 24h 客服窗口 → 放弃（第一阶段不上 template）
      if (!isWithinWindow(lastMsgMs, now)) {
        batch.update(doc.ref, { nextNudgeMs: 0, windowExpiredAtMs: now }); writes++;
        continue;
      }
      // 老板正亲自在聊 → 机器别插嘴。排程不动，人工结束后下一轮 cron 再来
      if ((Number(d.humanUntil) || 0) > now) continue;
      // cron 重叠执行的保护
      if (lastNudgeMs > 0 && now - lastNudgeMs < RECLAIM_GUARD_MS) continue;

      const nextCount = nudgeCount + 1;
      const following = computeNextNudge({ lastMsgMs, nudgeCount: nextCount, lastNudgeMs: now });
      batch.update(doc.ref, {
        nudgeCount: nextCount,
        lastNudgeMs: now,
        nextNudgeMs: following ?? 0,
        updatedAtMs: now,
      }); writes++;
      claimed.push({ ...publicLead(doc.id, d, now), nudgeIndex: nextCount });
    }

    if (writes) await batch.commit();
    return NextResponse.json({ now, count: claimed.length, leads: claimed }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[n8n/lead] GET failed:', err);
    // 追单挂了不该拖垮任何东西 —— 回空列表，cron 下一轮再来
    return NextResponse.json({ error: err?.message || 'lead lookup failed', count: 0, leads: [] }, { status: 200 });
  }
}

// ────────────────────────────────────────────────────────────
// POST
// ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await authOk(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const action = String(body?.action || 'touch').toLowerCase();
  const phone = digitsOf(body?.phone);
  if (!phone) return NextResponse.json({ error: '缺 phone' }, { status: 400 });

  try {
    const db = await getDb();
    const ref = db.collection(COL).doc(phone);
    const now = Date.now();

    // ── 警报映射（老板引用回复靠它反查客户）───────────────
    if (action === 'alert') {
      const alertId = String(body?.alertMsgId || '').trim();
      if (!alertId || alertId === 'unknown') return NextResponse.json({ ok: false, error: '缺 alertMsgId' }, { status: 200 });
      await db.collection(ALERTS).doc(alertId).set({
        phone,
        customerMsg: String(body?.customerMsg || '').slice(0, 1000),
        kind: String(body?.kind || 'escalate').slice(0, 40),
        ts: now,
      });
      return NextResponse.json({ ok: true, alertId });
    }

    const snap = await ref.get();
    const prev = (snap.exists ? snap.data() : {}) as Record<string, any>;

    // ── 成交 / 关闭：停止一切追单 ────────────────────────
    if (action === 'ordered' || action === 'close') {
      await ref.set({
        phone,
        status: action === 'ordered' ? 'ordered' : 'closed',
        nextNudgeMs: 0,
        closedReason: String(body?.reason || (action === 'ordered' ? 'ordered' : 'manual')).slice(0, 120),
        ...(body?.orderId ? { orderId: String(body.orderId).slice(0, 64) } : {}),
        closedAtMs: now,
        updatedAtMs: now,
      }, { merge: true });
      return NextResponse.json({ ok: true, status: action === 'ordered' ? 'ordered' : 'closed' });
    }

    // ── 出站对话记录 ─────────────────────────────────────
    if (action === 'reply') {
      const roleRaw = String(body?.role || 'out');
      const role: TurnRole = (['out', 'boss', 'nudge', 'sys'] as string[]).includes(roleRaw) ? roleRaw as TurnRole : 'out';
      const text = String(body?.text || '');
      if (!text.trim()) return NextResponse.json({ ok: false, error: '空文本' }, { status: 200 });
      await ref.set({ phone, turns: appendTurn(prev.turns, role, text, now), updatedAtMs: now }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    // ── 人工接管 / 解除 ──────────────────────────────────
    if (action === 'human') {
      const minutes = Math.min(HUMAN_MAX_MIN, Math.max(1, Number(body?.minutes) || HUMAN_DEFAULT_MIN));
      const humanUntil = now + minutes * 60 * 1000;
      await ref.set({
        phone,
        humanUntil,
        humanBy: String(body?.by || 'boss_reply').slice(0, 40),
        humanSetAtMs: now,
        updatedAtMs: now,
        turns: appendTurn(prev.turns, 'sys', `老板接管 ${minutes} 分钟，bot 静音`, now),
      }, { merge: true });
      return NextResponse.json({ ok: true, humanUntil, minutes });
    }
    if (action === 'release') {
      const wasHuman = (Number(prev.humanUntil) || 0) > now;
      await ref.set({
        phone,
        humanUntil: wasHuman ? now - 1 : (Number(prev.humanUntil) || 0),
        humanReleasedAtMs: now,
        updatedAtMs: now,
        ...(wasHuman ? { turns: appendTurn(prev.turns, 'sys', '老板释放，bot 恢复', now) } : {}),
      }, { merge: true });
      return NextResponse.json({ ok: true, wasHuman });
    }

    // ── 客户备注（白名单 key）────────────────────────────
    if (action === 'note') {
      const key = String(body?.key || '').trim();
      const merged = mergeProfileFact(prev.profile, key, body?.value);
      if (!merged) {
        return NextResponse.json({ ok: false, error: `不接受的 key 或空值：${key}` }, { status: 200 });
      }
      await ref.set({ phone, profile: merged, profileUpdatedAtMs: now, updatedAtMs: now }, { merge: true });
      return NextResponse.json({ ok: true, profile: merged });
    }

    if (action !== 'touch') {
      return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
    }

    // ── touch：客户来消息 ───────────────────────────────
    const prevLastMsg = Number(prev.lastMsgMs) || 0;
    const prevStatus: Status = prev.status || 'engaged';
    // 新一轮对话 = 距上次消息超过 24h（窗口已断）或上一轮已经收尾。
    // 只有新一轮才重置追单额度，避免同一个客户被连着几天反复追。
    // ⚠️ turns / profile 不随 session 重置 —— 记忆跨天保留，这正是 v4 与 buffer memory 的区别。
    const newSession = !snap.exists
      || prevStatus === 'ordered'
      || prevStatus === 'closed'
      || now - prevLastMsg > WINDOW_MS;

    const nudgeCount = newSession ? 0 : (Number(prev.nudgeCount) || 0);
    const lastNudgeMs = newSession ? 0 : (Number(prev.lastNudgeMs) || 0);
    const nextNudgeMs = computeNextNudge({ lastMsgMs: now, nudgeCount, lastNudgeMs }) ?? 0;

    // 未处理消息缓冲：客户连发的每一条都进来，等胜出的那次执行一并取走。
    const prevPending: { ts: number; text: string }[] = Array.isArray(prev.pending) ? prev.pending : [];
    const incoming = String(body?.text || '').trim().slice(0, PENDING_TEXT_MAX);
    const pending = (newSession ? [] : prevPending)
      .concat(incoming ? [{ ts: now, text: incoming }] : [])
      .slice(-PENDING_MAX);

    const patch: Record<string, any> = {
      phone,
      status: 'engaged',
      pending,
      lastMsgMs: now,
      nudgeCount,
      lastNudgeMs,
      nextNudgeMs,
      updatedAtMs: now,
      clickToken: prev.clickToken || randomToken(),
      firstSeenMs: Number(prev.firstSeenMs) || now,
      msgCount: (Number(prev.msgCount) || 0) + 1,
    };
    if (newSession) {
      patch.sessionStartMs = now;
      patch.clickedAtMs = 0;   // 新一轮重新计点击
      patch.orderId = '';
      patch.closedReason = '';
    }
    if (body?.lang === 'en' || body?.lang === 'zh') patch.lang = body.lang;
    if (body?.intent === 'catering' || body?.intent === 'retail') patch.intent = body.intent;
    if (typeof body?.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
    if (typeof body?.isReturning === 'boolean') patch.isReturning = body.isReturning;

    await ref.set(patch, { merge: true });

    const humanUntil = Number(prev.humanUntil) || 0;
    return NextResponse.json({
      ok: true,
      newSession,
      nextNudgeMs,
      human: humanUntil > now,
      humanEndedRecently: humanUntil > 0 && humanUntil <= now && now - humanUntil < 6 * 60 * 60 * 1000,
      lead: publicLead(phone, { ...prev, ...patch }, now),
    });
  } catch (err: any) {
    console.error('[n8n/lead] POST failed:', err);
    // ⚠️ fail-open：lead 记不上不该让客户收不到回复。追单丢一次，对话不能断。
    return NextResponse.json({ ok: false, error: err?.message || 'lead write failed' }, { status: 200 });
  }
}
