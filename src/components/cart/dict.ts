// 购物车全家（CartDrawer / CartSuccess / QRPaymentSection / CartItemCard）
// 的中英文案字典。模式照抄 src/app/member/dict.ts：Record<Locale, Shape>，
// 带参数的文案用函数。zh 值全部从原组件字面量逐字复制——中文站零变化。
// ⚠️ 只翻译「渲染」层：写进 Firestore / submit-order 的菜名、加料名、备注
// 一律保持原样，绝不经过这里。
import type { Locale } from '@/lib/locale';

interface CartDrawerDict {
    title: string;
    deliveryAddress: string;
    addressMissing: string;
    switching: string;
    staleRemoved: (n: number) => string;
    emptyTitle: string;
    emptySubtitle: string;
    goPickFood: string;
    voucherCtaTitle: string;
    voucherCtaSub: string;
    addMore: string;
    todayDelivery: string;
    tomorrowDelivery: string;
    lunchBadge: string;
    dinnerBadge: string;
    dateTbd: string;
    noteLabel: string;
    notePlaceholder: string;
    promoPlaceholder: string;
    promoPlaceholderLocked: string;
    cancel: string;
    checking: string;
    apply: string;
    promoSaved: (amt: string) => string;
    voucherRedeemTitle: string;
    voucherRedeemSub: (available: number, max: number) => string;
    voucherRedeemed: (n: number, amt: string) => string;
    voucherAddonCash: string;
    voucherPromoConflict: string;
    voucherUpsell: string;
    subtotal: string;
    discounted: string;
    voucherDeduct: (n: number) => string;
    deliveryFee: string;
    freeZone: string;
    midZone: string;
    trips: (n: number) => string;
    free: string;
    freeShort: string;
    mealWord: (time?: string) => string;
    shortfallInline: (amt: string) => string;
    stillNeed: string;
    toFree: string;
    freeOver: (amt: number) => string;
    securePayment: string;
    fpxRedirectNote: string;
    voucherCovered: string;
    voucherCoveredSub: (n: number) => string;
    guestCheckout: string;
    guestEntering: string;
    haveAccount: string;
    fillPhoneAddress: string;
    confirmAddress: string;
    submitting: string;
    choosePayment: string;
    uploadFirst: string;
    confirmOrder: string;
    razorpayDescription: string;
    // alerts / errors
    guestUnavailable: string;
    promoInvalid: string;
    promoCheckFailed: string;
    createPaymentFailed: string;
    paymentCancelled: string;
    uploadImageOnly: string;
    uploadTooLarge: (mb: string) => string;
    loginBeforeUpload: string;
    uploadFailedRetry: string;
    uploadUnauthorized: string;
    uploadCancelled: string;
    uploadSlowNetwork: string;
    uploadQuota: string;
    uploadFailedWithMsg: (msg: string) => string;
    submitOrderFailed: string;
    invalidPhone: string;
    missingDate: string;
    confirmFailed: string;
    uploadReceiptFirstAlert: string;
    placeOrderFailed: string;
    createOrderFailed: string;
    verifyFailed: string;
    payFailed: string;
    qrSubmitFailed: (msg: string) => string;
}

interface CartSuccessDict {
    waIntro: string;
    waOrderNo: (isGroup: boolean, id: string) => string;
    waItem: (name: string, qty: number, date: string, meal: string) => string;
    waTrack: (multi: boolean, date: string, meal: string, url: string) => string;
    dateTbdWa: string;
    mealWord: (time?: string) => string;
    title: string;
    orderIdLabel: (isGroup: boolean) => string;
    groupSplitNote: string;
    deliveryPlan: string;
    multiDay: string;
    lunchEmoji: string;
    dinnerEmoji: string;
    dateTbd: string;
    addressLabel: string;
    amountLabel: string;
    verifying: string;
    verifiedNote: string;
    waButton: string;
    trackBtn: (multi: boolean, date: string, meal: string) => string;
    done: string;
}

interface QRDict {
    merchantLabel: string;
    bankLabel: string;
    support: string;
    uploaded: string;
    reupload: string;
    changeImage: string;
    uploading: string;
    uploadReceipt: string;
}

interface ItemCardDict {
    addOnsCount: (n: number) => string;
    noteBadge: string;
}

export interface CartDict {
    drawer: CartDrawerDict;
    success: CartSuccessDict;
    qr: QRDict;
    itemCard: ItemCardDict;
}

