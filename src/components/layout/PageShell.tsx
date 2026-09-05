import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LanguageSwitcher from '@/components/home/LanguageSwitcher';
import Footer from '@/components/home/Footer';
import FooterEN from '@/components/home-en/FooterEN';

/**
 * 站内二级页的外壳（catering / blog / 法务三页）。
 *
 * 背景：NavBar + Footer 只在 `/` 和 `/en` 渲染，其余公开页从头到尾**没有页脚**
 * —— 没有联系方式、没有法务链接、没有配送范围，也没有语言切换。搜索进来的英文
 * 访客站在 `/catering` 上找不到 `/en/catering`。
 *
 * 这里给这些页补一个「精简 header（Logo 回首页 + 品牌字 + 语言切换）+ 原样页脚」。
 * 不复刻首页 NavBar：那个组件要 currentUser / cartCount / onCartOpen 等一整套购物车
 * 状态，二级页没有也不该有。
 *
 * 本组件是 **server component**：`LanguageSwitcher` / `Footer` / `FooterEN` 都能直接
 * 作为子组件引入（客户端组件由 App Router 自己划边界，无需在这里加 "use client"）。
 */

const COPY = {
    zh: {
        home: '/',
        wordmark: '碗妈的厨房',
        homeLabel: 'Incredibowl 碗妈的厨房 首页',
    },
    en: {
        home: '/en',
        wordmark: 'BowlMama’s Kitchen',
        homeLabel: 'Incredibowl BowlMama Kitchen home',
    },
} as const;

interface PageShellProps {
    locale: 'zh' | 'en';
    children: React.ReactNode;
}

export default function PageShell({ locale, children }: PageShellProps) {
    const { home, wordmark, homeLabel } = COPY[locale];

    return (
        <>
            <header className="bg-[#FDFBF7] border-b border-[#E3EADA]">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
                    <Link href={home} aria-label={homeLabel} className="group flex items-center gap-3 min-w-0">
                        <span className="w-11 h-11 md:w-12 md:h-12 shrink-0 rounded-full bg-white border-2 border-[#E3EADA] shadow-sm flex items-center justify-center overflow-hidden">
                            <Image src="/logo.webp" alt="" width={96} height={96} className="scale-110" />
                        </span>
                        <span className="min-w-0 leading-none">
                            <span className="block truncate text-lg md:text-xl font-bold tracking-tight text-[#1A2D23] group-hover:text-[#FF6B35] transition-colors">
                                {wordmark}
                            </span>
                            <span className="mt-1 block text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-[#FF6B35]">
                                Incredibowl.my
                            </span>
                        </span>
                    </Link>
                    <LanguageSwitcher current={locale} />
                </div>
            </header>

            {/* id="main" 是 root layout 里那条 skip link 的落点 —— 二级页此前全都没有它，
                键盘用户按下「跳到主内容」是空跳。 */}
            <main id="main">{children}</main>

            {locale === 'zh' ? <Footer /> : <FooterEN />}
        </>
    );
}
