/**
 * build-n8n-v4.mjs —— 生成 Bowlmama v4 的 n8n workflow JSON（以 v3 产物为基底）。
 *
 * v4 相对 v3 的改动（对应 tasks/todo-chatbot-v4.md）：
 *   A1 持久记忆    删 Window Buffer Memory；对话记录存 waLeads.turns（relay 写入站、n8n 写出站），
 *                 经 /api/n8n/customer 的 recentTurnsBlock 进提示词
 *   A2 人工接管    relay 带 human 标记 → 客户文字不进 AI，原文转老板；老板引用回复 = 自动接管 120 分钟；
 *                 回复含 [bot] 立即释放；老板直发 #pause/#resume/#status <号码>
 *   A3/A4/A5/A7   拆包 / 去重 / 验签 / 限流全部在 Vercel relay（src/app/api/wa/webhook）；
 *                 n8n Webhook 节点改开 Header Auth；Router 删 staticData 去重
 *   A6 静默类型    reaction/sticker/contacts → 不回；interactive 按钮回复 → 当文字
 *   A8 警报映射    「报警消息ID → 客户号码」改存 Firestore waAlerts（Boss Lookup 改 HTTP）
 *   B1 客户备注    remember_customer_fact 工具（白名单 key）
 *   B3 付款方式    从 /api/n8n/menu 的 payment_text 进提示词
 *   C2 交互按钮    开场后 3 个按钮；第 1 次追单后 2 个按钮（含「先不用了」= 关闭 lead）
 *
 * 跑法：node scripts/build-n8n-v4.mjs && node scripts/validate-n8n-workflows.mjs && node scripts/verify-n8n-v3.mjs v4
 *
 * 产出：
 *   n8n-workflows/bowlmama-v4-main.json      主流程（webhook）
 *   n8n-workflows/bowlmama-v4-followup.json  追单 cron（每 15 分钟）
 *   n8n-workflows/bowlmama-v4-error.json     报错 → Telegram
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const v3 = JSON.parse(readFileSync(join(DIR, 'bowlmama-v3-main.json'), 'utf8'));
const v3f = JSON.parse(readFileSync(join(DIR, 'bowlmama-v3-followup.json'), 'utf8'));
const v3e = JSON.parse(readFileSync(join(DIR, 'bowlmama-v3-error.json'), 'utf8'));

const SITE = 'https://www.incredibowl.my';
const CRED_WA = { whatsAppApi: { id: 'r40sSPxInxCOtHWS', name: 'WhatsApp account' } };
const CRED_BEARER = { httpBearerAuth: { id: 'ew3zAX6xWGWOdrGO', name: 'Incredibowl N8N API Key' } };
// 09-06 已在线上建好的 Header Auth 凭据（值 = `Bearer <N8N_INBOUND_SECRET>`）。Webhook 节点和两个 AI 工具节点共用。
const CRED_INBOUND = { httpHeaderAuth: { id: 'XAgrsT1ATqotRlfm', name: 'WA relay inbound (v4)' } };
const BOSS_PHONE = '60165014501';
const WA_PHONE_ID = '1019276584602589';
const GRAPH = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`;

const byName = Object.fromEntries(v3.nodes.map(n => [n.name, n]));
const lift = (name, patch = {}) => {
  const src = byName[name];
  if (!src) throw new Error(`v3 里没有节点：${name}`);
  return { ...JSON.parse(JSON.stringify(src)), ...patch };
};
const httpNode = (name, id, url, pos, extra = {}) => ({
  parameters: { url, authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: {}, ...extra },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, id, name,
  onError: 'continueRegularOutput', credentials: CRED_BEARER,
});
/** POST /api/n8n/lead 的小工具：jsonBodyExpr 是 n8n 表达式（不含外层 ={{ }}）。 */
const leadPost = (name, id, jsonBodyExpr, pos) => ({
  parameters: {
    method: 'POST', url: `${SITE}/api/n8n/lead`,
    authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
    sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${jsonBodyExpr}) }}`, options: {},
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, id, name,
  onError: 'continueRegularOutput', credentials: CRED_BEARER,
});
const codeNode = (name, id, jsCode, pos) => ({
  parameters: { jsCode }, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, id, name,
});
const waText = (name, id, to, text, pos) => ({
  parameters: { operation: 'send', phoneNumberId: WA_PHONE_ID, recipientPhoneNumber: to, textBody: text, additionalFields: {} },
  type: 'n8n-nodes-base.whatsApp', typeVersion: 1.1, position: pos, id, name,
  webhookId: `b2f1e7a0-v4${id.slice(-4)}-4a00-9c00-bowlmamav400`, credentials: CRED_WA,
});
/**
 * WhatsApp 交互按钮（reply buttons ≤ 3 个，title ≤ 20 字符）。n8n 的 WhatsApp 节点不支持
 * interactive，走 HTTP Request + 预定义 WhatsApp 凭据直打 Graph API。
 * buttons = [{ id, title }]；bodyExpr / toExpr 是 n8n 表达式片段。
 */
const waButtons = (name, id, toExpr, bodyExpr, buttons, pos) => ({
  parameters: {
    method: 'POST', url: GRAPH,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'whatsAppApi',
    sendBody: true, specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ messaging_product: 'whatsapp', to: ${toExpr}, type: 'interactive', interactive: { type: 'button', body: { text: ${bodyExpr} }, action: { buttons: ${JSON.stringify(buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })))} } } }) }}`,
    options: {},
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, id, name,
  onError: 'continueRegularOutput', credentials: CRED_WA,
});
const ifNode = (name, id, left, right, pos, operator = { type: 'boolean', operation: 'true', singleValue: true }) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: `${id}-c1`, leftValue: left, rightValue: right, operator }],
      combinator: 'and',
    },
    looseTypeValidation: true, options: {},
  },
  type: 'n8n-nodes-base.if', typeVersion: 2.2, position: pos, id, name,
});
const noOp = (name, id, pos) => ({ parameters: {}, type: 'n8n-nodes-base.noOp', typeVersion: 1, position: pos, id, name });

