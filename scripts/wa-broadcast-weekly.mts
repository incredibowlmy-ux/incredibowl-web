/**
 * wa-broadcast-weekly.mts —— 用 weekly_menu_v1 模板群发下周菜单（取代老板手机手发）。
 *
 *   node --import ./scripts/_register-alias.mjs scripts/wa-broadcast-weekly.mts            dry-run：名单 + 预览 + 估算，不发
 *   … --to 60165119118                                                                    只发给一个号（先自己收一条看效果）
 *   … --send                                                                              真发（要 $env:WA_ACCESS_TOKEN）
 *   … --send --max 240                                                                    本次最多发多少（TIER_250 = 每 24h 250 个新客户）
 *   … --week 2026-09-15                                                                   指定下周一（默认 = 下一个周一）
 *   … --report 2026-09-15                                                                 看那次群发的送达/已读
 *
 * 规则（老板 09-09 拍板前的保守口径）：
 *   · 名单只取跟碗妈**聊过**的号码（waLeads），不拿网站下单客户的电话 —— Meta 要求营销消息
 *     要客户同意过；下单页没有勾选框，聊过至少算主动来找过。
 *   · 排除：optOut（回过 STOP）、status=closed、老板号。
 *   · 同一周的名单记在 analytics/wa-broadcast/<周一>.json，重跑会跳过已发的（分天发就靠这个）。
 *   · 每条记进 waLeads.turns（role=bc，带 wamid）→ relay 收回执后 --report 能算送达率/已读率。
 *   · 每条营销模板都收费；单价老板去 Meta 定价页看 Malaysia，脚本只给条数。
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { readMenuRuntime } from '@/lib/menuRuntime.server';
import { weekDocFor, mondayOf, ymdOfUTC } from '@/lib/menuResolve';
import { buildMenu } from '@/data/weeklyMenu';
import { broadcastTemplateParams } from '@/lib/menuBroadcast';
import { sendTemplate, isConfigured } from '@/lib/waSend';
import { appendTurn } from '@/lib/waWebhook';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const argv = process.argv.slice(2);
const flag = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const SEND = argv.includes('--send');
const ONLY = (flag('--to') || '').replace(/\D/g, '');
const MAX = Number(flag('--max')) || 240;
const REPORT = flag('--report');
const TEMPLATE = 'weekly_menu_v1';
const BOSS = (process.env.WA_BOSS_PHONE || '60165014501').replace(/\D/g, '');
const OUT_DIR = path.join(process.cwd(), 'analytics', 'wa-broadcast');

type LogRow = { phone: string; name: string; msgId?: string; ok: boolean; error?: string; at: number };
const logPath = (monday: string) => path.join(OUT_DIR, `${monday}.json`);
const readLog = (monday: string): LogRow[] => fs.existsSync(logPath(monday)) ? JSON.parse(fs.readFileSync(logPath(monday), 'utf8')) : [];
const writeLog = (monday: string, rows: LogRow[]) => { fs.mkdirSync(OUT_DIR, { recursive: true }); fs.writeFileSync(logPath(monday), JSON.stringify(rows, null, 2)); };

const norm = (raw: unknown) => { let d = String(raw ?? '').replace(/\D/g, ''); if (d.startsWith('0')) d = '60' + d.slice(1); return /^60\d{8,10}$/.test(d) ? d : ''; };

// ── 报告 ────────────────────────────────────────────────────
if (REPORT) {
  const rows = readLog(REPORT);
  const sent = rows.filter(r => r.ok && r.msgId);
  const st: Record<string, number> = { sent: 0, delivered: 0, read: 0, failed: 0, unknown: 0 };
  for (const r of sent) {
    const d = (await db.collection('waLeads').doc(r.phone).get()).data() || {};
    const t = (d.turns || []).find((x: any) => x.msgId === r.msgId);
    st[t?.status || 'unknown'] = (st[t?.status || 'unknown'] || 0) + 1;
  }
  const replied = (await Promise.all(sent.map(async r => {
    const d = (await db.collection('waLeads').doc(r.phone).get()).data() || {};
    return (d.turns || []).some((x: any) => x.role === 'in' && x.ts > r.at);
  }))).filter(Boolean).length;
  console.log(`\n群发 ${REPORT}：发出 ${sent.length}，失败 ${rows.length - sent.length}`);
  console.log(`  已送达 ${st.delivered + st.read}   已读 ${st.read}   失败回执 ${st.failed}   无回执 ${st.sent + st.unknown}`);
  console.log(`  之后回过话的客户 ${replied}（${sent.length ? Math.round(replied / sent.length * 100) : 0}%）\n`);
  process.exit(0);
}

// ── 下周菜单 → 模板变量 ─────────────────────────────────────
const today = ymdOfUTC(new Date(Date.now() + 8 * 3600e3));
const thisMonday = mondayOf(today);
const nextMonday = flag('--week') || (() => { const [y, m, d] = thisMonday.split('-').map(Number); return ymdOfUTC(new Date(Date.UTC(y, m - 1, d + 7))); })();
const rt = await readMenuRuntime(db);
const next = weekDocFor(rt, nextMonday);
const prev = weekDocFor(rt, thisMonday);
if (next.inherited) {
  console.log(`⚠️ ${nextMonday} 那周在 Firestore 里没有独立排期（沿用 ${prev.monday}）。老板还没排下周菜单，先别发。`);
  if (!ONLY) process.exit(1);
}
const menu = buildMenu(next.week);
const paramsFor = (name: string) => broadcastTemplateParams({ monday: nextMonday, week: next.week, prevWeek: prev.week, menu, name });
const [, range, newLine] = paramsFor('x');
console.log(`\n下周 ${nextMonday}（${range}）  新菜：${newLine}`);

// ── 名单 ────────────────────────────────────────────────────
const usersSnap = await db.collection('users').get();
const nameByPhone = new Map<string, string>();
usersSnap.forEach(u => { const p = norm(u.get('phone')); const n = String(u.get('displayName') || '').trim(); if (p && n && !nameByPhone.has(p)) nameByPhone.set(p, n); });

// 名单来源（--source）：
//   leads  只发跟碗妈聊过的（waLeads）—— 最保守。⚠️ 09-09 实测 waLeads 只有 2 个文档
//          （v4 才上线 3 天，之前的 lead 在 Google Sheet），等于没人可发。
//   users  网站下过单、留了手机的客户（users.phone，188 个）—— 就是老板现在手机 broadcast 的那群人。
//          Meta 要求营销消息客户同意过；下单页没勾选框，这一点老板自己拍板。
//   both   两者并集。
// 无论哪种，回过 STOP 的（waLeads.optOut）一律排除。
const SOURCE = (flag('--source') || 'leads') as 'leads' | 'users' | 'both';
const leadsSnap = await db.collection('waLeads').get();
const optedOut = new Set<string>();
const closedLeads = new Set<string>();
const leadName = new Map<string, string>();
leadsSnap.forEach(doc => {
  const d = doc.data(); const p = norm(doc.id); if (!p) return;
  if (d.optOut) optedOut.add(p);
  if (d.status === 'closed') closedLeads.add(p);
  const nm = String(d.name || d.profile?.nickname || '').trim(); if (nm) leadName.set(p, nm);
});
const candidates = new Map<string, string>(); // phone → name
if (SOURCE === 'leads' || SOURCE === 'both') leadsSnap.forEach(doc => { const p = norm(doc.id); if (p) candidates.set(p, leadName.get(p) || nameByPhone.get(p) || ''); });
if (SOURCE === 'users' || SOURCE === 'both') usersSnap.forEach(u => { const p = norm(u.get('phone')); if (p && !candidates.has(p)) candidates.set(p, leadName.get(p) || nameByPhone.get(p) || ''); });

const already = new Set(readLog(nextMonday).filter(r => r.ok).map(r => r.phone));
const skip: Record<string, number> = { optOut: 0, closed: 0, boss: 0, already: 0 };
const list: { phone: string; name: string }[] = [];
for (const [phone, name] of candidates) {
  if (phone === BOSS) { skip.boss++; continue; }
  if (optedOut.has(phone)) { skip.optOut++; continue; }
  if (SOURCE === 'leads' && closedLeads.has(phone)) { skip.closed++; continue; }
  if (already.has(phone)) { skip.already++; continue; }
  list.push({ phone, name });
}
console.log(`名单来源：${SOURCE}（leads=聊过的 / users=下过单留手机的 / both）`);
const targets = ONLY ? [{ phone: ONLY, name: nameByPhone.get(ONLY) || 'Ebby' }] : list.slice(0, MAX);

console.log(`名单：可发 ${list.length}（跳过 退订 ${skip.optOut} / 已关闭 ${skip.closed} / 本周已发 ${skip.already} / 老板 ${skip.boss}）`);
console.log(`本次：${targets.length} 条${ONLY ? `（只发 ${ONLY}）` : list.length > MAX ? `（上限 ${MAX}，剩 ${list.length - MAX} 条明天再跑）` : ''}`);
console.log(`\n预览（发给 ${targets[0]?.name || 'there'}）：`);
const p0 = paramsFor(targets[0]?.name || '');
console.log(`  Hi ${p0[0]} 😊 wei ting from Incredibowl here. Next week's menu (${p0[1]}) is ready — ${p0[2]}. Freshly cooked every morning, no MSG, less oil & salt. Order before 6:00 AM for same-day delivery. Reply STOP anytime to unsubscribe.`);
console.log(`  [See menu & order] → https://www.incredibowl.my/o?src=wa_weekly`);
console.log(`\n费用：${targets.length} 条营销模板 × 马来西亚单价（Meta 定价页选 Malaysia + MYR 看真数）`);

if (!SEND) { console.log('\n（dry-run。真发加 --send；先给自己发一条：--to 60165119118 --send）\n'); process.exit(0); }
if (!isConfigured()) { console.error('❌ 没有 WA_ACCESS_TOKEN'); process.exit(1); }

// ── 发送 ────────────────────────────────────────────────────
const rows = readLog(nextMonday);
let ok = 0, bad = 0;
for (const t of targets) {
  const params = paramsFor(t.name);
  const r = await sendTemplate(t.phone, TEMPLATE, 'en', params);
  const now = Date.now();
  rows.push({ phone: t.phone, name: t.name, msgId: r.msgId, ok: r.ok, error: r.error, at: now });
  writeLog(nextMonday, rows);
  if (r.ok) {
    ok++;
    const ref = db.collection('waLeads').doc(t.phone);
    const prevDoc = (await ref.get()).data() || {};
    const text = `Hi ${params[0]} 😊 wei ting from Incredibowl here. Next week's menu (${params[1]}) is ready — ${params[2]}. …`;
    await ref.set({ phone: t.phone, lastMsgMs: now, updatedAtMs: now, lastBroadcastMs: now,
      turns: appendTurn(prevDoc.turns, 'bc', text, now, r.msgId ? { msgId: r.msgId, status: 'sent', statusAtMs: now } : undefined) }, { merge: true });
    process.stdout.write(`  ✅ ${t.phone} ${t.name || ''}\n`);
  } else {
    bad++;
    process.stdout.write(`  ❌ ${t.phone} ${r.error}\n`);
  }
  await new Promise(res => setTimeout(res, 300));
}
console.log(`\n完成：成功 ${ok}，失败 ${bad}。记录在 analytics/wa-broadcast/${nextMonday}.json`);
console.log(`明天看效果：… --report ${nextMonday}\n`);
process.exit(0);
