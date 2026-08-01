// Meta CAPI direct upload — replaces the weekly manual CSV upload (B 档).
// Reads Firestore directly (no more manual dashboard JSON export), sends
// Purchase events via Conversions API with action_source=physical_store,
// and shares tasks/meta-uploaded-events.json with the old CSV pipeline so
// nothing is ever double-sent across the two transports.
//
// Usage:
//   node scripts/meta-capi-upload.mjs --check   # validate token + show state (read-only)
//   node scripts/meta-capi-upload.mjs --dry     # list new events, send nothing
//   node scripts/meta-capi-upload.mjs --test    # send via test_event_code (not recorded)
//   node scripts/meta-capi-upload.mjs           # PRODUCTION send + update state
//   node scripts/meta-capi-upload.mjs --cron    # production send + Telegram summary
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'tasks', 'meta-uploaded-events.json');
// token 放 repo 外（tasks/ 是被 git 跟踪的）也不放 Drive 同步盘
const TELEGRAM_CONFIG = 'C:/Users/User/.incredibowl/telegram-config.json';
const GRAPH = 'https://graph.facebook.com/v21.0';

// ── env (.env.local) ──────────────────────────────────────────────────
const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
const envGet = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim().replace(/^"|"$/g, '') || '';
const PIXEL_ID = envGet('META_PIXEL_ID');
const ACCESS_TOKEN = envGet('META_CAPI_ACCESS_TOKEN');
const TEST_EVENT_CODE = envGet('META_CAPI_TEST_EVENT_CODE');
if (!PIXEL_ID || !ACCESS_TOKEN) { console.error('✗ META_PIXEL_ID / META_CAPI_ACCESS_TOKEN missing in .env.local'); process.exit(1); }

// ── Firestore ─────────────────────────────────────────────────────────
const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

// 与 meta-incremental-upload.mjs / audit-meta-uploads.mjs 保持同一套口径
const TEST_PHONES = new Set(['103370197', '165014501', '165119118']);
const MANUAL_VOUCHER_ROWS = [
  { event_time: '2026-05-26T12:00:00+08:00', phone: '60146435751', value: '200.00', name: 'Damon', order_id: 'VOUCHER_DAMON_MANUAL_20260526' },
];

const norm = (p) => (p || '').replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
const toIntl = (p) => {
  let x = (p || '').replace(/\D/g, '');
  if (x.startsWith('60')) return x;
  if (x.startsWith('0')) return '60' + x.slice(1);
  return '60' + x;
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const tsToMs = (ts) => ts?.toDate?.()?.getTime() ?? (ts ? new Date(ts).getTime() : NaN);

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
}

async function sendTelegram(text) {
  if (!fs.existsSync(TELEGRAM_CONFIG)) { console.log('（无 telegram-config.json，跳过通知）'); return; }
  const { botToken, chatId } = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG, 'utf-8'));
  // Telegram 硬上限 4096 字，超了整条发不出去 → 宁可截断也要送达
  const body = text.length > 4000 ? `${text.slice(0, 4000)}\n…（已截断，明细见 tasks/logs/meta-cron.log）` : text;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body, parse_mode: 'HTML' }),
  });
  if (!res.ok) console.error('✗ Telegram 通知失败:', await res.text());
}

