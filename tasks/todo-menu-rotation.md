# 菜单改版 — 方案 B「按天分区」轮换视图

> 目标：把首页菜单从平铺网格改成「按周几分区」，让「每周轮换 / 一菜一天」的品牌故事一眼可见。
> 决策来源：老板 2026-06-27 选定 核心目标=讲清轮换故事、布局=方案 B。冷门菜老板自行处理（本次不碰销量数据）。

## 设计规格

### 分区结构（从上到下）
1. **本周特餐 · 一菜一天**（核心故事区）
   - 按 `weekday` 1→5 排成 周一/周二/周三/周四/周五 子分区，每个子分区一个小标题（含日期 + 周几）。
   - 每天下面是该天的菜卡（沿用现有卡片样式，不重设计卡片本身）。同一天多道按 `isPrimary` 在前。
   - **下一个可下单的那天**：高亮（✨明天 / 橙色边框）。
   - 本周已过截单的天：该子分区内灰显（可见不可点），故事完整保留「这就是本周轮换」。
2. **常驻 · 天天都有**（转化锚点）
   - 无 `weekday` 且非 retired 的 4 道（纳豆/山药/花肉/参峇臭豆）。始终可点。
3. **暂别 / 往期菜式**（弱化小条，可选）
   - `retired: true` 的菜（酱油鸡、鸡汤）收进这里灰显，不再混在主区。

### 关键约束（红线，必须守）
- **SSR 安全**：首页静态预渲染。`menuDates` 为空（SSR/首帧）时维持现有 skeleton + 源顺序渲染；分区布局只在客户端 `menuDates` 填充后构建。沿用现有 `Object.keys(menuDates).length === 0` 守卫，避免 hydration mismatch（NO_LCP 坑）。
- **轮换/日期逻辑只有一份**：分区取 `weekday`、下一可点天取 `computeNextSpecial()`，都复用现有 lib，不复制副本。
- **EN 同步**：`MenuCarousel.tsx`（ZH）与 `MenuCarouselEN.tsx`（EN）是双胞胎，改一处必须镜像另一处（name/nameEn、tags/tagsEn、按钮文案、alt locale）。
- **移动端不破坏**：mobile（`lg:hidden`）与 desktop（`hidden lg:`）两段独立渲染分别改，互不影响。

### 实现方式（控制风险 + 去重）
- 每个组件内抽一个本地 `renderCard(dish, size)` 帮手，消化现有那段大卡片 JSX，让分区循环不再四处复制整块 markup（文件内 DRY，不跨文件，blast radius 小）。
- 分区由 `renderCard` 拼装；卡片视觉/交互/库存 badge/截单态逻辑全部保持现状。
- 「Coming Next Week」WhatsApp CTA 保留，放在特餐轮换区之后或页尾。
- 分区顺序默认「特餐轮换在前（讲故事）→ 常驻 → 往期」。若上线后觉得转化受影响，可一行调成「常驻在前」。

## 待办
- [ ] ZH：`MenuCarousel.tsx` 抽 `renderCard` + 重排为分区（mobile + desktop 两段）
- [ ] EN：`MenuCarouselEN.tsx` 镜像同样改动
- [ ] 子分区小标题组件（周几 + 日期，复用 dInfo / weekday 映射）
- [ ] retired 菜下沉到「暂别」弱化条
- [ ] 本地 `tsc` 通过 + dogfood `/` 与 `/en`（明天那天高亮对、已截单天灰显对、常驻可点、SSR 首帧不闪）
- [ ] commit + push（按「push 前先验证」规则），push 后线上 smoke check

## Review

**已完成（2026-06-27）**
- ZH `MenuCarousel.tsx` + EN `MenuCarouselEN.tsx` 重做为「按周几分区」轮换视图。
- **移动端**：2 列网格按天分区（🗓 周一→周五，每天小标题+日期，下一餐那天橙色高亮）→ ⭐ 常驻 → WhatsApp CTA → 🕰 暂别往期。
- **桌面端**：改成「一周 5 列日历」（周一到周五各一列、卡片纵向堆叠），**填满宽度、零网格留白**，远胜最初按天分区在 3–4 列网格里的大片右侧空白。下面 ⭐ 常驻走 4 列网格、🕰 暂别走 4 列网格。
- 卡片视觉/库存 badge/截单态/click 逻辑全部沿用旧实现（文件内抽 `renderMobileCard` / `renderDesktopCard` 帮手去重，未改卡片本身）。
- retired 菜（酱油鸡、鸡汤）下沉到「暂别 · 往期菜式」弱化区。

**验证证据**
- `tsc --noEmit` 通过；`npm run lint` 两个组件 0 warning（仓库既有 warning 不在本次文件）。
- dogfood：`/` 与 `/en` 均 HTTP 200；浏览器渲染后分区标题/高亮/灰显全对；console 无 hydration/mismatch 报错（仅既有 Meta pixel + LCP image 提示）。
- 今天周六 → 下一餐顺延周一，「✨ 下一餐」高亮正确挂在周一列。
- 桌面 1440px + 移动 390px 截图均确认。

**设计决策（替老板定的，可回退）**
- 段序：本周特餐轮换在前（讲故事）→ 常驻 → 往期。若要转化优先可对调。
- 退役菜：下沉「暂别」弱化区（未直接撤）。

## Lessons（如有纠正后补）
- 按天分区若直接塞进多列 CSS 网格，单天 1–2 道菜会在右侧留大片空白。桌面端正解是「一周 N 列日历」（每天一列纵向堆叠），天然填满宽度。先截图再定，别假设网格分区好看。
