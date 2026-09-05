import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";
import {
  DELIVERY_PROSE_EN,
  DELIVERY_PROSE_SHORT_EN,
  BEYOND_DELIVERY_NOTE_EN,
  tierProseEn,
  TIER_INNER,
  TIER_OUTER,
  TIER_MID,
  COVERAGE_AREAS,
} from "@/lib/deliveryCopy";
import PageShell from "@/components/layout/PageShell";

// 英文版博客：镜像 /blog/old-klang-road-food-delivery-guide，事实（截单时间、
// 运费档位、覆盖区）全部同源 deliveryCopy 常量或照原文直译，无新增主张。

export const metadata: Metadata = {
  title:
    "Old Klang Road Food Delivery Guide 2026 | Home-Cooked Meals Near Pearl Point — Incredibowl",
  description:
    "Living in Old Klang Road, Pearl Point, OUG or Millerz Square? This guide walks through your local home-cooked food delivery options — prices, delivery times, healthiness — and why more and more neighbours are choosing home-kitchen direct delivery.",
  alternates: {
    canonical:
      "https://www.incredibowl.my/en/blog/old-klang-road-food-delivery-guide",
    languages: {
      "zh-MY": "/blog/old-klang-road-food-delivery-guide",
      "en-MY": "/en/blog/old-klang-road-food-delivery-guide",
      "x-default": "/blog/old-klang-road-food-delivery-guide",
    },
  },
  openGraph: {
    title:
      "The Complete Old Klang Road Food Delivery Guide — Home-Cooked Meals Near Pearl Point",
    description: `A home-cooked food delivery guide for Old Klang Road, Pearl Point and OUG. No MSG, sourced fresh from the wet market daily, ${DELIVERY_PROSE_SHORT_EN}.`,
    url: "https://www.incredibowl.my/en/blog/old-klang-road-food-delivery-guide",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Old Klang Road home-cooked food delivery — Incredibowl Pearl Point",
      },
    ],
    locale: "en_MY",
    type: "article",
    publishedTime: "2026-05-05T00:00:00+08:00",
  },
};