// ════════════════════════════════════════════════════════════
// Router v4
// ════════════════════════════════════════════════════════════
const ROUTER_CODE = `// ============================
// 路由器 v4 = v3 的字段提取/路由/语言/团餐意图，去掉 staticData 去重（relay 已做），
// 新增四件事：
//   · relay 标记：human（老板接管中）/ throttled（本小时超限）
//   · interactive 按钮回复 → 当文字处理（title 进 text，id 进 buttonId）
//   · 老板直发指令：#pause <号码> [分钟] / #resume <号码> / #status <号码>
//   · 静默类型（reaction / sticker / contacts）→ ignore
// 收到的永远是 relay 转发的**单条**消息（拆包在 relay），所以只读 messages[0] 是对的。
// ============================

const entry = $input.first().json.body.entry[0].changes[0].value;
const msg = entry.messages[0];
const flags = entry.incredibowl || {};
const BOSS_PHONE = '${BOSS_PHONE}';

const phone = String(msg.from || '').replace(/\\D/g, '');
const type = msg.type;
let text = msg.text?.body ?? '';
let buttonId = '';
if (type === 'interactive') {
  const br = msg.interactive?.button_reply;
  const lr = msg.interactive?.list_reply;
  buttonId = String(br?.id || lr?.id || '');
  text = String(br?.title || lr?.title || '').trim();
}
const imageId = msg.image?.id ?? '';
const caption = msg.image?.caption ?? '';
const contextId = msg.context?.id ?? '';
const isBoss = phone === BOSS_PHONE;
const hasContext = !!msg.context;
const lat = msg.location?.latitude ?? null;
const lng = msg.location?.longitude ?? null;
const locName = msg.location?.name ?? '';
const locAddress = msg.location?.address ?? '';
const profileName = entry.contacts?.[0]?.profile?.name ?? '';

// ── 老板指令（不引用、以 # 开头）──────────────────────
let bossCmd = null;
if (isBoss && !hasContext && type === 'text') {
  // 与 src/lib/waWebhook.ts parseBossCommand 同一套规则（token 切分：最后一个 1–3 位数字 = 分钟）
  const m = /^#\\s*(pause|resume|status|暂停|恢复|状态)\\s+(.+)$/i.exec(text.trim());
  if (m) {
    const w = m[1].toLowerCase();
    const cmd = (w === 'pause' || w === '暂停') ? 'pause' : (w === 'resume' || w === '恢复') ? 'resume' : 'status';
    const tokens = m[2].trim().split(/\\s+/);
    let minutes = 0;
    if (cmd === 'pause' && tokens.length >= 2 && /^\\d{1,3}$/.test(tokens[tokens.length - 1])) minutes = Number(tokens.pop());
    const target = tokens.join('').replace(/\\D/g, '');
    if (/^60\\d{8,10}$/.test(target)) {
      bossCmd = { cmd, phone: target, minutes: cmd === 'pause' ? Math.min(720, Math.max(5, minutes || 120)) : 0 };
    }
  }
}

const SILENT = ['reaction', 'sticker', 'contacts', 'unsupported', 'system', 'unknown'];
const isTextLike = (type === 'text' && text) || (type === 'interactive' && text);

let route = 'fallback';
if (isBoss && hasContext && type === 'text' && text) route = 'boss_reply';
else if (isBoss && bossCmd) route = 'boss_cmd';
else if (isBoss) route = 'boss_direct';
else if (SILENT.includes(type)) route = 'ignore';
else if (buttonId === 'lead_close') route = 'lead_close';
else if (flags.throttled) route = 'throttled';
else if (flags.human && isTextLike) route = 'human_forward';
else if (type === 'image') route = 'image';
else if (type === 'location') route = 'location';
else if (type === 'audio') route = 'audio';
else if (isTextLike) route = 'customer_text';

// ── 语言：有中日韩字符就是中文，否则英文 ──────────────
const lang = /[\\u4e00-\\u9fff\\u3040-\\u30ff]/.test(text) ? 'zh' : 'en';

// ── 团餐意图 ───────────────────────────────────────────
const t = text.toLowerCase();
const CATERING_WORDS = [
  '团餐','團餐','到会','到會','包餐','公司','办公室','辦公室','开会','開會',
  '活动','活動','聚会','聚會','宴','同事','部门','部門',
  'catering','cater','office','company','corporate','meeting','event','buffet','pax',
];
const bigQty = /(\\d{2,})\\s*(份|人|位|pax|packs?|sets?)/.test(t) && Number((t.match(/(\\d{2,})\\s*(?:份|人|位|pax|packs?|sets?)/) || [])[1] || 0) >= 10;
const intent = (CATERING_WORDS.some(w => t.includes(w)) || bigQty) ? 'catering' : 'retail';

return [{
  json: {
    phone, type, text, buttonId, imageId, caption, contextId,
    isBoss, hasContext, route, lang, intent, profileName,
    msgId: msg.id || '',
    lat, lng, locName, locAddress,
    human: !!flags.human, humanUntil: Number(flags.humanUntil) || 0,
    humanEndedRecently: !!flags.humanEndedRecently, throttled: !!flags.throttled,
    bossCmd,
  },
}];`;

