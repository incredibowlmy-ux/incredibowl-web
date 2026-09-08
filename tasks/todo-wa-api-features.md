# WhatsApp Cloud API 功能扩展计划（2026-09-08，交 Opus 执行）

> 来源：老板 09-08 晚问「is it possible to implement whatsapp business api features into this」，
> 我给了能力清单，老板说「make a plan, i will use opus to execute it」。
> 本文 = 执行规格。每条写清改哪个文件、怎么验、老板要做什么。**任何一条与现状对不上，停下来问，别硬改。**

---

## 零、前提与铁律（先读完再动手）

### 现状（09-08 21:48 MYT 核实）
| 事实 | 证据 |
|---|---|
| 进站链路：Meta → `src/app/api/wa/webhook/route.ts`（验签/拆包/去重/限流/接管）→ n8n `whatsapp-receive` | 文件头注释 |
| **`statuses` 事件在 relay 被直接丢掉**（`splitInbound` 跳过；`!inbound.length` 立即 200） | `src/lib/waWebhook.ts:64-91`、route.ts `if (!inbound.length)` |
| `message_template_status_update` 已订阅但 relay `ch.field !== 'messages'` 直接跳过 | `_cutover-v4.mjs:39`、waWebhook.ts `splitInbound` |
| 网站出站只有纯文本：`src/lib/waSend.ts` → `sendText()`；用 `WA_ACCESS_TOKEN`（已在 Vercel Production，sensitive，读不回来）+ `WA_PHONE_NUMBER_ID`（默认 `1019276584602589`） | waSend.ts |
| `Turn = { role, text, ts }`，`appendTurn` 会**剥掉任何多余字段**；n8n 的 `reply` action 不带 message id；入站 turn 也不存 msg id | waWebhook.ts `appendTurn`、lead/route.ts `action === 'reply'` |
| 收件箱 = Desktop dashboard `page-inbox`，后端 `/api/admin/wa-lead`（op list/get/read/send/human/release/note/close），需 Firebase admin ID token + CORS `*` | route.ts 头注释、dashboard 8807–9090 行 |
| n8n 里已有交互按钮的发法（httpRequest + 预定义 WhatsApp 凭据直打 Graph，`type:'interactive'`） | `scripts/build-n8n-v4.mjs:72-80, 459-465` |
| 菜品图：`public/*.webp`（Meta 图片消息**不收 webp**）；`public/meta-jpg/*.jpg` 是给目录用的 jpg 副本，线上可直接 `https://www.incredibowl.my/meta-jpg/<slug>.jpg` | `ls public`、`ls public/meta-jpg` |
| `/api/n8n/menu` **没有** image 字段 | grep 为空 |
| Meta business id `4383381675320005`（Incredibowl_MY），WhatsApp App ID `2144351003028721` | memory `project_meta_catalogue_feed`、`project_chatbot_v4_plan` |
| WABA id **未知**（代码里没有），Phase B 要先取 | grep waba 为空 |
| 老板每周菜单 broadcast 现在是**手机手发**，有固定英文模板 | memory `project_weekly_broadcast_template` |
| dogfood 现状：wa-webhook 72、wa-lead 37、wa-send 10、n8n-auth 14 | `scripts/dogfood-*.mts` |

