"use client";

import React, { useState, useEffect } from 'react';
import { onAuthChange, signInWithGoogle, logout } from '@/lib/auth';
import { getAllOrders, updateOrderStatus, getAllUsers, OrderStatus } from '@/lib/orders';
import { getAllFeedbacks, updateFeedbackStatus, deleteFeedback, Feedback } from '@/lib/feedbacks';
import { User } from 'firebase/auth';
import { ShoppingBag, Users, CheckCircle, Clock, Truck, XCircle, ChefHat, RefreshCw, ArrowLeft, Phone, MapPin, FileText, LogOut, MessageCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';

const ADMIN_EMAILS = ['incredibowl.my@gmail.com']; // Add your email here

const STATUS_CONFIG: Record<OrderStatus, { label: string; labelCn: string; color: string; icon: any }> = {
    pending: { label: 'Pending', labelCn: '待确认', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    confirmed: { label: 'Confirmed', labelCn: '已确认', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
    preparing: { label: 'Preparing', labelCn: '准备中', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ChefHat },
    delivered: { label: 'Delivered', labelCn: '已送达', color: 'bg-green-100 text-green-700 border-green-200', icon: Truck },
    cancelled: { label: 'Cancelled', labelCn: '已取消', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

export default function AdminPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'feedbacks'>('orders');
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');
    const [statsDate, setStatsDate] = useState<string>('7days'); // '7days' or specific date string
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleOrderExp = (id: string) => {
        setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setCurrentUser(user);
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser && ADMIN_EMAILS.includes(currentUser.email || '')) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ordersData, usersData, feedbacksData] = await Promise.all([
                getAllOrders(),
                getAllUsers(),
                getAllFeedbacks(),
            ]);
            setOrders(ordersData);
            setCustomers(usersData);
            setFeedbacks(feedbacksData);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
        setLoading(false);
    };

    const handleStatusChange = async (order: any, newStatus: OrderStatus) => {
        try {
            await updateOrderStatus(order.id, newStatus, order);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
        } catch (error) {
            alert('更新失败: ' + error);
        }
    };

    // Auth check
    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const handleAdminLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error: any) {
            if (error.code !== 'auth/popup-closed-by-user') {
                alert('登录失败: ' + error.message);
            }
        }
    };

    if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email || '')) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🔒</div>
                    <h1 className="text-2xl font-black text-[#1A2D23]">管理后台</h1>
                    <p className="text-gray-500 text-sm">
                        {currentUser ? `${currentUser.email} 没有管理员权限` : '请先登录管理员帐号'}
                    </p>
                    {!currentUser ? (
                        <button onClick={handleAdminLogin} className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-[#1A2D23] hover:border-[#4285F4] hover:shadow-md transition-all">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                            使用 Google 登录
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <button onClick={() => logout()} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                                <LogOut size={16} /> 登出并换帐号
                            </button>
                            <br />
                            <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                                <ArrowLeft size={16} /> 返回首页
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (filterStatus !== 'all' && order.status !== filterStatus) return false;
        if (filterDate && order.deliveryDate !== filterDate) return false;
        return true;
    });

    // Helper: format date string
    const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Stats
    const todayStr = formatDateStr(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = formatDateStr(tomorrowDate);

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const tomorrowOrders = orders.filter(o => o.deliveryDate === tomorrowStr);
    const todayRevenue = orders.filter(o => o.deliveryDate === todayStr && o.status !== 'cancelled').reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const todayCustomersCount = new Set(orders.filter(o => o.deliveryDate === todayStr).map(o => o.userId)).size;

    // Aggregate stats for next 7 days
    const statsDaysList: { date: string; label: string }[] = [{ date: '7days', label: '未来 7 日' }];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const ds = formatDateStr(d);
        const label = i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '后天' : ds.split('-').slice(1).join('/');
        statsDaysList.push({ date: ds, label });
    }

    const targetDates = statsDate === '7days' ? statsDaysList.slice(1).map(d => d.date) : [statsDate];
    const displayLabel = statsDaysList.find(d => d.date === statsDate)?.label || '数据';

    const upcomingOrdersCount = orders.filter(o => targetDates.includes(o.deliveryDate) && o.status !== 'cancelled').length;
    const upcomingRevenue = orders.filter(o => targetDates.includes(o.deliveryDate) && o.status !== 'cancelled').reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const upcomingCustomersCount = new Set(orders.filter(o => targetDates.includes(o.deliveryDate) && o.status !== 'cancelled').map(o => o.userId)).size;

    // Build upcoming days (tomorrow + next 6 days = 7 days total)
    const upcomingDays: { dateStr: string; label: string; orders: any[] }[] = [];
    const dayLabels = ['明天', '后天', '大后天'];
    for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = formatDateStr(d);
        const dayOrders = orders.filter(o => o.deliveryDate === dateStr && o.status !== 'cancelled');
        if (dayOrders.length > 0) {
            const label = i <= 3 ? `${dayLabels[i - 1]} (${dateStr})` : dateStr;
            upcomingDays.push({ dateStr, label, orders: dayOrders });
        }
    }

    // Helper: split orders into lunch and dinner
    const splitMealTime = (dayOrders: any[]) => {
        const lunch = dayOrders.filter(o => !o.deliveryTime || o.deliveryTime.toLowerCase().includes('lunch') || o.deliveryTime.includes('午'));
        const dinner = dayOrders.filter(o => o.deliveryTime && (o.deliveryTime.toLowerCase().includes('dinner') || o.deliveryTime.includes('晚')));
        return { lunch, dinner };
    };

    // Helper: format order creation time
    const formatCreatedAt = (order: any) => {
        if (!order.createdAt) return '—';
        const ts = order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
        return ts.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // Helper: calculate summary of all dishes in a day's meal
    const getPrepSummary = (mealOrders: any[]) => {
        const counts: Record<string, number> = {};
        mealOrders.forEach(o => {
            o.items?.forEach((item: any) => {
                counts[item.name] = (counts[item.name] || 0) + (item.quantity || 0);
            });
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    return (
        <div className="min-h-screen bg-[#F5F3EF]">
            {/* Header */}
            <header className="bg-[#1A2D23] text-white p-4 md:p-6 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <h1 className="text-lg md:text-xl font-black">Incredibowl 管理后台</h1>
                            <p className="text-[10px] text-white/50 uppercase tracking-widest">Admin Dashboard</p>
                        </div>
                    </div>
                    <button onClick={loadData} disabled={loading} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
                {/* Stats Date Selector */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pt-2">
                    {statsDaysList.map((d) => (
                        <button
                            key={d.date}
                            onClick={() => setStatsDate(d.date)}
                            className={`px-4 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all border ${statsDate === d.date ? 'bg-[#1A2D23] text-white border-[#1A2D23] shadow-md scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">待确认</p>
                        <p className="text-3xl font-black text-yellow-600 relative">{pendingCount}</p>
                        <p className="text-[8px] text-gray-300 mt-1">需尽快处理</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{displayLabel} · 订单</p>
                        <p className="text-3xl font-black text-blue-600 relative">{upcomingOrdersCount}</p>
                        <p className="text-[8px] text-gray-300 mt-1">有效订单数</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{displayLabel} · 收入</p>
                        <p className="text-3xl font-black text-green-600 relative">RM {upcomingRevenue.toFixed(0)}</p>
                        <p className="text-[8px] text-gray-300 mt-1">预计营业额</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{displayLabel} · 客户</p>
                        <p className="text-3xl font-black text-[#FF6B35] relative">{upcomingCustomersCount}</p>
                        <p className="text-[8px] text-gray-300 mt-1">去重客户数</p>
                    </div>
                </div>

                {/* Upcoming Orders by Day - Lunch/Dinner Split */}
                {upcomingDays.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-[#1A2D23] flex items-center gap-2">📋 未来订单预览（按日/餐次）</h2>
                            <div className="flex gap-2">
                                {Object.keys(expandedSections).some(k => expandedSections[k]) ? (
                                    <button onClick={() => setExpandedSections({})} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">全部折叠</button>
                                ) : (
                                    <button onClick={() => {
                                        const allKeys: any = {};
                                        upcomingDays.forEach(d => { allKeys[d.dateStr] = true; allKeys[`${d.dateStr}-lunch`] = true; allKeys[`${d.dateStr}-dinner`] = true; });
                                        setExpandedSections(allKeys);
                                    }} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">全部展开</button>
                                )}
                            </div>
                        </div>

                        {upcomingDays.map(day => {
                            const { lunch, dinner } = splitMealTime(day.orders);
                            const isDayExpanded = expandedSections[day.dateStr];
                            return (
                                <div key={day.dateStr} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                                    <button
                                        onClick={() => toggleSection(day.dateStr)}
                                        className={`w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${isDayExpanded ? 'bg-[#1A2D23] text-white' : 'bg-white text-[#1A2D23]'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-sm">📅 {day.label}</span>
                                            {!isDayExpanded && (
                                                <div className="flex gap-1">
                                                    {lunch.length > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold">午 {lunch.length}</span>}
                                                    {dinner.length > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-bold">晚 {dinner.length}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xs font-bold ${isDayExpanded ? 'text-white/60' : 'text-gray-400'}`}>{day.orders.length} 单 · RM {day.orders.reduce((s: number, o: any) => s + (o.total || 0), 0).toFixed(0)}</span>
                                            <Clock size={16} className={`transition-transform duration-300 ${isDayExpanded ? 'rotate-180 text-white' : 'text-gray-300'}`} />
                                        </div>
                                    </button>

                                    {isDayExpanded && (
                                        <div className="divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {/* Lunch Section */}
                                            {lunch.length > 0 && (
                                                <div className="p-0">
                                                    <button
                                                        onClick={() => toggleSection(`${day.dateStr}-lunch`)}
                                                        className="w-full px-4 py-3 flex items-center justify-between bg-amber-50/50 hover:bg-amber-50 transition-colors"
                                                    >
                                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black flex items-center gap-2">🌞 午餐 ({lunch.length} 单)</span>
                                                        <Clock size={14} className={`text-amber-300 transition-transform ${expandedSections[`${day.dateStr}-lunch`] ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {expandedSections[`${day.dateStr}-lunch`] && (
                                                        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                                                            {/* Meal Summary */}
                                                            <div className="bg-[#1A2D23] text-white p-4 rounded-xl space-y-2">
                                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 mb-1"><ChefHat size={12} className="text-[#FF6B35]" /> 厨房备菜总结 (午餐)</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                                                    {getPrepSummary(lunch).map(([name, qty]) => (
                                                                        <div key={name} className="flex justify-between items-center text-xs py-1 border-b border-white/10 last:border-0 font-bold">
                                                                            <span className={name.includes('↳') ? 'text-white/50 pl-2' : ''}>{name}</span>
                                                                            <span className="text-[#FF6B35]">x{qty}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {lunch.map((o: any) => (
                                                                    <div key={o.id} className="bg-[#FDFBF7] rounded-xl border border-gray-100 overflow-hidden">
                                                                        <button
                                                                            onClick={() => toggleOrderExp(o.id)}
                                                                            className="w-full flex items-center justify-between text-sm px-4 py-2.5 hover:bg-gray-50 transition-colors"
                                                                        >
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${o.status === 'pending' ? 'bg-yellow-400' : o.status === 'confirmed' ? 'bg-blue-400' : o.status === 'preparing' ? 'bg-purple-400' : 'bg-green-400'}`} />
                                                                                <span className="font-bold text-[#1A2D23] truncate">{o.userName}</span>
                                                                                <span className="text-gray-400 text-[10px] shrink-0">{o.items?.length || 0} 项</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="font-black text-[#FF6B35] shrink-0">RM {(o.total || 0).toFixed(2)}</span>
                                                                                <Clock size={12} className={`text-gray-300 transition-transform ${expandedOrders[o.id] ? 'rotate-180' : ''}`} />
                                                                            </div>
                                                                        </button>
                                                                        {expandedOrders[o.id] && (
                                                                            <div className="px-4 pb-3 pt-1 border-t border-gray-50 bg-white/50 text-[11px] space-y-1">
                                                                                {o.items?.map((item: any, idx: number) => (
                                                                                    <div key={idx} className="flex justify-between">
                                                                                        <span className={item.name.includes('↳') ? 'text-gray-400 pl-3' : 'font-bold text-gray-600'}>{item.name} x{item.quantity}</span>
                                                                                        <span className="text-gray-300">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Dinner Section */}
                                            {dinner.length > 0 && (
                                                <div className="p-0">
                                                    <button
                                                        onClick={() => toggleSection(`${day.dateStr}-dinner`)}
                                                        className="w-full px-4 py-3 flex items-center justify-between bg-indigo-50/50 hover:bg-indigo-50 transition-colors border-t border-gray-100"
                                                    >
                                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black flex items-center gap-2">🌙 晚餐 ({dinner.length} 单)</span>
                                                        <Clock size={14} className={`text-indigo-300 transition-transform ${expandedSections[`${day.dateStr}-dinner`] ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {expandedSections[`${day.dateStr}-dinner`] && (
                                                        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                                                            {/* Meal Summary */}
                                                            <div className="bg-[#1A2D23] text-white p-4 rounded-xl space-y-2">
                                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 mb-1"><ChefHat size={12} className="text-[#FF6B35]" /> 厨房备菜总结 (晚餐)</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                                                    {getPrepSummary(dinner).map(([name, qty]) => (
                                                                        <div key={name} className="flex justify-between items-center text-xs py-1 border-b border-white/10 last:border-0 font-bold">
                                                                            <span className={name.includes('↳') ? 'text-white/50 pl-2' : ''}>{name}</span>
                                                                            <span className="text-[#FF6B35]">x{qty}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {dinner.map((o: any) => (
                                                                    <div key={o.id} className="bg-[#FDFBF7] rounded-xl border border-gray-100 overflow-hidden">
                                                                        <button
                                                                            onClick={() => toggleOrderExp(o.id)}
                                                                            className="w-full flex items-center justify-between text-sm px-4 py-2.5 hover:bg-gray-50 transition-colors"
                                                                        >
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${o.status === 'pending' ? 'bg-yellow-400' : o.status === 'confirmed' ? 'bg-blue-400' : o.status === 'preparing' ? 'bg-purple-400' : 'bg-green-400'}`} />
                                                                                <span className="font-bold text-[#1A2D23] truncate">{o.userName}</span>
                                                                                <span className="text-gray-400 text-[10px] shrink-0">{o.items?.length || 0} 项</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="font-black text-[#FF6B35] shrink-0">RM {(o.total || 0).toFixed(2)}</span>
                                                                                <Clock size={12} className={`text-gray-300 transition-transform ${expandedOrders[o.id] ? 'rotate-180' : ''}`} />
                                                                            </div>
                                                                        </button>
                                                                        {expandedOrders[o.id] && (
                                                                            <div className="px-4 pb-3 pt-1 border-t border-gray-50 bg-white/50 text-[11px] space-y-1">
                                                                                {o.items?.map((item: any, idx: number) => (
                                                                                    <div key={idx} className="flex justify-between">
                                                                                        <span className={item.name.includes('↳') ? 'text-gray-400 pl-3' : 'font-bold text-gray-600'}>{item.name} x{item.quantity}</span>
                                                                                        <span className="text-gray-300">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}


                {/* Tabs */}
                <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'orders' ? 'bg-[#1A2D23] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        <ShoppingBag size={16} /> 订单 ({orders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'customers' ? 'bg-[#1A2D23] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Users size={16} /> 客户 ({customers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('feedbacks')}
                        className={`px-5 py-2.5 shrink-0 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'feedbacks' ? 'bg-[#1A2D23] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        <MessageCircle size={16} /> 留言审批 ({feedbacks.length})
                    </button>
                </div>

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="space-y-4">
                        {/* Status Legend */}
                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center justify-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">状态对应:</span>
                            {[
                                { color: 'bg-yellow-400', label: '待确认' },
                                { color: 'bg-blue-400', label: '已确认' },
                                { color: 'bg-purple-400', label: '准备中' },
                                { color: 'bg-green-400', label: '已送达' },
                                { color: 'bg-red-400', label: '已取消' }
                            ].map(s => (
                                <div key={s.label} className="flex items-center gap-1.5 grayscale-[0.2]">
                                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                                    <span className="text-[11px] font-bold text-gray-500">{s.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            {['all', 'pending', 'confirmed', 'preparing', 'delivered', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterStatus === status ? 'bg-[#FF6B35] text-white' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
                                >
                                    {status === 'all' ? '全部' : STATUS_CONFIG[status as OrderStatus]?.labelCn || status}
                                </button>
                            ))}
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 outline-none"
                            />
                            {filterDate && (
                                <button onClick={() => setFilterDate('')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-500">清除日期</button>
                            )}
                        </div>

                        {/* Order List */}
                        {loading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">暂无订单</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredOrders.map((order: any) => {
                                    const statusConf = STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending;
                                    const StatusIcon = statusConf.icon;
                                    return (
                                        <div key={order.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                                            {/* Order Header */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-mono text-gray-400">#{order.id.slice(-6).toUpperCase()}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConf.color} flex items-center gap-1`}>
                                                            <StatusIcon size={10} /> {statusConf.labelCn}
                                                        </span>
                                                    </div>
                                                    <p className="font-black text-[#1A2D23]">{order.userName}</p>
                                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                                                        <span className="flex items-center gap-1"><Phone size={10} /> {order.userPhone}</span>
                                                        <span>📅 {order.deliveryDate}</span>
                                                        <span>⏰ {order.deliveryTime?.split('(')[0]?.trim()}</span>
                                                        <span className="text-gray-300">🕐 下单: {formatCreatedAt(order)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xl font-black text-[#FF6B35]">RM {(order.total || 0).toFixed(2)}</p>
                                            </div>

                                            {/* Items */}
                                            <div className="bg-[#F5F3EF] rounded-xl p-3 space-y-1">
                                                {order.items?.map((item: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-sm">
                                                        <span>{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                                        <span className="font-bold">RM {(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Address & Note */}
                                            <div className="flex items-start gap-2 text-xs text-gray-500">
                                                <MapPin size={12} className="shrink-0 mt-0.5" />
                                                <span>{order.userAddress}</span>
                                            </div>
                                            {order.note && (
                                                <div className="flex items-start gap-2 text-xs text-[#FF6B35]">
                                                    <FileText size={12} className="shrink-0 mt-0.5" />
                                                    <span className="font-bold">备注: {order.note}</span>
                                                </div>
                                            )}

                                            {/* Payment & Promo Info */}
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                <span className={`px-2 py-1 rounded-lg font-bold ${order.paymentMethod === 'qr' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {order.paymentMethod === 'qr' ? '💳 DuitNow QR' : '🏦 FPX/Card'}
                                                </span>
                                                {order.receiptUploaded && order.receiptUrl ? (
                                                    <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors">📷 查看凭证</a>
                                                ) : order.receiptUploaded ? (
                                                    <span className="px-2 py-1 rounded-lg font-bold bg-green-100 text-green-700">📷 已上传凭证</span>
                                                ) : null}
                                                {!order.receiptUploaded && order.paymentMethod === 'qr' && (
                                                    <span className="px-2 py-1 rounded-lg font-bold bg-red-100 text-red-600">⚠️ 未上传凭证</span>
                                                )}
                                                {order.promoCode && (
                                                    <span className="px-2 py-1 rounded-lg font-bold bg-yellow-100 text-yellow-700">🏷️ {order.promoCode} (-RM{(order.promoDiscount || 0).toFixed(0)})</span>
                                                )}
                                            </div>
                                            {order.promoCode && order.originalTotal && (
                                                <p className="text-[10px] text-gray-400">原价 RM {order.originalTotal.toFixed(2)} → 优惠后 RM {(order.total || 0).toFixed(2)}</p>
                                            )}

                                            {/* Quick Actions */}
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                                {order.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(order, 'confirmed')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center gap-1">
                                                            <CheckCircle size={12} /> 确认付款
                                                        </button>
                                                        <button onClick={() => handleStatusChange(order, 'cancelled')} className="px-4 py-2 bg-red-100 text-red-500 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-1">
                                                            <XCircle size={12} /> 取消
                                                        </button>
                                                    </>
                                                )}
                                                {order.status === 'confirmed' && (
                                                    <button onClick={() => handleStatusChange(order, 'preparing')} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-xs font-bold hover:bg-purple-600 flex items-center gap-1">
                                                        <ChefHat size={12} /> 开始准备
                                                    </button>
                                                )}
                                                {order.status === 'preparing' && (
                                                    <button onClick={() => handleStatusChange(order, 'delivered')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 flex items-center gap-1">
                                                        <Truck size={12} /> 已送达
                                                    </button>
                                                )}
                                                <a href={`https://wa.me/${order.userPhone?.replace(/[^0-9]/g, '').replace(/^0/, '60')}`} target="_blank" className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 flex items-center gap-1">
                                                    💬 WhatsApp
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Customers Tab */}
                {activeTab === 'customers' && (
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : customers.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">暂无客户</p>
                            </div>
                        ) : (
                            customers.map((user: any) => (
                                <div key={user.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-black text-[#1A2D23]">{user.displayName || 'Guest'}</p>
                                            <p className="text-xs text-gray-400">{user.email}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                {user.phone && <span className="flex items-center gap-1"><Phone size={10} /> {user.phone}</span>}
                                                {user.address && <span className="flex items-center gap-1"><MapPin size={10} /> {user.address}</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-[#FF6B35]">{user.points || 0} 积分</p>
                                            <p className="text-[10px] text-gray-400">{user.totalOrders || 0} 单 · RM {(user.totalSpent || 0).toFixed(0)}</p>
                                        </div>
                                    </div>
                                    {user.phone && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <a href={`https://wa.me/${user.phone?.replace(/[^0-9]/g, '').replace(/^0/, '60')}`} target="_blank" className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 inline-flex items-center gap-1">
                                                💬 WhatsApp
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Feedbacks Tab */}
                {activeTab === 'feedbacks' && (
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin w-8 h-8 border-4 border-[#FF6B35] border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : feedbacks.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">暂无留言</p>
                            </div>
                        ) : (
                            feedbacks.map((fb) => (
                                <div key={fb.id} className={`bg-white rounded-2xl p-5 border shadow-sm transition-colors ${fb.status === 'PENDING' ? 'border-yellow-300 bg-[#FFFAEB]' : 'border-gray-100'}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${fb.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                    {fb.status === 'PENDING' ? <><Clock size={10} /> 待审核 (Pending)</> : <><CheckCircle size={10} /> 已发布 (Approved)</>}
                                                </span>
                                                <span className="text-xs text-gray-400">{new Date(fb.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="font-black text-[#1A2D23] text-lg">{fb.name}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/50 rounded-xl p-4 border border-black/5 mb-4">
                                        <p className="text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">{fb.text}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {fb.status === 'PENDING' ? (
                                            <button onClick={async () => { await updateFeedbackStatus(fb.id!, 'APPROVED'); loadData(); }} className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 flex items-center gap-1 transition-transform active:scale-95">
                                                <CheckCircle size={14} /> 批准发布
                                            </button>
                                        ) : (
                                            <button onClick={async () => { await updateFeedbackStatus(fb.id!, 'PENDING'); loadData(); }} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-xs font-bold hover:bg-yellow-600 flex items-center gap-1 transition-transform active:scale-95">
                                                <Clock size={14} /> 撤下 (改为待审核)
                                            </button>
                                        )}
                                        <button onClick={async () => { if (window.confirm('确定要彻底删除这条留言吗？此操作不可恢复。')) { await deleteFeedback(fb.id!); loadData(); } }} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-1 transition-transform active:scale-95">
                                            <Trash2 size={14} /> 删除
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
