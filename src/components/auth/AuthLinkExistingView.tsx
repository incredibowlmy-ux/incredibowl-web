"use client";

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { PendingLink } from '@/lib/auth';
import { AUTH_DICT } from './dict';

// 同邮箱撞号的中间页：客户用 Facebook（或 Google）登了一个已注册过的邮箱，
// 这里让他登一次原账号，AuthModal 随即把被拒的 provider 绑到同一个 uid。
// methods 是原账号的注册方式；Firebase 开了枚举保护会回空数组 → 两种都显示。
interface AuthLinkExistingViewProps {
    pending: PendingLink;
    methods: string[];
    password: string;
    setPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    loading: boolean;
    message: string;
    onGoogle: () => void;
    onEmailSubmit: (e: React.FormEvent) => void;
    onBack: () => void;
    locale?: Locale;
}

export default function AuthLinkExistingView({
    pending, methods, password, setPassword, showPassword, setShowPassword,
    loading, message, onGoogle, onEmailSubmit, onBack, locale = 'zh',
}: AuthLinkExistingViewProps) {
    const t = AUTH_DICT[locale].link;
    const showGoogle = methods.length === 0 || methods.includes('google.com');
    const showEmail = methods.length === 0 || methods.includes('password');
    return (
        <div className="p-6 space-y-4">
            <div className="text-center space-y-2">
                <h3 className="font-bold text-ink text-lg">{t.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{t.desc(pending.email, t.providerName[pending.provider])}</p>
            </div>

            {showGoogle && (
                <button onClick={onGoogle} disabled={loading}
                    className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 font-bold text-ink hover:border-[#4285F4] hover:shadow-md transition-all disabled:opacity-50">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {loading ? t.linking : t.googleBtn}
                </button>
            )}

            {showGoogle && showEmail && (
                <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line"></div></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-paper px-4 text-gray-400">{t.orEmail}</span></div>
                </div>
            )}

            {showEmail && (
                <form onSubmit={onEmailSubmit} className="space-y-3">
                    <input type="email" value={pending.email} readOnly
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-line rounded-xl text-sm text-gray-500 outline-none" />
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.passwordLabel}</label>
                        <div className="relative mt-1">
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••"
                                className="w-full px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary pr-12" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark disabled:opacity-50 shadow-lg shadow-primary/20">
                        {loading ? t.linking : t.emailBtn}
                    </button>
                </form>
            )}

            <div className="text-center">
                <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-ink">{t.back}</button>
            </div>
            {message && <p className="text-center text-sm font-bold text-primary">{message}</p>}
        </div>
    );
}
