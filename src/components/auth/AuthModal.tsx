"use client";

import React, { useState, useEffect } from 'react';
import { X, Mail, Sparkles, Eye, EyeOff, LogOut, User as UserIcon, Phone, MapPin, Save } from 'lucide-react';
import Image from 'next/image';
import { signInWithGoogle, loginWithEmail, registerWithEmail, logout, onAuthChange, getUserProfile, updateUserProfile } from '@/lib/auth';
import { User } from 'firebase/auth';

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

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            if (user && isOpen) {
                setView('profile');
                loadProfile(user.uid);
            }
        });
        return () => unsubscribe();
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && currentUser) {
            setView('profile');
            loadProfile(currentUser.uid);
        } else if (isOpen && !currentUser) {
            setView('main');
        }
    }, [isOpen, currentUser]);

    const loadProfile = async (uid: string) => {
        const data = await getUserProfile(uid);
        if (data) {
            setProfileData(data);
            setPhone(data.phone || '');
            setAddress(data.address || '');
        }
    };

    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        setLoading(true);
        setMessage('');
        try {
            const user = await signInWithGoogle();
            setMessage('✅ 登录成功！');
            // Check if profile needs phone/address
            const profile = await getUserProfile(user.uid);
            if (!profile?.phone || !profile?.address) {
                setEditingProfile(true);
            }
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') {
                setMessage('登录已取消');
            } else if (error.code === 'auth/unauthorized-domain') {
                setMessage('⚠️ 此域名未授权，请在 Firebase Console 添加');
            } else {
                setMessage(`⚠️ 登录失败: ${error.message}`);
            }
        }
        setLoading(false);
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage('⚠️ 请填写邮箱和密码');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            await loginWithEmail(email, password);
            setMessage('✅ 登录成功！');
            setTimeout(() => resetAndClose(), 1000);
        } catch (error: any) {
            if (error.code === 'auth/invalid-credential') {
                setMessage('⚠️ 邮箱或密码错误');
            } else if (error.code === 'auth/user-not-found') {
                setMessage('⚠️ 帐号不存在，请先注册');
            } else {
                setMessage(`⚠️ ${error.message}`);
            }
        }
        setLoading(false);
    };

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !phone || !address) {
            setMessage('⚠️ 请填写所有字段');
            return;
        }
        if (password.length < 6) {
            setMessage('⚠️ 密码至少需要6位');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            await registerWithEmail(email, password, name, phone, address);
            setMessage('✅ 注册成功！欢迎加入 Incredibowl！');
            setTimeout(() => resetAndClose(), 1500);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                setMessage('⚠️ 此邮箱已注册，请直接登录');
            } else if (error.code === 'auth/weak-password') {
                setMessage('⚠️ 密码太简单，请加强');
            } else {
                setMessage(`⚠️ ${error.message}`);
            }
        }
        setLoading(false);
    };

    const handleUpdateProfile = async () => {
        if (!currentUser) return;
        if (!phone || !address) {
            setMessage('⚠️ 手机号码和配送地址为必填');
            return;
        }
        setLoading(true);
        setMessage('');
        try {
            await updateUserProfile(currentUser.uid, { phone, address });
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
        setProfileData(null);
        setEditingProfile(false);
        setMessage('已登出');
        setLoading(false);
        setView('main');
    };

    const resetAndClose = () => {
        setEmail('');
        setPassword('');
        setName('');
        setMessage('');
        setShowPassword(false);
        setEditingProfile(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1A2D23]/60 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative w-full max-w-lg bg-[#FDFBF7] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-10 text-center bg-white border-b border-[#E3EADA] relative">
                    <button onClick={resetAndClose} className="absolute top-5 right-5 p-2 text-gray-400 hover:text-[#1A2D23] transition-colors">
                        <X size={24} />
                    </button>
                    <div className="w-24 h-24 mx-auto mb-5 bg-white border-2 border-[#E3EADA] rounded-full flex items-center justify-center overflow-hidden shadow-md">
                        <Image src="/logo.png" alt="Logo" width={128} height={128} className="scale-110" />
                    </div>
                    <h2 className="text-3xl font-black text-[#1A2D23]">Incredibowl</h2>
                    <p className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest mt-2">
                        Cook with Mum&#39;s Sincere Heart
                    </p>
                </div>

                {/* Profile View */}
                {view === 'profile' && currentUser && (
                    <div className="p-6 space-y-5">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 mx-auto rounded-full bg-[#E3EADA] flex items-center justify-center overflow-hidden border-2 border-[#E3EADA]">
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={28} className="text-[#1A2D23]" />
                                )}
                            </div>
                            <h3 className="font-bold text-[#1A2D23] text-lg">
                                {currentUser.displayName || '会员'}
                            </h3>
                            <p className="text-xs text-gray-500">{currentUser.email}</p>
                        </div>

                        {/* Points Dashboard */}
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

                        {/* Profile Info / Edit */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                    <Phone size={10} /> 手机号码 *
                                </label>
                                {editingProfile ? (
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="例: 010-337 0197"
                                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors"
                                        required
                                    />
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
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="例: Pearl Suria, Block B-12-3, Jalan 1/116B, OKR"
                                        rows={2}
                                        className="w-full mt-1 px-4 py-3 bg-white border-2 border-[#E3EADA] rounded-xl text-sm outline-none focus:border-[#FF6B35] transition-colors resize-none"
                                        required
                                    />
                                ) : (
                                    <p className="mt-1 px-4 py-3 bg-white rounded-xl text-sm border border-gray-100">
                                        {profileData?.address || <span className="text-red-400 font-bold">未填写（必填）</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            {editingProfile ? (
                                <button
                                    onClick={handleUpdateProfile}
                                    disabled={loading}
                                    className="w-full py-3 bg-[#FF6B35] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#E95D31] transition-all disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20"
                                >
                                    <Save size={16} />
                                    {loading ? '保存中...' : '保存资料'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setEditingProfile(true)}
                                    className="w-full py-3 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-[#2A3D33] transition-all"
                                >
                                    ✏️ 编辑资料
                                </button>
                            )}
                            <button
                                onClick={handleLogout}
                                disabled={loading}
                                className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-gray-200 transition-all disabled:opacity-50 text-sm"
                            >
                                <LogOut size={14} />
                                登出
                            </button>
                        </div>

                        {message && (
                            <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>
                        )}
                    </div>
                )}

                {/* Main View */}
                {view === 'main' && (
                    <div className="p-6 space-y-4">
                        <div className="text-center space-y-1">
                            <h3 className="font-bold text-[#1A2D23] text-lg">注册 / 登录</h3>
                            <p className="text-xs text-gray-500">加入我们，享受免配送费福利与每日精选菜单推送。</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 font-bold text-[#1A2D23] hover:border-[#4285F4] hover:shadow-md transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                {loading ? '连接中...' : '使用 Google 继续'}
                            </button>

                            <button disabled={true} className="w-full py-3.5 bg-black text-white rounded-xl flex items-center justify-center gap-3 font-bold opacity-40 cursor-not-allowed">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                                Apple ID（即将开放）
                            </button>

                            <button disabled={true} className="w-full py-3.5 bg-[#1877F2] text-white rounded-xl flex items-center justify-center gap-3 font-bold opacity-40 cursor-not-allowed">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                Facebook（即将开放）
                            </button>

                            <div className="relative py-1">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E3EADA]"></div></div>
                                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-[#FDFBF7] px-4 text-gray-400">Or</span></div>
                            </div>

                            <button
                                onClick={() => { setView('email-login'); setMessage(''); }}
                                className="w-full py-3.5 bg-[#1A2D23] text-white rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-[#2A3D33] transition-all shadow-lg shadow-[#1A2D23]/20"
                            >
                                <Mail size={18} />
                                使用邮箱登录
                            </button>
                        </div>

                        {message && (
                            <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>
                        )}
                    </div>
                )}

                {/* Email Login */}
                {view === 'email-login' && (
                    <div className="p-6 space-y-4">
                        <h3 className="font-bold text-[#1A2D23] text-lg text-center">邮箱登录</h3>
                        <form onSubmit={handleEmailLogin} className="space-y-3">
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
                            <button onClick={() => { setView('email-signup'); setMessage(''); }} className="text-xs font-bold text-[#FF6B35] hover:underline">还没有帐号？立即注册</button>
                            <br />
                            <button onClick={() => { setView('main'); setMessage(''); }} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">← 返回</button>
                        </div>
                        {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}
                    </div>
                )}

                {/* Email Signup */}
                {view === 'email-signup' && (
                    <div className="p-6 space-y-4">
                        <h3 className="font-bold text-[#1A2D23] text-lg text-center">注册新帐号</h3>
                        <form onSubmit={handleEmailSignup} className="space-y-3">
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
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-[#FF6B35] text-white rounded-xl font-bold hover:bg-[#E95D31] disabled:opacity-50 shadow-lg shadow-[#FF6B35]/20">
                                {loading ? '注册中...' : '注册'}
                            </button>
                        </form>
                        <div className="text-center space-y-1">
                            <button onClick={() => { setView('email-login'); setMessage(''); }} className="text-xs font-bold text-[#FF6B35] hover:underline">已有帐号？直接登录</button>
                            <br />
                            <button onClick={() => { setView('main'); setMessage(''); }} className="text-xs font-bold text-gray-400 hover:text-[#1A2D23]">← 返回</button>
                        </div>
                        {message && <p className="text-center text-sm font-bold text-[#FF6B35]">{message}</p>}
                    </div>
                )}

                {/* Footer */}
                <div className="p-3 bg-[#E3EADA]/30 text-center border-t border-[#E3EADA]">
                    <p className="text-[10px] font-bold text-[#1A2D23]/50 flex items-center justify-center gap-1 uppercase tracking-wider">
                        <Sparkles size={12} /> RM 1 = 1 积分 · 推荐好友获 50 积分 · 100 积分兑 RM10
                    </p>
                </div>
            </div>
        </div>
    );
}
