import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title:
    "No MSG Food Delivery in Old Klang Road | 无味精家常菜外送 — Incredibowl",
  description:
    "Looking for no-MSG food delivery in Old Klang Road, Pearl Point or OUG? Incredibowl is a home kitchen cooking MSG-free home-cooked meals, freshly sourced from the wet market every morning, delivered within 5km. 无味精家常菜，每天巴刹现采。",
  alternates: {
    canonical:
      "https://www.incredibowl.my/blog/no-msg-food-delivery-old-klang-road",
  },
  openGraph: {
    title: "No MSG Food Delivery in Old Klang Road — Incredibowl",
    description:
      "MSG-free home-cooked food delivery in Old Klang Road / Pearl Point / OUG. Freshly sourced every morning, no MSG, delivered within 5km. 无味精，每天巴刹现采。",
    url: "https://www.incredibowl.my/blog/no-msg-food-delivery-old-klang-road",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/angelica_chicken.webp",
        width: 1200,
        height: 630,
        alt: "No MSG home-cooked food delivery Old Klang Road — Incredibowl angelica steamed chicken",
      },
    ],
    locale: "zh_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function NoMsgFoodDeliveryOldKlangRoad() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "No MSG Food Delivery in Old Klang Road: How to Find Truly MSG-Free Home-Cooked Meals",
    description:
      "A guide to finding no-MSG food delivery in Old Klang Road, Pearl Point and OUG — what MSG-free really means, how to verify it, and why neighbours are switching to home-kitchen delivery.",
    image: "https://www.incredibowl.my/angelica_chicken.webp",
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
        "https://www.incredibowl.my/blog/no-msg-food-delivery-old-klang-road",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Where can I get no MSG food delivery in Old Klang Road?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Incredibowl is a home kitchen based at Pearl Point, Old Klang Road, cooking MSG-free home-cooked meals delivered within about 5km — covering Pearl Point, Millerz Square, Meadow Park, The Scott Garden and OUG. Every dish is cooked with no MSG, using ingredients sourced fresh from the wet market each morning. Order at www.incredibowl.my by 6AM.",
        },
      },
      {
        "@type": "Question",
        name: "Incredibowl 真的不放味精吗？怎么确认？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "对，每一道菜都不放味精（No MSG）。判断一家外送是否真的无味精，可以看三点：有没有明确写出「不加味精」、食材来源讲不讲得清楚（每天巴刹采购比「精选食材」更可信）、以及吃完身体的反应。Incredibowl 每天清晨从巴刹买菜、当天烹饪，欢迎吃后反馈。",
        },
      },
      {
        "@type": "Question",
        name: "配送范围和运费是怎样的？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运），2.5–5km RM 5（满 RM 30 免运），5–7.5km RM 12（满 RM 45 免运），7.5km 以外暂不配送。注册账号填地址后系统会自动核对距离与运费。每日早上 6AM 截单。",
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
            Old Klang Road 无味精外送：怎么找到真正「不放味精」的家常菜
          </h1>
          <p className="text-lg text-[#1A2D23]/65 italic">
            No MSG Food Delivery in Old Klang Road — How to Find Truly MSG-Free Home-Cooked Meals
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/angelica_chicken.webp"
            alt="No MSG home-cooked food delivery Old Klang Road - Incredibowl 招牌当归蒸鸡"
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
            For no MSG food delivery in Old Klang Road, Pearl Point or OUG,
            Incredibowl is a home kitchen at Pearl Point cooking MSG-free
            home-cooked meals, sourced fresh from the wet market every morning
            and delivered within ~5km. Order by 6AM at{" "}
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">
              www.incredibowl.my
            </Link>
            . 无味精 · 每天巴刹现采 · 2.5km 内 RM 3（满 RM 20 免运）。
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            如果你在 <strong>Old Klang Road</strong>、<strong>Pearl Point</strong>、<strong>OUG</strong> 一带找过外送，可能有过这种经历：吃完一份炒饭或快餐，下午开始口干、想喝水、有点头昏。很多本地华人家庭把这归因于<strong>味精（MSG）</strong>。
          </p>
          <p>
            问题是，外面的餐厅几乎家家都用味精提鲜，菜单上也很少写明。这篇就讲讲：在 Old Klang Road 一带，怎么找到真正「不放味精」的家常外送。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            一、为什么「无味精」这么难找？
          </h2>
          <p>
            味精便宜、提鲜快、出错率低，所以连锁快餐、Mamak、咖啡店、甚至不少标榜「健康」的便当店都在用。GrabFood / Foodpanda 上的商家描述里，几乎不会主动标注「No MSG」——因为标了反而限制了出餐效率。
          </p>
          <p>
            真正能做到无味精的，往往是<strong>自己每天买菜、当天现煮的家庭式私厨</strong>：靠新鲜食材本身的味道，而不是靠味精。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            二、怎么判断一家外送是不是真的无味精？
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>有没有白纸黑字写「不加味精 / No MSG」</strong>？写得越具体越靠谱。</li>
            <li><strong>食材来源讲不讲得清楚</strong>？「每天清晨巴刹采购」比模糊的「精选食材」可信得多。</li>
            <li><strong>菜单是不是每天 / 每周更新</strong>？固定几十道、随时能点的，通常是中央厨房冷冻预制。</li>
            <li><strong>敢不敢公开身体反馈</strong>？敢说「吃完不舒服欢迎联系我们复盘」的，通常心里有底。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            三、Incredibowl 的做法
          </h2>
          <p>
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link>（碗妈私厨）是一家从 Pearl Point 出发的家庭式私厨，主打<strong>无味精家常菜</strong>：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>每一道菜<strong>零味精</strong>，靠当归、姜葱、绍兴酒等天然食材提味；</li>
            <li>每天清晨从<strong>巴刹新鲜采购</strong>，当天烹饪、当天送出，不做冷冻预制；</li>
            <li>主菜标注<strong>真实蛋白克数</strong>（例如招牌当归蒸鸡全腿 45g+ 蛋白），不靠图片忽悠；</li>
            <li>有正式公司主体（Incredibowl Services SA0649425-V），下单、退款都有迹可循。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            四、配送范围与下单
          </h2>
          <p>
            从 Pearl Point 出发，约 5km 范围覆盖 Old Klang Road 一带主要社区：Pearl Point、Millerz Square、Meadow Park、The Scott Garden、OUG 等。
          </p>
          <p>
            <strong>运费</strong>：2.5km 内 RM 3（满 RM 20 免运）· 2.5–5km RM 5（满 RM 30 免运）· 5–7.5km RM 12（满 RM 45 免运）· 7.5km 以外暂不配送。每日早上 <strong>6AM 截单</strong>，午餐 11AM 起送、晚餐 5PM 起送。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            常见问题 FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: Where can I get no MSG food delivery in Old Klang Road?</h3>
              <p>Incredibowl is a home kitchen at Pearl Point, Old Klang Road, cooking MSG-free meals delivered within ~5km (Pearl Point, Millerz Square, Meadow Park, The Scott Garden, OUG). Order by 6AM at www.incredibowl.my.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 真的不放味精吗？怎么确认？</h3>
              <p>对，每道菜都不放味精。可以看：有没有明确写明「不加味精」、食材来源讲不讲得清楚、以及吃完身体的反应。我们每天巴刹现采、当天现煮，吃后欢迎直接反馈。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 配送范围和运费？</h3>
              <p>Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运）、2.5–5km RM 5（满 RM 30 免运）、5–7.5km RM 12（满 RM 45 免运）。注册填地址后系统自动核对距离与运费。</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              想吃一顿没有味精的家常饭？
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              Pearl Point 出发 · 不加味精 · 每天巴刹采购 · 2.5km 内 RM 3 满 20 免运
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