// ── collect new events (identical universe to the CSV pipeline) ───────
async function collectNewEvents(seen) {
  const nowMs = Date.now();
  const rows = [];
  const flagged = []; // 需要老板看一眼的异常

  // phone→email map
  const [uSnap, oSnap, vSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('orders').get(),
    db.collection('mealVoucherPurchases').get(),
  ]);
  const phoneToEmail = new Map();
  for (const d of uSnap.docs) {
    const u = d.data();
    if (u.phone && u.email) phoneToEmail.set(norm(u.phone), u.email.toLowerCase().trim());
  }

  // 1) manual delivered orders
  let voucherCovered = 0; // 餐券全抵/浮点尘埃单（RM≈0），常规跳过不逐条报
  for (const d of oSnap.docs) {
    const o = d.data();
    if (o.isManual !== true || o.status !== 'delivered') continue;
    const orderId = 'ORDER_' + d.id;
    if (seen.has(orderId)) continue;
    const amt = Math.round((Number(o.total) || 0) * 100) / 100;
    if (amt <= 0) { voucherCovered++; continue; }
    if (!o.userPhone) { flagged.push(`手动单有金额但缺电话（会漏传）: #${d.id.slice(-6).toUpperCase()} ${o.userName || '?'} RM ${amt.toFixed(2)}`); continue; }
    const ms = tsToMs(o.createdAt);
    if (!ms || ms > nowMs) continue;
    const phoneN = norm(o.userPhone);
    rows.push({
      order_id: orderId, time_ms: ms, phone: toIntl(o.userPhone),
      email: (o.userEmail || '').trim().toLowerCase() || phoneToEmail.get(phoneN) || '',
      value: amt, name: o.userName || '',
    });
  }
  if (voucherCovered) flagged.push(`餐券全抵/RM0 手动单常规跳过 ${voucherCovered} 单（购券时已上报，不重复计）`);

  // 2) paid voucher purchases（黑名单模式：只排测试号，每笔跳过都记录）
  for (const d of vSnap.docs) {
    const v = d.data();
    if (v.status !== 'paid') continue;
    const phoneN = norm(v.userPhone);
    const amt = Math.round((Number(v.totalAmountPaid ?? v.amountPaid) || 0) * 100) / 100;
    if (TEST_PHONES.has(phoneN)) continue; // 测试号，常规排除
    const orderId = 'VOUCHER_' + d.id;
    if (seen.has(orderId)) continue;
    if (amt <= 0) continue;
    const ms = tsToMs(v.paidAt || v.createdAt);
    if (!ms || ms > nowMs) continue;
    rows.push({
      order_id: orderId, time_ms: ms, phone: toIntl(v.userPhone),
      email: ((v.userEmail || '').trim() && v.userEmail !== 'incredibowl.my@gmail.com')
        ? v.userEmail.trim().toLowerCase() : (phoneToEmail.get(phoneN) || ''),
      value: amt, name: v.userName || '',
    });
  }

  // 3) manual rows outside Firestore
  for (const m of MANUAL_VOUCHER_ROWS) {
    if (seen.has(m.order_id)) continue;
    rows.push({ order_id: m.order_id, time_ms: new Date(m.event_time).getTime(), phone: m.phone, email: phoneToEmail.get(norm(m.phone)) || '', value: Number(m.value), name: m.name });
  }

  const zero = rows.filter((r) => r.value <= 0).length;
  const kept = rows.filter((r) => r.value > 0).sort((a, b) => a.time_ms - b.time_ms);
  if (zero) flagged.push(`RM0 事件已丢弃 ${zero} 笔`);
  return { rows: kept, flagged };
}

function toCapiEvent(r) {
  const user_data = { ph: [sha(r.phone)] };
  if (r.email) user_data.em = [sha(r.email)];
  return {
    event_name: 'Purchase',
    event_time: Math.floor(r.time_ms / 1000),
    event_id: r.order_id,
    action_source: 'physical_store',
    user_data,
    custom_data: { value: r.value.toFixed(2), currency: 'MYR', order_id: r.order_id },
  };
}

