/**
 * 按菜品定制的加料弹窗配置：专属套餐、专属配菜、单点过滤。
 *
 * 2026-09-05 C2 搬家：原先是 AddOnModal.tsx 里 18 个 `if (dish.id === N)` 分支各自
 * 手拼分区；现在每道菜一条数据，`buildAddOnSections`（components/menu/addOnSections.ts）
 * 是唯一的组装器。**这里只有数据**——价格由 builder 拿 ADD_ON_PRICES 现查，`fallback`
 * 是原来 `p('id', N)` 的第二个参数（表里缺 id 才用到，正常永远走不到）。
 *
 * 几条别踩的线（都是从原分支注释搬过来的）：
 *   · 套餐 `item.name` 里的静态「(原价 RM x)」是订单/备餐 label key
 *     （dishIngredients / COMBO_COMPONENTS 按它查配方），组件调价时才手动改它并保留
 *     legacy key。弹窗里那句「单点合计 RM x，立省 RM y」是 comboWorth 现算的，不用手改。
 *   · 加料 id 是订单 key，改份量/文案只换 name，id 不动（extra-greek-chicken-180g、
 *     extra-daikon-90g 都是这个原因留着旧数字）。
 *   · 加料 name 必须逐字对上 dishIngredients 的 addOnRecipes label，改名就静默算 0 食材。
 *   · 新增套餐要同时登记 COMBO_COMPONENTS（备餐拆解）+ dashboard 加料表，
 *     见 [[project_addon_combo_six_touchpoints]]。
 */

/** 一行专属配菜（= AddOnItem 去掉 price/category：price 现查，category 固定 'sides'）。 */
export interface SideDef {
    id: string;
    name: string;
    nameEn: string;
    /** ADD_ON_PRICES 缺此 id 时的兜底价（原 p() 第二个参数）。 */
    fallback: number;
    maxQty?: number;
}

/** 套餐的一个组件：id + 兜底价 + 「包含：」那行里的显示名（中/英）。 */
export interface ComboPart {
    id: string;
    fallback: number;
    label: string;
    labelEn: string;
}

export interface DishCombo {
    /** 分区 id（AddOnSection.id）。 */
    sectionId: string;
    title: string;
    titleEn: string;
    /** EN 渲染专用主标题（titleEn 混了中文时用它兜底）。 */
    titleDisplayEn?: string;
    /** 套餐商品本身；name 里的「(原价 RM x)」是订单/备餐 label key，别动。 */
    item: { id: string; name: string; nameEn: string; fallback: number };
    /** 组件顺序 = 「包含：」行的顺序 = comboWorth 的求和顺序。 */
    parts: ComboPart[];
    /** 「包含：…」行下面那句卖点（中/英），引号自带。 */
    quote: string;
    quoteEn: string;
}

export interface DishComboConfig {
    /** 专属套餐区，按顺序排在默认分区前面。 */
    combos?: DishCombo[];
    /**
     * 专属配菜：`items` 排在默认配菜（少饭/加饭/糙米）前面；`dropBase` 是要从默认
     * 配菜里拿掉的 id。
     */
    sides?: { items: SideDef[]; dropBase?: string[] };
    /** 从默认「单点」区里拿掉的 id（通常是已经挪进专属配菜、避免同 id 出现两次）。 */
    alacarteExclude?: string[];
}

// ─── 反复出现的套餐组件 ─────────────────────────────────────────────────────

const BROCCOLI_EGG: ComboPart = { id: 'broccoli-egg', fallback: 10.9, label: '蒜蓉西兰花炒蛋', labelEn: 'garlic broccoli with soft-scrambled egg' };
const SUNNY_EGG: ComboPart = { id: 'sunny-egg', fallback: 2.5, label: '古早味荷包蛋', labelEn: 'old-school sunny-side-up egg' };
const ONSEN_EGG: ComboPart = { id: 'onsen-egg', fallback: 3, label: '浓厚温泉蛋', labelEn: 'rich onsen egg' };
const BRAISED_EGG: ComboPart = { id: 'braised-egg', fallback: 3, label: '古早味卤蛋', labelEn: 'braised soy egg' };
const EXTRA_RICE: ComboPart = { id: 'extra-rice', fallback: 2, label: '加饭 150g', labelEn: 'extra rice 150g' };
const EDAMAME: ComboPart = { id: 'extra-edamame', fallback: 2.5, label: '清甜毛豆 25g', labelEn: '25g edamame' };

/** 「下饭套」家族：西兰花炒蛋 + 荷包蛋 + 加饭（家乡/甜酸/古早味/归香/酒香 共用）。 */
const RICE_KING_PARTS: ComboPart[] = [BROCCOLI_EGG, SUNNY_EGG, EXTRA_RICE];

// ─── 逐菜配置（顺序保持原 AddOnModal 分支顺序）────────────────────────────────

