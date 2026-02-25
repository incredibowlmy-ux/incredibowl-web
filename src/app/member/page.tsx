"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import { ArrowLeft, Star, ShoppingBag, Wallet, Calendar, Clock, CheckCircle, ChefHat, Truck, XCircle, Sparkles, Share2, Copy, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

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
    const referralCode = currentUser?.uid?.slice(0, 6).toUpperCase() || 'XXXXXX';
    const shareText = `🍛 我在 Incredibowl 订了好吃的家味便当！用我的推荐码 ${referralCode} 注册，双方各获 50 积分！\n👉 https://incredibowl.my`;
    const shareUrl = 'https://incredibowl.my';

    const handleCopyCode = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Social share handlers
    const socialLinks = [
        { name: 'WhatsApp', emoji: '💬', color: 'bg-green-500 hover:bg-green-600', onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank') },
        { name: 'Facebook', emoji: '📘', color: 'bg-blue-600 hover:bg-blue-700', onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank') },
        { name: 'Instagram', emoji: '📸', color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开 Instagram 粘贴到 Story 或贴文 📸'); } },
        { name: '小红书', emoji: '📕', color: 'bg-red-500 hover:bg-red-600', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开小红书粘贴发布 📕'); } },
        { name: 'TikTok', emoji: '🎵', color: 'bg-black hover:bg-gray-800', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开 TikTok 粘贴到视频描述 🎵'); } },
        { name: 'WeChat', emoji: '💚', color: 'bg-green-600 hover:bg-green-700', onClick: () => { navigator.clipboard.writeText(shareText); alert('已复制推荐文案！请打开微信朋友圈粘贴分享 💚'); } },
        { name: 'Threads', emoji: '🧵', color: 'bg-gray-800 hover:bg-gray-900', onClick: () => window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, '_blank') },
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
                    <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-bold mb-6 transition-colors">
                        <ArrowLeft size={16} /> 返回首页
                    </Link>
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
                    <p className="text-[11px] text-gray-400">再累积 <span className="font-bold text-[#FF6B35]">{Math.max(100 - (profileData?.points || 0), 0)}</span> 分即可兑换 RM10 优惠</p>
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
                                                <div className="text-right shrink-0">
                                                    <p className="font-black text-[#FF6B35]">RM {(order.total || 0).toFixed(2)}</p>
                                                    <p className="text-[9px] text-gray-400">{isExpanded ? '▲ 收起' : '▼ 详情'}</p>
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
                                                    {/* Reorder Button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReorder(order); }}
                                                        className="w-full py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#E95D31] transition-colors shadow-sm shadow-[#FF6B35]/20"
                                                    >
                                                        <RefreshCw size={14} /> 再来一单 →
                                                    </button>
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
                                className={`py-2.5 rounded-xl text-white font-bold text-[10px] flex flex-col items-center gap-1 transition-all ${social.color}`}
                            >
                                <span className="text-lg">{social.emoji}</span>
                                {social.name}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {socialLinks.slice(4).map((social) => (
                            <button
                                key={social.name}
                                onClick={social.onClick}
                                className={`py-2.5 rounded-xl text-white font-bold text-[10px] flex flex-col items-center gap-1 transition-all ${social.color}`}
                            >
                                <span className="text-lg">{social.emoji}</span>
                                {social.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