### 铁律（违者返工）
- **所有 push 要老板明确同意**。改完 commit 在分支 `feat/wa-api`（从 `origin/main` 切，**不要从本地 main 切**——本地 main 常有并行 session 的 commit）。push 前单独跑 `git log origin/main..feat/wa-api` 亲眼读完。
- **relay 改动只在低峰 push**（20:30 之后或 06:00 之前，`date` 先看钟）：relay 出错 = 客户消息静默消失，白天不冒这个险。push 后 5 分钟内用测试号 `60165119118` 发一条真消息看 bot 回。
- push 前必跑：`npx tsc --noEmit` → `npm run build` → 相关 dogfood → `node --check` 抠 dashboard script（见 memory `project_dashboard_js_verification`）。
- Dashboard 源头是 **Desktop** `C:\Users\User\Desktop\Incredibowl Services\incredibowl-dashboard.html`，改完 `npm run sync:dashboard`。新接口必须 CORS `*` + OPTIONS（照抄 wa-lead/route.ts 的 `corsify`）。
- **凡是改 Meta 生产状态的 POST（商家资料、会话组件、建模板、群发），Claude 的 auto 模式分类器会拦，口头授权无效** → 写成脚本让老板自己跑。脚本**只从环境变量读 token**（`$env:WA_ACCESS_TOKEN='…'; node scripts/xxx.mjs`），绝不读文件、绝不把 token 打到 stdout。
- 不猜 Meta 的行为：本文里标「⚠️验证」的点是我不 100% 确定的，执行时用测试号实测，结果写进「结果」节。
- n8n JSON 只能改 `scripts/build-n8n-v4.mjs` 再生成，绝不手改 JSON；改完 `node scripts/validate-n8n-workflows.mjs` + `node scripts/verify-n8n-v3.mjs v4`。n8n 后台改动要老板自己点（或老板跑脚本），参考 `_fix-v4-tool-auth.mjs` 的写法（PUT → deactivate → activate）。

### 分期
| Phase | 内容 | 要 Meta 审核? | 估时 |
|---|---|---|---|
| A | 送达/已读回执、已读+正在输入、图片/文件、按钮/列表、引用回复、入站媒体查看、会话组件、商家资料 | 否 | 2–3 天 |
| B | 模板消息：取 WABA、提交 3 个模板、窗口外用模板回复、每周菜单群发 + 退订 | **是** | 提交 0.5 天 + 等审核 + 群发 1.5 天 |
| C | Flows（对话内表单下单）、商品目录消息 | 部分 | 只做前置调研，不实施 |

**执行顺序：A1 → A2 → B1（先提交模板，审核要排队）→ A3 → A4 → A6/A7 → A5 → B2 → B3。**

---

## Phase A · 不用审核的能力

### A0 · 数据模型：给 Turn 加可选字段（A1/A2/A3/A5 的地基）
文件：`src/lib/waWebhook.ts`
- `Turn` 加可选：`msgId?: string`（Meta wamid）、`status?: 'sent'|'delivered'|'read'|'failed'`、`err?: string`（failed 时的 Meta 错误短句 ≤120 字）、`media?: { kind: 'image'|'document'|'audio'|'video'; id?: string; link?: string; mime?: string; filename?: string }`、`replyTo?: string`（引用的 wamid）。
- `appendTurn(prev, role, text, ts, extra?)`：第 5 个参数 `extra` 只允许上面这些 key；**清洗旧数组时保留这些字段**（现在的 map 只留 role/text/ts，必须改）。文本仍 ≤600 字、总量仍 ≤200 条。
- 新纯函数 `applyStatus(turns, msgId, status, err?, now)`：找 `msgId` 相同的 turn；状态**单调**：`sent < delivered < read`，`failed` 可覆盖任何状态；找不到返回原数组引用（调用方据此跳过写库）。
- 新纯函数 `splitStatuses(payload)` → `{ recipient: string; msgId: string; status: string; ts: number; errCode?: number; errTitle?: string }[]`（从 `value.statuses[]` 取，`errors[0].code/title`）。
- 新纯函数 `splitTemplateEvents(payload)` → `{ name, event, reason }[]`（`field === 'message_template_status_update'`）。
- 相应改：relay 写入站 turn 时带 `{ msgId: im.msgId, media }`；`/api/n8n/lead` 的 `reply` action 接受可选 `msgId`；`/api/admin/wa-lead` 的 `send` 把 `sent.msgId` 写进 turn。
- dogfood：`scripts/dogfood-wa-webhook.mts` 加 ≥12 条：extra 字段保留、旧数组清洗保留 msgId、状态单调（read 后收到 delivered 不退回）、failed 覆盖、找不到返回同一引用、splitStatuses 多条/空/无 errors、splitTemplateEvents。

