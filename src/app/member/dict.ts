/**
 * Member-page i18n dictionary.
 *
 * Architecture: the single component `MemberView` accepts a `locale: 'zh' | 'en'`
 * prop and looks up `MEMBER_DICT[locale]` for all user-facing copy. Two thin
 * page.tsx wrappers (/member and /en/member) render <MemberView> with the
 * right locale. Anything dynamic (dish names, user-typed addresses, voucher
 * codes) stays untranslated.
 *
 * Parameterised strings are functions returning a string so call sites can
 * pass values without string interpolation hacks (`(n) => \`...${n}...\``).
 */

export type Locale = 'zh' | 'en';

interface MemberDictShape {
    // Auth gate
    memberCenter: string;
    pleaseLoginFirst: string;
    loginReturnHome: string;

    // Header
    backHome: string;
    logout: string;
    defaultGreeting: string;
    daysJoined: (n: number) => string;
    editProfile: string;

    // Stats grid
    statsTotalOrders: string;
    statsTotalSpent: string;
    statsFavCount: string;
    statsDaysJoined: string;

    // Favorite dish
    favDishLabel: string;
    favDishOrderCount: (n: number) => string;

    // Order history
    orderHistory: string;
    orderCountSuffix: (n: number) => string;
    noOrders: string;
    goOrder: string;
    statusPending: string;
    statusConfirmed: string;
    statusPreparing: string;
    statusDelivered: string;
    statusCancelled: string;
    orderItemSuffix: (n: number) => string;
    reorder: string;
    reorderWaPrefix: string;
    reorderWaTotal: (rm: string) => string;
    reorderWaAddress: (addr: string) => string;
    reorderWaThanks: string;

    // Meal voucher wallet
    mealVoucherWallet: string;
    mealVouchersAvailable: (n: number) => string;
    noMealVouchers: string;
    mealVoucherTagline: string;
    buyMealVoucher: string;
    availableMealVouchers: string;
    voucherEqualsMeal: string;
    soonestExpiry: string;
    daysUnit: string;
    expiringSoon: string;
    redeemAtCheckoutHint: string;
    buyMore: string;

    // Edit profile modal
    updateProfile: string;
    updateMemberInfoSub: string;
    fieldName: string;
    fieldPhone: string;
    fieldAddress: string;
    placeholderName: string;
    placeholderPhone: string;
    placeholderAddress: string;
    verifyAddressBtn: string;
    verifying: string;
    addressErrorMinLength: string;
    addressErrorGeneric: string;
    addressErrorNetwork: string;
    addressChangedReverify: string;
    distanceFromPearlPoint: (km: number) => string;
    allOrdersFreeShipping: string;
    partialMatchWarning: (km: number) => string;
    fillAllFields: string;
    confirmAddressFirst: string;
    confirmAddressFirstBtn: string;
    saveProfile: string;
    cancel: string;
    saveFailed: string;
}