// ════════════════════════════════════════════════════════════
// Parse Boss Intent v4（Boss Lookup 改为 Firestore waAlerts 反查）
// ════════════════════════════════════════════════════════════
const PARSE_BOSS_CODE = `// ============================
// 解析老板引用回复的意图（v4：上下文来自 /api/n8n/lead?alert=<消息id>，不再查 Google Sheet）
// 「1 / 确认 / 已收款 / ok」→ 收款确认 → 自动建单（wa-order confirm）
// [QR] 标记 → 转达 + 发收款码；[bot] 标记 → 转达后释放人工接管；其余 → Gemini 润色后转达
// ============================

const rawBossText = $('Router').first().json.text || '';
const lookup = $('Boss Lookup').first().json || {};
const customerPhone = String(lookup.phone || '').replace(/[^0-9]/g, '');
const customerMsg = String(lookup.customerMsg || '');

const isConfirm = /^(1|确认|已收款|收到钱|ok|okay)$/i.test(rawBossText.trim());
const needSendQR = /\\[QR\\]|\\[发QR\\]|\\[SEND_QR\\]/i.test(rawBossText);
const releaseBot = /\\[bot\\]|\\[机器\\]|\\[恢复\\]/i.test(rawBossText);

let cleanBossText = rawBossText
  .replace(/\\[QR\\]/gi, '').replace(/\\[发QR\\]/gi, '').replace(/\\[SEND_QR\\]/gi, '')
  .replace(/\\[bot\\]/gi, '').replace(/\\[机器\\]/g, '').replace(/\\[恢复\\]/g, '')
  .trim();
if (!cleanBossText) cleanBossText = needSendQR ? '请客户用以下二维码扫码付款' : '好的，碗妈这边继续帮你跟进';

return [{ json: { customerPhone, customerMsg, bossText: cleanBossText, needSendQR, isConfirm, releaseBot } }];`;

// ════════════════════════════════════════════════════════════
// Boss 指令执行 / 回话
// ════════════════════════════════════════════════════════════
const BOSS_CMD_BUILD = `// 老板指令 → 打给 /api/n8n/lead 的 body
const c = $('Router').first().json.bossCmd || {};
const body = c.cmd === 'pause' ? { action: 'human', phone: c.phone, minutes: c.minutes, by: 'boss_cmd' }
  : c.cmd === 'resume' ? { action: 'release', phone: c.phone }
  : { action: 'status', phone: c.phone };
return [{ json: { body, cmd: c.cmd, phone: c.phone, minutes: c.minutes || 0 } }];`;

const BOSS_CMD_REPLY = `// 执行结果 → 给老板的一句确认
const b = $('Boss Cmd Build').first().json;
const r = $('Boss Cmd Exec').first()?.json || {};
const fmt = ms => ms ? new Date(ms + 8 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ') : '—';
let text;
if (r.error && !r.ok && b.cmd !== 'status') text = '⚠️ 指令没成功：' + (r.error || '接口无响应');
else if (b.cmd === 'pause') text = '🤫 已静音 ' + b.phone + ' ' + b.minutes + ' 分钟（到 ' + fmt(r.humanUntil) + '）。这段时间该客户的消息会原文转给你，bot 不回。回 #resume ' + b.phone + ' 提前恢复。';
else if (b.cmd === 'resume') text = r.wasHuman ? ('🤖 已恢复 ' + b.phone + '，bot 继续接待。') : ('ℹ️ ' + b.phone + ' 本来就没在人工接管中。');
else {
  const l = r.lead || {};
  const turns = Array.isArray(r.turns) ? r.turns.slice(-5) : [];
  const who = t => t.role === 'in' ? '客' : t.role === 'boss' ? '你' : t.role === 'nudge' ? '追' : t.role === 'sys' ? '系' : '碗';
  text = r.found === false
    ? ('ℹ️ ' + b.phone + ' 没有任何记录。')
    : ['📋 ' + b.phone + (l.name ? '（' + l.name + '）' : ''),
       '状态：' + (l.status || '—') + ' · 语言 ' + (l.lang || '—') + ' · 追单 ' + (l.nudgeCount || 0) + ' 次' + (l.nextNudgeMs ? '，下次 ' + fmt(l.nextNudgeMs) : ''),
       '人工接管：' + (l.human ? ('是，到 ' + fmt(l.humanUntil)) : '否'),
       ...(turns.length ? ['最近对话：', ...turns.map(t => '  ' + who(t) + '：' + String(t.text).slice(0, 60))] : []),
      ].join('\\n');
}
return [{ json: { text } }];`;

// ════════════════════════════════════════════════════════════
// Context Builder v4（在 v3 基础上多注入三块）
// ════════════════════════════════════════════════════════════
const CONTEXT_CODE = byName['Context Builder'].parameters.jsCode
  .replace('// Context Builder v3：', '// Context Builder v4（v3 + 最近对话 / 付款方式 / 人工接管刚结束提示）：')
  .replace(
    "const coverageText = (apiOk && menuApi.coverage_text) || 'Old Klang Road 一带';",
    `const coverageText = (apiOk && menuApi.coverage_text) || 'Old Klang Road 一带';

// v4：对话记忆来自服务端（waLeads.turns），不再靠 n8n 进程内存
const recentTurns = typeof cust.recentTurnsBlock === 'string' && cust.recentTurnsBlock
  ? cust.recentTurnsBlock
  : '【最近对话】（记录暂时读不到 —— 按客户这条消息本身回答，别假装记得之前聊过什么）';
// v4：付款方式单一来源 /api/n8n/menu
const paymentText = apiOk
  ? (zh ? (menuApi.payment_text || '') : (menuApi.payment_text_en || menuApi.payment_text || ''))
  : '';
const paymentBlock = paymentText || '（付款方式清单暂时取不到，客户问付款方式一律 [求救老板]）';
// v4：老板刚亲自聊过（6 小时内）→ 别重新自我介绍
const touch = $('Lead Touch').first()?.json || {};
const humanNote = touch.humanEndedRecently
  ? '⚠️ 注意：不久前是老板亲自在跟这位客户聊（见【最近对话】里「碗妈（老板亲自回）」的行）。接着聊，别重新自我介绍、别重复老板已经答过的内容。'
  : '';`,
  )
  .replace(
    '    order_url: orderUrl,\n    dish_links: dishLinks,',
    '    order_url: orderUrl,\n    dish_links: dishLinks,\n    recent_turns: recentTurns,\n    payment_block: paymentBlock,\n    human_note: humanNote,',
  );
