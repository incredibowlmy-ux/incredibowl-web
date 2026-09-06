# 碗妈收件箱（WATI 式）—— 本地 dashboard 新页面

> 老板 2026-09-07 凌晨：「潜在客户里功能不够多，do me a version like WATI」。
> WATI 的核心 = 三栏收件箱：左边对话列表（未读 / 筛选 / 搜索）、中间聊天线程（气泡 + 回复框）、
> 右边客户档案（备注 / 标签 / 订单）。加上「接管 / 释放」= WATI 的 assign。

## 边界（先说清楚不做什么）
- **不重做「潜在客户」页**：它是「WA 聊过没下单」的统计表，保留。新页「碗妈收件箱」放它上面。
- **发消息只支持 24 小时窗口内的普通文本**。窗口外要 Meta 审核过的模板，这轮不做（服务端直接拒并说明）。
- **不做多客服 / 分配给某人**：只有老板一个人。「接管」就是 assign to me。
- **老板从自己手机直接发的消息 bot 看不到**（Meta 不推送出站），收件箱里也不会有 —— 从收件箱发才会记录。

## 数据
- 线程 = `waLeads/{phone}.turns`。上限 30 → **200**（每条 ≤600 字，最坏 120KB，远低于 Firestore 1MB）。
  提示词只取最近 12 条（`renderTurnsBlock(…, 12)`），不影响 AI 成本。
- 新字段：`bossReadAtMs`（老板最后读到哪，算未读数）。
- 发送：新 `WA_ACCESS_TOKEN`（Meta 永久 system-user token；n8n 凭据里那把，老板要提供）+ 可选 `WA_PHONE_NUMBER_ID`（默认 1019276584602589）。

## 后端 `/api/admin/wa-lead` 新 op
- [x] `list` → 全部 waLeads 按最近消息倒序（≤300）：phone / name / status / human / lastMsg{role,text,ts} / unread / clicked / nudgeCount / tags / windowOpen（最后一条客户消息在 24h 内）
- [x] `read`（phone）→ `bossReadAtMs = now`
- [x] `send`（phone, text）→ 24h 窗口校验 → Graph API 发文本 → 追加 turn(role boss) → 自动接管 120 分钟（bot 闭嘴，和 WATI 「assign」一致）→ 回 msgId。`WA_ACCESS_TOKEN` 未配置回 `{ok:false, error:'WA_ACCESS_TOKEN 未配置'}`，前端显示提示但其它功能照常。
- [x] `get` 返回全部 turns（不再 slice(-30)）

## 前端（Desktop dashboard 源 → `npm run sync:dashboard`）
- [x] 侧栏新增「💬 碗妈收件箱」（放在「潜在客户」上方）
- [x] 三栏布局：左 300px 列表 / 中线程 / 右 280px 档案；窄屏时右栏折到底部
- [x] 左栏：搜索（号码/名字/最后一句）、筛选 seg（全部 / 未读 / 🙋人工中 / 🤖bot / 已成交 / 已关闭）、每行：名字或号码、最后一句预览、相对时间、未读红点、chips（人工 / 点过链接 / 追单 n）
- [x] 中栏：头部（名字 + 号码 + 状态 + 按钮：接管 2h / 接管到明早 / 释放 / 停止追单 / 在 WhatsApp 打开）；气泡：客户左灰、碗妈右绿、追单右绿虚框、老板右金、系统居中灰；日期分隔；自动滚到底；打开即 `read`
- [x] 回复框：textarea + 发送（Ctrl+Enter）+ 快捷回复下拉（存 localStorage，可增删）+ 24h 窗口状态（开 / 已过期 X 小时前）；token 未配置时禁用并提示
- [x] 右栏：客户档案（从 dashboard 已加载的 state.users / orders 匹配：订单数、消费、地址、餐券）+ bot 备注（复用现有 6 个 key 的编辑）+ 追单状态
- [x] 轮询：在页内每 20s 刷列表、打开的线程每 10s 刷；离开页面停
- [x] 旧的 🤖 弹窗保留（客户档案页那个入口），改成直接跳到收件箱对应线程

## 验证
- [x] tsc / eslint / build；dogfood-wa-webhook（上限 30→200 的断言同步）/ dogfood-wa-lead
- [x] dashboard：`node --check` 抠 script；核心渲染函数进 vm 喂假数据（按 [[project_dashboard_js_verification]]）
- [ ] 真机：老板登录 dashboard 开收件箱，用测试机发一条 → 未读出现 → 从收件箱回一条 → 手机收到 + bot 静音

## 老板要给的
- `WA_ACCESS_TOKEN`：Meta Business Settings → System Users → 生成 token（勾 whatsapp_business_messaging + whatsapp_business_management，永不过期）。n8n 「WhatsApp account」凭据里那把就是同类的，但 n8n 界面不显示明文，所以要么去 Meta 重新生成一把，要么老板本地有存。

## 结果（2026-09-07 04:5x）
- 后端：admin/wa-lead 新 op list/read/send，get 回全部 turns；`src/lib/waSend.ts`；TURNS_MAX 30→200。tsc/build 绿；dogfood-wa-webhook 72、wa-lead 37、wa-send 10、n8n-auth 14 全过。
- 前端：Desktop 源加 nav/页面/CSS/JS（约 330 行），🤖 按钮改跳收件箱；`node --check` 整段 script 通过；11 条 vm 断言过；已 sync 到 public。
- 未做：真机（要老板登录）；`WA_ACCESS_TOKEN` 未配（老板给 token 后 `vercel env add WA_ACCESS_TOKEN production --sensitive`）。
