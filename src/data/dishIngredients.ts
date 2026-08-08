/**
 * Dish → ingredient mapping table for daily prep ingredient aggregation.
 *
 * Used by /api/n8n/daily-prep to turn the order list ("希腊柠香烤鸡胸 ×5") into
 * a procurement-ready ingredient summary ("鸡胸肉 1.2kg；鸡蛋(生) 7颗；糙米 540g")
 * so BowlMama gets a shop-this-list instead of a math problem.
 *
 * Conventions:
 *   - Match `name` exactly to MenuItem.name in src/data/weeklyMenu.ts and the
 *     add-on label in src/components/menu/AddOnModal.tsx — the aggregator
 *     looks dishes up by display name (not id), because the order schema
 *     stores display names not IDs.
 *   - One IngredientLine = one ingredient × per-serving qty (raw / procurement
 *     weight, not cooked). Quantity is per ONE serving of the dish.
 *   - Mix units freely (g / ml / 颗 / 只 / 块 / 包 / 盒 / 把 / 份). The
 *     aggregator groups by (name, unit) so "鸡胸肉 g" and "鸡胸肉 块" stay
 *     separate — pick the unit BowlMama actually uses at procurement time.
 *   - Skip pantry staples (盐 / 胡椒 / 食用油 / 大蒜) — they're always there,
 *     listing them just adds noise. Soy sauce listed when it's portion-
 *     controlled per dish.
 *   - Add-ons use the LABEL shown in the cart (e.g. "白饭换糙米 (180g)") not
 *     the internal addOn ID, because the order schema's items[] stores
 *     label-format rows ("↳ <label>"). For manual orders (local dashboard)
 *     a shorter label is used (e.g. "换糙米"), so each add-on appears under
 *     BOTH keys in addOnRecipes.
 *
 * To add/edit a recipe: just edit this file. No migration, no schema change.
 * Empty `ingredients: []` means "data not yet provided" — the aggregator
 * will silently skip it (dish still counts in dish summary, just absent
 * from ingredient roll-up).
 */

export interface IngredientLine {
  /** Procurement / kitchen-facing ingredient name, e.g. "鸡胸肉", "鸡全腿", "糙米", "蛋" */
  name: string;
  /** Per-serving raw quantity */
  qty: number;
  /** Match the unit BowlMama uses at market (g / ml / 颗 / 只 / 块 / 包 / 盒 / 把 / 份) */
  unit: string;
}

export interface DishRecipe {
  /** Exact match to MenuItem.name in weeklyMenu.ts */
  name: string;
  /**
   * 2-character display name used in the daily-prep order matrix
   * (Telegram <pre> grid). Keeping it 2 CJK chars = 4 visual cells
   * keeps the matrix narrow enough to fit on mobile without horizontal
   * scrolling. Optional — falls back to the first 2 chars of `name`.
   */
  shortName?: string;
  ingredients: IngredientLine[];
}

/**
 * Per-dish raw-ingredient breakdown (per ONE serving).
 * Filled from BowlMama's portion data on 2026-05-25.
 */
