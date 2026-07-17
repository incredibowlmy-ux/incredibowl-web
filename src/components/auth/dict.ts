// Auth 弹窗五件套（AuthModal + Main/EmailLogin/EmailSignup/Profile 视图）的
// 中英文案字典。模式同 member/dict.ts；zh 值从原字面量逐字复制——中文站零
// 变化。message 串由 AuthModal 产出后传给子视图，所以 handler 文案集中在
// modal 组。AddressBook 已自带 DICT 不在此处。
import type { Locale } from '@/lib/locale';

interface AuthModalDict {
    loginSuccess: string;
    loginCancelled: string;
    unauthorizedDomain: string;
    loginFailed: (msg: string) => string;
    fbAccountExists: string;
    fillEmailPassword: string;
    invalidEmail: string;
    wrongCredentials: string;
    userNotFound: string;
    genericError: (msg: string) => string;
    resetNeedEmail: string;
    resetInvalidEmail: string;
    tooManyRequests: string;
    resetSent: (email: string) => string;
    fillAllFields: string;
    invalidPhone: string;
    addressTooShort: string;
    passwordMin: string;
    signupSuccess: string;
    emailInUse: string;
    weakPassword: string;
    phoneAddressRequired: string;
    verifyFirst: string;
    profileUpdated: string;
    updateFailed: (msg: string) => string;
    loggedOut: string;
}

interface AuthMainDict {
    title: string;
    subtitle: string;
    connecting: string;
    googleContinue: string;
    emailContinue: string;
}

interface AuthEmailLoginDict {
    title: string;
    emailLabel: string;
    passwordLabel: string;
    forgot: string;
    loggingIn: string;
    login: string;
    noAccount: string;
    back: string;
}

interface AuthEmailSignupDict {
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    emailLabel: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    signingUp: string;
    signup: string;
    haveAccount: string;
    back: string;
}

interface AuthProfileDict {
    memberFallback: string;
    guestBanner: string;
    guestBannerDesc: string;
    linking: string;
    linkCta: string;
    linkSuccess: string;
    linkInUse: string;
    linkFailed: string;
    orderSummary: string;
    totalOrders: string;
    totalSpent: string;
    guestNameLabel: string;
    guestNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    notFilled: string;
    addressLabel: string;
    addressPlaceholder: string;
    labelPlaceholder: string;
    addressMin: string;
    geocodeFailed: string;
    networkError: string;
    tierLine: (label: string, km: number) => string;
    freeAllOrders: string;
    partialMatchNote: (km: number) => string;
    addressChangedNote: string;
    verifyingAddress: string;
    saving: string;
    verifyAndSave: string;
    saveProfile: string;
    cancelKeep: string;
    editProfile: string;
    logout: string;
    memberCentre: string;
}

export interface AuthDict {
    modal: AuthModalDict;
    main: AuthMainDict;
    emailLogin: AuthEmailLoginDict;
    emailSignup: AuthEmailSignupDict;
    profile: AuthProfileDict;
}

