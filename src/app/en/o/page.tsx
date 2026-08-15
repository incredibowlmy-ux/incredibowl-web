import type { Metadata } from 'next';
import QuickOrderClient from '../../o/QuickOrderClient';

/**
 * /en/o —— 英文版一键下单页。客流是中英混（老板 2026-08-16 确认），bot 按客户
 * 说的语言发对应链接。与 /o 共用同一个客户端组件，只切 locale —— 结账链路、
 * 预填逻辑、归因全都是同一份代码，不会出现「英文版少修一个 bug」。
 *
 * 同样 noindex：深链落地页，不参与 SEO。
 */

export const metadata: Metadata = {
  title: 'Quick Order · Incredibowl',
  description: "BowlMama's Kitchen — pick your dish, lunch or dinner, address, pay. One screen.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/en/o',
    languages: { 'zh-MY': '/o', 'en-MY': '/en/o', 'x-default': '/o' },
  },
};

export default function QuickOrderPageEn() {
  return <QuickOrderClient locale="en" />;
}
