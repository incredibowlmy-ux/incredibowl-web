/**
 * Meal-voucher-page i18n dictionary.
 *
 * Same pattern as src/app/member/dict.ts: one component (MealVouchersView)
 * accepts a `locale: 'zh' | 'en'` prop and looks up MEAL_VOUCHERS_DICT[locale].
 * Two thin page.tsx wrappers (/meal-vouchers and /en/meal-vouchers) render
 * it with the right locale.
 *
 * Bundle data (counts, RM amounts, validity days) lives in
 * `src/data/mealVoucherConfig.ts` — only the human-readable labels/highlights
 * are localised here. .tsx extension because rule strings contain inline JSX.
 */

import type { ReactNode } from 'react';
import type { Locale } from '../member/dict';

interface MealVouchersDictShape {
    // Auth gate
    pageTitle: string;
    loginRequired: string;
    loginReturnHome: string;

    // Header
    backHome: string;
    subtitle: string;
    badgeAnyDishLabel: string;
    badgeAnyDishValue: string;
    badgeValidityLabel: string;
    badgeValidityValue: string;
    badgeSavingsLabel: string;
    badgeSavingsValue: string;

    // Bundle cards
    bundleLabel: (n: number) => string;
    bundleHighlightPopular: string;
    bundleHighlightBestValue: string;
    perVoucher: (rm: string) => string;
    savings: (rm: string, percent: number) => string;
    validityDays: (n: number) => string;

    // Promo section
    promoTitle: string;
    promoPlaceholder: string;
    promoSwitchedBundle: string;
    promoEnterCode: string;
    promoLoginFirst: string;
    promoInvalid: string;
    promoTooLargeForBundle: string;
    promoVerifyFailed: string;
    promoVerifying: string;
    promoApply: string;
    promoCancel: string;
    promoApplied: (rm: string) => string;
    summaryPrice: string;
    summaryDiscount: string;
    summaryTotal: string;

    // Rules
    rulesTitle: string;
    rule1: ReactNode;
    rule2: ReactNode;
    rule3: ReactNode;
    rule4: string;

    // Payment
    chooseMethod: string;
    methodQR: string;
    methodFPX: string;
    qrMerchantLabel: string;
    qrAmountLabel: string;
    qrAmountDiscountSuffix: (rm: string) => string;
    qrReviewNotice: string;
    receiptUploaded: string;
    receiptReplace: string;
    receiptUpload: string;
    receiptUploading: string;
    fpxSecureTitle: string;
    fpxBlurb: (n: number) => string;
    uploadInvalidType: string;
    uploadTooLarge: (mb: string) => string;
    uploadRequiresLogin: string;
    uploadGenericError: string;
    uploadUnauthorized: string;
    uploadCanceled: string;
    uploadRetryLimit: string;
    uploadQuotaExceeded: string;
    uploadErrorWithMessage: (msg: string) => string;
    submitButtonProcessing: string;
    submitButton: (rm: string) => string;
    errorSelectMethod: string;
    errorUploadReceipt: string;
    errorCreateFailed: string;
    errorPaymentCancelled: string;
    errorBuyFailed: string;
    errorConfirmFailed: string;
    loginToBuyVouchers: string;
    razorpayName: string;
    razorpayDescription: (n: number, days: number) => string;

    // Success
    pendingReviewTitle: string;
    pendingReviewBody1: string;
    pendingReviewBody2: (n: number, days: number) => ReactNode;
    successTitle: string;
    successBody: (n: number, days: number) => ReactNode;
    orderIdLabel: string;
    voucherCountLabel: string;
    validityLabel: string;
    viewWallet: string;
    goOrder: string;
}

