import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

// 品牌化 404。根 layout 不带 NavBar/Footer，所以这一页自己撑满整屏并铺纸底色
// （body 默认是 kraft #F4EFE6，不显式给 bg 会露出旧底色）。
// 这一页同时服务 /en/* 的未匹配路由，所以中英双语并列，中文在上。
export const metadata: Metadata = {
  title: "页面不存在 · Incredibowl",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] px-6 py-16">
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <Image
          src="/logo.webp"
          alt="Incredibowl"
          width={210}
          height={210}
          className="mb-8 h-24 w-24"
          priority
        />

        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#1A2D23]/40">
          404
        </p>

        <h1 className="mb-2 text-3xl font-bold leading-tight md:text-4xl">
          这页不存在
        </h1>
        <p className="mb-6 text-xl text-[#1A2D23]/55 md:text-2xl">
          Page not found
        </p>

        <p className="mb-10 text-[15px] leading-relaxed text-[#1A2D23]/70">
          可能链接输错了，或这道菜已经下架。
          <br />
          <span className="text-[#1A2D23]/55">
            The link may be wrong, or this dish is no longer on the menu.
          </span>
        </p>

        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-8 py-3 font-bold text-white transition-colors hover:bg-[#E95D31]"
          >
            返回首页 / Home
          </Link>
          <Link
            href="/#menu"
            className="inline-flex items-center justify-center rounded-full border-2 border-[#E3EADA] bg-white px-8 py-3 font-bold text-[#1A2D23] transition-colors hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            看今天菜单 / See the menu
          </Link>
        </div>

        <a
          href="https://wa.me/60103370197"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 text-sm font-bold text-[#FF6B35] transition-colors hover:text-[#E95D31] hover:underline"
        >
          问碗妈 / Ask BowlMama →
        </a>
      </div>
    </main>
  );
}