### A1 · 送达 / 已读 / 失败回执（statuses webhook）
文件：`src/app/api/wa/webhook/route.ts`、Desktop dashboard
- POST 里在 `splitInbound` 之后：`const statuses = splitStatuses(payload)`；`if (!inbound.length && !statuses.length) return 200`；statuses 在 `after()` 里逐条 `handleStatus()`。
- `handleStatus`：`waLeads/{recipient}` 事务读 → `applyStatus` → 有变化才 `tx.set({turns}, {merge:true})`。老板号码（`WA_BOSS_PHONE`）的回执直接忽略。
- **failed**：除了写 turn，发 Telegram 报警（`sendTelegramAlert`，key `wafail:${recipient}`，附错误码+title+原文前 80 字）。常见码要给人话：`131047` 24h 窗口外、`131026` 对方不是 WhatsApp 用户/拉黑、`130472` 用户在实验组、`131049` Meta 限流营销消息。
- Meta 会重试 statuses → `applyStatus` 天然幂等，不用记 seen id。
- 收件箱：`renderInboxMsgs` 出站气泡（out/boss/nudge）右下角加 tick：无 status 或 sent `✓`、delivered `✓✓`、read `✓✓` 蓝色、failed `⚠` 红 + `title` 显示 `err`。CSS 加 `.inbox-tick.read{color:#34b7f1}` `.inbox-tick.failed{color:var(--danger)}`。
- **A1b（n8n 侧，可选但值得）**：让 bot 发的消息也有 tick。`build-n8n-v4.mjs` 里 5 个 `Log Reply ·` 节点的 body 加 `msgId: {{ $json.messages?.[0]?.id || '' }}`。⚠️验证：先在 n8n 用 `/api/v1/executions?includeData=true` 看一次真实执行，确认每个 Send 节点的输出 JSON 里 `messages[0].id` 在什么路径（httpRequest 直打 Graph 的是 `$json.messages[0].id`；n8n WhatsApp 节点可能不同），对不上就只改能确认的节点。改完生成 JSON → validate/verify → 老板跑 PUT+republish 脚本（照 `_fix-v4-tool-auth.mjs`）。
- 验证：dogfood；本地 `curl` 打 `/api/wa/webhook` 假 statuses（要用 `WA_APP_SECRET` 算签名——本地 `.env.local` 没这个值就 `vercel env pull` 不到，**用 dev 环境临时 secret 起 `next dev`**）；线上：收件箱发一条给测试号 → 10 秒内气泡从 ✓ 变 ✓✓，测试机打开对话后变蓝。

### A2 · 已读回执 + 正在输入
文件：`src/lib/waSend.ts`、`src/app/api/wa/webhook/route.ts`、`src/app/api/admin/wa-lead/route.ts`
- `waSend.ts` 新增 `markRead(msgId: string, opts?: { typing?: boolean })`：POST `/{phone_number_id}/messages` body `{ messaging_product:'whatsapp', status:'read', message_id, ...(typing ? { typing_indicator: { type:'text' } } : {}) }`。未配 token → `{ok:false, configured:false}` 不打网络；网络错误**只 console.warn 不抛**；`AbortSignal.timeout(3000)`。
- relay `handleOne`：在 `forwardToN8n` **之前**、事务之后，条件 `!isBoss && !silent && !decision.duplicate && !decision.throttled && !decision.human` → `void markRead(im.msgId, { typing: true })`（不 await，不阻塞转发；n8n 发出回复时 Meta 自动撤掉输入中，最长 25 秒）。**接管中不标已读**：让客户看到的状态诚实反映「老板还没看」。
- `/api/admin/wa-lead` `op:'read'`：找出 `ts > bossReadAtMs` 的入站 turn 的 msgId，对**最后一条**调 `markRead(msgId)`。⚠️验证：Meta 文档说标最后一条会连带前面的一起变蓝，用测试机发 3 条再在收件箱打开，看是否 3 条全蓝；若只有最后一条蓝就循环全部（上限 10 条）。
- dogfood-wa-send 加：未配 token 时 markRead 不打网络；typing 参数决定 body 里有没有 `typing_indicator`（把 fetch 抽成可注入的 `deps.fetch` 或用 `globalThis.fetch` mock）。
- 验证线上：测试机发一句 → 立刻双蓝勾 + 「正在输入…」→ bot 回复。接管中发一句 → 不变蓝，收件箱打开后才蓝。