// Golden Crispy Chicken Chop (now daily, id: 14) 与 Honey Lemon Glazed Chicken Chop
// (id: 26) 共用一套：柠扒与鸡扒同系列，配菜+三件套整套看齐（老板 2026-07-14 拍板）。
//
// 2026-08-16 鸡扒调价 10.90→12.90，旧「古早味澎湃大满贯三件套」当场穿帮
// （原价变 17.40 但售价 12.90 = 单点一块鸡扒价，蛋+饭白送）。数据也不支持它：
// 11 个周次快照里加鸡扒累计只卖 2 次、旧套 6 周共 6 次，而荷包蛋 17 / 西兰花
// 炒蛋 9 / 加饭 8 —— 鸡扒饭自带毛豆玉米番茄却没酱汁，客人缺的是湿润度和绿色。
// 换互补型「古早味下饭套」，结构照抄已验证的家乡下饭王套/甜酸下饭套/酒香下饭套。
const CHICKEN_CHOP: DishComboConfig = {
    combos: [{
        sectionId: 'chicken-chop-combo',
        title: '✨ 古早味下饭套',
        titleEn: 'Nostalgia Rice King Set (+ RM 12.90)',
        item: { id: 'chicken-chop-rice-king-combo', name: '古早味下饭套 (原价 RM 15.40)', nameEn: 'Nostalgia Rice King Set', fallback: 12.90 },
        parts: RICE_KING_PARTS,
        quote: '"焦香鸡扒配白饭，就差一口湿润和青——蒜香西兰花炒蛋补上，再戳破流心荷包蛋捞饭，一口都不干。"',
        quoteEn: '"A seared chop needs greens and a runny yolk — garlicky broccoli-egg and a burst of yolk keep every bite moist."',
    }],
    sides: {
        items: [
            { id: 'extra-chicken-chop', name: '加香煎金鸡扒 (150g)', nameEn: 'Extra Chicken Chop (150g)', fallback: 12.90, maxQty: 3 },
            { id: 'extra-edamame-side', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame', fallback: 2.50, maxQty: 3 },
            { id: 'extra-corn-side', name: '金黄甜玉米 (30g)', nameEn: 'Corn', fallback: 2.50, maxQty: 3 },
            { id: 'cherry-tomato', name: '爽脆多汁小番茄 (20g)', nameEn: 'Cherry Tomato', fallback: 2.50, maxQty: 3 },
        ],
    },
    // Remove global extra-edamame and extra-corn from alacarte for this dish
    alacarteExclude: ['extra-edamame', 'extra-corn'],
};

export const DISH_COMBOS: Record<number, DishComboConfig> = {
    // Natto Rice Bowl (id: 11)
    11: {
        combos: [{
            sectionId: 'natto-combo',
            title: '✨ 升级你的 Incredibowl！',
            titleEn: '灵魂三件套 (Soulful Trio) (+ RM 5) · Max 3',
            titleDisplayEn: '✨ Upgrade your Incredibowl! Soulful Trio (+ RM 5) · Max 3',
            // 2026-08-01 原价 6.0 → 6.50 修正：组件单点价 3.00+2.00+1.50 = 6.50，
            // 旧标签的 6.0 与明细对不上（明细价上墙后客人会看出来）。
            item: { id: 'natto-super-combo', name: '灵魂三件套 (原价 RM 6.50)', nameEn: 'Soulful Trio', fallback: 5 },
            parts: [
                { id: 'onsen-egg-side', fallback: 3, label: '浓厚温泉蛋', labelEn: 'rich onsen egg' },
                { id: 'nori', fallback: 2, label: '脆质海苔', labelEn: 'crispy nori' },
                { id: 'soy-sauce', fallback: 1.5, label: '特制日本酱油', labelEn: 'special Japanese soy sauce' },
            ],
            quote: '“当酱油遇见脆爽海苔，在流心月见的温柔包裹下，瞬间唤醒纳豆沉睡的‘极鲜’灵魂。”',
            quoteEn: '"When soy sauce meets crisp nori, wrapped in a silky moon-gazing egg, natto\'s sleeping umami soul awakens."',
        }],
        sides: {
            items: [
                { id: 'natto-side', name: '健康发酵纳豆', nameEn: 'Natto', fallback: 7.90 },
                { id: 'onsen-egg-side', name: '温泉蛋', nameEn: 'Onsen Egg', fallback: 3 },
                { id: 'nori', name: '海苔', nameEn: 'Nori (Seaweed)', fallback: 2 },
                { id: 'soy-sauce', name: '秘制日本酱油', nameEn: 'Secret Japanese Soy Sauce', fallback: 1.50 },
            ],
            // 原分支只保留默认配菜里 id 含 'rice' 且不是 brown-rice 的（= 少饭/加饭），纳豆饭不给换糙米。
            dropBase: ['brown-rice'],
        },
        // Filter out onsen-egg from alacarte because it's already in sides for natto
        alacarteExclude: ['onsen-egg'],
    },

    // Chinese Yam & Black Fungus Surf & Turf (id: 12)
    12: {
        combos: [{
            sectionId: 'surf-turf-combo',
            title: '✨ 鲜上加鲜！海陆澎湃大翻倍',
            titleEn: 'Ultimate Surf & Turf Trio (+ RM 11.40)',
            item: { id: 'surf-turf-super-combo', name: '海陆澎湃三件套 (原价 RM 14.0)', nameEn: 'Ultimate Trio', fallback: 11.40 },
            parts: [
                { id: 'extra-prawns', fallback: 7, label: '鲜甜大虾仁 4只', labelEn: '4 sweet prawns' },
                { id: 'extra-chicken-breast', fallback: 4.5, label: '嫩炒鸡丁 50g', labelEn: '50g tender stir-fried chicken' },
                { id: 'extra-fungus', fallback: 2.5, label: '脆爽云耳 20g', labelEn: '20g crisp black fungus' },
            ],
            quote: '“想要大口吃肉的满足感？这是蛋白质与膳食纤维的终极爆发。”',
            quoteEn: '"Craving big bites of protein? The ultimate protein-and-fibre power-up."',
        }],
        sides: {
            items: [
                { id: 'extra-prawns', name: '鲜甜大虾仁 (4只)', nameEn: 'Extra Sweet Prawns (4pcs)', fallback: 7, maxQty: 3 },
                { id: 'extra-chicken-breast', name: '嫩炒鸡丁 (50g)', nameEn: 'Tender Shredded Chicken Breast (50g)', fallback: 4.50, maxQty: 3 },
                { id: 'extra-fungus', name: '脆爽云耳 (20g)', nameEn: 'Crisp Black Fungus (20g)', fallback: 2.50, maxQty: 3 },
                { id: 'extra-yam', name: '鲜脆山药块 (90g)', nameEn: 'Fresh Chinese Yam (90g)', fallback: 4, maxQty: 3 },
            ],
            // 历史遗留：默认配菜早已没有这两项，等于不过滤，原样搬。
            dropBase: ['sunny-egg', 'potato-egg'],
        },
    },

    14: CHICKEN_CHOP,
    26: CHICKEN_CHOP,

    // Greek Mediterranean Lemon Chicken (id: 3)
    // 2026-08-01 老板拍板：加购鸡胸份量 180g → 150g（价不变，id 仍是
    // extra-greek-chicken-180g 订单 key 不动，只换显示标签）。
    3: {
        combos: [{
            sectionId: 'greek-combo',
            title: '✨ 终极爆肌！蛋白质核弹三件套',
            titleEn: 'Ultimate Protein Bomb Trio (+ RM 15.90)',
            item: { id: 'greek-protein-bomb-combo', name: '蛋白质核弹三件套 (原价 RM 18.40)', nameEn: 'Protein Bomb Trio', fallback: 15.90 },
            parts: [
                { id: 'extra-greek-chicken-180g', fallback: 11.9, label: '150g 柠香烤鸡胸', labelEn: '150g lemon roast chicken breast' },
                { id: 'extra-aus-potato-80g', fallback: 3.5, label: '90g 马铃薯', labelEn: '90g potato' },
                { id: 'extra-cauliflower-80g', fallback: 3, label: '80g 脆甜椰菜花', labelEn: '80g sweet cauliflower' },
            ],
            quote: '“突破百克优质蛋白的终极归宿，练后快速回血、饱腹无负担。”',
            quoteEn: '"Over 100g of quality protein — fast post-workout recovery, filling without the guilt."',
        }],
        sides: {
            items: [
                { id: 'extra-greek-chicken-180g', name: '【增肌极客】加柠香烤鸡胸 (150g)', nameEn: 'Extra Lemon Chicken Breast (150g)', fallback: 11.90, maxQty: 3 },
                { id: 'extra-aus-potato-80g', name: '【优质碳水】加马铃薯 (90g)', nameEn: 'Extra Potato (90g)', fallback: 3.50, maxQty: 3 },
                { id: 'extra-cauliflower-80g', name: '【抗氧高纤】加脆甜椰菜花 (80g)', nameEn: 'Extra Cauliflower (80g)', fallback: 3, maxQty: 3 },
                { id: 'extra-black-olive-12g', name: '【地中海风味】加提鲜黑橄榄 (12g)', nameEn: 'Extra Black Olive Slice (12g)', fallback: 2.50, maxQty: 3 },
            ],
            // 历史遗留：默认配菜早已没有这两项，等于不过滤，原样搬。
            dropBase: ['sunny-egg', 'potato-egg'],
        },
    },

    // Lemon Pan-Seared Salmon (id: 21): sides carry the dish's own ingredients
    // (edamame / corn / cherry tomato) plus an extra-salmon upsell.
    // 西兰花 (50g) intentionally absent — no standalone add-on price provided yet.
    // 2026-07-31 加两个专属套餐（老板拍板）：数据说三文鱼客最常加的是
    // 蒜蓉西兰花炒蛋（7 周里 6 周排前三），而 RM18.50 的加三文鱼在约 122 份
    // 里只卖出过 1 次 —— 所以套餐围着「客人已经在买的东西」打包，不推双份鱼。
    21: {
        combos: [
            {
                sectionId: 'salmon-protein-combo',
                title: '✨ 柠香双蛋白套',
                titleEn: 'Lemon Salmon Protein Duo (+ RM 12.90)',
                item: { id: 'salmon-protein-duo-combo', name: '柠香双蛋白套 (原价 RM 13.90)', nameEn: 'Protein Duo', fallback: 12.90 },
                parts: [BROCCOLI_EGG, ONSEN_EGG],
                quote: '"香煎三文鱼配蒜香西兰花炒蛋，再戳破一颗流心温泉蛋——一碗吃满两份蛋白质。"',
                quoteEn: '"Pan-seared salmon with garlicky broccoli-egg and a silky onsen egg — two proteins in one bowl."',
            },
            {
                sectionId: 'salmon-tricolor-combo-section',
                title: '✨ 三色加倍套',
                titleEn: 'Triple Veggie Boost (+ RM 5.90)',
                item: { id: 'salmon-tricolor-combo', name: '三色加倍套 (原价 RM 7.50)', nameEn: 'Triple Veggie Boost', fallback: 5.90 },
                parts: [
                    EDAMAME,
                    { id: 'extra-corn', fallback: 2.5, label: '金黄甜玉米 30g', labelEn: '30g sweet corn' },
                    { id: 'cherry-tomato', fallback: 2.5, label: '爽脆小番茄 20g', labelEn: '20g cherry tomato' },
                ],
                quote: '"碗里本来就有的三样配色，全部加倍——每一口都咬得到。"',
                quoteEn: '"The three colours already in your bowl, doubled — something in every bite."',
            },
        ],
        sides: {
            items: [
                { id: 'extra-salmon-70g', name: '加香煎三文鱼 (70g+)', nameEn: 'Extra Pan-Seared Salmon (70g+)', fallback: 18.50, maxQty: 3 },
                { id: 'extra-edamame-side', name: '清甜水煮毛豆仁 (25g)', nameEn: 'Edamame', fallback: 2.50, maxQty: 3 },
                { id: 'extra-corn-side', name: '金黄甜玉米 (30g)', nameEn: 'Corn', fallback: 2.50, maxQty: 3 },
                { id: 'cherry-tomato', name: '爽脆多汁小番茄 (20g)', nameEn: 'Cherry Tomato', fallback: 2.50, maxQty: 3 },
            ],
        },
        // Remove global extra-edamame and extra-corn from alacarte for this dish
        alacarteExclude: ['extra-edamame', 'extra-corn'],
    },

    // Aussie Wagyu Beef Patty Don (id: 24): sides carry the dish's own
    // cherry-tomato & onion salad (tossed in extra-virgin olive oil + pinch of
    // salt — NOT the plain 'cherry-tomato' add-on) plus an extra-patty upsell.
    24: {
        sides: {
            items: [
                { id: 'extra-wagyu-patty', name: '加澳洲和牛饼 (1块)', nameEn: 'Extra Aussie Wagyu Patty (1 pc)', fallback: 17.50, maxQty: 3 },
                { id: 'cherry-tomato-salad', name: '小番茄洋葱沙拉 (40g)', nameEn: 'Cherry Tomato & Onion Salad (40g)', fallback: 4.50, maxQty: 3 },
            ],
        },
    },

    // Hometown Sweet & Sour Onion Pork Chop (id: 27): two combos + an extra-chop
    // upsell. 选品依据 analytics/weekly：这道菜销量常年前三、
    // 加料渗透 45~67%，但客单只有 RM1.78~1.85/份（当归鸡腿 4.56、姜葱鱼片 4.04）
    // —— 不是客人不肯花，是这道菜此前既没有「加主菜」也没有套餐，能加的最贵
    // 的只有西兰花炒蛋。两周稳定的前三加料是 荷包蛋 / 换糙米 / 马铃薯煎蛋，
    // 所以套餐围着荷包蛋 + 加饭做，A 档再补上这碗完全缺席的蔬菜。
    27: {
        combos: [
            {
                sectionId: 'sweetsour-chop-combo-section',
                title: '✨ 甜酸下饭套',
                titleEn: 'Sweet & Sour Rice King Set (+ RM 12.90)',
                item: { id: 'sweetsour-chop-combo', name: '甜酸下饭套 (原价 RM 15.40)', nameEn: 'Sweet & Sour Rice King Set', fallback: 12.90 },
                parts: RICE_KING_PARTS,
                quote: '"甜酸洋葱酱最缺一口青——蒜香西兰花炒蛋补上，再戳破荷包蛋捞饭，这碗才算完整。"',
                quoteEn: '"That sweet & sour sauce is begging for greens — garlicky broccoli-egg and a runny yolk over extra rice finish the bowl."',
            },
            {
                sectionId: 'sweetsour-rice-combo-section',
                title: '✨ 猪扒干饭套',
                titleEn: 'Pork Chop Rice Set (+ RM 5.90)',
                item: { id: 'sweetsour-rice-combo', name: '猪扒干饭套 (原价 RM 7.00)', nameEn: 'Pork Chop Rice Set', fallback: 5.90 },
                parts: [SUNNY_EGG, EXTRA_RICE, EDAMAME],
                quote: '"酱汁剩在碗底最可惜——多一碗饭、一颗流心蛋、一把毛豆，一滴都不留。"',
                quoteEn: '"Never leave that sauce behind — extra rice, a runny egg and crisp edamame mop up every drop."',
            },
        ],
        sides: {
            items: [
                { id: 'extra-pork-chop', name: '加甜酸猪扒 (1块)', nameEn: 'Extra Sweet & Sour Pork Chop (1 pc)', fallback: 14.90, maxQty: 3 },
            ],
        },
    },

    // Hometown Glazed Unagi Rice (id: 29): sides carry the half-fillet upsell plus
    // 温泉蛋 (丼 classic) instead of leaving the egg buried in a la carte.
    // 海苔 老板 2026-07-31 明确不要，别再加回来。
    // 名字必须逐字是「温泉蛋」—— prepIngredients 按 add-on label 查 addOnRecipes，
    // 改名就静默算 0 食材（见 dishIngredients.ts 别名注释）。
    // 西兰花仍缺独立加料价（三文鱼饭也一样缺），故不列。
    29: {
        combos: [
            // 2026-08-01 老板要求：文案不写「0.5片」，改写「加倍成整整 1 片」
            //（碗里自带半片 + 套餐再加半片 = 1 片）。⚠️ 备餐/采购配方不变，
            // dishIngredients 里本套餐仍按 鳗鱼 0.5 片 扣——只是话术升级。
            {
                sectionId: 'unagi-double-combo-section',
                title: '✨ 双倍鳗鱼丼套',
                titleEn: 'Double Unagi Don Set (+ RM 19.90)',
                item: { id: 'unagi-double-combo', name: '双倍鳗鱼丼套 (原价 RM 23.50)', nameEn: 'Double Unagi Don Set', fallback: 19.90 },
                parts: [
                    { id: 'extra-unagi-half', fallback: 18.5, label: '照烧鳗鱼加倍成整整 1 片', labelEn: 'unagi doubled to a full fillet' },
                    ONSEN_EGG,
                    EXTRA_RICE,
                ],
                quote: '"碗里自带半片，再加半片——整整一片鳗鱼铺满碗面，戳破温泉蛋拌进照烧酱。"',
                quoteEn: '"Half comes with the bowl, half more on top — a full fillet across the rice, with a runny onsen egg in the glaze."',
            },
            {
                sectionId: 'unagi-rice-combo-section',
                title: '✨ 照烧干饭套',
                titleEn: 'Unagi Rice Set (+ RM 5.90)',
                item: { id: 'unagi-rice-combo', name: '照烧干饭套 (原价 RM 7.50)', nameEn: 'Unagi Rice Set', fallback: 5.90 },
                parts: [ONSEN_EGG, EXTRA_RICE, EDAMAME],
                quote: '"照烧酱最怕饭不够——蛋滑、饭足、毛豆脆，一碗干到底。"',
                quoteEn: '"That glaze needs rice to soak it up — silky egg, extra rice, crisp edamame."',
            },
        ],
        sides: {
            items: [
                { id: 'extra-unagi-half', name: '【照烧加倍】加照烧鳗鱼 (0.5片)', nameEn: 'Extra Glazed Unagi (½ fillet)', fallback: 18.50, maxQty: 3 },
                { id: 'onsen-egg', name: '温泉蛋', nameEn: 'Onsen Egg', fallback: 3, maxQty: 3 },
            ],
        },
        // 温泉蛋 已挪到 sides，这里滤掉避免同一个 id 出现两次
        alacarteExclude: ['onsen-egg'],
    },

    // Angelica Steamed Whole Chicken Leg (Tuesday special, id: 2)
    // 2026-08-16 首次配套餐。10 周 117 碗的快照里这道菜付费加料第一名就是蒜蓉
    // 西兰花炒蛋（19 次）、第二名荷包蛋（16 次），套餐等于把客人本来就在单点的
    // 两样打包；结构与家乡/甜酸/酒香/古早味下饭套一致。
    2: {
        combos: [{
            sectionId: 'herbal-chicken-combo',
            title: '✨ 归香下饭套',
            titleEn: 'Angelica Rice King Set (+ RM 12.90)',
            item: { id: 'herbal-chicken-rice-king-combo', name: '归香下饭套 (原价 RM 15.40)', nameEn: 'Angelica Rice King Set', fallback: 12.90 },
            parts: RICE_KING_PARTS,
            quote: '"当归汤汁最该拿来泡饭——蒜香西兰花炒蛋添一口青，再戳破流心荷包蛋，一盅热汤一碗饭，暖到心口。"',
            quoteEn: '"That angelica broth was made for rice — greens, a runny yolk, and a bowl to soak it all up."',
        }],
        sides: {
            items: [
                { id: 'extra-herbal-leg-1', name: '【犒劳自己】多加一只暖胃全鸡腿', nameEn: 'Extra Steamed Herbal Chicken Leg (+1)', fallback: 16.50, maxQty: 1 },
            ],
        },
    },

    // Grandma's Traditional Soy Sauce Chicken Whole Leg (now Monday special, id: 1), same pattern as id:13
    1: {
        sides: {
            items: [
                { id: 'extra-soy-leg-1', name: '【犒劳自己】多加一只酱油全鸡腿', nameEn: 'Extra Soy Sauce Chicken Whole Leg (+1)', fallback: 16.50, maxQty: 1 },
            ],
        },
    },

    // Shaoxing Wine Steamed Pork Belly (id: 4): combo + dual-tier pork add-ons
    // 2026-08-16 老板要求「照豆酱那套改」：旧「酒香干饭套」(花肉100g+蛋+饭 15.90，
    // 原价 19.40 逼近整碗 19.90、套内肉比主菜自带还多) 退役，换互补型「酒香下饭套」
    // —— 结构照抄已验证的家乡下饭王套/甜酸下饭套（西兰花炒蛋是花肉家族常年加料王），
    // 加肉走 50g/100g 单点双档。与 08-01 豆酱那次同一套解法、同一个价位。
    4: {
        combos: [{
            sectionId: 'shaoxing-combo',
            title: '✨ 酒香下饭套',
            titleEn: 'Shaoxing Rice King Set (+ RM 12.90)',
            item: { id: 'shaoxing-rice-king-combo', name: '酒香下饭套 (原价 RM 15.40)', nameEn: 'Shaoxing Rice King Set', fallback: 12.90 },
            parts: RICE_KING_PARTS,
            quote: '"绍兴酒香最勾饭，就缺一口青——蒜香西兰花炒蛋补上，再戳破流心荷包蛋捞饭，酒香一滴不剩。"',
            quoteEn: '"Shaoxing wine begs for rice — garlicky broccoli-egg and a runny yolk finish every drop."',
        }],
        sides: {
            items: [
                { id: 'extra-shaoxing-pork-50g', name: '【小酌怡情】加绍兴花肉 (50g)', nameEn: 'Extra Shaoxing Pork Belly (50g)', fallback: 7.90, maxQty: 3 },
                { id: 'extra-shaoxing-pork-100g', name: '【酒香入魂】加绍兴花肉 (100g)', nameEn: 'Extra Shaoxing Pork Belly (100g)', fallback: 14.90, maxQty: 3 },
            ],
        },
    },

    // Homestyle Japanese Curry Rice (id: 25): combo + extra-chicken add-ons
    25: {
        combos: [{
            sectionId: 'curry-combo',
            title: '✨ 咖喱控三件套',
            titleEn: 'Curry Lover Trio (+ RM 7.90)',
            item: { id: 'curry-trio-combo', name: '咖喱控三件套 (原价 RM 9.50)', nameEn: 'Curry Lover Trio', fallback: 7.90 },
            parts: [
                { id: 'extra-curry-chicken-50g', fallback: 4.5, label: '滑嫩咖喱鸡丁 50g', labelEn: '50g tender curry chicken' },
                ONSEN_EGG,
                EXTRA_RICE,
            ],
            quote: '"温泉蛋滑进浓郁咖喱酱，多一份鸡丁多一份满足——咖喱控没有抵抗力。"',
            quoteEn: '"An onsen egg melting into thick curry with extra chicken — irresistible for curry lovers."',
        }],
        sides: {
            items: [
                { id: 'extra-curry-chicken-50g', name: '【滑嫩多汁】加咖喱鸡丁 (50g)', nameEn: 'Extra Curry Chicken (50g)', fallback: 4.50, maxQty: 3 },
            ],
        },
    },

    // Hometown Taucu Braised Pork Belly (id: 23): combo + dual-tier pork add-ons
    // 2026-08-01 老板拍板方案 A：旧「阿嫲下饭王套」(花肉100g+蛋+饭 16.90，
    // 原价 20.00 > 整碗 19.90) 退役，换互补型「家乡下饭王套」——结构照抄
    // 已验证的甜酸下饭套（西兰花炒蛋是 7 周加料王），加肉走 50g/100g 单点。
    // 名字从「阿嫲」改「家乡」对齐主菜家族（阿嫲是酱油鸡腿的词）。
    23: {
        combos: [{
            sectionId: 'taucu-combo',
            title: '✨ 家乡下饭王套',
            titleEn: 'Hometown Rice King Set (+ RM 12.90)',
            item: { id: 'taucu-rice-king-combo', name: '家乡下饭王套 (原价 RM 15.40)', nameEn: 'Hometown Rice King Set', fallback: 12.90 },
            parts: RICE_KING_PARTS,
            quote: '"豆酱花肉肥香入魂，就缺一口青——蒜香西兰花炒蛋补上，再戳破流心荷包蛋捞饭，阿嫲看了都说你会吃。"',
            quoteEn: '"Rich taucu pork begs for greens — garlicky broccoli-egg and a runny yolk over extra rice. Grandma-approved."',
        }],
        sides: {
            items: [
                { id: 'extra-taucu-pork-50g', name: '【小碗解馋】加豆酱花肉 (50g)', nameEn: 'Extra Taucu Pork Belly (50g)', fallback: 7.90, maxQty: 3 },
                { id: 'extra-taucu-pork-100g', name: '【家乡浓香】加豆酱花肉 (100g)', nameEn: 'Extra Taucu Pork Belly (100g)', fallback: 15.50, maxQty: 3 },
            ],
        },
    },

    // Hometown Braised Pork Belly with Tofu & Egg (id: 31): two combos + dual-tier
    // pork add-ons. 选品依据 analytics/weekly 三周：花肉家族里带
    // 「专属套餐 + 双档加肉」的（豆酱 3.48、绍兴 4.36 RM/份）加料客单是只有单个
    // 专属加料的（白萝卜焖花肉 1.28，当周销量第一）的 2.7 倍 —— 新菜首发就补齐，
    // 不重蹈白萝卜那道「卖最多收最少」的覆辙。
    // 两套都用卤蛋不用荷包蛋：菜里自带卤蛋，同一锅卤汁出货不额外开工，比荷包蛋贴题。
    31: {
        combos: [
            {
                sectionId: 'braised-rice-king-combo-section',
                title: '✨ 卤味下饭王套',
                titleEn: 'Braised Rice King Set (+ RM 12.90)',
                item: { id: 'braised-rice-king-combo', name: '卤味下饭王套 (原价 RM 15.90)', nameEn: 'Braised Rice King Set', fallback: 12.90 },
                parts: [BROCCOLI_EGG, BRAISED_EGG, EXTRA_RICE],
                quote: '"卤汁那么香，最缺一口青——蒜蓉西兰花炒蛋补上，再添一颗吸饱卤汁的卤蛋捞饭，这碗才够本。"',
                quoteEn: '"That braising liquid deserves greens — garlicky broccoli-egg, one more soy-soaked egg, and rice to soak it all up."',
            },
            {
                sectionId: 'braised-rice-combo-section',
                title: '✨ 卤汁干饭套',
                titleEn: 'Braised Gravy Rice Set (+ RM 5.90)',
                item: { id: 'braised-rice-combo', name: '卤汁干饭套 (原价 RM 7.50)', nameEn: 'Braised Gravy Rice Set', fallback: 5.90 },
                parts: [BRAISED_EGG, EXTRA_RICE, EDAMAME],
                quote: '"碗底那勺卤汁最金贵——多一碗饭、多一颗卤蛋，配把脆毛豆，一滴都不剩。"',
                quoteEn: '"The gravy at the bottom is the best part — extra rice, another soy egg and crisp edamame finish every drop."',
            },
        ],
        sides: {
            items: [
                { id: 'braised-egg', name: '古早味卤蛋', nameEn: 'Braised Soy Egg', fallback: 3, maxQty: 3 },
                { id: 'extra-braised-pork-50g', name: '【浅尝卤味】加卤三层肉 (50g)', nameEn: 'Extra Braised Pork Belly (50g)', fallback: 7.90, maxQty: 3 },
                { id: 'extra-braised-pork-100g', name: '【古早卤香】加卤三层肉 (100g)', nameEn: 'Extra Braised Pork Belly (100g)', fallback: 15.50, maxQty: 3 },
            ],
        },
    },

    // Hometown Stewed Pork Belly with Daikon (id: 30): an extra-daikon upsell in sides
    // 2026-08-09 老板拍板：新菜首发自带一个专属加料（+90g 白萝卜 RM3）。
    // 2026-08-12 老板改：份量 90g→100g 熟（生重 200g），价 RM3→RM3.50。
    // id 保持 extra-daikon-90g（历史命名，不改 id 以免历史成本归因失真）。
    30: {
        sides: {
            items: [
                { id: 'extra-daikon-90g', name: '【清甜解腻】加白萝卜 (100g)', nameEn: 'Extra Daikon (100g)', fallback: 3.50, maxQty: 3 },
            ],
        },
    },

    // Grandma-Style Ginger-Scallion Fish Fillet (id: 20): combo + extra-fish upsell
    // 2026-08-16 首次配套餐。这套是六道菜里唯一不放荷包蛋的 —— 姜葱鱼片本身就
    // 自带一颗荷包蛋（配方 + dashboard DISH_DEFAULT_EGGS 都是这么记的），再放
    // 就是重复；而它除了葱 32g / 姜 12g 完全没有蔬菜，是全菜单缺绿最严重的一道。
    // 所以走「西兰花炒蛋补绿 + 马铃薯煎蛋补淀粉和蛋」。
    20: {
        combos: [{
            sectionId: 'ginger-fish-combo',
            title: '✨ 姜葱下饭套',
            titleEn: 'Ginger-Scallion Rice King Set (+ RM 13.90)',
            item: { id: 'ginger-fish-rice-king-combo', name: '姜葱下饭套 (原价 RM 16.90)', nameEn: 'Ginger-Scallion Rice King Set', fallback: 13.90 },
            parts: [
                BROCCOLI_EGG,
                { id: 'potato-egg', fallback: 4, label: '马铃薯煎蛋', labelEn: 'potato fried egg' },
                EXTRA_RICE,
            ],
            quote: '"姜葱爆香的鱼片本来就配一颗荷包蛋，再添蒜香西兰花炒蛋和绵软马铃薯煎蛋——鱼嫩、菜香、蛋绵，一碗饭根本不够。"',
            quoteEn: '"The fish already comes with a sunny-side-up egg — add garlicky greens and a soft potato-egg, and one bowl of rice won\'t be enough."',
        }],
        sides: {
            items: [
                { id: 'extra-fish-120g', name: '加姜葱鱼片 (120g)', nameEn: 'Extra Fish Fillet (120g)', fallback: 13.90, maxQty: 3 },
            ],
        },
    },

    // Golden Scallion Pan-Fried Chicken Soup (id: 5): combo + chicken chop add-on
    5: {
        combos: [{
            sectionId: 'scallion-combo',
            title: '✨ 葱汤干饭王！爆量满足三件套',
            titleEn: 'Scallion Soup Rice King Trio (+ RM 12.90)',
            item: { id: 'scallion-soup-combo', name: '爆量满足三件套 (原价 RM 15.40)', nameEn: 'Rice King Trio', fallback: 12.90 },
            parts: [
                { id: 'extra-scallion-chop-side', fallback: 10.9, label: '香煎金鸡扒 150g', labelEn: '150g pan-fried golden chicken chop' },
                SUNNY_EGG,
                EXTRA_RICE,
            ],
            quote: '"一碗热腾腾的葱汤配上焦香鸡扒，戳破流心荷包蛋拌进白饭——周五就该这样犒劳自己！"',
            quoteEn: '"Steaming scallion soup with a crispy chop and a runny egg over rice — Fridays done right!"',
        }],
        sides: {
            items: [
                { id: 'extra-scallion-chop-side', name: '【收工犒劳】多加一只葱香煎鸡扒', nameEn: 'Extra Scallion Chicken Chop', fallback: 10.90, maxQty: 3 },
            ],
        },
    },

    // Potato Pork Belly Stew (now daily, id: 13)
    13: {
        combos: [{
            sectionId: 'pork-potato-combo',
            title: '✨ 薯肉双拼满足套',
            titleEn: 'Potato & Pork Belly Duo (+ RM 13.40)',
            item: { id: 'pork-potato-duo-combo', name: '薯肉双拼满足套 (原价 RM 15.40)', nameEn: 'Potato & Pork Belly Duo', fallback: 13.40 },
            parts: [
                { id: 'extra-potato', fallback: 3.5, label: '绵密马铃薯 90g', labelEn: '90g creamy potato' },
                { id: 'extra-pork-belly', fallback: 11.9, label: '香滑花肉片 70g', labelEn: '70g silky pork belly slices' },
            ],
            quote: '"一口软糯薯块裹着浓郁肉汁，再来几片入味花肉，这就是家的味道。"',
            quoteEn: '"Soft potato coated in rich gravy with melt-in-your-mouth pork belly — the taste of home."',
        }],
        sides: {
            items: [
                { id: 'extra-potato', name: '【绵密软糯】加马铃薯 (90g)', nameEn: 'Extra Potato (90g)', fallback: 3.50, maxQty: 3 },
                { id: 'extra-pork-belly', name: '【浓香入味】加花肉片 (70g)', nameEn: 'Extra Pork Belly Slices (70g)', fallback: 11.90, maxQty: 3 },
            ],
        },
    },
};
