# 网页 UX/视觉优化 — 2026-07-02

> 来源：全站审查（线上截图 + 代码梳理）→ 老板批准全部项目。
> 原则：所有布局/视觉改动仅桌面（`lg:`），移动端冻结；ZH/EN 双树同步。

## 已完成 ✅

### Bug / 债务
- [x] **删购物车积分残留**：CartDrawer 底部「核对成功后可获 +N 积分」（积分系统已下线）— `CartDrawer.tsx`
- [x] **运费文案收敛**：新建 `src/lib/deliveryCopy.ts`，从 deliveryUtils 数值常量生成文案；
      NavBar / Hero / DeliveryWidget / FAQ / Footer（ZH+EN 共 10 个组件）全部改引配置。
      顺带修复 Hero 只列 2 档的口径不一（现在 3 档齐全）。blog/SEO 长文不动（改价时手动更）。
- [x] **token 对齐**：globals.css `--primary` #FF6B00 → #FF6B35（与全站硬编码一致），hover #E95D31。

### P0 首屏减负（桌面）
- [x] HeroTrustStrip、FaqHeroStrip 桌面隐藏（内容在 Hero 徽章 / FAQ 区已有）
- [x] PromoBanner（感恩折扣）桌面移到菜单之后（`contents lg:hidden` / `hidden lg:contents` 双渲染）
- [x] DeliveryWidget 桌面拉满 12 列

### P1
- [x] CTA 收敛：PromoBanner「立即下单」→「去看菜单」（EN "Order now" → "See the menu"）
- [x] 今日已截单列：桌面保留彩色图 + 白色「今日已截单」徽章 + opacity-75（与售罄灰图区分）
- [x] WhatsApp 粘条：桌面改为滚过 1600px 才出现（原 1.5s 定时弹出遮首屏）；移动端行为不变；
      粘条与浮钮互斥逻辑本来就有，未动

### P2
- [x] 常驻区 2 卡 + Coming Next Week 卡拼满一行（grid-cols-3）
- [x] 往期人气菜桌面默认折叠（「展开看看 ▼」按钮），移动端保持展开
- [x] 点菜弹窗：桌面「送达时间」前置到加购之上（lg:order），午/晚时段改为两个大按钮（移动端保留原生下拉）

## 验证记录
- `npx tsc --noEmit` 通过
- localhost dogfood：桌面首页全流程（点菜 → 选时段 → 加入购物车）✓；购物车无积分字样 ✓；
  移动端全页截图与改前顺序一致 ✓；/en 所有改动同步生效 ✓
- 遗留 console warning 均为改动前已有（Meta pixel 权限、next/image sizes 提示）

### 追加：DeliveryWidget 桌面左右分栏（2026-07-03）
- [x] 整行宽后上下两条改为左查询/右信息（费率表+时段并排），高度 ~470px → ~210px；ZH+EN

### 追加：桌面字体可读性 6 项修复（2026-07-03）
- [x] 顶部提示条 12→13px；运费免运门槛 11→12px；弹窗加购副行 11→12px + extraDesc 10→11px；
      周历日期 12px gray-400 → 13px gray-500；感恩折扣卡 white/55→/70 + 11→12px；
      Footer「7.5km 以外」注脚 11px /40 → 12px /55。全部 lg: 或桌面专属块，移动端不变；ZH+EN 同步。

## 未做 / 后续可选
- [ ] 组件硬编码色全面迁移到 token（现只对齐了 token 值，未反向替换 500+ 处硬编码）
- [ ] blog / metadata / terms 里的运费文案仍是手写，改价时记得同步
- [ ] ⚠️ 尚未 commit/push — 等老板 localhost 验收后决定
