"use client";

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthEmailLoginViewProps {
    email: string;
    setEmail: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    loading: boolean;
    message: string;
    onSubmit: (e: React.FormEvent) => void;
    onSignup: () => void;
    onBack: () => void;
}

export default function AuthEmailLoginView({
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    loading, message, onSubmit, onSignup, onBack,
}: AuthEmailLoginViewProps) {
    return (
        <div className="p-6 space-y-4">
            <h3 className="font-bold text-[#1A2D23] text-lg text-center">邮箱登录</h3>
            <form onSubmit={onSubmit} className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">邮箱 Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35]" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">密码 Password</label>
                    <div className="relative mt-1">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••"
                            className="w-full px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] pr-12" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2D23]">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button type="submit" disabled={loading}
                    className="w-full py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#E95D31] disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20">
                    {loading ? '登录中...' : '登录'}
                </button>
            </form>
            <div className="text-center space-y-1">
                <button onClick={onSignup} className="text-xs font-bold text-[#FF6B35] hover:underline">还没有帐号？立即注册</button>
                <br />
                <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">← 返回</button>
            </div>
            {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}
        </div>
    );
}
