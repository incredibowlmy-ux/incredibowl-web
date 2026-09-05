import type { Metadata } from 'next';

/**
 * /admin/** 一律不进搜索索引。
 *
 * public/robots.txt 里有 `Disallow: /admin`，但那只是「请不要爬」的君子协定，
 * 且不覆盖已经被别处链到的页面。页面级 robots meta 才是真的告诉引擎别收录。
 * （2026-07-26 审计 A6：admin 路由从来没导出过 robots 元数据。）
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
