# SOP — 新菜上架标准流程

> 经 2026-06-21「澳洲和牛饼饭」实战验证的流程。以后加新菜照这份走即可。
> 核心结论:**加一道菜只需改 2 个地方**(1 张图 + 1 段数据),其余全自动覆盖。

---

## 0️⃣ 老板要给 Claude 的输入清单

| # | 项目 | 必填? | 说明 |
|---|------|:----:|------|
| 1 | **主图** | ✅ | 实拍或 AI 图,**正方形最佳**(会裁成 1024×1024)。PNG/JPG 都行,Claude 负责转 webp。 |
| 2 | **中文名 + 英文名** | ✅ | 例:`澳洲和牛饼饭` / `Aussie Wagyu Beef Patty Don` |
| 3 | **价格 (RM)** | ✅ | 例:`22.90` |
| 4 | **归属** | ✅ | `常驻` 还是 `周几特餐`?周特餐要给星期(周一=1 … 周五=5)。 |
| 5 | **餐券规则** | ✅(高价菜) | 价格 > RM19.90(餐券面值)时要不要补差价?默认惯例:超出部分补现金,如 `RM22.90 → 补 RM3`。 |
| 6 | **是否设为该星期 Hero 主推** | 选填 | 同一星期有多道特餐时,首页头条秀哪道。 |
| 7 | **营养克数(蛋白/重量等)** | 选填 | ⚠️ **没有就留空,绝不编**(诚实原则)。标签先写风味卖点,有数据再补。 |
| 8 | **采购食材克数** | 选填 | 给 `dishIngredients.ts` 做备餐采购汇总用;不给只是少一项后台汇总,不报错。 |

---

## 1️⃣ 必改的 2 个地方

### A. 图片 → `public/<snake_case>.webp`
- 规格:**1024×1024 · webp · quality 82 · ~100–180KB**(与现有菜图统一)
- 命名:小写蛇形,如 `wagyu_beef_patty.webp`、`sambal_petai_prawn_pork.webp`
- 转换命令(可复用):

```bash
node -e "
const sharp = require('sharp');
const src = 'C:/路径/原图.png';
const out = 'public/<菜名>.webp';
(async () => {
  await sharp(src).resize(1024,1024,{fit:'cover',position:'centre'}).webp({quality:82}).toFile(out);
  const o = await sharp(out).metadata();
  console.log(out, o.width+'x'+o.height, Math.round(require('fs').statSync(out).size/1024)+'KB');
})();"
```

### B. 数据 → `src/data/weeklyMenu.ts`
在对应区段(常驻 / 周一~周五)的数组里新增一个 `MenuItem` 对象。

**字段速查:**

| 字段 | 必填 | 含义 / 规则 |
|------|:----:|------|
| `id` | ✅ | **全局唯一**,取「当前最大 id + 1」。**截至 2026-06-21 最大 id = 24,下一道用 25。** |
| `day` | ✅ | `"Daily / 常驻"` 或 `"Tue / 周二"` 这种格式。 |
| `weekday` | 周特餐✅ | 周日=0 … 周六=6。常驻菜/退役菜**不写**。 |
| `isPrimary` | 选填 | 同一 `weekday` 多道时,Hero 头条取 `isPrimary:true` 那道。 |
| `name` / `nameEn` | ✅ | 中 / 英文名。英文页自动用 `nameEn`。 |
| `price` | ✅ | 数字,如 `22.90`。 |
| `image` | ✅ | `/<菜名>.webp`(图没就绪可暂填 emoji 如 `"🍲"`,各 next/image 处有 `startsWith('/')` 守卫,但**记得回填**)。 |
| `tags` / `tagsEn` | ✅ | 中 / 英标签数组。⚠️ 无营养数据时**不放克数**,只写风味。 |
| `desc` / `descEn` | ✅ | 中 / 英简介。 |
| `voucherTopUp` | 高价菜✅ | 餐券补差价(RM)。价格 ≤19.90 不写;>19.90 按惯例设(如 22.90→`3`,23.90→`4`)。 |
| `retired` | 选填 | 退役菜:灰显可见不可点,需配 `unavailableNote`。 |
| `excludeWeekday` | 选填 | 常驻菜某天不供应(如 `2`=周二),配 `unavailableNote`。 |

---

## 2️⃣ 不用改 — 自动覆盖的地方

加进 `weeklyMenu` 后,以下全部**自动**生效,**无需手动改**:

- ✅ **中文首页 + 英文页 `/en`** — 同读一份 `weeklyMenu`,EN 组件取 `nameEn/descEn/tagsEn`
- ✅ **首页 Hero 今/明日特餐** — `nextSpecial.ts` 按 `weekday`/`isPrimary` 算
- ✅ **SEO 结构化数据 (JSON-LD)** — `layout.tsx` 自动生成
- ✅ **购物车计价** — `CartDrawer` 读 `price` / `voucherTopUp`
- ✅ **下单服务端校验** — `/api/submit-order` 按 `id` 读 `weeklyMenu` 校验价格 / 补差价
- ✅ **sitemap** — 无逐菜 URL,不受影响

---

## 3️⃣ 选填的额外改动

| 文件 | 何时改 | 注意 |
|------|--------|------|
| `src/data/dishIngredients.ts` | 想要备餐采购汇总 | `name` 必须与 `weeklyMenu.name` **逐字一致** |
| `src/data/blockedDates.ts` | 某天售罄/停售 | 键 = 菜品 `id` |
| `src/lib/dishAliases.ts` | **改名**老菜 | 做历史菜名映射,避免旧订单对不上 |

---

## 4️⃣ 验证清单(push 前必做)

```bash
# ① 类型检查 —— 必须 exit 0
npx tsc --noEmit

# ② 起 dev,确认菜进了页面 + 图片可访问
npm run dev
curl -s http://localhost:3000/      | grep -c "新菜中文名"      # 应 ≥1
curl -s http://localhost:3000/      | grep -c "新菜图.webp"     # 应 ≥1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/新菜图.webp   # 应 200
```

- ③(建议)浏览器实际看一眼:菜单卡片显示正常、对应星期的 Hero 头条正确。
- ⚠️ 注意:菜单卡片文字走**客户端渲染**,所以 `curl` 原始 HTML 里看不到菜名属正常(图片路径会出现);要确认文字得开浏览器。
- 📌 本项目规矩:**改完先 tsc + dogfood 验证,再 commit + push;push 后再看一眼线上。**

---

## 📎 附:本次模板案例 — 澳洲和牛饼饭(id 24)

```ts
{
    id: 24,
    day: "Tue / 周二",
    weekday: 2,
    isPrimary: true,                 // 周二 Hero 主推
    name: "澳洲和牛饼饭",
    nameEn: "Aussie Wagyu Beef Patty Don",
    price: 22.90,
    voucherTopUp: 3,                 // 22.90 > 19.90,补 RM3(同参峇)
    image: "/wagyu_beef_patty.webp",
    tags: ["澳洲和牛饼", "温泉蛋拌饭", "番茄莎莎清爽", "餐券+RM3"],
    tagsEn: ["Aussie wagyu patty", "Onsen egg over rice", "Zesty tomato salsa", "Voucher +RM3"],
    desc: "澳洲和牛肉饼香煎到外焦内嫩，盖一颗半熟温泉蛋……",
    descEn: "Aussie wagyu beef patty seared crisp outside and juicy within…"
}
// 营养克数:碗妈未提供 → 标签暂不放数字,日后补。
```
