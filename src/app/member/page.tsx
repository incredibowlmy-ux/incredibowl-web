import type { Metadata } from 'next';
import MemberView from './MemberView';

// Account/function page — not a search-entry page. noindex,follow keeps it out
// of the index while still letting link equity flow. Also excluded from sitemap.
export const metadata: Metadata = {
    title: '会员中心 · Incredibowl',
    robots: { index: false, follow: true },
};

export default function MemberPage() {
    return <MemberView locale="zh" />;
}
