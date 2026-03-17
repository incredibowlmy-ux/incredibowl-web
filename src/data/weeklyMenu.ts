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
        id: 6,
        day: "Daily / 常驻",
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Seaweed Rice Bowl",
        price: 16.90,
        image: "/natto_bowl.jpg",
        tags: ["~485 kcal*", "高蛋白 25g+", "纳豆激酶", "益生菌"],
        desc: "经典的健康选择。纳豆的鲜香配上顺滑的月见蛋，简单却极富层次。"
    },
    {
        id: 2,
        day: "Daily / 常驻",
        name: "山药云耳海陆双鲜炒",
        nameEn: "Chinese Yam & Black Fungus Surf & Turf",
        price: 18.50,
        image: "/chinese_yam_black_fungus_v3.jpg",
        tags: ["~600 kcal*", "高蛋白 31g+", "海陆双蛋白", "养胃滋补", "健脾益胃", "清肺润燥"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。"
    },
    {
        id: 3,
        day: "Daily / 常驻",
        name: "招牌原盅当归清蒸鸡全腿",
        nameEn: "Angelica Steamed Whole Chicken Leg",
        price: 18.50,
        image: "/angelica_chicken.png",
        tags: ["补血活血", "增强免疫", "阿姨拿手"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。"
    },
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Pan-Fried Golden Chicken Chop Rice",
        price: 18.50,
        image: "/chicken_chop.png",
        tags: ["优质蛋白", "焦香四溢"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。"
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖花肉片",
        nameEn: "Home-style Pork Belly Slices & Potato Stew",
        price: 19.90,
        image: "/pork_potato_stew.jpg",
        tags: ["能量补给", "软糯入味"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。"
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡汤",
        nameEn: "Golden Scallion Pan-Fried Chicken Soup",
        price: 18.50,
        image: "/scallion_chicken_soup.jpg",
        tags: ["清淡排毒", "治愈高汤"],
        desc: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。"
    }
];