if (!CONTEXT_CODE.includes('recent_turns: recentTurns')) throw new Error('Context Builder 注入失败：找不到锚点');

// ════════════════════════════════════════════════════════════
// AI system prompt v4（v3 + 四段）
// ════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = byName['AI Agent'].parameters.options.systemMessage
  .replace(
    '【客户档案】（系统按来电号码自动查询，只能用于回答该客户本人）\n{{ $json.customer_context }}',
    `{{ $json.recent_turns }}
{{ $json.human_note }}
上面的对话记录是服务端存的，跨天也在。客户说「刚才 / 上次 / 我之前问的」就去里面找，别反问他。

【客户档案】（系统按来电号码自动查询，只能用于回答该客户本人）
{{ $json.customer_context }}

【记住客户告诉你的事 —— remember_customer_fact 工具】
客户说出以下任一信息时，调用一次 remember_customer_fact 记下来（同一件事别重复记）：
· nickname 他希望被怎么称呼   · dropoff 交接方式（放 guard house / 上楼 / 前台 / 打电话）
· allergy 忌口或过敏（只记录；过敏问题本身仍要 [求救老板]）   · preferredMeal 固定吃午餐还是晚餐
· tag 简短标签（例：办公室客、住 Pearl Suria、爱吃辣）   · note 其他与订餐有关的一句话备注
只记与订餐有关的事，不记闲聊、不记别人的信息。`,
  )
  .replace(
    '【配送时段与方式】',
    `【付款方式】
{{ $json.payment_block }}

【配送时段与方式】`,
  )
  .replace(
    '【求救机制 —— 全流程只有一个标记：[求救老板]】\n以下情况在回复开头加 [求救老板]，并告诉客户「这个碗妈得跟老板确认一下，稍等哦 ❤️」：',
    `【求救机制 —— 全流程只有一个标记：[求救老板]】
以下情况在回复开头加 [求救老板]，并告诉客户「这个碗妈得跟老板确认一下，稍等哦 ❤️」：
客户点了「找碗妈」按钮或明确说要找人工 / 真人 / 老板、`,
  );
if (!SYSTEM_PROMPT.includes('remember_customer_fact') || !SYSTEM_PROMPT.includes('payment_block')) {
  throw new Error('SYSTEM_PROMPT 注入失败：找不到锚点');
}

// ════════════════════════════════════════════════════════════
// 组装 v4-main
// ════════════════════════════════════════════════════════════
const DROP = new Set(['Window Buffer Memory', 'Boss Lookup', 'Boss Direct Ignore', 'Router', 'Context Builder']);
const nodes = v3.nodes.filter(n => !DROP.has(n.name)).map(n => JSON.parse(JSON.stringify(n)));
const put = (name, patch) => {
  const i = nodes.findIndex(n => n.name === name);
  if (i < 0) throw new Error(`节点不存在：${name}`);
  nodes[i] = { ...nodes[i], ...patch };
};
const paramPatch = (name, fn) => {
  const i = nodes.findIndex(n => n.name === name);
  if (i < 0) throw new Error(`节点不存在：${name}`);
  nodes[i].parameters = fn(nodes[i].parameters);
};

// ── Webhook：开 Header Auth（relay 带 Authorization: Bearer <N8N_INBOUND_SECRET>）──
put('Webhook', {
  parameters: { httpMethod: 'POST', path: 'whatsapp-receive', authentication: 'headerAuth', options: {} },
  credentials: CRED_INBOUND,
});

// ── Router / Context / Prompt ──
nodes.unshift(codeNode('Router', 'v4-router', ROUTER_CODE, [-4400, -400]));
nodes.push(codeNode('Context Builder', 'v4-context', CONTEXT_CODE, [-1720, -1000]));
put('AI Agent', { parameters: { ...byName['AI Agent'].parameters, options: { systemMessage: SYSTEM_PROMPT } } });

// ── Main Switch：11 条规则 + 兜底 ──
const ROUTES = ['customer_text', 'boss_reply', 'image', 'location', 'audio', 'boss_direct',
  'human_forward', 'throttled', 'boss_cmd', 'lead_close', 'ignore'];
const ROUTE_LABEL = {
  customer_text: '客户文字', boss_reply: '老板回复', image: '图片', location: '位置pin', audio: '语音',
  boss_direct: '老板直发', human_forward: '人工中转发', throttled: '限流', boss_cmd: '老板指令',
  lead_close: '客户说不用了', ignore: '静默忽略',
};
put('Main Switch', {
  parameters: {
    rules: {
      values: ROUTES.map((r, i) => ({
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
          conditions: [{ id: `sw-${i + 1}`, leftValue: '={{ $json.route }}', rightValue: r, operator: { type: 'string', operation: 'equals' } }],
          combinator: 'and',
        },
        renameOutput: true, outputKey: ROUTE_LABEL[r],
      })),
    },
    options: { fallbackOutput: 'extra' },
  },
});