export const MEAL_VOUCHERS_DICT: Record<Locale, MealVouchersDictShape> = {
    zh: {
        pageTitle: '餐券预付包',
        loginRequired: '请先在首页登录后再购买餐券',
        loginReturnHome: '返回首页登录',

        backHome: '返回首页',
        subtitle: 'Meal Voucher Bundles · 一次买，慢慢吃',
        badgeAnyDishLabel: '放心买',
        badgeAnyDishValue: '不限菜品',
        badgeValidityLabel: '有效期',
        badgeValidityValue: '30 / 60 天',
        badgeSavingsLabel: '最高省',
        badgeSavingsValue: 'RM 20',

        bundleLabel: (n) => `${n} 张餐券`,
        bundleHighlightPopular: '人气之选',
        bundleHighlightBestValue: '最划算',
        perVoucher: (rm) => `单券 RM ${rm}`,
        savings: (rm, percent) => `省 RM ${rm}（${percent}%）`,
        validityDays: (n) => `有效期 ${n} 天`,

        promoTitle: '优惠码 / Promo Code',
        promoPlaceholder: '输入优惠码 / Promo Code',
        promoSwitchedBundle: '已切换组合，请重新使用优惠码',
        promoEnterCode: '请输入优惠码',
        promoLoginFirst: '请先登录',
        promoInvalid: '优惠码无效',
        promoTooLargeForBundle: '此优惠码金额≥组合价，请选更大的组合或换码',
        promoVerifyFailed: '验证失败，请稍后再试',
        promoVerifying: '验证中…',
        promoApply: '使用',
        promoCancel: '取消',
        promoApplied: (rm) => `已减免 RM ${rm}`,
        summaryPrice: '组合价',
        summaryDiscount: '优惠减免',
        summaryTotal: '实付',

        rulesTitle: '使用规则',
        rule1: <><strong className="text-[#1A2D23]">1 张餐券 = 1 份主餐</strong>（RM 16.90–19.90 全额抵；超过 RM 19.90 的主餐用券后补差价，券抵 RM 19.90；多张券同用优先抵最贵的，最划算）</>,
        rule2: <><strong className="text-[#1A2D23]">加购项（饮料、加料、蛋等）</strong>不在抵扣范围内，需现金支付</>,
        rule3: <>有效期按组合：<strong className="text-[#1A2D23]">5 / 10 张装 30 天，20 张装 60 天</strong>，过期归零；不可叠加 RM 折扣券（推荐券 / 积分券）</>,
        rule4: '预付现金购买，不支持现金退款',

        chooseMethod: '选择付款方式',
        methodQR: 'DuitNow / QR',
        methodFPX: 'FPX / Card',
        qrMerchantLabel: '✅ 商户：',
        qrAmountLabel: '✅ 转账金额：',
        qrAmountDiscountSuffix: (rm) => ` （已折 RM ${rm}）`,
        qrReviewNotice: '✅ 我们将在 24 小时内核对并发餐券到你的钱包',
        receiptUploaded: '凭证已上传',
        receiptReplace: '换图',
        receiptUpload: '上传付款截图',
        receiptUploading: '上传中...',
        fpxSecureTitle: '🔒 安全在线支付',
        fpxBlurb: (n) => `点击「立即购买」后将跳转至 Curlec 支付页面，付款成功后 ${n} 张餐券即刻到账`,
        uploadInvalidType: '请上传图片文件（JPG / PNG）',
        uploadTooLarge: (mb) => `图片太大（${mb}MB），请压缩后上传，最大 5MB`,
        uploadRequiresLogin: '请先登录再上传付款凭证',
        uploadGenericError: '上传失败，请重试',
        uploadUnauthorized: '上传被拒绝（Storage 权限规则未授权）。请刷新页面重试，仍失败请 WhatsApp 010-337 0197',
        uploadCanceled: '上传被取消，请重试',
        uploadRetryLimit: '网络太慢，请换 Wi-Fi 重试',
        uploadQuotaExceeded: '存储空间已满，请联系客服',
        uploadErrorWithMessage: (msg) => `上传失败：${msg}`,
        submitButtonProcessing: '处理中...',
        submitButton: (rm) => `立即购买 · RM ${rm}`,
        errorSelectMethod: '请选择付款方式',
        errorUploadReceipt: '请先上传付款截图',
        errorCreateFailed: '创建订单失败',
        errorPaymentCancelled: '已取消支付',
        errorBuyFailed: '购买失败，请重试',
        errorConfirmFailed: '确认失败',
        loginToBuyVouchers: '请先登录',
        razorpayName: 'Incredibowl 餐券包',
        razorpayDescription: (n, days) => `${n} 张餐券（${days} 天有效）`,

        pendingReviewTitle: '付款已收到，等待核对',
        pendingReviewBody1: '我们会在 24 小时内核对你的付款凭证。',
        pendingReviewBody2: (n, days) => <>核对通过后，<span className="text-[#FF6B35] font-bold">{n} 张餐券</span>即刻到账，{days} 天有效。</>,
        successTitle: '购买成功 🎉',
        successBody: (n, days) => <><span className="text-[#FF6B35] font-bold text-xl">{n} 张餐券</span>已到账，可在结账时一键抵扣主餐。<br />有效期：{days} 天</>,
        orderIdLabel: '📌 订单号：',
        voucherCountLabel: '🎟️ 张数：',
        validityLabel: '⏰ 有效期：',
        viewWallet: '查看钱包',
        goOrder: '去点餐',
    },
    en: {
        pageTitle: 'Meal Voucher Bundles',
        loginRequired: 'Please sign in from the homepage first to buy vouchers.',
        loginReturnHome: 'Back to homepage',

        backHome: 'Back to home',
        subtitle: 'Buy once, eat anytime',
        badgeAnyDishLabel: 'Worry-free',
        badgeAnyDishValue: 'Any dish',
        badgeValidityLabel: 'Validity',
        badgeValidityValue: '30 / 60 days',
        badgeSavingsLabel: 'Save up to',
        badgeSavingsValue: 'RM 20',

        bundleLabel: (n) => `${n} vouchers`,
        bundleHighlightPopular: 'Most popular',
        bundleHighlightBestValue: 'Best value',
        perVoucher: (rm) => `RM ${rm} per voucher`,
        savings: (rm, percent) => `Save RM ${rm} (${percent}%)`,
        validityDays: (n) => `Valid for ${n} days`,

        promoTitle: 'Promo Code',
        promoPlaceholder: 'Enter promo code',
        promoSwitchedBundle: 'Bundle changed — please re-apply the code',
        promoEnterCode: 'Please enter a promo code',
        promoLoginFirst: 'Please sign in first',
        promoInvalid: 'Invalid promo code',
        promoTooLargeForBundle: 'Discount ≥ bundle price. Pick a larger bundle or another code.',
        promoVerifyFailed: 'Verification failed. Try again later.',
        promoVerifying: 'Verifying...',
        promoApply: 'Apply',
        promoCancel: 'Cancel',
        promoApplied: (rm) => `RM ${rm} off applied`,
        summaryPrice: 'Bundle price',
        summaryDiscount: 'Discount',
        summaryTotal: 'You pay',

        rulesTitle: 'How it works',
        rule1: <><strong className="text-[#1A2D23]">1 voucher = 1 main dish</strong> (RM 16.90–19.90 fully covered; premium mains above RM 19.90 use one voucher plus a small top-up for the difference; multiple vouchers cover the priciest mains first)</>,
        rule2: <><strong className="text-[#1A2D23]">Add-ons (drinks, extra sides, eggs, etc.)</strong> are not covered and require cash payment</>,
        rule3: <>Validity depends on bundle: <strong className="text-[#1A2D23]">5 / 10 packs are valid 30 days, 20-pack is valid 60 days</strong>. Expired vouchers are forfeited. Cannot stack with RM promo codes (referral / points)</>,
        rule4: 'Prepaid in cash, no cash refunds',

        chooseMethod: 'Choose payment method',
        methodQR: 'DuitNow / QR',
        methodFPX: 'FPX / Card',
        qrMerchantLabel: '✅ Merchant: ',
        qrAmountLabel: '✅ Transfer amount: ',
        qrAmountDiscountSuffix: (rm) => ` (RM ${rm} discount applied)`,
        qrReviewNotice: '✅ We will verify and credit your vouchers within 24 hours',
        receiptUploaded: 'Receipt uploaded',
        receiptReplace: 'Replace',
        receiptUpload: 'Upload payment screenshot',
        receiptUploading: 'Uploading...',
        fpxSecureTitle: '🔒 Secure online payment',
        fpxBlurb: (n) => `Tap "Buy now" to open Curlec's secure payment page. Your ${n} vouchers will be credited immediately after payment.`,
        uploadInvalidType: 'Please upload an image file (JPG / PNG)',
        uploadTooLarge: (mb) => `Image too large (${mb}MB). Max 5MB — please compress and re-upload.`,
        uploadRequiresLogin: 'Please sign in before uploading the receipt',
        uploadGenericError: 'Upload failed, please retry',
        uploadUnauthorized: 'Upload rejected (storage rules). Refresh and retry — if it persists, WhatsApp 010-337 0197.',
        uploadCanceled: 'Upload canceled, please retry',
        uploadRetryLimit: 'Network too slow — switch to Wi-Fi and retry',
        uploadQuotaExceeded: 'Storage full, please contact support',
        uploadErrorWithMessage: (msg) => `Upload failed: ${msg}`,
        submitButtonProcessing: 'Processing...',
        submitButton: (rm) => `Buy now · RM ${rm}`,
        errorSelectMethod: 'Please choose a payment method',
        errorUploadReceipt: 'Please upload the payment screenshot first',
        errorCreateFailed: 'Failed to create order',
        errorPaymentCancelled: 'Payment cancelled',
        errorBuyFailed: 'Purchase failed, please retry',
        errorConfirmFailed: 'Confirmation failed',
        loginToBuyVouchers: 'Please sign in first',
        razorpayName: 'Incredibowl Meal Vouchers',
        razorpayDescription: (n, days) => `${n} vouchers (valid ${days} days)`,

        pendingReviewTitle: 'Payment received — pending review',
        pendingReviewBody1: 'We will verify your receipt within 24 hours.',
        pendingReviewBody2: (n, days) => <>Once verified, <span className="text-[#FF6B35] font-bold">{n} vouchers</span> will be credited and valid for {days} days.</>,
        successTitle: 'Purchase successful 🎉',
        successBody: (n, days) => <><span className="text-[#FF6B35] font-bold text-xl">{n} vouchers</span> credited to your wallet. Redeem at checkout with one tap.<br />Validity: {days} days</>,
        orderIdLabel: '📌 Order ID: ',
        voucherCountLabel: '🎟️ Vouchers: ',
        validityLabel: '⏰ Validity: ',
        viewWallet: 'View wallet',
        goOrder: 'Order now',
    },
};