### A3 · 收件箱发图片 / 文件；查看客户发来的媒体
文件：`src/lib/waSend.ts`、`src/app/api/admin/wa-lead/route.ts`、新 `src/app/api/admin/wa-media/route.ts`、dashboard
- `waSend.ts` 新增 `sendMedia(to, { kind:'image'|'document', link, caption?, filename? })`：`type: kind`，`[kind]: { link, caption, filename }`。link 必须是公网 https。返回 `{ok,msgId}` 同 sendText。
- wa-lead `op:'send'` 扩展：body 可带 `media: { kind, link, caption, filename }`，有 media 走 sendMedia，turn 文本 `[图片] caption` / `[文件] filename`，turn.media 记 `{kind, link}`。24h 窗口 / 接管逻辑不变。
- 收件箱 composer 加「📎」按钮 → 小面板：(1) **本周菜品图**：从 `state` 里已加载的菜单/或直接列 `public/meta-jpg/*.jpg` 的 slug 表（执行时确认 dashboard 有没有菜品 slug 列表可用；没有就在 `/api/admin/wa-lead` 加 `op:'assets'` 读 `weeklyMenu.ts` 本周菜 id→`https://www.incredibowl.my/meta-jpg/<slug>.jpg`，先 `HEAD` 确认线上 200 再列出）；(2) 任意 https 链接（图或 PDF）+ 文件名；(3) 说明文字。
- **入站媒体查看**：relay 写入站 turn 时若 `msg.image/document/audio/video` 存在，`media = { kind, id: msg[kind].id, mime: msg[kind].mime_type, filename }`。新路由 `GET /api/admin/wa-media?id=<mediaId>`（admin token 鉴权 + CORS）：`GET graph/{id}` 拿 `url` → 带 bearer 再 GET → 以原 mime 流回（`Cache-Control: private, max-age=3600`；Meta 媒体 URL 5 分钟过期，所以每次都走这条代理）。收件箱入站气泡有 `media.kind==='image'` 就 `<img src="/api/admin/wa-media?id=…">`（要带 Authorization 头 → 用 `fetch` + blob URL，别直接 img src），document 显示下载链接。⚠️ Desktop 版是 file:// 打的，fetch 带 header 要走 `callAdminAPI` 同款的 token 逻辑。
- 验证：测试机发一张图 → 收件箱能看；从收件箱发菜品图 + 说明 → 手机收到。dogfood-wa-send 加 sendMedia body 形状 3 条。

### A4 · 收件箱发交互按钮 / 列表
文件：`src/lib/waSend.ts`、`src/app/api/admin/wa-lead/route.ts`、dashboard
- `waSend.ts` 新增 `sendInteractive(to, payload)`，两种：
  - buttons：`{ type:'button', body:{text}, action:{ buttons:[{type:'reply', reply:{id,title}}] } }`，**≤3 个、title ≤20 字符**；
  - list：`{ type:'list', body:{text}, action:{ button:'选择', sections:[{ title, rows:[{id,title(≤24),description?(≤72)}] }] } }`，**总 rows ≤10**。
  - 服务端硬校验上限（超了 400 拒），别指望 Meta 的报错可读。
- wa-lead `op:'send'` 扩展 `interactive: {...}`；turn 文本 = body + `〔按钮：a｜b｜c〕` 或 `〔列表：n 项〕`。
- 客户点按钮 → Meta 回 `interactive.button_reply` → relay 现有 `describeInboundForTurn` 已当文字处理，转 n8n 也已兼容（`isTextLike`）。**接管中**客户点按钮会走 `human_forward` 转老板原文，符合预期。
- 收件箱 composer 加「🔘 按钮」模式：正文 + 3 个可选 title 输入；「📋 列表」模式：正文 + 每行一项（`标题|描述`）。id 自动生成 `ib_<n>`。
- 验证：dogfood 校验上限 5 条；线上测试号收到按钮、点击后收件箱出现客户气泡 = 按钮标题。

### A5 · 引用回复 + 表情回应（低优先，做完 A1–A4 再做）
- `sendText/sendMedia/sendInteractive` 都接受 `replyTo?: string` → body 加 `context: { message_id }`。收件箱气泡 hover 出「↩ 回复」，选中后 composer 顶部显示引用条；turn 记 `replyTo`，渲染时在气泡上方显示被引用文本前 60 字（按 msgId 在 turns 里找）。
- `sendReaction(to, msgId, emoji)`：`type:'reaction', reaction:{message_id, emoji}`。收件箱入站气泡 hover 出 👍❤️😂 三个；不记 turn（Meta 也不给回执）。
- 入站 reaction 现在是 `SILENT_TYPES` 不记录——保持不变。

