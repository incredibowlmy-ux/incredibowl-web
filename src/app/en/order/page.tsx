import type { Metadata } from "next";
// 与 /order 共用同一个组件（照 /o 的做法），只传 locale —— 这一页原来是 543 行的
// 复制品，任何修复都要改两遍，中英菜名已经因此漂移过（见 OrderClient 顶部注释）。
import OrderClient from "../../order/OrderClient";
import { DELIVERY_PROSE_SHORT_EN, COVERAGE_AREAS } from "@/lib/deliveryCopy";

export const metadata: Metadata = {
    title: "Pearl Point Home Kitchen · Lunch + Dinner Delivery | Incredibowl",
    description:
        `6 AM market run · lunch (11:30 AM) or dinner (5 PM) delivery. From RM 16.90; ${DELIVERY_PROSE_SHORT_EN}. One WhatsApp to order — no signup. Covering ${COVERAGE_AREAS.join(" / ")}.`,
    alternates: {
        canonical: "/en/order",
        languages: {
            "zh-MY": "/order",
            "en-MY": "/en/order",
            "x-default": "/order",
        },
    },
    robots: { index: true, follow: true },
    openGraph: {
        title: "Pearl Point Home Kitchen · Lunch + Dinner Delivery",
        description:
            "6 AM market run · lunch + dinner slots · no MSG. One WhatsApp to order.",
        url: "https://www.incredibowl.my/en/order",
        siteName: "Incredibowl Malaysia",
        images: [
            {
                url: "https://www.incredibowl.my/angelica_chicken.webp",
                width: 1200,
                height: 630,
                alt: "Incredibowl signature angelica chicken",
            },
        ],
        locale: "en_MY",
        type: "website",
    },
};

export default function OrderLandingPageEn() {
    return <OrderClient locale="en" />;
}