export const dishRecipes: DishRecipe[] = [
  {
    name: '纳豆月见海苔饭',
    shortName: '纳豆',
    ingredients: [
      { name: '纳豆', qty: 1, unit: '盒' },
      { name: '温泉蛋', qty: 2, unit: '颗' },
      { name: '海苔', qty: 3, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '酱油', qty: 20, unit: 'ml' },
    ],
  },
  {
    name: '山药云耳海陆双鲜炒',
    shortName: '山药',
    ingredients: [
      { name: '山药', qty: 100, unit: 'g' },
      { name: '云耳', qty: 4, unit: 'g' },
      { name: 'PD31/40 虾', qty: 4, unit: '只' },
      { name: '鸡胸肉', qty: 65, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '鸡蛋(生)', qty: 1, unit: '颗' },
      { name: '葱', qty: 1, unit: 'g' },
    ],
  },
  {
    name: '阿嫲古早味酱油鸡全腿',
    shortName: '酱鸡',
    ingredients: [
      { name: '鸡全腿', qty: 1, unit: '只' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '时蔬', qty: 1, unit: '份' },
    ],
  },
  {
    name: '香煎金黄鸡扒饭',
    shortName: '鸡扒',
    ingredients: [
      { name: '鸡扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '毛豆', qty: 25, unit: 'g' },
      { name: '玉米', qty: 30, unit: 'g' },
      // 樱桃番茄统一按「颗」计（2026-07-02 老板拍板：鸡扒饭 2 颗、和牛饼饭 3 颗）。
      // 原 30g ≈ 2 颗 → 隐含 1 颗 ≈ 15g，其他克数按此换算。
      { name: '樱桃番茄', qty: 2, unit: '颗' },
    ],
  },
  {
    name: '招牌原盅当归蒸鸡全腿',
    shortName: '归鸡',
    ingredients: [
      { name: '鸡全腿', qty: 1, unit: '只' },
      { name: '当归', qty: 3, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      // 时蔬统一按「份」计（原 50g = 1 份，与酱油鸡对齐；库存文档单位=份）。
      { name: '时蔬', qty: 1, unit: '份' },
    ],
  },
  {
    name: '希腊柠香烤鸡胸',
    shortName: '希胸',
    ingredients: [
      { name: '鸡胸肉', qty: 200, unit: 'g' },
      // TODO_CONFIRM: 柠檬 user wrote "1/5g" — interpreted as 5g.
      // If meant 15g (typo) or 1/5 颗, update here.
      { name: '柠檬', qty: 5, unit: 'g' },
      { name: '马铃薯', qty: 100, unit: 'g' },
      { name: '椰菜花', qty: 100, unit: 'g' },
      { name: '黑橄榄', qty: 10, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    name: '马铃薯炖花肉片',
    shortName: '花肉',
    ingredients: [
      { name: '五花肉', qty: 125, unit: 'g' },
      { name: '马铃薯', qty: 100, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '黄洋葱', qty: 80, unit: 'g' },
      { name: '葱', qty: 2, unit: 'g' },
    ],
  },
  {
    // 常驻新菜 2026-06-14 上架，份量碗妈 2026-06-17 提供。
    // 顶级无皮五花肉与绍兴/豆酱焖花肉共用同一采购 SKU（聚合时合并）。
    // 虾按采购规格分两个 SKU：山药/大虾仁/海陆系列用「PD31/40 虾」(大)，
    // 本道参峇用「PD51/60 虾」(小)，两者不合并（2026-06-29 规格化）。
    // sambal 按 portion-controlled 计入采购汇总（同酱油惯例）。
    name: '参峇臭豆虾仁炒花肉',
    shortName: '参峇',
    ingredients: [
      { name: '顶级无皮五花肉', qty: 75, unit: 'g' },
      { name: 'PD51/60 虾', qty: 4, unit: '只' },
      { name: '臭豆', qty: 50, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: 'sambal', qty: 2, unit: '汤匙' },
    ],
  },
  {
    // 周四新菜 2026-06-15 上架，份量碗妈 2026-06-17 提供。
    // 仅列生鲜采购项；家乡豆酱按惯例（瓶装常备调味）不计入采购汇总。
    // 顶级无皮五花肉与绍兴酒蒸花肉共用同一采购 SKU（聚合时自动合并）。
    name: '家乡豆酱焖花肉',
    shortName: '豆酱',
    ingredients: [
      { name: '顶级无皮五花肉', qty: 140, unit: 'g' },
      { name: '西兰花', qty: 50, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '姜', qty: 10, unit: 'g' },
      { name: '葱', qty: 5, unit: 'g' },
    ],
  },
  {
    // 全新菜 2026-08-10 首发（周一/周四）。
    // ⚠️ 份量待碗妈提供 —— 空数组 = 数据未到位，聚合器静默跳过（诚实原则，
    //    绝不照豆酱焖花肉的克数猜）。碗妈给克数后按上面同款格式补：
    //    白萝卜 / 五花肉(确认走哪个采购 SKU) / 白饭 / 姜葱。
    name: '家乡白萝卜焖花肉',
    shortName: '萝卜',
    ingredients: [],
  },
  {
    name: '绍兴酒蒸花肉',
    shortName: '绍肉',
    // 仅列生鲜采购项（与本表惯例一致）。完整配方另含绍兴酒/麻油/鱼露/蚝油/糖/
    // 白胡椒等瓶装常备调味品，按惯例不计入每日采购汇总。
    // 五花肉用「顶级无皮五花肉」独立 SKU（与马铃薯那道的「五花肉」分开采购）。
    // 白饭存 80g 生米采购重（碗妈表给的 180g 是熟饭，约合 80g 生米，对齐其他菜）。
    // 五花肉 140g 生重：蒸/焖后缩水，按碗妈要求保证熟重 ≥90g（2026-06-29 修正，
    // 由 90g→140g，与同 SKU 的家乡豆酱焖花肉一致）。
    ingredients: [
      { name: '顶级无皮五花肉', qty: 140, unit: 'g' },
      { name: '西兰花', qty: 50, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '姜', qty: 10, unit: 'g' },
      { name: '葱', qty: 5, unit: 'g' },
    ],
  },
  {
    // 周二新菜 2026-06-21 上架。份量老板 2026-06-22 提供：和牛饼 1 块（采购按块计）+
    // 白米饭 80g 生米 + 樱桃番茄 3 颗。温泉蛋按描述「盖一颗半熟温泉蛋」自带 1 颗。
    // 番茄莎莎的其他调味（橄榄油/盐/黑胡椒等）按惯例不计入每日采购汇总。
    name: '澳洲和牛饼饭',
    shortName: '和牛',
    ingredients: [
      { name: '澳洲和牛饼', qty: 1, unit: '块' },
      { name: '温泉蛋', qty: 1, unit: '颗' },
      { name: '樱桃番茄', qty: 3, unit: '颗' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    name: '金黄葱香煎鸡汤',
    shortName: '葱汤',
    ingredients: [
      { name: '鸡扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '鸡蛋(生)', qty: 1, unit: '颗' },
      { name: '葱', qty: 40, unit: 'g' },
      // 时蔬统一按「份」计（原 50g = 1 份）。
      { name: '时蔬', qty: 1, unit: '份' },
    ],
  },
  {
    // 周二新上 2026-06-08。生鲜采购项（绍兴酒/蚝油/粟粉/盐/油等瓶装常备调味
    // 按惯例不计入采购汇总）。白饭存 80g 生米采购重（碗妈表 180g 是熟饭）。
    name: '古早味姜葱鱼片饭',
    shortName: '姜鱼',
    ingredients: [
      { name: '巴丁鱼片', qty: 250, unit: 'g' },
      { name: '鸡蛋(生)', qty: 1, unit: '颗' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '葱', qty: 32, unit: 'g' },
      { name: '姜', qty: 12, unit: 'g' },
    ],
  },
  {
    // 周五新上 2026-06-08。
    // 三文鱼 = 采购生重。老板 2026-08-01 确认：120g 生煎出 70g 熟（失水 ~42%），
    // 与菜单 70g+ 熟重口径吻合，120g 转正（原「失水约 20%」假设作废）。
    name: '柠香香煎三文鱼饭',
    shortName: '三文',
    ingredients: [
      { name: '三文鱼', qty: 120, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '西兰花', qty: 50, unit: 'g' },
      { name: '毛豆', qty: 25, unit: 'g' },
      { name: '玉米', qty: 30, unit: 'g' },
      // 与鸡扒饭同一套配菜（原 30g）→ 同按 2 颗计。
      { name: '樱桃番茄', qty: 2, unit: '颗' },
    ],
  },
  {
    // 新菜 2026-06-29 入系统。份量老板 2026-07-07 提供。
    // 鸡肉按「鸡胸肉」入桶（菜单描述=嫩煎鸡胸），与现有采购/库存桶合并。
    // 咖喱块按块的小数计（0.4块/份）——采购聚合到整块很直观（14 份 = 5.6块）。
    name: '家常日式咖喱饭',
    shortName: '咖喱',
    ingredients: [
      { name: '鸡胸肉', qty: 60, unit: 'g' },
      { name: '马铃薯', qty: 70, unit: 'g' },
      { name: '红萝卜', qty: 60, unit: 'g' },
      { name: '咖喱块', qty: 0.4, unit: '块' },
      // 白饭存 80g 生米采购重（入库时误按 180g 熟饭重录入，老板 2026-07-14 确认
      // 一份 80g 生米，对齐全表口径；换糙米 -80g 也随之自洽）。
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    // 新菜 2026-07-10 入系统，2026-07-13 上线主打。份量老板 2026-07-13 拍板：
    // 配菜与香煎金黄鸡扒饭同一套；柠檬蜜糖酱（柠檬+蜜糖）按瓶装常备调味
    // 惯例不计入每日采购汇总。鸡扒与鸡扒饭/葱汤共用同一采购 SKU（按块计）。
    name: '柠檬蜜糖煎鸡扒',
    shortName: '柠扒',
    ingredients: [
      { name: '鸡扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
      { name: '毛豆', qty: 25, unit: 'g' },
      { name: '玉米', qty: 30, unit: 'g' },
      { name: '樱桃番茄', qty: 2, unit: '颗' },
    ],
  },
  {
    // 新菜 2026-07-17 入系统（限周二/五）。份量老板 2026-07-21 提供：猪扒按块计
    //（独立采购 SKU，不与花肉/鸡扒合并）。甜酸洋葱酱与洋葱用量老板未提供 →
    // 不编造不计入；TODO_CONFIRM: 拿到准数后补（洋葱参考 { name: '黄洋葱', qty: X, unit: 'g' }）。
    name: '家乡甜酸洋葱猪扒',
    shortName: '猪扒',
    ingredients: [
      { name: '猪扒', qty: 1, unit: '块' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    // 新菜 2026-07-24 入系统，2026-07-31 上线。份量老板 2026-07-30 提供：排骨 180g。
    // 家乡豆酱按惯例（瓶装常备调味）不计入采购汇总。
    // TODO_CONFIRM: 配菜老板未给 → 不编造不计入。若与同系列的家乡豆酱焖花肉一致，
    //   应补 { 西兰花 50g }、{ 姜 10g }、{ 葱 5g }；拿到准数后补。
    name: '豆酱焖排骨',
    shortName: '排骨',
    ingredients: [
      { name: '排骨', qty: 180, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
  {
    // 新菜 2026-07-30 入系统。份量老板 2026-07-30 提供：鳗鱼 0.5 片、西兰花 50g。
    // 「马铃薯煎蛋B」原本按「份」另立 SKU，是因为老板当时没给份量（拆了就得编克数）。
    // 2026-07-31 老板给了：**1 份 B = 加料版「马铃薯煎蛋」(马铃薯 150g + 鸡蛋 2 颗) 的 1/4**
    // → 马铃薯 37.5g + 鸡蛋 0.5 颗。份量有了就拆成真采购 SKU（与加料版同口径），
    // 否则采购汇总和 ingredientStock 都扣不到马铃薯/鸡蛋，只看到一个买不到的「份」。
    // 照烧酱按瓶装常备调味惯例不计入采购汇总。
    name: '古早味照烧鳗鱼饭',
    shortName: '鳗鱼',
    ingredients: [
      { name: '鳗鱼', qty: 0.5, unit: '片' },
      { name: '马铃薯', qty: 37.5, unit: 'g' },
      { name: '鸡蛋(生)', qty: 0.5, unit: '颗' },
      { name: '西兰花', qty: 50, unit: 'g' },
      { name: '白饭', qty: 80, unit: 'g' },
    ],
  },
];

/**
 * Add-on label → ingredient delta. Keyed by BOTH the full AddOnModal name
 * (e.g. "白饭换糙米 (180g)" — used by web cart) and the short manual-order
 * label (e.g. "换糙米" — used by local dashboard), so the aggregator picks
 * up add-ons regardless of order channel.
 *
 * 换糙米 = 客人把整份底饭换成糙米：+糙米 90g，同时 -白饭 80g，抵消该份
 * 主食带的 80g 底饭，让白饭总量随换糙米精算（净额 = 0，不再多煮那份白饭）。
 * 换糙米永远挂在某道菜的 add-on 上、每道菜都带 80g 底饭，故每单白饭净额 ≥ 0。
 * 少饭 (less-rice) 仍故意不建配方（纯减量，由碗妈整锅统一煮时自行拿捏）。
 */
export const addOnRecipes: Record<string, IngredientLine[]> = {
  // ─── Rice swaps ────────────────────────────────────────────
  '白饭换糙米 (180g)': [{ name: '糙米', qty: 90, unit: 'g' }, { name: '白饭', qty: -80, unit: 'g' }],
  '换糙米': [{ name: '糙米', qty: 90, unit: 'g' }, { name: '白饭', qty: -80, unit: 'g' }],
  // 标签 150g = 给客人看的熟饭重；备料/采购按生米算。80g 生米→180g 熟饭，
  // 150g 熟饭 ≈ 66.7g 生米，取整 70g（对齐主食 80g 生重口径）。
  '加饭 (150g)': [{ name: '白饭', qty: 70, unit: 'g' }],
  '加饭': [{ name: '白饭', qty: 70, unit: 'g' }],
  // 少饭 / less-rice intentionally absent — it's a subtraction, not addition

  // ─── Egg add-ons ───────────────────────────────────────────
  // 采购蛋类按 SKU 合并：荷包蛋 + 拌饭炒蛋都计入「鸡蛋(生)」(2026-06-29 合并)，
  // 库存/采购汇总只看一个鸡蛋总数。做法看 add-on 标签 / 菜名区分，不靠食材名分桶：
  //   荷包蛋(标签) = sunny-side-up 单独煎好放上桌 → 计 鸡蛋(生)
  //   鸡蛋(生)     = 打散用于炒（蒜蓉西兰花炒蛋 add-on）
  //   温泉蛋       = onsen 低温慢煮，仍单列（如要也并入鸡蛋再说）
  '荷包蛋': [{ name: '鸡蛋(生)', qty: 1, unit: '颗' }],
  '温泉蛋': [{ name: '温泉蛋', qty: 1, unit: '颗' }],

  // ─── Broccoli egg side ────────────────────────────────────
  '蒜蓉西兰花炒蛋': [
    { name: '西兰花', qty: 200, unit: 'g' },
    { name: '鸡蛋(生)', qty: 3, unit: '颗' },
  ],

  // ─── Potato fried egg side ────────────────────────────────
  '马铃薯煎蛋': [
    { name: '马铃薯', qty: 150, unit: 'g' },
    { name: '鸡蛋(生)', qty: 2, unit: '颗' },
  ],

  // ─── Generic sides (40g format) ───────────────────────────
  '清甜水煮毛豆仁 (25g)': [{ name: '毛豆', qty: 25, unit: 'g' }],
  // 2026-07-15 玉米全局 25g→30g（老板拍板）。价格不变 RM2.50。
  '金黄甜玉米 (30g)': [{ name: '玉米', qty: 30, unit: 'g' }],
  // 2026-07-14 全局 40g→20g（老板拍板）；备料按颗：20g ÷ 15g/颗 ≈ 1.33 →
  // 取 2 颗（宁多勿少，同 40g→3 颗的取整惯例）。价格不变 RM2.50。
  '爽脆多汁小番茄 (20g)': [{ name: '樱桃番茄', qty: 2, unit: '颗' }],
  // legacy labels (历史 / 改版前已下的在途订单仍能正确聚合备料)
  '清甜水煮毛豆仁 (40g)': [{ name: '毛豆', qty: 40, unit: 'g' }],
  '金黄甜玉米 (25g)': [{ name: '玉米', qty: 25, unit: 'g' }],
  '金黄甜玉米 (40g)': [{ name: '玉米', qty: 40, unit: 'g' }],
  // 40g ÷ 15g/颗 ≈ 2.7 → 3 颗
  '爽脆多汁小番茄 (40g)': [{ name: '樱桃番茄', qty: 3, unit: '颗' }],

  // ─── Natto menu add-ons ────────────────────────────────────
  '健康发酵纳豆': [{ name: '纳豆', qty: 1, unit: '盒' }],
  '海苔': [{ name: '海苔', qty: 3, unit: 'g' }],
  '秘制日本酱油': [{ name: '酱油', qty: 20, unit: 'ml' }],

  // ─── Surf & Turf add-ons ───────────────────────────────────
  '鲜甜大虾仁 (4只)': [{ name: 'PD31/40 虾', qty: 4, unit: '只' }],
  '嫩炒鸡丁 (50g)': [{ name: '鸡胸肉', qty: 65, unit: 'g' }],
  '脆爽云耳 (20g)': [{ name: '云耳', qty: 20, unit: 'g' }],
  '鲜脆山药块 (90g)': [{ name: '山药', qty: 90, unit: 'g' }],

  // ─── Chicken Chop add-on ───────────────────────────────────
  '加香煎金鸡扒 (150g)': [{ name: '鸡扒', qty: 1, unit: '块' }],

  // ─── Lemon Salmon add-on ───────────────────────────────────
  // 客人标签 70g+ = 熟重；采购生重与主菜同口径 120g。
  // 老板 2026-08-01 确认：120g 生 → 70g 熟（失水 ~42%），120g 转正。
  '加香煎三文鱼 (70g+)': [{ name: '三文鱼', qty: 120, unit: 'g' }],

  // ─── Sweet & Sour Pork Chop add-on ────────────────────────
  // 与主菜同口径：按「块」计，独立采购 SKU（不与鸡扒/花肉合并）。
  '加甜酸猪扒 (1块)': [{ name: '猪扒', qty: 1, unit: '块' }],

  // ─── Glazed Unagi add-on ───────────────────────────────────
  // 与主菜同口径：主菜每份 0.5 片，加料就是再来 0.5 片（老板 2026-07-31
  // 给的进价 RM 5.225 就是「半片」的价，按片计不拆克数）。
  '【照烧加倍】加照烧鳗鱼 (0.5片)': [{ name: '鳗鱼', qty: 0.5, unit: '片' }],

  // ─── Ginger-Scallion Fish add-on ───────────────────────────
  // 老板 2026-07-16 拍板：120g = 熟重，材料与主菜的鱼部分一份完全一样
  // （巴丁鱼片 250g 生重 + 姜葱同量；饭/蛋不在加料内）。
  '加姜葱鱼片 (120g)': [
    { name: '巴丁鱼片', qty: 250, unit: 'g' },
    { name: '葱', qty: 32, unit: 'g' },
    { name: '姜', qty: 12, unit: 'g' },
  ],

  // ─── Shaoxing / Taucu pork belly add-ons ───────────────────
  // 100g 按熟重口径估算：主菜 140g 生重 → 熟重 ≥90g（缩水约 35%），
  // 100g 熟 ≈ 156g 生 → 取整 160g（宁多勿少惯例）。
  // 老板 2026-08-01 批准沿用此折算（与鸡胸同日转正；碗妈有实测再校准）。
  '【酒香入魂】加绍兴花肉 (100g)': [{ name: '顶级无皮五花肉', qty: 160, unit: 'g' }],
  '【家乡浓香】加豆酱花肉 (100g)': [{ name: '顶级无皮五花肉', qty: 160, unit: 'g' }],
  // 50g 熟 ≈ 78g 生 → 取整 80g（同上缩水比例，宁多勿少）。
  '【小酌怡情】加绍兴花肉 (50g)': [{ name: '顶级无皮五花肉', qty: 80, unit: 'g' }],
  '【小碗解馋】加豆酱花肉 (50g)': [{ name: '顶级无皮五花肉', qty: 80, unit: 'g' }],

  // ─── Japanese Curry Rice add-on ────────────────────────────
  // 沿用「嫩炒鸡丁 (50g) = 65g 鸡胸肉生重」同款换算。
  // TODO_CONFIRM: 碗妈确认后更新。
  '【滑嫩多汁】加咖喱鸡丁 (50g)': [{ name: '鸡胸肉', qty: 65, unit: 'g' }],

  // ─── Wagyu Patty Don add-ons ───────────────────────────────
  '加澳洲和牛饼 (1块)': [{ name: '澳洲和牛饼', qty: 1, unit: '块' }],
  // 小番茄洋葱沙拉（RM4.50）：小番茄 40g 按 3 颗计（同「爽脆多汁小番茄 (40g)」
  // 换算，宁多勿少）；初榨橄榄油/盐按 pantry staples 惯例不计。
  // TODO_CONFIRM: 洋葱每份克数老板未提供 → 不编造不计入，拿到准数后补一行
  // { name: '黄洋葱', qty: X, unit: 'g' }。
  '小番茄洋葱沙拉 (40g)': [{ name: '樱桃番茄', qty: 3, unit: '颗' }],

  // ─── Greek Lemon Chicken add-ons ──────────────────────────
  // 2026-08-01 老板拍板加购鸡胸 180g → 150g（价不变，id 不动只换标签）。
  // 生重按旧标签的同一折算比例：180g 标签 = 200g 生重 → 150g ≈ 166.7g，
  // 取整 170g（宁多勿少惯例）。老板 2026-08-01 批准按此折算（碗妈有实测再校准）。
  '【增肌极客】加柠香烤鸡胸 (150g)': [{ name: '鸡胸肉', qty: 170, unit: 'g' }],
  // legacy 180g 标签（改版前在途订单仍按旧份量备料聚合）
  '【增肌极客】加柠香烤鸡胸 (180g)': [{ name: '鸡胸肉', qty: 200, unit: 'g' }],
  '【优质碳水】加马铃薯 (90g)': [{ name: '马铃薯', qty: 100, unit: 'g' }],
  '【抗氧高纤】加脆甜椰菜花 (80g)': [{ name: '椰菜花', qty: 100, unit: 'g' }],
  '【地中海风味】加提鲜黑橄榄 (12g)': [{ name: '黑橄榄', qty: 12, unit: 'g' }],

  // ─── Chicken Leg specials (Tuesday / Wednesday) ────────────
  '【犒劳自己】多加一只暖胃全鸡腿': [{ name: '鸡全腿', qty: 1, unit: '只' }],
  '【犒劳自己】多加一只酱油全鸡腿': [{ name: '鸡全腿', qty: 1, unit: '只' }],

  // ─── Scallion Chicken Soup add-on ─────────────────────────
  '【收工犒劳】多加一只葱香煎鸡扒': [{ name: '鸡扒', qty: 1, unit: '块' }],

  // ─── Pork Belly Stew add-ons ──────────────────────────────
  '【绵密软糯】加马铃薯 (90g)': [{ name: '马铃薯', qty: 100, unit: 'g' }],
  '【浓香入味】加花肉片 (70g)': [{ name: '五花肉', qty: 125, unit: 'g' }],

  // ─── Daikon Pork Belly add-on (新菜 30 专属，2026-08-09) ────
  // ⚠️ TODO_CONFIRM: 老板只给了「90g 白萝卜」这一个数，没说是生重还是焖后熟重。
  // 这里先按 1:1 记 90g 生萝卜（同「鲜脆山药块 (90g) → 山药 90g」惯例），
  // 不套用马铃薯/椰菜花那种「宁多勿少」加成 —— 焖煮缩水率没实测数据，
  // 绝不凭空编系数。碗妈给实测后连同主菜本身的克数（dishRecipes 里 30 号
  // 仍是空数组）一起校准。
  '【清甜解腻】加白萝卜 (90g)': [{ name: '白萝卜', qty: 90, unit: 'g' }],

  // ─── Combos (composite add-ons) ────────────────────────────
  // Each combo is a bundle of single add-ons at a discount. The recipe
  // mirrors the bundle's `extraDesc` in AddOnModal.tsx — KEEP IN SYNC
  // if marketing changes a combo's contents.

  // natto-super-combo: 温泉蛋 + 海苔 + 酱油
  // 2026-08-01 标签原价 6.0 → 6.50 修正（组件单点 3.00+2.00+1.50，明细上墙后
  // 旧数字对不上）。旧标签留 legacy 供在途订单聚合。
  '灵魂三件套 (原价 RM 6.50)': [
    { name: '温泉蛋', qty: 1, unit: '颗' },
    { name: '海苔', qty: 3, unit: 'g' },
    { name: '酱油', qty: 20, unit: 'ml' },
  ],
  '灵魂三件套 (原价 RM 6.0)': [
    { name: '温泉蛋', qty: 1, unit: '颗' },
    { name: '海苔', qty: 3, unit: 'g' },
    { name: '酱油', qty: 20, unit: 'ml' },
  ],

  // surf-turf-super-combo: 大虾 4只 + 嫩炒鸡丁 + 云耳
  '海陆澎湃三件套 (原价 RM 14.0)': [
    { name: 'PD31/40 虾', qty: 4, unit: '只' },
    { name: '鸡胸肉', qty: 65, unit: 'g' },
    { name: '云耳', qty: 20, unit: 'g' },
  ],

  // chicken-chop-nostalgia-combo: 多加 1 块 鸡扒 + 荷包蛋 + 加饭
  '古早味大满贯三件套 (原价 RM 15.40)': [
    { name: '鸡扒', qty: 1, unit: '块' },
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // greek-protein-bomb-combo: 加柠香鸡胸 + 加马铃薯 + 加椰菜花
  // 2026-08-01 鸡胸随单点档 180g→150g 同步（200g→170g 生重，见上方折算注）。
  '蛋白质核弹三件套 (原价 RM 18.40)': [
    { name: '鸡胸肉', qty: 170, unit: 'g' },
    { name: '马铃薯', qty: 100, unit: 'g' },
    { name: '椰菜花', qty: 100, unit: 'g' },
  ],

  // scallion-soup-combo: 鸡扒 + 荷包蛋 + 加饭 (same recipe as nostalgia combo)
  '爆量满足三件套 (原价 RM 15.40)': [
    { name: '鸡扒', qty: 1, unit: '块' },
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // pork-potato-duo-combo: 马铃薯 + 花肉
  '薯肉双拼满足套 (原价 RM 15.40)': [
    { name: '马铃薯', qty: 100, unit: 'g' },
    { name: '五花肉', qty: 125, unit: 'g' },
  ],

  // shaoxing-pork-combo: 绍兴花肉 100g + 荷包蛋 + 加饭
  '酒香干饭套 (原价 RM 19.40)': [
    { name: '顶级无皮五花肉', qty: 160, unit: 'g' },
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // taucu-rice-king-combo: 蒜蓉西兰花炒蛋 + 荷包蛋 + 加饭（2026-08-01 方案 A，
  // 结构与甜酸下饭套一致；旧「阿嫲下饭王套」花肉版退役，两代旧标签留 legacy
  // 供在途订单聚合）。
  '家乡下饭王套 (原价 RM 15.40)': [
    { name: '西兰花', qty: 200, unit: 'g' },
    { name: '鸡蛋(生)', qty: 4, unit: '颗' }, // 炒蛋 3 颗 + 荷包蛋 1 颗
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],
  '阿嫲下饭王套 (原价 RM 20.00)': [
    { name: '顶级无皮五花肉', qty: 160, unit: 'g' },
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],
  '阿嫲下饭王套 (原价 RM 19.40)': [
    { name: '顶级无皮五花肉', qty: 160, unit: 'g' },
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // curry-trio-combo: 咖喱鸡丁 50g + 温泉蛋 + 加饭
  '咖喱控三件套 (原价 RM 9.50)': [
    { name: '鸡胸肉', qty: 65, unit: 'g' },
    { name: '温泉蛋', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // sweetsour-chop-combo: 蒜蓉西兰花炒蛋 + 荷包蛋 + 加饭
  '甜酸下饭套 (原价 RM 15.40)': [
    { name: '西兰花', qty: 200, unit: 'g' },
    { name: '鸡蛋(生)', qty: 4, unit: '颗' }, // 炒蛋 3 颗 + 荷包蛋 1 颗
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // sweetsour-rice-combo: 荷包蛋 + 加饭 + 毛豆 25g
  '猪扒干饭套 (原价 RM 7.00)': [
    { name: '鸡蛋(生)', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
    { name: '毛豆', qty: 25, unit: 'g' },
  ],

  // unagi-double-combo: 加鳗鱼 0.5片 + 温泉蛋 + 加饭
  // （主菜自带 0.5 片 + 这里再 0.5 片 = 客人碗里整整一片）
  '双倍鳗鱼丼套 (原价 RM 23.50)': [
    { name: '鳗鱼', qty: 0.5, unit: '片' },
    { name: '温泉蛋', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
  ],

  // unagi-rice-combo: 温泉蛋 + 加饭 + 毛豆 25g
  '照烧干饭套 (原价 RM 7.50)': [
    { name: '温泉蛋', qty: 1, unit: '颗' },
    { name: '白饭', qty: 70, unit: 'g' }, // 加饭生重 70g（150g 熟重的生米量）
    { name: '毛豆', qty: 25, unit: 'g' },
  ],

  // salmon-protein-duo-combo: 蒜蓉西兰花炒蛋 + 温泉蛋（与单点版同份量）
  '柠香双蛋白套 (原价 RM 13.90)': [
    { name: '西兰花', qty: 200, unit: 'g' },
    { name: '鸡蛋(生)', qty: 3, unit: '颗' },
    { name: '温泉蛋', qty: 1, unit: '颗' },
  ],

  // salmon-tricolor-combo: 毛豆 25g + 玉米 30g + 小番茄 20g（各等于单点一份）
  '三色加倍套 (原价 RM 7.50)': [
    { name: '毛豆', qty: 25, unit: 'g' },
    { name: '玉米', qty: 30, unit: 'g' },
    { name: '樱桃番茄', qty: 2, unit: '颗' }, // 20g ÷ 15g/颗 ≈ 1.33 → 取 2 颗（同单点版）
  ],

  // ─── TODO_RECIPE (data not provided yet) ───────────────────
  // '马铃薯煎蛋' (potato-egg / potato-egg-alacarte) — still missing
  //   ingredient breakdown; user hasn't given portion sizes.
};

// ─── Lookup helpers ──────────────────────────────

const recipeByName = new Map<string, DishRecipe>(
  dishRecipes.map(r => [r.name, r]),
);

export function getRecipeForDish(dishName: string): DishRecipe | undefined {
  return recipeByName.get(dishName);
}

export function getAddOnRecipe(label: string): IngredientLine[] | undefined {
  return addOnRecipes[label];
}

/**
 * Look up the 2-char display name for the daily-prep order matrix.
 * Falls back to the first 2 chars of the full name if no shortName
 * configured — so a new dish added to weeklyMenu.ts before its recipe
 * lands here still renders in the grid (just less prettily).
 */
export function getDishShortName(dishName: string): string {
  const recipe = recipeByName.get(dishName);
  if (recipe?.shortName) return recipe.shortName;
  // Best-effort fallback: first 2 CJK chars
  const chars = Array.from(dishName);
  return chars.slice(0, 2).join('') || dishName;
}

/**
 * Short display names for add-ons in the matrix view. Multiple cart
 * labels can collapse to the same short name (e.g. both the Greek meal
 * "【优质碳水】加马铃薯 (90g)" and the Pork Belly meal "【绵密软糯】加马铃薯
 * (90g)" become "马铃薯") — that's intentional, BowlMama preps potato
 * once regardless of which parent dish it ships with.
 */
export const addOnShortNames: Record<string, string> = {
  // Rice swaps
  '白饭换糙米 (180g)': '糙米',
  '换糙米': '糙米',
  '加饭 (150g)': '加饭',
  '加饭': '加饭',
  '少饭 (150g)': '少饭',
  '少饭': '少饭',

  // Eggs
  '荷包蛋': '荷包',
  '温泉蛋': '温泉',
  '马铃薯煎蛋': '薯煎蛋',
  '蒜蓉西兰花炒蛋': '西兰花蛋',
  '鲜虾西兰花滑蒸蛋': '鲜虾蛋',

  // Generic sides (current + legacy gram labels)
  '清甜水煮毛豆仁 (25g)': '毛豆',
  '金黄甜玉米 (30g)': '玉米',
  '金黄甜玉米 (25g)': '玉米',
  '爽脆多汁小番茄 (20g)': '番茄',
  '清甜水煮毛豆仁 (40g)': '毛豆',
  '金黄甜玉米 (40g)': '玉米',
  '爽脆多汁小番茄 (40g)': '番茄',

  // Natto menu
  '健康发酵纳豆': '纳豆',
  '海苔': '海苔',
  '秘制日本酱油': '酱油',

  // Surf & Turf
  '鲜甜大虾仁 (4只)': '大虾',
  '嫩炒鸡丁 (50g)': '鸡丁',
  '脆爽云耳 (20g)': '云耳',
  '鲜脆山药块 (90g)': '山药',

  // Chicken Chop
  '加香煎金鸡扒 (150g)': '加鸡扒',

  // Lemon Salmon / Wagyu Patty Don
  '加香煎三文鱼 (70g+)': '三文鱼',
  '加澳洲和牛饼 (1块)': '和牛饼',
  '小番茄洋葱沙拉 (40g)': '茄沙拉',

  // Greek Lemon Chicken
  '【增肌极客】加柠香烤鸡胸 (150g)': '柠胸',
  '【增肌极客】加柠香烤鸡胸 (180g)': '柠胸',  // legacy 180g 标签
  '【优质碳水】加马铃薯 (90g)': '马铃薯',
  '【抗氧高纤】加脆甜椰菜花 (80g)': '椰菜花',
  '【地中海风味】加提鲜黑橄榄 (12g)': '黑橄榄',

  // Chicken leg specials
  '【犒劳自己】多加一只暖胃全鸡腿': '加鸡腿',
  '【犒劳自己】多加一只酱油全鸡腿': '加酱腿',
  '【收工犒劳】多加一只葱香煎鸡扒': '加鸡扒',

  // Pork belly stew
  '【绵密软糯】加马铃薯 (90g)': '马铃薯',
  '【浓香入味】加花肉片 (70g)': '花肉',

  // 白萝卜焖花肉 add-on（2026-08-09）—— 主菜 shortName 已占用「萝卜」，
  // 加料用「加萝卜」区分，否则备餐矩阵会出现两列同名分不清。
  '【清甜解腻】加白萝卜 (90g)': '加萝卜',

  // 2026-07-16 new dish-special add-ons
  '加姜葱鱼片 (120g)': '姜鱼片',
  '【酒香入魂】加绍兴花肉 (100g)': '绍肉',
  '【小酌怡情】加绍兴花肉 (50g)': '绍肉',
  '【家乡浓香】加豆酱花肉 (100g)': '豆酱肉',
  '【小碗解馋】加豆酱花肉 (50g)': '豆酱肉',
  '【滑嫩多汁】加咖喱鸡丁 (50g)': '咖鸡丁',

  // Combos (composite — single token in matrix, ingredients still expand in 🛒)
  '灵魂三件套 (原价 RM 6.50)': '纳豆套',
  '灵魂三件套 (原价 RM 6.0)': '纳豆套',   // legacy 标签
  '海陆澎湃三件套 (原价 RM 14.0)': '海陆套',
  '古早味大满贯三件套 (原价 RM 15.40)': '鸡扒套',
  '蛋白质核弹三件套 (原价 RM 18.40)': '希胸套',
  '爆量满足三件套 (原价 RM 15.40)': '葱汤套',
  '薯肉双拼满足套 (原价 RM 15.40)': '薯肉套',
  '酒香干饭套 (原价 RM 19.40)': '绍肉套',
  '家乡下饭王套 (原价 RM 15.40)': '家乡套',  // 2026-08-01 方案 A 新套
  '阿嫲下饭王套 (原价 RM 20.00)': '豆酱套',  // legacy（花肉版退役）
  '阿嫲下饭王套 (原价 RM 19.40)': '豆酱套',  // legacy 标签
  '咖喱控三件套 (原价 RM 9.50)': '咖喱套',
  // 2026-07-31 新增
  '【照烧加倍】加照烧鳗鱼 (0.5片)': '加鳗鱼',
  '柠香双蛋白套 (原价 RM 13.90)': '双蛋套',
  '三色加倍套 (原价 RM 7.50)': '三色套',
  '双倍鳗鱼丼套 (原价 RM 23.50)': '双鳗套',
  '照烧干饭套 (原价 RM 7.50)': '照烧套',
  '加甜酸猪扒 (1块)': '加猪扒',
  '甜酸下饭套 (原价 RM 15.40)': '甜酸套',
  '猪扒干饭套 (原价 RM 7.00)': '猪扒套',
};

export function getAddOnShortName(label: string): string {
  if (addOnShortNames[label]) return addOnShortNames[label];
  // Best-effort: strip any 【...】 prefix and any trailing (XYg) suffix,
  // then take the result. Better than nothing for new add-ons.
  return label.replace(/^【[^】]+】/, '').replace(/\s*\([^)]*\)$/, '').trim() || label;
}

// ─── Manual-order (dashboard) label aliases ──────────────────────
/**
 * The standalone dashboard's manual add-on picker (DISH_ADDON_MAP in
 * public/dashboard-h7x2q9.html) stores SHORTENED labels — it drops the 【…】
 * marketing prefix or the "(原价 RM …)" combo suffix the web cart uses. Orders
 * persist the label string and the prep aggregator (src/lib/prepIngredients.ts)
 * keys ingredients BY LABEL, so every manual add-on whose short label ≠ the
 * web-cart label silently contributed 0 ingredients — e.g. two extra chicken
 * legs (1 manual "多加一只暖胃全鸡腿" + 1 web "【犒劳自己】多加一只暖胃全鸡腿")
 * showed up as "鸡全腿 1只" in the 食材清单.
 *
 * Register each manual label as an alias of its web-cart twin so BOTH resolve
 * to the SAME recipe — no ingredient data duplicated. When you add a new
 * shortened label to the dashboard picker, add its alias here.
 */
const MANUAL_LABEL_ALIASES: Record<string, string> = {
  // Chicken-leg / chicken-chop specials (drop 【…】 prefix)
  '多加一只暖胃全鸡腿': '【犒劳自己】多加一只暖胃全鸡腿',
  '多加一只酱油全鸡腿': '【犒劳自己】多加一只酱油全鸡腿',
  '加葱香煎鸡扒': '【收工犒劳】多加一只葱香煎鸡扒',
  // Greek / pork-belly à-la-carte sides (drop 【…】 prefix)
  '加柠香烤鸡胸 (150g)': '【增肌极客】加柠香烤鸡胸 (150g)',
  '加柠香烤鸡胸 (180g)': '【增肌极客】加柠香烤鸡胸 (180g)',  // legacy 手动标签（改版前在途订单）
  '加马铃薯 (90g)': '【优质碳水】加马铃薯 (90g)',     // 同 100g 马铃薯，与花肉版等价
  '加脆甜椰菜花 (80g)': '【抗氧高纤】加脆甜椰菜花 (80g)',
  '加提鲜黑橄榄 (12g)': '【地中海风味】加提鲜黑橄榄 (12g)',
  '加花肉片 (70g)': '【浓香入味】加花肉片 (70g)',
  // Plain-named sides (web uses a descriptive prefix)
  '毛豆仁 (25g)': '清甜水煮毛豆仁 (25g)',
  '甜玉米 (30g)': '金黄甜玉米 (30g)',
  '甜玉米 (25g)': '金黄甜玉米 (25g)',  // legacy 手动标签（改版前在途订单）
  '小番茄 (20g)': '爽脆多汁小番茄 (20g)',
  '小番茄 (40g)': '爽脆多汁小番茄 (40g)',  // legacy 手动标签（改版前在途订单）
  // Combos (drop "(原价 RM …)" suffix) — 指向现行标签；旧原价标签仍是独立
  // recipe key（legacy），显示层 cleanAddOnLabel 剥后缀后自动并成一行。
  '灵魂三件套': '灵魂三件套 (原价 RM 6.50)',
  '海陆澎湃三件套': '海陆澎湃三件套 (原价 RM 14.0)',
  '古早味大满贯三件套': '古早味大满贯三件套 (原价 RM 15.40)',
  '蛋白质核弹三件套': '蛋白质核弹三件套 (原价 RM 18.40)',
  '爆量满足三件套': '爆量满足三件套 (原价 RM 15.40)',
  '薯肉双拼满足套': '薯肉双拼满足套 (原价 RM 15.40)',
  '酒香干饭套': '酒香干饭套 (原价 RM 19.40)',
  '家乡下饭王套': '家乡下饭王套 (原价 RM 15.40)',
  '阿嫲下饭王套': '阿嫲下饭王套 (原价 RM 20.00)',  // legacy（花肉版退役，历史手动单仍解析）
  '咖喱控三件套': '咖喱控三件套 (原价 RM 9.50)',
  '柠香双蛋白套': '柠香双蛋白套 (原价 RM 13.90)',
  '三色加倍套': '三色加倍套 (原价 RM 7.50)',
  '双倍鳗鱼丼套': '双倍鳗鱼丼套 (原价 RM 23.50)',
  '照烧干饭套': '照烧干饭套 (原价 RM 7.50)',
  '甜酸下饭套': '甜酸下饭套 (原价 RM 15.40)',
  '猪扒干饭套': '猪扒干饭套 (原价 RM 7.00)',
  // Unagi half-fillet (drop 【…】 prefix)
  '加照烧鳗鱼 (0.5片)': '【照烧加倍】加照烧鳗鱼 (0.5片)',
  // Rice swap — manual short label has its OWN recipe entry above (loop skips
  // it), listed here purely so the prep sheet's source tag unifies to one line
  // (was "糙米 180g（换糙米）· 糙米 90g（白饭换糙米）"; boss 2026-07-02).
  '换糙米': '白饭换糙米 (180g)',
};
for (const [manual, web] of Object.entries(MANUAL_LABEL_ALIASES)) {
  if (addOnRecipes[web] && !addOnRecipes[manual]) addOnRecipes[manual] = addOnRecipes[web];
  if (addOnShortNames[web] && !addOnShortNames[manual]) addOnShortNames[manual] = addOnShortNames[web];
}

/**
 * Canonical (web-cart) label for any order-stored add-on label. The prep
 * sheet's per-source tags must resolve BOTH spellings of the same add-on to
 * ONE tag, or the ingredient shows as two lines (e.g. 换糙米 vs 白饭换糙米).
 * Recipes already unify via the alias loop above; this unifies DISPLAY.
 */
export function resolveAddOnAlias(label: string): string {
  return MANUAL_LABEL_ALIASES[label] || label;
}

// Legacy manual-only multi-leg labels (no web-cart twin) — N× the single leg.
if (!addOnRecipes['加 2 只暖胃鸡腿 (legacy)']) addOnRecipes['加 2 只暖胃鸡腿 (legacy)'] = [{ name: '鸡全腿', qty: 2, unit: '只' }];
if (!addOnRecipes['加 3 只暖胃鸡腿 (legacy)']) addOnRecipes['加 3 只暖胃鸡腿 (legacy)'] = [{ name: '鸡全腿', qty: 3, unit: '只' }];

// ⚠️ TODO_RECIPE: '虾仁炒蛋' (shrimp-egg, RM 12.90) — appears in every dish's
// manual picker but has NO portion data (虾 only count / 鸡蛋 colon unknown).
// Left unmatched on purpose — DO NOT fabricate quantities. Add a recipe in
// addOnRecipes once the boss provides the 虾/蛋 portion sizes.
//
// ⚠️ TODO_RECIPE: '鲜虾西兰花滑蒸蛋' (shrimp-broccoli-steamed-egg, RM 6.80) —
// new 2026-06-29 universal add-on (every dish's manual picker). NO portion data
// yet (虾只数 / 西兰花 g / 蛋颗数 unknown). shortName '鲜虾蛋' registered for the
// matrix, but NO addOnRecipes entry — DO NOT fabricate. Add the recipe once the
// boss provides the 虾/西兰花/蛋 portions; then it auto-aggregates in prep.

// ─── Intentionally untracked items ───────────────────────────────
/**
 * Items that legitimately have NO ingredient recipe and should NOT appear in
 * the「未计食材」warning (they'd be daily noise): bottled/brewed drinks whose
 * ingredients aren't stock-tracked, and 少饭 which is a subtraction. Anything
 * NOT in this set and missing a recipe (e.g. 虾仁炒蛋 / 鲜虾西兰花滑蒸蛋 /
 * empty-recipe new dishes) DOES get flagged — that's the point.
 */
export const UNTRACKED_OK = new Set<string>([
  '龙井 (冰)', '龙井 (温)',
  '铁观音 (冰)', '铁观音 (温)',
  '水仙 (冰)', '水仙 (温)',
  '少饭 (150g)', '少饭',
]);