### A6 · 会话组件（冰破问句 + 指令）——老板跑脚本
文件：新 `scripts/wa-setup.mjs`（子命令 `profile` / `automation` / `show`），只读 `process.env.WA_ACCESS_TOKEN`。
- `show`：GET `/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status` + GET `/{phone_number_id}/conversational_automation` + GET `/{phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,websites,vertical` → 打印。**先跑这个，把 quality_rating / messaging_limit_tier 写进本文「结果」节**（B3 群发要看它）。
- `automation`：POST `/{phone_number_id}/conversational_automation` body `{ enable_welcome_message: true, prompts: [≤4 条, 每条 ≤80 字], commands: [{command_name(≤32, 无斜杠), command_description(≤256)}] }`。
  - 冰破（只在客户**首次**打开对话时显示，⚠️验证 老旧对话看不到是正常的）：`今天有什么菜？` / `What's on the menu today?` / `送到我这里多少运费？` / `我要下单 🛒`。点了 = 以纯文本发出 → relay → n8n AI 正常答。
  - 指令：`menu`「今日/本周菜单」、`order`「直接下单链接」、`fee`「查运费」、`human`「找碗妈真人」。客户发出的是 `/menu` 这种文本 → **要在 `build-n8n-v4.mjs` 的 SYSTEM_PROMPT 加一段**：「客户发 `/menu` `/order` `/fee` `/human` 时分别等价于问菜单 / 要下单链接 / 问运费 / 要求人工」。这是 n8n 改动 → 生成 → 老板 republish。
  - 文案先列在本文「老板动作」让老板改一遍再跑。
- `profile`：POST `/{phone_number_id}/whatsapp_business_profile` `{ messaging_product:'whatsapp', about, address, description, email, websites:['https://www.incredibowl.my'], vertical:'RESTAURANT' }`。内容从 memory 拿：厨房 Pearl Suria（`project_kitchen_location_pearl_suria`），品牌线「家的味道 · 新鲜采购 · 每日精选」。头像上传要 resumable upload 拿 handle，**本轮不做**（老板手机改一次就行）。
- 脚本先 `show` 打印现值、再问 `--apply` 才写；没 `--apply` 只 dry-run。

### A7 · 模板审核结果推 Telegram（顺手，10 分钟）
relay POST 里 `splitTemplateEvents(payload)` → 每条 `sendTelegramAlert('📄 模板 <name>：<event>（<reason>）')`。为 B 铺路。

---

## Phase B · 模板消息（要 Meta 审核）

### B1 · 取 WABA id + 提交模板（老板跑脚本）
文件：新 `scripts/wa-templates.mjs`（子命令 `waba` / `list` / `submit <name>` / `delete <name>`），只读 env token。
- `waba`：GET `/4383381675320005/owned_whatsapp_business_accounts` → 打印 id/name；找不到再试 `client_whatsapp_business_accounts`。老板把 id 加 Vercel：`npx vercel env add WA_WABA_ID production`（不敏感，Config 即可）。也写进本文。
- `list`：GET `/{waba}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100`。
- `submit`：POST `/{waba}/message_templates`。三个模板（**先给老板看文案再提交**；Meta 对「变量占比过高」「营销味太重的 UTILITY」会拒）：
  1. `weekly_menu_v1` · MARKETING · en ：
     - BODY：`Hi {{1}} 😊 wei ting from Incredibowl here. Next week's menu ({{2}}) is ready — {{3}}. Freshly cooked every morning, no MSG, less oil & salt. Order before 6:00 AM for same-day delivery. Reply STOP anytime to unsubscribe.`
     - `{{3}}` 例：`new this week: Honey Lemon Chicken Chop & Lemon Salmon`（≤120 字，脚本里截断）
     - BUTTONS：URL `See menu & order` → `https://www.incredibowl.my/o?src=wa_weekly`（静态 URL，不带动态参数，过审更稳）
     - example 值必填（Meta 审核看 example）。
  2. `order_confirmed_v1` · UTILITY · zh_CN + en 各一：
     - zh：`你好 {{1}}，订单 #{{2}} 已收到 ✅ 送达：{{3}}。有问题直接回复这条消息。`
     - en：`Hi {{1}}, order #{{2}} is confirmed ✅ Delivery: {{3}}. Reply here if anything changes.`
     - 用途：B2 之后可接进付款成功通知链（`project_order_notification_gap`），**本轮只提交不接线**。
  3. `window_reopen_v1` · UTILITY · zh_CN + en：
     - zh：`你好 {{1}}，碗妈这边有关于你订单/询问的更新，回复任意内容我们继续聊 😊`
     - en：`Hi {{1}}, BowlMama has an update on your order/enquiry — reply anything and we'll continue 😊`
     - 用途：收件箱窗口过期时唯一能发的东西。⚠️ Meta 可能判它 MARKETING 而非 UTILITY（会自动重分类），接受即可，只是贵一点。
