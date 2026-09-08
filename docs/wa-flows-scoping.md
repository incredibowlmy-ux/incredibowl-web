# WhatsApp Flows / 目录消息 —— 调研（不实施）

> 2026-09-08。Phase C 只探路，不写代码。计划见 `tasks/todo-wa-api-features.md`。
> **本文严格区分「已确认」和「未确认」。未确认的不要当依据做决定。**

## 为什么值得看
现在的成交路径是：客户在 WhatsApp 问 → bot 给一条 `/o` 链接 → 客户跳浏览器 → 选菜、填地址、付款。
每一次跳转都是漏斗上的一个洞。Flows 能把「选送达日 / 选菜 / 填地址」搬进对话里的原生表单，
客户不离开 WhatsApp。这是目前所有能加的功能里，唯一可能明显抬高转化率的一项。

## 已确认（Meta 官方文档，2026-09-08 读）
- **窗口内的自由文本消息全部免费**：「All non-template messages are free… Non-template messages
  can only be sent within an open customer service window.」
  → 碗妈收件箱里老板手打的每一条回复，**不花钱**。
- **窗口内发的 utility 模板也免费**：「Utility template messages sent within an open customer
  service window are free.」
  → 订单确认模板如果是在客户刚聊过的 24 小时内发，免费；超出才计费。
- 计费模型 2025-07-01 起从「按会话」改成「按条」。当前费率卡标注 effective 2026-07-01。
- 来源：<https://developers.facebook.com/docs/whatsapp/pricing>

## 未确认（要自己去点开才知道，别用我的印象）
- **马来西亚每条单价**。官方费率卡是要下载的 CSV/PDF，网页上不显示数字；
  互动版在 <https://whatsappbusiness.com/products/platform-pricing/> 选 Malaysia + MYR，
  数字由 JS 动态加载，抓不到。
  第三方（服务商博客）给的数字：营销 ≈ RM0.3467/条、utility ≈ RM0.0564/条，
  **这不是 Meta 官方数字，只能当数量级参考**。群发前请老板自己在上面那个页面选一次 Malaysia 看真数。
  - 数量级感受（按第三方数字，仅供判断要不要认真算）：给 300 人发一次每周菜单营销模板
    大约 RM100 上下。真数以官方费率卡为准。
- **Flows 的前置条件**。Meta 的 Flows 文档是 JS 渲染的，抓不到正文，我没能确认以下几条：
  - navigate-only（纯前端表单、提交后一次性回传）是否也需要 endpoint 和公私钥加密，
    还是只有 data-exchange（每一步都要服务端算下一屏）才需要；
  - Flow 发布前是否要 Meta 审核；
  - 发 Flow 消息在 24 小时窗口外是否必须挂在模板上。
  → 下一步：在 Meta 后台 WhatsApp Manager → Flows 里点「Create flow」走一遍，
    界面会直接告诉你要不要 endpoint 和密钥。比读文档快。

## 商品目录消息
- 现有资产：目录 **Incredibowl Menu** `catalog_id 1569013811243958`，business `4383381675320005`，
  每日从 `/api/meta/product-feed` 自动同步（见 memory `project_meta_catalogue_feed`）。
- 要探的一件事：这个目录能不能绑到 WABA 上 —— `GET /{waba-id}/product_catalogs`。
  能绑的话，`type: 'interactive', interactive: { type: 'product_list' }` 就能把本周菜
  直接发进对话，客户在 WhatsApp 里加购物车。
- **未确认**：绑定是否需要 Commerce Manager 里开 Shop、马来西亚是否支持 WhatsApp 内结账。
- 拿到 WABA id 后（`node scripts/wa-templates.mjs waba`），这条一行命令就能验证。

## 建议顺序
1. 先把 Phase B 的模板走完（已提交 → 过审 → 群发跑通）。那是确定有回报的。
2. 再花半小时在 Meta 后台点一次 Flow 创建流程，把上面三个未确认的问题当场问清楚。
3. 目录消息最后看 —— 它依赖 Shop 设置，链路最长，且我们的菜每周换，目录同步已经够用。

## 明确不做
- WhatsApp Pay：马来西亚是否对商家开放，我**没有核实**，别据此做任何计划。
