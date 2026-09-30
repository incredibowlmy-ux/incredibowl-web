// 收件箱真界面测试页（不用 Google 登录）——从 dashboard 里抠出收件箱的 CSS / 标记 / JS，
// 配上最小 stub，指向本地 next start，只认合成号码 6000000002x。
//
//   node scripts/_inbox-harness.mjs seed            种 6 条合成对话（覆盖人工中 / 已成交 / 图片不冒顶等形态）
//   node scripts/_inbox-harness.mjs build <out.html> 生成测试页（内嵌 1 小时有效的管理员 ID token，别提交）
//   node scripts/_inbox-harness.mjs clean           删掉合成对话
//
// 护栏：测试页的 callAdminAPI 只放行合成号码；列表也只显示合成号码 —— 真客户的对话
// 一条都不会被点到、不会被标已读。send 一律本地模拟，不打 Meta。
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const [cmd, outArg] = process.argv.slice(2);
const SA = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
const API_KEY = 'AIzaSyBSTpQdHv0XkijnWcLN8Ys8eNusdaNbgDc';
const BASE = process.env.HARNESS_BASE || 'http://localhost:3461';
const HTML = process.env.DASHBOARD_SRC || 'public/dashboard-h7x2q9.html';
const PHONES = ['60000000021', '60000000022', '60000000023', '60000000024', '60000000025', '60000000026', '60000000027'];

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(SA, 'utf-8'))) });
const db = admin.firestore();
const done = async (code = 0) => { await admin.app().delete(); process.exit(code); };

if (cmd === 'clean') {
    await Promise.all([...PHONES, '60000000027', '60000000028', '60000000029'].map(p => db.collection('waLeads').doc(p).delete()));
    console.log('合成对话已删');
    await done();
}

if (cmd === 'seed') {
    const now = Date.now(), M = 60 * 1000, H = 60 * M;
    const t = (role, text, ago, extra = {}) => ({ role, text, ts: now - ago, ...extra });
    const base = (phone, name, x) => ({ phone, name, lang: 'zh', intent: 'retail', status: 'engaged', nudgeCount: 0, lastNudgeMs: 0, nextNudgeMs: 0, clickToken: 'smk' + phone.slice(-4) + 'abcd', firstSeenMs: now - 3 * 24 * H, lastInboundAtMs: now - 10 * M, ...x });
    const docs = [
        base('60000000021', 'SMOKE 阿明', {   // bot 接待中、有 1 条未读
            lastMsgMs: now - 12 * M, bossReadAtMs: now - 30 * M,
            turns: [t('in', '你好，今天有什么菜', 40 * M), t('out', '今天有香煎鸡扒饭和白萝卜焖花肉哦', 39 * M), t('in', '鸡扒多少钱', 12 * M, { msgId: 'wamid.SMK21' }), t('out', 'RM12.90，要帮你下单吗？', 11 * M, { msgId: 'wamid.SMK21o', status: 'delivered' })],
            profile: { nickname: '阿明', tags: ['常客'], notes: ['放 guard house'] },
        }),
        base('60000000022', 'SMOKE Bella', {  // 人工接管中、客户说了最后一句
            lastMsgMs: now - 50 * M, humanUntil: now + 90 * M, humanBy: 'inbox', bossReadAtMs: now - 20 * M, lang: 'en',
            turns: [t('in', 'Hi can I order for tomorrow?', 50 * M), t('boss', 'Sure, lunch or dinner?', 25 * M, { msgId: 'wamid.SMK22b', status: 'read' }), t('sys', '老板从收件箱回复，接管 120 分钟，bot 静音', 25 * M), t('in', 'Dinner please', 4 * M), t('in', '2 bowls', 3 * M)],
        }),
        base('60000000023', 'SMOKE Chong', {  // 已成交
            status: 'ordered', orderId: 'SMOKEORDERabc123', closedAtMs: now - 2 * H, closedReason: 'order_confirmed', lastMsgMs: now - 3 * H, bossReadAtMs: now,
            turns: [t('in', '我要订两份', 3 * H), t('out', '好的，点这里下单', 3 * H), t('sys', '订单 #ABC123 已确认，自动标记成交，停止追单', 2 * H)],
        }),
        base('60000000024', 'SMOKE Devi', {   // 已关闭、24h 窗口已过
            status: 'closed', closedAtMs: now - 28 * H, lastMsgMs: now - 30 * H, lastInboundAtMs: now - 30 * H, bossReadAtMs: now,
            turns: [t('in', '太贵了不要了', 30 * H), t('out', '好的，想吃的时候随时找碗妈', 30 * H)],
        }),
        base('60000000025', 'SMOKE Ee', {     // 最新一条是图片，但 lastMsgMs 停在两天前（旧排序会把它沉底）
            lastMsgMs: now - 48 * H, lastInboundAtMs: now - 5 * M, bossReadAtMs: now - 47 * H,
            turns: [t('in', '我昨天订的那单', 48 * H), t('out', '收到', 48 * H), t('in', '[图片] 付款截图', 5 * M, { msgId: 'wamid.SMK25', media: { kind: 'image', id: '1234567890', mime: 'image/jpeg' } })],
        }),
        base('60000000027', 'SMOKE Gina', {   // bot 求救过、老板还没回；24h 窗口只剩 2 小时
            lastMsgMs: now - 22 * H, lastInboundAtMs: now - 22 * H, bossReadAtMs: now, alertAtMs: now - 20 * M, alertKind: 'escalate',
            turns: [t('in', '我对花生过敏，哪道菜可以吃？', 22 * H), t('out', '这个我帮你问一下碗妈，稍等哦', 22 * H)],
        }),
        { phone: '60000000026', name: 'SMOKE Faiz', lang: 'zh', status: 'engaged', lastInboundAtMs: now - 8 * H, bossReadAtMs: now,   // 完全没有 lastMsgMs（旧查询直接看不到它）
            turns: [t('in', '[语音]', 8 * H, { msgId: 'wamid.SMK26', media: { kind: 'audio', id: '2234567890', mime: 'audio/ogg' } })] },
    ];
    await Promise.all(docs.map(d => db.collection('waLeads').doc(d.phone).set(d)));
    console.log(`已种 ${docs.length} 条合成对话：${docs.map(d => d.phone).join(', ')}`);
    await done();
}