export const AUTH_DICT: Record<Locale, AuthDict> = {
    zh: {
        modal: {
            loginSuccess: '✅ 登录成功！',
            loginCancelled: '登录已取消',
            unauthorizedDomain: '⚠️ 此域名未授权，请在 Firebase Console 添加',
            loginFailed: (msg) => `⚠️ 登录失败: ${msg}`,
            fbAccountExists: '⚠️ 此邮箱已用其他方式注册，请用 Google 或邮箱登录',
            fillEmailPassword: '⚠️ 请填写邮箱和密码',
            invalidEmail: '⚠️ 邮箱格式不正确，例: your@email.com',
            wrongCredentials: '⚠️ 邮箱或密码错误',
            userNotFound: '⚠️ 帐号不存在，请先注册',
            genericError: (msg) => `⚠️ ${msg}`,
            resetNeedEmail: '⚠️ 请先在上方输入邮箱，再点忘记密码',
            resetInvalidEmail: '⚠️ 邮箱格式不正确',
            tooManyRequests: '⚠️ 请求太频繁，请稍后再试',
            resetSent: (email) => `✅ 重置链接已发送至 ${email}，请查收邮箱（也看看垃圾邮件夹）`,
            fillAllFields: '⚠️ 请填写所有字段',
            invalidPhone: '⚠️ 手机格式不正确，例: 010-337 0197',
            addressTooShort: '⚠️ 请填写完整配送地址（至少 10 个字符）',
            passwordMin: '⚠️ 密码至少需要6位',
            signupSuccess: '✅ 注册成功！欢迎加入 Incredibowl！',
            emailInUse: '⚠️ 此邮箱已注册，请直接登录',
            weakPassword: '⚠️ 密码太简单，请加强',
            phoneAddressRequired: '⚠️ 手机号码和配送地址为必填',
            verifyFirst: '⚠️ 请先点「确认地址」验证后再保存',
            profileUpdated: '✅ 资料已更新！',
            updateFailed: (msg) => `⚠️ 更新失败: ${msg}`,
            loggedOut: '已登出',
        },
        main: {
            title: '注册 / 登录',
            subtitle: '加入我们，享受免配送费福利与每日精选菜单推送。',
            connecting: '连接中...',
            googleContinue: '使用 Google 继续',
            emailContinue: '使用邮箱登录',
        },
        emailLogin: {
            title: '邮箱登录',
            emailLabel: '邮箱 Email',
            passwordLabel: '密码 Password',
            forgot: '忘记密码？',
            loggingIn: '登录中...',
            login: '登录',
            noAccount: '还没有帐号？立即注册',
            back: '← 返回',
        },
        emailSignup: {
            title: '注册新帐号',
            nameLabel: '名字 Name *',
            namePlaceholder: '你的名字',
            phoneLabel: '手机号码 Phone *',
            phonePlaceholder: '例: 010-337 0197',
            addressLabel: '配送地址 Address *',
            addressPlaceholder: '例: Pearl Point, Block B-12-3',
            emailLabel: '邮箱 Email *',
            passwordLabel: '密码 Password *',
            passwordPlaceholder: '至少6位',
            signingUp: '注册中...',
            signup: '注册',
            haveAccount: '已有帐号？直接登录',
            back: '← 返回',
        },
        profile: {
            memberFallback: '会员',
            guestBanner: '👋 你正在使用访客账号',
            guestBannerDesc: '换手机或清浏览器数据后订单记录将无法找回；绑定 Google 后永久保留，还能购买餐券预付包。',
            linking: '绑定中…',
            linkCta: '🔗 绑定 Google 保存订单记录',
            linkSuccess: '✅ 已绑定 Google！订单记录已保存，下次可一键回购',
            linkInUse: '这个 Google 账号已有会员记录，想合并两边订单请 WhatsApp 碗妈处理',
            linkFailed: '绑定未完成，可稍后再试',
            orderSummary: '订单概要',
            totalOrders: '总订单',
            totalSpent: '累计消费',
            guestNameLabel: '怎么称呼（选填）',
            guestNamePlaceholder: '例: 陈小姐 / Ms. Tan',
            phoneLabel: '手机号码 *',
            phonePlaceholder: '例: 010-337 0197',
            notFilled: '未填写（必填）',
            addressLabel: '配送地址 *',
            addressPlaceholder: '例: Pearl Point, Block B-12-3, Jalan 1/116B, OKR, 58000 KL',
            labelPlaceholder: '备注（选填）如：家 / 公司',
            addressMin: '请填写完整地址（至少 10 个字符）',
            geocodeFailed: '地址验证失败',
            networkError: '网络错误，请重试',
            tierLine: (label, km) => `${label} · 距 Pearl Point ${km}km`,
            freeAllOrders: '✅ 你的订单全部免运',
            partialMatchNote: (km) => `⚠️ Google 没找到完全匹配，按 ${km}km 计算运费。如有疑问 WhatsApp 联系碗妈`,
            addressChangedNote: '⚠️ 地址已修改，保存时会自动重新验证',
            verifyingAddress: '验证地址中…',
            saving: '保存中...',
            verifyAndSave: '📍 验证地址并保存',
            saveProfile: '保存资料',
            cancelKeep: '取消，保持原资料',
            editProfile: '✏️ 编辑资料',
            logout: '登出',
            memberCentre: '查看订单 & 会员中心 →',
        },
    },
    en: {
        modal: {
            loginSuccess: '✅ Signed in!',
            loginCancelled: 'Sign-in cancelled',
            unauthorizedDomain: '⚠️ This domain is not authorised — please add it in the Firebase Console',
            loginFailed: (msg) => `⚠️ Sign-in failed: ${msg}`,
            fbAccountExists: '⚠️ This email is registered with another method — please sign in with Google or email',
            fillEmailPassword: '⚠️ Please fill in your email and password',
            invalidEmail: '⚠️ Invalid email format, e.g. your@email.com',
            wrongCredentials: '⚠️ Wrong email or password',
            userNotFound: '⚠️ Account not found — please sign up first',
            genericError: (msg) => `⚠️ ${msg}`,
            resetNeedEmail: '⚠️ Enter your email above first, then tap "Forgot password"',
            resetInvalidEmail: '⚠️ Invalid email format',
            tooManyRequests: '⚠️ Too many requests — please try again later',
            resetSent: (email) => `✅ Reset link sent to ${email} — check your inbox (and spam folder)`,
            fillAllFields: '⚠️ Please fill in all fields',
            invalidPhone: '⚠️ Invalid phone format, e.g. 010-337 0197',
            addressTooShort: '⚠️ Please enter your full delivery address (at least 10 characters)',
            passwordMin: '⚠️ Password needs at least 6 characters',
            signupSuccess: '✅ Registered! Welcome to Incredibowl!',
            emailInUse: '⚠️ This email is already registered — please sign in',
            weakPassword: '⚠️ Password too weak — please strengthen it',
            phoneAddressRequired: '⚠️ Phone number and delivery address are required',
            verifyFirst: '⚠️ Please tap "Verify address" before saving',
            profileUpdated: '✅ Profile updated!',
            updateFailed: (msg) => `⚠️ Update failed: ${msg}`,
            loggedOut: 'Signed out',
        },
        main: {
            title: 'Sign up / Sign in',
            subtitle: 'Join us for free-delivery perks and daily menu picks.',
            connecting: 'Connecting...',
            googleContinue: 'Continue with Google',
            emailContinue: 'Sign in with email',
        },
        emailLogin: {
            title: 'Email sign-in',
            emailLabel: 'Email',
            passwordLabel: 'Password',
            forgot: 'Forgot password?',
            loggingIn: 'Signing in...',
            login: 'Sign in',
            noAccount: "Don't have an account? Sign up",
            back: '← Back',
        },
        emailSignup: {
            title: 'Create account',
            nameLabel: 'Name *',
            namePlaceholder: 'Your name',
            phoneLabel: 'Phone *',
            phonePlaceholder: 'e.g. 010-337 0197',
            addressLabel: 'Delivery address *',
            addressPlaceholder: 'e.g. Pearl Point, Block B-12-3',
            emailLabel: 'Email *',
            passwordLabel: 'Password *',
            passwordPlaceholder: 'At least 6 characters',
            signingUp: 'Signing up...',
            signup: 'Sign up',
            haveAccount: 'Have an account? Sign in',
            back: '← Back',
        },
        profile: {
            memberFallback: 'Member',
            guestBanner: "👋 You're using a guest account",
            guestBannerDesc: 'Order history is lost if you switch phones or clear browser data. Link Google to keep it forever — and unlock meal voucher bundles.',
            linking: 'Linking…',
            linkCta: '🔗 Link Google to save your orders',
            linkSuccess: '✅ Google linked! Your order history is saved — one-tap reorder next time',
            linkInUse: 'This Google account already has a member record — WhatsApp BowlMama to merge the two',
            linkFailed: "Linking didn't complete — please try again later",
            orderSummary: 'Order summary',
            totalOrders: 'Total orders',
            totalSpent: 'Total spent',
            guestNameLabel: 'What should we call you (optional)',
            guestNamePlaceholder: 'e.g. Ms. Tan',
            phoneLabel: 'Phone *',
            phonePlaceholder: 'e.g. 010-337 0197',
            notFilled: 'Not filled in (required)',
            addressLabel: 'Delivery address *',
            addressPlaceholder: 'e.g. Pearl Point, Block B-12-3, Jalan 1/116B, OKR, 58000 KL',
            labelPlaceholder: 'Label (optional), e.g. Home / Office',
            addressMin: 'Please enter your full address (at least 10 characters)',
            geocodeFailed: 'Address verification failed',
            networkError: 'Network error, please try again',
            tierLine: (label, km) => `${label} · ${km}km from Pearl Point`,
            freeAllOrders: '✅ All your orders ship free',
            partialMatchNote: (km) => `⚠️ Google couldn't find an exact match — delivery fee is based on ${km}km. Questions? WhatsApp BowlMama`,
            addressChangedNote: '⚠️ Address changed — it will be re-verified when you save',
            verifyingAddress: 'Verifying address…',
            saving: 'Saving...',
            verifyAndSave: '📍 Verify address & save',
            saveProfile: 'Save profile',
            cancelKeep: 'Cancel, keep current details',
            editProfile: '✏️ Edit profile',
            logout: 'Log out',
            memberCentre: 'Orders & member centre →',
        },
    },
};
