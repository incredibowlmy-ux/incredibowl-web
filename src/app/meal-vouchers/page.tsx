import type { Metadata } from 'next';
import MealVouchersView from './MealVouchersView';

export const metadata: Metadata = {
    title: '餐券预付包 Meal Voucher Bundles · Incredibowl',
    description:
        '一次预付、慢慢吃。1 张餐券 = 1 道主菜，5 张 RM 92.50 起，20 张每张低至 RM 17.50（最高省 RM 20），有效期 30 / 60 天。无味精家常菜，Pearl Point 出发配送 Old Klang Road / OUG。',
    alternates: {
        canonical: '/meal-vouchers',
        languages: {
            'zh-MY': '/meal-vouchers',
            'en-MY': '/en/meal-vouchers',
            'x-default': '/meal-vouchers',
        },
    },
};

export default function MealVouchersPage() {
    return <MealVouchersView locale="zh" />;
}
