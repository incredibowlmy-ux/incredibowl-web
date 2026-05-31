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

    // Shared copy button label (used by referral-code share section)
    copied: string;

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

    // Promo vouchers
    myVouchers: string;
    voucherCountSuffix: (n: number) => string;
    noPromoVouchers: string;
    noPromoVouchersLine1: string;
    noPromoVouchersLine2: string;
    voucherLabelReferral: string;
    voucherLabelPoints: string;
    voucherLabelPointsMigration: string;
    voucherLabelReferrerBonus: string;
    voucherLabelGeneric: string;
    voucherDiscountLabel: string;
    voucherDaysLeft: (n: number) => string;
    voucherPermanent: string;
    voucherExpiringSoon: string;
    voucherCopy: string;
    voucherCopied: string;
    pasteVoucherHint: string;

    // Referral section
    referFriends: string;
    referBlurbBeforeBonus: string;
    referBonusVoucher: string;
    referBlurbMid: string;
    referBonusPoints: string;
    referBlurbAfterBonus: string;
    referralCodeLabel: string;
    copyCodeBtn: string;
    copyCopyText: string;
    statFriendsRegistered: string;
    statFirstOrders: string;
    pendingFriendsReminder: (n: number) => string;
    referEmptyHint: string;
    referralShareText: (code: string) => string;

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
    referralRewardSuccess: (code: string) => string;
    referralRewardRejected: (reason: string) => string;
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

        copied: '已复制',

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
        mealVoucherTagline: '一次买下，30 / 60 天内任吃 · 不限菜品 · 最多省 RM 37',
        buyMealVoucher: '购买餐券包',
        availableMealVouchers: '可用餐券',
        voucherEqualsMeal: '张 · 1 张 = 1 份主餐',
        soonestExpiry: '最近到期',
        daysUnit: '天',
        expiringSoon: '即将过期',
        redeemAtCheckoutHint: '结账时勾选「用餐券抵扣」即可使用',
        buyMore: '再买一份',

        myVouchers: '我的优惠券',
        voucherCountSuffix: (n) => `${n} 张可用`,
        noPromoVouchers: '暂无可用优惠券',
        noPromoVouchersLine1: '· 满 100 积分可兑换 RM 10 优惠券',
        noPromoVouchersLine2: '· 推荐朋友注册即可获 RM 10 首单券',
        voucherLabelReferral: '推荐奖励 · 首单可用',
        voucherLabelPoints: '积分兑换',
        voucherLabelPointsMigration: '积分转换 · 永久有效',
        voucherLabelReferrerBonus: '推荐人奖励 · 永久有效',
        voucherLabelGeneric: '优惠券',
        voucherDiscountLabel: '折扣',
        voucherDaysLeft: (n) => `剩 ${n} 天到期`,
        voucherPermanent: '永久有效 · 无低消',
        voucherExpiringSoon: '· 即将过期',
        voucherCopy: '复制',
        voucherCopied: '已复制',
        pasteVoucherHint: '结账时输入优惠码即可使用',

        referFriends: '推荐好友',
        referBlurbBeforeBonus: '朋友用你的推荐码注册即获 ',
        referBonusVoucher: 'RM 10 优惠券',
        referBlurbMid: '（首单可用）；朋友完成首单后你再得 ',
        referBonusPoints: '永久 RM 5 voucher',
        referBlurbAfterBonus: '。',
        referralCodeLabel: '推荐码',
        copyCodeBtn: '复制码',
        copyCopyText: '复制文案',
        statFriendsRegistered: '朋友注册',
        statFirstOrders: '已下首单',
        pendingFriendsReminder: (n) => `💡 还有 ${n} 位朋友未下单 — 提醒一下？`,
        referEmptyHint: '把推荐码发给朋友，他们注册时填上即可使用。',
        referralShareText: (code) =>
            `🍛 我在 Incredibowl 订了好吃的家味便当！用我的推荐码 ${code} 注册，新用户即获 RM 10 优惠券（首单可用）！\n👉 https://incredibowl.my`,

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
        referralRewardSuccess: (code) =>
            `🎁 推荐奖励到账！\n\nRM 10 首单优惠券：${code}\n30 天内首单可用，已加入「我的优惠券」`,
        referralRewardRejected: (reason) =>
            `⚠️ 推荐奖励未发放\n\n原因：${reason}\n\n如有疑问请 WhatsApp 010-337 0197 联系碗妈`,
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

        copied: 'Copied',

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
        mealVoucherTagline: 'Buy once, eat within 30 / 60 days · Any dish · Save up to RM 37',
        buyMealVoucher: 'Buy a voucher bundle',
        availableMealVouchers: 'Available vouchers',
        voucherEqualsMeal: 'vouchers · 1 = 1 main dish',
        soonestExpiry: 'Earliest expiry',
        daysUnit: 'days',
        expiringSoon: 'Expiring soon',
        redeemAtCheckoutHint: 'Tick "use meal voucher" at checkout',
        buyMore: 'Buy more',

        myVouchers: 'My vouchers',
        voucherCountSuffix: (n) => `${n} available`,
        noPromoVouchers: 'No promo vouchers',
        noPromoVouchersLine1: '· Redeem RM 10 voucher with 100 points',
        noPromoVouchersLine2: '· Refer a friend to earn a RM 10 first-order voucher',
        voucherLabelReferral: 'Referral bonus · First order',
        voucherLabelPoints: 'Points redemption',
        voucherLabelPointsMigration: 'Points migration · Never expires',
        voucherLabelReferrerBonus: 'Referrer reward · Never expires',
        voucherLabelGeneric: 'Voucher',
        voucherDiscountLabel: 'Off',
        voucherDaysLeft: (n) => `${n} days left`,
        voucherPermanent: 'Never expires · No min spend',
        voucherExpiringSoon: '· expiring soon',
        voucherCopy: 'Copy',
        voucherCopied: 'Copied',
        pasteVoucherHint: 'Enter the code at checkout',

        referFriends: 'Refer friends',
        referBlurbBeforeBonus: 'Friends who register with your code get a ',
        referBonusVoucher: 'RM 10 voucher',
        referBlurbMid: ' (first order). After their first order, you earn ',
        referBonusPoints: 'a permanent RM 5 voucher',
        referBlurbAfterBonus: '.',
        referralCodeLabel: 'Referral code',
        copyCodeBtn: 'Copy code',
        copyCopyText: 'Copy share text',
        statFriendsRegistered: 'Registered',
        statFirstOrders: 'First orders',
        pendingFriendsReminder: (n) => `💡 ${n} friend${n === 1 ? '' : 's'} haven't ordered yet — nudge them?`,
        referEmptyHint: 'Share your code with friends — they enter it when signing up.',
        referralShareText: (code) =>
            `🍛 I've been ordering home-cooked meals from Incredibowl! Use my referral code ${code} when you sign up — new users get a RM 10 first-order voucher!\n👉 https://incredibowl.my`,

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
        referralRewardSuccess: (code) =>
            `🎁 Referral reward unlocked!\n\nRM 10 first-order voucher: ${code}\nValid for 30 days on your first order — added to "My vouchers"`,
        referralRewardRejected: (reason) =>
            `⚠️ Referral reward not granted\n\nReason: ${reason}\n\nQuestions? WhatsApp 010-337 0197`,
    },
};
