"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Leaf, ArrowLeft, CreditCard, Truck, ShieldCheck, CheckCircle2, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutPage() {
    const router = useRouter()
    const [cart, setCart] = useState<any[]>([])
    const [user, setUser] = useState<any>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const [formData, setFormData] = useState({
        address: '',
        unit: '',
        city: 'Kuala Lumpur',
        postalCode: '',
        cardNumber: '',
        expiry: '',
        cvv: ''
    })

    useEffect(() => {
        const storedCart = localStorage.getItem('incredibowl_cart')
        const storedUser = localStorage.getItem('incredibowl_user')

        if (storedCart) setCart(JSON.parse(storedCart))
        if (storedUser) setUser(JSON.parse(storedUser))
        else router.push('/login') // Must be logged in to checkout
    }, [router])

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const handleCheckout = (e: React.FormEvent) => {
        e.preventDefault()
        setIsProcessing(true)

        // Simulate payment processing
        setTimeout(() => {
            const newOrder = {
                id: `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                date: new Date().toISOString(),
                items: cart,
                total: cartTotal,
                address: formData.address,
                status: 'Delivering'
            }

            // Save to history
            const history = JSON.parse(localStorage.getItem('incredibowl_orders') || '[]')
            localStorage.setItem('incredibowl_orders', JSON.stringify([newOrder, ...history]))

            // Clear cart
            localStorage.removeItem('incredibowl_cart')

            setIsProcessing(false)
            setIsSuccess(true)
        }, 2000)
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-white font-sans text-[#2D3142] flex flex-col items-center justify-center p-8 space-y-10">
                <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                    <CheckCircle2 className="text-green-500 w-16 h-16" />
                </div>
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-black tracking-tighter">Fuel Dispatched.</h1>
                    <p className="text-gray-400 font-medium max-w-sm">
                        Your performance meal is being prepared in Old Klang Road and will arrive shortly.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                    <Link href="/account" className="flex-1 py-5 bg-[#4F6D7A] text-white rounded-3xl font-black text-sm text-center shadow-xl shadow-[#4F6D7A]/20">Track Order</Link>
                    <Link href="/" className="flex-1 py-5 bg-[#F7F9F9] text-[#4F6D7A] rounded-3xl font-black text-sm text-center">Back to Home</Link>
                </div>
            </div>
        )
    }

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
                    <span className="font-black uppercase tracking-widest text-[10px]">Back to Market</span>
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#4F6D7A] rounded-full flex items-center justify-center p-1.5">
                        <Leaf className="text-white w-full h-full" />
                    </div>
                    <h1 className="text-xl font-black uppercase tracking-tighter text-[#4F6D7A]">Incredibowl</h1>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-8 py-12 grid lg:grid-cols-2 gap-20">
                <div className="space-y-12">
                    <div className="space-y-4">
                        <h2 className="text-5xl font-black tracking-tight leading-none">Confirm <br /><span className="text-[#4F6D7A]">Dispatch.</span></h2>
                        <p className="text-gray-400 font-medium italic">Enter your details to finalize your subscription to peak performance.</p>
                    </div>

                    <form onSubmit={handleCheckout} className="space-y-10">
                        {/* Delivery Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Truck className="text-[#4F6D7A]" size={20} />
                                <h3 className="text-xl font-black uppercase tracking-tight">Delivery Hub</h3>
                            </div>
                            <div className="grid gap-4">
                                <input
                                    type="text"
                                    placeholder="Delivery Address"
                                    required
                                    className="w-full px-8 py-5 bg-white rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Unit / Floor"
                                        className="w-full px-8 py-5 bg-white rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Postal Code"
                                        required
                                        className="w-full px-8 py-5 bg-white rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                        value={formData.postalCode}
                                        onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <CreditCard className="text-[#4F6D7A]" size={20} />
                                <h3 className="text-xl font-black uppercase tracking-tight">Secure Payment</h3>
                            </div>
                            <div className="grid gap-4 bg-white p-8 rounded-[40px] border border-gray-100">
                                <input
                                    type="text"
                                    placeholder="Card Number"
                                    required
                                    className="w-full px-8 py-5 bg-[#F7F9F9] rounded-[24px] border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                    value={formData.cardNumber}
                                    onChange={e => setFormData({ ...formData, cardNumber: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="MM/YY"
                                        required
                                        className="w-full px-8 py-5 bg-[#F7F9F9] rounded-[24px] border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                        value={formData.expiry}
                                        onChange={e => setFormData({ ...formData, expiry: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="CVV"
                                        required
                                        className="w-full px-8 py-5 bg-[#F7F9F9] rounded-[24px] border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                        value={formData.cvv}
                                        onChange={e => setFormData({ ...formData, cvv: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-4 justify-center">
                                    <ShieldCheck size={14} className="text-green-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Encrypted Transition</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isProcessing || cart.length === 0}
                            className="w-full py-8 bg-[#2D3142] text-white rounded-[40px] font-black text-xl hover:translate-y-[-4px] transition-transform shadow-2xl shadow-[#2D3142]/20 flex items-center justify-center gap-4 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {isProcessing ? (
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Authorize Order - RM {cartTotal}</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Summary Sidebar */}
                <div className="lg:pl-12">
                    <div className="bg-white rounded-[64px] p-12 space-y-10 border border-gray-100 shadow-xl shadow-[#4F6D7A]/5 sticky top-32">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Fuel Summary</h3>
                            <ShoppingBag className="text-[#4F6D7A]" />
                        </div>

                        <div className="space-y-8 max-h-[40vh] overflow-y-auto pr-4 no-scrollbar">
                            {cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 50}ms` }}>
                                    <div className="flex gap-4 items-center">
                                        <div className="w-14 h-14 bg-[#F7F9F9] rounded-2xl flex items-center justify-center text-2xl">{item.image}</div>
                                        <div>
                                            <p className="font-bold text-sm leading-tight">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Qty: {item.quantity}</p>
                                        </div>
                                    </div>
                                    <p className="font-black text-sm text-[#4F6D7A]">RM {item.price * item.quantity}</p>
                                </div>
                            ))}
                            {cart.length === 0 && <p className="text-center text-gray-300 font-bold italic py-8">Bag is empty</p>}
                        </div>

                        <div className="space-y-4 pt-10 border-t border-gray-100">
                            <div className="flex justify-between text-xs font-bold text-gray-400">
                                <span>Subtotal</span>
                                <span>RM {cartTotal}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-gray-400">
                                <span>Dispatch Fee</span>
                                <span className="text-green-500 uppercase">Free</span>
                            </div>
                            <div className="flex justify-between items-baseline pt-4">
                                <span className="text-sm font-black uppercase tracking-widest">Grand Total</span>
                                <span className="text-4xl font-black tracking-tighter">RM {cartTotal}</span>
                            </div>
                        </div>

                        <div className="bg-[#4F6D7A]/5 p-8 rounded-[32px] space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4F6D7A]">Incredibowl Promise</p>
                            <p className="text-xs text-[#4F6D7A]/60 font-medium leading-relaxed">
                                Zero MSG. Slow-cooked. Performance-guaranteed. Delivered from Old Klang Road.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
