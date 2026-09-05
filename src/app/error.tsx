"use client";

import Link from "next/link";
import Image from "next/image";

// 全局错误边界。Next.js 规定签名必须是 { error, reset }。
// 不上报任何第三方 —— digest 直接显示给顾客，让他 WhatsApp 报给碗妈即可定位。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] px-6 py-16">
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
        <Image
          src="/logo.webp"
          alt="Incredibowl"
          width={210}
          height={210}
          className="mb-8 h-24 w-24"
        />

        <h1 className="mb-2 text-3xl font-bold leading-tight md:text-4xl">
          出错了
        </h1>
        <p className="mb-6 text-xl text-[#1A2D23]/55 md:text-2xl">
          Something went wrong
        </p>

        <p className="mb-8 text-[15px] leading-relaxed text-[#1A2D23]/70">
          这一页暂时打不开。重试一次通常就好了。
          <br />
          <span className="text-[#1A2D23]/55">
            This page failed to load. Trying again usually fixes it.
          </span>
        </p>

        {error.digest && (
          <p className="mb-8 rounded-xl border border-[#E3EADA] bg-white px-4 py-2 font-mono text-xs text-[#1A2D23]/60">
            错误编号 / Error ref: {error.digest}
          </p>
        )}

        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-8 py-3 font-bold text-white transition-colors hover:bg-[#E95D31] active:scale-[0.98]"
          >
            重试 / Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border-2 border-[#E3EADA] bg-white px-8 py-3 font-bold text-[#1A2D23] transition-colors hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            返回首页 / Home
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
