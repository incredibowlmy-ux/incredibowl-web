"use client";

import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signInWithFacebook, loginWithEmail, registerWithEmail, resetPassword, logout, onAuthChange, getUserProfile, updateUserProfile, upsertSavedAddress } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { User } from 'firebase/auth';
import { getUserOrders } from '@/lib/orders';
import { isValidEmail, isValidMyPhone } from '@/lib/cartUtils';
import AuthHeader from './AuthHeader';
import AuthMainView from './AuthMainView';
import AuthEmailLoginView from './AuthEmailLoginView';
import AuthEmailSignupView from './AuthEmailSignupView';
import AuthProfileView from './AuthProfileView';

type AuthView = 'main' | 'email-login' | 'email-signup' | 'profile';

export default function AuthModal({ isOpen, onClose, onProfileComplete }: {
    isOpen: boolean,
    onClose: () => void,
    /** 资料保存成功且手机+地址齐全时回调 —— 首页用它自动关弹窗并重开购物车，
        让（访客）用户存完资料直接回到结账，而不是被丢在会员资料页。 */
    onProfileComplete?: () => void,
}) {
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

    const handleGoogleLogin = async () => {
        setLoading(true); setMessage('');
        try {
            const user = await signInWithGoogle();
            setMessage('✅ 登录成功！');
            const profile = await getUserProfile(user.uid);
            if (!profile?.phone || !profile?.address) setEditingProfile(true);
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') setMessage('登录已取消');
            else if (error.code === 'auth/unauthorized-domain') setMessage('⚠️ 此域名未授权，请在 Firebase Console 添加');
            else setMessage(`⚠️ 登录失败: ${error.message}`);
        }
        setLoading(false);
    };

    const handleFacebookLogin = async () => {
        setLoading(true); setMessage('');
        try {
            const user = await signInWithFacebook();
            setMessage('✅ 登录成功！');
            const profile = await getUserProfile(user.uid);
            if (!profile?.phone || !profile?.address) setEditingProfile(true);
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') setMessage('登录已取消');
            else if (error.code === 'auth/account-exists-with-different-credential') setMessage('⚠️ 此邮箱已用其他方式注册，请用 Google 或邮箱登录');
            else if (error.code === 'auth/unauthorized-domain') setMessage('⚠️ 此域名未授权，请在 Firebase Console 添加');
            else setMessage(`⚠️ 登录失败: ${error.message}`);
        }
        setLoading(false);
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setMessage('⚠️ 请填写邮箱和密码'); return; }
        if (!isValidEmail(email)) { setMessage('⚠️ 邮箱格式不正确，例: your@email.com'); return; }
        setLoading(true); setMessage('');
        try {
            await loginWithEmail(email, password);
            setMessage('✅ 登录成功！');
            setTimeout(() => resetAndClose(), 1000);
        } catch (error: any) {
            if (error.code === 'auth/invalid-credential') setMessage('⚠️ 邮箱或密码错误');
            else if (error.code === 'auth/user-not-found') setMessage('⚠️ 帐号不存在，请先注册');
            else setMessage(`⚠️ ${error.message}`);
        }
        setLoading(false);
    };

    const handlePasswordReset = async () => {
        if (!email) { setMessage('⚠️ 请先在上方输入邮箱，再点忘记密码'); return; }
        if (!isValidEmail(email)) { setMessage('⚠️ 邮箱格式不正确，例: your@email.com'); return; }
        setLoading(true); setMessage('');
        try {
            await resetPassword(email);
        } catch (error: any) {
            // user-not-found / unregistered email: still show success so we don't
            // reveal which emails exist. Only surface real input/format errors.
            if (error.code === 'auth/invalid-email') { setMessage('⚠️ 邮箱格式不正确'); setLoading(false); return; }
            if (error.code === 'auth/too-many-requests') { setMessage('⚠️ 请求太频繁，请稍后再试'); setLoading(false); return; }
        }
        setMessage(`✅ 重置链接已发送至 ${email}，请查收邮箱（也看看垃圾邮件夹）`);
        setLoading(false);
    };

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !phone || !address) { setMessage('⚠️ 请填写所有字段'); return; }
        if (!isValidEmail(email)) { setMessage('⚠️ 邮箱格式不正确，例: your@email.com'); return; }
        if (!isValidMyPhone(phone)) { setMessage('⚠️ 手机格式不正确，例: 010-337 0197'); return; }
        if (address.trim().length < 10) { setMessage('⚠️ 请填写完整配送地址（至少 10 个字符）'); return; }
        if (password.length < 6) { setMessage('⚠️ 密码至少需要6位'); return; }
        setLoading(true); setMessage('');
        try {
            await registerWithEmail(email, password, name, phone, address);
            setMessage('✅ 注册成功！欢迎加入 Incredibowl！');
            setTimeout(() => resetAndClose(), 1500);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') setMessage('⚠️ 此邮箱已注册，请直接登录');
            else if (error.code === 'auth/weak-password') setMessage('⚠️ 密码太简单，请加强');
            else setMessage(`⚠️ ${error.message}`);
        }
        setLoading(false);
    };

    const handleUpdateProfile = async (geocode?: { lat: number; lng: number; distanceKm: number; zone: 'within2km' | 'outside2km'; formattedAddress: string }, addressLabel?: string) => {
        if (!currentUser) return;
        if (!phone || !address) { setMessage('⚠️ 手机号码和配送地址为必填'); return; }
        if (!isValidMyPhone(phone)) { setMessage('⚠️ 手机格式不正确，例: 010-337 0197'); return; }
        if (address.trim().length < 10) { setMessage('⚠️ 请填写完整配送地址（至少 10 个字符）'); return; }
        if (!geocode) { setMessage('⚠️ 请先点「确认地址」验证后再保存'); return; }
        setLoading(true); setMessage('');
        try {
            const { serverTimestamp } = await import('firebase/firestore');
            const updateData: any = {
                phone,
                address,
                addressLat: geocode.lat,
                addressLng: geocode.lng,
                addressDistanceKm: geocode.distanceKm,
                deliveryZone: geocode.zone,
                addressFormatted: geocode.formattedAddress,
                addressVerifiedAt: serverTimestamp(),
                addressVerifiedText: address.trim(),  // anti-spoof: server cross-checks this on submit-order
            };
            await updateUserProfile(currentUser.uid, updateData);

            // 已验证的地址顺手收编进地址簿（≤5 条自动收，满了不打断保存）。
            // 匿名访客不建地址簿——升级成正式账号前只维护单一当前地址。
            if (!currentUser.isAnonymous) {
                try {
                    await upsertSavedAddress(currentUser.uid, {
                        label: (addressLabel || '').trim(),
                        address: address.trim(),
                        lat: geocode.lat,
                        lng: geocode.lng,
                        distanceKm: geocode.distanceKm,
                        zone: geocode.zone,
                        formatted: geocode.formattedAddress,
                        verifiedText: address.trim(),
                        verifiedAtMs: Date.now(),
                    });
                } catch (e) {
                    console.warn('[profile] 地址簿同步失败（当前地址已保存）', e);
                }
            }

            setMessage('✅ 资料已更新！');
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
            setMessage(`⚠️ 更新失败: ${error.message}`);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        setLoading(true);
        await logout();
        setProfileData(null); setEditingProfile(false); setMessage('已登出');
        setLoading(false); setView('main');
    };

    const resetAndClose = () => {
        setEmail(''); setPassword(''); setName(''); setMessage('');
        setShowPassword(false); setEditingProfile(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative w-full max-w-lg bg-[#FDFBF7] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
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
                    />
                )}

                {view === 'main' && (
                    <AuthMainView
                        loading={loading} message={message}
                        onGoogleLogin={handleGoogleLogin}
                        onFacebookLogin={handleFacebookLogin}
                        onEmailLogin={() => { setView('email-login'); setMessage(''); }}
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
                    />
                )}

            </div>
        </div>
    );
}
