import { NextRequest, NextResponse } from 'next/server';
import { appendTurn, mergeProfileFact, PROFILE_KEYS, type TurnExtra } from '@/lib/waWebhook';
import {
  isConfigured as waConfigured, lastInboundTs, sendText, sendMedia, sendInteractive,
  markRead, sendTemplate, windowRemainingMs, uploadMedia,
  type SendResult, type SendInteractiveSpec,
} from '@/lib/waSend';
import { effectiveStatus, inboxRows, mutateLead } from '@/lib/waInbox';

/**
 * POST /api/admin/wa-lead —— dashboard 的「碗妈对话」面板 + 「碗妈收件箱」（WATI 式）后端。
 *
 * 一个 POST 端点承载读和写（dashboard 的 callAdminAPI 只会 POST）：
 *   { op: 'list' }                              收件箱列表：全部 waLeads 按最后活动倒序，带未读数 / 24h 窗口
 *   { op: 'pulse',   since }                    只回 since 之后有新客户消息的对话（全局角标 / 新消息提醒的轻量轮询；
 *                                               since=0 等同 list）。行的形状与 list 一致
 *   { op: 'get',     phone }                    读 waLeads/{phone}：档案、全部 turns、人工接管状态、追单排程
 *   { op: 'read',    phone }                    老板看过了 → bossReadAtMs = now（未读归零）
 *   { op: 'assets' }                            本周菜品图清单（发图下拉用）
 *   { op: 'templates' }                         已过审模板清单（窗口外回复用，缓存 10 分钟）
 *   { op: 'unread',  phone }                    标为未读（已读时间拨回最后一条客户消息之前）
 *   { op: 'orderlink', phone }                  带对话标识的下单链接（…/o?ref=wa&lead=<clickToken>，没有 token 就生成）
 *   { op: 'send',    phone, text, minutes?,
 *            media? / interactive? / template?, replyTo? }
 *                                               从收件箱回客户：文本 / 图片文件 / 按钮列表 / 模板
 *                                               media = { kind, link } 或 { kind, data(base64), mime, filename? }（直接上传）
 *                                               → 记 turn(boss，带 wamid) → 自动接管
 *   { op: 'human',   phone, minutes? }          老板接管（bot 静音）
 *   { op: 'release', phone }                    释放
 *   { op: 'note',    phone, key, value }        记备注（key 白名单同 bot）
 *   { op: 'nudgeoff', phone }                   只停自动追单（对话照常：bot 照常回、老板照常发；客户再来消息也不会恢复）
 *   { op: 'nudgeon',  phone }                   恢复自动追单（客户下一条消息起重新排程）
 *   { op: 'ordered', phone }                    标记成交：停追单，归入「已成交」（客户 24h 内再来消息仍保持）
 *   { op: 'close',   phone }                    关闭：停追单，归入「已关闭」（客户再来消息自动重开）
 *   { op: 'reopen',  phone }                    重新打开：回到进行中（客户下一条消息起恢复追单排程）
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
/**
 * 收件箱不给用的模板。window_reopen_* 提交时是 UTILITY，Meta 审成 MARKETING（2026-09-09）——
 * 拿它「拉回超 24h 没回的客户」每条都按营销价收，老板拍板不用。不在列表里 = 下拉选不到、send 也拒。
 */
