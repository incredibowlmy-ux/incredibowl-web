# Bowlmama v4 部署手册（老板照着点就行）

> v4 = v3 的全部（链接成交 / 自动追单 / 团餐）+ 这次要的四样：
> **持久记忆**（跨天记得客户聊过什么）、**人工接管时 bot 闭嘴**、**消息不再静默丢失**
> （验签 / 拆包 / 去重 / 限流全在网站端 relay）、**客户备注 CRM**。追单第 1 次改成 **1 小时**。
>
> 现役是 v1「FB CAPI - WhatsApp CTWA Lead Capture」。v2 / v3 从未导入过，**不用导**——
> 直接导 v4 三件 + v2 的草稿工具（v4 沿用它）。

---

## 文件清单

| 文件 | 是什么 | 必须？ |
|---|---|---|
| `bowlmama-v4-main.json` | 主 workflow（替代 v1） | ✅ |
| `bowlmama-v4-followup.json` | 自动追单 cron（每 15 分钟；1 小时 + 21:00 两次） | ✅ |
| `bowlmama-v4-error.json` | 挂了自动 Telegram 报警 | 强烈建议 |
| `bowlmama-v2-draft-tool.json` | AI 的「建订单草稿」子 workflow（v4 沿用） | ✅ 现役没有，要导 |

> ⚠️ 前置：网站要先部署上线（本次 commit 里的 `/api/wa/webhook`、`/api/n8n/lead` 新动作、
> `/api/n8n/customer` 新字段、`/api/n8n/menu` 付款方式）。没上线的话 relay 不存在、
> 记忆和人工接管都是空转。

---

## 第 0 步：Vercel 环境变量（5 分钟，一次性）

Vercel → 项目 → Settings → Environment Variables，加这 5 个（Production）：

| 变量 | 值 | 从哪拿 |
|---|---|---|
| `WA_APP_SECRET` | Meta 应用密钥 | Meta for Developers → 你的 App → 设置 → 基本 → 应用密钥（点「显示」） |
| `WA_VERIFY_TOKEN` | 自己编一串（例：`bowlmama-verify-2026`） | 第 3 步 Meta 后台要填同一串 |
| `N8N_INBOUND_URL` | `https://n8n-e8dc.srv1458700.hstgr.cloud/webhook/whatsapp-receive` | n8n 主 workflow 的 Webhook 节点 Production URL |
| `N8N_INBOUND_SECRET` | 自己编一串长的（例：`openssl rand -hex 24` 的输出） | 第 1 步 n8n 凭据要填 `Bearer ` + 同一串 |
| `WA_BOSS_PHONE` | `60165014501` | 老板号码（限流豁免、不记对话） |

`TELEGRAM_BOT_TOKEN` / `TELEGRAM_OWNER_CHAT_ID` 已有，relay 报警复用。

加完 **Redeploy** 一次（环境变量不会热更新）。

## 第 1 步：导入 4 个 JSON（每个 2 分钟）

n8n → Workflows → ⋯ → Import from File，顺序：草稿工具 → v4-error → v4-followup → v4-main。

**导入「主 workflow」后，打开逐项核对：**

1. **凭据**：WhatsApp / Google Sheets / Gemini / N8N API Key 四种应自动挂上（凭据 id 与现役相同）。看到红色感叹号才需要手动重选。
2. **`Webhook` 节点** → Authentication 已设为 Header Auth → Credential 下拉 → **新建 Header Auth 凭据**：
   Name 填 `Authorization`，Value 填 `Bearer <你在第 0 步编的 N8N_INBOUND_SECRET>`（注意 `Bearer` 后有一个空格）。
   从此这个 URL 只有 relay 打得进来。
3. **`create_order_draft` 节点** → Workflow 下拉里**重新选**「Bowlmama v2 — 下单草稿工具」（跨实例导入 id 会变）。
4. **`Boss Alert Telegram` 节点** → 凭据选你的 Telegram Bot；chatId 读 `TELEGRAM_OWNER_CHAT_ID`，n8n 没这个变量就直接填数字。
5. **`Send Greeting Buttons` 节点**（还有追单 workflow 里的 `Send Nudge Buttons`）：这两个是 HTTP Request 直打 Meta Graph API 发按钮，
   Authentication 已设为「Predefined Credential Type → WhatsApp」。打开看一眼凭据是否挂上。
   **若 n8n 版本不支持在 HTTP 节点里选 WhatsApp 凭据**：改成 Header Auth，新建凭据 Name `Authorization`、Value `Bearer <WhatsApp 永久 token>`。
6. **`check_capacity` / `check_delivery_fee` / `remember_customer_fact`** 三个工具节点：确认参数里标「由模型提供」的项没有叹号。
7. **`Wait 防抖`** → 8 秒，单位 seconds（别改成小时）。

**Error Handler**：主 workflow → ⋯ → Settings → Error Workflow → 选「Bowlmama v4 — Error Handler」→ Save。追单 workflow 也照做。

## 第 2 步：先切 n8n（不动 Meta，30 秒）

1. 现役「FB CAPI - WhatsApp CTWA Lead Capture」→ **Inactive**
2. 「Bowlmama v4」→ **Active**；「Bowlmama v4 — 自动追单」→ **Active**

这时 Meta 还是直接打 n8n。因为 Webhook 开了 Header Auth，**Meta 的请求会被 n8n 拒掉（401）** ——
所以第 2 步和第 3 步要连着做，中间别停超过几分钟。

## 第 3 步：Meta 后台把 webhook 指向网站 relay（3 分钟）