- 审核结果由 A7 推 Telegram；`list` 也能看。

### B2 · 窗口外用模板回复（收件箱）
- `waSend.ts` 新增 `sendTemplate(to, name, lang, bodyParams: string[])` → `type:'template', template:{ name, language:{code}, components:[{type:'body', parameters: bodyParams.map(text=>({type:'text',text}))}] }`。
- `/api/admin/wa-lead` 新 op `templates`：GET Meta `status=APPROVED` 列表，**服务端缓存 10 分钟**（模块级变量），回 `[{name, lang, bodyText, paramCount}]`。
- `op:'send'` 加 `template: { name, lang, params }` 分支：**不看 24h 窗口**；turn 文本 = 把 params 填回 bodyText；自动接管照旧。
- 收件箱：窗口过期时 composer 不再只显示「只能你手机直接发」，改成模板选择器 + 参数输入 + 预览；发送按钮文案「发模板」。没有已过审模板 → 显示「还没有过审模板（B1）」。
- 环境变量：`WA_WABA_ID`。没配 → op templates 回 `[]` + `configured:false`。

### B3 · 每周菜单群发 + 退订（B1 过审 + 老板拍板成本后才做）
- **先算钱**：执行时去 Meta 定价页查马来西亚 Marketing / Utility 每条单价（2025-07 起按条计费），写进本文；老板看了数字再决定。**我不确定单价，别拿印象填。**
- **发送上限**：A6 `show` 打出的 `messaging_limit_tier`（新号通常 250 个唯一客户/24h，要 business verification 才升 1K）。名单超过上限脚本要分天发。
- 退订：relay 里 `describeInboundForTurn` 之前判 `/^\s*(stop|停止|退订|unsubscribe)\s*$/i` → `waLeads.optOut = true` + turn sys「客户退订群发」+ 回一条固定文本「已为你退订每周菜单，随时回复 START 重新订阅」；`START` 反向。**此判定必须是 `waWebhook.ts` 纯函数 `parseOptOut(text)`** + dogfood。
- 名单来源：`waLeads` 里 `!optOut && status !== 'closed'` ∪ `users` 里有手机号的已付款客户（**老板确认这算不算有效 opt-in**——Meta 政策要求客户同意收营销消息；网站下单时没有勾选框。保守方案：只发给曾主动跟碗妈聊过的 `waLeads`）。
- 脚本 `scripts/wa-broadcast-weekly.mjs`：`--dry-run` 默认（列人数、预览一条填好参数的消息、估算费用）；`--send` 才发；每条间隔 300ms；结果写 `analytics/wa-broadcast/<date>.json`（phone, msgId, ok/err）；turn 记 `nudge`-类 role？→ **用新 role `bc`**（要在 `TurnRole` 加，`appendTurn` 白名单加，收件箱 `who` 表加「群发」）。msgId 写进 turn 后 A1 的回执会自动填 delivered/read → dashboard 能出「本周群发 送达率 / 已读率」（收件箱顶部一行即可，不做新页）。
- 参数 `{{1}}` 名字：`waLeads.name` → `users.displayName` → `there`；`{{2}}` 日期段、`{{3}}` 新菜：从 `weeklyMenu.ts` 算（复用 `project_weekly_broadcast_template` 的 🆕 段逻辑）。
- 老板自己跑 `--send`（分类器会拦）。

