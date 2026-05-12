import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Old Klang Road 食物外送指南 2026 | Pearl Point 家常便当怎么选 — Incredibowl",
  description: "住在 Old Klang Road、Pearl Point、OUG、Millerz Square？这篇指南帮你梳理本地家常菜外送选项：价格、配送时间、健康度对比，以及为什么越来越多邻居选择私厨直送。",
  alternates: {
    canonical: "https://www.incredibowl.my/blog/old-klang-road-food-delivery-guide",
  },
  openGraph: {
    title: "Old Klang Road 食物外送完整指南 — Pearl Point 家常便当",
    description: "Old Klang Road、Pearl Point、OUG 一带家常菜外送指南。无味精、每天巴刹现煮、2km 内免运。",
    url: "https://www.incredibowl.my/blog/old-klang-road-food-delivery-guide",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Old Klang Road home-cooked food delivery — Incredibowl Pearl Point",
      },
    ],
    locale: "zh_MY",
    type: "article",
    publishedTime: "2026-05-05T00:00:00+08:00",
  },
};

export default function OldKlangRoadFoodDeliveryGuide() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Old Klang Road 食物外送指南：Pearl Point 附近的家常便当怎么选",
    description:
      "Old Klang Road、Pearl Point、OUG、Millerz Square 一带家常菜外送选项对比，以及为什么越来越多邻居选择私厨直送。",
    image: "https://www.incredibowl.my/pork_potato_stew.webp",
    datePublished: "2026-05-05T00:00:00+08:00",
    dateModified: "2026-05-05T00:00:00+08:00",
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
        "https://www.incredibowl.my/blog/old-klang-road-food-delivery-guide",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Old Klang Road 有哪些家常菜外送选择？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "目前在 Old Klang Road、Pearl Point、OUG、Millerz Square 一带，主要外送选项有 GrabFood / Foodpanda 平台上的连锁餐厅，以及越来越多直接面向社区的私厨服务。Incredibowl 是其中一家从 Pearl Point 出发、专注无味精家常菜的私厨，每天巴刹新鲜采购，主打妈妈做饭的味道。",
        },
      },
      {
        "@type": "Question",
        name: "Incredibowl 配送范围到哪里？运费多少？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pearl Point 出发，2km 内免运（覆盖 Pearl Point、Millerz Square、Meadow Park、The Scott Garden 等）。2–5km 满 RM40 免运（不到 RM6）。5–8km RM15（满 RM40 → RM5）。8km 以外 RM25（满 RM40 → RM15）。",
        },
      },
      {
        "@type": "Question",
        name: "Incredibowl 怎么下单？什么时候截单？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "通过 www.incredibowl.my 网站直接下单，支付方式包括 DuitNow QR、FPX、信用卡。每日早上 6AM 截单，午餐 11AM 起送，晚餐 5PM 起送。",
        },
      },
      {
        "@type": "Question",
        name: "Incredibowl 的菜不加味精吗？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "对，所有菜品不加味精（No MSG）。每天清晨从巴刹采购新鲜食材，按传统家常做法烹饪，主打妈妈做饭的味道。",
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
            <time dateTime="2026-05-05">2026 年 5 月 5 日</time> · 6 min read
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
            Old Klang Road 食物外送完整指南：Pearl Point 附近的家常便当怎么选
          </h1>
          <p className="text-lg text-[#1A2D23]/65 italic">
            Old Klang Road Food Delivery Guide: Home-Cooked Lunch Near Pearl Point
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/pork_potato_stew.webp"
            alt="Old Klang Road 家常菜外送 - Pearl Point 私厨直送马铃薯炖花肉片"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            如果你住在 <strong>Old Klang Road</strong>、<strong>Pearl Point</strong>、<strong>OUG</strong>、<strong>Meadow Park</strong> 或 <strong>Millerz Square</strong>，可能已经发现一件事：在 GrabFood 和 Foodpanda 上找一份「不那么油、不那么咸、不放味精」的家常便当，越来越难。
          </p>
          <p>
            这篇指南整理了 Old Klang Road 一带常见的外送选项、它们的优缺点，以及为什么越来越多邻居开始转向<strong>社区私厨直送</strong>。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            一、Old Klang Road 一带的外送现况
          </h2>
          <p>
            Old Klang Road（旧巴生路）是吉隆坡南部一条贯穿性的主干道，串起 Mid Valley、Pearl Point、OUG、Salak South 等多个高密度居住区。这一带常住人口以华人家庭和年轻上班族为主，工作日午餐与晚餐的外送需求非常稳定。
          </p>
          <p>
            目前主要的外送方式有三种：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>GrabFood / Foodpanda 平台</strong>：选择多，但商家以连锁快餐、Mamak、咖啡店为主。家常菜 / 健康便当类的选项有限，且平台抽成较高，导致同样的菜在平台上比堂食贵 20–30%。
            </li>
            <li>
              <strong>大型连锁外卖</strong>（KFC / McD / 海底捞外卖等）：味道稳定但偏重油盐，长期吃不算健康，价格也不便宜。
            </li>
            <li>
              <strong>社区私厨直送</strong>：近两年新出现的趋势，由本地厨师从家庭厨房出发，主打<em>每天新鲜、不加味精、家常做法</em>，通常只覆盖周边 2–4km 范围。
            </li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            二、为什么 Pearl Point 邻居开始选择私厨外送？
          </h2>
          <p>
            我们做 <Link href="/" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link>（碗妈私厨）一年多以来，听到最常见的几个理由是：
          </p>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>不放味精</strong>。很多本地华人家庭对味精敏感（吃完口干、头晕），但外面餐厅几乎家家都用。私厨可以直接告诉你「我们一克味精都没有」，并且自己每天采购就是证据。
            </li>
            <li>
              <strong>每日新鲜，不是冷冻预制</strong>。连锁外卖大多是中央厨房 + 冷冻配送 + 现场加热。私厨是当天清晨从巴刹买菜、当天烹饪、当天送出。
            </li>
            <li>
              <strong>份量真实</strong>。很多平台外卖照片好看，到手发现饭多菜少。私厨直接报蛋白克数（例如鸡腿 45g+ 蛋白），不靠图片忽悠。
            </li>
            <li>
              <strong>价格透明</strong>。没有平台抽成，相同的菜比 GrabFood 上便宜 20–30%。
            </li>
          </ol>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            三、配送范围与运费（以 Incredibowl 为例）
          </h2>
          <p>
            从 Pearl Point 出发，2km 范围基本覆盖了 Old Klang Road 中段所有主要公寓与社区：
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pearl Point</li>
            <li>Millerz Square</li>
            <li>Meadow Park 1 / 2 / 3</li>
            <li>The Scott Garden</li>
            <li>D&apos;Ivoz Residences</li>
            <li>Verve Suites</li>
            <li>The Harmony / Platinum Arena</li>
            <li>Citizen 1 &amp; 2</li>
            <li>Petalz Residences</li>
            <li>D&apos;Sands / SkyVille 8 @ Benteng</li>
          </ul>
          <p className="mt-4">
            <strong>运费规则</strong>：2km 内免运 · 2–5km 满 RM40 自动免运（不到 RM6）· 5–8km RM15（满 RM40 → RM5）· 8km+ RM25（满 RM40 → RM15）。每日早上 6AM 截单。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            四、家常菜外送怎么选才不踩雷？
          </h2>
          <p>下单前可以先确认这几点：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>有没有写明「不加味精」</strong>？写得越具体越靠谱。</li>
            <li><strong>食材来源讲不讲清楚</strong>？「每天巴刹采购」比「精选食材」更可信。</li>
            <li><strong>菜单是不是每天 / 每周更新</strong>？固定 30 道菜的店通常是冷冻预制。</li>
            <li><strong>有没有真实蛋白克数 / 份量信息</strong>？敢报数字的，通常做工扎实。</li>
            <li><strong>退款 / 投诉机制</strong>？有正式公司主体（如 Incredibowl Services SA0649425-V）会比 IG 个人号更稳。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            常见问题 FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: Old Klang Road 有哪些家常菜外送选择？</h3>
              <p>主要分三类：GrabFood / Foodpanda 上的连锁餐厅、大型连锁外卖、以及面向社区的私厨直送。Incredibowl 属于第三类，从 Pearl Point 出发，专注无味精家常菜。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: Incredibowl 配送范围到哪里？运费多少？</h3>
              <p>Pearl Point 出发，2km 内免运（涵盖 Old Klang Road 中段绝大部分公寓）。2–5km 满 RM40 自动免运（不到 RM6）。5–8km RM15（满 RM40 自动减至 RM5），8km 以外 RM25（满 RM40 自动减至 RM15）。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 怎么下单？什么时候截单？</h3>
              <p>登录 <Link href="/" className="text-[#FF6B35] font-bold hover:underline">www.incredibowl.my</Link>，选菜 → 填地址 → 选 DuitNow QR / FPX / 信用卡支付即可。每日早上 6AM 截单。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 真的不放味精吗？</h3>
              <p>对，每一道菜都不放味精。每天清晨从巴刹买食材，照传统家常做法烹饪。如果有人吃完不舒服欢迎直接联系，我们会复盘。</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              想试试今天的家常便当？
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              Pearl Point 出发 · 2km 免运 · 不加味精 · 每天巴刹采购
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
