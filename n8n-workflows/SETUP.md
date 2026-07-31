# Bowlmama v2 部署手册（老板照着点就行）

三个文件，全部在本目录：

| 文件 | 是什么 | 必须？ |
|---|---|---|
| `bowlmama-v2-main.json` | 主 workflow（替代现役 chatbot） | ✅ |
| `bowlmama-v2-draft-tool.json` | AI 的「建订单草稿」工具（子 workflow） | ✅ |
| `bowlmama-v2-error-handler.json` | 挂了自动 Telegram 报警 | 强烈建议 |

> ⚠️ 前置条件：网站端的 `/api/n8n/wa-order` 和 `/api/n8n/customer` 两个新接口
> 要先随 main 部署上线（等本地 commit 获批 push 后 Vercel 自动部署），
> 否则下单闭环和客户档案会一直走「查询失败」兜底（客服对话不受影响）。

---

## 第 1 步：建 Google Sheet 防抖缓冲 tab（1 分钟）

打开现有的 chatbot 表（Incredibowl_n8n_chatbot），**新建一个 tab 叫 `wa_buffer`**，
第一行表头四列（小写，别改名）：

```
phone | msg_id | text | ts
```

作用：客户连发多条消息的合并缓冲 + 消息去重水位线。会慢慢累积行数，
一两个月手动清一次旧行即可（只删 ts 很旧的行，随便删不影响运行）。

## 第 2 步：导入三个 JSON（每个 2 分钟）

n8n → Workflows → ⋯ → Import from File，依次导入三个文件。

**导入「下单草稿工具」后**：打开它，什么都不用改（凭据 Incredibowl N8N API Key
会自动挂上，因为是同一实例的凭据 id）。记住它的名字即可。

**导入「主 workflow」后，打开逐项核对：**
1. 各节点凭据应已自动挂上（WhatsApp / Google Sheets / Gemini / N8N API Key
   四种凭据 id 与现役 workflow 相同）。看到红色感叹号才需要手动重选。
2. 打开 `create_order_draft` 节点 → Workflow 下拉里**重新选择**
   「Bowlmama v2 — 下单草稿工具」（跨实例导入 workflow id 会变，必须手动选一次）。
3. 打开 `Wait 防抖` 节点：默认 10 秒。想改防抖窗口只改这里。
4. 打开 `check_delivery_fee` 工具节点看一眼 Body：应有一个 `address` 参数、
   值由模型提供（model-provided）。若显示叹号/为空，手动把 Body 参数 address
   设为「由模型提供」即可（地址走参数化传输，含引号的地址不会打坏 JSON）。

**导入「Error Handler」后：**
1. 打开 Telegram 节点 → 凭据下拉选你现有的 Telegram Bot 凭据
   （daily-prep / daily-recap 在用的那个）。
2. chatId 填你自己的 Telegram chat id（和 Vercel 环境变量
   `TELEGRAM_OWNER_CHAT_ID` 里那个同值；要抄送碗妈 Ebby 就再复制一个
   Telegram 节点填 7992954700）。
3. 回到「主 workflow」→ 右上 ⋯ → Settings → **Error Workflow** →
   选「Bowlmama v2 — Error Handler」→ Save。

## 第 3 步：切换上线（30 秒，可随时切回）

v2 的 webhook path 与现役版相同（`whatsapp-receive`），**Meta 后台什么都不用改**：

1. 把现役「FB CAPI - WhatsApp CTWA Lead Capture」workflow 设为 **Inactive**
2. 把「Bowlmama v2」设为 **Active**

回滚 = 反过来操作，10 秒完成。

> 📌 v2 已按你的决定**整条移除** Lead/CAPI 支线（Fire FB Lead / whatsapp_orders
> 表写入都没有了）。Purchase 归因完全走每周 cron 上传，且 WhatsApp 单从此会
> 真正落进 Firestore，自动进入 cron 的上传范围。

## 第 4 步：真机 smoke（10 分钟，拿你自己的非老板手机号测）

按顺序测，全过才算上线成功：

1. **防抖**：3 秒内连发「hi」「今天有什么」「送 Pearl Suria 吗」三条
   → 应只收到**一条**综合回复（等 10-15 秒正常）
2. **运费工具**：发一个地址 → 回复里的运费应与网站 DeliveryChecker 一致
3. **位置 pin**：发一个定位 → 秒回距离+运费
4. **下单闭环**（核心）：
   - 报菜+数量+午/晚+地址 → 碗妈回**系统算的**明细+总额 → 回 OK → 收到 QR
   - 随便发张图片当「付款截图」→ 老板号应收到转发**带草稿摘要**
   - 老板引用那条图片消息回 `1` → 客户收到订单确认；dashboard 应出现
     status=confirmed 的手动单（isManual、含 trackToken、库存已扣）
   - 再回一次 `1` → 应提示「之前已确认过，没有重复建单」
   - ⚠️ 测试单记得去 dashboard 取消 + 回补库存（或用 revert 脚本模板）
5. **老客档案**：用有会员记录的号发「我还有几张餐券」→ 应答出真实数字
6. **求救**：发「我要投诉」→ 老板号收到求救警报，客户收到安抚话术
7. **老板转达**（回归测试）：引用求救警报回复一句话 → 客户收到润色版
8. **Error Workflow**：临时把主 workflow 里 Get Live Menu 的 URL 改错一个字母
   → 发消息 → Telegram 应收到报警 → 改回来

## 已知边界（诚实清单）

- **餐券抵扣单不走 bot**：碗妈的 QR 下单是现金全额；客户要用餐券，还是走
  网站或你手动扣（prompt 已教会碗妈这样引导）。
- **`create_order_draft` 工具里的 phone 参数**用了表达式
  `$('Router').first().json.phone`（防串号）。smoke 第 4 步时顺带核对
  Firestore `waOrderDrafts` 里的 phone 是不是发消息那个号码；万一是空的，
  把该参数改成 `$fromAI('phone',...)` 并告诉我，我再补一版。
- **Webhook 没验 Meta 签名**（与现役版相同）。要加固需要 Meta App Secret +
  在你的 n8n 实例上实测 raw-body 行为，属于下一步的 15 分钟加固项。
- **草稿 24 小时过期**；客户改单会自动作废旧草稿，老板永远只会确认到最新一张。
- 图片转发、求救、老板引用转达、发菜图、Gemini 润色等原有功能全部保留原样。

## 出问题怎么办

- 客户已读不回 + Telegram 有报警 → 打开报警里的执行链接看是哪个节点红了
- 想临时回到旧版 → v2 Inactive、v1 Active（10 秒）
- wa_buffer 表偶尔读不到 → 防抖会自动退化成「单条处理」，不会吃消息
