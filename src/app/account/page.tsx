"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Leaf, ArrowLeft, LogOut, Package, Clock, MapPin, ChevronRight, User } from 'lucide-react'
import Link from 'next/link'

export default function AccountPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])

    useEffect(() => {
        const storedUser = localStorage.getItem('incredibowl_user')
        const storedOrders = localStorage.getItem('incredibowl_orders')

        if (storedUser) setUser(JSON.parse(storedUser))
        else router.push('/login')

        if (storedOrders) setOrders(JSON.parse(storedOrders))
    }, [router])

    const handleLogout = () => {
        localStorage.removeItem('incredibowl_user')
        router.push('/')
    }

    if (!user) return null

    return (
        <div className="min-h-screen bg-[#F7F9F9] font-sans text-[#2D3142]">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Outfit:wght@300;500;700;900&display=swap');
                h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; }
                body { font-family: 'Inter', sans-serif; }
            `}</style>

            <nav className="p-8 max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/" className="flex items-center gap-4 group">
                    <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-black uppercase tracking-widest text-[10px]">Marketplace</span>
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#4F6D7A] rounded-full flex items-center justify-center p-1.5">
                        <Leaf className="text-white w-full h-full" />
                    </div>
                    <h1 className="text-xl font-black uppercase tracking-tighter text-[#4F6D7A]">Incredibowl</h1>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-8 py-12 space-y-16">
                {/* Profile Header */}
                <div className="bg-white rounded-[64px] p-12 flex flex-col md:flex-row items-center justify-between gap-8 border border-gray-100 shadow-xl shadow-[#4F6D7A]/5">
                    <div className="flex items-center gap-8">
                        <div className="w-24 h-24 bg-[#EAE6E1] rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-lg">
                            🍱
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight">{user.name}</h2>
                            <p className="text-gray-400 font-medium">{user.email}</p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase tracking-widest text-[#4F6D7A]">
                                <Clock size={12} />
                                Member since Feb 2026
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-8 py-4 bg-[#F7F9F9] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-3xl font-black text-xs uppercase tracking-widest flex items-center gap-3"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>

                {/* Purchase History */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-3xl font-black tracking-tight">Purchase <span className="text-[#4F6D7A]">History.</span></h3>
                        <span className="bg-[#4F6D7A]/10 text-[#4F6D7A] px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {orders.length} Orders
                        </span>
                    </div>

                    <div className="space-y-6">
                        {orders.map((order, i) => (
                            <div key={order.id} className="bg-white rounded-[48px] p-10 border border-gray-100 hover:border-[#4F6D7A]/20 transition-all group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#4F6D7A]/5 rounded-bl-[100px] -z-0 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="relative z-10 space-y-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-50 pb-8">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Transaction ID</p>
                                            <p className="font-black text-xl text-[#4F6D7A]">{order.id}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Dispatch Date</p>
                                            <p className="font-bold text-sm">{new Date(order.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Status</p>
                                            <span className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-right">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Total Fuel</p>
                                            <p className="text-2xl font-black tracking-tighter">RM {order.total}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                            {order.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex-shrink-0 flex items-center gap-3 bg-[#F7F9F9] p-3 rounded-2xl pr-6 border border-transparent hover:border-[#4F6D7A]/10 transition-colors">
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">{item.image}</div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-tight">{item.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold">Qty: {item.quantity}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Link href={`/`} className="flex-shrink-0 flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-[#4F6D7A] hover:gap-6 transition-all">
                                            Re-order Fuel <ChevronRight size={14} />
                                        </Link>
                                    </div>

                                    <div className="flex items-center gap-3 pt-6 text-gray-400">
                                        <MapPin size={14} className="text-[#4F6D7A]" />
                                        <p className="text-[10px] font-bold italic truncate max-w-md">{order.address}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {orders.length === 0 && (
                            <div className="bg-white rounded-[48px] p-24 text-center space-y-6 border border-dashed border-gray-200">
                                <Package className="mx-auto text-gray-200" size={64} />
                                <div className="space-y-2">
                                    <p className="text-xl font-black">No Fuel Records Yet.</p>
                                    <p className="text-gray-400 text-sm max-w-xs mx-auto">Your performance journey starts with your first clean bowl.</p>
                                </div>
                                <Link href="/" className="inline-block px-12 py-5 bg-[#4F6D7A] text-white rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-[#4F6D7A]/10">Browse Marketplace</Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
