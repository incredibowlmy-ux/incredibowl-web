import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { tierProseEn, TIER_INNER, TIER_OUTER, COVERAGE_AREAS } from "@/lib/deliveryCopy";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";
import PageShell from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title:
    "Dinner Delivery Near The Scott Garden | Home-Cooked & MSG-Free — Incredibowl",
  description:
    "Home-cooked dinner delivery near The Scott Garden, Old Klang Road. No MSG, freshly cooked the same day, warm comforting dishes. Order by 6AM, dinner from 5PM.",
  alternates: {
    canonical:
      "https://www.incredibowl.my/en/blog/dinner-delivery-the-scott-garden",
    languages: {
      "zh-MY": "/blog/dinner-delivery-the-scott-garden",
      "en-MY": "/en/blog/dinner-delivery-the-scott-garden",
      "x-default": "/blog/dinner-delivery-the-scott-garden",
    },
  },
  openGraph: {
    title: "Dinner Delivery Near The Scott Garden — Incredibowl",
    description:
      "MSG-free home-cooked dinner delivery near The Scott Garden / Old Klang Road. Order by 6AM, dinner from 5PM. Freshly cooked the same day.",
    url: "https://www.incredibowl.my/en/blog/dinner-delivery-the-scott-garden",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/scallion_chicken_soup.webp",
        width: 1200,
        height: 630,
        alt: "Dinner delivery near The Scott Garden — Incredibowl home-cooked soup",
      },
    ],
    locale: "en_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function DinnerDeliveryTheScottGardenEN() {
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
        "https://www.incredibowl.my/en/blog/dinner-delivery-the-scott-garden",
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
          text: `Yes. Incredibowl is a home kitchen at Pearl Point on Old Klang Road, near The Scott Garden, delivering MSG-free home-cooked dinners. The Scott Garden is within the delivery zone, which covers ${COVERAGE_AREAS.join(", ")}. Order by 6AM and dinner is delivered from 5PM.`,
        },
      },
      {
        "@type": "Question",
        name: "Do dinner orders also close at 6AM?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Because BowlMama shops at the wet market early in the morning and cooks everything fresh the same day, all orders (dinner included) close at 6AM. To have dinner that same day, just order the night before or by 6AM, and dinner is delivered from 5PM.",
        },
      },
      {
        "@type": "Question",
        name: "How much is the delivery fee to The Scott Garden?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `From Pearl Point: ${tierProseEn(TIER_INNER)}, ${tierProseEn(TIER_OUTER)}. The Scott Garden is within the delivery zone, which covers ${COVERAGE_AREAS.join(", ")}. Once you sign up and enter your address, the system automatically checks the actual distance and delivery fee.`,
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
              Dinner Delivery Near The Scott Garden: A Hot Meal Waiting When You Get Home
            </h1>
            <p className="text-lg text-[#1A2D23]/65 italic">
              Home-cooked, MSG-free, freshly cooked the same day
            </p>
          </header>

          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
            <Image
              src="/scallion_chicken_soup.webp"
              alt="Dinner delivery near The Scott Garden - Incredibowl scallion chicken soup, a home-cooked dinner"
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
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">
                www.incredibowl.my
              </Link>{" "}
              and dinner arrives from 5PM. MSG-free home cooking · freshly cooked the same day · {tierProseEn(TIER_INNER)}.
            </p>
          </div>

          <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
            <p>
              Getting back to the <strong>The Scott Garden</strong> area after work, the last thing you want to do is head out again for food — or scroll GrabFood for ages only to order the same fast food as yesterday. After a long day, what you really want for dinner is simple: <strong>something hot, not too oily or salty, that tastes like a meal cooked at home</strong>.
            </p>
            <p>
              This post is about how to order a home-cooked dinner near The Scott Garden — freshly cooked the same day, with no MSG added.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              1. The Hardest Thing for Dinner Delivery to Get Right: The Feeling of Home
            </h2>
            <p>
              Chain delivery food is consistent, but you tire of it after a while; mamak and fast food are convenient, but hardly nourishing. A good dinner should let you <strong>unwind and set down the day&apos;s fatigue</strong> — and that is exactly what a family-style home kitchen can do, and a central kitchen cannot.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              2. Incredibowl&apos;s Home-Cooked Dinners
            </h2>
            <p>
              <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link> (BowlMama&apos;s home kitchen) cooks from a home kitchen at Pearl Point, near The Scott Garden:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Ingredients bought at the wet market early the same morning, cooked fresh the same day</strong> — never frozen and reheated;</li>
              <li>Every dish is made with <strong>no MSG added</strong>, drawing flavour from natural ingredients like dang gui (Chinese angelica), ginger and scallions — easy on the body in the evening;</li>
              <li>There are warming, nourishing options (like dang gui steamed chicken and clear simmered soups), as well as home-cooked dishes that go perfectly with rice;</li>
              <li>Mains are labelled with <strong>real protein gram counts</strong> — a dinner that fills you up and puts your mind at ease.</li>
            </ul>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              3. When to Order Dinner (Key Point: The Cutoff Is Still 6AM)
            </h2>
            <p>
              Many people assume dinner can be ordered last-minute — but because BowlMama <strong>buys ingredients early in the morning and cooks the same day</strong>, all orders (dinner included) close at <strong>6AM</strong>. To have dinner that same day, just place your order the night before or by 6AM, and <strong>dinner is delivered from 5PM</strong>.
            </p>

            <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
              FAQ
            </h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-black text-lg mb-1">Q: Is there dinner delivery near The Scott Garden?</h3>
                <p>Yes — Incredibowl is a home kitchen at nearby Pearl Point, delivering MSG-free home-cooked dinners. The Scott Garden is within the delivery zone. Order by 6AM, dinner from 5PM.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: Do dinner orders also close at 6AM?</h3>
                <p>Yes. BowlMama shops early in the morning and cooks fresh the same day, so all orders (dinner included) close at 6AM. Dinner is delivered from 5PM.</p>
              </div>
              <div>
                <h3 className="font-black text-lg mb-1">Q: How much is the delivery fee to The Scott Garden?</h3>
                <p>From Pearl Point: {tierProseEn(TIER_INNER)}, {tierProseEn(TIER_OUTER)}. The Scott Garden is within the delivery zone, which covers {COVERAGE_AREAS.join(", ")}. Once you sign up and enter your address, the system checks it automatically.</p>
              </div>
            </div>

            <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
              <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
                Craving a dinner tonight that tastes like home cooking?
              </h3>
              <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
                Near The Scott Garden · No MSG · Freshly cooked the same day · Order by 6AM · Dinner from 5PM
              </p>
              <Link
                href="/en"
                className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
              >
                See Today&apos;s Menu →
              </Link>
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
