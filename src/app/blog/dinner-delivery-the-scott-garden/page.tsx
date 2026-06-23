import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title:
    "Dinner Delivery Near The Scott Garden | The Scott Garden 晚餐外送 — Incredibowl",
  description:
    "Home-cooked dinner delivery near The Scott Garden, Old Klang Road. No MSG, freshly cooked the same day, warm comforting dishes. Order by 6AM, dinner from 5PM. The Scott Garden 附近家常晚餐外送。",
  alternates: {
    canonical:
      "https://www.incredibowl.my/blog/dinner-delivery-the-scott-garden",
  },
  openGraph: {
    title: "Dinner Delivery Near The Scott Garden — Incredibowl",
    description:
      "MSG-free home-cooked dinner delivery near The Scott Garden / Old Klang Road. Order by 6AM, dinner from 5PM. 无味精家常晚餐，当天现煮。",
    url: "https://www.incredibowl.my/blog/dinner-delivery-the-scott-garden",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/scallion_chicken_soup.webp",
        width: 1200,
        height: 630,
        alt: "Dinner delivery near The Scott Garden — Incredibowl home-cooked soup",
      },
    ],
    locale: "zh_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function DinnerDeliveryTheScottGarden() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Dinner Delivery Near The Scott Garden: Home-Cooked, MSG-Free, Ready When You Get Home",
    description:
      "Where to find home-cooked dinner delivery near The Scott Garden and Old Klang Road — MSG-free, cooked the same day, with a 6AM order cutoff and delivery from 5PM.",
    image: "https://www.incredibowl.my/scallion_chicken_soup.webp",
    datePublished: "2026-06-24T00:00:00+08:00",
    dateModified: "2026-06-24T00:00:00+08:00",
    author: {
      "@type": "Organization",
      name: "Incredibowl Malaysia",
      url: "https://www.incredibowl.my/",
    },
    publisher: {
      "@type": "Organization",
      name: "Incredibowl Malaysia",
      logo: {
        "@type": "ImageObject",
        url: "https://www.incredibowl.my/logo.webp",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id":
        "https://www.incredibowl.my/blog/dinner-delivery-the-scott-garden",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is there dinner delivery near The Scott Garden?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Incredibowl is a home kitchen at Pearl Point on Old Klang Road, near The Scott Garden, delivering MSG-free home-cooked dinners. The Scott Garden is within the delivery zone. Order by 6AM and dinner is delivered from 5PM.",
        },
      },
      {
        "@type": "Question",
        name: "晚餐也要早上 6 点前下单吗？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "是的。因为碗妈是当天清晨去巴刹采购、当天现煮，所有订单（含晚餐）都在早上 6AM 截单。想吃当天晚餐，前一晚或当天 6 点前下单即可，晚餐从 5PM 起送。",
        },
      },
      {
        "@type": "Question",
        name: "The Scott Garden 送餐运费多少？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运），2.5–5km RM 5（满 RM 30 免运）。The Scott Garden 在配送范围内，注册账号填地址后系统会自动核对实际距离与运费。",
        },
      },
    ],
  };

  return (
    <article className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/blog"
          className="text-[#FF6B35] font-bold mb-6 inline-block hover:underline"
        >
          ← 返回博客
        </Link>

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1A2D23]/50 mb-3">
            <time dateTime="2026-06-24">2026 年 6 月 24 日</time> · 5 min read
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
            The Scott Garden 附近的晚餐外送：下班回家就有热饭
          </h1>
          <p className="text-lg text-[#1A2D23]/65 italic">
            Dinner Delivery Near The Scott Garden
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/scallion_chicken_soup.webp"
            alt="Dinner delivery near The Scott Garden - Incredibowl 葱香鸡汤家常晚餐"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        <div className="mb-10 p-5 md:p-6 bg-[#E3EADA]/50 border-l-4 border-[#FF6B35] rounded-r-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-[#1A2D23]/50 mb-2">
            In short
          </p>
          <p className="text-[15px] md:text-[16px] leading-relaxed text-[#1A2D23]/85">
            For dinner delivery near The Scott Garden, Incredibowl is a home
            kitchen at nearby Pearl Point cooking MSG-free home-cooked dinners,
            freshly cooked the same day. Order by 6AM at{" "}
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">
              www.incredibowl.my
            </Link>{" "}
            and dinner arrives from 5PM. 无味精家常晚餐 · 当天现煮 · 2.5km 内 RM 3（满 RM 20 免运）。
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            下班回到 <strong>The Scott Garden</strong> 一带，最不想做的事就是再出门买饭、或对着 GrabFood 滑半天还是点了和昨天一样的快餐。忙了一天，晚餐最想要的其实很简单：<strong>一口热乎、不油不咸、像家里煮的饭</strong>。
          </p>
          <p>
            这篇讲讲 The Scott Garden 附近，怎么点到当天现煮、不加味精的家常晚餐。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            一、晚餐外送，难的是「家的感觉」
          </h2>
          <p>
            连锁外卖味道稳定，但吃久了腻；Mamak、快餐方便，但谈不上滋补。一顿好的晚餐，应该能让你<strong>放松下来、把一天的疲惫放下</strong>——这正是家庭式私厨能做、而中央厨房做不到的事。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            二、Incredibowl 的家常晚餐
          </h2>
          <p>
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link>（碗妈私厨）从 The Scott Garden 附近的 Pearl Point 家庭厨房出餐：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>当天清晨巴刹采购、当天现煮</strong>，不是冷冻加热；</li>
            <li>每一道<strong>不加味精</strong>，靠当归、姜葱等天然食材提味，适合晚上吃得舒服；</li>
            <li>有暖身滋补类（如当归蒸鸡、清炖汤品），也有下饭的家常菜；</li>
            <li>主菜标<strong>真实蛋白克数</strong>，一顿吃得饱也吃得安心。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            三、晚餐下单时间（重点：仍是早上 6AM 截单）
          </h2>
          <p>
            很多人以为晚餐可以临时点——但因为碗妈是<strong>当天清晨买菜、当天煮</strong>，所有订单（含晚餐）都在<strong>早上 6AM 截单</strong>。想吃当天晚餐，前一晚或当天 6 点前下好单即可，<strong>晚餐从 5PM 起送</strong>。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            常见问题 FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: Is there dinner delivery near The Scott Garden?</h3>
              <p>Yes — Incredibowl is a home kitchen at nearby Pearl Point, delivering MSG-free home-cooked dinners. The Scott Garden is within the delivery zone. Order by 6AM, dinner from 5PM.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 晚餐也要早上 6 点前下单吗？</h3>
              <p>是的。碗妈当天清晨采购、当天现煮，所有订单（含晚餐）早上 6AM 截单。晚餐从 5PM 起送。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: The Scott Garden 送餐运费多少？</h3>
              <p>Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运）、2.5–5km RM 5（满 RM 30 免运）。The Scott Garden 在配送范围内，注册填地址后系统自动核对。</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              今晚想吃一顿像家里煮的晚餐？
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              The Scott Garden 附近 · 无味精 · 当天现煮 · 6AM 截单 · 5PM 起送
            </p>
            <Link
              href="/"
              className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
            >
              查看今日菜单 →
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
