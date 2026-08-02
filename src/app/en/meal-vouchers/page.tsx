import MealVouchersView from '../../meal-vouchers/MealVouchersView';

export const metadata = {
    title: 'Meal Voucher Bundles · Incredibowl',
    description: 'Pre-paid meal voucher bundles. Buy once, eat anytime within 30–60 days. 1 voucher = 1 main dish, even the pricier ones. From RM 17.50 a voucher.',
    alternates: {
        canonical: '/en/meal-vouchers',
        languages: {
            'zh-MY': '/meal-vouchers',
            'en-MY': '/en/meal-vouchers',
            'x-default': '/meal-vouchers',
        },
    },
};

export default function EnMealVouchersPage() {
    return <MealVouchersView locale="en" />;
}
