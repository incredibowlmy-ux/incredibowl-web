/**
 * build-n8n-v3.mjs —— 生成 Bowlmama v3 的 n8n workflow JSON。
 *
 * 为什么用脚本生成而不是手写 JSON：v3 要**复用 v2 里已经能跑的整条支线**
 * （图片转发核款、求救转达、老板回「1」建单、定位报价），只替换销售路径。
 * 手抄 60 个节点 + 重连线，错一个节点名就是静默故障；程序化搬运 + 校验脚本
 * 把关，风险低一个数量级。
 *
 * 跑法：node scripts/build-n8n-v3.mjs && node scripts/validate-n8n-workflows.mjs
 *
 * 产出：
 *   n8n-workflows/bowlmama-v3-main.json      主流程（webhook）
 *   n8n-workflows/bowlmama-v3-followup.json  追单 cron（每 15 分钟）
 *   n8n-workflows/bowlmama-v3-error.json     报错 → Telegram
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../n8n-workflows/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const v2 = JSON.parse(readFileSync(join(DIR, 'bowlmama-v2-main.json'), 'utf8'));

const SITE = 'https://www.incredibowl.my';
const CRED_WA = { whatsAppApi: { id: 'r40sSPxInxCOtHWS', name: 'WhatsApp account' } };
const CRED_SHEETS = { googleSheetsOAuth2Api: { id: 'G1eKfCxWLU9x0zyF', name: 'Google Sheets account' } };
const CRED_BEARER = { httpBearerAuth: { id: 'ew3zAX6xWGWOdrGO', name: 'Incredibowl N8N API Key' } };
const CRED_TELEGRAM = { telegramApi: { id: 'REPLACE_AFTER_IMPORT', name: 'Telegram account（导入后手动选）' } };
const BOSS_PHONE = '60165014501';
const WA_PHONE_ID = '1019276584602589';

const byName = Object.fromEntries(v2.nodes.map(n => [n.name, n]));
/** 从 v2 原样搬一个节点（深拷贝，可选覆盖字段）。 */
const lift = (name, patch = {}) => {
  const src = byName[name];
  if (!src) throw new Error(`v2 里没有节点：${name}`);
  return { ...JSON.parse(JSON.stringify(src)), ...patch };
};
const httpNode = (name, id, url, pos, extra = {}) => ({
  parameters: { url, authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', options: {}, ...extra },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, id, name,
  onError: 'continueRegularOutput', credentials: CRED_BEARER,
});
const codeNode = (name, id, jsCode, pos) => ({
  parameters: { jsCode }, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, id, name,
});
const waText = (name, id, to, text, pos) => ({
  parameters: { operation: 'send', phoneNumberId: WA_PHONE_ID, recipientPhoneNumber: to, textBody: text, additionalFields: {} },
  type: 'n8n-nodes-base.whatsApp', typeVersion: 1.1, position: pos, id, name,
  webhookId: `b2f1e7a0-v3${id.slice(-4)}-4a00-9c00-bowlmamav300`, credentials: CRED_WA,
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

// ════════════════════════════════════════════════════════════
// Router v3 —— v2 的分类逻辑 + 语言判定 + 团餐意图判定
// ════════════════════════════════════════════════════════════
const ROUTER_CODE = `// ============================
// 路由器 v3 = v2 的字段提取/去重/路由 + 两件新事：
//   · lang   客户说什么语言就回什么语言（老板确认客流中英混）
//   · intent 团餐意图（命中就走团餐剧本，不再一句「[求救老板]」了事）
// 这两件放在 Router 而不是交给 AI，是因为**第一条消息必须秒回**：
// 走一趟 LLM 再决定说什么，客户已经等了 3 秒，而 v2 的 0 成交就死在等待上。
// ============================

const entry = $input.first().json.body.entry[0].changes[0].value;
const msg = entry.messages[0];
const BOSS_PHONE = '${BOSS_PHONE}';

const staticData = $getWorkflowStaticData('global');
const nowTs = Date.now();
const seen = staticData.seenMessages || {};
for (const k of Object.keys(seen)) {
  if (nowTs - seen[k] > 5 * 60 * 1000) delete seen[k];
}
if (msg.id && seen[msg.id]) return [];
if (msg.id) { seen[msg.id] = nowTs; staticData.seenMessages = seen; }

const phone = msg.from;
const type = msg.type;
const text = msg.text?.body ?? '';
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

let route = 'fallback';
if (isBoss && hasContext && type === 'text' && text) route = 'boss_reply';
else if (isBoss) route = 'boss_direct';
else if (type === 'image') route = 'image';
else if (type === 'location') route = 'location';
else if (type === 'audio') route = 'audio';
else if (type === 'text' && text) route = 'customer_text';

// ── 语言：有中日韩字符就是中文，否则英文 ──────────────
// 刻意用「有没有 CJK」而不是语言识别库：马来西亚客户常中英夹杂，
// 只要他打了一个中文字，回中文一定不会错；纯英文才回英文。
const lang = /[\\u4e00-\\u9fff\\u3040-\\u30ff]/.test(text) ? 'zh' : 'en';

// ── 团餐意图 ───────────────────────────────────────────
// 命中任一关键词，或明确提到 ≥10 份/pax，就走团餐剧本。
// 宁可多判：团餐单均 RM636 是普通单的 30 倍，误判成团餐最多多问一句，
// 漏判则是把一张 RM600 的单丢给通用话术。
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
    phone, type, text, imageId, caption, contextId,
    isBoss, hasContext, route, lang, intent, profileName,
    msgId: msg.id || '',
    lat, lng, locName, locAddress,
  },
}];`;

// ════════════════════════════════════════════════════════════
// Greeting Builder —— 新客 / 老客 / 团餐 三套确定性话术
// ════════════════════════════════════════════════════════════
const GREETING_CODE = `// ============================
// 首触话术（确定性，不经 LLM）。v2 的病根是「AI 要客户打字说清 6 样信息」，
// 这里反过来：**第一条就把客户做决定需要的东西一次给全**，并给一个能点的入口。
//
// 三套剧本：
//   catering  团餐 —— 报价规则/餐具/准点/收据全给，只问 3 样
//   returning 老客 —— 「还是老样子吗」+ 预填好的复购链接
//   new       新客 —— 菜单 + RM5 + 一键下单链接
// 全部中英双语，跟着 Router 判出来的 lang 走。
// ============================

const r = $('Router').first().json;
const lead = $('Lead Touch').first().json?.lead || {};
const menu = $('Get Menu Greet').first()?.json || {};
const cust = $('Get Customer Greet').first()?.json || {};

const zh = r.lang !== 'en';
const token = lead.clickToken || '';
const tag = token ? ('&lead=' + token) : '';

// 菜单读不到 → 绝不凭记忆编菜（v2 之前出过三次「报旧菜单骗客户」）
const menuOk = typeof menu.today_menu_short === 'string' && menu.today_menu_short.length > 0;
const menuBlock = menuOk ? (zh ? menu.today_menu_short : (menu.today_menu_short_en || menu.today_menu_short)) : '';
const label = zh ? (menu.delivery_label || '') : (menu.delivery_label_en || menu.delivery_label || '');
const baseUrl = (zh ? (menu.order_url || '${SITE}/o?ref=wa') : (menu.order_url_en || '${SITE}/en/o?ref=wa')) + tag;

if (!menuOk) {
  return [{ json: {
    phone: r.phone,
    reply: zh
      ? '亲爱的，碗妈这边系统卡了一下，稍等碗妈马上回你 ❤️'
      : 'Hi dear! Give BowlMama a moment, replying to you right away ❤️',
    kind: 'menu_down',
    escalate: true,
  }}];
}

// 配送情境（周末 / 已过截单 / 还没截单）中英同源，都来自 /api/n8n/menu。
// 绝不在这里硬编码「6 点截单」—— 周末说这句会让客户以为今天还能订。
const cutoffZh = menu.delivery_context || '每天早上 6 点截单。';
const cutoffEn = menu.delivery_context_en || 'Orders close 6:00 AM daily.';

let reply = '';
let kind = 'new';

if (r.intent === 'catering') {
  kind = 'catering';
  reply = zh
    ? ['可以的！碗妈做的是餐盒式团体订餐 📦',
       '每人一份独立餐盒（不是 buffet，附一次性餐具）',
       '',
       '价格就是菜单原价，没有额外收费：',
       menuBlock,
       '',
       '告诉碗妈这 3 样，马上给你报价：',
       '① 哪天、几点要送到',
       '② 几位',
       '③ 送到哪里',
       '',
       '送达时间你指定几点就几点（±15 分钟内到）',
       'Pearl Suria 一带免运费 · 可开公司收据 ❤️'].join('\\n')
    : ['Yes we do! BowlMama does bento-style group catering 📦',
       'One sealed box per person (not a buffet; disposable cutlery included).',
       '',
       'Price is simply the menu price — no hidden charges:',
       menuBlock,
       '',
       'Tell BowlMama these 3 things and you get a quote right away:',
       '1. Which day, and what time it must arrive',
       '2. How many people',
       '3. Delivery address',
       '',
       'We deliver at the exact time you name (within ±15 min).',
       'Free delivery around Pearl Suria · company receipt available ❤️'].join('\\n');
} else if (cust.found === true && cust.reorder && cust.reorder.summary) {
  kind = 'returning';
  const name = (cust.profile && cust.profile.name) ? cust.profile.name : '';
  const reUrl = (zh ? cust.reorder.url : (cust.reorder.urlEn || cust.reorder.url)) + tag;
  reply = zh
    ? [(name ? name + '！' : '') + '👋 碗妈记得你 ❤️',
       '还是老样子吗？' + cust.reorder.summary,
       '',
       '点这里 30 秒付好 👇',
       reUrl,
       '',
       '想吃别的也行，' + label + '还有：',
       menuBlock].join('\\n')
    : [(name ? 'Hi ' + name + '!' : 'Hi!') + ' 👋 BowlMama remembers you ❤️',
       'Same as last time? ' + cust.reorder.summary,
       '',
       'Tap here, 30 seconds to pay 👇',
       reUrl,
       '',
       'Or pick something else — ' + label + ' we have:',
       menuBlock].join('\\n');
} else if (cust.found === true) {
  // 认得这个号码但上次点的菜现在都排不上 → 当熟客打招呼，但给通用链接
  kind = 'returning_nomatch';
  const name = (cust.profile && cust.profile.name) ? cust.profile.name : '';
  reply = zh
    ? [(name ? name + '！' : '') + '👋 碗妈记得你 ❤️',
       label + '可点：',
       menuBlock,
       '',
       '👇 点这里 30 秒下单',
       baseUrl,
       '',
       cutoffZh].join('\\n')
    : [(name ? 'Hi ' + name + '!' : 'Hi!') + ' 👋 BowlMama remembers you ❤️',
       'Available ' + label + ':',
       menuBlock,
       '',
       '👇 Tap here, 30 seconds to order',
       baseUrl,
       '',
       cutoffEn].join('\\n');
} else {
  kind = 'new';
  reply = zh
    ? ['碗妈的厨房欢迎你 🍲',
       label + '可点：',
       menuBlock,
       '',
       '🎁 新朋友第一单立减 RM5',
       '👇 30 秒下单，免注册',
       baseUrl,
       '',
       '送 Pearl Suria 一带 · ' + cutoffZh].join('\\n')
    : ["Welcome to BowlMama's Kitchen 🍲",
       'Available ' + label + ':',
       menuBlock,
       '',
       '🎁 RM5 off your first order',
       '👇 30 seconds to order, no sign-up',
       baseUrl,
       '',
       'We deliver around Pearl Suria · ' + cutoffEn].join('\\n');
}

return [{ json: { phone: r.phone, reply, kind, escalate: false, lang: r.lang, intent: r.intent } }];`;

// ════════════════════════════════════════════════════════════
// Message Gate —— 用 lead 文档当防抖水位线（取代 v2 的 Google Sheet 三件套）
// ════════════════════════════════════════════════════════════
const GATE_CODE = `// ============================
// 防抖 v3：**lead 文档自己就是水位线**，判定在服务端做完。
//
// v2 用 Google Sheet 做防抖（Append→Wait→Read→Gate→Mark 五个节点 + 一张表，
// 老板还要手工建 tab、定期清行）。v3 只用一次 HTTP：Lead Recheck 带着
// sinceTs + consume=1 去问「我是不是最新那条？是的话把攒下的消息给我」。
//
// 客户 3 秒内连发三条 → 三个执行都问这一句 → 前两条拿到 isLatest=false 静默退出，
// 只有最后一条继续，并且拿到**三条合并起来的文本**交给 AI。
// 「只回一条」和「看到全部内容」是两件事，v2 都做到了，v3 也必须都做到 ——
// 只做前者的话，客户说「我要订两份」「送 Pearl Suria」会变成只回答后半句。
//
// 任何一步读失败都**放行并退回自己这条**：宁可多回一条，绝不吃掉客户消息。
// ============================

const r = $('Router').first().json;
const fresh = $input.first().json || {};

// 服务端明确说了不是最新 → 让后面那条去回复
if (fresh.isLatest === false) return [];

// 服务端没给判定（端点挂了/字段缺失）→ 退化成「按自己这条处理」
const merged = typeof fresh.mergedText === 'string' ? fresh.mergedText.trim() : '';
const text = merged || r.text;

return [{ json: { phone: r.phone, text, lang: r.lang, intent: r.intent, merged: !!merged } }];`;

// ════════════════════════════════════════════════════════════
// Context Builder v3
// ════════════════════════════════════════════════════════════
const CONTEXT_CODE = `// ============================
// Context Builder v3：菜单/配送/促销/发图清单/客户档案，全部 fail-safe。
// 与 v2 的差别：多注入「一键下单链接」和「客户语言」，因为 v3 的成交动作是
// **发链接**而不是让 AI 自己组单。
// ============================

const menuApi = $('Get Live Menu').first()?.json || {};
const apiOk = typeof menuApi.today_menu === 'string' && menuApi.today_menu.length > 0;
const gate = $('Message Gate').first().json;
const zh = gate.lang !== 'en';

const deliveryContext = apiOk ? menuApi.delivery_context : '';
const deliveryLabel = apiOk ? (zh ? menuApi.delivery_label : (menuApi.delivery_label_en || menuApi.delivery_label)) : '';
const todayMenu = apiOk
  ? (zh ? menuApi.today_menu : (menuApi.today_menu_en || menuApi.today_menu))
  : '【系统提示】菜单服务暂时读取不到。不要凭记忆报任何菜名或价格，直接在回复开头加 [求救老板]，请客户稍等。';

const lead = $('Lead Touch').first().json?.lead || {};
const tag = lead.clickToken ? ('&lead=' + lead.clickToken) : '';
const orderUrl = apiOk
  ? ((zh ? (menuApi.order_url || '') : (menuApi.order_url_en || menuApi.order_url || '')) + tag)
  : '';
const dishLinks = apiOk && Array.isArray(menuApi.dishes)
  ? menuApi.dishes.filter(d => !d.soldOut).map(d => \`- \${d.name}：\${(zh ? d.orderUrl : (d.orderUrlEn || d.orderUrl))}\${tag}\`).join('\\n')
  : '（下单链接暂时取不到，请直接引导客户等碗妈回复）';

const promoRow = $('Get Promo').first()?.json || {};
const promoActive = promoRow.active === true || String(promoRow.active).toLowerCase() === 'true';
const promoText = (promoActive && promoRow.text) ? String(promoRow.text) : '暂无促销活动。';

const dishRows = $('Get Dishes').all().map(i => i.json).filter(d => {
  if (!d || !d.dish_id) return false;
  const a = d.active;
  return a === true || String(a ?? '').toLowerCase() === 'true';
});
const dishIdList = dishRows.length
  ? dishRows.map(d => {
      const aliases = String(d.aliases ?? '').trim();
      return \`- \${d.dish_id}\${aliases ? \`（\${aliases}）\` : ''}：\${d.name_zh} RM\${d.price}\`;
    }).join('\\n')
  : '（暂无可发图菜单）';

const cust = $('Get Customer').first()?.json || {};
const customerContext = typeof cust.contextBlock === 'string' && cust.contextBlock
  ? cust.contextBlock
  : '【客户档案】查询暂时失败 —— 不要假设客户身份，正常接待即可。';

// 逐道菜的主要食材。API 挂了就给一句「查不到」——绝不让 AI 凭菜名猜成分。
const ingredientsBlock = apiOk && Array.isArray(menuApi.dishes)
  ? (menuApi.dishes
      .filter(d => Array.isArray(d.ingredients) && d.ingredients.length)
      .map(d => \`- \${d.name}：\${d.ingredients.join('、')}\`)
      .join('\\n') || '（这批菜的成分表暂时取不到，客户问成分一律 [求救老板]）')
  : '（成分表暂时取不到，客户问成分一律 [求救老板]）';
const ingredientsNote = (apiOk && menuApi.ingredients_note)
  || '成分数据取不到时，客户问成分一律 [求救老板]，绝不凭菜名猜。';

// 包伙食（餐券预付包）。折扣率由服务端按当周菜单现算，这里只转述。
const pkg = (apiOk && menuApi.meal_packages) ? menuApi.meal_packages : null;
const packageBlock = pkg
  ? \`\${pkg.name}（最高省 \${pkg.max_save_percent}%）：\\n\${pkg.pitch_block}\`
  : '（包伙食资料暂时取不到，客户问起就说碗妈马上帮你确认，并 [求救老板]）';
const packageUrl = pkg ? (zh ? pkg.buy_url : (pkg.buy_url_en || pkg.buy_url)) : '';
const coverageText = (apiOk && menuApi.coverage_text) || 'Old Klang Road 一带';

return [{
  json: {
    phone: gate.phone,
    text: gate.text,
    lang: gate.lang,
    reply_language: zh ? '简体中文' : 'English',
    coverage_text: coverageText,
    ingredients_block: ingredientsBlock,
    ingredients_note: ingredientsNote,
    package_block: packageBlock,
    package_url: packageUrl,
    delivery_context: deliveryContext,
    delivery_label: deliveryLabel,
    today_menu: todayMenu,
    promo_text: promoText,
    dish_id_list: dishIdList,
    customer_context: customerContext,
    order_url: orderUrl,
    dish_links: dishLinks,
  },
}];`;

// ════════════════════════════════════════════════════════════
// AI system prompt v3
// ════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `=你是 Incredibowl 客服助理「碗妈/Bowlmama」。客户已经收到过开场白，你现在负责**回答他的具体问题**。

【回复语言 —— 最高优先级】
本次必须用：{{ $json.reply_language }}
客户用什么语言问就用什么语言答，绝不混用两种语言写同一条回复。

【人设与语气】
热情爽朗、口语化，像邻居阿姨聊天，结尾常带 ❤️。禁语：「由于、基于、无法、不能、根据」等公文腔。
回复简短自然：客户问一个答一个，不主动刷屏、不重复发菜单。
卖点底线：自家孩子能吃才敢给客人吃；不放味精不放防腐剂；碗妈每天亲自去巴刹采购新鲜食材。

【成交方式 —— v3 的核心改变，务必照做】
客户想下单时，**发下单链接给他**，不要在聊天里一问一答收集菜名/份数/地址。
通用链接：{{ $json.order_url }}
按菜的链接（客户说了具体想吃哪道就发对应那条）：
{{ $json.dish_links }}
话术示例：「好嘞！点这个就能选份数、填地址、直接付款，30 秒搞定 👇 <链接>」
链接页面会自己处理份数、午晚、地址、优惠码和付款 —— 你不需要问这些。

例外（只有这一种）：客户明确说「不想点链接 / 帮我直接落单 / 发 QR 给我」时，才调
create_order_draft 工具走 WhatsApp 内下单：工具返回什么明细和总额你就转述什么，
**绝不自己算总额**；客户确认后回收款话术并在结尾加 [SEND_QR]。

【客户档案】（系统按来电号码自动查询，只能用于回答该客户本人）
{{ $json.customer_context }}
· 客户问「我还有几张餐券 / 预付蛋还剩几个」→ 直接用档案数字回答。
· 客户问「我的饭到哪了 / 几点到」→ 用档案里进行中订单的状态回答；有跟踪链接就发给客户。
· 档案之外的信息（别人的订单、别的号码）一律 [求救老板]。

【当前配送信息】
{{ $json.delivery_context }}

【可点菜单】
{{ $json.today_menu }}

【当前促销】
{{ $json.promo_text }}
新客第一单立减 RM5（链接会自动套用，客户问起就说「新朋友首单立减 RM5，点链接自动扣」）。

【配送时段与方式】
午餐 11:00 AM – 1:00 PM；晚餐 5:30 PM – 8:00 PM。送到楼下 / 门口 / 办公室门口。
散客只做周一到周五，周末碗妈陪孩子休息。
配送覆盖：{{ $json.coverage_text }}。客户报的地方在这几区里就直接说「送的哦」，
具体运费仍然要调 check_delivery_fee 报数。

【自取（Pearl Suria Residence 大堂）—— 立减 RM2】
客户可以到 Pearl Suria Residence 大堂自取，**减 RM2**（省了运费还多减 2 块）。
同栋楼的住户尤其划算，主动可以提一句。
⚠️ 但**网站的下单链接目前不支持自取**（会照收运费）。所以客户说要自取时：
不要发下单链接，改说「自取碗妈帮你安排，减 RM2」，然后回复开头加 [求救老板]
让老板接手。绝不要让客户点链接下单后自己去拿——他会被多收运费。

【碗妈的人工回复时间：早上 8 点 – 晚上 8 点】
超出这个时段客户找人工时，照样收下需求并求救，但要如实说明：
「碗妈这边早上 8 点到晚上 8 点回消息，现在先帮你记下，一上线马上回你 ❤️」
别让客户空等一夜还以为随时有人。

【包伙食（餐券预付包）—— 可以主动介绍并卖】
{{ $json.package_block }}
· 1 张券 = 1 份主餐；加料仍要现金另付。
· 买券链接：{{ $json.package_url }}
· ⚠️ **餐券单不能再叠 RM 折扣码（含新客 RM5）**，系统会直接拒收。
  客户如果两个都想要，如实说「这两个只能二选一哦」，别两个都答应。
· 折扣一律说「最高省 X%」，X 用上面给的数字，**绝不自己算、绝不写死**——
  兑越贵的菜省越多，兑便宜的菜省得少。
· 什么时候提：客户说「常吃 / 每天都要 / 有没有更划算 / 包月 / 包伙食 / meal plan」
  时提。客户没问就别硬推。

【运费 —— 只准用工具报数】
客户消息里出现任何地址、condo 名、Taman 名、路名，必须调用 check_delivery_fee，把客户原话地址传进去。
工具返回什么就转述什么：fee=运费、threshold=免运门槛（threshold 为 null 的远距离档 = 固定运费永不免运，别自己发明门槛）、tier 为 outside 或工具失败 → 回复开头加 [求救老板]。
绝对禁止凭记忆报运费。没有「无条件包邮」这回事。

【团餐 / 到会 —— 老板 2026-08-16 定的规则，照这个答】
· 形式：餐盒式团体订餐，每人一份独立餐盒，**不是 buffet**，附一次性餐具。
· 价格：**当周菜单原价 × 份数，不打折**。所以你可以当场报价（菜价来自【可点菜单】）。
· 菜色：从当周菜单挑 1–3 道按人数拆。
· 人数/提前期：没有硬门槛，看档期。
· 档期：报价前**必须调 check_capacity 工具**查那天还能接几份（厨房一天上限 50 份，含散客）。
  工具回 canQuote=false 时**绝不当场承诺**，改说「这天档期比较满，碗妈碰一下马上回你」并 [求救老板]。
· 运费：照常调 check_delivery_fee（团餐金额大，近距离必然免运；远距离固定收费）。
· 收款：**先付 50% 定金，送达前付清余额**。
· 送达时间：客户指定几点就几点，±15 分钟内到。
· 公司收据：可以开。
· 周末 / 公众假期：可以做，但**20 份以上才接**；不够就引导改平日。
· 素食 / 清真 / 忌口：**不要主动提**。客户问了才诚实说：厨房不是清真认证，也没法单独做素食或忌口定制。
· 收齐「哪天几点 + 几位 + 地址」就报价，格式：逐道菜列出 名称×份数 = 小计，然后餐费合计、运费、总额、定金金额。
· 报完价问「要碗妈帮你锁档期吗？回 1 就发定金 QR」，并在回复开头加 [求救老板]（团餐单必须老板过目）。

【菜里有什么 —— 成分问答的硬边界】
{{ $json.ingredients_block }}

{{ $json.ingredients_note }}
再说一次这条红线：客户问「有没有猪肉 / 牛肉 / 蛋 / 海鲜 / 辣不辣」→ 照上面的成分表答。
客户一提「**过敏**」（花生、坚果、麸质、海鲜过敏…）→ **立刻 [求救老板]，绝不自己判断**。
成分表是采购单不是过敏原声明，答错这个是会出人命的事，不是服务好不好的事。

【推荐策略】
只推荐【可点菜单】里当天有的菜。客户犹豫 → 优先推当天特餐。客户没主动问就不推销。

【求救机制 —— 全流程只有一个标记：[求救老板]】
以下情况在回复开头加 [求救老板]，并告诉客户「这个碗妈得跟老板确认一下，稍等哦 ❤️」：
团餐询价、定制需求（换食材/忌口/特殊做法）、投诉或情绪不满、地址工具判不了、
长期包餐/企业合作、改已付款订单、任何拿不准的信息。
零编造原则：不确定就求救，绝对不编。

【常见问题速查】
· 周末可以订吗 → 散客周一到周五；团餐 20 份以上周末也能做
· 为什么比杂饭贵 → 每天巴刹新鲜食材、不放味精，有 Food Handler 证书和伤寒疫苗证明
· 几点截单 → 每天早上 6 点
· 可以长期订吗 → 可以！然后 [求救老板] 让老板亲自安排

【发送菜品图片】
客户要看菜的图（关键词：图 / 长什么样 / picture / 看看）→ 回复结尾加 [SEND_DISH:dish_id]。
一次只发一道；dish_id 必须从下方清单选，绝不编造；回复不超过 2 句。
可用 dish_id 清单：
{{ $json.dish_id_list }}`;

// ════════════════════════════════════════════════════════════
// 组装 v3-main
// ════════════════════════════════════════════════════════════
const KEEP = [
  'Webhook', 'Guard - 过滤status', 'Main Switch',
  'Log Customer Text', 'Get Promo', 'Get Dishes', 'Get Live Menu', 'Get Customer',
  'AI Agent', 'Gemini Chat Model', 'Window Buffer Memory', 'check_delivery_fee', 'create_order_draft',
  'Action Switch', 'Send Reply', 'Send QR', 'Boss Alert', 'Send安抚', 'Log Escalation',
  'Send Dish Image', 'Default Fallback Reply', 'Log Chat',
  'Get Pending Draft', 'Image Forward', 'Image Auto Reply', 'Log Image Escalation',
  // ⚠️ 刻意不搬 'Pin Buffer Note'：它往 Google Sheet 的 wa_buffer 表写一行 SYS- 注记，
  // 好让 v2 的 Sheet 防抖把定位报价并进下一轮 AI 上下文。v3 的防抖改用 lead 文档，
  // 没有任何人再读那张表 —— 留着就是「写了没人看」，还逼老板继续维护一个 tab。
  'Zone by Pin', 'Pin Reply Builder', 'Send Pin Reply', 'Need Pin Escalate', 'Pin Boss Alert',
  'Audio Reply', 'Boss Direct Ignore', 'Fallback Reply',
  'Boss Lookup', 'Has Boss Match', 'Boss Not Found Reply', 'Parse Boss Intent', 'Is Confirm',
  'WA Confirm Order', 'Confirm Result', 'Notify Boss Confirm', 'Has Customer Notice',
  'Notify Customer Confirmed', 'Log Confirm', 'Gemini Polish', 'Extract Final Reply',
  'Send Solution', 'Need Send QR', 'Boss Send QR', 'Log Boss Reply',
];

const nodes = KEEP.map(n => lift(n));
const put = (name, patch) => {
  const i = nodes.findIndex(n => n.name === name);
  if (i < 0) throw new Error(`节点不存在：${name}`);
  nodes[i] = { ...nodes[i], ...patch };
};

// ── 定位报价 v3：改中英双语 + 报完运费立刻给下单链接 ──────
// v2 这里报完运费就说「想下单直接告诉碗妈要哪道菜」，等于把客户推回打字流程。
// 客户刚看到运费数字的那一秒是最该给入口的时刻。
// 同时删掉 note 里那句写给 wa_buffer 的系统注记（v3 已经没有那张表的读取方）。
const PIN_CODE = `// ============================
// 位置 pin 报价：坐标直接算档位/运费（与网站同一套 deliveryUtils 口径），
// 报完立刻给一键下单链接 —— 这是全对话里客户意愿最高的一刻。
// 语言跟着 Router 判出来的 lang 走。
// ============================

const r = $('Zone by Pin').first()?.json || {};
const me = $('Router').first().json;
const place = me.locName || me.locAddress || '';
const zh = me.lang !== 'en';
const url = zh ? '${SITE}/o?ref=wa' : '${SITE}/en/o?ref=wa';

let reply, needEscalate;
if (typeof r.fee === 'number') {
  const th = r.threshold;
  reply = zh
    ? \`收到定位啦 📍 \${place ? place + ' ' : ''}距离碗妈厨房约 \${r.distanceKm}km，运费 RM \${r.fee}\${th ? \`，菜品满 RM \${th} 就免运费哦\` : '（这个距离是固定运费）'}。\\n\\n👇 点这里直接下单，30 秒搞定\\n\${url}\`
    : \`Got your pin 📍 \${place ? place + ' ' : ''}about \${r.distanceKm}km from BowlMama's kitchen. Delivery RM \${r.fee}\${th ? \`, free once your food total hits RM \${th}\` : ' (flat rate at this distance)'}.\\n\\n👇 Tap here to order, 30 seconds\\n\${url}\`;
  needEscalate = false;
} else if (r.tier === 'outside') {
  reply = zh
    ? \`亲爱的，你的位置离碗妈厨房约 \${r.distanceKm}km，超出目前 25km 的配送范围了 😢 碗妈让老板看看有没有别的安排，稍等哦\`
    : \`Sorry dear — you're about \${r.distanceKm}km away, beyond our 25km delivery range 😢 Let me check with the boss and get back to you.\`;
  needEscalate = true;
} else {
  reply = zh
    ? '定位收到啦！碗妈让老板帮你确认一下配送范围，稍等哦 ❤️'
    : 'Pin received! Letting the boss confirm the delivery range for you, one moment ❤️';
  needEscalate = true;
}

return [{ json: { phone: me.phone, reply, needEscalate, msgId: me.msgId } }];`;

// 替换 Router / Context Builder / Post-process / AI prompt
put('Get Customer', { parameters: { ...byName['Get Customer'].parameters } });
nodes.unshift(codeNode('Router', 'v3-router', ROUTER_CODE, [-4400, -400]));
nodes.push(codeNode('Context Builder', 'v3-context', CONTEXT_CODE, [-1720, -1000]));
nodes.push(codeNode('Post-process', 'v3-postprocess', byName['Post-process'].parameters.jsCode
  .replace(/\$\('Debounce Gate'\)/g, "$('Message Gate')"), [-1180, -1000]));
put('AI Agent', {
  parameters: { ...byName['AI Agent'].parameters, options: { systemMessage: SYSTEM_PROMPT } },
});
put('Pin Reply Builder', { parameters: { jsCode: PIN_CODE } });

// ── 新节点：lead 状态机 + 首触话术 + 防抖 ──────────────
nodes.push({
  parameters: {
    method: 'POST',
    url: `${SITE}/api/n8n/lead`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendBody: true,
    specifyBody: 'json',
    // text 必须传：服务端把它压进未处理缓冲，等胜出的那次执行一并取走 ——
    // 这是「客户连发三条，AI 看到全部而不是只看最后一句」的关键。
    jsonBody: '={{ JSON.stringify({ action: "touch", phone: $json.phone, lang: $json.lang, intent: $json.intent, name: $json.profileName, text: $json.text }) }}',
    options: {},
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [-3900, -900],
  id: 'v3-lead-touch', name: 'Lead Touch', onError: 'continueRegularOutput',
  retryOnFail: true, maxTries: 2, credentials: CRED_BEARER,
});
nodes.push(ifNode('IF 新对话?', 'v3-if-new', '={{ $json.newSession }}', '', [-3660, -900]));
nodes.push(httpNode('Get Menu Greet', 'v3-menu-greet', `${SITE}/api/n8n/menu`, [-3420, -1060]));
nodes.push(httpNode('Get Customer Greet', 'v3-cust-greet',
  `=${SITE}/api/n8n/customer?phone={{ $('Router').first().json.phone }}`, [-3180, -1060]));
nodes.push(codeNode('Greeting Builder', 'v3-greeting', GREETING_CODE, [-2940, -1060]));
nodes.push(waText('Send Greeting', 'v3-send-greet', '={{ $json.phone }}', '={{ $json.reply }}', [-2700, -1060]));
nodes.push({
  // ⚠️ unit 必须显式写 'seconds'。n8n Wait 节点省略 unit 时不按秒算 ——
  // 漏了这一行就是「客户等 8 小时才收到回复」，而且没有任何报错。
  parameters: { amount: 8, unit: 'seconds' },
  type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [-3420, -740],
  id: 'v3-wait', name: 'Wait 防抖', webhookId: 'b2f1e7a0-v3wa-4a00-9c00-bowlmamav300',
});
// sinceTs = 本次执行那条消息的时间戳；consume=1 = 「确认我是最新的话，把缓冲里
// 攒下的消息一并给我并清空」。判定与取走在服务端同一次调用里原子完成 —— 分成两步
// 会让先到的失败者把缓冲吃掉再退出，真正的胜出者反而拿不到前几条。
nodes.push(httpNode('Lead Recheck', 'v3-lead-recheck',
  `=${SITE}/api/n8n/lead?phone={{ $('Router').first().json.phone }}&sinceTs={{ $('Lead Touch').first().json.lead.lastMsgMs }}&consume=1`,
  [-3180, -740]));
nodes.push(codeNode('Message Gate', 'v3-gate', GATE_CODE, [-2940, -740]));

// ── 团餐档期工具（给 AI 用）──────────────────────────
nodes.push({
  parameters: {
    toolDescription: '查询某一天厨房还能接几份（团餐报价前必须先查）。输入 date=YYYY-MM-DD。返回 booked/remaining/canQuote/reason，canQuote=false 就不要当场承诺。',
    url: `${SITE}/api/n8n/capacity`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpBearerAuth',
    sendQuery: true,
    parametersQuery: {
      values: [{ name: 'date', valueProvider: 'modelRequired' }],
    },
    optimizeResponse: true,
  },
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest', typeVersion: 1.1, position: [-1420, -640],
  id: 'v3-tool-capacity', name: 'check_capacity', credentials: CRED_BEARER,
});

// ── 求救抄送 Telegram（老板要求）────────────────────
nodes.push({
  parameters: {
    chatId: '={{ $env.TELEGRAM_OWNER_CHAT_ID || "REPLACE_WITH_CHAT_ID" }}',
    text: '=🚨 [碗妈求救] 客户 {{ $json.phone }}\n\n客户原话：{{ $json.customerMsg }}\n\n（WhatsApp 上已发同样的警报，长按那条引用回复即可转达）',
    additionalFields: {},
  },
  type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [-700, -700],
  id: 'v3-tg-escalate', name: 'Boss Alert Telegram', webhookId: 'b2f1e7a0-v3tg-4a00-9c00-bowlmamav300',
  onError: 'continueRegularOutput', credentials: CRED_TELEGRAM,
});

// ── 连线 ───────────────────────────────────────────────
const conn = (from, to, out = 0) => {
  main[from] = main[from] || { main: [] };
  while (main[from].main.length <= out) main[from].main.push([]);
  main[from].main[out].push({ node: to, type: 'main', index: 0 });
};
const main = {};

conn('Webhook', 'Guard - 过滤status');
conn('Guard - 过滤status', 'Router');
conn('Router', 'Main Switch');
// Main Switch 输出顺序与 v2 一致：0 客户文字 / 1 老板转达 / 2 图片 / 3 定位 / 4 语音 / 5 老板直发 / 6 兜底
conn('Main Switch', 'Lead Touch', 0);
conn('Main Switch', 'Boss Lookup', 1);
conn('Main Switch', 'Get Pending Draft', 2);
conn('Main Switch', 'Image Auto Reply', 2);
conn('Main Switch', 'Zone by Pin', 3);
conn('Main Switch', 'Audio Reply', 4);
conn('Main Switch', 'Boss Direct Ignore', 5);
conn('Main Switch', 'Fallback Reply', 6);

// 首触：秒回确定性话术
conn('Lead Touch', 'IF 新对话?');
conn('IF 新对话?', 'Get Menu Greet', 0);
conn('Get Menu Greet', 'Get Customer Greet');
conn('Get Customer Greet', 'Greeting Builder');
conn('Greeting Builder', 'Send Greeting');
conn('Send Greeting', 'Log Chat');

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
conn('Send Reply', 'Log Chat');
conn('Send QR', 'Log Chat');
conn('Send Dish Image', 'Log Chat');
conn('Boss Alert', 'Send安抚');
conn('Boss Alert', 'Boss Alert Telegram');
conn('Send安抚', 'Log Escalation');

// 图片 / 定位 / 老板支线：与 v2 完全一致
conn('Get Pending Draft', 'Image Forward');
conn('Image Forward', 'Log Image Escalation');
conn('Zone by Pin', 'Pin Reply Builder');
conn('Pin Reply Builder', 'Send Pin Reply');
conn('Pin Reply Builder', 'Need Pin Escalate');
conn('Need Pin Escalate', 'Pin Boss Alert');
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
conn('Send Solution', 'Need Send QR');
conn('Need Send QR', 'Boss Send QR', 0);
conn('Need Send QR', 'Log Boss Reply', 1);
conn('Boss Send QR', 'Log Boss Reply');

// AI 的子连接
main['Gemini Chat Model'] = { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] };
main['Window Buffer Memory'] = { ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]] };
main['check_delivery_fee'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };
main['create_order_draft'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };
main['check_capacity'] = { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] };

const v3main = {
  name: 'Bowlmama v3 — 链接成交 + 自动追单 + 团餐',
  nodes, pinData: {}, connections: main, active: false,
  settings: { executionOrder: 'v1' }, meta: v2.meta, tags: [],
};

// ════════════════════════════════════════════════════════════
// v3-followup —— 追单 cron
// ════════════════════════════════════════════════════════════
const NUDGE_CODE = `// ============================
// 追单文案。两次，内容必须不一样 —— 同一句话发第二遍就是骚扰。
//   第 1 次（客户消息 +35 分钟）：轻推，给链接 + 「回 1 我帮你落单」
//   第 2 次（当晚 21:00）：换角度，强调「今晚订，明天中午准时到」
// 时点全部由服务端 /api/n8n/lead 算好（含静默时段保护和 24h 窗口判断），
// 这里只负责把字写好 —— 排程逻辑有 35 条断言在 scripts/dogfood-wa-lead.mts。
// ============================

const out = [];
for (const item of $input.all()) {
  const leads = item.json.leads || [];
  for (const l of leads) {
    const zh = l.lang !== 'en';
    const token = l.clickToken ? ('&lead=' + l.clickToken) : '';
    const url = (zh ? 'https://www.incredibowl.my/o?ref=wa' : 'https://www.incredibowl.my/en/o?ref=wa') + token;
    const first = l.nudgeIndex === 1;
    let text;

    if (l.intent === 'catering') {
      text = zh
        ? (first
          ? '亲，刚才的团餐碗妈这边随时可以帮你排 😊 把「哪天几点 + 几位 + 送到哪」告诉碗妈，马上给你报价 ❤️'
          : '晚上好～团餐那边还需要碗妈帮忙吗？档期先到先排，定下来碗妈就帮你锁住 ❤️')
        : (first
          ? 'Hi! BowlMama can still take your group order 😊 Just tell me the day + time, how many people, and the address — quote comes right back ❤️'
          : 'Evening! Still need BowlMama for the group order? Slots go first-come — say the word and I will lock yours ❤️');
    } else {
      text = zh
        ? (first
          ? '亲，刚才那几道还在哦 😊 点这里 30 秒就能下单 👇\\n' + url + '\\n\\n不想点链接也行，回「1」碗妈直接帮你落单 ❤️'
          : '晚上好呀～今晚订，明天中午就准时送到你手上 🍲\\n' + url + '\\n\\n（每天早上 6 点截单，别错过咯 ❤️）')
        : (first
          ? 'Hi! Those dishes are still available 😊 Tap here, 30 seconds to order 👇\\n' + url + '\\n\\nDon\\'t like links? Just reply "1" and BowlMama will place it for you ❤️'
          : 'Evening! Order tonight and it arrives right on time tomorrow lunch 🍲\\n' + url + '\\n\\n(Orders close 6:00 AM — don\\'t miss it ❤️)');
    }
    out.push({ json: { phone: l.phone, text, nudgeIndex: l.nudgeIndex, lang: l.lang, intent: l.intent } });
  }
}
return out;`;

const followup = {
  name: 'Bowlmama v3 — 自动追单（每 15 分钟）',
  nodes: [
    {
      parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } },
      type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-600, 0],
      id: 'v3f-cron', name: 'Every 15 min',
    },
    httpNode('Fetch Due Leads', 'v3f-due', `${SITE}/api/n8n/lead?action=due`, [-380, 0]),
    codeNode('Build Nudge', 'v3f-build', NUDGE_CODE, [-160, 0]),
    waText('Send Nudge', 'v3f-send', '={{ $json.phone }}', '={{ $json.text }}', [60, 0]),
  ],
  pinData: {},
  connections: {
    'Every 15 min': { main: [[{ node: 'Fetch Due Leads', type: 'main', index: 0 }]] },
    'Fetch Due Leads': { main: [[{ node: 'Build Nudge', type: 'main', index: 0 }]] },
    'Build Nudge': { main: [[{ node: 'Send Nudge', type: 'main', index: 0 }]] },
  },
  active: false, settings: { executionOrder: 'v1' }, meta: v2.meta, tags: [],
};

// ════════════════════════════════════════════════════════════
// v3-error —— 报错 Telegram
// ════════════════════════════════════════════════════════════
const errV2 = JSON.parse(readFileSync(join(DIR, 'bowlmama-v2-error-handler.json'), 'utf8'));
const v3err = JSON.parse(JSON.stringify(errV2));
v3err.name = 'Bowlmama v3 — Error Handler';

writeFileSync(join(DIR, 'bowlmama-v3-main.json'), JSON.stringify(v3main, null, 2), 'utf8');
writeFileSync(join(DIR, 'bowlmama-v3-followup.json'), JSON.stringify(followup, null, 2), 'utf8');
writeFileSync(join(DIR, 'bowlmama-v3-error.json'), JSON.stringify(v3err, null, 2), 'utf8');

console.log(`✅ v3-main      ${v3main.nodes.length} 节点（v2 是 ${v2.nodes.length}）`);
console.log(`✅ v3-followup  ${followup.nodes.length} 节点`);
console.log(`✅ v3-error     ${v3err.nodes.length} 节点`);
