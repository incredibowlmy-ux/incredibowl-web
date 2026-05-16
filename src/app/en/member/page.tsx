import MemberView from '../../member/MemberView';

export const metadata = {
    title: 'Member Center · Incredibowl',
    description: 'Manage your Incredibowl profile, orders, meal vouchers, and referral rewards.',
    alternates: {
        canonical: '/en/member',
        languages: {
            'zh-MY': '/member',
            'en-MY': '/en/member',
            'x-default': '/member',
        },
    },
};

export default function EnMemberPage() {
    return <MemberView locale="en" />;
}
