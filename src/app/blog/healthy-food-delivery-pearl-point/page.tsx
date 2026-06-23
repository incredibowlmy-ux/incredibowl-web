import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title:
    "Best Healthy Food Delivery Near Pearl Point | Pearl Point 健康餐外送 — Incredibowl",
  description:
    "Looking for healthy food delivery near Pearl Point, Old Klang Road? Incredibowl cooks MSG-free home-cooked meals, freshly sourced every morning, with real protein portions. Pearl Point 健康家常餐外送，无味精、每天巴刹现采。",
  alternates: {
    canonical:
      "https://www.incredibowl.my/blog/healthy-food-delivery-pearl-point",
  },
  openGraph: {
    title: "Best Healthy Food Delivery Near Pearl Point — Incredibowl",
    description:
      "MSG-free, freshly sourced home-cooked meals with real protein portions, delivered near Pearl Point / Old Klang Road. 无味精、每天巴刹现采、真实蛋白克数。",
    url: "https://www.incredibowl.my/blog/healthy-food-delivery-pearl-point",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/lemon_salmon.webp",
        width: 1200,
        height: 630,
        alt: "Healthy food delivery near Pearl Point — Incredibowl lemon salmon",
      },
    ],
    locale: "zh_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function HealthyFoodDeliveryPearlPoint() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Best Healthy Food Delivery Near Pearl Point: How to Judge What Is Actually Healthy",
    description:
      "A guide to healthy food delivery near Pearl Point and Old Klang Road — what healthy really means (no MSG, fresh ingredients, real protein portions) and how to avoid marketing traps.",
    image: "https://www.incredibowl.my/lemon_salmon.webp",
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
        "https://www.incredibowl.my/blog/healthy-food-delivery-pearl-point",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the best healthy food delivery near Pearl Point?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Incredibowl is a home kitchen at Pearl Point, Old Klang Road, cooking MSG-free home-cooked meals with ingredients sourced fresh from the wet market every morning and real protein portions labelled on each dish. It delivers within about 5km of Pearl Point. Order by 6AM at www.incredibowl.my.",
        },
      },
      {
        "@type": "Question",
        name: "怎么判断一份外送是不是真的「健康」？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "别只看「健康」「轻食」这类标签。可以看三点：是否不加味精、食材是否每天新鲜采购（而非冷冻预制）、以及有没有标真实的蛋白克数和份量。三点都清楚的，才比较可信。Incredibowl 这三点都公开。",
        },
      },
      {
        "@type": "Question",
        name: "Pearl Point 送餐范围与运费？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运），2.5–5km RM 5（满 RM 30 免运），5–7.5km RM 12（满 RM 45 免运）。覆盖 Pearl Point、Millerz Square、Meadow Park、The Scott Garden、OUG 等。每日早上 6AM 截单。",
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
            <time dateTime="2026-06-24">2026 年 6 月 24 日</time> · 6 min read
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
            Pearl Point 附近的健康餐外送：怎么定义「健康」才不踩雷
          </h1>
          <p className="text-lg text-[#1A2D23]/65 italic">
            Best Healthy Food Delivery Near Pearl Point
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/lemon_salmon.webp"
            alt="Healthy food delivery near Pearl Point - Incredibowl 柠檬三文鱼健康家常餐"
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
            For healthy food delivery near Pearl Point, Incredibowl is a home
            kitchen cooking MSG-free home-cooked meals — freshly sourced every
            morning, with real protein portions labelled on each dish. Order by
            6AM at{" "}
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">
              www.incredibowl.my
            </Link>
            . 无味精 · 每天巴刹现采 · 真实蛋白克数 · 2.5km 内 RM 3（满 RM 20 免运）。
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            「健康餐」是个被用滥的词。在 <strong>Pearl Point</strong>、<strong>Old Klang Road</strong> 一带搜外送，会看到一堆挂着「健康」「轻食」「low fat」的便当——但真正吃进嘴里，未必健康到哪去。
          </p>
          <p>
            这篇不推销，先讲清楚：在 Pearl Point 附近点外送，<strong>到底该用什么标准判断「健康」</strong>，再看哪些选项对得上。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            一、「健康」该怎么定义？看这三点
          </h2>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>有没有味精</strong>。再「轻」的便当，如果靠味精提鲜，对味精敏感的人一样吃完口干头昏。无味精是健康的底线之一。
            </li>
            <li>
              <strong>食材新不新鲜</strong>。当天巴刹采购、当天烹饪，和中央厨房冷冻预制 + 现场加热，是两回事。新鲜本身就是健康的一部分。
            </li>
            <li>
              <strong>蛋白质够不够、标不标</strong>。健康不等于「吃得少」，而是<strong>蛋白质足、配比合理</strong>。敢标真实蛋白克数的，通常做工扎实。
            </li>
          </ol>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            二、常见的「伪健康」陷阱
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>只写「健康 / 轻食」，但说不清食材来源；</li>
            <li>沙拉看着清爽，酱料却是高油高糖；</li>
            <li>份量小、蛋白少，吃完很快又饿，反而乱吃零食。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            三、Incredibowl 对得上哪几点
          </h2>
          <p>
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link>（碗妈私厨）从 Pearl Point 家庭厨房出餐，刚好对上面三条标准：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>零味精</strong>，靠天然食材提味；</li>
            <li><strong>每天清晨巴刹采购、当天现煮</strong>，不冷冻预制；</li>
            <li>主菜<strong>明标蛋白克数</strong>（如招牌当归蒸鸡全腿 45g+ 蛋白、柠檬三文鱼等高蛋白选项）；</li>
            <li>家常做法、少油少盐，长期吃得下去——健康的关键是<em>可持续</em>，而不是吃两天就放弃的「减脂餐」。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            四、配送范围与下单
          </h2>
          <p>
            Pearl Point 出发，约 5km 覆盖 Pearl Point、Millerz Square、Meadow Park、The Scott Garden、OUG 等。<strong>运费</strong>：2.5km 内 RM 3（满 RM 20 免运）· 2.5–5km RM 5（满 RM 30 免运）· 5–7.5km RM 12（满 RM 45 免运）。每日早上 <strong>6AM 截单</strong>。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            常见问题 FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: What is the best healthy food delivery near Pearl Point?</h3>
              <p>Incredibowl is a home kitchen at Pearl Point cooking MSG-free meals, freshly sourced each morning with real protein portions labelled on each dish, delivered within ~5km. Order by 6AM at www.incredibowl.my.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 怎么判断一份外送是不是真的健康？</h3>
              <p>别只看「健康 / 轻食」标签。看三点：是否不加味精、食材是否每天新鲜采购、有没有标真实蛋白克数和份量。三点都清楚才可信。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: Pearl Point 送餐范围与运费？</h3>
              <p>Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运）、2.5–5km RM 5（满 RM 30 免运）、5–7.5km RM 12（满 RM 45 免运）。覆盖 Millerz Square、Meadow Park、The Scott Garden、OUG 等。</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              想吃得健康一点，又不想吃草？
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              Pearl Point 出发 · 无味精 · 每天巴刹采购 · 真实蛋白克数 · 满额免运
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
