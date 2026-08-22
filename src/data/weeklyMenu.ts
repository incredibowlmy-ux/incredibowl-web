export interface MenuItem {
    id: number;
    day: string;
    /**
     * Weekday this dish serves (0=Sun … 6=Sat). Present ONLY for weekly specials.
     * Daily/常驻 dishes and retired dishes omit it. Two specials may share a
     * weekday (e.g. Tuesday) — the Hero "next special" picks the `isPrimary` one.
     * NOTE: `id` is a pure unique identifier — it is NO LONGER the weekday.
     * DERIVED from WEEKLY_SCHEDULE below — do not hand-write on dishes.
     */
    weekday?: number;
    /**
     * When two specials share a `weekday`, the one shown as the Hero headline.
     * DERIVED: the FIRST id listed for a weekday in WEEKLY_SCHEDULE.
     */
    isPrimary?: boolean;
    name: string;
    nameEn: string;
    price: number;
    image: string;
    tags: string[];
    desc: string;
    descEn?: string;
    tagsEn?: string[];
    /**
     * Extra cash (RM) due when redeeming ONE meal voucher for this dish, because
     * its price sits above the standard voucher value. Absent/0 = fully covered
     * by one voucher. Enforced client-side (CartDrawer) AND server-side
     * (/api/submit-order) — keep both in sync.
     */
    voucherTopUp?: number;
    /**
     * Prepaid upgrade-credit id (mealVoucherAddonCredits pool, see
     * PREPAID_ADDON_OPTIONS in addOnsConfig.ts) that covers this dish's
     * `voucherTopUp`. Only set on dishes whose top-up is sold as a prepaid
     * upgrade (e.g. salmon/wagyu). The subscription engine auto-consumes
     * these credits before charging the top-up as cash.
     */
    topUpAddonId?: string;
    /**
     * Dish removed from rotation: shown greyed-out on the menu, not orderable.
     * DERIVED from PAUSED_DISHES below.
     */
    retired?: boolean;
    /**
     * Daily/常驻 dish available ONLY on these weekdays (0=Sun…6=Sat). Absent =
     * all operating days (Mon–Fri). The menu card greys out + shows
     * `unavailableNote` when the next delivery date falls outside this set, and
     * /api/submit-order rejects out-of-range dates (so a direct API call can't
     * skip the greyed card). e.g. 马铃薯炖花肉片 = [4,5] (Thu & Fri only).
     */
    availableWeekdays?: number[];
    /**
     * Daily/常驻 dish with `availableWeekdays` that should DISPLAY inside each
     * available day's 每日精选 column (menu weekly grid) instead of the 常驻 band.
     * Display-only — ordering rules stay with availableWeekdays. Used when the
     * boss wants a multi-day dish shown as a day special but the schedule
     * derivation only allows one weekday per dish (e.g. 绍兴酒蒸花肉 周一+周四).
     */
    featureOnAvailableDays?: boolean;
    /** Short reason shown on a disabled card (retired / weekday-excluded). */
    unavailableNote?: string;
    unavailableNoteEn?: string;
    /**
     * Completely absent from the customer website (both ZH & EN carousels,
     * Hero next-special, date computation and SEO structured data) — UNLIKE
     * `retired` which still shows greyed-out. The dish stays in the array so
     * the ops dashboard / stock / prep APIs can still reference it. Use for a
     * dish that's been added to the system but is NOT ready to show on the
     * site yet (e.g. waiting on a real photo). A hidden dish sits in
     * DISH_CATALOG WITHOUT appearing in any schedule bucket; to go live, add
     * its id to WEEKLY_SCHEDULE / DAILY_DISHES, drop `hidden`, and set a real
     * `/xxx.webp` image.
     */
    hidden?: boolean;
}

/**
 * SEO-optimised alt text for a menu item image.
 * Includes dish name + a descriptive (non-numeric) tag + locality keyword
 * to feed Google Images long-tail traffic for "Pearl Point 私厨外送" / "Old Klang Road 家常菜".
 */
export function dishImageAlt(item: MenuItem, locale: 'zh' | 'en' = 'zh'): string {
    if (locale === 'en') {
        return `${item.nameEn} — Incredibowl home-cooked delivery, Pearl Point / Old Klang Road Kuala Lumpur`;
    }
    // Prefer descriptive tags (skip numeric ones like protein gram counts).
    const descriptiveTag = item.tags?.find(t => !/^[~\d]/.test(t)) ?? '招牌家常菜';
    return `${item.name} - ${descriptiveTag} - Pearl Point 私厨外送 · Old Klang Road 家常菜`;
}

