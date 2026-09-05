import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  DELIVERY_PROSE_EN,
  tierProseEn,
  TIER_INNER,
  TIER_OUTER,
  TIER_MID,
  COVERAGE_AREAS,
} from "@/lib/deliveryCopy";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";
import PageShell from "@/components/layout/PageShell";

// 英文版博文：与 ZH 版 src/app/blog/healthy-food-delivery-pearl-point 同源，
// 结构/样式逐行对齐；运费/覆盖区全部走 deliveryCopy 的 _EN 常量，绝不硬编码数字。
export const metadata: Metadata = {
  title:
    "Best Healthy Food Delivery Near Pearl Point — Incredibowl",
  description:
    "Looking for healthy food delivery near Pearl Point, Old Klang Road? Incredibowl cooks MSG-free home-cooked meals, freshly sourced every morning, with real protein portions.",
  alternates: {
    canonical:
      "https://www.incredibowl.my/en/blog/healthy-food-delivery-pearl-point",
    languages: {
      "zh-MY": "/blog/healthy-food-delivery-pearl-point",
      "en-MY": "/en/blog/healthy-food-delivery-pearl-point",
      "x-default": "/blog/healthy-food-delivery-pearl-point",
    },
  },
  openGraph: {
    title: "Best Healthy Food Delivery Near Pearl Point — Incredibowl",
    description:
      "MSG-free, freshly sourced home-cooked meals with real protein portions, delivered near Pearl Point / Old Klang Road.",
    url: "https://www.incredibowl.my/en/blog/healthy-food-delivery-pearl-point",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/lemon_salmon.webp",
        width: 1200,
        height: 630,
        alt: "Healthy food delivery near Pearl Point — Incredibowl lemon salmon",
      },
    ],
    locale: "en_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function HealthyFoodDeliveryPearlPointEN() {
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
        "https://www.incredibowl.my/en/blog/healthy-food-delivery-pearl-point",
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
        name: "How can you tell whether a delivery meal is actually healthy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Don't just go by labels like \"healthy\" or \"light meal\". Check three things: whether it's cooked without MSG, whether the ingredients are freshly bought each day (rather than frozen and pre-prepped), and whether real protein grams and portion sizes are labelled. Only when all three are clear is it credible. Incredibowl is open about all three.",
        },
      },
      {
        "@type": "Question",
        name: "What is the Pearl Point delivery coverage and fee?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `From Pearl Point: ${tierProseEn(TIER_INNER)}, ${tierProseEn(TIER_OUTER)}, ${tierProseEn(TIER_MID)}. Covers ${COVERAGE_AREAS.join(", ")} and more. Orders close at 6AM daily.`,
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
              <time dateTime="2026-06-24">24 June 2026</time> · 6 min read
            </p>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
              Healthy Food Delivery Near Pearl Point: How to Define &ldquo;Healthy&rdquo; Without Getting Burned
            </h1>
            <p className="text-lg text-[#1A2D23]/65 italic">
              Best Healthy Food Delivery Near Pearl Point
            </p>
          </header>

          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
            <Image
              src="/lemon_salmon.webp"
              alt="Healthy food delivery near Pearl Point - Incredibowl lemon salmon healthy home-cooked meal"
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
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">
                www.incredibowl.my
              </Link>
              . No MSG · Wet-market fresh every morning · Real protein grams · {tierProseEn(TIER_INNER)}.
            </p>
          </div>

          <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
            <p>
              &ldquo;Healthy food&rdquo; is one of the most overused labels around. Search for delivery around <strong>Pearl Point</strong> and <strong>Old Klang Road</strong> and you&rsquo;ll find plenty of meal boxes tagged &ldquo;healthy&rdquo;, &ldquo;light&rdquo; or &ldquo;low fat&rdquo; — but what actually ends up in your mouth may not be all that healthy.
            </p>
            <p>
              This post isn&rsquo;t a sales pitch. First, let&rsquo;s get clear on <strong>what standards you should actually use to judge &ldquo;healthy&rdquo;</strong> when ordering delivery near Pearl Point — then see which options measure up.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              1. How Should &ldquo;Healthy&rdquo; Be Defined? Check These Three Things
            </h2>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>Is there MSG?</strong> However &ldquo;light&rdquo; a meal box looks, if it leans on MSG for flavour, anyone sensitive to it still finishes lunch thirsty and groggy. No MSG is one of the baselines of healthy.
              </li>
              <li>
                <strong>Are the ingredients fresh?</strong> Bought at the wet market and cooked the same day is a very different thing from central-kitchen frozen prep reheated on site. Freshness is itself part of being healthy.
              </li>
              <li>
                <strong>Is there enough protein — and is it labelled?</strong> Healthy doesn&rsquo;t mean &ldquo;eating less&rdquo;; it means <strong>enough protein in a sensible balance</strong>. Kitchens that dare to label real protein grams usually do solid work.
              </li>
            </ol>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              2. Common &ldquo;Fake Healthy&rdquo; Traps
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>The label says &ldquo;healthy / light meal&rdquo;, but nobody can tell you where the ingredients come from;</li>
              <li>The salad looks refreshing, but the dressing is loaded with oil and sugar;</li>
              <li>Small portions with little protein — you&rsquo;re hungry again in no time and end up snacking on junk.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              3. Which of These Boxes Incredibowl Ticks
            </h2>
            <p>
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link> (BowlMama&rsquo;s home kitchen) cooks out of a home kitchen at Pearl Point, and happens to match all three standards above:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Zero MSG</strong> — flavour comes from natural ingredients;</li>
              <li><strong>Sourced from the wet market early every morning and cooked fresh the same day</strong> — no frozen pre-prep;</li>
              <li>Mains carry <strong>real protein gram counts</strong> (like the signature dang gui steamed whole chicken leg with 45g+ protein, or high-protein options like the lemon salmon);</li>
              <li>Home-style cooking, light on oil and salt, that you can keep eating long term — the key to healthy is being <em>sustainable</em>, not a &ldquo;diet meal&rdquo; you give up on after two days.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              4. Delivery Coverage and Ordering
            </h2>
            <p>
              From Pearl Point, the delivery zone covers {COVERAGE_AREAS.join(", ")} and more. <strong>Delivery fee</strong>: {DELIVERY_PROSE_EN}. Orders close at <strong>6AM daily</strong>.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              FAQ
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-black text-lg mb-1">Q: What is the best healthy food delivery near Pearl Point?</h3>
                <p>Incredibowl is a home kitchen at Pearl Point cooking MSG-free meals, freshly sourced each morning with real protein portions labelled on each dish, delivered within ~5km. Order by 6AM at www.incredibowl.my.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: How can you tell whether a delivery meal is actually healthy?</h3>
                <p>Don&rsquo;t just go by &ldquo;healthy / light meal&rdquo; labels. Check three things: whether it&rsquo;s cooked without MSG, whether the ingredients are freshly bought each day, and whether real protein grams and portion sizes are labelled. Only when all three are clear is it credible.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: What is the Pearl Point delivery coverage and fee?</h3>
                <p>From Pearl Point: {tierProseEn(TIER_INNER)}, {tierProseEn(TIER_OUTER)}, {tierProseEn(TIER_MID)}. Covers {COVERAGE_AREAS.join(", ")} and more.</p>
              </div>
            </div>

            <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
              <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
                Want to eat a little healthier — without living on salad?
              </h3>
              <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
                From Pearl Point · No MSG · Wet-market fresh every day · Real protein grams · Free delivery over the threshold
              </p>
              <Link
                href="/en"
                className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
              >
                View Today&rsquo;s Menu →
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