// ── Boss Lookup → Firestore waAlerts（HTTP）──
nodes.push(httpNode('Boss Lookup', 'v4-boss-lookup',
  `=${SITE}/api/n8n/lead?alert={{ encodeURIComponent($('Router').first().json.contextId) }}`, [-3700, -540]));
put('Has Boss Match', {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'boss-match-1', leftValue: '={{ $json.found === true && !!$json.phone }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    looseTypeValidation: true, options: {},
  },
});
put('Parse Boss Intent', { parameters: { jsCode: PARSE_BOSS_CODE } });
paramPatch('Send Solution', p => ({ ...p, recipientPhoneNumber: "={{ $('Parse Boss Intent').first().json.customerPhone }}" }));
paramPatch('Boss Not Found Reply', p => ({
  ...p,
  textBody: "=⚠️ 老板！找不到这条对话的上下文（引用的不是碗妈发的警报，或记录已过期），无法转达给客户。\n\n您引用的消息 ID：{{ $('Router').first().json.contextId }}\n您的回复内容：{{ $('Router').first().json.text }}\n\n想直接跟某个客户说话：先 #pause <客户号码>，再去他的对话框直接聊。",
}));

// ── 警报映射写入（取代 Sheet「报警消息ID」列）──
nodes.push(leadPost('Lead Alert · 求救', 'v4-alert-esc',
  `{ action: 'alert', phone: $('Post-process').first().json.phone, alertMsgId: $('Boss Alert').first().json.messages?.[0]?.id || 'unknown', customerMsg: $('Post-process').first().json.customerMsg, kind: 'escalate' }`,
  [-480, -1040]));
nodes.push(leadPost('Lead Alert · 图片', 'v4-alert-img',
  `{ action: 'alert', phone: $('Router').first().json.phone, alertMsgId: $('Image Forward').first().json.messages?.[0]?.id || 'unknown', customerMsg: $('Router').first().json.caption || '（图片，无留言）', kind: 'image' }`,
  [-3260, -140]));
nodes.push(leadPost('Lead Alert · 定位', 'v4-alert-pin',
  `{ action: 'alert', phone: $('Router').first().json.phone, alertMsgId: $('Pin Boss Alert').first().json.messages?.[0]?.id || 'unknown', customerMsg: '[定位] ' + ($('Router').first().json.locName || $('Router').first().json.locAddress || ''), kind: 'pin' }`,
  [-2820, 360]));

// ── 出站对话记录（A1）──
nodes.push(leadPost('Log Reply · AI', 'v4-log-ai',
  `{ action: 'reply', role: 'out', phone: $('Post-process').first().json.phone, text: $('Post-process').first().json.reply }`,
  [-260, -1160]));
nodes.push(leadPost('Log Reply · 开场', 'v4-log-greet',
  `{ action: 'reply', role: 'out', phone: $('Greeting Builder').first().json.phone, text: $('Greeting Builder').first().json.reply }`,
  [-2460, -1160]));
nodes.push(leadPost('Log Reply · 老板', 'v4-log-boss',
  `{ action: 'reply', role: 'boss', phone: $('Parse Boss Intent').first().json.customerPhone, text: $('Extract Final Reply').first().json.text }`,
  [-2160, -540]));
nodes.push(leadPost('Log Reply · 定位', 'v4-log-pin',
  `{ action: 'reply', role: 'out', phone: $('Pin Reply Builder').first().json.phone, text: $('Pin Reply Builder').first().json.reply }`,
  [-3040, 40]));

// ── 人工接管（A2）──
nodes.push(ifNode('Boss 要释放?', 'v4-if-release', "={{ $('Parse Boss Intent').first().json.releaseBot }}", '', [-1940, -540]));
nodes.push(leadPost('Lead Human', 'v4-lead-human',
  `{ action: 'human', phone: $('Parse Boss Intent').first().json.customerPhone, minutes: 120, by: 'boss_reply' }`,
  [-1720, -460]));
nodes.push(leadPost('Lead Release', 'v4-lead-release',
  `{ action: 'release', phone: $('Parse Boss Intent').first().json.customerPhone }`,
  [-1720, -620]));
nodes.push(waText('Human Forward', 'v4-human-fwd', BOSS_PHONE,
  "=🙋 [人工中] 客户 {{ $('Router').first().json.phone }}{{ $('Router').first().json.profileName ? '（' + $('Router').first().json.profileName + '）' : '' }} 说：\n{{ $('Router').first().json.text }}\n\n（bot 静音中，到 {{ $('Router').first().json.humanUntil ? new Date($('Router').first().json.humanUntil + 8*3600*1000).toISOString().slice(11,16) : '—' }}。引用本条回复即可转达并续 2 小时；回复里带 [bot] 转达后立刻恢复 bot；或直接 #resume {{ $('Router').first().json.phone }}）",
  [-3700, 1000]));
nodes.push(leadPost('Lead Alert · 人工', 'v4-alert-human',
  `{ action: 'alert', phone: $('Router').first().json.phone, alertMsgId: $('Human Forward').first().json.messages?.[0]?.id || 'unknown', customerMsg: $('Router').first().json.text, kind: 'human' }`,
  [-3480, 1000]));