/**
 * Value (RM) one meal voucher covers for a dish at `unitPrice`: the unit price
 * minus any per-dish top-up. The customer pays the top-up in cash; the voucher
 * absorbs the rest. Mirrored by /api/submit-order — keep both in sync.
 */
export function dishVoucherValue(unitPrice: number, dish: Pick<MenuItem, 'voucherTopUp'>): number {
    return Math.max(0, unitPrice - (dish.voucherTopUp ?? 0));
}

// ═══════════════════════════════════════════════════════════════════
//   每周排期表 — 换菜单只改这一块（老板每周发新菜单 → 更新这三个列表）
//
//   · WEEKLY_SCHEDULE：每天卖哪几道（key = weekday 1–5）。
//     数组第一个 id = 当天 Hero 主打（isPrimary 自动推导，别手写）。
//   · DAILY_DISHES：常驻菜（每个营业日都卖）。
//   · PAUSED_DISHES：暂别菜（菜单灰显「可见不可点」）。day 保留原排期
//     标签，只影响 SEO 结构化数据分组。
//
//   规则（模块加载时自检，排错了 build 直接失败，绝不带病上线）：
//     1. 每个 id 必须存在于 DISH_CATALOG 且只能出现在一个列表里一次。
//     2. 排期中的菜不能带 hidden。
//     3. 目录里没进任何列表的菜必须带 hidden（防止忘排期静默消失）。
//
//   生效周：2026-08-24（Mon 24 Aug）。老板 08-22（周六）发的完整下周菜单，
//   一次改完 —— 周六无配送、下一个配送日就是周一 8/24，全部改动都落在未来，
//   不存在「撕掉本周菜」的冲突（对比 08-19 那次要分两波）。
//   本周变动：
//     · 周一：酱油鸡全腿(#1·主打) + 当归蒸鸡全腿(#2 从周五挪来)。
//     · 周二：三文鱼(#21·主打) + 白萝卜焖花肉(#30)。不变。
//     · 周三：豆酱焖花肉(#23·主打) + 照烧鳗鱼(#29 从常驻降为周三单日特餐)。
//     · 周四：姜葱鱼片(#20·主打) + 甜酸洋葱猪扒(#27 回归，08-24 暂别一周)。
//     · 周五：绍兴酒蒸花肉(#4 从周四挪来·主打) + 金黄鸡扒(#14 从周三挪来)。
//       ⚠️ 8/28 是放假前最后一餐，只送午餐（DINNER_CLOSED_DATES）；
//          8/31~9/2 休假（CLOSURES），均见 blockedDates.ts。
//     · 转暂别：卤三层肉豆腐蛋(#31) 继续歇。
//   ⚠️ 鳗鱼 #29 这次从 DAILY_DISHES 收回 WEEKLY_SCHEDULE[3]，必须同时删掉
//      availableWeekdays / featureOnAvailableDays / unavailableNote 三个字段 ——
//      servesOnWeekday() 里 availableWeekdays 优先级高于 weekday，留着会让
//      服务端按「只周二/五」拒收周三的单（08-10 收成周三时同款处理）。
//   本周没有「一菜两天」的菜，DAILY_DISHES 回到纯全周常驻两道。
// ═══════════════════════════════════════════════════════════════════
const WEEKLY_SCHEDULE: Record<number, number[]> = {
    1: [1, 2],   // 周一：酱油鸡全腿(主打)、当归蒸鸡全腿(从周五挪来)
    2: [21, 30], // 周二：柠香三文鱼(主打)、白萝卜焖花肉
    3: [23, 29], // 周三：家乡豆酱焖花肉(主打)、照烧鳗鱼(从常驻降周三单日)
    4: [20, 27], // 周四：姜葱鱼片(主打)、甜酸洋葱猪扒(回归)
    5: [4, 14],  // 周五：绍兴酒蒸花肉(主打·从周四挪来)、金黄鸡扒(从周三挪来) —— 只送午餐
};

// 纳豆月见、马铃薯炖花肉片 —— 全周常驻，无限日菜（鳗鱼 08-24 起改周三单日特餐）。
const DAILY_DISHES: number[] = [11, 13];

