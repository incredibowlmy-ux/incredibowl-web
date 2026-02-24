"use client";

import React, { useState, useEffect } from 'react';
import { onAuthChange } from '@/lib/auth';
import { getAllOrders, updateOrderStatus, getAllUsers, OrderStatus } from '@/lib/orders';
import { User } from 'firebase/auth';
import { ShoppingBag, Users, CheckCircle, Clock, Truck, XCircle, ChefHat, RefreshCw, ArrowLeft, Phone, MapPin, FileText } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');
    const [orders, setOrders] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');

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
            const [ordersData, usersData] = await Promise.all([
                getAllOrders(),
                getAllUsers(),
            ]);
            setOrders(ordersData);
            setCustomers(usersData);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
        setLoading(false);
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        try {
            await updateOrderStatus(orderId, newStatus);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
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

    if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email || '')) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
                <div className="text-center space-y-4 max-w-sm">
                    <div className="text-6xl">🔒</div>
                    <h1 className="text-2xl font-black text-[#1A2D23]">管理后台</h1>
                    <p className="text-gray-500 text-sm">
                        {currentUser ? `${currentUser.email} 没有管理员权限` : '请先登录管理员帐号'}
                    </p>
                    <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors">
                        <ArrowLeft size={16} /> 返回首页
                    </Link>
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

    // Stats
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const tomorrowOrders = orders.filter(o => o.deliveryDate === tomorrowStr);
    const todayRevenue = orders.filter(o => o.deliveryDate === todayStr && o.status !== 'cancelled').reduce((sum: number, o: any) => sum + (o.total || 0), 0);

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
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">待确认</p>
                        <p className="text-3xl font-black text-yellow-600">{pendingCount}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">明日订单</p>
                        <p className="text-3xl font-black text-blue-600">{tomorrowOrders.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">今日收入</p>
                        <p className="text-3xl font-black text-green-600">RM {todayRevenue.toFixed(0)}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">总客户</p>
                        <p className="text-3xl font-black text-[#FF6B35]">{customers.length}</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'orders' ? 'bg-[#1A2D23] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        <ShoppingBag size={16} /> 订单 ({orders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('customers')}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'customers' ? 'bg-[#1A2D23] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Users size={16} /> 客户 ({customers.length})
                    </button>
                </div>

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="space-y-4">
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
                                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                                        <span className="flex items-center gap-1"><Phone size={10} /> {order.userPhone}</span>
                                                        <span>📅 {order.deliveryDate}</span>
                                                        <span>⏰ {order.deliveryTime?.split('(')[0]?.trim()}</span>
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

                                            {/* Quick Actions */}
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                                {order.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(order.id, 'confirmed')} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center gap-1">
                                                            <CheckCircle size={12} /> 确认付款
                                                        </button>
                                                        <button onClick={() => handleStatusChange(order.id, 'cancelled')} className="px-4 py-2 bg-red-100 text-red-500 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center gap-1">
                                                            <XCircle size={12} /> 取消
                                                        </button>
                                                    </>
                                                )}
                                                {order.status === 'confirmed' && (
                                                    <button onClick={() => handleStatusChange(order.id, 'preparing')} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-xs font-bold hover:bg-purple-600 flex items-center gap-1">
                                                        <ChefHat size={12} /> 开始准备
                                                    </button>
                                                )}
                                                {order.status === 'preparing' && (
                                                    <button onClick={() => handleStatusChange(order.id, 'delivered')} className="px-4 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 flex items-center gap-1">
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
            </div>
        </div>
    );
}