Meta for Developers → 你的 App → WhatsApp → Configuration → Webhook → Edit：

- Callback URL：`https://www.incredibowl.my/api/wa/webhook`
- Verify token：第 0 步的 `WA_VERIFY_TOKEN`
- 点 Verify and save → 应显示成功（网站会回 hub.challenge）
- Webhook fields：确认 `messages` 仍是 Subscribed

从此：Meta → 网站 relay（验签 / 拆包 / 去重 / 限流 / 人工判定）→ n8n。

**回滚**（任何时候，30 秒）：Callback URL 改回 n8n 地址 + n8n Webhook 节点 Authentication 改回 None + v1 Active。

## 第 4 步：真机 smoke（20 分钟，拿你自己的非老板手机号测）

先跑 v3 手册里的 20 条（v4 全部保留），再跑下面 14 条 v4 新增：

1. **验签**：`curl -X POST https://www.incredibowl.my/api/wa/webhook -d '{}'` → 401；Telegram 一小时内最多一条「签名不对」报警
2. **去重**：正常发一条「hi」→ 只收到一条回复（Meta 偶尔重试，relay 会吃掉第二次）
3. **多条**：3 秒内连发「你好」「两份」「送 Pearl Suria」→ 只回一条，且同时回应了「两份」和「Pearl Suria」
4. **静默类型**：对碗妈的消息点 👍 表情、发一个贴纸 → **无回复**，n8n 执行记录无红
5. **跨天记忆**：今天问「当归鸡多少钱」，明天（或 06:00 之后）发「我昨天问的那道多少钱」→ 能答上，不反问
6. **开场按钮**：新号码发「hi」→ 开场白后跟一条 3 按钮消息；点「直接下单」→ 收到链接；点「找碗妈」→ 你收到求救警报
7. **人工接管（引用）**：引用求救警报回一句 → 客户收到润色版；客户再发 3 条 → **0 条 AI 回复**，你收到 3 条「🙋 [人工中]」转发
8. **[bot] 释放**：再引用一条转发回「好的 [bot]」→ 客户收到转达，之后客户再发 → AI 恢复回复，且第一条回复不重新自我介绍
9. **指令**：直接给碗妈号码发 `#pause 60xxxxxxxxx 30` / `#status 60xxxxxxxxx` / `#resume 60xxxxxxxxx` → 三条各有确认回复
10. **限流**：（可选）一小时内刷 31 条 → 第 31 条收到「消息有点多稍后回」，Telegram 一条报警，之后本小时不再回
11. **备注**：说「我叫阿 May，每次放 guard house」→ 隔一会儿再聊，bot 叫「阿 May」并主动问「还是放 guard house 吗」；dashboard 潜在客户页点该号码的「🤖 碗妈」能看到备注
12. **付款方式**：问「可以 TnG 吗」→ 正确回答，并说明 COD 不行
13. **1 小时追单**：发「hi」后不动 → 60 分钟 ±15 分钟收到第 1 条追单 + 2 个按钮；点「先不用了」→ 收到告别，之后**不再**追第 2 次
14. **接管时不追单**：`#pause` 某号码后，它到点也**不会**收到追单；`#resume` 后下一轮 cron 才追

## 已知边界（诚实清单）

- **Meta 切换的那几分钟**：第 2 步到第 3 步之间进来的消息会被 n8n 401 拒掉，Meta 会重试几次；超过重试窗口的消息会丢。选低峰做。
- **老板自己直接找客户聊**：你用碗妈的号码直接给客户发消息，bot **不知道**（Meta 不把你发出的消息推给 webhook）。所以主动联系前先 `#pause <号码>`，否则客户回复会被 AI 抢答。
- **限流按 MYT 小时桶**，不是滑动窗口：一个客户 13:59 发 30 条、14:00 再发 30 条不会被拦。够用，别较真。
- **按钮标题 ≤ 20 字符**（Meta 硬限制），改文案时注意。
- **turns 只留最近 30 条**，更早的记忆靠 dashboard 备注 / 客户档案。
- **超 24 小时的追单**仍没做（需要审核过的 template）。
- Google Sheet 的 5 个日志节点**还在写**（全部 continue-on-fail），两周后确认 dashboard 不再需要就删。`dishes` / `promo` 两张表照旧在用，**别删**。

## 出问题怎么办

- 客户已读不回 → 先看 Telegram：relay 报警（转发失败 / 验签）和 n8n Error Handler 报警是两个来源，报警里都有 msg.id 和原文
- 想临时回到 v1 → 见第 3 步「回滚」
- 某个客户被 bot 抢答 → `#pause <号码>`；想看它现在什么状态 → `#status <号码>`
- 追单没发 → 「Bowlmama v4 — 自动追单」执行记录；`/api/n8n/lead?action=due` 回空是正常（没到点 / 已成交 / 人工中 / 超 24h）

## 改动了要重新生成

workflow JSON 是**脚本生成的**，别手改 JSON：

```
node scripts/build-n8n-v4.mjs            # 改 scripts/build-n8n-v4.mjs 后重新生成（以 v3 JSON 为基底）
node scripts/validate-n8n-workflows.mjs  # 图结构 / 表达式引用 / 凭据校验
node scripts/verify-n8n-v3.mjs v4        # Code 节点语法 + Wait 单位 + 孤儿节点
npx tsx scripts/dogfood-wa-webhook.mts   # relay 纯函数 72 条断言
npx tsx scripts/dogfood-wa-lead.mts      # 追单排程 37 条断言
node scripts/dogfood-n8n-v4-scripts.mjs http://localhost:PORT KEY   # Code 节点喂真数据跑话术
```
