import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { DELIVERY_PROSE_SHORT_EN } from "@/lib/deliveryCopy";
import SetHtmlLang from "@/components/home-en/SetHtmlLang";

// 英文版 blog index：posts 数组独立在本文件（excerptEn 只在这里维护，
// 不动 ZH index 的数组）；slug/日期/封面与 ZH 完全同源。
export const metadata: Metadata = {
  title: "Incredibowl Blog | Old Klang Road & Pearl Point Home-Cooked Delivery Guides",
  description: "Home-cooked food delivery guides, healthy-eating tips and local community stories for Old Klang Road, Pearl Point and OUG. Updated weekly.",
  alternates: {
    canonical: "https://www.incredibowl.my/en/blog",
    languages: { "zh-MY": "/blog", "en-MY": "/en/blog", "x-default": "/blog" },
  },
  openGraph: {
    title: "Incredibowl Blog | Old Klang Road Food Delivery Guides",
    description: "Home-cooked food delivery guides for Old Klang Road, Pearl Point and OUG.",
    url: "https://www.incredibowl.my/en/blog",
    siteName: "Incredibowl Malaysia",
    locale: "en_MY",
    type: "website",
  },
};

const posts = [
  {
    slug: "no-msg-food-delivery-old-klang-road",
    title: "No MSG Food Delivery in Old Klang Road: How to Find Food That's Truly MSG-Free",
    excerpt: "Dry mouth and a foggy head after lunch? It's often the MSG. How to tell whether a delivery kitchen around Old Klang Road / Pearl Point / OUG really skips the MSG — and how Incredibowl cooks without it.",
    date: "2026-06-24",
    readMin: 5,
    cover: "/angelica_chicken.webp",
    coverAlt: "No MSG home-cooked food delivery Old Klang Road - Incredibowl signature angelica steamed chicken",
  },
  {
    slug: "home-cooked-lunch-delivery-old-klang-road",
    title: "Home-Cooked Lunch Delivery on Old Klang Road: A Better Option for Office Workers",
    excerpt: "Fried food again, heavy on oil and salt? Right on Old Klang Road there's a home kitchen — wet-market fresh every day, no MSG. Orders close 6AM, delivery from 11AM, with a quick ordering guide.",
    date: "2026-06-24",
    readMin: 5,
    cover: "/potato_fried_egg.webp",
    coverAlt: "Home-cooked lunch delivery Old Klang Road - Incredibowl potato fried egg home-style lunch",
  },
  {
    slug: "dinner-delivery-the-scott-garden",
    title: "Dinner Delivery Near The Scott Garden: Hot Home-Cooked Food Waiting After Work",
    excerpt: "After a long day, all you want is a hot, home-style dinner. How to order same-day-cooked, MSG-free dinner around The Scott Garden — note that dinner orders still close at 6AM, delivery from 5PM.",
    date: "2026-06-24",
    readMin: 5,
    cover: "/scallion_chicken_soup.webp",
    coverAlt: "Dinner delivery near The Scott Garden - Incredibowl scallion chicken soup home-style dinner",
  },
  {
    slug: "healthy-food-delivery-pearl-point",
    title: "Healthy Food Delivery Near Pearl Point: How to Define \"Healthy\" Without Getting Burned",
    excerpt: "\"Healthy\" is an overused word. What standards actually matter when ordering delivery around Pearl Point (no MSG, fresh daily, real protein grams) — and how to dodge the fake-healthy traps.",
    date: "2026-06-24",
    readMin: 6,
    cover: "/lemon_salmon.webp",
    coverAlt: "Healthy food delivery near Pearl Point - Incredibowl lemon salmon healthy home-cooked meal",
  },
  {
    slug: "old-klang-road-food-delivery-guide",
    title: "Old Klang Road Food Delivery Guide: Choosing Home-Cooked Meals Near Pearl Point",
    excerpt: "Living near Old Klang Road, Pearl Point, OUG or Millerz Square? Want home-cooked delivery but GrabFood is all fried food? This guide maps out your local options — and why more neighbours are ordering direct from a home kitchen.",
    date: "2026-05-05",
    readMin: 6,
    cover: "/pork_potato_stew.webp",
    coverAlt: "Potato pork belly stew - Old Klang Road home-kitchen food delivery",
  },
];

export default function BlogIndexEN() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
      <SetHtmlLang />
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <Link
          href="/en"
          className="text-[#FF6B35] font-bold mb-8 inline-block hover:underline"
        >
          ← Back to Home
        </Link>

        <header className="mb-12 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Incredibowl Blog
          </h1>
          <p className="text-base md:text-lg text-[#1A2D23]/70 leading-relaxed">
            Home-cooked food delivery guides, healthy-eating tips and local community stories for Old Klang Road, Pearl Point and OUG.
          </p>
        </header>

        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/en/blog/${post.slug}`}
              className="block group"
            >
              <article className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-[#E3EADA] transition-all">
                <div className="md:flex">
                  <div className="relative w-full md:w-72 aspect-[16/10] md:aspect-auto md:h-auto bg-[#E3EADA] shrink-0">
                    <Image
                      src={post.cover}
                      alt={post.coverAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 288px"
                    />
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#1A2D23]/50 mb-3">
                      <time dateTime={post.date}>{post.date}</time>
                      <span>·</span>
                      <span>{post.readMin} min read</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black leading-tight mb-2 group-hover:text-[#FF6B35] transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-[15px] text-[#1A2D23]/75 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <span className="mt-4 text-[#FF6B35] font-bold text-sm group-hover:underline">
                      Read more →
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        <div className="mt-16 p-6 md:p-8 bg-[#E3EADA]/40 rounded-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-[#1A2D23]/60 mb-2">
            Hungry now?
          </p>
          <h3 className="text-2xl font-black mb-3">Fancy today&apos;s menu?</h3>
          <p className="text-[#1A2D23]/70 mb-4">
            From Pearl Point — {DELIVERY_PROSE_SHORT_EN}.
          </p>
          <Link
            href="/en"
            className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
          >
            See today&apos;s menu
          </Link>
        </div>
      </div>
    </div>
  );
}
