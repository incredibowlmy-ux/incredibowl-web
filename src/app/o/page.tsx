import type { Metadata } from 'next';
import QuickOrderClient from './QuickOrderClient';

/**
 * /o —— 碗妈 WhatsApp bot 的一键下单落地页。
 *
 * **刻意 noindex**：这一页是深链落地页，不是 SEO 页。让它进索引会跟 / 和 /order
 * 抢同一批关键词，还会把没有参数的裸访问喂给搜索引擎。入口只有一个：bot 发的链接。
 */

export const metadata: Metadata = {
  title: '一键下单 · Incredibowl 碗妈的厨房',
  description: '碗妈的厨房 · 选菜、选午晚、填地址、付款，一屏搞定。',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/o',
    languages: { 'zh-MY': '/o', 'en-MY': '/en/o', 'x-default': '/o' },
  },
};

export default function QuickOrderPage() {
  return <QuickOrderClient locale="zh" />;
}
