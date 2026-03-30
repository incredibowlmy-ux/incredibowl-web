export interface MenuItem {
    id: number;
    day: string;
    name: string;
    nameEn: string;
    price: number;
    image: string;
    tags: string[];
    desc: string;
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
        desc: "经典的健康选择。纳豆的鲜香配上顺滑的月见蛋，简单却极富层次。"
    },
    {
        id: 12,
        day: "Daily / 常驻",
        name: "山药云耳海陆双鲜炒",
        nameEn: "Chinese Yam & Black Fungus Surf & Turf",
        price: 18.50,
        image: "/chinese_yam_black_fungus_v3.webp",
        tags: ["~600 kcal*", "高蛋白 31g+", "养胃滋补", "健脾益胃", "清肺润燥", "脆嫩滑爽三重奏"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。"
    },
    {
        id: 13,
        day: "Daily / 常驻",
        name: "招牌原盅当归清蒸鸡全腿",
        nameEn: "Angelica Steamed Whole Chicken Leg",
        price: 18.50,
        image: "/angelica_chicken.webp",
        tags: ["~680 kcal*", "高蛋白 45g+", "当归补血", "暖身滋补", "碗妈拿手", "一抹归香入魂深"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。"
    },
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Pan-Fried Golden Chicken Chop Rice",
        price: 18.50,
        image: "/chicken_chop.webp",
        tags: ["~780 kcal*", "高蛋白 43g+", "焦香四溢", "营养均衡", "外脆里嫩爆汁款"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。"
    },
    {
        id: 3,
        day: "Wed / 周三",
        name: "希腊柠香烤鸡胸",
        nameEn: "Greek Mediterranean Lemon Chicken",
        price: 19.90,
        image: "/greek_lemon_chicken_v2.webp",
        tags: ["~730 kcal*", "蛋白质炸弹 64g+", "增肌好伙伴", "最强下饭款"],
        desc: "柠檬的微酸渗进微焦的鸡胸肉里，带着百里香的清气，加上特级初榨橄榄油，嗯。。"
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖花肉片",
        nameEn: "Home-style Pork Belly Slices & Potato Stew",
        price: 18.50,
        image: "/pork_potato_stew.webp",
        tags: ["~650 kcal*", "能量补给", "软糯入味", "胶原满满", "汤汁拌饭三碗半"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。"
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡汤",
        nameEn: "Golden Scallion Pan-Fried Chicken Soup",
        price: 18.50,
        image: "/scallion_chicken_soup.webp",
        tags: ["~700 kcal*", "高蛋白 37g+", "驱寒暖身", "治愈高汤", "肠胃温柔乡"],
        desc: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。"
    }
];