// ── 限流回复（A7）──
nodes.push(waText('Throttle Reply', 'v4-throttle', "={{ $('Router').first().json.phone }}",
  "={{ $('Router').first().json.lang === 'en' ? 'BowlMama needs a little breather 😅 I\\'ll get back to you shortly — or tap the order link above anytime ❤️' : '碗妈这边消息有点多，稍后回你哦 😅 想下单的话随时点上面的链接 ❤️' }}",
  [-3700, 1240]));

// ── 老板指令（A2）──
nodes.push(codeNode('Boss Cmd Build', 'v4-cmd-build', BOSS_CMD_BUILD, [-3700, 1480]));
nodes.push(leadPost('Boss Cmd Exec', 'v4-cmd-exec', `$('Boss Cmd Build').first().json.body`, [-3480, 1480]));
nodes.push(codeNode('Boss Cmd Reply', 'v4-cmd-reply', BOSS_CMD_REPLY, [-3260, 1480]));
nodes.push(waText('Boss Cmd Send', 'v4-cmd-send', BOSS_PHONE, '={{ $json.text }}', [-3040, 1480]));

// ── 客户按「先不用了」→ 关闭 lead（C2）──
nodes.push(leadPost('Lead Close', 'v4-lead-close',
  `{ action: 'close', phone: $('Router').first().json.phone, reason: 'customer_declined' }`,
  [-3700, 1720]));
nodes.push(waText('Close Reply', 'v4-close-reply', "={{ $('Router').first().json.phone }}",
  "={{ $('Router').first().json.lang === 'en' ? 'No worries! BowlMama is here whenever you feel like a home-cooked bowl ❤️' : '好的～想吃家常味的时候随时找碗妈 ❤️' }}",
  [-3480, 1720]));

// ── 静默 / 老板直发（非指令）──
nodes.push(noOp('Ignore', 'v4-ignore', [-3700, 1960]));
nodes.push(noOp('Boss Direct Ignore', 'v4-boss-direct', [-3700, 700]));

// ── 开场按钮（C2）：团餐 / 菜单挂了 不发 ──
nodes.push(ifNode('开场要按钮?', 'v4-if-greet-btn',
  "={{ $('Greeting Builder').first().json.kind !== 'catering' && $('Greeting Builder').first().json.kind !== 'menu_down' }}", '', [-2220, -1160]));
nodes.push(waButtons('Send Greeting Buttons', 'v4-greet-btn',
  "$('Greeting Builder').first().json.phone",
  "($('Greeting Builder').first().json.lang === 'en' ? 'How would you like to continue?' : '想怎么继续？')",
  [{ id: 'btn_order', title: '直接下单 🛒' }, { id: 'btn_fee', title: '问运费 🚗' }, { id: 'btn_human', title: '找碗妈 🙋' }],
  [-1980, -1160]));
// 英文客户的按钮标题：n8n 表达式里按语言切换（reply buttons 的 title 必须 ≤ 20 字符）
nodes[nodes.length - 1].parameters.jsonBody = `={{ JSON.stringify({ messaging_product: 'whatsapp', to: $('Greeting Builder').first().json.phone, type: 'interactive', interactive: { type: 'button', body: { text: $('Greeting Builder').first().json.lang === 'en' ? 'How would you like to continue?' : '想怎么继续？' }, action: { buttons: ($('Greeting Builder').first().json.lang === 'en' ? [['btn_order','Order now 🛒'],['btn_fee','Delivery fee 🚗'],['btn_human','Talk to BowlMama']] : [['btn_order','直接下单 🛒'],['btn_fee','问运费 🚗'],['btn_human','找碗妈 🙋']]).map(b => ({ type: 'reply', reply: { id: b[0], title: b[1] } })) } } }) }}`;

// ── remember_customer_fact 工具（B1）──
nodes.push({
  parameters: {
    toolDescription: '记住客户告诉你的、与订餐有关的一件事。key 只能是：nickname（称呼）/ dropoff（交接方式）/ allergy（忌口或过敏，仅记录）/ preferredMeal（lunch 或 dinner）/ tag（简短标签）/ note（一句话备注）。value ≤ 120 字。同一件事只记一次。',
    method: 'POST',
    url: `${SITE}/api/n8n/lead`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendBody: true,
    specifyBody: 'keypair',
    parametersBody: {
      values: [
        { name: 'action', valueProvider: 'fieldValue', value: 'note' },
        { name: 'phone', valueProvider: 'fieldValue', value: "={{ $('Router').first().json.phone }}" },
        { name: 'key', valueProvider: 'modelRequired' },
        { name: 'value', valueProvider: 'modelRequired' },
      ],
    },
    optimizeResponse: true,
  },
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest', typeVersion: 1.1, position: [-1280, -640],
  id: 'v4-tool-remember', name: 'remember_customer_fact', credentials: CRED_BEARER,
});

// ── AI 工具节点不支持 Bearer 凭据（09-07 上线首晚实测 `The type httpBearerAuth is not supported`，
//    AI Agent 初始化即炸）→ 一律改 Header Auth，复用 relay 那把凭据；网站 lead/capacity 两接口对应也认它。
for (const n of nodes) {
  if (n.type === '@n8n/n8n-nodes-langchain.toolHttpRequest' && n.parameters?.genericAuthType === 'httpBearerAuth') {
    n.parameters.genericAuthType = 'httpHeaderAuth';
    n.credentials = { ...CRED_INBOUND };
  }
}
if (nodes.some(n => n.type === '@n8n/n8n-nodes-langchain.toolHttpRequest' && n.credentials?.httpBearerAuth)) {
  throw new Error('仍有 AI 工具节点用 Bearer 凭据');
}

