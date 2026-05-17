import type { Metadata } from "next";
import OrderClient from "./OrderClient";

export const metadata: Metadata = {
    title: "Pearl Point 私厨外送 · 午晚两餐送到 | Incredibowl",
    description:
        "凌晨 6 点去巴刹，午餐 11:30AM 或晚餐 5PM 送到你手上。RM 16.90 起，5km 内 RM 5（满 RM 20-30 免运）。WhatsApp 一句话下单，不需要注册。Pearl Point / Old Klang Road / OUG。",
    alternates: {
        canonical: "/order",
        languages: {
            "zh-MY": "/order",
            "en-MY": "/en/order",
            "x-default": "/order",
        },
    },
    robots: { index: true, follow: true },
    openGraph: {
        title: "Pearl Point 私厨外送 · 午晚两餐送到",
        description:
            "凌晨 6 点采买 · 午餐 + 晚餐双时段 · 不加味精。WhatsApp 一句话下单。",
        url: "https://www.incredibowl.my/order",
        siteName: "Incredibowl Malaysia",
        images: [
            {
                url: "https://www.incredibowl.my/angelica_chicken.webp",
                width: 1200,
                height: 630,
                alt: "Incredibowl 招牌当归蒸鸡",
            },
        ],
        locale: "zh_MY",
        type: "website",
    },
};

export default function OrderLandingPage() {
    return <OrderClient />;
}
