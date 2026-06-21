export interface MenuItem {
    id: number;
    day: string;
    /**
     * Weekday this dish serves (0=Sun … 6=Sat). Present ONLY for weekly specials.
     * Daily/常驻 dishes and retired dishes omit it. Two specials may share a
     * weekday (e.g. Tuesday) — the Hero "next special" picks the `isPrimary` one.
     * NOTE: `id` is a pure unique identifier — it is NO LONGER the weekday.
     */
    weekday?: number;
    /** When two specials share a `weekday`, the one shown as the Hero headline. */
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
    /** Dish removed from rotation: shown greyed-out on the menu, not orderable. */
    retired?: boolean;
    /**
     * Daily/常驻 dish available ONLY on these weekdays (0=Sun…6=Sat). Absent =
     * all operating days (Mon–Fri). The menu card greys out + shows
     * `unavailableNote` when the next delivery date falls outside this set, and
     * /api/submit-order rejects out-of-range dates (so a direct API call can't
     * skip the greyed card). e.g. 马铃薯炖花肉片 = [4,5] (Thu & Fri only).
     */
    availableWeekdays?: number[];
    /** Short reason shown on a disabled card (retired / weekday-excluded). */
    unavailableNote?: string;
    unavailableNoteEn?: string;
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

export const weeklyMenu: MenuItem[] = [
    // ─── 常驻菜 Daily ───────────────────────────────────────────
    {
        id: 11,
        day: "Daily / 常驻",
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
        id: 12,
        day: "Daily / 常驻",
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
        id: 13,
        day: "Daily / 常驻",
        name: "马铃薯炖花肉片",
        nameEn: "Home-style Pork Belly Slices & Potato Stew",
        price: 19.90,
        image: "/pork_potato_stew.webp",
        // 只在周四、周五供应（碗妈备餐安排）：其余工作日网站可见但不可点；
        // /api/submit-order 也会拒收非周四五的下单，防止绕过菜单卡直接调 API。
        availableWeekdays: [4, 5],
        unavailableNote: "周四五供应",
        unavailableNoteEn: "Thu & Fri only",
        tags: ["能量补给", "软糯入味", "胶原满满", "汤汁拌饭三碗半"],
        tagsEn: ["Energy boost", "Tender & glazed", "Collagen-rich", "Three bowls of rice gone"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。",
        descEn: "Potatoes braised until they melt, stirred into the rice — pure, grounded happiness."
    },
    {
        // 常驻新菜 2026-06-14 上架。a la carte RM22.90；
        // 餐券抵扣需补 RM3（voucherTopUp，餐券覆盖到 RM19.90）。蛋白克数待补后再加标签。
        id: 22,
        day: "Daily / 常驻",
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
    // ─── 周一 Mon ───────────────────────────────────────────────
    {
        // 2026-06-15 重排：原「常驻」鸡扒饭降为周一特餐，并作周一 Hero 主打。
        id: 14,
        day: "Mon / 周一",
        weekday: 1,
        isPrimary: true,
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
        // 2026-06-15 重排：原周四特餐改到周一（周一第二道）。
        id: 4,
        day: "Mon / 周一",
        weekday: 1,
        name: "绍兴酒蒸花肉",
        nameEn: "Shaoxing Wine Steamed Pork Belly",
        price: 19.90,
        image: "/shaoxing_pork_belly.webp",
        tags: ["绍兴酒香", "姜丝提鲜", "蒸香软嫩", "偏肥·肥香控真爱"],
        tagsEn: ["Shaoxing wine aroma", "Ginger-infused", "Steamed & tender", "Rich & fatty"],
        desc: "选偏肥的五花部位，绍兴酒香顺着姜丝蒸进肉里，肥香软糯、入口即化。爱这口肥香的会上瘾；偏好瘦口的朋友这道可能不合。",
        descEn: "Made with the fattier cut of pork belly — Shaoxing wine and ginger steamed deep into the meat, rich and melt-in-your-mouth. If you love that fatty, silky bite you'll adore it; if you prefer lean, this one may not be for you."
    },
    // ─── 周二 Tue ───────────────────────────────────────────────
    {
        // 全新菜 2026-06-21 上架（周二特餐·Hero 主推 isPrimary）。a la carte RM22.90；
        // 餐券抵扣需补 RM3（voucherTopUp，餐券覆盖到 RM19.90），与参峇臭豆同规则。
        // 蛋白 32g（老板/碗妈 2026-06-21 提供）。
        id: 24,
        day: "Tue / 周二",
        weekday: 2,
        isPrimary: true,
        name: "澳洲和牛饼饭",
        nameEn: "Aussie Wagyu Beef Patty Don",
        price: 22.90,
        voucherTopUp: 3,
        image: "/wagyu_beef_patty.webp",
        tags: ["高蛋白 32g+", "澳洲和牛饼", "温泉蛋拌饭", "番茄莎莎清爽"],
        tagsEn: ["32g+ protein", "Aussie wagyu patty", "Onsen egg over rice", "Zesty tomato salsa"],
        desc: "澳洲和牛肉饼香煎到外焦内嫩，盖一颗半熟温泉蛋，金黄蛋液顺着肉香流进米饭；配一勺酸甜樱桃番茄莎莎解腻，丰腴却清爽。",
        descEn: "Aussie wagyu beef patty seared crisp outside and juicy within, crowned with a soft onsen egg whose golden yolk runs into the rice — finished with a tangy cherry-tomato salsa that keeps it bright, not heavy."
    },
    {
        // 2026-06-15 重排：原周三特餐改到周二。2026-06-21 起降为周二第二道（和牛升主推）。
        id: 3,
        day: "Tue / 周二",
        weekday: 2,
        name: "希腊柠香烤鸡胸",
        nameEn: "Greek Mediterranean Lemon Chicken",
        price: 19.90,
        image: "/greek_lemon_chicken_v2.webp",
        tags: ["蛋白质炸弹 64g+", "增肌好伙伴", "最强下饭款"],
        tagsEn: ["64g+ protein bomb", "Gym-friendly", "Best with rice"],
        desc: "柠檬的微酸渗进微焦的鸡胸肉里，带着百里香的清气，加上特级初榨橄榄油，嗯。。",
        descEn: "Lemon's tang seeps into the lightly charred chicken breast, carried by thyme and extra-virgin olive oil. Mmm."
    },
    // ─── 周三 Wed ───────────────────────────────────────────────
    {
        // 2026-06-15 重排：原周二主推改到周三（周三 Hero 主打）。
        id: 20,
        day: "Wed / 周三",
        weekday: 3,
        isPrimary: true,
        name: "古早味姜葱鱼片饭",
        nameEn: "Grandma-Style Ginger-Scallion Fish Fillet",
        price: 18.50,
        image: "/ginger_scallion_fish.webp",
        tags: ["高蛋白 28g+", "古早味", "姜葱爆香", "荷包蛋", "鱼片嫩滑"],
        tagsEn: ["28g+ protein", "Old-school", "Ginger-scallion sear", "Sunny-side egg", "Silky fish"],
        desc: "巴丁鱼片用姜丝葱段爆香，淋一勺绍兴酒提鲜，盖一颗荷包蛋——古早味的温柔。",
        descEn: "Patin fish fillet stir-fried with ginger and scallion, lifted by a splash of Shaoxing wine and crowned with a sunny-side-up egg — gentle, old-school comfort."
    },
    {
        // 2026-06-15 重排：原周二第二道改到周三（周三第二道）。
        id: 2,
        day: "Wed / 周三",
        weekday: 3,
        name: "招牌原盅当归蒸鸡全腿",
        nameEn: "Angelica Steamed Whole Chicken Leg",
        price: 18.50,
        image: "/angelica_chicken.webp",
        tags: ["高蛋白 45g+", "当归补血", "暖身滋补", "碗妈拿手", "一抹归香入魂深"],
        tagsEn: ["45g+ protein", "Angelica blood tonic", "Warming", "BowlMama signature", "Soul-warming"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。",
        descEn: "Angelica root infuses every fibre of the chicken. One sip of the broth and your soul warms up."
    },
    // ─── 周四 Thu ───────────────────────────────────────────────
    {
        // 全新菜 2026-06-15 上架（周四特餐）。a la carte RM19.90 = 标准餐券面值，无需补差价。
        // ⚠️ 图片待老板提供实拍图后替换：暂用 emoji 占位（各 next/image 消费处已加 startsWith('/') 守卫）。
        // 蛋白克数等营养标签待碗妈提供后再补；简介为初稿，待老板审定。
        id: 23,
        day: "Thu / 周四",
        weekday: 4,
        name: "家乡豆酱焖花肉",
        nameEn: "Hometown Taucu Braised Pork Belly",
        price: 19.90,
        image: "🍲",
        tags: ["家乡豆酱", "焖煮入味", "肥香软糯", "下饭神器"],
        tagsEn: ["Hometown taucu", "Slow-braised", "Rich & tender", "Made for rice"],
        desc: "家乡豆酱慢火焖煮花肉，豆香咸鲜渗进每一丝肉里，软糯入味、咸香下饭。",
        descEn: "Pork belly slow-braised in hometown fermented soybean paste (taucu) — savoury, tender and deeply infused, made for rice."
    },
    // ─── 周五 Fri ───────────────────────────────────────────────
    {
        // 周五新上 2026-06-08。a la carte RM23.90；餐券抵扣需补 RM4（voucherTopUp）。
        id: 21,
        day: "Fri / 周五",
        weekday: 5,
        name: "柠香香煎三文鱼饭",
        nameEn: "Lemon Pan-Seared Salmon",
        price: 23.90,
        voucherTopUp: 4,
        image: "/lemon_salmon.webp",
        tags: ["高蛋白 30g+", "香煎三文鱼", "柠香清爽", "Omega-3", "餐券+RM4"],
        tagsEn: ["30g+ protein", "Pan-seared salmon", "Zesty lemon", "Omega-3", "Voucher +RM4"],
        desc: "香煎三文鱼外焦里嫩，挤上柠檬清香，配西兰花、毛豆、玉米与樱桃番茄，清爽又满足。",
        descEn: "Pan-seared salmon, crisp outside and tender within, brightened with lemon and served with broccoli, edamame, corn and cherry tomato — light yet satisfying."
    },
    // ─── 已退役（灰显·可见不可点）Retired ────────────────────────
    {
        // 退役 2026-06-14：周一酱油鸡暂别。保留在菜单上「可见不可点」，附说明。
        // 退役菜去掉 weekday；computeNextSpecial 无周内特餐时回退到 id 14（鸡扒饭）。
        id: 1,
        day: "Mon / 周一",
        retired: true,
        unavailableNote: "酱油鸡暂别，敬请期待回归",
        unavailableNoteEn: "Soy sauce chicken paused — back soon",
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
        // 退役 2026-06-08：周五位让给三文鱼。保留在菜单上「可见不可点」，附说明。
        id: 5,
        day: "Fri / 周五",
        retired: true,
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
    }
];
