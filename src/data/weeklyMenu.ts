export interface MenuItem {
    id: number;
    day: string;
    name: string;
    nameEn: string;
    price: number;
    image: string;
    tags: string[];
    desc: string;
    descEn?: string;
    tagsEn?: string[];
}

/**
 * SEO-optimised alt text for a menu item image.
 * Includes dish name + a descriptive (non-numeric) tag + locality keyword
 * to feed Google Images long-tail traffic for "Pearl Point 私厨外送" / "OKR 家常菜".
 */
export function dishImageAlt(item: MenuItem, locale: 'zh' | 'en' = 'zh'): string {
    if (locale === 'en') {
        return `${item.nameEn} — Incredibowl home-cooked delivery, Pearl Point / OKR Kuala Lumpur`;
    }
    // Pick first tag that isn't a calorie/protein number (those start with ~ or digit)
    const descriptiveTag = item.tags?.find(t => !/^[~\d]/.test(t)) ?? '招牌家常菜';
    return `${item.name} - ${descriptiveTag} - Pearl Point 私厨外送 · OKR 家常菜`;
}

export const weeklyMenu: MenuItem[] = [
    {
        id: 11,
        day: "Daily / 常驻",
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Seaweed Rice Bowl",
        price: 16.90,
        image: "/natto_bowl.webp",
        tags: ["~485 kcal*", "高蛋白 25g+", "纳豆激酶", "益生菌", "拉丝入魂拌饭魂"],
        tagsEn: ["~485 kcal*", "25g+ protein", "Nattokinase", "Probiotic", "Stringy & soulful"],
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
        tags: ["~600 kcal*", "高蛋白 31g+", "养胃滋补", "健脾益胃", "清肺润燥", "脆嫩滑爽三重奏"],
        tagsEn: ["~600 kcal*", "31g+ protein", "Stomach-warming", "Spleen-nourishing", "Lung-soothing", "Crisp & silky"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。",
        descEn: "Fresh Chinese yam with crunchy black fungus — the gentlest care your gut could ask for."
    },
    {
        id: 13,
        day: "Daily / 常驻",
        name: "招牌原盅当归清蒸鸡全腿",
        nameEn: "Angelica Steamed Whole Chicken Leg",
        price: 18.50,
        image: "/angelica_chicken.webp",
        tags: ["~680 kcal*", "高蛋白 45g+", "当归补血", "暖身滋补", "碗妈拿手", "一抹归香入魂深"],
        tagsEn: ["~680 kcal*", "45g+ protein", "Angelica blood tonic", "Warming", "BowlMama signature", "Soul-warming"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。",
        descEn: "Angelica root infuses every fibre of the chicken. One sip of the broth and your soul warms up."
    },
    {
        id: 14,
        day: "Daily / 常驻",
        name: "酱油鸡全腿",
        nameEn: "Soy Sauce Chicken Whole Leg",
        price: 18.50,
        image: "/soy_sauce_chicken_leg.webp",
        tags: ["~750 kcal*", "高蛋白 48g+", "广式经典", "酱香入骨", "皮亮肉嫩", "一口酱香魂归位"],
        tagsEn: ["~750 kcal*", "48g+ protein", "Cantonese classic", "Soy-infused", "Glossy & tender", "Soy-glazed comfort"],
        desc: "广式经典做法，酱油的咸香慢慢渗进每一丝鸡肉，皮亮肉嫩。",
        descEn: "A Cantonese classic — savoury soy slowly infusing every strand of chicken. Glossy skin, tender meat."
    },
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Pan-Fried Golden Chicken Chop Rice",
        price: 18.50,
        image: "/chicken_chop.webp",
        tags: ["~780 kcal*", "高蛋白 43g+", "焦香四溢", "营养均衡", "外脆里嫩爆汁款"],
        tagsEn: ["~780 kcal*", "43g+ protein", "Aromatic sear", "Balanced", "Crisp outside, juicy inside"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。",
        descEn: "The seared aroma I waited for as a kid — no fancy seasoning, just salt and pepper, done right."
    },
    {
        id: 3,
        day: "Wed / 周三",
        name: "希腊柠香烤鸡胸",
        nameEn: "Greek Mediterranean Lemon Chicken",
        price: 19.90,
        image: "/greek_lemon_chicken_v2.webp",
        tags: ["~730 kcal*", "蛋白质炸弹 64g+", "增肌好伙伴", "最强下饭款"],
        tagsEn: ["~730 kcal*", "64g+ protein bomb", "Gym-friendly", "Best with rice"],
        desc: "柠檬的微酸渗进微焦的鸡胸肉里，带着百里香的清气，加上特级初榨橄榄油，嗯。。",
        descEn: "Lemon's tang seeps into the lightly charred chicken breast, carried by thyme and extra-virgin olive oil. Mmm."
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖花肉片",
        nameEn: "Home-style Pork Belly Slices & Potato Stew",
        price: 18.50,
        image: "/pork_potato_stew.webp",
        tags: ["~650 kcal*", "能量补给", "软糯入味", "胶原满满", "汤汁拌饭三碗半"],
        tagsEn: ["~650 kcal*", "Energy boost", "Tender & glazed", "Collagen-rich", "Three bowls of rice gone"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。",
        descEn: "Potatoes braised until they melt, stirred into the rice — pure, grounded happiness."
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡汤",
        nameEn: "Golden Scallion Pan-Fried Chicken Soup",
        price: 18.50,
        image: "/scallion_chicken_soup.webp",
        tags: ["~700 kcal*", "高蛋白 37g+", "驱寒暖身", "治愈高汤", "肠胃温柔乡"],
        tagsEn: ["~700 kcal*", "37g+ protein", "Warm & restorative", "Healing broth", "Gut-friendly"],
        desc: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。",
        descEn: "A bowl of clear scallion broth — washing off a week's tiredness, ready for a clean weekend."
    }
];
