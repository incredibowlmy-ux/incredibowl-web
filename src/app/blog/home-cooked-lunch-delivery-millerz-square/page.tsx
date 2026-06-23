import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title:
    "Home-Cooked Lunch Delivery Near Millerz Square | Millerz Square 家常午餐外送 — Incredibowl",
  description:
    "Home-cooked lunch delivery near Millerz Square, Old Klang Road. No MSG, freshly sourced every morning, real protein portions. Order by 6AM, delivered from 11AM. Millerz Square 附近家常午餐外送。",
  alternates: {
    canonical:
      "https://www.incredibowl.my/blog/home-cooked-lunch-delivery-millerz-square",
  },
  openGraph: {
    title: "Home-Cooked Lunch Delivery Near Millerz Square — Incredibowl",
    description:
      "MSG-free home-cooked lunch delivery near Millerz Square / Old Klang Road. Order by 6AM, delivered from 11AM. 无味精家常午餐，每天巴刹现采。",
    url: "https://www.incredibowl.my/blog/home-cooked-lunch-delivery-millerz-square",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/potato_fried_egg.webp",
        width: 1200,
        height: 630,
        alt: "Home-cooked lunch delivery near Millerz Square — Incredibowl",
      },
    ],
    locale: "zh_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function HomeCookedLunchDeliveryMillerzSquare() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Home-Cooked Lunch Delivery Near Millerz Square: A Workday Lunch That Is Not Fried Again",
    description:
      "Where to find home-cooked lunch delivery near Millerz Square and Old Klang Road — MSG-free, freshly sourced, with real protein portions and a 6AM order cutoff.",
    image: "https://www.incredibowl.my/potato_fried_egg.webp",
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
        "https://www.incredibowl.my/blog/home-cooked-lunch-delivery-millerz-square",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is there home-cooked lunch delivery near Millerz Square?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Incredibowl is a home kitchen at Pearl Point, right beside Millerz Square on Old Klang Road, delivering MSG-free home-cooked lunches. Order by 6AM and lunch is delivered from 11AM. Millerz Square sits well within the delivery zone, so delivery is fast and the fee is in the lowest tiers.",
        },
      },
      {
        "@type": "Question",
        name: "午餐几点截单？几点送到？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "每日早上 6AM 截单（碗妈要提前去巴刹采购、提前煮），午餐从 11AM 起陆续送出。想吃当天午餐，最好前一晚或当天清晨 6 点前就下好单。",
        },
      },
      {
        "@type": "Question",
        name: "Millerz Square 送餐运费多少？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运），2.5–5km RM 5（满 RM 30 免运）。Millerz Square 紧邻 Pearl Point，落在最近的运费区间。注册账号填地址后系统会自动核对实际距离与运费。",
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
            Millerz Square 附近的家常午餐外送：上班族中午的另一种选择
          </h1>
          <p className="text-lg text-[#1A2D23]/65 italic">
            Home-Cooked Lunch Delivery Near Millerz Square
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/potato_fried_egg.webp"
            alt="Home-cooked lunch delivery near Millerz Square - Incredibowl 马铃薯煎蛋家常午餐"
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
            For home-cooked lunch delivery near Millerz Square, Incredibowl is a
            home kitchen right beside it at Pearl Point — MSG-free, freshly
            sourced every morning. Order by 6AM at{" "}
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">
              www.incredibowl.my
            </Link>{" "}
            and lunch arrives from 11AM. 无味精家常午餐 · 紧邻 Millerz Square · 2.5km 内 RM 3（满 RM 20 免运）。
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            <strong>Millerz Square</strong> 是 Old Klang Road 上人流密集的综合体，住户、上班族、商户都不少。中午想吃口热饭，常见的选择无非是楼下美食广场、GrabFood 上的连锁快餐——吃多了，总觉得不是太油就是太咸。
          </p>
          <p>
            这篇讲讲 Millerz Square 一带，怎么点到一份<strong>每天现煮、不加味精的家常午餐</strong>。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            一、上班族午餐的三个痛点
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>选来选去都是炸物</strong>：平台上家常菜、健康便当类的选项有限。</li>
            <li><strong>饭多菜少</strong>：照片好看，到手发现蛋白质少得可怜。</li>
            <li><strong>越吃越累</strong>：重油重盐 + 味精，下午容易犯困、口干。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            二、家常午餐外送怎么解决
          </h2>
          <p>
            <Link href="/" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link>（碗妈私厨）就在 Millerz Square 隔壁的 Pearl Point 家庭厨房出餐：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>无味精、每天巴刹现采</strong>，当天煮当天送；</li>
            <li>主菜标<strong>真实蛋白克数</strong>（如招牌当归蒸鸡全腿 45g+ 蛋白），吃得饱也吃得明白；</li>
            <li>菜单<strong>每周轮换 + 常驻菜</strong>，不重复吃腻；</li>
            <li>距离近，午餐送达快，运费落在最低区间。</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            三、午餐怎么下单（重点：6AM 截单）
          </h2>
          <p>
            因为是当天清晨买菜、当天现煮，<strong>每日早上 6AM 截单</strong>，午餐从 11AM 起陆续送出。所以想吃当天午餐，最好<strong>前一晚或当天 6 点前</strong>就下好单。
          </p>
          <p>
            下单步骤：登录 <Link href="/" className="text-[#FF6B35] font-bold hover:underline">www.incredibowl.my</Link> → 选菜 → 填地址（系统自动核对在不在配送范围、运费多少）→ DuitNow QR / FPX / 信用卡支付。
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            常见问题 FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: Is there home-cooked lunch delivery near Millerz Square?</h3>
              <p>Yes — Incredibowl is a home kitchen right beside Millerz Square at Pearl Point, delivering MSG-free home-cooked lunches. Order by 6AM, delivered from 11AM.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: 午餐几点截单？几点送到？</h3>
              <p>每日早上 6AM 截单，午餐从 11AM 起送。想吃当天午餐，前一晚或清晨 6 点前下好单最稳。</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: Millerz Square 送餐运费多少？</h3>
              <p>Pearl Point 出发，2.5km 内 RM 3（满 RM 20 免运）、2.5–5km RM 5（满 RM 30 免运）。Millerz Square 紧邻 Pearl Point，落在最近区间。注册填地址后系统自动核对。</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              明天中午想吃口热乎的家常饭？
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              紧邻 Millerz Square · 无味精 · 每天巴刹采购 · 6AM 截单 · 11AM 起送
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
