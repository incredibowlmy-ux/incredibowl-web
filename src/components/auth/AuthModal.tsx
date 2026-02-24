"use client";

import React, { useState } from 'react';
import { X, Mail, Sparkles, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

type AuthView = 'main' | 'email-login' | 'email-signup';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [view, setView] = useState<AuthView>('main');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleOAuth = (provider: string) => {
        setLoading(true);
        setMessage('');
        // Simulate OAuth redirect
        setTimeout(() => {
            setMessage(`正在跳转到 ${provider} 登录...`);
            setLoading(false);
            // In production, redirect to OAuth provider
            // window.location.href = `/api/auth/${provider}`;
        }, 800);
    };

    const handleEmailLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage('⚠️ 请填写邮箱和密码');
            return;
        }
        setLoading(true);
        setMessage('');
        setTimeout(() => {
            // Simulate login
            localStorage.setItem('incredibowl_user', JSON.stringify({ email, name: email.split('@')[0] }));
            setMessage('✅ 登录成功！');
            setLoading(false);
            setTimeout(() => {
                resetAndClose();
            }, 1000);
        }, 1000);
    };

    const handleEmailSignup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) {
            setMessage('⚠️ 请填写所有字段');
            return;
        }
        if (password.length < 6) {
            setMessage('⚠️ 密码至少需要6位');
            return;
        }
        setLoading(true);
        setMessage('');
        setTimeout(() => {
            localStorage.setItem('incredibowl_user', JSON.stringify({ email, name }));
            setMessage('✅ 注册成功！欢迎加入 Incredibowl！');
            setLoading(false);
            setTimeout(() => {
                resetAndClose();
            }, 1000);
        }, 1000);
    };

    const resetAndClose = () => {
        setView('main');
        setEmail('');
        setPassword('');
        setName('');
        setMessage('');
        setShowPassword(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative w-full max-w-sm bg-[#FDFBF7] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 text-center bg-white border-b border-[#E3EADA] relative">
                    <button onClick={resetAndClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#1A2D23] transition-colors">
                        <X size={20} />
                    </button>
                    <div className="w-16 h-16 mx-auto mb-4 bg-white border-2 border-[#E3EADA] rounded-full flex items-center justify-center overflow-hidden shadow-md">
                        <Image src="/logo.png" alt="Logo" width={64} height={64} className="scale-110" />
                    </div>
                    <h2 className="text-2xl font-black text-[#1A2D23]">Incredibowl</h2>
                    <p className="text-[10px] font-bold text-[#FF6B35] uppercase tracking-widest mt-1">
                        Cook with Mum&#39;s Sincere Heart
                    </p>
                </div>

                {/* Main View - Social Login Options */}
                {view === 'main' && (
                    <div className="p-8 space-y-5">
                        <div className="text-center space-y-2">
                            <h3 className="font-bold text-[#1A2D23] text-lg">注册 / 登录</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                加入我们，享受免配送费福利与每日精选菜单推送。
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Google */}
                            <button
                                onClick={() => handleOAuth('Google')}
                                disabled={loading}
                                className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 font-bold text-[#1A2D23] hover:border-[#4285F4] hover:shadow-md transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                使用 Google 继续
                            </button>

                            {/* Apple */}
                            <button
                                onClick={() => handleOAuth('Apple')}
                                disabled={loading}
                                className="w-full py-3.5 bg-black text-white rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                                使用 Apple ID 继续
                            </button>

                            {/* Facebook */}
                            <button
                                onClick={() => handleOAuth('Facebook')}
                                disabled={loading}
                                className="w-full py-3.5 bg-[#1877F2] text-white rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-[#166FE5] transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                使用 Facebook 继续
                            </button>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E3EADA]"></div></div>
                                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-[#FDFBF7] px-4 text-gray-400">Or</span></div>
                            </div>

                            {/* Email */}
                            <button
                                onClick={() => { setView('email-login'); setMessage(''); }}
                                className="w-full py-3.5 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-[#2A3D33] transition-all shadow-lg shadow-[#1A2D23]/20"
                            >
                                <Mail size={18} />
                                使用邮箱登录
                            </button>
                        </div>

                        {message && (
                            <p className="text-center text-sm font-bold text-[#FF6B35] animate-pulse">{message}</p>
                        )}
                    </div>
                )}

                {/* Email Login View */}
                {view === 'email-login' && (
                    <div className="p-8 space-y-5">
                        <div className="text-center">
                            <h3 className="font-bold text-[#1A2D23] text-lg">邮箱登录</h3>
                        </div>
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">邮箱 Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full mt-1 px-4 py-3.5 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">密码 Password</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••"
                                        className="w-full px-4 py-3.5 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors pr-12"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2D23]">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20"
                            >
                                {loading ? '登录中...' : '登录'}
                            </button>
                        </form>
                        <div className="text-center space-y-2">
                            <button onClick={() => { setView('email-signup'); setMessage(''); }} className="text-xs font-bold text-[#FF6B35] hover:underline">
                                还没有帐号？立即注册
                            </button>
                            <br />
                            <button onClick={() => { setView('main'); setMessage(''); }} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">
                                ← 返回其他登录方式
                            </button>
                        </div>
                        {message && (
                            <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>
                        )}
                    </div>
                )}

                {/* Email Signup View */}
                {view === 'email-signup' && (
                    <div className="p-8 space-y-5">
                        <div className="text-center">
                            <h3 className="font-bold text-[#1A2D23] text-lg">注册新帐号</h3>
                        </div>
                        <form onSubmit={handleEmailSignup} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">名字 Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="你的名字"
                                    className="w-full mt-1 px-4 py-3.5 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">邮箱 Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full mt-1 px-4 py-3.5 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">密码 Password</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="至少6位"
                                        className="w-full px-4 py-3.5 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors pr-12"
                                        required
                                        minLength={6}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2D23]">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20"
                            >
                                {loading ? '注册中...' : '注册'}
                            </button>
                        </form>
                        <div className="text-center space-y-2">
                            <button onClick={() => { setView('email-login'); setMessage(''); }} className="text-xs font-bold text-[#FF6B35] hover:underline">
                                已有帐号？直接登录
                            </button>
                            <br />
                            <button onClick={() => { setView('main'); setMessage(''); }} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">
                                ← 返回其他登录方式
                            </button>
                        </div>
                        {message && (
                            <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 bg-[#E3EADA]/30 text-center border-t border-[#E3EADA]">
                    <p className="text-[10px] font-bold text-[#1A2D23]/50 flex items-center justify-center gap-1 uppercase tracking-wider">
                        <Sparkles size={12} /> RM 1 = 1 积分，推荐好友即获 RM5 折扣
                    </p>
                </div>
            </div>
        </div>
    );
}