export const CART_DICT: Record<Locale, CartDict> = {
    zh: {
        drawer: {
            title: '我的订单',
            deliveryAddress: '📍 送达地址',
            addressMissing: '尚未填写 (请在下方补充)',
            switching: '切换中…',
            staleRemoved: (n) => `已自动移除 ${n} 个过期项目（截单已过），请重新加入今日菜单`,
            emptyTitle: '碗妈的锅已经热好了 🍳',
            emptySubtitle: '快去选一道今天心仪的家常菜吧！',
            goPickFood: '去选餐',
            voucherCtaTitle: '先囤券更划算',
            voucherCtaSub: '20 张装省 RM 20 · 30 / 60 天有效',
            addMore: '继续添加别的菜',
            todayDelivery: '今日配送',
            tomorrowDelivery: '明日配送',
            lunchBadge: '🌞 午餐',
            dinnerBadge: '🌙 晚餐',
            dateTbd: '未定',
            noteLabel: '备注 Note (可选)',
            notePlaceholder: '例：放 Lobby、Block A、Block B、交给 Security Guard…',
            promoPlaceholder: '输入优惠码 / Promo Code',
            promoPlaceholderLocked: '使用餐券中（不可叠加）',
            cancel: '取消',
            checking: '验证中…',
            apply: '使用',
            promoSaved: (amt) => `已减免 RM ${amt}`,
            voucherRedeemTitle: '用餐券抵扣',
            voucherRedeemSub: (available, max) => `共 ${available} 张可用 · 最多抵 ${max} 份主餐`,
            voucherRedeemed: (n, amt) => `已抵 ${n} 份主餐 · 减 RM ${amt}`,
            voucherAddonCash: '（加购需现金）',
            voucherPromoConflict: '⚠️ 优惠码与餐券不可叠加；请先取消优惠码',
            voucherUpsell: '常点的话，餐券包每餐更省',
            subtotal: '小计',
            discounted: '（折后）',
            voucherDeduct: (n) => `餐券抵扣（${n} 份主餐）`,
            deliveryFee: '配送费',
            freeZone: '· 免运区',
            midZone: '· 中距离 5–7.5km',
            trips: (n) => `· ${n} 趟配送`,
            free: '免费 🛵',
            freeShort: '免费',
            mealWord: (time) => (time === 'Dinner' ? '晚餐' : '午餐'),
            shortfallInline: (amt) => ` · 差 RM ${amt} 免运`,
            stillNeed: '还差',
            toFree: ' 即可免运',
            freeOver: (amt) => `（满 RM ${amt} 免运）`,
            securePayment: '🔒 安全在线支付',
            fpxRedirectNote: '点击「确认下单」后将跳转至 Curlec 支付页面完成付款',
            voucherCovered: '餐券已抵扣全部费用',
            voucherCoveredSub: (n) => `将使用 ${n} 张餐券，无需额外付款。点「确认下单」即可。`,
            guestCheckout: '访客快速下单（免注册）',
            guestEntering: '进入访客模式…',
            haveAccount: '已有账号？登录可查订单 / 用餐券 →',
            fillPhoneAddress: '请先补充手机号和地址',
            confirmAddress: '请进入个人资料确认配送地址（验证配送范围）',
            submitting: '提交中...',
            choosePayment: '请先选择付款方式 👆',
            uploadFirst: '请先上传转账截图 👆',
            confirmOrder: '确认下单 →',
            razorpayDescription: '餐点预订',
            guestUnavailable: '访客模式暂时不可用，请用 Google 登录下单（一样很快）',
            promoInvalid: '优惠码无效',
            promoCheckFailed: '验证失败，请稍后再试',
            createPaymentFailed: '创建支付订单失败',
            paymentCancelled: '已取消支付',
            uploadImageOnly: '请上传图片文件（JPG / PNG）',
            uploadTooLarge: (mb) => `图片太大（${mb}MB），请压缩后上传，最大 5MB`,
            loginBeforeUpload: '请先登录再上传付款凭证',
            uploadFailedRetry: '上传失败，请重试',
            uploadUnauthorized: '上传被拒绝（Storage 权限规则未授权）。请联系客服并截图发 WhatsApp。',
            uploadCancelled: '上传被取消，请重试',
            uploadSlowNetwork: '网络太慢，请换 Wi-Fi 重试',
            uploadQuota: '存储空间已满，请联系客服',
            uploadFailedWithMsg: (msg) => `上传失败：${msg}`,
            submitOrderFailed: '提交订单失败',
            invalidPhone: '手机号码格式不正确，请到会员资料更新，例: 010-337 0197',
            missingDate: '部分菜品未选择配送日期，请移除后重试！',
            confirmFailed: '订单确认失败',
            uploadReceiptFirstAlert: '请先上传付款截图！',
            placeOrderFailed: '下单失败，请重试',
            createOrderFailed: '建立订单失败，请重试',
            verifyFailed: '支付验证失败，请联系客服',
            payFailed: '支付失败，请重试',
            qrSubmitFailed: (msg) => `下单失败: ${msg}`,
        },
        success: {
            waIntro: '你好碗妈 👋 我刚在网站下单了，想在 WhatsApp 接收订单确认：',
            waOrderNo: (isGroup, id) => `📌 ${isGroup ? '订单群组编号' : '订单编号'}：#${id}`,
            waItem: (name, qty, date, meal) => `🍛 ${name} ×${qty}（${date} ${meal}）`,
            waTrack: (multi, date, meal, url) => `📍 跟踪订单${multi ? `（${date} ${meal}）` : ''}：${url}`,
            dateTbdWa: '日期未定',
            mealWord: (time) => (time?.includes('Lunch') ? '午餐' : '晚餐'),
            title: '订单已提交！🍛',
            orderIdLabel: (isGroup) => (isGroup ? '订单群组编号：' : '订单编号：'),
            groupSplitNote: '你的订单已按送达日期自动拆分方便碗妈备餐',
            deliveryPlan: '📅 配送安排：',
            multiDay: '多日配送 (已各自独立建单)',
            lunchEmoji: '🌞午餐',
            dinnerEmoji: '🌙晚餐',
            dateTbd: '未定',
            addressLabel: '📍 地址：',
            amountLabel: '💰 金额：',
            verifying: '碗妈正在核对付款截图，请耐心等候 💬',
            verifiedNote: '核对成功后，碗妈会确认你的订单 ✅',
            waButton: '📲 WhatsApp 接收订单确认',
            trackBtn: (multi, date, meal) => `📍 跟踪订单${multi ? `（${date} ${meal}）` : ''}`,
            done: '完成，返回首页',
        },
        qr: {
            merchantLabel: '✅ 商户：',
            bankLabel: '✅ 合作银行：',
            support: '✅ 支持所有银行 & e-Wallet（TnG, SPay, MAE, Boost 等）',
            uploaded: '凭证已上传',
            reupload: '点击重新上传',
            changeImage: '换图',
            uploading: '上传中...',
            uploadReceipt: '上传付款截图',
        },
        itemCard: {
            addOnsCount: (n) => `加购 ${n} 项`,
            noteBadge: '📝 备注',
        },
    },
    en: {
        drawer: {
            title: 'My Order',
            deliveryAddress: '📍 Deliver to',
            addressMissing: 'Not set yet (add it below)',
            switching: 'Switching…',
            staleRemoved: (n) => `Removed ${n} expired item(s) — the order cutoff has passed. Please re-add from today's menu`,
            emptyTitle: "BowlMama's wok is already hot 🍳",
            emptySubtitle: 'Go pick a home-cooked dish you fancy today!',
            goPickFood: 'Browse menu',
            voucherCtaTitle: 'Stock up on vouchers & save',
            voucherCtaSub: '20-pack saves RM 20 · valid 30 / 60 days',
            addMore: 'Add more dishes',
            todayDelivery: 'Delivers today',
            tomorrowDelivery: 'Delivers tomorrow',
            lunchBadge: '🌞 Lunch',
            dinnerBadge: '🌙 Dinner',
            dateTbd: 'TBD',
            noteLabel: 'Note (optional)',
            notePlaceholder: 'e.g. leave at Lobby, Block A / Block B, pass to Security Guard…',
            promoPlaceholder: 'Enter promo code',
            promoPlaceholderLocked: 'Meal vouchers in use (cannot stack)',
            cancel: 'Remove',
            checking: 'Checking…',
            apply: 'Apply',
            promoSaved: (amt) => `RM ${amt} off applied`,
            voucherRedeemTitle: 'Redeem meal vouchers',
            voucherRedeemSub: (available, max) => `${available} available · covers up to ${max} main dish(es)`,
            voucherRedeemed: (n, amt) => `${n} main dish(es) covered · − RM ${amt}`,
            voucherAddonCash: ' (add-ons paid in cash)',
            voucherPromoConflict: "⚠️ Promo codes can't be combined with meal vouchers — remove the promo code first",
            voucherUpsell: 'Order often? Voucher packs save on every meal',
            subtotal: 'Subtotal',
            discounted: ' (after discount)',
            voucherDeduct: (n) => `Meal vouchers (${n} main dish(es))`,
            deliveryFee: 'Delivery',
            freeZone: '· free-delivery zone',
            midZone: '· mid-range 5–7.5km',
            trips: (n) => `· ${n} deliveries`,
            free: 'Free 🛵',
            freeShort: 'Free',
            mealWord: (time) => (time === 'Dinner' ? 'Dinner' : 'Lunch'),
            shortfallInline: (amt) => ` · RM ${amt} to free delivery`,
            stillNeed: 'Add',
            toFree: ' more for free delivery',
            freeOver: (amt) => ` (free over RM ${amt})`,
            securePayment: '🔒 Secure online payment',
            fpxRedirectNote: 'After tapping "Place order" you will be redirected to the Curlec payment page',
            voucherCovered: 'Meal vouchers cover the full amount',
            voucherCoveredSub: (n) => `${n} voucher(s) will be used — nothing more to pay. Just tap "Place order".`,
            guestCheckout: 'Quick guest checkout (no sign-up)',
            guestEntering: 'Entering guest mode…',
            haveAccount: 'Have an account? Sign in for orders / vouchers →',
            fillPhoneAddress: 'Please add your phone number and address first',
            confirmAddress: 'Please open your profile to confirm the delivery address (coverage check)',
            submitting: 'Submitting...',
            choosePayment: 'Choose a payment method first 👆',
            uploadFirst: 'Upload your payment screenshot first 👆',
            confirmOrder: 'Place order →',
            razorpayDescription: 'Meal order',
            guestUnavailable: 'Guest mode is temporarily unavailable — please sign in with Google (just as fast)',
            promoInvalid: 'Invalid promo code',
            promoCheckFailed: 'Verification failed, please try again later',
            createPaymentFailed: 'Failed to create payment order',
            paymentCancelled: 'Payment cancelled',
            uploadImageOnly: 'Please upload an image file (JPG / PNG)',
            uploadTooLarge: (mb) => `Image too large (${mb}MB) — please compress it first, max 5MB`,
            loginBeforeUpload: 'Please sign in before uploading the payment receipt',
            uploadFailedRetry: 'Upload failed, please try again',
            uploadUnauthorized: 'Upload rejected (Storage rules not authorised). Please WhatsApp us a screenshot.',
            uploadCancelled: 'Upload cancelled, please try again',
            uploadSlowNetwork: 'Network too slow — try again on Wi-Fi',
            uploadQuota: 'Storage is full, please contact support',
            uploadFailedWithMsg: (msg) => `Upload failed: ${msg}`,
            submitOrderFailed: 'Failed to submit order',
            invalidPhone: 'Invalid phone number format — please update it in your profile, e.g. 010-337 0197',
            missingDate: 'Some dishes have no delivery date selected — please remove them and try again!',
            confirmFailed: 'Order confirmation failed',
            uploadReceiptFirstAlert: 'Please upload your payment screenshot first!',
            placeOrderFailed: 'Order failed, please try again',
            createOrderFailed: 'Failed to create the order, please try again',
            verifyFailed: 'Payment verification failed, please contact support',
            payFailed: 'Payment failed, please try again',
            qrSubmitFailed: (msg) => `Order failed: ${msg}`,
        },
        success: {
            waIntro: 'Hi BowlMama 👋 I just placed an order on the website and would like my order confirmation on WhatsApp:',
            waOrderNo: (isGroup, id) => `📌 ${isGroup ? 'Order group ID' : 'Order ID'}: #${id}`,
            waItem: (name, qty, date, meal) => `🍛 ${name} ×${qty} (${date} ${meal})`,
            waTrack: (multi, date, meal, url) => `📍 Track order${multi ? ` (${date} ${meal})` : ''}: ${url}`,
            dateTbdWa: 'date TBD',
            mealWord: (time) => (time?.includes('Lunch') ? 'Lunch' : 'Dinner'),
            title: 'Order submitted! 🍛',
            orderIdLabel: (isGroup) => (isGroup ? 'Order group ID: ' : 'Order ID: '),
            groupSplitNote: 'Your order was auto-split by delivery date so BowlMama can prep each day',
            deliveryPlan: '📅 Delivery: ',
            multiDay: 'Multi-day delivery (separate orders created)',
            lunchEmoji: '🌞 Lunch',
            dinnerEmoji: '🌙 Dinner',
            dateTbd: 'TBD',
            addressLabel: '📍 Address: ',
            amountLabel: '💰 Total: ',
            verifying: 'BowlMama is checking your payment screenshot, hang tight 💬',
            verifiedNote: 'Once verified, BowlMama will confirm your order ✅',
            waButton: '📲 Get confirmation on WhatsApp',
            trackBtn: (multi, date, meal) => `📍 Track order${multi ? ` (${date} ${meal})` : ''}`,
            done: 'Done, back to home',
        },
        qr: {
            merchantLabel: '✅ Merchant: ',
            bankLabel: '✅ Bank: ',
            support: '✅ All banks & e-wallets supported (TnG, SPay, MAE, Boost, etc.)',
            uploaded: 'Receipt uploaded',
            reupload: 'Tap to re-upload',
            changeImage: 'Change',
            uploading: 'Uploading...',
            uploadReceipt: 'Upload payment screenshot',
        },
        itemCard: {
            addOnsCount: (n) => `${n} add-on(s)`,
            noteBadge: '📝 Note',
        },
    },
};
