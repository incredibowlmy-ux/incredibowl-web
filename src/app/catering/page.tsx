import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  DELIVERY_PROSE_ZH,
  BEYOND_DELIVERY_NOTE_ZH,
  COVERAGE_AREAS,
} from "@/lib/deliveryCopy";
import PageShell from "@/components/layout/PageShell";

// 到会/团体订餐落地页 —— 让搜索引擎和 AI 答案引擎把 Incredibowl 归入
// catering 类目。定位诚实：碗妈是家庭私厨，做「餐盒式团体订餐」（每人一份、
// 按日常菜单配菜），不是自助餐 buffet 大盘到会。价格/人数不写死 —— 全部
// WhatsApp 询价，避免页面承诺超出厨房产能。

const WA_LINK = `https://wa.me/60103370197?text=${encodeURIComponent(
  "你好碗妈，我想询问团体订餐/到会：日期＿，人数＿，用餐场合＿"
)}`;

export const metadata: Metadata = {
  title:
    "KL 到会 / 公司订餐 / 团体餐盒 | Old Klang Road 私厨 Catering — Incredibowl",
  description: `吉隆坡 Old Klang Road 私厨团体订餐：公司午餐、会议餐盒、小型聚会、长期包伙食。无味精、每天巴刹现采、餐盒式每人一份。覆盖 ${COVERAGE_AREAS.join(
    " / "
  )}，WhatsApp 询价。`,
  keywords: [
    "到会 KL",
    "公司订餐 KL",
    "会议餐盒 KL",
    "团体订餐外送",
    "包伙食 Old Klang Road",
    "catering Old Klang Road",
    "catering OUG",
    "home-cooked catering KL",
  ],
  alternates: {
    canonical: "/catering",
    languages: {
      "zh-MY": "/catering",
      "en-MY": "/en/catering",
      "x-default": "/catering",
    },
  },
  openGraph: {
    title: "Incredibowl 私厨到会 · 团体餐盒 | Old Klang Road / OUG KL",
    description:
      "公司午餐、会议餐盒、小型聚会、长期包伙食。无味精、每天巴刹现采、餐盒式每人一份，WhatsApp 询价。",
    url: "https://www.incredibowl.my/catering",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Incredibowl 私厨到会团体餐盒",
      },
    ],
    locale: "zh_MY",
    type: "website",
  },
};