// 模拟 webhook 收到一条客户消息（只写 turns + lastInboundAtMs，和线上一样不碰 lastMsgMs）
if (cmd === 'inbound') {
    const phone = outArg, text = process.argv[4] || '模拟新消息';
    if (!PHONES.includes(phone)) { console.error('只能给合成号码发'); await done(1); }
    const ref = db.collection('waLeads').doc(phone);
    await db.runTransaction(async tx => {
        const cur = (await tx.get(ref)).data() || {};
        const now = Date.now();
        tx.set(ref, { lastInboundAtMs: now, turns: [...(cur.turns || []), { role: 'in', text, ts: now, msgId: 'wamid.SMK' + now }] }, { merge: true });
    });
    console.log(`inbound → ${phone}: ${text}`);
    await done();
}

if (cmd !== 'build' || !outArg) { console.error('用法见文件头'); await done(1); }

// ── 管理员 ID token（1 小时）──
const adminUser = await admin.auth().getUserByEmail('incredibowl.my@gmail.com');
const custom = await admin.auth().createCustomToken(adminUser.uid);
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
}).then(r => r.json());
if (!signIn.idToken) { console.error('拿不到 ID token', signIn); await done(1); }

// ── 从 dashboard 抠东西 ──
const src = fs.readFileSync(HTML, 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');
const idx = (re, from = 0) => { const i = lines.findIndex((l, n) => n >= from && re.test(l)); if (i < 0) throw new Error('没找到 ' + re); return i; };
/** 按缩进抠一个顶层声明：起始行到第一条「同缩进且以 } 或 ] 开头」的行；单行声明直接返回。 */
const grab = (re) => {
    const i = idx(re); const ind = lines[i].match(/^ */)[0];
    if (/;\s*(\/\/.*)?$/.test(lines[i])) return lines[i];
    let j = i + 1; while (!(lines[j].startsWith(ind) && /^[}\]]/.test(lines[j].slice(ind.length)))) j++;
    return lines.slice(i, j + 1).join('\n');
};
const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const pageStart = idx(/<div class="page" id="page-inbox">/);
const pageEnd = idx(/<div class="page" id="page-/, pageStart + 1);
const markup = lines.slice(pageStart, pageEnd).join('\n').replace('class="page"', 'class="page active"');
const jsStart = idx(/^ {8}const WA_PROFILE_LABEL = /);
const jsEnd = idx(/^ {8}\/\/ Centralized launcher/);
const inboxJs = lines.slice(jsStart, jsEnd).join('\n');
const helpers = [
    /^ {8}const PAID_STATUSES = /, /^ {8}function normalizePhone\(/, /^ {8}const tsToDate = /, /^ {8}const toast = /, /^ {8}function toastDrain\(/,
    /^ {8}function paidOrders\(/, /^ {8}function orderAccrualRevenue\(/, /^ {8}function escapeHtml\(/,
].map(grab).join('\n');

const now = Date.now();
const fixture = {
    users: [{ id: 'smokeUser21', displayName: 'SMOKE 阿明', phone: '0000000021', email: 'smoke21@example.com', deliveryProfile: { addressText: 'Pearl Suria, Tower A 12-3' } }],
    orders: [
        { id: 'SMOKEORD00000A1', userId: 'smokeUser21', userPhone: '0000000021', userName: 'SMOKE 阿明', status: 'delivered', total: 25.8, deliveryFee: 3, deliveryDate: '2026-09-28', deliveryTime: 'Lunch (11AM-1PM)', createdAt: { seconds: Math.floor(now / 1000) - 3 * 86400 }, items: [{ name: '香煎金黄鸡扒饭', quantity: 2 }] },
        { id: 'SMOKEORD00000B2', userId: 'smokeUser21', userPhone: '0000000021', userName: 'SMOKE 阿明', status: 'pending', total: 12.9, deliveryFee: 3, deliveryDate: '2026-10-02', deliveryTime: 'Dinner (5PM-8PM)', createdAt: { seconds: Math.floor(now / 1000) - 3600 }, items: [{ name: '家乡白萝卜焖花肉', quantity: 1 }] },
    ],
    mealVouchers: [
        { id: 'v1', userId: 'smokeUser21', status: 'available', expiresAt: { seconds: Math.floor(now / 1000) + 5 * 86400 } },
        { id: 'v2', userId: 'smokeUser21', status: 'available', expiresAt: { seconds: Math.floor(now / 1000) + 20 * 86400 } },
        { id: 'v3', userId: 'smokeUser21', status: 'redeemed', expiresAt: { seconds: Math.floor(now / 1000) + 20 * 86400 } },
    ],
};

const page = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Incredibowl · 数据看板</title><style>${css}
body{margin:0;padding:12px;background:var(--bg)} .hn{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:12px}</style></head><body>
<div class="hn"><button class="nav-item active" data-page="inbox"><span>碗妈收件箱</span><span class="inbox-nav-badge" id="inboxNavBadge" hidden>0</span></button>
<button id="hOther" class="btn ghost sm">去别的页</button><button id="hInbox" class="btn ghost sm">回收件箱</button></div>
${markup}
<div id="waLeadModal" class="modal-backdrop hidden"><div id="waLeadBody"></div></div>
<div id="customerLookupModal" class="modal-backdrop hidden"><div id="customerProfileContainer"></div></div>
<div id="toast" class="toast"></div>
<script type="module">
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const state = Object.assign({ currentPage: 'inbox' }, ${JSON.stringify(fixture)});
const auth = { currentUser: { getIdToken: async () => ${JSON.stringify(signIn.idToken)} } };
const ADMIN_API_BASE = ${JSON.stringify(BASE)};
const SYN = /^600000000\\d\\d$/;
window.__calls = []; window.__sendDelay = 1200; window.__sendFail = false; window.__offline = false; window.__errors = [];
window.addEventListener('error', e => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => window.__errors.push('rejection: ' + String(e.reason?.message || e.reason)));
async function callAdminAPI(path, body) {
    window.__calls.push({ path, op: body.op, phone: body.phone || '', at: Date.now(), hidden: document.hidden });
    const ph = String(body.phone || '').replace(/\\D/g, '');
    if (ph && !SYN.test(ph)) throw new Error('harness：只允许合成号码');
    if (window.__offline) throw new Error('模拟断网');
    if (body.op === 'send') {
        window.__lastSend = body;
        await new Promise(r => setTimeout(r, window.__sendDelay));
        return window.__sendFail ? { ok: false, error: '模拟发送失败' } : { ok: true };
    }
    const res = await fetch(ADMIN_API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await auth.currentUser.getIdToken() }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'HTTP ' + res.status);
    if (Array.isArray(data.rows)) data.rows = data.rows.filter(r => SYN.test(r.phone));
    if ('sendConfigured' in data) data.sendConfigured = true;
    return data;
}
// Firestore 客户端只在内存里模拟 —— 测试页绝不碰线上的 dashboardConfig
const db = {}; window.__fs = {};
const doc = (_db, ...p) => p.join('/');
const getDoc = async (k) => ({ exists: () => k in window.__fs, data: () => window.__fs[k] });
const setDoc = async (k, v) => { window.__fs[k] = { ...(window.__fs[k] || {}), ...v }; };
const Timestamp = { now: () => ({ seconds: Math.floor(Date.now() / 1000) }) };
function switchPage(p) { state.currentPage = p; document.querySelector('#page-inbox').classList.toggle('active', p === 'inbox'); if (p === 'inbox') inboxStart(); else inboxStop(); }
function reloadData() { window.__reloads = (window.__reloads || 0) + 1; return Promise.resolve(); }
function openCustomerProfileByKey(k) { window.__profileKey = k; }
function svmVoucherBalance(phone) {
    const pn = normalizePhone(phone); const u = state.users.find(x => normalizePhone(x.phone) === pn); if (!u) return 0;
    return state.mealVouchers.filter(v => v.userId === u.id && v.status === 'available' && (tsToDate(v.expiresAt)?.getTime() || 0) > Date.now()).length;
}
${helpers}
${inboxJs}
$('#hOther').onclick = () => switchPage('revenue');
$('#hInbox').onclick = () => switchPage('inbox');
window.__inbox = inbox; window.__fn = { inboxPulse, inboxRefreshList, inboxRefreshThread, openInboxThread, inboxWatching, inboxCloseThread };
switchPage('inbox');
</script></body></html>`;
fs.mkdirSync(path.dirname(outArg), { recursive: true });
fs.writeFileSync(outArg, page);
console.log(`测试页 → ${outArg}（${(page.length / 1024).toFixed(0)} KB，API ${BASE}）`);
await done();
