import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";
import {
  DELIVERY_PROSE_EN,
  BEYOND_DELIVERY_NOTE_EN,
  tierProseEn,
  TIER_INNER,
  TIER_OUTER,
  TIER_MID,
  COVERAGE_AREAS,
} from "@/lib/deliveryCopy";

// 英文版博客：镜像 /blog/no-msg-food-delivery-old-klang-road，事实（截单时间、
// 运费档位、覆盖区）全部同源 deliveryCopy 常量或照原文直译，无新增主张。

export const metadata: Metadata = {
  title:
    "No MSG Food Delivery in Old Klang Road | Truly MSG-Free Home-Cooked Meals — Incredibowl",
  description:
    "Looking for no-MSG food delivery in Old Klang Road, Pearl Point or OUG? Incredibowl is a home kitchen cooking MSG-free home-cooked meals, freshly sourced from the wet market every morning, delivered within 5km.",
  alternates: {
    canonical:
      "https://www.incredibowl.my/en/blog/no-msg-food-delivery-old-klang-road",
    languages: {
      "zh-MY": "/blog/no-msg-food-delivery-old-klang-road",
      "en-MY": "/en/blog/no-msg-food-delivery-old-klang-road",
      "x-default": "/blog/no-msg-food-delivery-old-klang-road",
    },
  },
  openGraph: {
    title: "No MSG Food Delivery in Old Klang Road — Incredibowl",
    description:
      "MSG-free home-cooked food delivery in Old Klang Road / Pearl Point / OUG. Freshly sourced every morning, no MSG, delivered within 5km.",
    url: "https://www.incredibowl.my/en/blog/no-msg-food-delivery-old-klang-road",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/angelica_chicken.webp",
        width: 1200,
        height: 630,
        alt: "No MSG home-cooked food delivery Old Klang Road — Incredibowl angelica steamed chicken",
      },
    ],
    locale: "en_MY",
    type: "article",
    publishedTime: "2026-06-24T00:00:00+08:00",
  },
};