export default function OldKlangRoadFoodDeliveryGuideEN() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Old Klang Road Food Delivery Guide: How to Choose Home-Cooked Meals Near Pearl Point",
    description:
      "A comparison of home-cooked food delivery options around Old Klang Road, Pearl Point, OUG and Millerz Square — and why more and more neighbours are switching to home-kitchen direct delivery.",
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
        "https://www.incredibowl.my/en/blog/old-klang-road-food-delivery-guide",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What home-cooked food delivery options are there in Old Klang Road?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Around Old Klang Road, Pearl Point, OUG and Millerz Square, the main delivery options are the chain restaurants on GrabFood / Foodpanda, plus a growing number of home-kitchen services serving the community directly. Incredibowl is one of them — a home kitchen based at Pearl Point, focused on MSG-free home-cooked dishes, sourced fresh from the wet market every day, with the taste of mum's cooking.",
        },
      },
      {
        "@type": "Question",
        name: "How far does Incredibowl deliver? What are the delivery fees?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `From Pearl Point: ${tierProseEn(TIER_INNER)}, ${tierProseEn(TIER_OUTER)}. Covers most condos and neighbourhoods around ${COVERAGE_AREAS.join(", ")}. ${tierProseEn(TIER_MID)}. ${BEYOND_DELIVERY_NOTE_EN} — WhatsApp us for corporate order quotes.`,
        },
      },
      {
        "@type": "Question",
        name: "How do I order from Incredibowl? When is the cutoff?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Order directly at www.incredibowl.my — payment methods include DuitNow QR, FPX and credit card. Orders close at 6AM daily; lunch is delivered from 11AM and dinner from 5PM.",
        },
      },
      {
        "@type": "Question",
        name: "Does Incredibowl cook without MSG?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — every dish is cooked with no MSG. Fresh ingredients are bought from the wet market early each morning and cooked the traditional home-style way, with the taste of mum's cooking.",
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
              <time dateTime="2026-05-05">May 5, 2026</time> · 6 min read
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
              The Complete Old Klang Road Food Delivery Guide: How to Choose a Home-Cooked Meal Near Pearl Point
            </h1>
          </header>

          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
            <Image
              src="/pork_potato_stew.webp"
              alt="Old Klang Road home-cooked food delivery - pork belly and potato stew delivered direct from a Pearl Point home kitchen"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>

          <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
            <p>
              If you live in <strong>Old Klang Road</strong>, <strong>Pearl Point</strong>, <strong>OUG</strong>, <strong>Meadow Park</strong> or <strong>Millerz Square</strong>, you may have noticed something: finding a home-cooked meal on GrabFood or Foodpanda that&apos;s &quot;not too oily, not too salty, and made without MSG&quot; keeps getting harder.
            </p>
            <p>
              This guide runs through the common delivery options around Old Klang Road, their pros and cons, and why more and more neighbours are turning to <strong>community home-kitchen direct delivery</strong>.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              1. The Delivery Scene Around Old Klang Road Today
            </h2>
            <p>
              Old Klang Road is a major artery running through southern Kuala Lumpur, linking Mid Valley, Pearl Point, OUG, Salak South and several other high-density residential areas. The residents here are mostly Chinese families and young working adults, so weekday lunch and dinner delivery demand is very steady.
            </p>
            <p>
              There are currently three main ways to get food delivered:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>GrabFood / Foodpanda platforms</strong>: plenty of choice, but the merchants are mostly chain fast food, mamak stalls and kopitiams. Home-cooked / healthy meal options are limited, and high platform commissions mean the same dish costs 20–30% more on the platform than dining in.
              </li>
              <li>
                <strong>Large chain takeaway</strong> (KFC / McD / Haidilao delivery, etc.): consistent taste but heavy on oil and salt — not exactly healthy long-term, and not cheap either.
              </li>
              <li>
                <strong>Community home-kitchen direct delivery</strong>: a trend that&apos;s emerged over the past couple of years — local cooks working from home kitchens, focused on <em>fresh every day, no MSG, home-style cooking</em>, usually covering only a 2–4km radius nearby.
              </li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              2. Why Are Pearl Point Neighbours Switching to Home-Kitchen Delivery?
            </h2>
            <p>
              In the year-plus we&apos;ve been running <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link> (BowlMama&apos;s home kitchen), the reasons we hear most often are:
            </p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>No MSG</strong>. Many local Chinese families are sensitive to MSG (dry mouth and dizziness after eating), yet almost every restaurant out there uses it. A home kitchen can tell you outright, &quot;we don&apos;t use a single gram of MSG&quot; — and buying our own ingredients every day is the proof.
              </li>
              <li>
                <strong>Fresh daily, not frozen and pre-made</strong>. Most chain takeaway is central kitchen + frozen distribution + on-site reheating. A home kitchen buys from the wet market at dawn, cooks the same day and sends it out the same day.
              </li>
              <li>
                <strong>Honest portions</strong>. Plenty of platform listings look great in photos, but what arrives is mostly rice and very little food. A home kitchen states real protein grams (e.g. a chicken leg with 45g+ protein) instead of relying on flattering photos.
              </li>
              <li>
                <strong>Transparent pricing</strong>. With no platform commission, the same dishes cost 20–30% less than on GrabFood.
              </li>
            </ol>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              3. Delivery Coverage &amp; Fees (Incredibowl as an Example)
            </h2>
            <p>
              From Pearl Point, delivery essentially covers all the major condos and neighbourhoods in these areas:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              {COVERAGE_AREAS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-4">
              <strong>Delivery fee rules</strong>: {DELIVERY_PROSE_EN} · {BEYOND_DELIVERY_NOTE_EN} (for corporate orders, WhatsApp us for a quote). Orders close at 6AM daily.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              4. How to Pick a Home-Cooked Food Delivery Without Getting Burned
            </h2>
            <p>Before ordering, check these few things:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Do they explicitly state &quot;No MSG&quot;</strong>? The more specific the wording, the more trustworthy.</li>
              <li><strong>Is the ingredient sourcing clearly explained</strong>? &quot;Bought from the wet market every day&quot; is far more credible than &quot;premium ingredients&quot;.</li>
              <li><strong>Does the menu change daily / weekly</strong>? A shop with a fixed 30-dish menu is usually serving frozen, pre-made food.</li>
              <li><strong>Do they publish real protein grams / portion info</strong>? Kitchens willing to state numbers usually do solid work.</li>
              <li><strong>Is there a refund / complaint channel</strong>? A registered company entity (e.g. Incredibowl Services SA0649425-V) is more dependable than a personal IG account.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              FAQ
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-black text-lg mb-1">Q: What home-cooked food delivery options are there in Old Klang Road?</h3>
                <p>They fall into three main categories: chain restaurants on GrabFood / Foodpanda, large chain takeaway, and home-kitchen direct delivery serving the community. Incredibowl belongs to the third — based at Pearl Point, focused on MSG-free home-cooked dishes.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: How far does Incredibowl deliver? What are the delivery fees?</h3>
                <p>From Pearl Point: {tierProseEn(TIER_INNER)}, {tierProseEn(TIER_OUTER)} (covering most condos around {COVERAGE_AREAS.join(", ")}). {tierProseEn(TIER_MID)}. {BEYOND_DELIVERY_NOTE_EN} — for corporate orders, please WhatsApp us for a quote.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: How do I order? When is the cutoff?</h3>
                <p>Head to <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">www.incredibowl.my</Link>, pick your dishes → fill in your address → pay via DuitNow QR / FPX / credit card. Orders close at 6AM daily.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: Do you really cook without MSG?</h3>
                <p>Yes — every single dish is made without MSG. We buy our ingredients from the wet market early each morning and cook them the traditional home-style way. If anything ever makes you feel unwell after eating, please reach out — we&apos;ll review it.</p>
              </div>
            </div>

            <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
              <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
                Want to try today&apos;s home-cooked meal?
              </h3>
              <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
                From Pearl Point · {DELIVERY_PROSE_SHORT_EN} · No MSG · Fresh from the wet market daily
              </p>
              <Link
                href="/en"
                className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
              >
                View Today&apos;s Menu →
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
