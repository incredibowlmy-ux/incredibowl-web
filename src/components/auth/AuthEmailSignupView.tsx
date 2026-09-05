"use client";

import React from 'react';
import { Eye, EyeOff, Phone, MapPin } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { AUTH_DICT } from './dict';

interface AuthEmailSignupViewProps {
    name: string; setName: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    password: string; setPassword: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    address: string; setAddress: (v: string) => void;
    showPassword: boolean; setShowPassword: (v: boolean) => void;
    loading: boolean;
    message: string;
    onSubmit: (e: React.FormEvent) => void;
    onLogin: () => void;
    onBack: () => void;
    locale?: Locale;
}

export default function AuthEmailSignupView({
    name, setName, email, setEmail, password, setPassword,
    phone, setPhone, address, setAddress,
    showPassword, setShowPassword,
    loading, message, onSubmit, onLogin, onBack,
    locale = 'zh',
}: AuthEmailSignupViewProps) {
    const t = AUTH_DICT[locale].emailSignup;
    return (
        <div className="p-6 space-y-4">
            <h3 className="font-bold text-ink text-lg text-center">{t.title}</h3>
            <form onSubmit={onSubmit} className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.nameLabel}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder}
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Phone size={10} /> {t.phoneLabel}</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder}
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><MapPin size={10} /> {t.addressLabel}</label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.addressPlaceholder}
                        rows={2} className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary resize-none" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.emailLabel}</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.passwordLabel}</label>
                    <div className="relative mt-1">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder}
                            className="w-full px-4 py-3 bg-white border-2 border-line rounded-xl text-sm outline-none focus:border-primary pr-12" required minLength={6} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button type="submit" disabled={loading}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark disabled:opacity-50 shadow-lg shadow-primary/20">
                    {loading ? t.signingUp : t.signup}
                </button>
            </form>
            <div className="text-center space-y-1">
                <button onClick={onLogin} className="text-xs font-bold text-primary hover:underline">{t.haveAccount}</button>
                <br />
                <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-ink">{t.back}</button>
            </div>
            {message && <p className="text-center text-sm font-bold text-primary">{message}</p>}
        </div>
    );
}
