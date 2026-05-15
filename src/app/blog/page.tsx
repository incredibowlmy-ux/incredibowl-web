import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Incredibowl Blog | Old Klang Road & Pearl Point 私厨外送指南",
  description: "Old Klang Road、Pearl Point、OUG 一带的家常菜外送指南、健康饮食小知识、本地社区故事。每周更新。",
  alternates: {
    canonical: "https://www.incredibowl.my/blog",
  },
  openGraph: {
    title: "Incredibowl Blog | Old Klang Road 食物外送指南",
    description: "Old Klang Road、Pearl Point、OUG 一带的家常菜外送指南。",
    url: "https://www.incredibowl.my/blog",
    siteName: "Incredibowl Malaysia",
    locale: "zh_MY",
    type: "website",
  },
};

const posts = [
  {
    slug: "old-klang-road-food-delivery-guide",
    title: "Old Klang Road 食物外送完整指南：Pearl Point 附近的家常便当怎么选",
    titleEn: "Old Klang Road Food Delivery Guide: Home-Cooked Lunch Near Pearl Point",
    excerpt: "住在 Old Klang Road、Pearl Point、OUG 或 Millerz Square 附近？想点家常便当外送，但 GrabFood 上全是炸物？这篇指南帮你梳理本地外送选项，以及为什么越来越多邻居选择私厨直送。",
    date: "2026-05-05",
    readMin: 6,
    cover: "/pork_potato_stew.webp",
    coverAlt: "马铃薯炖花肉片 - Old Klang Road 私厨家常菜外送",
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <Link
          href="/"
          className="text-[#FF6B35] font-bold mb-8 inline-block hover:underline"
        >
          ← 返回首页 / Back to Home
        </Link>

        <header className="mb-12 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Incredibowl Blog
          </h1>
          <p className="text-base md:text-lg text-[#1A2D23]/70 leading-relaxed">
            Old Klang Road、Pearl Point、OUG 一带的家常菜外送指南、健康饮食小知识、本地社区故事。
          </p>
        </header>

        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
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
                    <p className="text-sm text-[#1A2D23]/60 italic mb-3">
                      {post.titleEn}
                    </p>
                    <p className="text-[15px] text-[#1A2D23]/75 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <span className="mt-4 text-[#FF6B35] font-bold text-sm group-hover:underline">
                      继续阅读 →
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
          <h3 className="text-2xl font-black mb-3">想试试今天的菜单？</h3>
          <p className="text-[#1A2D23]/70 mb-4">
            Pearl Point 出发，5km 内 RM 5（满 RM 20 免运）。
          </p>
          <Link
            href="/"
            className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
          >
            查看今日菜单
          </Link>
        </div>
      </div>
    </div>
  );
}
