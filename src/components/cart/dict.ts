// 购物车全家（CartDrawer / CartSuccess / QRPaymentSection / CartItemCard）
// 的中英文案字典。模式照抄 src/app/member/dict.ts：Record<Locale, Shape>，
// 带参数的文案用函数。zh 值全部从原组件字面量逐字复制——中文站零变化。
// ⚠️ 只翻译「渲染」层：写进 Firestore / submit-order 的菜名、加料名、备注
// 一律保持原样，绝不经过这里。
import type { Locale } from '@/lib/locale';
// 餐段判定只能有一份。这个文件里原来有两套写法：drawer 的 `time === 'Dinner'`
// 和 success 的 `time?.includes('Lunch')`。落库值其实是 `'Dinner (5PM-8PM)'`，
// 所以前者永远为假 → 多配送分组的运费明细每一趟都标「午餐」（2026-09-05 修）。
import { isDinnerSlot } from '@/lib/cartDateUtils';

interface CartDrawerDict {
    title: string;
    deliveryAddress: string;
    addressMissing: string;
    switching: string;
    staleRemoved: (n: number) => string;
    /** 菜已暂别 / 改排期 / 当天停售 —— 与 staleRemoved（日期过期）分开提示。 */
    unavailableRemoved: (n: number) => string;
    /** 会员页一键回购时本周不供应的菜 —— 原来是 alert，客户点掉后立刻跳页，
        根本来不及读是哪几道。现在 MemberView 写进 sessionStorage，购物车打开时
        用琥珀条显示。文案与 src/app/member/dict.ts 的 reorderSkipped 逐字一致。 */
    reorderSkipped: (names: string) => string;
    /** 购物车里的旧价已按最新菜单刷新（不是移除，只是改价，必须让客户看见）。 */
    repricedNotice: (lines: string) => string;
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
    /** 退掉已应用的优惠码（en 是 Remove）。**别拿它当表单的「取消」** —— B6 就是这么错的。 */
    cancelEdit: string;
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
    addonCreditDeduct: (names: string) => string;
    addonCreditRemaining: (n: number) => string;
    deliveryFee: string;
    freeZone: string;
    midZone: string;
    /** Far tier (7.5km+) — flat fee, Grab-fulfilled, no free-delivery threshold. */
    farZone: string;
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
    /** ── 收货信息内嵌表单（6 步 → 4 步，不再跳第二个全屏 modal）── */
    deliveryInfoTitle: string;
    deliveryInfoSub: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    addressLabelPlaceholder: string;
    useMyLocation: string;
    locating: string;
    locateUnsupported: string;
    locateDenied: string;
    locateFailed: string;
    locateFilled: string;
    verifyAndSave: string;
    verifyingAddress: string;
    savingProfile: string;
    profileSaved: string;
    addressMin: string;
    phoneInvalidInline: string;
    geocodeFailed: string;
    networkError: string;
    editDeliveryInfo: string;
    tierLine: (label: string, km: number) => string;
    /** ── 结账错误内联提示（取代 alert）── */
    checkoutErrorTitle: string;
    paymentIdLabel: string;
    copyId: string;
    copied: string;
    waAskBowlMama: string;
    confirmAddress: string;
    submitting: string;
    /** 正在开支付页（Razorpay 弹窗打开前的网络往返，以前这段按钮是可再点的）。 */
    openingPayment: string;
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
    /** 顾客自己关掉了银行支付页 —— 以前这条分支静默无反馈。 */
    paymentDismissed: string;
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
    // Meal-voucher balance recap (shown post-order for voucher customers)
    voucherBalanceLabel: string;
    voucherUnit: string;
    voucherExpiryWarn: (days: number) => string;
    voucherDepleted: string;
    voucherRenewCta: string;
    voucherRenewSub: string;
    // "View my orders" entry (feedback 2A)
    viewMyOrders: string;
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
    addOnsList: (names: string) => string;
    noteBadge: string;
    /** 可见的「修改」按钮文字（以前写死英文 Edit，两个语言都是）。 */
    edit: string;
    /** 删除按钮的可访问名（图标按钮，以前完全没有名字）。 */
    removeItem: (name: string) => string;
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
            unavailableRemoved: (n) => `已自动移除 ${n} 个当日不供应的菜品（暂别或换了供应日），请从菜单重新选`,
            reorderSkipped: (names) => `已把还在本周菜单上的菜加进购物车；以下菜品本周暂不供应，未能加入：${names}`,
            repricedNotice: (lines) => `菜单价格有更新，购物车已按最新价格同步：${lines}`,
            emptyTitle: '碗妈的锅已经热好了 🍳',
            emptySubtitle: '快去选一道今天心仪的家常菜吧！',
            goPickFood: '去选餐',
            voucherCtaTitle: '先囤券更划算',
            voucherCtaSub: '20 张装单券低至 RM 17.50 · 30 / 60 天有效',
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
            cancelEdit: '取消',
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
            addonCreditDeduct: (names) => `加料券已抵：${names}`,
            addonCreditRemaining: (n) => ` · 剩 ${n} 份`,
            deliveryFee: '配送费',
            freeZone: '· 免运区',
            midZone: '· 中距离 5–7.5km',
            farZone: '· 远距离 7.5km+ · Grab 配送 · 固定运费',
            trips: (n) => `· ${n} 趟配送`,
            free: '免费 🛵',
            freeShort: '免费',
            mealWord: (time) => (isDinnerSlot(time) ? '晚餐' : '午餐'),
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
            deliveryInfoTitle: '收货信息',
            deliveryInfoSub: '填一次，之后下单都不用再填',
            nameLabel: '怎么称呼（选填）',
            namePlaceholder: '例：陈小姐',
            phoneLabel: '手机号码 *',
            phonePlaceholder: '例: 012-345 6789',
            addressLabel: '配送地址 *',
            addressPlaceholder: '例: Pearl Suria, Block B-12-3, Jalan 1/116B, 58200 KL',
            addressLabelPlaceholder: '备注（选填）如：家 / 公司',
            useMyLocation: '📍 用我的当前位置',
            locating: '定位中…',
            locateUnsupported: '这个浏览器不支持定位，请手动输入地址',
            locateDenied: '定位被拒绝。请在浏览器允许位置权限，或手动输入地址',
            locateFailed: '定位失败，请手动输入地址',
            locateFilled: '已填入定位地址，请补上单位/门牌号再保存',
            verifyAndSave: '📍 验证地址并保存',
            verifyingAddress: '验证地址中…',
            savingProfile: '保存中…',
            profileSaved: '✅ 收货信息已保存',
            addressMin: '请填写完整地址（至少 10 个字符）',
            phoneInvalidInline: '手机号码格式不正确，例: 012-345 6789',
            geocodeFailed: '地址验证失败',
            networkError: '网络错误，请重试',
            editDeliveryInfo: '改地址 / 手机',
            tierLine: (label, km) => `${label} · 距 Pearl Point ${km}km`,
            checkoutErrorTitle: '下单没成功',
            paymentIdLabel: '支付编号',
            copyId: '复制',
            copied: '已复制',
            waAskBowlMama: '📲 把这条发给碗妈处理',
            confirmAddress: '请在下方填写送达地址（我们会先验证是否在配送范围）',
            submitting: '提交中...',
            openingPayment: '正在打开支付页…',
            choosePayment: '请先选择付款方式 👆',
            uploadFirst: '请先上传转账截图 👆',
            confirmOrder: '确认下单 →',
            razorpayDescription: '餐点预订',
            guestUnavailable: '访客模式暂时不可用，请用 Google 登录下单（一样很快）',
            promoInvalid: '优惠码无效',
            promoCheckFailed: '验证失败，请稍后再试',
            createPaymentFailed: '创建支付订单失败',
            paymentCancelled: '已取消支付',
            paymentDismissed: '付款未完成，订单还没建立。可以重新选择支付方式再试一次。',
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
            invalidPhone: '手机号码格式不正确，请在下方修改，例: 010-337 0197',
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
            mealWord: (time) => (isDinnerSlot(time) ? '晚餐' : '午餐'),
            title: '订单已提交！',
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
            voucherBalanceLabel: '我的餐券余额',
            voucherUnit: '张',
            voucherExpiryWarn: (days) => `最近一张 ${days} 天后到期，记得用哦`,
            voucherDepleted: '餐券已用完 · 续购每餐更省',
            voucherRenewCta: '续购餐券 →',
            voucherRenewSub: '囤券更划算 · 20 张装单券低至 RM 17.50',
            viewMyOrders: '📋 查看我的订单',
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
            addOnsList: (names) => `加购：${names}`,
            noteBadge: '📝 备注',
            edit: '修改',
            removeItem: (name) => `移除 ${name}`,
        },
    },
    en: {
        drawer: {
            title: 'My Order',
            deliveryAddress: '📍 Deliver to',
            addressMissing: 'Not set yet (add it below)',
            switching: 'Switching…',
            staleRemoved: (n) => `Removed ${n} expired item(s) — the order cutoff has passed. Please re-add from today's menu`,
            unavailableRemoved: (n) => `Removed ${n} item(s) not served on that date (paused or moved to another day). Please pick again from the menu`,
            reorderSkipped: (names) => `Added the dishes still on this week's menu to your cart. Not available this week (skipped): ${names}`,
            repricedNotice: (lines) => `Menu prices have changed — your cart has been updated to the current price: ${lines}`,
            emptyTitle: "BowlMama's wok is already hot 🍳",
            emptySubtitle: 'Go pick a home-cooked dish you fancy today!',
            goPickFood: 'Browse menu',
            voucherCtaTitle: 'Stock up on vouchers & save',
            voucherCtaSub: '20-pack from RM 17.50 a voucher · valid 30 / 60 days',
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
            cancelEdit: 'Cancel',
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
            addonCreditDeduct: (names) => `Add-on voucher: ${names}`,
            addonCreditRemaining: (n) => ` · ${n} left`,
            deliveryFee: 'Delivery',
            freeZone: '· free-delivery zone',
            midZone: '· mid-range 5–7.5km',
            farZone: '· long-distance 7.5km+ · via Grab · flat rate',
            trips: (n) => `· ${n} deliveries`,
            free: 'Free 🛵',
            freeShort: 'Free',
            mealWord: (time) => (isDinnerSlot(time) ? 'Dinner' : 'Lunch'),
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
            deliveryInfoTitle: 'Delivery details',
            deliveryInfoSub: 'Fill this in once — future orders skip it',
            nameLabel: 'Your name (optional)',
            namePlaceholder: 'e.g. Ms Tan',
            phoneLabel: 'Mobile number *',
            phonePlaceholder: 'e.g. 012-345 6789',
            addressLabel: 'Delivery address *',
            addressPlaceholder: 'e.g. Pearl Suria, Block B-12-3, Jalan 1/116B, 58200 KL',
            addressLabelPlaceholder: 'Label (optional), e.g. Home / Office',
            useMyLocation: '📍 Use my current location',
            locating: 'Locating…',
            locateUnsupported: 'This browser does not support location — please type your address',
            locateDenied: 'Location permission denied. Allow it in your browser, or type your address',
            locateFailed: 'Could not get your location — please type your address',
            locateFilled: 'Filled in from your location — add your unit/floor number before saving',
            verifyAndSave: '📍 Verify address & save',
            verifyingAddress: 'Verifying address…',
            savingProfile: 'Saving…',
            profileSaved: '✅ Delivery details saved',
            addressMin: 'Please enter your full address (at least 10 characters)',
            phoneInvalidInline: 'Invalid mobile number, e.g. 012-345 6789',
            geocodeFailed: 'Address verification failed',
            networkError: 'Network error, please try again',
            editDeliveryInfo: 'Edit address / phone',
            tierLine: (label, km) => `${label} · ${km}km from Pearl Point`,
            checkoutErrorTitle: "Order didn't go through",
            paymentIdLabel: 'Payment ID',
            copyId: 'Copy',
            copied: 'Copied',
            waAskBowlMama: '📲 Send this to BowlMama',
            confirmAddress: "Fill in your delivery address below (we'll check it's within range)",
            submitting: 'Submitting...',
            openingPayment: 'Opening payment page…',
            choosePayment: 'Choose a payment method first 👆',
            uploadFirst: 'Upload your payment screenshot first 👆',
            confirmOrder: 'Place order →',
            razorpayDescription: 'Meal order',
            guestUnavailable: 'Guest mode is temporarily unavailable — please sign in with Google (just as fast)',
            promoInvalid: 'Invalid promo code',
            promoCheckFailed: 'Verification failed, please try again later',
            createPaymentFailed: 'Failed to create payment order',
            paymentCancelled: 'Payment cancelled',
            paymentDismissed: "Payment wasn't completed and no order was created. Pick a payment method and try again.",
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
            invalidPhone: 'Invalid phone number format — please fix it below, e.g. 010-337 0197',
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
            mealWord: (time) => (isDinnerSlot(time) ? 'Dinner' : 'Lunch'),
            title: 'Order submitted!',
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
            voucherBalanceLabel: 'My voucher balance',
            voucherUnit: 'left',
            voucherExpiryWarn: (days) => `Next one expires in ${days} day(s) — don't forget to use it`,
            voucherDepleted: 'Vouchers used up · top up to save on every meal',
            voucherRenewCta: 'Top up vouchers →',
            voucherRenewSub: 'Stock up & save · 20-pack from RM 17.50 a voucher',
            viewMyOrders: '📋 View my orders',
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
            addOnsList: (names) => `Add-ons: ${names}`,
            noteBadge: '📝 Note',
            edit: 'Edit',
            removeItem: (name) => `Remove ${name}`,
        },
    },
};