export default function NoMsgFoodDeliveryOldKlangRoadEN() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "No MSG Food Delivery in Old Klang Road: How to Find Truly MSG-Free Home-Cooked Meals",
    description:
      "A guide to finding no-MSG food delivery in Old Klang Road, Pearl Point and OUG — what MSG-free really means, how to verify it, and why neighbours are switching to home-kitchen delivery.",
    image: "https://www.incredibowl.my/angelica_chicken.webp",
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
        "https://www.incredibowl.my/en/blog/no-msg-food-delivery-old-klang-road",
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
          text: `Incredibowl is a home kitchen based at Pearl Point, Old Klang Road, cooking MSG-free home-cooked meals — covering ${COVERAGE_AREAS.join(", ")}. Every dish is cooked with no MSG, using ingredients sourced fresh from the wet market each morning. Order at www.incredibowl.my by 6AM.`,
        },
      },
      {
        "@type": "Question",
        name: "Is Incredibowl really MSG-free? How can I be sure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — every dish is cooked with no MSG. To judge whether a delivery kitchen is truly MSG-free, look at three things: whether it clearly states 'no MSG', whether it is transparent about where ingredients come from (a daily wet-market run is more credible than a vague 'selected ingredients'), and how your body feels afterwards. Incredibowl buys fresh from the wet market each morning and cooks the same day — you're welcome to share your feedback after eating.",
        },
      },
      {
        "@type": "Question",
        name: "What is the delivery coverage and fee?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `From Pearl Point: ${tierProseEn(TIER_INNER)}, ${tierProseEn(TIER_OUTER)}, ${tierProseEn(TIER_MID)}. ${BEYOND_DELIVERY_NOTE_EN}. After you register and enter your address, the system automatically checks the distance and delivery fee. Orders close at 6AM daily.`,
        },
      },
    ],
  };

  return (
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
            No MSG Food Delivery in Old Klang Road: How to Find Truly MSG-Free Home-Cooked Meals
          </h1>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/angelica_chicken.webp"
            alt="No MSG home-cooked food delivery Old Klang Road - Incredibowl signature angelica steamed chicken"
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
            <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">
              www.incredibowl.my
            </Link>
            . No MSG · wet-market fresh daily · {tierProseEn(TIER_INNER)}.
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <p>
            If you've ever ordered delivery around <strong>Old Klang Road</strong>, <strong>Pearl Point</strong> or <strong>OUG</strong>, you might know the feeling: an hour after a fried rice or fast-food lunch, your mouth goes dry, you keep reaching for water, and your head feels a little foggy. Many local families put this down to <strong>MSG</strong>.
          </p>
          <p>
            The trouble is that almost every restaurant out there uses MSG to boost umami, and menus rarely say so. This piece walks through how to find genuinely MSG-free home-cooked delivery around Old Klang Road.
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            1. Why is &ldquo;no MSG&rdquo; so hard to find?
          </h2>
          <p>
            MSG is cheap, boosts flavour instantly, and is hard to get wrong — so chain fast-food outlets, mamak stalls, kopitiams, and even plenty of &ldquo;healthy&rdquo; bento shops use it. On GrabFood / Foodpanda, merchant descriptions almost never volunteer &ldquo;No MSG&rdquo;, because saying so would only limit how fast they can push out orders.
          </p>
          <p>
            The ones that truly manage without it tend to be <strong>home kitchens that buy fresh and cook the same day</strong> — relying on the flavour of fresh ingredients rather than MSG.
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            2. How do you tell if a delivery is really MSG-free?
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Does it state &ldquo;no MSG&rdquo; in black and white?</strong> The more specific, the more reliable.</li>
            <li><strong>Is it transparent about where ingredients come from?</strong> &ldquo;Bought fresh from the wet market each morning&rdquo; is far more credible than a vague &ldquo;selected ingredients&rdquo;.</li>
            <li><strong>Does the menu change daily / weekly?</strong> A fixed roster of dozens of dishes available anytime usually means frozen, pre-made central-kitchen food.</li>
            <li><strong>Are they open to feedback about how you feel?</strong> A kitchen that says &ldquo;if you don't feel great after eating, tell us and we'll review it&rdquo; usually has nothing to hide.</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            3. How Incredibowl does it
          </h2>
          <p>
            <Link href="/en" className="text-[#FF6B35] font-bold hover:underline">Incredibowl</Link> (BowlMama's kitchen) is a home kitchen based at Pearl Point, focused on <strong>MSG-free home-cooked food</strong>:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Every dish is <strong>MSG-free</strong>, seasoned with natural ingredients like angelica root, ginger, scallion and Shaoxing wine;</li>
            <li><strong>Bought fresh from the wet market</strong> each morning, cooked and delivered the same day — no frozen pre-made food;</li>
            <li>Main dishes list <strong>real protein grams</strong> (e.g. the signature angelica steamed whole chicken leg at 45g+ protein), not photo trickery;</li>
            <li>A registered company entity (Incredibowl Services SA0649425-V) — orders and refunds are all traceable.</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            4. Delivery coverage & ordering
          </h2>
          <p>
            From Pearl Point, delivery covers the main neighbourhoods around {COVERAGE_AREAS.join(", ")}.
          </p>
          <p>
            <strong>Delivery fee</strong>: {DELIVERY_PROSE_EN} · {BEYOND_DELIVERY_NOTE_EN}. Orders close at <strong>6AM daily</strong>; lunch is delivered from 11AM, dinner from 5PM.
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            FAQ
          </h2>
          <div className="space-y-5">
            <div>
              <h3 className="font-black text-lg mb-1">Q: Where can I get no MSG food delivery in Old Klang Road?</h3>
              <p>Incredibowl is a home kitchen at Pearl Point, Old Klang Road, cooking MSG-free meals covering {COVERAGE_AREAS.join(", ")}. Order by 6AM at www.incredibowl.my.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: Is it really MSG-free? How can I be sure?</h3>
              <p>Yes — every dish is cooked with no MSG. Check three things: whether it clearly states &ldquo;no MSG&rdquo;, whether it's transparent about ingredient sourcing, and how you feel after eating. We buy fresh from the wet market and cook the same day — feedback is always welcome.</p>
            </div>
            <div>
              <h3 className="font-black text-lg mb-1">Q: What's the coverage and delivery fee?</h3>
              <p>From Pearl Point: {tierProseEn(TIER_INNER)}, {tierProseEn(TIER_OUTER)}, {tierProseEn(TIER_MID)}. After you register and enter your address, the system automatically checks the distance and fee.</p>
            </div>
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              Craving a home-cooked meal with no MSG?
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              From Pearl Point · no MSG · wet-market fresh daily · {tierProseEn(TIER_INNER)}
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
  );
}