const PAUSED_DISHES: { id: number; day: string }[] = [
    { id: 22, day: 'Daily / 常驻' },  // 参峇臭豆 暂别 2026-06-27
    { id: 5, day: 'Fri / 周五' },     // 葱香煎鸡汤 退役 2026-06-08
    { id: 24, day: 'Tue / 周二' },    // 澳洲和牛饼 暂别 2026-07-13
    { id: 25, day: 'Tue / 周二' },    // 家常日式咖喱饭 暂别 2026-08-03
    { id: 28, day: 'Fri / 周五' },    // 豆酱焖排骨 暂别 2026-07-31
    { id: 3, day: 'Fri / 周五' },     // 希腊柠香烤鸡胸 暂别 2026-08-10
    { id: 12, day: 'Mon / 周一' },    // 山药云耳海陆双鲜炒 暂别 2026-08-17
    { id: 26, day: 'Thu / 周四' },    // 柠檬蜜糖煎鸡扒 暂别 2026-08-17
    { id: 31, day: 'Mon / 周一' },    // 古早味卤三层肉豆腐蛋 暂别 2026-08-24（首发周后歇）
];

// ═══════════════════════════════════════════════════════════════════
//   菜品目录 — 纯资料（名字/价格/图/文案），不含任何排期字段。
//   排期（day/weekday/isPrimary/retired）由上方三个列表推导。
//   加新菜：目录加一条（未排期前必须 hidden:true + emoji 占位图），
//   要上线时把 id 排进 WEEKLY_SCHEDULE / DAILY_DISHES 并去掉 hidden。
// ═══════════════════════════════════════════════════════════════════
type DishData = Omit<MenuItem, 'day' | 'weekday' | 'isPrimary' | 'retired'>;

