"use client";

import React from 'react';
import { Eye, EyeOff, Phone, MapPin } from 'lucide-react';

interface AuthEmailSignupViewProps {
    name: string; setName: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    password: string; setPassword: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    address: string; setAddress: (v: string) => void;
    showPassword: boolean; setShowPassword: (v: boolean) => void;
    referralInput: string; setReferralInput: (v: string) => void;
    loading: boolean;
    message: string;
    onSubmit: (e: React.FormEvent) => void;
    onLogin: () => void;
    onBack: () => void;
}

export default function AuthEmailSignupView({
    name, setName, email, setEmail, password, setPassword,
    phone, setPhone, address, setAddress,
    showPassword, setShowPassword,
    referralInput, setReferralInput,
    loading, message, onSubmit, onLogin, onBack,
}: AuthEmailSignupViewProps) {
    return (
        <div className="p-6 space-y-4">
            <h3 className="font-bold text-[#1A2D23] text-lg text-center">注册新帐号</h3>
            <form onSubmit={onSubmit} className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">名字 Name *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字"
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35]" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Phone size={10} /> 手机号码 Phone *</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 010-337 0197"
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35]" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><MapPin size={10} /> 配送地址 Address *</label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例: Pearl Suria, Block B-12-3"
                        rows={2} className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] resize-none" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">邮箱 Email *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35]" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">密码 Password *</label>
                    <div className="relative mt-1">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少6位"
                            className="w-full px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] pr-12" required minLength={6} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1A2D23]">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">🎁 推荐码 Referral Code（选填）</label>
                    <input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="朋友的推荐码，例: IB-A1B2C3"
                        className="w-full mt-1 px-4 py-3 bg-[#FFF3E0] border-2 border-[#FFE0B2] rounded-xl text-sm outline-none focus:border-[#FF6B35] placeholder:text-[#E65100]/30" />
                    <p className="text-[10px] text-[#E65100]/50 mt-1">填写推荐码，首次下单确认后双方各获 50 积分</p>
                </div>
                <button type="submit" disabled={loading}
                    className="w-full py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#E95D31] disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20">
                    {loading ? '注册中...' : '注册'}
                </button>
            </form>
            <div className="text-center space-y-1">
                <button onClick={onLogin} className="text-xs font-bold text-[#FF6B35] hover:underline">已有帐号？直接登录</button>
                <br />
                <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">← 返回</button>
            </div>
            {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}
        </div>
    );
}
