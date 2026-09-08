import { NextRequest, NextResponse } from 'next/server';
import { appendTurn, mergeProfileFact, PROFILE_KEYS, type TurnExtra } from '@/lib/waWebhook';
import {
  isConfigured as waConfigured, lastInboundTs, sendText, sendMedia, sendInteractive,
  markRead, sendTemplate, windowRemainingMs,
  type SendResult, type SendInteractiveSpec,
} from '@/lib/waSend';

/**
 * POST /api/admin/wa-lead —— dashboard 的「碗妈对话」面板 + 「碗妈收件箱」（WATI 式）后端。
 *
 * 一个 POST 端点承载读和写（dashboard 的 callAdminAPI 只会 POST）：
 *   { op: 'list' }                              收件箱列表：全部 waLeads 按最近消息倒序，带未读数 / 24h 窗口
 *   { op: 'get',     phone }                    读 waLeads/{phone}：档案、全部 turns、人工接管状态、追单排程
 *   { op: 'read',    phone }                    老板看过了 → bossReadAtMs = now（未读归零）
 *   { op: 'assets' }                            本周菜品图清单（发图下拉用）
 *   { op: 'templates' }                         已过审模板清单（窗口外回复用，缓存 10 分钟）
 *   { op: 'send',    phone, text, minutes?,
 *            media? / interactive? / template?, replyTo? }
 *                                               从收件箱回客户：文本 / 图片文件 / 按钮列表 / 模板
 *                                               → 记 turn(boss，带 wamid) → 自动接管
 *   { op: 'human',   phone, minutes? }          老板接管（bot 静音）
 *   { op: 'release', phone }                    释放
 *   { op: 'note',    phone, key, value }        记备注（key 白名单同 bot）
 *   { op: 'close',   phone }                    关闭 lead（停止追单）
 *
 * 鉴权：与 /api/admin/update-user 同款（Firebase ID token + 管理员邮箱白名单）。
 * CORS：Desktop 版 dashboard 从 file:// 调，必须带 * + OPTIONS（见 memory dashboard 两副本）。
 */

const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];
const COL = 'waLeads';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

let adminDb: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (adminDb) return adminDb;
  const { getAdminDb } = await import('@/lib/firebase-admin');
  adminDb = getAdminDb();
  return adminDb;
}

async function verifyAdmin(req: NextRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    await getDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) return null;
    return { email: decoded.email };
  } catch {
    return null;
  }
}

/** dashboard 里的号码可能是 0125230066 / +60 12-523 0066 / 60125230066，统一成国际格式纯数字。 */
function toIntl(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '60' + d.slice(1);
  return d;
}

/**
 * 已过审模板清单。缓存 10 分钟：老板在窗口外每开一个线程都会问一次，
 * 而模板几天才变一回，没必要每次都打 Meta。
 */
interface TemplateRow { name: string; lang: string; bodyText: string; paramCount: number }
let tplCache: { at: number; rows: TemplateRow[]; error?: string } | null = null;
const TPL_TTL_MS = 10 * 60 * 1000;

async function listTemplates(): Promise<{ templates: TemplateRow[]; configured: boolean; error?: string }> {
  // 正式 WABA 不是密钥，直接给默认值；沙盒 1092790916611496 上建不了模板
  const waba = process.env.WA_WABA_ID || '2664648817254746';
  const token = process.env.WA_ACCESS_TOKEN;
  if (!waba || !token) {
    return { templates: [], configured: false, error: !token ? 'WA_ACCESS_TOKEN 未配置' : 'WA_WABA_ID 未配置：跑 node scripts/wa-templates.mjs waba 拿 id 再加进 Vercel' };
  }
  if (tplCache && Date.now() - tplCache.at < TPL_TTL_MS) {
    return { templates: tplCache.rows, configured: true, ...(tplCache.error ? { error: tplCache.error } : {}) };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${waba}/message_templates?fields=name,status,language,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok || j?.error) throw new Error(j?.error?.message || `HTTP ${res.status}`);
    const rows: TemplateRow[] = (j.data || [])
      .filter((t: any) => t.status === 'APPROVED')
      .map((t: any) => {
        const body = (t.components || []).find((c: any) => c.type === 'BODY');
        const text = String(body?.text || '');
        // {{1}} {{2}} … 的最大编号 = 要填几个参数
        const nums = [...text.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
        return { name: String(t.name), lang: String(t.language), bodyText: text, paramCount: nums.length ? Math.max(...nums) : 0 };
      });
    tplCache = { at: Date.now(), rows };
    return { templates: rows, configured: true };
  } catch (e: any) {
    const error = `读模板失败：${String(e?.message || e).slice(0, 160)}`;
    tplCache = { at: Date.now(), rows: [], error };
    return { templates: [], configured: true, error };
  }
}

