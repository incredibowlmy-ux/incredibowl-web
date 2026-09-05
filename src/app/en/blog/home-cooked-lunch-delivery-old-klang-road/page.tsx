import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";
import { tierProseEn, TIER_INNER, TIER_OUTER, COVERAGE_AREAS } from "@/lib/deliveryCopy";
import PageShell from "@/components/layout/PageShell";

// 英文版博客：镜像 /blog/home-cooked-lunch-delivery-old-klang-road，事实（截单
// 时间、运费档位、覆盖区）全部同源 deliveryCopy 常量或照原文直译，无新增主张。

export const metadata: Metadata = {
  title:
    "Home-Cooked Lunch Delivery Old Klang Road | MSG-Free Workday Lunch — Incredibowl",
  description:
    "Home-cooked lunch delivery on Old Klang Road. No MSG, freshly sourced every morning, real protein portions. Order by 6AM, delivered from 11AM.",
  alternates: {
    canonical:
      "https://www.incredibowl.my/en/blog/home-cooked-lunch-delivery-old-klang-road",
    languages: {
      "zh-MY": "/blog/home-cooked-lunch-delivery-old-klang-road",
      "en-MY": "/en/blog/home-cooked-lunch-delivery-old-klang-road",
      "x-default": "/blog/home-cooked-lunch-delivery-old-klang-road",
    },
  },
  openGraph: {
    title: "Home-Cooked Lunch Delivery on Old Klang Road — Incredibowl",
    description:
      "MSG-free home-cooked lunch delivery on Old Klang Road. Order by 6AM, delivered from 11AM.",
    url: "https://www.incredibowl.my/en/blog/home-cooked-lunch-delivery-old-klang-road",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/potato_fried_egg.webp",
        width: 1200,
        height: 630,
        alt: "Home-cooked lunch delivery Old Klang Road — Incredibowl",
      },
    ],
    locale: "en_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function HomeCookedLunchDeliveryOldKlangRoadEN() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Home-Cooked Lunch Delivery on Old Klang Road: A Workday Lunch That Is Not Fried Again",
    description:
      "Where to find home-cooked lunch delivery on Old Klang Road — MSG-free, freshly sourced, with real protein portions and a 6AM order cutoff.",
    image: "https://www.incredibowl.my/potato_fried_egg.webp",
    datePublished: "2026-06-24T00:00:00+08:00",
    dateModified: "2026-06-24T00:00:00+08:00",
    author: {
      "@type": "Organization",
      name: "Incredibowl Malaysia",
      url: "https://www.incredibowl.my/en",
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
        "https://www.incredibowl.my/en/blog/home-cooked-lunch-delivery-old-klang-road",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is there home-cooked lunch delivery on Old Klang Road?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Incredibowl is a home kitchen at Pearl Suria Residence, right next to Pearl Point on Old Klang Road, delivering MSG-free home-cooked lunches. Order by 6AM and lunch is delivered from 11AM. The delivery zone covers ${COVERAGE_AREAS.join(", ")}.`,
        },
      },
      {
        "@type": "Question",
        name: "What time does lunch close, and when is it delivered?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Orders close at 6AM daily (BowlMama needs to head to the wet market and cook ahead), and lunch is delivered from 11AM onwards. To get lunch the same day, it's best to order the night before or by 6AM that morning.",
        },
      },
      {
        "@type": "Question",
        name: "How much is delivery around Old Klang Road?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `From Pearl Suria (right next to Pearl Point): ${tierProseEn(TIER_INNER)}, ${tierProseEn(TIER_OUTER)}. The delivery zone covers ${COVERAGE_AREAS.join(", ")}. After you register and enter your address, the system automatically checks the actual distance and fee.`,
        },
      },
    ],
  };

  return (
    <PageShell locale="en">
      <article className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
        <SetHtmlLang />
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
            href="/en/blog"
            className="text-[#FF6B35] font-bold mb-6 inline-block hover:underline"
          >
            ← Back to Blog
          </Link>

          <header className="mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-[#1A2D23]/50 mb-3">
              <time dateTime="2026-06-24">24 June 2026</time> · 5 min read
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
              Home-Cooked Lunch Delivery on Old Klang Road: A Better Option for Office Workers
            </h1>
          </header>

          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
            <Image
              src="/potato_fried_egg.webp"
              alt="Home-cooked lunch delivery Old Klang Road - Incredibowl potato fried egg home-style lunch"
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
              For home-cooked lunch delivery on Old Klang Road, Incredibowl is a
              home kitchen at Pearl Suria Residence, right next to Pearl Point —
              MSG-free, freshly sourced every morning. Order by 6AM at{" "}
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">
                www.incredibowl.my
              </Link>{" "}
              and lunch arrives from 11AM. MSG-free home-cooked lunch · cooked right on Old Klang Road · {tierProseEn(TIER_INNER)}.
            </p>
          </div>

          <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
            <p>
              <strong>Old Klang Road</strong> is packed with homes and offices — Pearl Point, Millerz Square, The Scott Garden, OUG — plenty of residents, office workers and businesses. When lunchtime rolls around and you want something hot, the usual options are the food court downstairs or a fast-food chain on GrabFood — and after a while, it all feels either too oily or too salty.
            </p>
            <p>
              This piece walks through how to get a <strong>freshly cooked, MSG-free home-cooked lunch</strong> around Old Klang Road.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              1. The three lunchtime pain points for office workers
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Everything&apos;s fried</strong>: platforms have limited home-cooked or healthy-bento options.</li>
              <li><strong>Lots of rice, little else</strong>: the photo looks good, but the protein that arrives is disappointingly little.</li>
              <li><strong>The more you eat, the more tired you feel</strong>: heavy oil, heavy salt and MSG make for an afternoon slump and a dry mouth.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              2. How home-cooked lunch delivery solves it
            </h2>
            <p>
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link> (BowlMama&apos;s kitchen) cooks out of a home kitchen at Pearl Suria Residence, right next to Pearl Point:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>No MSG, wet-market fresh daily</strong> — cooked and delivered the same day;</li>
              <li>Main dishes list <strong>real protein grams</strong> (e.g. the signature angelica steamed whole chicken leg at 45g+ protein) — you eat well and you know exactly what you&apos;re getting;</li>
              <li>The menu <strong>rotates weekly plus daily staples</strong>, so you don&apos;t get bored;</li>
              <li>It cooks right on Old Klang Road, so lunch arrives fast and the fee is tiered by actual distance.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              3. How to order lunch (key point: 6AM cutoff)
            </h2>
            <p>
              Because ingredients are bought fresh that morning and cooked the same day, <strong>orders close at 6AM daily</strong>, with lunch delivered from 11AM onwards. So to get lunch the same day, it&apos;s best to place your order <strong>the night before or by 6AM that morning</strong>.
            </p>
            <p>
              Ordering steps: sign in at <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">www.incredibowl.my</Link> → pick your dishes → enter your address (the system automatically checks whether you&apos;re in the delivery zone and what the fee is) → pay by DuitNow QR / FPX / credit card.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              FAQ
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-black text-lg mb-1">Q: Is there home-cooked lunch delivery on Old Klang Road?</h3>
                <p>Yes — Incredibowl is a home kitchen at Pearl Suria Residence, right next to Pearl Point on Old Klang Road, delivering MSG-free home-cooked lunches. Order by 6AM, delivered from 11AM.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: What time does lunch close, and when is it delivered?</h3>
                <p>Orders close at 6AM daily, with lunch delivered from 11AM. To get lunch the same day, ordering the night before or by 6AM that morning is safest.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: How much is delivery around Old Klang Road?</h3>
                <p>From Pearl Suria (right next to Pearl Point): {tierProseEn(TIER_INNER)}, {tierProseEn(TIER_OUTER)}. The delivery zone covers {COVERAGE_AREAS.join(", ")}. After you register and enter your address, the system checks automatically.</p>
              </div>
            </div>

            <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
              <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
                Want a hot, home-cooked lunch tomorrow?
              </h3>
              <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
                Cooked on Old Klang Road · no MSG · wet-market fresh daily · orders close 6AM · delivered from 11AM
              </p>
              <Link
                href="/en"
                className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
              >
                See today&apos;s menu →
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
