"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, logout } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import { ArrowLeft, Star, ShoppingBag, Wallet, Calendar, Clock, CheckCircle, ChefHat, Truck, XCircle, Sparkles, Share2, Copy, ChevronLeft, ChevronRight, RefreshCw, LogOut } from 'lucide-react';

// Dish image mapping for favorite dish display
const DISH_IMAGES: Record<string, string> = {
    '纳豆月见海苔饭': '/natto_bowl.jpg',
    '香煎金黄鸡扒饭': '/chicken_chop.png',
    '山药云耳海陆双鲜': '/yam_surf_turf_egg.jpg',
    '招牌当归回味蒸鸡全腿': '/angelica_chicken.png',
    '马铃薯炖五花肉': '/pork_potato_stew.jpg',
    '金黄葱香煎鸡腿汤': '/scallion_chicken_soup.jpg',
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: '待确认', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    confirmed: { label: '已确认', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    preparing: { label: '准备中', color: 'bg-purple-100 text-purple-700', icon: ChefHat },
    delivered: { label: '已送达', color: 'bg-green-100 text-green-700', icon: Truck },
    cancelled: { label: '已取消', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const ORDERS_PER_PAGE = 5;

export default function MemberPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [profileData, setProfileData] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [copied, setCopied] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [redeemedCode, setRedeemedCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);

    const handleRedeemPoints = async () => {
        if (!currentUser || (profileData?.points || 0) < 100) return;
        setRedeeming(true);
        try {
            // Generate unique promo code
            const code = 'POINTS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            // Deduct 100 points from user
            const { doc, updateDoc, increment } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { points: increment(-100) });
            // Update local state
            setProfileData((prev: any) => ({ ...prev, points: (prev?.points || 0) - 100 }));
            setRedeemedCode(code);
        } catch (error) {
            alert('兑换失败，请稍后再试');
        }
        setRedeeming(false);
    };

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            setAuthChecked(true);
            if (user) loadData(user.uid);
        });
        return () => unsubscribe();
    }, []);

    const loadData = async (uid: string) => {
        setLoading(true);
        try {
            const [profile, userOrders] = await Promise.all([
                getUserProfile(uid),
                getUserOrders(uid),
            ]);
            setProfileData(profile);
            setOrders(userOrders);
        } catch (e) {
            console.error('Failed to load member data:', e);
        }
        setLoading(false);
    };

    // Not logged in
    if (authChecked && !currentUser) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🔐</div>
                    <h1 className="text-2xl font-black text-[#1A2D23]">会员中心</h1>
                    <p className="text-gray-500 text-sm">请先在首页登录后再访问</p>
                    <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                        <ArrowLeft size={16} /> 返回首页登录
                    </Link>
                </div>
            </div>
        );
    }

    // Loading
    if (!authChecked || loading) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Pagination
    const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);
    const pagedOrders = orders.slice(page * ORDERS_PER_PAGE, (page + 1) * ORDERS_PER_PAGE);

    // Stats
    const memberDays = profileData?.createdAt?.seconds
        ? Math.floor((Date.now() / 1000 - profileData.createdAt.seconds) / 86400)
        : 0;
    const pointsProgress = Math.min(((profileData?.points || 0) / 100) * 100, 100);

    // Referral code
    const referralCode = profileData?.referralCode || ('IB-' + (currentUser?.uid?.slice(0, 6).toUpperCase() || 'XXXXXX'));
    const shareText = `🍛 我在 Incredibowl 订了好吃的家味便当！用我的推荐码 ${referralCode} 注册，首次下单确认后双方各获 50 积分！\n👉 https://incredibowl.my`;
    const shareUrl = 'https://incredibowl.my';

    const handleCopyCode = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Social share handlers
    const socialLinks = [
        { name: 'WhatsApp', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>, color: 'bg-[#25D366] hover:bg-[#1DA851]', onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank') },
        { name: 'Facebook', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>, color: 'bg-[#1877F2] hover:bg-[#0C63D4]', onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank') },
        { name: 'Instagram', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>, color: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开 Instagram 粘贴到 Story 或贴文'); } },
        { name: '小红书', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm2.8 6.4h2l.8 3.2h-2l-.8-3.2zm-6.4 0h2l.8 3.2h-2l-.8-3.2zm-2.8 4.8h12.8v1.6H5.6v-1.6zm1.6 3.2h9.6v1.6H7.2v-1.6zm1.6 3.2h6.4v1.6H8.8v-1.6z" /></svg>, color: 'bg-[#FE2C55] hover:bg-[#E0254C]', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开小红书粘贴发布'); } },
        { name: 'TikTok', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.15v-3.44a4.85 4.85 0 01-3.77-1.25V6.69h3.77z" /></svg>, color: 'bg-[#010101] hover:bg-[#333]', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开 TikTok 粘贴到视频描述'); } },
        { name: 'WeChat', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05a5.79 5.79 0 01-.245-1.68c0-3.558 3.213-6.427 7.154-6.427.387 0 .765.034 1.136.08C16.818 4.67 13.136 2.188 8.691 2.188zm-2.87 4.401c.553 0 1.001.448 1.001 1s-.448 1.001-1 1.001-1.001-.448-1.001-1 .448-1.001 1-1.001zm5.697 0c.553 0 1.001.448 1.001 1s-.448 1.001-1 1.001-1.001-.448-1.001-1 .448-1.001 1-1.001zM16.412 9.17c-3.393 0-6.15 2.468-6.15 5.513 0 3.044 2.756 5.512 6.15 5.512.675 0 1.32-.102 1.932-.278a.68.68 0 01.563.076l1.349.789a.263.263 0 00.131.04c.127 0 .232-.105.232-.232a.312.312 0 00-.038-.168l-.276-1.048a.472.472 0 01.168-.522C21.716 17.755 22.56 16.13 22.56 14.69c0-3.044-2.756-5.52-6.148-5.52zm-2.49 3.636c.44 0 .799.357.799.797 0 .44-.36.8-.8.8a.799.799 0 01-.798-.8c0-.44.357-.797.799-.797zm4.98 0c.44 0 .8.357.8.797 0 .44-.36.8-.8.8a.799.799 0 01-.8-.8c0-.44.358-.797.8-.797z" /></svg>, color: 'bg-[#07C160] hover:bg-[#06A852]', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开微信朋友圈粘贴分享'); } },
        { name: 'Threads', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.789.744c-1.053-3.773-3.614-5.537-7.548-5.555-2.568.015-4.545.856-5.874 2.502C5.05 6.851 4.353 9.134 4.326 12c.027 2.866.723 5.149 2.07 6.79 1.3 1.585 3.238 2.396 5.76 2.414h.028c2.148-.013 3.91-.685 5.236-1.999 1.097-1.089 1.782-2.493 2.035-4.168l.002-.01-2.994-.8-.003.013c-.32 1.574-1.09 2.714-2.286 3.388-.976.55-2.17.824-3.552.815h-.01c-.946-.005-1.822-.164-2.6-.474-.867-.344-1.563-.85-2.069-1.503-.64-.826-.974-1.896-1.002-3.179v-.01c-.001-.06-.002-.118-.002-.18 0-1.938.528-3.476 1.571-4.575C7.577 7.454 8.814 6.91 10.259 6.9h.046c1.508.014 2.698.563 3.537 1.634.614.784.968 1.72 1.053 2.782l-2.778.27c-.06-.726-.3-1.322-.715-1.769-.467-.504-1.136-.765-1.99-.777h-.032c-.993.006-1.775.378-2.325 1.108-.43.571-.696 1.34-.764 2.284v.023c0 .014.001.028.001.042 0 .023.001.047.002.07.079 1.614.607 2.784 1.573 3.478.777.558 1.784.85 2.995.868h.032c1.073-.01 1.95-.248 2.607-.71.513-.36.886-.871 1.112-1.52l2.782.744c-.383 1.13-1.05 2.073-1.99 2.807C16.265 23.28 14.416 23.977 12.186 24z" /></svg>, color: 'bg-[#000000] hover:bg-[#333]', onClick: () => window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, '_blank') },
    ];

    // Find most ordered dish
    const dishCount: Record<string, number> = {};
    orders.forEach((o: any) => {
        o.items?.forEach((item: any) => {
            dishCount[item.name] = (dishCount[item.name] || 0) + item.quantity;
        });
    });
    const favDish = Object.entries(dishCount).sort((a, b) => b[1] - a[1])[0];
    const favDishImage = favDish ? DISH_IMAGES[favDish[0]] : null;

    // Reorder handler
    const handleReorder = (order: any) => {
        // Build WhatsApp message with order details
        const items = order.items?.map((item: any) => `${item.name} x${item.quantity}`).join('\n') || '';
        const msg = `🍛 我想再来一单！\n\n${items}\n\n总计: RM ${(order.total || 0).toFixed(2)}\n📍 地址: ${order.userAddress || ''}\n\n谢谢阿姨！`;
        window.open(`https://wa.me/60103370197?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-[#F5F3EF]">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
                body { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
            `}</style>

            {/* Header */}
            <header className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] text-white pb-20 pt-6 px-4 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-10 left-10 text-8xl">🍜</div>
                    <div className="absolute bottom-5 right-10 text-7xl">🥢</div>
                </div>
                <div className="max-w-2xl mx-auto relative">
                    <div className="flex items-center justify-between mb-6">
                        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-bold transition-colors">
                            <ArrowLeft size={16} /> 返回首页
                        </Link>
                        <button
                            onClick={async () => { await logout(); window.location.href = '/'; }}
                            className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-xs font-bold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
                        >
                            <LogOut size={14} /> 登出
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden">
                            {currentUser?.photoURL ? (
                                <Image src={currentUser.photoURL} alt="avatar" width={64} height={64} className="rounded-2xl" />
                            ) : (
                                <span className="text-3xl">{(currentUser?.displayName || 'G')[0].toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">{currentUser?.displayName || 'Guest'}</h1>
                            <p className="text-white/50 text-xs">{currentUser?.email}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 -mt-14 space-y-5 pb-12">
                {/* Points Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#FF6B35]/10 rounded-xl flex items-center justify-center">
                                <Sparkles size={16} className="text-[#FF6B35]" />
                            </div>
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">我的积分</span>
                        </div>
                        <span className="text-3xl font-black text-[#FF6B35]">{profileData?.points || 0}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                        <div className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F60] h-3 rounded-full transition-all duration-700" style={{ width: `${pointsProgress}%` }}></div>
                    </div>

                    {(profileData?.points || 0) >= 100 ? (
                        <div className="mt-3">
                            {!redeemedCode ? (
                                <div className="bg-gradient-to-br from-[#FFF3E0] via-[#FFECB3] to-[#FFE0B2] rounded-2xl p-5 border border-[#FFD54F]/50 relative overflow-hidden">
                                    {/* Decorative */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF6B35]/10 rounded-full blur-2xl" />
                                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#FFD54F]/20 rounded-full blur-xl" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-2xl shadow-sm animate-bounce">
                                                🎁
                                            </div>
                                            <div>
                                                <p className="font-black text-[#E65100] text-sm">恭喜！积分已达标</p>
                                                <p className="text-[11px] text-[#E65100]/60">你可以用 100 积分兑换 RM10 优惠码</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleRedeemPoints}
                                            disabled={redeeming}
                                            className="w-full py-3.5 bg-[#FF6B35] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E95D31] transition-all shadow-lg shadow-[#FF6B35]/30 active:scale-[0.98]"
                                        >
                                            <Sparkles size={16} />
                                            {redeeming ? '生成优惠码中...' : '立即兑换 RM10 优惠码'}
                                        </button>
                                        <p className="text-[10px] text-[#E65100]/40 text-center mt-2">兑换后将扣除 100 积分 · 剩余 {Math.max(0, (profileData?.points || 0) - 100)} 分</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/30 rounded-full blur-2xl" />
                                    <div className="relative z-10 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                <CheckCircle size={18} className="text-green-600" />
                                            </div>
                                            <p className="font-black text-green-700 text-sm">兑换成功！🎉</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-green-200 text-center">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">你的优惠码</p>
                                            <p className="font-mono font-black text-2xl text-[#FF6B35] tracking-[0.15em] mb-2">{redeemedCode}</p>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(redeemedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                                className="px-5 py-2 bg-[#1A2D23] text-white rounded-lg text-xs font-bold hover:bg-[#2A3D33] transition-colors"
                                            >
                                                {copied ? '✅ 已复制' : '📋 复制优惠码'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-green-600/70 text-center">结账时粘贴此优惠码即可减免 RM10</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-400">再累积 <span className="font-bold text-[#FF6B35]">{Math.max(100 - (profileData?.points || 0), 0)}</span> 分即可兑换 RM10 优惠</p>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                        <ShoppingBag size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{profileData?.totalOrders || 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">总订单</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                        <Wallet size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">RM{(profileData?.totalSpent || 0).toFixed(0)}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">累计消费</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                        <Star size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{favDish ? favDish[1] : 0}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">最爱点数</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
                        <Calendar size={18} className="mx-auto mb-1 text-[#FF6B35]" />
                        <p className="text-xl font-black text-[#1A2D23]">{memberDays}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase">已加入天</p>
                    </div>
                </div>

                {/* Favorite Dish Badge with real image */}
                {favDish && (
                    <div className="bg-gradient-to-r from-[#FFF3E0] to-[#FFECB3] rounded-2xl p-4 flex items-center gap-4 border border-[#FFE0B2] overflow-hidden">
                        {favDishImage ? (
                            <div className="w-16 h-16 rounded-xl overflow-hidden relative shrink-0 shadow-md">
                                <Image src={favDishImage} alt={favDish[0]} fill className="object-cover" />
                            </div>
                        ) : (
                            <span className="text-4xl shrink-0">👩‍🍳</span>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[#E65100] uppercase tracking-wider">⭐ 你最常点的菜</p>
                            <p className="font-black text-[#1A2D23] truncate">{favDish[0]}</p>
                            <p className="text-xs text-[#E65100]/60">已点 {favDish[1]} 次</p>
                        </div>
                    </div>
                )}

                {/* Order History */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-black text-[#1A2D23] flex items-center gap-2">
                            <ShoppingBag size={18} /> 订单记录
                        </h2>
                        <span className="text-xs text-gray-400 font-bold">{orders.length} 单</span>
                    </div>

                    {orders.length === 0 ? (
                        <div className="text-center py-16 text-gray-300">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-bold text-sm">还没有订单</p>
                            <Link href="/" className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-[#FF6B35] text-white rounded-xl text-sm font-bold hover:bg-[#E95D31] transition-colors">
                                去点餐 →
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-50">
                                {pagedOrders.map((order: any) => {
                                    const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
                                    const StIcon = st.icon;
                                    const isExpanded = expandedOrder === order.id;
                                    const mainDish = order.items?.[0]?.name || '—';
                                    const mainDishImage = DISH_IMAGES[mainDish];
                                    const itemCount = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

                                    return (
                                        <div key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                            {/* Compact Row */}
                                            <button
                                                className="w-full p-4 flex items-center gap-3 text-left"
                                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                            >
                                                {/* Dish thumbnail */}
                                                <div className="w-12 h-12 rounded-xl overflow-hidden relative shrink-0 bg-[#F5F3EF]">
                                                    {mainDishImage ? (
                                                        <Image src={mainDishImage} alt={mainDish} fill className="object-cover" />
                                                    ) : (
                                                        <span className="text-2xl absolute inset-0 flex items-center justify-center">🍛</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${st.color}`}>
                                                            <StIcon size={9} /> {st.label}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-[#1A2D23] text-sm truncate">
                                                        {mainDish} {itemCount > 1 && <span className="text-gray-400 font-normal">等{itemCount}份</span>}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">📅 {order.deliveryDate}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <p className="font-black text-[#FF6B35]">RM {(order.total || 0).toFixed(2)}</p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReorder(order); }}
                                                        className="px-3 py-1 bg-[#FF6B35] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-[#E95D31] transition-colors shadow-sm"
                                                    >
                                                        <RefreshCw size={10} /> 再来一单
                                                    </button>
                                                </div>
                                            </button>

                                            {/* Expanded Detail */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200 space-y-3">
                                                    <div className="bg-[#F5F3EF] rounded-xl p-3 space-y-1">
                                                        {order.items?.map((item: any, i: number) => (
                                                            <div key={i} className="flex justify-between text-xs">
                                                                <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                                                <span className="font-bold text-gray-700">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                                                        <span>⏰ {order.deliveryTime?.split('(')[0]?.trim()}</span>
                                                        <span>📍 {order.userAddress?.slice(0, 30)}{order.userAddress?.length > 30 ? '...' : ''}</span>
                                                    </div>
                                                    {order.note && (
                                                        <p className="text-[10px] text-[#FF6B35] font-bold">📝 {order.note}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-2 rounded-lg bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-bold text-gray-400">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-2 rounded-lg bg-gray-100 disabled:opacity-30 hover:bg-gray-200 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Referral Section */}
                <div className="bg-gradient-to-br from-[#1A2D23] to-[#2A3D33] rounded-3xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-3">
                        <Share2 size={18} className="text-[#FF6B35]" />
                        <h3 className="font-black">推荐好友赚积分</h3>
                    </div>
                    <p className="text-white/50 text-xs mb-4">分享你的推荐码给朋友，好友完成首单后双方各获 <span className="text-[#FF6B35] font-bold">50 积分</span>！</p>

                    <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">推荐码</p>
                            <p className="text-2xl font-black tracking-[0.3em] text-[#FF6B35]">{referralCode}</p>
                        </div>
                        <button
                            onClick={handleCopyCode}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                        >
                            {copied ? <><CheckCircle size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
                        </button>
                    </div>

                    {/* Social Share Buttons */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {socialLinks.slice(0, 4).map((social) => (
                            <button
                                key={social.name}
                                onClick={social.onClick}
                                className={`py-3 rounded-xl text-white font-bold text-[10px] flex flex-col items-center gap-1.5 transition-all ${social.color}`}
                            >
                                {social.icon}
                                {social.name}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {socialLinks.slice(4).map((social) => (
                            <button
                                key={social.name}
                                onClick={social.onClick}
                                className={`py-3 rounded-xl text-white font-bold text-[10px] flex flex-col items-center gap-1.5 transition-all ${social.color}`}
                            >
                                {social.icon}
                                {social.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
