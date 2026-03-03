"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { signInWithGoogle, signInWithFacebook, loginWithEmail, registerWithEmail, logout, onAuthChange, getUserProfile, updateUserProfile } from '@/lib/auth';
import { User } from 'firebase/auth';
import { getUserOrders } from '@/lib/orders';
import { isValidEmail, isValidMyPhone } from '@/lib/cartUtils';
import AuthHeader from './AuthHeader';
import AuthMainView from './AuthMainView';
import AuthEmailLoginView from './AuthEmailLoginView';
import AuthEmailSignupView from './AuthEmailSignupView';
import AuthProfileView from './AuthProfileView';

type AuthView = 'main' | 'email-login' | 'email-signup' | 'profile';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
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
    const [referralInput, setReferralInput] = useState('');

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

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !phone || !address) { setMessage('⚠️ 请填写所有字段'); return; }
        if (!isValidEmail(email)) { setMessage('⚠️ 邮箱格式不正确，例: your@email.com'); return; }
        if (!isValidMyPhone(phone)) { setMessage('⚠️ 手机格式不正确，例: 010-337 0197'); return; }
        if (address.trim().length < 10) { setMessage('⚠️ 请填写完整配送地址（至少 10 个字符）'); return; }
        if (password.length < 6) { setMessage('⚠️ 密码至少需要6位'); return; }
        setLoading(true); setMessage('');
        try {
            await registerWithEmail(email, password, name, phone, address, referralInput.trim().toUpperCase() || undefined);
            setMessage('✅ 注册成功！欢迎加入 Incredibowl！');
            setTimeout(() => resetAndClose(), 1500);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') setMessage('⚠️ 此邮箱已注册，请直接登录');
            else if (error.code === 'auth/weak-password') setMessage('⚠️ 密码太简单，请加强');
            else setMessage(`⚠️ ${error.message}`);
        }
        setLoading(false);
    };

    const handleUpdateProfile = async () => {
        if (!currentUser) return;
        if (!phone || !address) { setMessage('⚠️ 手机号码和配送地址为必填'); return; }
        if (!isValidMyPhone(phone)) { setMessage('⚠️ 手机格式不正确，例: 010-337 0197'); return; }
        if (address.trim().length < 10) { setMessage('⚠️ 请填写完整配送地址（至少 10 个字符）'); return; }
        setLoading(true); setMessage('');
        try {
            const updateData: any = { phone, address };
            if (referralInput.trim() && !profileData?.referredBy) updateData.referredBy = referralInput.trim().toUpperCase();
            await updateUserProfile(currentUser.uid, updateData);
            setMessage('✅ 资料已更新！');
            setEditingProfile(false);
            await loadProfile(currentUser.uid);
            setTimeout(() => setMessage(''), 2000);
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
                        referralInput={referralInput} setReferralInput={setReferralInput}
                        loading={loading} message={message}
                        onUpdateProfile={handleUpdateProfile}
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
                        referralInput={referralInput} setReferralInput={setReferralInput}
                        loading={loading} message={message}
                        onSubmit={handleEmailSignup}
                        onLogin={() => { setView('email-login'); setMessage(''); }}
                        onBack={() => { setView('main'); setMessage(''); }}
                    />
                )}

                <div className="p-3 bg-[#E3EADA]/30 text-center border-t border-[#E3EADA]">
                    <p className="text-[10px] font-bold text-[#1A2D23]/50 flex items-center justify-center gap-1 uppercase tracking-wider">
                        <Sparkles size={12} /> RM 1 = 1 积分 · 推荐好友获 50 积分 · 100 积分兑 RM10
                    </p>
                </div>
            </div>
        </div>
    );
}