async function postEvents(events, testCode) {
  const body = { data: events, access_token: ACCESS_TOKEN };
  if (testCode) body.test_event_code = testCode;
  const res = await fetch(`${GRAPH}/${PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`CAPI error: ${JSON.stringify(json.error || json)}`);
  return json; // { events_received, fbtrace_id }
}

// ── commands ──────────────────────────────────────────────────────────
async function cmdCheck() {
  console.log('=== Token / Pixel 检查 ===');
  // CAPI token 通常只有发事件权限，GET 元数据会 #100 — 用 test_event_code 发一笔
  // 假事件验证发送通道（test 事件只进 Test Events 页签，不入正式数据）。
  if (!TEST_EVENT_CODE) throw new Error('无 META_CAPI_TEST_EVENT_CODE，无法安全验证');
  const probe = {
    event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000),
    event_id: 'CAPI_PROBE_' + Date.now(), action_source: 'physical_store',
    user_data: { ph: [sha('60100000000')] },
    custom_data: { value: '1.00', currency: 'MYR' },
  };
  const json = await postEvents([probe], TEST_EVENT_CODE);
  console.log(`✓ 发送通道正常: events_received=${json.events_received} (test_event_code=${TEST_EVENT_CODE}, 不入正式数据)`);
  const state = loadState();
  console.log(`✓ 状态文件: ${state.uploadedOrderIds.length} 个已上传 ID · 最后运行 ${state.lastRunAt}`);
  const { rows, flagged } = await collectNewEvents(new Set(state.uploadedOrderIds));
  console.log(`✓ 当前待传新事件: ${rows.length} 笔 · RM ${rows.reduce((s, r) => s + r.value, 0).toFixed(2)}`);
  for (const r of rows) console.log(`    ${new Date(r.time_ms).toISOString().slice(0, 10)}  RM ${r.value.toFixed(2).padStart(7)}  ${r.name}  ${r.order_id}`);
  for (const f of flagged) console.log(`  ⚠ ${f}`);
}

async function cmdSend({ dry, test, cron }) {
  const state = loadState();
  if (!state.uploadedOrderIds.length) throw new Error('状态文件为空 — 先跑旧脚本 --seed，防止历史重复上报。');
  const seen = new Set(state.uploadedOrderIds);
  const { rows, flagged } = await collectNewEvents(seen);

  console.log(`=== 待传新事件: ${rows.length} 笔 · RM ${rows.reduce((s, r) => s + r.value, 0).toFixed(2)} ===`);
  for (const r of rows) console.log(`  ${new Date(r.time_ms).toISOString().slice(0, 10)}  RM ${r.value.toFixed(2).padStart(7)}  ${r.name.padEnd(16)} ${r.order_id}`);
  for (const f of flagged) console.log(`  ⚠ ${f}`);

  if (dry) { console.log('\n--dry：未发送。'); return; }
  if (!rows.length) {
    console.log('\n✓ 无新事件。');
    if (cron) await sendTelegram(`📊 <b>Meta 周报</b>\n本周无新 offline 事件，状态未变。`);
    return;
  }

  let received = 0;
  const sentIds = [];
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const json = await postEvents(batch.map(toCapiEvent), test ? TEST_EVENT_CODE : undefined);
    received += json.events_received || 0;
    sentIds.push(...batch.map((r) => r.order_id));
    console.log(`✓ batch ${i / 500 + 1}: events_received=${json.events_received} fbtrace=${json.fbtrace_id}`);
  }

  if (test) { console.log(`\n✓ 测试模式（test_event_code=${TEST_EVENT_CODE}）：Meta 收到 ${received} 笔，不入正式数据，状态未更新。`); return; }

  state.lastRunAt = new Date().toISOString();
  state.uploadedOrderIds = [...new Set([...state.uploadedOrderIds, ...sentIds])];
  state.totalUploads = (state.totalUploads || 0) + 1;
  state.lastBatch = { transport: 'capi', count: sentIds.length, totalRM: Number(rows.reduce((s, r) => s + r.value, 0).toFixed(2)) };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log(`\n✓ 生产发送完成: ${received} 笔已入 Meta · 状态文件更新至 ${state.uploadedOrderIds.length} 个 ID`);

  if (cron) {
    // 只报重点：明细看 tasks/logs/meta-cron.log（逐笔上百行会撞 Telegram 4096 字上限）
    const orderN = rows.filter((r) => r.order_id.startsWith('ORDER_')).length;
    const days = rows.map((r) => new Date(r.time_ms).toISOString().slice(5, 10)).sort();
    const flagText = flagged.length ? `\n\n⚠ 待确认:\n${flagged.map((f) => `• ${f}`).join('\n')}` : '';
    await sendTelegram(
      `📊 <b>Meta 周报（CAPI 直推）</b>\n`
      + `已上传 ${received} 笔 · RM ${rows.reduce((s, r) => s + r.value, 0).toFixed(2)}\n`
      + `手动单 ${orderN} · 餐券 ${rows.length - orderN}\n`
      + `事件日期 ${days[0]} ~ ${days[days.length - 1]}\n`
      + `状态文件累计 ${state.uploadedOrderIds.length} 个 ID${flagText}`,
    );
  }
}

const arg = process.argv[2];
try {
  if (arg === '--check') await cmdCheck();
  else if (arg === '--dry') await cmdSend({ dry: true });
  else if (arg === '--test') await cmdSend({ test: true });
  else if (arg === '--cron') await cmdSend({ cron: true });
  else await cmdSend({});
} catch (e) {
  console.error('✗ FAILED:', e.message);
  try { await sendTelegram(`🔴 Meta CAPI 直推失败: ${e.message.slice(0, 300)}`); } catch {}
  process.exitCode = 1;
}
// 不能 process.exit()：Windows 上会和 gRPC 句柄竞争触发 libuv assertion（exit code 9），
// cron 会误判失败。删掉 admin app 让进程自然退出。
try { await admin.app().delete(); } catch {}