// ── Sheet 日志：全部 continueRegularOutput（保留两周作对照，之后另开 PR 删）──
for (const n of nodes) {
  if (n.type === 'n8n-nodes-base.googleSheets') n.onError = 'continueRegularOutput';
}

// ── 连线 ───────────────────────────────────────────────
const main = {};
const conn = (from, to, out = 0) => {
  main[from] = main[from] || { main: [] };
  while (main[from].main.length <= out) main[from].main.push([]);
  main[from].main[out].push({ node: to, type: 'main', index: 0 });
};

conn('Webhook', 'Guard - 过滤status');
conn('Guard - 过滤status', 'Router');
conn('Router', 'Main Switch');
conn('Main Switch', 'Lead Touch', 0);
conn('Main Switch', 'Boss Lookup', 1);
conn('Main Switch', 'Get Pending Draft', 2);
conn('Main Switch', 'Image Auto Reply', 2);
conn('Main Switch', 'Zone by Pin', 3);
conn('Main Switch', 'Audio Reply', 4);
conn('Main Switch', 'Boss Direct Ignore', 5);
conn('Main Switch', 'Human Forward', 6);
conn('Main Switch', 'Throttle Reply', 7);
conn('Main Switch', 'Boss Cmd Build', 8);
conn('Main Switch', 'Lead Close', 9);
conn('Main Switch', 'Ignore', 10);
conn('Main Switch', 'Fallback Reply', 11);

// 首触：秒回确定性话术 + 按钮
conn('Lead Touch', 'IF 新对话?');
conn('IF 新对话?', 'Get Menu Greet', 0);
conn('Get Menu Greet', 'Get Customer Greet');
conn('Get Customer Greet', 'Greeting Builder');
conn('Greeting Builder', 'Send Greeting');
conn('Send Greeting', 'Log Reply · 开场');
conn('Log Reply · 开场', '开场要按钮?');
conn('开场要按钮?', 'Send Greeting Buttons', 0);
conn('Send Greeting Buttons', 'Log Chat');
conn('开场要按钮?', 'Log Chat', 1);

// 对话中：防抖 → AI 问答
conn('IF 新对话?', 'Wait 防抖', 1);
conn('Wait 防抖', 'Lead Recheck');
conn('Lead Recheck', 'Message Gate');
conn('Message Gate', 'Log Customer Text');
conn('Message Gate', 'Get Promo');
conn('Get Promo', 'Get Dishes');
conn('Get Dishes', 'Get Live Menu');
conn('Get Live Menu', 'Get Customer');
conn('Get Customer', 'Context Builder');
conn('Context Builder', 'AI Agent');
conn('AI Agent', 'Post-process');
conn('Post-process', 'Action Switch');
conn('Action Switch', 'Send Reply', 0);
conn('Action Switch', 'Send QR', 1);
conn('Action Switch', 'Boss Alert', 2);
conn('Action Switch', 'Send Dish Image', 3);
conn('Action Switch', 'Default Fallback Reply', 4);
conn('Send Reply', 'Log Reply · AI');
conn('Send QR', 'Log Reply · AI');
conn('Send Dish Image', 'Log Reply · AI');
conn('Default Fallback Reply', 'Log Reply · AI');
conn('Log Reply · AI', 'Log Chat');
conn('Boss Alert', 'Lead Alert · 求救');
conn('Lead Alert · 求救', 'Send安抚');
conn('Boss Alert', 'Boss Alert Telegram');
conn('Send安抚', 'Log Reply · AI');
conn('Send安抚', 'Log Escalation');

// 图片 / 定位：v3 一致 + 警报映射写 Firestore
conn('Get Pending Draft', 'Image Forward');
conn('Image Forward', 'Lead Alert · 图片');
conn('Lead Alert · 图片', 'Log Image Escalation');
conn('Zone by Pin', 'Pin Reply Builder');
conn('Pin Reply Builder', 'Send Pin Reply');
conn('Send Pin Reply', 'Log Reply · 定位');
conn('Pin Reply Builder', 'Need Pin Escalate');
conn('Need Pin Escalate', 'Pin Boss Alert');
conn('Pin Boss Alert', 'Lead Alert · 定位');

// 老板引用回复：反查 → 意图 → 建单 / 润色转达 → 记 turn → 接管或释放 → QR
conn('Boss Lookup', 'Has Boss Match');
conn('Has Boss Match', 'Parse Boss Intent', 0);
conn('Has Boss Match', 'Boss Not Found Reply', 1);
conn('Parse Boss Intent', 'Is Confirm');
conn('Is Confirm', 'WA Confirm Order', 0);
conn('Is Confirm', 'Gemini Polish', 1);
conn('WA Confirm Order', 'Confirm Result');
conn('Confirm Result', 'Notify Boss Confirm');
conn('Notify Boss Confirm', 'Has Customer Notice');
conn('Has Customer Notice', 'Notify Customer Confirmed', 0);
conn('Has Customer Notice', 'Log Confirm', 1);
conn('Notify Customer Confirmed', 'Log Confirm');
conn('Gemini Polish', 'Extract Final Reply');
conn('Extract Final Reply', 'Send Solution');
conn('Send Solution', 'Log Reply · 老板');
conn('Log Reply · 老板', 'Boss 要释放?');
conn('Boss 要释放?', 'Lead Release', 0);
conn('Boss 要释放?', 'Lead Human', 1);
conn('Lead Release', 'Need Send QR');
conn('Lead Human', 'Need Send QR');
conn('Need Send QR', 'Boss Send QR', 0);
conn('Need Send QR', 'Log Boss Reply', 1);
conn('Boss Send QR', 'Log Boss Reply');

