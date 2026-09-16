"use client";

import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signInWithFacebook, loginWithEmail, registerWithEmail, resetPassword, logout, onAuthChange, getUserProfile, updateUserProfile, upsertSavedAddress, pendingLinkFromError, getSignInMethods, completePendingLink, LinkEmailMismatchError, LinkStepError, type PendingLink } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { saveDeliveryProfile } from '@/lib/deliveryProfile';
import { User } from 'firebase/auth';
import { getUserOrders } from '@/lib/orders';
import { isValidEmail, isValidMyPhone } from '@/lib/cartUtils';
import AuthHeader from './AuthHeader';
import AuthMainView from './AuthMainView';
import AuthEmailLoginView from './AuthEmailLoginView';
import AuthEmailSignupView from './AuthEmailSignupView';
import AuthProfileView from './AuthProfileView';
import AuthLinkExistingView from './AuthLinkExistingView';
import type { Locale } from '@/lib/locale';
import { AUTH_DICT } from './dict';

type AuthView = 'main' | 'email-login' | 'email-signup' | 'profile' | 'link-existing';

export default function AuthModal({ isOpen, onClose, onProfileComplete, locale = 'zh' }: {
    isOpen: boolean,
    onClose: () => void,
    /** 资料保存成功且手机+地址齐全时回调 —— 首页用它自动关弹窗并重开购物车，
        让（访客）用户存完资料直接回到结账，而不是被丢在会员资料页。 */
    onProfileComplete?: () => void,
    locale?: Locale,
}) {
    // handler 层的 setMessage 文案（zh 与旧字面量逐字一致）
    const t = AUTH_DICT[locale].modal;
    const { refreshProfile } = useAuth();
    const [view, setView] = useState<AuthView>('main');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [profileData, setProfileData] = useState<any>(null);
    const [editingProfile, setEditingProfile] = useState(false);
    const [userOrders, setUserOrders] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    // 同邮箱撞号：被拒的 provider credential 暂存在这，等客户登完原账号再绑上去
    const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
    const [linkMethods, setLinkMethods] = useState<string[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            if (user && isOpen) { setView('profile'); loadProfile(user.uid); }
        });
        return () => unsubscribe();
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && currentUser) { setView('profile'); loadProfile(currentUser.uid); }
        else if (isOpen && !currentUser) { setView('main'); }
    }, [isOpen, currentUser]);

    const loadProfile = async (uid: string) => {
        const data = await getUserProfile(uid);
        if (data) { setProfileData(data); setPhone(data.phone || ''); setAddress(data.address || ''); }
        // 资料还不完整（访客首单/新账号没手机或地址）→ 直接进入编辑模式，
        // 省掉「先点编辑资料」那一下。纯 UI 便利：地址仍必须过「确认地址」
        // 的 geocode 验证才能保存，服务端下单时照旧比对验证原文，防换址逃
        // 运费的机制不受影响。
        if (!data?.phone || !data?.address) setEditingProfile(true);
        setLoadingOrders(true);
        try { const orders = await getUserOrders(uid); setUserOrders(orders); }
        catch (e) { console.error('Failed to load orders:', e); }
        setLoadingOrders(false);
    };

    if (!isOpen) return null;

    // 社交登录撞上已有账号（同邮箱、不同 provider）→ 转到「登原账号并绑定」视图。
    // 回 false = 不是撞号错误，调用方按普通错误处理。
    const startLinkFlow = async (error: unknown): Promise<boolean> => {
        const pending = pendingLinkFromError(error);
        if (!pending) return false;
        setLinkMethods(await getSignInMethods(pending.email));
        setPendingLink(pending);
        setPassword(''); setMessage('');
        setView('link-existing');
        return true;
    };

    const handleSocialLogin = async (signIn: () => Promise<User>) => {
        setLoading(true); setMessage('');
        try {
            const user = await signIn();
            setMessage(t.loginSuccess);
            const profile = await getUserProfile(user.uid);
            if (!profile?.phone || !profile?.address) setEditingProfile(true);
        } catch (error: any) {
            if (await startLinkFlow(error)) { /* 视图已切走 */ }
            else if (error.code === 'auth/popup-closed-by-user') setMessage(t.loginCancelled);
            else if (error.code === 'auth/account-exists-with-different-credential') setMessage(t.fbAccountExists);
            else if (error.code === 'auth/unauthorized-domain') setMessage(t.unauthorizedDomain);
            else setMessage(t.loginFailed(error.message));
        }
        setLoading(false);
    };

    const handleGoogleLogin = () => handleSocialLogin(signInWithGoogle);
    const handleFacebookLogin = () => handleSocialLogin(signInWithFacebook);

    // 登原账号 → linkWithCredential。登进去的瞬间 onAuthChange 已把视图切到
    // profile，绑定结果用 message 在那里显示。绑定失败客户也已经在原账号里，
    // 没有裂号；下次再用 Facebook 登会重新进这条流程。
    const finishLink = async (signIn: () => Promise<User>) => {
        if (!pendingLink) return;
        setLoading(true); setMessage('');
        const providerName = AUTH_DICT[locale].link.providerName[pendingLink.provider];
        try {
            const user = await completePendingLink(pendingLink, signIn);
            setPendingLink(null);
            setMessage(t.linkDone(providerName));
            const profile = await getUserProfile(user.uid);
            if (!profile?.phone || !profile?.address) setEditingProfile(true);
        } catch (error: any) {
            if (error instanceof LinkEmailMismatchError) { setPendingLink(null); setMessage(t.linkEmailMismatch); }
            else if (error instanceof LinkStepError) { console.warn('[finishLink]', error.cause); setPendingLink(null); setMessage(t.linkFailed); }
            else if (error.code === 'auth/popup-closed-by-user') setMessage(t.loginCancelled);
            else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') setMessage(t.wrongCredentials);
            else if (error.code === 'auth/user-not-found') setMessage(t.userNotFound);
            else if (error.code === 'auth/unauthorized-domain') setMessage(t.unauthorizedDomain);
            else setMessage(t.loginFailed(error.message));
        }
        setLoading(false);
    };

    const handleLinkViaGoogle = () => finishLink(signInWithGoogle);
    const handleLinkViaEmail = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingLink) return;
        if (!password) { setMessage(t.fillEmailPassword); return; }
        return finishLink(() => loginWithEmail(pendingLink.email, password));
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setMessage(t.fillEmailPassword); return; }
        if (!isValidEmail(email)) { setMessage(t.invalidEmail); return; }
        setLoading(true); setMessage('');
        try {
            await loginWithEmail(email, password);
            setMessage(t.loginSuccess);
            setTimeout(() => resetAndClose(), 1000);
        } catch (error: any) {
            if (error.code === 'auth/invalid-credential') setMessage(t.wrongCredentials);
            else if (error.code === 'auth/user-not-found') setMessage(t.userNotFound);
            else setMessage(t.genericError(error.message));
        }
        setLoading(false);
    };

    const handlePasswordReset = async () => {
        if (!email) { setMessage(t.resetNeedEmail); return; }
        if (!isValidEmail(email)) { setMessage(t.invalidEmail); return; }
        setLoading(true); setMessage('');
        try {
            await resetPassword(email);
        } catch (error: any) {
            // user-not-found / unregistered email: still show success so we don't
            // reveal which emails exist. Only surface real input/format errors.
            if (error.code === 'auth/invalid-email') { setMessage(t.resetInvalidEmail); setLoading(false); return; }
            if (error.code === 'auth/too-many-requests') { setMessage(t.tooManyRequests); setLoading(false); return; }
        }
        setMessage(t.resetSent(email));
        setLoading(false);
    };

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !phone || !address) { setMessage(t.fillAllFields); return; }
        if (!isValidEmail(email)) { setMessage(t.invalidEmail); return; }
        if (!isValidMyPhone(phone)) { setMessage(t.invalidPhone); return; }
        if (address.trim().length < 10) { setMessage(t.addressTooShort); return; }
        if (password.length < 6) { setMessage(t.passwordMin); return; }
        setLoading(true); setMessage('');
        try {
            await registerWithEmail(email, password, name, phone, address);
            setMessage(t.signupSuccess);
            setTimeout(() => resetAndClose(), 1500);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') setMessage(t.emailInUse);
            else if (error.code === 'auth/weak-password') setMessage(t.weakPassword);
            else setMessage(t.genericError(error.message));
        }
        setLoading(false);
    };

    const handleUpdateProfile = async (geocode?: { lat: number; lng: number; distanceKm: number; zone: 'within2km' | 'outside2km'; formattedAddress: string }, addressLabel?: string, guestName?: string) => {
        if (!currentUser) return;
        if (!phone || !address) { setMessage(t.phoneAddressRequired); return; }
        if (!isValidMyPhone(phone)) { setMessage(t.invalidPhone); return; }
        if (address.trim().length < 10) { setMessage(t.addressTooShort); return; }
        if (!geocode) { setMessage(t.verifyFirst); return; }
        setLoading(true); setMessage('');
        try {
            // 写库逻辑抽在 lib/deliveryProfile.ts —— 购物车内嵌表单是第二个宿主，
            // 字段少一个就是防换址校验不过 / 运费按旧距离算，所以只留一份。
            await saveDeliveryProfile({
                uid: currentUser.uid,
                isAnonymous: currentUser.isAnonymous,
                phone,
                address,
                geocode,
                addressLabel,
                guestName,
            });

            setMessage(t.profileUpdated);
            setEditingProfile(false);
            await loadProfile(currentUser.uid);
            // Propagate the new address/phone to the app-wide AuthProvider so the
            // cart (and anything else reading useAuth) reflects it immediately.
            await refreshProfile();
            // 资料已齐（走到这里必然手机+地址+geocode 全过）→ 短暂展示 ✅ 后
            // 交回给页面：关掉本弹窗、重开购物车继续结账。防逃运费机制不受
            // 影响 —— 保存前的 geocode 验证和服务端下单比对一步没少。
            setTimeout(() => {
                setMessage('');
                if (onProfileComplete) onProfileComplete();
            }, 900);
        } catch (error: any) {
            setMessage(t.updateFailed(error.message));
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        setLoading(true);
        await logout();
        setProfileData(null); setEditingProfile(false); setMessage(t.loggedOut);
        setLoading(false); setView('main');
    };

    const resetAndClose = () => {
        setEmail(''); setPassword(''); setName(''); setMessage('');
        setShowPassword(false); setEditingProfile(false);
        setPendingLink(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative w-full max-w-lg bg-paper rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <AuthHeader onClose={resetAndClose} />

                {view === 'profile' && currentUser && (
                    <AuthProfileView
                        currentUser={currentUser} profileData={profileData}
                        phone={phone} setPhone={setPhone}
                        address={address} setAddress={setAddress}
                        editingProfile={editingProfile} setEditingProfile={setEditingProfile}
                        loading={loading} message={message}
                        onUpdateProfile={handleUpdateProfile}
                        onReloadProfile={async () => {
                            await loadProfile(currentUser.uid);
                            await refreshProfile();
                        }}
                        onLogout={handleLogout}
                        onClose={onClose}
                        locale={locale}
                    />
                )}

                {view === 'main' && (
                    <AuthMainView
                        loading={loading} message={message}
                        onGoogleLogin={handleGoogleLogin}
                        onFacebookLogin={handleFacebookLogin}
                        onEmailLogin={() => { setView('email-login'); setMessage(''); }}
                        locale={locale}
                    />
                )}

                {view === 'email-login' && (
                    <AuthEmailLoginView
                        email={email} setEmail={setEmail}
                        password={password} setPassword={setPassword}
                        showPassword={showPassword} setShowPassword={setShowPassword}
                        loading={loading} message={message}
                        onSubmit={handleEmailLogin}
                        onSignup={() => { setView('email-signup'); setMessage(''); }}
                        onBack={() => { setView('main'); setMessage(''); }}
                        onForgotPassword={handlePasswordReset}
                        locale={locale}
                    />
                )}

                {view === 'link-existing' && pendingLink && (
                    <AuthLinkExistingView
                        pending={pendingLink} methods={linkMethods}
                        password={password} setPassword={setPassword}
                        showPassword={showPassword} setShowPassword={setShowPassword}
                        loading={loading} message={message}
                        onGoogle={handleLinkViaGoogle}
                        onEmailSubmit={handleLinkViaEmail}
                        onBack={() => { setPendingLink(null); setView('main'); setMessage(''); }}
                        locale={locale}
                    />
                )}

                {view === 'email-signup' && (
                    <AuthEmailSignupView
                        name={name} setName={setName}
                        email={email} setEmail={setEmail}
                        password={password} setPassword={setPassword}
                        phone={phone} setPhone={setPhone}
                        address={address} setAddress={setAddress}
                        showPassword={showPassword} setShowPassword={setShowPassword}
                        loading={loading} message={message}
                        onSubmit={handleEmailSignup}
                        onLogin={() => { setView('email-login'); setMessage(''); }}
                        onBack={() => { setView('main'); setMessage(''); }}
                        locale={locale}
                    />
                )}

            </div>
        </div>
    );
}