const DISH_CATALOG: DishData[] = [
    {
        id: 11,
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Seaweed Rice Bowl",
        price: 16.90,
        image: "/natto_bowl.webp",
        tags: ["高蛋白 25g+", "纳豆激酶", "益生菌", "拉丝入魂拌饭魂"],
        tagsEn: ["25g+ protein", "Nattokinase", "Probiotic", "Stringy & soulful"],
        desc: "经典的健康选择。纳豆的鲜香配上顺滑的月见蛋，简单却极富层次。",
        descEn: "A classic healthy bowl. Umami natto stirred with a silky 'moon-gazing' egg — simple, but layered with depth."
    },
    {
        id: 13,
        name: "马铃薯炖花肉片",
        nameEn: "Home-style Pork Belly Slices & Potato Stew",
        price: 19.90,
        // 2026-07-27 周起恢复全周常驻（老板 07-24 菜单），不再限日。
        image: "/pork_potato_stew.webp",
        tags: ["能量补给", "软糯入味", "胶原满满", "汤汁拌饭三碗半"],
        tagsEn: ["Energy boost", "Tender & glazed", "Collagen-rich", "Three bowls of rice gone"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。",
        descEn: "Potatoes braised until they melt, stirred into the rice — pure, grounded happiness."
    },
    {
        id: 1,
        name: "阿嫲古早味酱油鸡全腿",
        nameEn: "Soy Sauce Chicken Whole Leg",
        price: 18.50,
        image: "/soy_sauce_chicken_leg.webp",
        tags: ["高蛋白 48g+", "广式经典", "酱香入骨", "皮亮肉嫩", "一口酱香魂归位"],
        tagsEn: ["48g+ protein", "Cantonese classic", "Soy-infused", "Glossy & tender", "Soy-glazed comfort"],
        desc: "广式经典做法，酱油的咸香慢慢渗进每一丝鸡肉，皮亮肉嫩。",
        descEn: "A Cantonese classic — savoury soy slowly infusing every strand of chicken. Glossy skin, tender meat."
    },
    {
        id: 4,
        name: "绍兴酒蒸花肉",
        nameEn: "Shaoxing Wine Steamed Pork Belly",
        price: 19.90,
        // 2026-07-20 起只卖周二一天 → 从常驻+availableWeekdays 挪回普通周二特餐
        //（WEEKLY_SCHEDULE[2]），供应日由推导层 weekday 控制。
        image: "/shaoxing_pork_belly.webp",
        tags: ["绍兴酒香", "姜丝提鲜", "蒸香软嫩", "偏肥·肥香控真爱"],
        tagsEn: ["Shaoxing wine aroma", "Ginger-infused", "Steamed & tender", "Rich & fatty"],
        desc: "选偏肥的五花部位，绍兴酒香顺着姜丝蒸进肉里，肥香软糯、入口即化。爱这口肥香的会上瘾；偏好瘦口的朋友这道可能不合。",
        descEn: "Made with the fattier cut of pork belly — Shaoxing wine and ginger steamed deep into the meat, rich and melt-in-your-mouth. If you love that fatty, silky bite you'll adore it; if you prefer lean, this one may not be for you."
    },
    {
        // a la carte RM22.90；餐券抵扣需补 RM3（voucherTopUp，餐券覆盖到 RM19.90）。
        // 蛋白 32g（老板/碗妈 2026-06-21 提供）。暂别 2026-07-13（见 PAUSED_DISHES）。
        id: 24,
        unavailableNote: "和牛饼暂别，敬请期待回归",
        unavailableNoteEn: "Wagyu patty paused — back soon",
        name: "澳洲和牛饼饭",
        nameEn: "Aussie Wagyu Beef Patty Don",
        price: 22.90,
        voucherTopUp: 3,
        topUpAddonId: "wagyu-upgrade",
        image: "/wagyu_beef_patty.webp",
        tags: ["高蛋白 32g+", "澳洲和牛饼", "温泉蛋拌饭", "番茄莎莎清爽"],
        tagsEn: ["32g+ protein", "Aussie wagyu patty", "Onsen egg over rice", "Zesty tomato salsa"],
        desc: "澳洲和牛肉饼香煎到外焦内嫩，盖一颗半熟温泉蛋，金黄蛋液顺着肉香流进米饭；配一勺酸甜樱桃番茄莎莎解腻，丰腴却清爽。",
        descEn: "Aussie wagyu beef patty seared crisp outside and juicy within, crowned with a soft onsen egg whose golden yolk runs into the rice — finished with a tangy cherry-tomato salsa that keeps it bright, not heavy."
    },
    {
        // 新菜 2026-06-29 入系统（鸡胸）；2026-07-04 上线；2026-07-17 补主图。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）。
        id: 25,
        name: "家常日式咖喱饭",
        nameEn: "Homestyle Japanese Curry Rice",
        price: 18.50,
        image: "/japanese_curry_rice.webp",
        tags: ["日式咖喱", "嫩煎鸡胸", "暖心浓香", "下饭满足"],
        tagsEn: ["Japanese curry", "Pan-seared chicken breast", "Warm & rich", "Made for rice"],
        desc: "浓郁日式咖喱慢炖到顺滑，配嫩煎鸡胸肉，盖在热饭上，一口暖到心里。",
        descEn: "Rich Japanese curry simmered until silky, served with pan-seared chicken breast over hot rice — warm and comforting in every bite."
    },
    {
        // 新菜 2026-07-10 入系统，2026-07-13（周二）上线主打。暂别 2026-07-20；2026-07-18 补主图。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）；简介为初稿，待老板审定。
        id: 26,
        unavailableNote: "蜜糖鸡扒暂别，敬请期待回归",
        unavailableNoteEn: "Honey lemon chicken chop paused — back soon",
        name: "柠檬蜜糖煎鸡扒",
        nameEn: "Honey Lemon Glazed Chicken Chop",
        price: 18.50,
        image: "/honey_lemon_chicken_chop.webp",
        tags: ["柠檬蜜糖", "香煎鸡扒", "酸甜开胃", "外脆里嫩"],
        tagsEn: ["Honey-lemon glaze", "Pan-seared chicken chop", "Sweet & zesty", "Crisp outside, juicy inside"],
        desc: "香煎鸡扒煎到金黄焦香，淋上柠檬蜜糖酱——酸甜清新解腻，开胃又下饭。",
        descEn: "Chicken chop pan-seared golden, glazed with a honey-lemon sauce — bright, sweet-tangy and made for rice."
    },
    {
        // 新菜 2026-07-17 入系统，2026-07-20 周上线（周二+周五供应）。
        // 同一道菜不能在 WEEKLY_SCHEDULE 出现两次 —— 多天供应走常驻+
        // availableWeekdays+featureOnAvailableDays（绍兴 07-13 周的同款机制）。
        // 实拍图 2026-07-21 上架（porkchop1.jpeg → 1024²webp）。蛋白克数等
        // 营养标签待碗妈提供后再补（诚实原则，绝不编数字）；简介为初稿，待老板审定。
        // 2026-08-03 起只卖周四一天 → 从常驻+availableWeekdays 挪回普通周四特餐
        //（WEEKLY_SCHEDULE[4]），供应日由推导层 weekday 控制；随之移除
        // availableWeekdays / featureOnAvailableDays / unavailableNote（否则残留
        //「仅周一、周四供应」文案会误导顾客）。
        id: 27,
        name: "家乡甜酸洋葱猪扒",
        nameEn: "Hometown Sweet & Sour Onion Pork Chop",
        price: 19.90,
        image: "/sweet_sour_onion_pork_chop.webp",
        tags: ["甜酸开胃", "洋葱酱香", "家乡风味", "下饭神器"],
        tagsEn: ["Sweet & tangy", "Onion sauce", "Hometown flavour", "Made for rice"],
        desc: "甜酸洋葱酱裹着猪扒，酸甜咸香、开胃下饭——家乡熟悉的味道。",
        descEn: "Pork chop coated in a hometown-style sweet & sour onion sauce — tangy, savoury and made for rice."
    },
    {
        // a la carte RM24.90（2026-07-26 起，原 23.90）；餐券抵扣需补 RM5（voucherTopUp，
        // 餐券覆盖仍是 RM19.90）。周五新上 2026-06-08。
        // 暂停一周 2026-07-20；2026-07-27 回归周二主打。
        // 2026-08-03 起改「周二+周五」两天供应 → 从 WEEKLY_SCHEDULE 挪到常驻 +
        // availableWeekdays + featureOnAvailableDays（同一道菜不能排两个 weekday）。
        // 2026-08-10 起收成周五单日特餐 → 收回 WEEKLY_SCHEDULE，去掉那三个字段。
        id: 21,
        name: "柠香香煎三文鱼饭",
        nameEn: "Lemon Pan-Seared Salmon",
        price: 24.90,
        voucherTopUp: 5,
        topUpAddonId: "salmon-upgrade",
        image: "/lemon_salmon.webp",
        tags: ["高蛋白 30g+", "香煎三文鱼", "柠香清爽", "Omega-3", "餐券+RM5"],
        tagsEn: ["30g+ protein", "Pan-seared salmon", "Zesty lemon", "Omega-3", "Voucher +RM5"],
        desc: "香煎三文鱼外焦里嫩，挤上柠檬清香，配西兰花、毛豆、玉米与樱桃番茄，清爽又满足。",
        descEn: "Pan-seared salmon, crisp outside and tender within, brightened with lemon and served with broccoli, edamame, corn and cherry tomato — light yet satisfying."
    },
    {
        id: 2,
        name: "招牌原盅当归蒸鸡全腿",
        nameEn: "Angelica Steamed Whole Chicken Leg",
        price: 18.50,
        image: "/angelica_chicken.webp",
        tags: ["高蛋白 45g+", "当归补血", "暖身滋补", "碗妈拿手", "一抹归香入魂深"],
        tagsEn: ["45g+ protein", "Angelica blood tonic", "Warming", "BowlMama signature", "Soul-warming"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。",
        descEn: "Angelica root infuses every fibre of the chicken. One sip of the broth and your soul warms up."
    },
    {
        // 暂别 2026-07-13 → 2026-07-20 回归（周三）。
        id: 3,
        name: "希腊柠香烤鸡胸",
        nameEn: "Greek Mediterranean Lemon Chicken",
        price: 19.90,
        image: "/greek_lemon_chicken_v2.webp",
        tags: ["蛋白质炸弹 64g+", "增肌好伙伴", "最强下饭款"],
        tagsEn: ["64g+ protein bomb", "Gym-friendly", "Best with rice"],
        desc: "柠檬的微酸渗进微焦的鸡胸肉里，带着百里香的清气，加上特级初榨橄榄油，嗯。。",
        descEn: "Lemon's tang seeps into the lightly charred chicken breast, carried by thyme and extra-virgin olive oil. Mmm."
    },
    {
        id: 12,
        name: "山药云耳海陆双鲜炒",
        nameEn: "Chinese Yam & Black Fungus Surf & Turf",
        price: 18.50,
        image: "/chinese_yam_black_fungus_v3.webp",
        tags: ["高蛋白 31g+", "养胃滋补", "健脾益胃", "清肺润燥", "脆嫩滑爽三重奏"],
        tagsEn: ["31g+ protein", "Stomach-warming", "Spleen-nourishing", "Lung-soothing", "Crisp & silky"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。",
        descEn: "Fresh Chinese yam with crunchy black fungus — the gentlest care your gut could ask for."
    },
    {
        id: 14,
        name: "香煎金黄鸡扒饭",
        nameEn: "Pan-Fried Golden Chicken Chop Rice",
        price: 18.50,
        image: "/chicken_chop.webp",
        tags: ["高蛋白 43g+", "焦香四溢", "营养均衡", "外脆里嫩爆汁款"],
        tagsEn: ["43g+ protein", "Aromatic sear", "Balanced", "Crisp outside, juicy inside"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。",
        descEn: "The seared aroma I waited for as a kid — no fancy seasoning, just salt and pepper, done right."
    },
    {
        // 全新菜 2026-07-24 入系统，2026-07-31（周五）上线主打。无实拍图，emoji
        // 2026-07-26 回填实拍主图（taucu_pork_ribs.webp，1024² webp）。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）；
        // 简介为初稿，待老板审定。
        id: 28,
        name: "豆酱焖排骨",
        nameEn: "Hometown Taucu Braised Pork Ribs",
        price: 19.90,
        image: "/taucu_pork_ribs.webp",
        tags: ["家乡豆酱", "焖煮入味", "骨边肉香", "下饭神器"],
        tagsEn: ["Hometown taucu", "Slow-braised", "Fall-off-the-bone", "Made for rice"],
        desc: "家乡豆酱慢火焖排骨，豆香咸鲜渗进骨边肉里，酱汁拌饭一流。",
        descEn: "Pork ribs slow-braised in hometown fermented soybean paste (taucu) — savoury and deeply infused, with a sauce made for rice."
    },
    {
        // 全新菜 2026-07-30 入系统，07-31（周五）首发；2026-08-03 起改周一+周四
        // 两天供应（走常驻 + availableWeekdays + featureOnAvailableDays）。
        // 份量见 dishIngredients.ts（鳗鱼 0.5 片 + 西兰花 50g + 白饭 80g，07-30 给；
        // 自带的马铃薯煎蛋 = 加料版的 1/4 → 马铃薯 37.5g + 鸡蛋 0.5 颗，07-31 给）。
        // 2026-07-31 回填主图（unagi_rice.webp，1024² webp q82，源图老板给的
        //    Gpt/unagi.jpeg）；仍需老板在 Google Sheet dishes 表加一行，
        //    否则 chatbot 发不出该菜图片。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）；
        // 简介为初稿，待老板审定。
        // a la carte RM24.90；餐券抵扣需补 RM5（voucherTopUp，餐券覆盖 RM19.90，
        // 与同价的柠香三文鱼一致）。2026-07-27 开通预付升级池 unagi-upgrade
        // （老板要求，比照 salmon-upgrade）：餐券客可预充 RM5/张 抵 top-up。
        id: 29,
        name: "古早味照烧鳗鱼饭",
        nameEn: "Hometown Glazed Unagi Rice",
        price: 24.90,
        // 2026-08-10 收成周三单日；08-17 改「周二+周五」两天（常驻+availableWeekdays）；
        // 2026-08-24 起又收回周三单日特餐 → 重新进 WEEKLY_SCHEDULE[3]，那三个限日
        // 字段必须删干净（留着 servesOnWeekday 会按周二/五拒收周三的单）。
        voucherTopUp: 5,
        topUpAddonId: "unagi-upgrade",
        image: "/unagi_rice.webp",
        tags: ["古早味照烧", "焦糖酱香", "配马铃薯煎蛋", "餐券+RM5"],
        tagsEn: ["Hometown glaze", "Caramelised soy", "With potato fried egg", "Voucher +RM5"],
        desc: "照烧酱慢火收到焦糖化，酱香一层层裹住鳗鱼，旁边配一份马铃薯煎蛋——古早味的踏实满足。",
        descEn: "Unagi glazed in soy reduced down to a caramelised sheen, served with a potato fried egg on the side — honest, old-school comfort."
    },
    {
        // 全新菜 2026-06-15 上架。2026-06-27 回填实拍主图（taucu_pork_belly.webp，1024² webp）。
        // 蛋白克数等营养标签待碗妈提供后再补；简介为初稿，待老板审定。
        id: 23,
        name: "家乡豆酱焖花肉",
        nameEn: "Hometown Taucu Braised Pork Belly",
        price: 19.90,
        image: "/taucu_pork_belly.webp",
        tags: ["家乡豆酱", "焖煮入味", "肥香软糯", "下饭神器"],
        tagsEn: ["Hometown taucu", "Slow-braised", "Rich & tender", "Made for rice"],
        desc: "家乡豆酱慢火焖煮花肉，豆香咸鲜渗进每一丝肉里，软糯入味、咸香下饭。",
        descEn: "Pork belly slow-braised in hometown fermented soybean paste (taucu) — savoury, tender and deeply infused, made for rice."
    },
    {
        // 全新菜 2026-08-10 首发（老板 08-06 定），首周热卖 35 份全周销冠。
        // 2026-08-17 转暂别歇一周（见 PAUSED_DISHES），随之移除
        // availableWeekdays / featureOnAvailableDays（暂别期残留「仅周一、周四
        // 供应」会误导顾客，猪扒 08-03 同款处理）。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）；
        // 简介为初稿，待老板审定。
        id: 30,
        name: "家乡白萝卜焖花肉",
        nameEn: "Hometown Stewed Pork Belly with Daikon",
        price: 19.90,
        unavailableNote: "白萝卜焖花肉暂别，敬请期待回归",
        unavailableNoteEn: "Daikon pork belly paused — back soon",
        image: "/daikon_pork_belly.webp",
        tags: ["白萝卜清甜", "慢火焖到软烂", "汤汁下饭", "家常暖胃"],
        tagsEn: ["Sweet daikon", "Stewed till tender", "Rich gravy", "Homely comfort"],
        desc: "花肉配白萝卜慢火焖到软烂，萝卜吸饱了肉汁，清甜解腻——一口就是家里的味道。",
        descEn: "Pork belly and daikon stewed low and slow until meltingly tender — the radish drinks up every drop of the gravy, sweet and never heavy."
    },
    {
        // 全新菜 2026-08-14 入系统，2026-08-17（周一）首发主打（老板 08-13 定，
        // 广播已按此发出）。无实拍图，emoji 占位防 hero 404（有图后换 /xxx.webp，
        // 并提醒老板在 Google Sheet dishes 表加一行给 chatbot 发图）。
        // 蛋白克数等营养标签待碗妈提供后再补（诚实原则，绝不编数字）；
        // 简介为初稿（与 broadcast 文案同源），待老板审定。
        id: 31,
        name: "古早味卤三层肉豆腐蛋",
        nameEn: "Hometown Braised Pork Belly with Tofu & Egg",
        price: 19.90,
        image: "🍖",
        tags: ["古早味卤香", "三层肉软糯", "豆腐吸满卤汁", "下饭神器"],
        tagsEn: ["Old-school braise", "Melt-in-your-mouth belly", "Tofu soaked in gravy", "Made for rice"],
        desc: "三层肉慢火卤到软糯入味，豆腐和蛋吸饱卤汁——一口就是阿嫲家的味道。",
        descEn: "Pork belly slow-braised in old-school soy gravy until meltingly tender, with tofu and egg soaking up every drop."
    },
    {
        // 暂别中（见 PAUSED_DISHES）。unavailableNote 是菜的暂别文案，跟菜走。
        id: 22,
        unavailableNote: "参峇臭豆暂别，敬请期待回归",
        unavailableNoteEn: "Sambal petai paused — back soon",
        name: "参峇臭豆虾仁炒花肉",
        nameEn: "Sambal Petai Prawn & Pork Belly",
        price: 22.90,
        voucherTopUp: 3,
        image: "/sambal_petai_prawn_pork.webp",
        tags: ["参峇香辣", "虾仁弹牙", "臭豆控真爱", "餐券+RM3"],
        tagsEn: ["Sambal spicy", "Bouncy prawns", "Petai lover's pick", "Voucher +RM3"],
        desc: "参峇辣酱爆香花肉与虾仁，配上一口入魂的臭豆，惹味咸香，扒饭三碗不嫌多。",
        descEn: "Sambal-fried pork belly and prawns with soul-stirring petai — bold, spicy, and impossibly good over rice."
    },
    {
        // 暂别中（见 PAUSED_DISHES）。
        id: 5,
        unavailableNote: "鸡汤暂别，敬请期待回归",
        unavailableNoteEn: "Scallion soup paused — back soon",
        name: "金黄葱香煎鸡汤",
        nameEn: "Golden Scallion Pan-Fried Chicken Soup",
        price: 18.50,
        image: "/scallion_chicken_soup.webp",
        tags: ["高蛋白 37g+", "驱寒暖身", "治愈高汤", "肠胃温柔乡"],
        tagsEn: ["37g+ protein", "Warm & restorative", "Healing broth", "Gut-friendly"],
        desc: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。",
        descEn: "A bowl of clear scallion broth — washing off a week's tiredness, ready for a clean weekend."
    },
    {
        // 2026-07-13 回归周五。回归价 RM19.90（老板 2026-07-04 定价，原 RM18.50）。
        // 暂别 2026-07-20；2026-07-27 周回归周五第二道。
        id: 20,
        name: "古早味姜葱鱼片饭",
        nameEn: "Grandma-Style Ginger-Scallion Fish Fillet",
        price: 19.90,
        image: "/ginger_scallion_fish.webp",
        tags: ["高蛋白 28g+", "古早味", "姜葱爆香", "荷包蛋", "鱼片嫩滑"],
        tagsEn: ["28g+ protein", "Old-school", "Ginger-scallion sear", "Sunny-side egg", "Silky fish"],
        desc: "巴丁鱼片用姜丝葱段爆香，淋一勺绍兴酒提鲜，盖一颗荷包蛋——古早味的温柔。",
        descEn: "Patin fish fillet stir-fried with ginger and scallion, lifted by a splash of Shaoxing wine and crowned with a sunny-side-up egg — gentle, old-school comfort."
    },
];

// ═══════════════════════════════════════════════════════════════════
//   推导层：排期表 × 菜目录 → weeklyMenu（形状与旧手写数组完全一致）。
//   非法排期在模块加载即抛错 → `next build` 直接失败，绝不带病上线。
// ═══════════════════════════════════════════════════════════════════
const WEEKDAY_LABEL: Record<number, string> = {
    1: 'Mon / 周一', 2: 'Tue / 周二', 3: 'Wed / 周三', 4: 'Thu / 周四', 5: 'Fri / 周五',
};

function buildWeeklyMenu(): MenuItem[] {
    const byId = new Map(DISH_CATALOG.map(d => [d.id, d]));
    const seen = new Set<number>();
    const take = (id: number, where: string): DishData => {
        const d = byId.get(id);
        if (!d) throw new Error(`[weeklyMenu] ${where} 引用了不存在的菜 id ${id}`);
        if (seen.has(id)) throw new Error(`[weeklyMenu] 菜 id ${id}「${d.name}」被排进多个位置（${where}）`);
        seen.add(id);
        return d;
    };

    const menu: MenuItem[] = [];

    for (const id of DAILY_DISHES) {
        const d = take(id, 'DAILY_DISHES');
        if (d.hidden) throw new Error(`[weeklyMenu] hidden 菜 id ${id}「${d.name}」不能排进 DAILY_DISHES`);
        menu.push({ ...d, day: 'Daily / 常驻' });
    }

    for (const wd of Object.keys(WEEKLY_SCHEDULE).map(Number)) {
        const label = WEEKDAY_LABEL[wd];
        if (!label) throw new Error(`[weeklyMenu] WEEKLY_SCHEDULE 含非法 weekday ${wd}（只允许 1–5）`);
        WEEKLY_SCHEDULE[wd].forEach((id, i) => {
            const d = take(id, `WEEKLY_SCHEDULE[${wd}]`);
            if (d.hidden) throw new Error(`[weeklyMenu] hidden 菜 id ${id}「${d.name}」不能排进 WEEKLY_SCHEDULE`);
            menu.push({ ...d, day: label, weekday: wd, ...(i === 0 ? { isPrimary: true } : {}) });
        });
    }

    for (const { id, day } of PAUSED_DISHES) {
        const d = take(id, 'PAUSED_DISHES');
        menu.push({ ...d, day, retired: true });
    }

    // 目录里没进任何排期的菜必须是 hidden（staged 未上线），否则视为忘了排期。
    for (const d of DISH_CATALOG) {
        if (seen.has(d.id)) continue;
        if (!d.hidden) throw new Error(`[weeklyMenu] 菜 id ${d.id}「${d.name}」不在任何排期列表里也没标 hidden — 是不是忘了排期？`);
        menu.push({ ...d, day: 'Unscheduled / 未排期' });
    }

    return menu;
}

export const weeklyMenu: MenuItem[] = buildWeeklyMenu();

/**
 * The dish shown in the Hero "Tomorrow's Special" card BEFORE the date-driven
 * `computeNextSpecial()` runs client-side. The Hero special is intentionally
 * computed in an effect (it changes by date and would mismatch on hydration if
 * baked into the static build), so the prerendered HTML needs a real fallback —
 * otherwise crawlers/AI read the placeholder "招牌好菜 / RM 0.00" instead of a
 * real dish name + price. Prefers the BowlMama signature (当归蒸鸡); falls back
 * to the first active dish if it is ever retired.
 */
export const signatureDish: MenuItem =
    weeklyMenu.find(d => d.id === 2 && !d.retired) ?? weeklyMenu.find(d => !d.retired)!;