// 人工中转发 / 老板指令 / 客户说不用了
conn('Human Forward', 'Lead Alert · 人工');
conn('Boss Cmd Build', 'Boss Cmd Exec');
conn('Boss Cmd Exec', 'Boss Cmd Reply');
conn('Boss Cmd Reply', 'Boss Cmd Send');
conn('Lead Close', 'Close Reply');

// AI 的子连接（无 memory 节点）
main['Gemini Chat Model'] = { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] };
main['check_delivery_fee'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };
main['create_order_draft'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };
main['check_capacity'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };
main['remember_customer_fact'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };

const v4main = {
  name: 'Bowlmama v4 — 持久记忆 + 人工接管 + relay 进入层',
  nodes, pinData: {}, connections: main, active: false,
  settings: { executionOrder: 'v1' }, meta: v3.meta, tags: [],
};

// ════════════════════════════════════════════════════════════
// v4-followup —— 追单 cron（+ 记 turn + 第 1 次带按钮）
// ════════════════════════════════════════════════════════════
const NUDGE_CODE = v3f.nodes.find(n => n.name === 'Build Nudge').parameters.jsCode
  .replace('第 1 次（客户消息 +35 分钟）', '第 1 次（客户消息 +60 分钟，老板 09-06 定）')
  .replace('排程逻辑有 35 条断言', '排程逻辑有 37 条断言')
  .replace(
    "? '亲，刚才那几道还在哦 😊 点这里 30 秒就能下单 👇\\n' + url + '\\n\\n不想点链接也行，回「1」碗妈直接帮你落单 ❤️'",
    "? '亲，一个小时前你问的那几道还在哦 😊 点这里 30 秒就能下单 👇\\n' + url + '\\n\\n不想点链接也行，回「1」碗妈直接帮你落单 ❤️'",
  )
  .replace(
    "? 'Hi! Those dishes are still available 😊 Tap here, 30 seconds to order 👇\\n' + url",
    "? 'Hi! The dishes you asked about an hour ago are still available 😊 Tap here, 30 seconds to order 👇\\n' + url",
  );
if (!NUDGE_CODE.includes('一个小时前')) throw new Error('Build Nudge 文案替换失败');

const fNodes = v3f.nodes.map(n => JSON.parse(JSON.stringify(n)));
fNodes.find(n => n.name === 'Build Nudge').parameters.jsCode = NUDGE_CODE;
fNodes.push(leadPost('Log Reply · 追单', 'v4f-log',
  `{ action: 'reply', role: 'nudge', phone: $('Build Nudge').item.json.phone, text: $('Build Nudge').item.json.text }`,
  [280, 0]));
fNodes.push(ifNode('第 1 次追单?', 'v4f-if-first', "={{ $('Build Nudge').item.json.nudgeIndex === 1 && $('Build Nudge').item.json.intent !== 'catering' }}", '', [500, 0]));
fNodes.push(waButtons('Send Nudge Buttons', 'v4f-btn', "$('Build Nudge').item.json.phone", "'x'", [], [720, -80]));
fNodes[fNodes.length - 1].parameters.jsonBody = `={{ JSON.stringify({ messaging_product: 'whatsapp', to: $('Build Nudge').item.json.phone, type: 'interactive', interactive: { type: 'button', body: { text: $('Build Nudge').item.json.lang === 'en' ? 'How can BowlMama help?' : '要碗妈怎么帮你？' }, action: { buttons: ($('Build Nudge').item.json.lang === 'en' ? [['btn_order_help','Order for me ✍️'],['lead_close','Not today 🙏']] : [['btn_order_help','帮我直接落单 ✍️'],['lead_close','先不用了 🙏']]).map(b => ({ type: 'reply', reply: { id: b[0], title: b[1] } })) } } }) }}`;

const followup = {
  name: 'Bowlmama v4 — 自动追单（每 15 分钟）',
  nodes: fNodes,
  pinData: {},
  connections: {
    'Every 15 min': { main: [[{ node: 'Fetch Due Leads', type: 'main', index: 0 }]] },
    'Fetch Due Leads': { main: [[{ node: 'Build Nudge', type: 'main', index: 0 }]] },
    'Build Nudge': { main: [[{ node: 'Send Nudge', type: 'main', index: 0 }]] },
    'Send Nudge': { main: [[{ node: 'Log Reply · 追单', type: 'main', index: 0 }]] },
    'Log Reply · 追单': { main: [[{ node: '第 1 次追单?', type: 'main', index: 0 }]] },
    '第 1 次追单?': { main: [[{ node: 'Send Nudge Buttons', type: 'main', index: 0 }], []] },
  },
  active: false, settings: { executionOrder: 'v1' }, meta: v3f.meta, tags: [],
};

// ════════════════════════════════════════════════════════════
// v4-error —— 报错 Telegram（与 v3 相同，只改名）
// ════════════════════════════════════════════════════════════
const v4err = JSON.parse(JSON.stringify(v3e));
v4err.name = 'Bowlmama v4 — Error Handler';

writeFileSync(join(DIR, 'bowlmama-v4-main.json'), JSON.stringify(v4main, null, 2), 'utf8');
writeFileSync(join(DIR, 'bowlmama-v4-followup.json'), JSON.stringify(followup, null, 2), 'utf8');
writeFileSync(join(DIR, 'bowlmama-v4-error.json'), JSON.stringify(v4err, null, 2), 'utf8');

console.log(`✅ v4-main      ${v4main.nodes.length} 节点（v3 是 ${v3.nodes.length}）`);
console.log(`✅ v4-followup  ${followup.nodes.length} 节点`);
console.log(`✅ v4-error     ${v4err.nodes.length} 节点`);
