# 碗妈 bot Gemini 503 事故 → AI 兜底 + 多账号档案 — 2026-09-10 凌晨

## 事故
09-09 23:50 执行 7844：客户 +60165119118（Ebby）问 "can u check my tomorrow order"，
Gemini `gemini-3.5-flash` 回 503（高负载），`AI Agent` 无重试无错误分支 → 整条执行失败，
客户零回复；Telegram 报警只有外层一句，没号码没原话。v4 上线以来首次 AI 503。

复盘还发现：
- 系统里**没有**她 09-10 的单（18 张全扫过）；她同号码有两个账号（ebbywasser@gmail 0 单 /
  ebbycheong87@hotmail 1 单），bot 只看到 0 单那个 → 就算 AI 没挂也会答错。
- 旧账号缺 `phoneNormalized`（全库 6 个），`findUserByNormalizedPhone` 根本查不到它。

## 改动
- [x] A 重试：`AI Agent` retryOnFail / maxTries 3 / 3s（build-n8n-v4.mjs）
- [x] B 兜底：`AI Agent` onError=continueErrorOutput → `AI Down Build` → 三路并行
      客户「稍等」(+记 turn) / 老板 WA 警报 (+alert 映射，引用回复即转达并接管) / Telegram 带 wa.me
- [x] C 报警：Error Handler 加 `error.description`（真正的 503 原因）
- [x] D 多账号：`findUsersByNormalizedPhone` 返回全部；customer API 订单/餐券按全部 uid 聚合，
      档案主体取订单最多的未合并账号；多账号时档案块加 ⚠️ 提示
- [x] E 提示词：档案里没有客户说的那张单 → 不说「你没有订单」，[求救老板]
- [x] 补数脚本 `scripts/_backfill-phone-normalized.mts`（dry-run 默认；`go` 只 merge 一个字段）
- [x] 上线脚本 `scripts/_apply-v4-ai-fallback.mjs`（dry-run 默认；`go` PUT 主流程 + Error Handler 并重发布）

## 验证
- build-n8n-v4 → validate / verify v4 全过（93 节点，AI Agent 两路输出，无孤儿）
- tsc 0 错；`npm run build` exit 0；dogfood-n8n-v4-scripts 74/0（本地 next start -p 4007）
- 本地打 `/api/n8n/customer?phone=60165119118`：仍只见 0 单账号 → 根因是旧账号缺 phoneNormalized，
  D 的合并逻辑要等补数后才生效（补数后重测）
- `_apply-v4-ai-fallback.mjs` dry-run：线上 AI Agent 无重试/无 onError，兜底链未装，Error Handler 无详情 → 与预期一致

## 待老板
1. 回复 +60165119118（系统无她明天的单，问她用哪个名字/号码下的）
2. `npx tsx scripts/_backfill-phone-normalized.mts go`（6 个 users 补一个字段）
3. push main → Vercel Ready 后 `node scripts/_apply-v4-ai-fallback.mjs go`
4. 真机 smoke：任意号码发一句话，确认正常路径不受影响

## 未做（另立项）
- WhatsApp username 时代的身份主键（webhook 的 wa_id 到底怎么给，先查 Meta 文档再动）
- fallback model（Agent typeVersion 1.7 不支持，升版另评估）