---

## Phase C · 只做调研，不实施
- **Flows**：对话内表单（选日期/菜/数量/地址）。前置：Flow 在 Meta 后台建、endpoint 要公钥加密（`flows_encryption`）、要 `WA_FLOW_PRIVATE_KEY`。写一页 `docs/wa-flows-scoping.md`：数据流、要加的路由、与 `/api/n8n/wa-order` 草稿工具的关系、估时。**不写代码。**
- **商品目录消息**：`catalog_id 1569013811243958` 能不能绑到 WABA → `GET /{waba}/product_catalogs`；能的话 `type:'interactive', interactive:{type:'product_list'}` 可直接发本周菜。只探路、记结果。

---

## 验证矩阵（每个 Phase 结束跑一遍）
| 项 | 命令 / 动作 |
|---|---|
| 类型 + 构建 | `npx tsc --noEmit` && `npm run build` |
| 纯函数 | `npx tsx scripts/dogfood-wa-webhook.mts`（≥84）、`dogfood-wa-send.mts`（≥20）、`dogfood-wa-lead.mts`、`dogfood-n8n-auth.mts` |
| dashboard | 抠 `<script>` → `node --check`；`renderInboxMsgs` 喂含 status/media/replyTo 的假 turns 进 vm，断言 tick/img/引用条 |
| n8n（若改） | `node scripts/build-n8n-v4.mjs` → `validate-n8n-workflows.mjs` → `verify-n8n-v3.mjs v4` → 老板 republish → 测试号发一条**进 AI 的**消息看到回复 |
| 线上 relay | push 后 5 分钟内测试号发文字 → bot 回；发图 → 收件箱可看；收件箱发文字/图/按钮 → 手机收到、tick 变化 |
| 未授权 | `curl -X POST https://www.incredibowl.my/api/admin/wa-lead -d '{"op":"templates"}'` → 403；`OPTIONS` → 204 带 `*` |

## 老板动作清单（Opus 做不了的）
1. 批 push（每个 Phase 一次，relay 改动低峰）。
2. 跑 `node scripts/wa-setup.mjs show`（先），改好文案后 `… automation --apply`、`… profile --apply`。
3. 跑 `node scripts/wa-templates.mjs waba` → `vercel env add WA_WABA_ID production` → 看过模板文案 → `… submit weekly_menu_v1` 等。
4. A1b / A6 指令段涉及 n8n → 跑 republish 脚本。
5. B3 之前拍板：群发名单口径（只发聊过的 vs 含所有下单客户）+ 看单价后决定要不要群发。
6. 遗留：删 n8n API key、Reset App Secret（v4 计划里的）。

## 明确不做（本轮）
- 头像上传（resumable upload）；语音/视频出站；多客服分配；WhatsApp Pay（马来西亚是否开放**未核实**）；把 order_confirmed 模板接进付款通知链（先过审再说）；Flows / 目录（只调研）。

## 文件改动清单（预估）
- 改：`src/lib/waWebhook.ts`、`src/lib/waSend.ts`、`src/app/api/wa/webhook/route.ts`、`src/app/api/admin/wa-lead/route.ts`、`src/app/api/n8n/lead/route.ts`、`scripts/build-n8n-v4.mjs`（A1b/A6）、`scripts/dogfood-wa-webhook.mts`、`scripts/dogfood-wa-send.mts`、Desktop dashboard（→ sync）
- 新：`src/app/api/admin/wa-media/route.ts`、`scripts/wa-setup.mjs`、`scripts/wa-templates.mjs`、`scripts/wa-broadcast-weekly.mjs`、`docs/wa-flows-scoping.md`
- 环境变量新增：`WA_WABA_ID`（B）。A 阶段不加新变量。

## 结果（2026-09-08 晚，分支 `feat/wa-api`，3 个 commit，**未 push**）

在独立 worktree `…/Temp/claude/wt-wa-api` 上做的 —— 主工作区当时正被另一个 session
占着（菜单运行时层，90 分钟内动了 20 个源文件），不能在那里切分支。

