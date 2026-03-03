"use client";

import React from 'react';
import { Sparkles, LogOut, User as UserIcon, Phone, MapPin, Save, ShoppingBag } from 'lucide-react';
import { User } from 'firebase/auth';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

interface AuthProfileViewProps {
    currentUser: User;
    profileData: any;
    phone: string; setPhone: (v: string) => void;
    address: string; setAddress: (v: string) => void;
    editingProfile: boolean; setEditingProfile: (v: boolean) => void;
    referralInput: string; setReferralInput: (v: string) => void;
    loading: boolean;
    message: string;
    onUpdateProfile: () => void;
    onLogout: () => void;
    onClose: () => void;
}

export default function AuthProfileView({
    currentUser, profileData,
    phone, setPhone, address, setAddress,
    editingProfile, setEditingProfile,
    referralInput, setReferralInput,
    loading, message, onUpdateProfile, onLogout, onClose,
}: AuthProfileViewProps) {
    return (
        <div className="p-6 space-y-5">
            {/* Avatar + name */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#E3EADA] flex items-center justify-center overflow-hidden border-2 border-[#E3EADA]">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon size={28} className="text-[#1A2D23]" />
                    )}
                </div>
                <h3 className="font-bold text-[#1A2D23] text-lg">{currentUser.displayName || '会员'}</h3>
                <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>

            {/* Points Dashboard */}
            {profileData === null ? (
                <div className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] rounded-2xl p-5 space-y-3">
                    <SkeletonBlock className="h-3 w-20 bg-white/20" />
                    <SkeletonBlock className="h-8 w-28 bg-white/20" />
                    <SkeletonBlock className="h-2 w-full bg-white/20" />
                    <SkeletonBlock className="h-3 w-40 bg-white/20" />
                    <div className="flex gap-4 pt-3 border-t border-white/10">
                        <SkeletonBlock className="h-6 w-12 bg-white/20" />
                        <SkeletonBlock className="h-6 w-16 bg-white/20" />
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">我的积分</span>
                        <Sparkles size={14} className="text-[#FF6B35]" />
                    </div>
                    <div className="text-3xl font-black mb-1">{profileData?.points || 0} <span className="text-sm font-bold opacity-50">分</span></div>
                    <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                        <div className="bg-[#FF6B35] h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(((profileData?.points || 0) / 100) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] opacity-60">累积 100 积分可兑换 RM10 优惠</p>
                    <div className="flex gap-4 mt-4 pt-3 border-t border-white/10">
                        <div>
                            <p className="text-lg font-black">{profileData?.totalOrders || 0}</p>
                            <p className="text-[9px] opacity-50 uppercase">总订单</p>
                        </div>
                        <div>
                            <p className="text-lg font-black">RM {(profileData?.totalSpent || 0).toFixed(0)}</p>
                            <p className="text-[9px] opacity-50 uppercase">累计消费</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Info / Edit */}
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Phone size={10} /> 手机号码 *
                    </label>
                    {editingProfile ? (
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 010-337 0197"
                            className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors" required />
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.phone || <span className="text-red-400 font-bold">未填写（必填）</span>}
                        </p>
                    )}
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <MapPin size={10} /> 配送地址 *
                    </label>
                    {editingProfile ? (
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                            placeholder="例: Pearl Suria, Block B-12-3, Jalan 1/116B, OKR"
                            rows={2} className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none" required />
                    ) : (
                        <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                            {profileData?.address || <span className="text-red-400 font-bold">未填写（必填）</span>}
                        </p>
                    )}
                </div>

                {editingProfile && !profileData?.referredBy && (profileData?.totalOrders || 0) === 0 && (
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            🎁 推荐码 Referral Code（选填）
                        </label>
                        <input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)}
                            placeholder="朋友的推荐码，例: IB-A1B2C3"
                            className="w-full mt-1 px-4 py-3 bg-[#FFF3E0] border-2 border-[#FFE0B2] rounded-xl text-sm outline-none focus:border-[#FF6B35] placeholder:text-[#E65100]/30" />
                        <p className="text-[10px] text-[#E65100]/50 mt-1">填写推荐码，首次下单确认后双方各获 50 积分</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {editingProfile ? (
                    <button onClick={onUpdateProfile} disabled={loading}
                        className="w-full py-3 bg-[#FF6B35] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20">
                        <Save size={16} />
                        {loading ? '保存中...' : '保存资料'}
                    </button>
                ) : (
                    <button onClick={() => setEditingProfile(true)}
                        className="w-full py-3 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#2A3D33] transition-all">
                        ✏️ 编辑资料
                    </button>
                )}
                <button onClick={onLogout} disabled={loading}
                    className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-gray-200 transition-all disabled:opacity-50 text-sm">
                    <LogOut size={14} /> 登出
                </button>
            </div>

            {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}

            <a href="/member" onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-[#FF6B35] to-[#FF8F60] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:shadow-lg hover:shadow-[#FF6B35]/20 transition-all">
                <ShoppingBag size={16} /> 查看订单 & 会员中心 →
            </a>
        </div>
    );
}