const TPL_DENY = /^window_reopen_/;

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
      .filter((t: any) => t.status === 'APPROVED' && !TPL_DENY.test(String(t.name)))
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
  if (!['list', 'pulse', 'assets', 'templates'].includes(op) && !phone) return corsify(NextResponse.json({ error: '缺 phone' }, { status: 400 }));

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
    // 不用 Firestore 的 orderBy('lastMsgMs')：那个字段客户发图片 / 语音 / 人工接管期间都不更新，
    // 而且缺这个字段的文档会被 orderBy 直接排除。排序改在内存里按真实最后活动算（见 waInbox.leadRow）。
    //
    // pulse = 同一份行数据的增量版：只读 since 之后有新入站的文档（webhook 每条入站都写
    // lastInboundAtMs），没新消息时一次轮询只算 1 次读取，所以可以在任何页面、后台标签页一直跑。
    if (op === 'list' || op === 'pulse') {
      const since = op === 'pulse' ? Math.max(0, Number(body?.since) || 0) : 0;
      const snapAll = since > 0
        ? await db.collection(COL).where('lastInboundAtMs', '>', since).get()
        : await db.collection(COL).get();
      const rows = inboxRows(snapAll.docs.map(doc => ({ id: doc.id, data: doc.data() as Record<string, any> })), now);
      return corsify(NextResponse.json({ rows, now, full: since === 0, sendConfigured: waConfigured() }, { headers: { 'Cache-Control': 'no-store' } }));
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

    // 标为未读：老板扫了一眼但现在没空回。把已读时间拨回最后一条客户消息之前，
    // 它就重新出现在「未读」里、角标也算上。客户那边的蓝勾收不回来（Meta 没有这个接口）。
    if (op === 'unread') {
      const lastIn = lastInboundTs(d.turns);
      if (!lastIn) return corsify(NextResponse.json({ error: '这个对话里还没有客户消息' }, { status: 400 }));
      await ref.set({ bossReadAtMs: lastIn - 1, updatedAtMs: now }, { merge: true });
      return corsify(NextResponse.json({ ok: true }));
    }

    // 带对话标识的下单链接：客户点了 → 这条对话亮「已点链接」，下的单也带上 waLeadToken（见 /o 与 /api/wa-click）。
    // token 平时由 n8n 的 touch 生成；老板对一个 bot 还没碰过的号码发链接时这里补一个。
    if (op === 'orderlink') {
      let token = String(d.clickToken || '');
      if (!/^[a-z0-9]{8,32}$/.test(token)) {
        const { randomBytes } = await import('node:crypto');
        token = randomBytes(8).toString('hex');
        await ref.set({ phone, clickToken: token, updatedAtMs: now }, { merge: true });
      }
      const path = d.lang === 'en' ? '/en/o' : '/o';
      return corsify(NextResponse.json({ ok: true, token, url: `https://www.incredibowl.my${path}?ref=wa&lead=${token}` }));
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
        // 两条路：公网链接（菜品图 / 预设），或老板直接上传的文件（base64 → 传给 Meta 换 media id）
        const dataB64 = typeof mediaIn.data === 'string' ? mediaIn.data.replace(/^data:[^,]*,/, '') : '';
        if (dataB64) {
          const mime = String(mediaIn.mime || '');
          if ((kind === 'image') !== mime.startsWith('image/')) return corsify(NextResponse.json({ ok: false, error: '文件类型和发送方式对不上' }, { status: 400 }));
          const up = await uploadMedia(new Uint8Array(Buffer.from(dataB64, 'base64')), mime, filename || (kind === 'image' ? 'photo.jpg' : 'file.pdf'));
          if (!up.ok || !up.id) return corsify(NextResponse.json({ ok: false, configured: up.configured, error: up.error || '上传失败' }, { status: 200 }));
          sent = await sendMedia(phone, { kind, id: up.id, caption, filename, replyTo });
          extra.media = { kind, id: up.id, mime, ...(filename ? { filename } : {}) };
        } else {
          sent = await sendMedia(phone, { kind, link: String(mediaIn.link || ''), caption, filename, replyTo });
          extra.media = { kind, link: String(mediaIn.link || ''), ...(filename ? { filename } : {}) };
        }
        turnText = kind === 'image' ? `[图片]${caption ? ' ' + caption : ''}` : `[文件]${filename ? ' ' + filename : ''}${caption ? ' ' + caption : ''}`;
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
      // 落库在事务里重读 turns：发 Meta 那一下最长 10 秒，期间客户回的话不能被旧数组盖掉
      let humanUntil = 0;
      await mutateLead(ref, (cur) => {
        const wasHuman = (Number(cur.humanUntil) || 0) > now;
        let turns = appendTurn(cur.turns, 'boss', turnText, now, { ...extra, status: 'sent', statusAtMs: now });
        if (!wasHuman) turns = appendTurn(turns, 'sys', `老板从收件箱回复，接管 ${minutes} 分钟，bot 静音`, now + 1);
        humanUntil = Math.max(Number(cur.humanUntil) || 0, now + minutes * 60 * 1000);
        return {
          phone, turns, lastMsgMs: now, bossReadAtMs: now, updatedAtMs: now,
          humanUntil, humanBy: 'inbox', humanSetAtMs: wasHuman ? (cur.humanSetAtMs || now) : now,
        };
      });
      return corsify(NextResponse.json({ ok: true, msgId: sent.msgId, humanUntil }));
    }

    if (op === 'get') {
      return corsify(NextResponse.json({
        found: snap.exists,
        phone,
        status: snap.exists ? effectiveStatus(d) : '',   // 已关闭后客户又来消息 → 显示为进行中，与列表一致
        orderId: String(d.orderId || ''),
        closedAtMs: Number(d.closedAtMs) || 0,
        lang: String(d.lang || ''),
        intent: String(d.intent || ''),
        name: String(d.name || ''),
        nudgeCount: Number(d.nudgeCount) || 0,
        nudgeOff: d.nudgeOff === true,
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
      // 上限 24 小时：收件箱的「接管到早上 9 点」按真实分钟数来（上午点要管到第二天早上，超过原来的 12 小时）
      const minutes = Math.min(1440, Math.max(1, Number(body?.minutes) || 120));
      const humanUntil = now + minutes * 60 * 1000;
      await mutateLead(ref, (cur) => ({
        phone, humanUntil, humanBy: 'dashboard', humanSetAtMs: now, updatedAtMs: now,
        turns: appendTurn(cur.turns, 'sys', `老板在 dashboard 接管 ${minutes > 180 ? `约 ${Math.round(minutes / 60)} 小时` : `${minutes} 分钟`}，bot 静音`, now),
      }));
      return corsify(NextResponse.json({ ok: true, humanUntil }));
    }

    if (op === 'release') {
      let wasHuman = false;
      await mutateLead(ref, (cur) => {
        wasHuman = (Number(cur.humanUntil) || 0) > now;
        return {
          phone, humanUntil: wasHuman ? now - 1 : (Number(cur.humanUntil) || 0), humanReleasedAtMs: now, updatedAtMs: now,
          ...(wasHuman ? { turns: appendTurn(cur.turns, 'sys', '老板在 dashboard 释放，bot 恢复', now) } : {}),
        };
      });
      return corsify(NextResponse.json({ ok: true, wasHuman }));
    }

    if (op === 'note') {
      // bot 也会写 profile（/api/n8n/lead note）→ 同样在事务里合并，别互相盖
      const out: { merged: ReturnType<typeof mergeProfileFact> } = { merged: null };
      await mutateLead(ref, (cur) => {
        out.merged = mergeProfileFact(cur.profile, String(body?.key || ''), body?.value);
        return out.merged ? { phone, profile: out.merged, profileUpdatedAtMs: now, profileUpdatedBy: admin.email, updatedAtMs: now } : null;
      });
      if (!out.merged) return corsify(NextResponse.json({ error: `不接受的 key 或空值（可用：${PROFILE_KEYS.join(' / ')}）` }, { status: 400 }));
      return corsify(NextResponse.json({ ok: true, profile: out.merged }));
    }

    // 手动收尾：成交 / 关闭 / 重新打开。成交与关闭都停追单，对话不锁（bot 照常回、老板照常发）。
    // 订单确认时也会自动标成交，见 src/lib/waLeadStatus.ts；客户再来消息的处理见 n8n/lead 的 touch。
    if (op === 'ordered' || op === 'close' || op === 'reopen') {
      if (!snap.exists) return corsify(NextResponse.json({ error: '这个号码还没有对话记录' }, { status: 404 }));
      if (op === 'reopen') {
        await mutateLead(ref, (cur) => ({
          status: 'engaged', closedReason: '', closedAtMs: 0, orderId: '', updatedAtMs: now,
          turns: appendTurn(cur.turns, 'sys', '老板重新打开对话（客户下一条消息起恢复追单排程）', now),
        }));
        return corsify(NextResponse.json({ ok: true, status: 'engaged' }));
      }
      const status = op === 'ordered' ? 'ordered' : 'closed';
      await mutateLead(ref, (cur) => ({
        status, nextNudgeMs: 0, closedReason: 'manual', closedBy: admin.email, closedAtMs: now, updatedAtMs: now,
        turns: appendTurn(cur.turns, 'sys', op === 'ordered' ? '老板标记成交，停止追单' : '老板关闭对话，停止追单（客户再来消息会自动重开）', now),
      }));
      return corsify(NextResponse.json({ ok: true, status }));
    }

    // 只关追单，不动 status —— 以前用 status='closed' 会连带把收件箱对话锁死
    if (op === 'nudgeoff' || op === 'nudgeon') {
      const off = op === 'nudgeoff';
      await mutateLead(ref, (cur) => ({
        phone, nudgeOff: off, nudgeOffAtMs: off ? now : 0, updatedAtMs: now,
        ...(off ? { nextNudgeMs: 0 } : {}),
        turns: appendTurn(cur.turns, 'sys', off ? '老板停止自动追单（对话照常）' : '老板恢复自动追单', now),
      }));
      return corsify(NextResponse.json({ ok: true, nudgeOff: off }));
    }

    return corsify(NextResponse.json({ error: `未知 op: ${op}` }, { status: 400 }));
  } catch (err: any) {
    console.error('[admin/wa-lead] failed:', err);
    return corsify(NextResponse.json({ error: err?.message || '操作失败' }, { status: 500 }));
  }
}