### 已做（代码全部本地就绪）
| commit | 内容 |
|---|---|
| `b14c0de` | A0 数据模型 + A1 回执 + A2 已读/输入中 + A3 媒体 + A4 按钮列表 + 收件箱 UI |
| `89d1a17` | B1 两个脚本（wa-setup / wa-templates）+ B2 窗口外发模板 |
| `ec32d80` | B3 前置 STOP 退订 + n8n 回传 wamid + 提示词认斜杠指令 |

### 验证（全绿）
| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过；新路由 `/api/admin/wa-media` 已进产物 |
| `npx eslint src --quiet` | 无 error |
| `dogfood-wa-webhook` | **122**（原 72，新增 41 条 A0/A1 + 9 条退订） |
| `dogfood-wa-send` | **38**（原 10） |
| `dogfood-wa-lead` / `dogfood-n8n-auth` | 37 / 14，未变 |
| dashboard 内联 script | `node --check` 通过（789KB） |
| dashboard 逻辑 | **47 条 vm 断言**（勾 8 / 气泡 10 / 发送组装 19 / 模板 10） |
| n8n | 重新生成后 `validate-n8n-workflows` + `verify-n8n-v3 v4` 全过；直接断言 5 个 Log Reply 都带 msgId、提示词含斜杠指令段 |

**没跑的一个**：`dogfood-n8n-v4-scripts` 要本地起服务 + Firebase 服务账号凭据，
我不读凭据文件。它跑的是 Code 节点逻辑，本次没碰任何 Code 节点。

### ⚠️验证 项的实际结论
- **n8n Send 节点的 msgId 路径**：已确认。5 个发送节点都是 `n8n-nodes-base.whatsApp`，
  而线上已在用的 waAlerts 映射就是从同类节点读 `$json.messages[0].id`（`Boss Alert`），
  说明形状对。仍写成 `|| ''`，万一不同也只是没勾，不会中断记录。
- **已读连带 / 冰破可见性 / 模板分类**：要真机与 Meta 后台才知道，等老板跑。
- **窗口内消息是否收费**：查到官方原文，**免费**——「All non-template messages are free…」
  且「Utility template messages sent within an open customer service window are free.」
  → 收件箱里老板手打的每一条回复都不花钱。来源 developers.facebook.com/docs/whatsapp/pricing。
- **马来西亚单价**：官方费率卡要下载 CSV/PDF，网页与互动版都不显示数字（JS 动态加载），
  **我没拿到官方数字**。第三方博客给的是营销 ≈ RM0.3467/条、utility ≈ RM0.0564/条，
  只能当数量级。群发前老板自己去 whatsappbusiness.com/products/platform-pricing 选
  Malaysia + MYR 看真数。详见 `docs/wa-flows-scoping.md`。

### 老板要做的（按顺序）
1. **批 push**。relay 改动建议低峰（20:30 后或 06:00 前）。push 后 5 分钟内用测试号
   `60165119118` 发一条，确认 bot 照常回。
2. `$env:WA_ACCESS_TOKEN='<token>'` 后跑 `node scripts/wa-setup.mjs show`
   —— 把 quality_rating / messaging_limit_tier 回填到下面空格里（群发要看）。
3. `node scripts/wa-templates.mjs waba` 拿 WABA id → `npx vercel env add WA_WABA_ID production`
   → 读一遍模板文案 → `node scripts/wa-templates.mjs submit all --apply`。审核结果自动推 Telegram。
4. 可选：`wa-setup.mjs automation --apply`（冰破+指令）、`profile --apply`（商家资料）。
5. n8n：重新导入 / republish v4 主流程 + 追单，bot 消息才有回执勾、才认斜杠指令。
6. 遗留（v4 那批）：删 n8n API key、Reset App Secret。

- A6 show 输出：quality_rating = ？ messaging_limit_tier = ？ name_status = ？（等老板跑）
- WABA id = ？（等老板跑）

### 本轮明确没做
B3 群发脚本本体（等模板过审 + 老板看过真实单价再拍板）；Flows / 目录消息（只写了
`docs/wa-flows-scoping.md` 调研）；头像上传；把订单确认模板接进付款通知链。