/** 把 {{1}} {{2}} 换成实际参数，用于记进对话记录（客户看到的就是这个）。 */
export function fillTemplate(bodyText: string, params: string[]): string {
  return String(bodyText || '').replace(/\{\{(\d+)\}\}/g, (_m, n) => String(params[Number(n) - 1] ?? `{{${n}}}`));
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return corsify(NextResponse.json({ error: '未授权访问' }, { status: 403 }));

  let body: any;
  try { body = await req.json(); } catch {
    return corsify(NextResponse.json({ error: '请求格式错误' }, { status: 400 }));
  }
  const op = String(body?.op || 'get').toLowerCase();
  const phone = toIntl(body?.phone);
  if (!['list', 'assets', 'templates'].includes(op) && !phone) return corsify(NextResponse.json({ error: '缺 phone' }, { status: 400 }));

  try {
    const db = await getDb();
    const now = Date.now();

    // ── 已过审的模板清单：窗口外回复用 ────────────────────────────────
    if (op === 'templates') {
      return corsify(NextResponse.json(await listTemplates(), { headers: { 'Cache-Control': 'no-store' } }));
    }

    // ── 菜品图清单：收件箱的「📎 发图」下拉用 ──────────────────────────
    // 为什么放服务端：dashboard 的 state.menu 是它自己那套 id，没有图片字段，
    // 而 Meta 图片消息不收 webp —— 唯一正确的来源是 weeklyMenu.ts 的 image
    // 换成 /meta-jpg/ 的 jpg 副本（与 /api/meta/product-feed 同一条规则）。
    if (op === 'assets') {
      const { weeklyMenu } = await import('@/data/weeklyMenu');
      const dishes = weeklyMenu
        .filter(d => !d.hidden && !d.retired && d.image.startsWith('/') && d.image.endsWith('.webp'))
        .map(d => ({
          name: `${d.name} ${d.nameEn}`.trim(),
          url: `https://www.incredibowl.my/meta-jpg/${d.image.slice(1).replace(/\.webp$/, '.jpg')}`,
        }));
      return corsify(NextResponse.json({ dishes }, { headers: { 'Cache-Control': 'no-store' } }));
    }

    // ── 收件箱列表：一次读全集合（waLeads 量级是几百，不分页）────────────
    if (op === 'list') {
      const all = await db.collection(COL).orderBy('lastMsgMs', 'desc').limit(400).get();
      const rows = all.docs.map(doc => {
        const x = doc.data() as Record<string, any>;
        const turns: any[] = Array.isArray(x.turns) ? x.turns : [];
        const last = turns[turns.length - 1];
        const readAt = Number(x.bossReadAtMs) || 0;
        const unread = turns.filter(t => t && t.role === 'in' && Number(t.ts) > readAt).length;
        const profile = (x.profile && typeof x.profile === 'object') ? x.profile : {};
        return {
          phone: doc.id,
          name: String(x.name || profile.nickname || ''),
          status: String(x.status || 'engaged'),
          lang: String(x.lang || ''),
          human: (Number(x.humanUntil) || 0) > now,
          humanUntil: Number(x.humanUntil) || 0,
          lastMsg: last ? { role: String(last.role || ''), text: String(last.text || '').slice(0, 120), ts: Number(last.ts) || 0 } : null,
          lastMsgMs: Number(x.lastMsgMs) || (last ? Number(last.ts) || 0 : 0),
          unread,
          clicked: !!x.clickedAtMs,
          nudgeCount: Number(x.nudgeCount) || 0,
          tags: Array.isArray(profile.tags) ? profile.tags : [],
          windowRemainingMs: windowRemainingMs(turns, now),
        };
      }).filter(r => r.lastMsgMs > 0);
      rows.sort((a, b) => b.lastMsgMs - a.lastMsgMs);
      return corsify(NextResponse.json({ rows, now, sendConfigured: waConfigured() }, { headers: { 'Cache-Control': 'no-store' } }));
    }

    const ref = db.collection(COL).doc(phone);
    const snap = await ref.get();
    const d = (snap.exists ? snap.data() : {}) as Record<string, any>;

    if (op === 'read') {
      await ref.set({ phone, bossReadAtMs: now }, { merge: true });
      // 顺手把客户那边的灰勾变蓝：老板真的在收件箱看到了，就该显示已读。
      // 只标最近一条未读入站（Meta 会连带把它之前的一起标掉），失败不影响本次操作。
      const turns: any[] = Array.isArray(d.turns) ? d.turns : [];
      const readAt = Number(d.bossReadAtMs) || 0;
      const lastUnread = turns.filter(t => t && t.role === 'in' && t.msgId && Number(t.ts) > readAt).pop();
      if (lastUnread) await markRead(String(lastUnread.msgId));
      return corsify(NextResponse.json({ ok: true, marked: !!lastUnread }));
    }

    if (op === 'send') {
      const text = String(body?.text || '').trim();
      const mediaIn = (body?.media && typeof body.media === 'object') ? body.media : null;
      const interIn = (body?.interactive && typeof body.interactive === 'object') ? body.interactive : null;
      const replyTo = body?.replyTo ? String(body.replyTo).slice(0, 200) : undefined;
      const tplIn = (body?.template && typeof body.template === 'object') ? body.template : null;
      if ([mediaIn, interIn, tplIn].filter(Boolean).length > 1) return corsify(NextResponse.json({ ok: false, error: '媒体 / 交互 / 模板只能选一种' }, { status: 400 }));
      if (!text && !mediaIn && !interIn && !tplIn) return corsify(NextResponse.json({ ok: false, error: '空文本' }, { status: 400 }));
      if (!waConfigured()) return corsify(NextResponse.json({ ok: false, configured: false, error: 'WA_ACCESS_TOKEN 未配置：Vercel 加上 Meta 永久 token 后才能从这里回复' }, { status: 200 }));
      // 模板是窗口外唯一的路，所以窗口判定只挡自由文本类
      const remain = windowRemainingMs(d.turns, now);
      if (remain <= 0 && !tplIn) {
        const lastIn = lastInboundTs(d.turns);
        return corsify(NextResponse.json({ ok: false, configured: true, windowClosed: true,
          error: lastIn ? `24 小时窗口已过（客户最后一条 ${new Date(lastIn + 8 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')} MYT）。窗口外只能发 Meta 审核过的模板 —— 在下面选一个模板发。` : '这个号码还没有客户消息，Meta 不允许主动发自由文本。' }, { status: 200 }));
      }

      // 三种消息共用同一条落库路径：发出去 → 记 turn（带 wamid，回执才对得上）→ 自动接管
      let sent: SendResult;
      let turnText: string;
      const extra: TurnExtra = {};
      if (tplIn) {
        const tplName = String(tplIn.name || '');
        const params = (Array.isArray(tplIn.params) ? tplIn.params : []).map((p: unknown) => String(p ?? '').trim());
        const known = (await listTemplates()).templates.find(t => t.name === tplName && t.lang === String(tplIn.lang || t.lang));
        if (!known) return corsify(NextResponse.json({ ok: false, error: `模板 ${tplName} 不在已过审清单里` }, { status: 400 }));
        if (params.filter(Boolean).length < known.paramCount) {
          return corsify(NextResponse.json({ ok: false, error: `这个模板要填 ${known.paramCount} 个变量` }, { status: 400 }));
        }
        sent = await sendTemplate(phone, tplName, known.lang, params.slice(0, known.paramCount));
        // 记进对话记录的是「客户实际看到的那句」，不是带 {{1}} 的原文
        turnText = fillTemplate(known.bodyText, params);
      } else if (mediaIn) {
        const kind = String(mediaIn.kind || 'image');
        if (kind !== 'image' && kind !== 'document') return corsify(NextResponse.json({ ok: false, error: '只支持 image / document' }, { status: 400 }));
        const caption = String(mediaIn.caption || text || '').trim();
        const filename = mediaIn.filename ? String(mediaIn.filename) : undefined;
        sent = await sendMedia(phone, { kind, link: String(mediaIn.link || ''), caption, filename, replyTo });
        turnText = kind === 'image' ? `[图片]${caption ? ' ' + caption : ''}` : `[文件]${filename ? ' ' + filename : ''}${caption ? ' ' + caption : ''}`;
        extra.media = { kind, link: String(mediaIn.link || ''), ...(filename ? { filename } : {}) };
      } else if (interIn) {
        const spec: SendInteractiveSpec = {
          body: String(interIn.body || text || ''),
          ...(Array.isArray(interIn.buttons) ? { buttons: interIn.buttons } : {}),
          ...(interIn.list ? { list: interIn.list } : {}),
          replyTo,
        };
        sent = await sendInteractive(phone, spec);
        const labels = Array.isArray(interIn.buttons)
          ? interIn.buttons.map((b: any) => String(b?.title || '')).filter(Boolean)
          : (interIn.list?.rows || []).map((r: any) => String(r?.title || '')).filter(Boolean);
        turnText = `${spec.body}\n〔${Array.isArray(interIn.buttons) ? '按钮' : '列表'}：${labels.join('｜')}〕`;
      } else {
        sent = await sendText(phone, text, { replyTo });
        turnText = text;
      }
      if (!sent.ok) return corsify(NextResponse.json({ ok: false, configured: sent.configured, error: sent.error }, { status: 200 }));

      if (sent.msgId) extra.msgId = sent.msgId;
      if (replyTo) extra.replyTo = replyTo;
      // 像 WATI 的「assign to me」：从收件箱回了话，bot 就闭嘴，不然客户下一句被 AI 抢答
      const minutes = Math.min(720, Math.max(1, Number(body?.minutes) || 120));
      const wasHuman = (Number(d.humanUntil) || 0) > now;
      let turns = appendTurn(d.turns, 'boss', turnText, now, { ...extra, status: 'sent', statusAtMs: now });
      if (!wasHuman) turns = appendTurn(turns, 'sys', `老板从收件箱回复，接管 ${minutes} 分钟，bot 静音`, now + 1);
      await ref.set({
        phone, turns, lastMsgMs: now, bossReadAtMs: now, updatedAtMs: now,
        humanUntil: Math.max(Number(d.humanUntil) || 0, now + minutes * 60 * 1000), humanBy: 'inbox', humanSetAtMs: wasHuman ? (d.humanSetAtMs || now) : now,
      }, { merge: true });
      return corsify(NextResponse.json({ ok: true, msgId: sent.msgId, humanUntil: Math.max(Number(d.humanUntil) || 0, now + minutes * 60 * 1000) }));
    }

    if (op === 'get') {
      return corsify(NextResponse.json({
        found: snap.exists,
        phone,
        status: String(d.status || ''),
        lang: String(d.lang || ''),
        intent: String(d.intent || ''),
        name: String(d.name || ''),
        nudgeCount: Number(d.nudgeCount) || 0,
        nextNudgeMs: Number(d.nextNudgeMs) || 0,
        lastMsgMs: Number(d.lastMsgMs) || 0,
        clicked: !!d.clickedAtMs,
        human: (Number(d.humanUntil) || 0) > now,
        humanUntil: Number(d.humanUntil) || 0,
        humanBy: String(d.humanBy || ''),
        profile: (d.profile && typeof d.profile === 'object') ? d.profile : {},
        turns: Array.isArray(d.turns) ? d.turns : [],
        bossReadAtMs: Number(d.bossReadAtMs) || 0,
        windowRemainingMs: windowRemainingMs(d.turns, now),
        sendConfigured: waConfigured(),
        profileKeys: PROFILE_KEYS,
        now,
      }, { headers: { 'Cache-Control': 'no-store' } }));
    }

    if (op === 'human') {
      const minutes = Math.min(720, Math.max(1, Number(body?.minutes) || 120));
      const humanUntil = now + minutes * 60 * 1000;
      await ref.set({
        phone, humanUntil, humanBy: 'dashboard', humanSetAtMs: now, updatedAtMs: now,
        turns: appendTurn(d.turns, 'sys', `老板在 dashboard 接管 ${minutes} 分钟，bot 静音`, now),
      }, { merge: true });
      return corsify(NextResponse.json({ ok: true, humanUntil }));
    }

    if (op === 'release') {
      const wasHuman = (Number(d.humanUntil) || 0) > now;
      await ref.set({
        phone, humanUntil: wasHuman ? now - 1 : (Number(d.humanUntil) || 0), humanReleasedAtMs: now, updatedAtMs: now,
        ...(wasHuman ? { turns: appendTurn(d.turns, 'sys', '老板在 dashboard 释放，bot 恢复', now) } : {}),
      }, { merge: true });
      return corsify(NextResponse.json({ ok: true, wasHuman }));
    }

    if (op === 'note') {
      const merged = mergeProfileFact(d.profile, String(body?.key || ''), body?.value);
      if (!merged) return corsify(NextResponse.json({ error: `不接受的 key 或空值（可用：${PROFILE_KEYS.join(' / ')}）` }, { status: 400 }));
      await ref.set({ phone, profile: merged, profileUpdatedAtMs: now, profileUpdatedBy: admin.email, updatedAtMs: now }, { merge: true });
      return corsify(NextResponse.json({ ok: true, profile: merged }));
    }

    if (op === 'close') {
      await ref.set({ phone, status: 'closed', nextNudgeMs: 0, closedReason: 'dashboard', closedAtMs: now, updatedAtMs: now }, { merge: true });
      return corsify(NextResponse.json({ ok: true }));
    }

    return corsify(NextResponse.json({ error: `未知 op: ${op}` }, { status: 400 }));
  } catch (err: any) {
    console.error('[admin/wa-lead] failed:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