export const MEMBER_DICT: Record<Locale, MemberDictShape> = {
    zh: {
        memberCenter: '会员中心',
        pleaseLoginFirst: '请先在首页登录后再访问',
        loginReturnHome: '返回首页登录',

        backHome: '返回首页',
        logout: '登出帐号',
        defaultGreeting: '亲爱的会员',
        daysJoined: (n) => `加入第 ${n} 天`,
        editProfile: '编辑资料',

        statsTotalOrders: '总订单',
        statsTotalSpent: '累计消费',
        statsFavCount: '最爱点数',
        statsDaysJoined: '已加入天',

        favDishLabel: '⭐ 你最常点的菜',
        favDishOrderCount: (n) => `已点 ${n} 次`,

        orderHistory: '订单记录',
        orderCountSuffix: (n) => `${n} 单`,
        noOrders: '还没有订单',
        goOrder: '去点餐 →',
        statusPending: '待确认',
        statusConfirmed: '已确认',
        statusPreparing: '准备中',
        statusDelivered: '已送达',
        statusCancelled: '已取消',
        orderItemSuffix: (n) => `等${n}份`,
        reorder: '再来一单',
        reorderWaPrefix: '🍛 我想再来一单！',
        reorderWaTotal: (rm) => `总计: RM ${rm}`,
        reorderWaAddress: (addr) => `📍 地址: ${addr}`,
        reorderWaThanks: '谢谢碗妈！',

        mealVoucherWallet: '我的餐券钱包',
        mealVouchersAvailable: (n) => `${n} 张可用`,
        noMealVouchers: '暂无餐券',
        mealVoucherTagline: '一次买下，30 / 60 天内任吃 · 不限菜品 · 最多省 RM 20',
        buyMealVoucher: '购买餐券包',
        availableMealVouchers: '可用餐券',
        voucherEqualsMeal: '张 · 1 张 = 1 份主餐',
        soonestExpiry: '最近到期',
        daysUnit: '天',
        expiringSoon: '即将过期',
        redeemAtCheckoutHint: '结账时勾选「用餐券抵扣」即可使用',
        buyMore: '再买一份',

        updateProfile: '更新个人资料',
        updateMemberInfoSub: 'Update Member Info',
        fieldName: '会员姓名 Name',
        fieldPhone: '手机号码 Phone',
        fieldAddress: '配送地址 Address',
        placeholderName: '您的名字',
        placeholderPhone: '例: 010-337 0197',
        placeholderAddress: '例: Pearl Point, Block B-12-3, Jalan 1/116B, OKR, 58000 KL',
        verifyAddressBtn: '📍 确认地址 / 检查配送区',
        verifying: '验证中…',
        addressErrorMinLength: '请填写完整地址（至少 10 个字符）',
        addressErrorGeneric: '地址验证失败',
        addressErrorNetwork: '网络错误，请重试',
        addressChangedReverify: '⚠️ 地址已修改，请重新点「确认地址」验证',
        distanceFromPearlPoint: (km) => `距 Pearl Point ${km}km`,
        allOrdersFreeShipping: '✅ 你的订单全部免运',
        partialMatchWarning: (km) => `⚠️ Google 没找到完全匹配，按 ${km}km 计算运费。如有疑问 WhatsApp 联系碗妈`,
        fillAllFields: '请填写完整资料',
        confirmAddressFirst: '请先点「📍 确认地址」验证后再保存',
        confirmAddressFirstBtn: '请先确认地址',
        saveProfile: '确认保存',
        cancel: '取消',
        saveFailed: '保存失败，请稍后再试',
    },
    en: {
        memberCenter: 'Member Center',
        pleaseLoginFirst: 'Please sign in from the homepage first.',
        loginReturnHome: 'Back to homepage',

        backHome: 'Back to home',
        logout: 'Log out',
        defaultGreeting: 'Dear member',
        daysJoined: (n) => `${n} days as a member`,
        editProfile: 'Edit profile',

        statsTotalOrders: 'Orders',
        statsTotalSpent: 'Total spent',
        statsFavCount: 'Top dish count',
        statsDaysJoined: 'Days joined',

        favDishLabel: '⭐ Your most-ordered dish',
        favDishOrderCount: (n) => `Ordered ${n} times`,

        orderHistory: 'Order history',
        orderCountSuffix: (n) => `${n} order${n === 1 ? '' : 's'}`,
        noOrders: 'No orders yet',
        goOrder: 'Order now →',
        statusPending: 'Pending',
        statusConfirmed: 'Confirmed',
        statusPreparing: 'Preparing',
        statusDelivered: 'Delivered',
        statusCancelled: 'Cancelled',
        orderItemSuffix: (n) => `+ ${n} items`,
        reorder: 'Reorder',
        reorderWaPrefix: "🍛 I'd like to reorder!",
        reorderWaTotal: (rm) => `Total: RM ${rm}`,
        reorderWaAddress: (addr) => `📍 Address: ${addr}`,
        reorderWaThanks: 'Thanks BowlMama!',

        mealVoucherWallet: 'My meal voucher wallet',
        mealVouchersAvailable: (n) => `${n} available`,
        noMealVouchers: 'No meal vouchers yet',
        mealVoucherTagline: 'Buy once, eat within 30 / 60 days · Any dish · Save up to RM 20',
        buyMealVoucher: 'Buy a voucher bundle',
        availableMealVouchers: 'Available vouchers',
        voucherEqualsMeal: 'vouchers · 1 = 1 main dish',
        soonestExpiry: 'Earliest expiry',
        daysUnit: 'days',
        expiringSoon: 'Expiring soon',
        redeemAtCheckoutHint: 'Tick "use meal voucher" at checkout',
        buyMore: 'Buy more',

        updateProfile: 'Update profile',
        updateMemberInfoSub: 'Update Member Info',
        fieldName: 'Name',
        fieldPhone: 'Phone',
        fieldAddress: 'Delivery address',
        placeholderName: 'Your name',
        placeholderPhone: 'e.g. 010-337 0197',
        placeholderAddress: 'e.g. Pearl Point, Block B-12-3, Jalan 1/116B, OKR, 58000 KL',
        verifyAddressBtn: '📍 Verify address / check zone',
        verifying: 'Verifying...',
        addressErrorMinLength: 'Please enter a full address (at least 10 characters)',
        addressErrorGeneric: 'Address verification failed',
        addressErrorNetwork: 'Network error, please retry',
        addressChangedReverify: '⚠️ Address changed — please verify again',
        distanceFromPearlPoint: (km) => `${km}km from Pearl Point`,
        allOrdersFreeShipping: '✅ All your orders are free delivery',
        partialMatchWarning: (km) => `⚠️ Google did not find an exact match. Charging based on ${km}km. WhatsApp BowlMama if unsure.`,
        fillAllFields: 'Please fill in all fields',
        confirmAddressFirst: 'Please tap "📍 Verify address" before saving',
        confirmAddressFirstBtn: 'Verify address first',
        saveProfile: 'Save',
        cancel: 'Cancel',
        saveFailed: 'Save failed. Please try again later.',
    },
};