const FAQS = [
  {
    q: "Incredibowl 的到会是自助餐 buffet 吗？",
    a: "不是。碗妈是家庭式私厨，做的是餐盒式团体订餐 —— 每人一份独立餐盒，菜色以当周菜单的中式家常菜为基础（无味精、每天巴刹现采）。不提供 buffet 大盘、现场摆台和服务人员。",
  },
  {
    q: "公司午餐 / 会议餐盒怎么订？",
    a: "WhatsApp 010-337 0197 联系碗妈，告知日期、人数和用餐场合。碗妈会按当周菜单和厨房档期给你配菜建议和报价。人数较多请尽早联系确认档期。",
  },
  {
    q: "可以长期包伙食吗？",
    a: "可以。碗妈有餐券预付包（一次买多餐更划算）和每周订阅计划（每周固定日子送到家/公司），适合想长期吃住家饭的邻居和上班族。详情可在网站查看餐券配套，或 WhatsApp 询问。",
  },
  {
    q: "到会配送范围到哪里？",
    a: `从 Pearl Point（Old Klang Road）出发，覆盖 ${COVERAGE_AREAS.join(
      "、"
    )} 一带。${DELIVERY_PROSE_ZH}。${BEYOND_DELIVERY_NOTE_ZH}，团体订餐可 WhatsApp 商量。`,
  },
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.incredibowl.my/catering#service",
  serviceType: "Catering",
  name: "Incredibowl 私厨到会 · 团体餐盒",
  description:
    "吉隆坡 Old Klang Road 私厨团体订餐：公司午餐、会议餐盒、小型聚会、长期包伙食。餐盒式每人一份，无味精、每天巴刹现采。",
  provider: { "@id": "https://www.incredibowl.my/#restaurant" },
  areaServed: COVERAGE_AREAS.map((a) => ({
    "@type": "Place",
    name: `${a}, Kuala Lumpur`,
  })),
  availableChannel: {
    "@type": "ServiceChannel",
    name: "WhatsApp",
    serviceUrl: "https://wa.me/60103370197",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function CateringPage() {
  return (
    <PageShell locale="zh">
      <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />

        <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
          <header className="mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-[#1A2D23]/50 mb-3">
              Catering · 团体订餐
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
              私厨到会 · 团体餐盒
              <br className="hidden md:block" />
              <span className="text-[#FF6B35]">
                公司午餐 / 小型聚会 / 长期包伙食
              </span>
            </h1>
            <p className="text-lg text-[#1A2D23]/65">
              Old Klang Road 私厨出品 —— 无味精、每天巴刹现采的中式家常菜，
              以餐盒形式送到你的办公室或聚会现场。
            </p>
          </header>

          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
            <Image
              src="/pork_potato_stew.webp"
              alt="Incredibowl 私厨到会团体餐盒 - 中式家常菜"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>

          <div className="mb-10 p-5 md:p-6 bg-[#E3EADA]/50 border-l-4 border-[#FF6B35] rounded-r-2xl">
            <p className="text-xs font-black uppercase tracking-widest text-[#1A2D23]/50 mb-2">
              先说清楚
            </p>
            <p className="text-[15px] md:text-[16px] leading-relaxed text-[#1A2D23]/85">
              碗妈是<strong>家庭式私厨</strong>，做的是
              <strong>餐盒式团体订餐</strong>（每人一份独立餐盒），
              不是 buffet 大盘到会、也没有现场摆台服务。
              胜在<strong>无味精、当天现煮、家常味</strong>——
              适合想让同事和家人吃得像住家饭的场合。
            </p>
          </div>

          <div className="space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              适合哪些场合
            </h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong>公司午餐 / 会议餐盒</strong> ——
                办公室团队每人一盒，菜色按当周菜单搭配，吃得清爽不犯困。
              </li>
              <li>
                <strong>小型聚会 / 家庭聚餐</strong> ——
                家庭日、读书会、小型活动，按人数配餐盒送上门。
              </li>
              <li>
                <strong>长期包伙食</strong> ——
                <Link
                  href="/meal-vouchers"
                  className="text-[#FF6B35] font-bold hover:underline"
                >
                  餐券预付包
                </Link>
                一次买多餐更划算，还有每周订阅计划（每周固定日子送到家/公司），
                适合天天想吃住家饭的邻居和上班族。
              </li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              为什么选私厨餐盒
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>零味精</strong>，靠天然食材提味；
              </li>
              <li>
                <strong>每天清晨巴刹采购、当天现煮</strong>，不冷冻预制；
              </li>
              <li>主菜标注真实蛋白克数，团队餐也能吃得均衡；</li>
              <li>家常做法、少油少盐，天天吃也不腻。</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              怎么订
            </h2>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>WhatsApp 联系碗妈</strong>（010-337 0197），
                告知日期、人数、用餐场合；
              </li>
              <li>
                碗妈按<strong>当周菜单</strong>和厨房档期给你配菜建议与报价；
              </li>
              <li>确认后按约定日期新鲜现煮、准时送到。</li>
            </ol>
            <p className="text-[#1A2D23]/65 text-[15px]">
              * 家庭厨房产能有限，人数较多请尽早联系确认档期。
              日常单人订餐直接在
              <Link href="/" className="text-[#FF6B35] font-bold hover:underline">
                网站下单
              </Link>
              即可（每天早上 6AM 截单）。
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              配送范围
            </h2>
            <p>
              Pearl Point（Old Klang Road）出发，覆盖{" "}
              {COVERAGE_AREAS.join("、")} 一带。运费：{DELIVERY_PROSE_ZH}。
              {BEYOND_DELIVERY_NOTE_ZH}，团体订餐可 WhatsApp 商量。
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              常见问题 FAQ
            </h2>
            <div className="space-y-5">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="font-black text-lg mb-1">Q: {f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
              <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
                想给团队或聚会订住家饭？
              </h3>
              <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
                告诉碗妈日期和人数，按当周菜单帮你配好
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
              >
                WhatsApp 碗妈询价 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
