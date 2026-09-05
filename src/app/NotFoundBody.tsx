"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * 404 的正文。根 not-found.tsx 是 server 组件（要导出 metadata），而「访客在
 * /en/* 下撞 404 就该看英文」这件事只有客户端拿得到路径，所以正文单独拆出来。
 * 中文站仍然中英并列（老客户里两种都有）；/en 下只给英文，按钮回 /en。
 */
const COPY = {
  zh: {
    title: "这页不存在",
    sub: "Page not found",
    body: "可能链接输错了，或这道菜已经下架。",
    bodySub: "The link may be wrong, or this dish is no longer on the menu.",
    home: "返回首页 / Home",
    menu: "看今天菜单 / See the menu",
    ask: "问碗妈 / Ask BowlMama →",
    homeHref: "/",
    menuHref: "/#menu",
  },
  en: {
    title: "Page not found",
    sub: "这页不存在",
    body: "The link may be wrong, or this dish is no longer on the menu.",
    bodySub: "",
    home: "Back to home",
    menu: "See today's menu",
    ask: "Ask BowlMama →",
    homeHref: "/en",
    menuHref: "/en#menu",
  },
} as const;

export default function NotFoundBody() {
  const pathname = usePathname() || "";
  const t = pathname === "/en" || pathname.startsWith("/en/") ? COPY.en : COPY.zh;
  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <Image
          src="/logo.webp"
          alt="Incredibowl"
          width={210}
          height={210}
          className="mb-8 h-24 w-24"
          priority
        />

        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/40">
          404
        </p>

        <h1 className="mb-2 text-3xl font-bold leading-tight md:text-4xl">{t.title}</h1>
        <p className="mb-6 text-xl text-ink/55 md:text-2xl">{t.sub}</p>

        <p className="mb-10 text-[15px] leading-relaxed text-ink/70">
          {t.body}
          {t.bodySub && (
            <>
              <br />
              <span className="text-ink/55">{t.bodySub}</span>
            </>
          )}
        </p>

        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href={t.homeHref}
            className="inline-flex items-center justify-center btn-primary px-8 py-3"
          >
            {t.home}
          </Link>
          <Link
            href={t.menuHref}
            className="inline-flex items-center justify-center rounded-xl border-2 border-line bg-white px-8 py-3 font-bold text-ink transition-colors hover:border-primary hover:text-primary"
          >
            {t.menu}
          </Link>
        </div>

        <a
          href="https://wa.me/60103370197"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 text-sm btn-link"
        >
          {t.ask}
        </a>
      </div>
    </main>
  );
}
