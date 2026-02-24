"use client";

import React, { useState, useEffect } from 'react'
import { ShoppingBag, Star, X, Plus, Minus, Trash2, Leaf, ShieldCheck, Microscope, Thermometer, Droplets, UtensilsCrossed, Phone } from 'lucide-react'

// Data models
const dailySpecial = {
    id: 1,
    name: "山药排骨饭",
    nameEn: "Vitality Bone Broth Bowl",
    description: "Clean Carbs + Lean Protein. Designed for cognitive performance and zero afternoon crash.",
    price: 28,
    image: "🍱",
    macros: { carb: "45g", protein: "32g", fat: "12g", cal: "420kcal" },
    ingredients: [
        { name: "Japanese Nagaimo", source: "Cameron Highlands", benefit: "Digestive Health" },
        { name: "Iberico Spare Ribs", source: "Sustainable Farm", benefit: "Essential Amino Acids" },
        { name: "Jasmine Brown Rice", source: "Local Paddy", benefit: "Slow Release Energy" }
    ]
}

const drinks = [
    { id: 201, name: "Longjing Cold Brew", price: 4.5, image: "🍵", note: "Antioxidant Rich" },
    { id: 202, name: "Tie Guanyin Oolong", price: 4.5, image: "🍵", note: "Metabolism Boost" },
    { id: 203, name: "Aged Shui Xian", price: 4.5, image: "🍵", note: "Digestion Support" }
]

function ModernNatural() {
    const [cart, setCart] = useState<any[]>([])
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const addToCart = (item: any, options: any = {}) => {
        setCart(prev => {
            const cartItemId = options.ice !== undefined ? `${item.id}-${options.ice}` : item.id
            const existing = prev.find((i: any) => i.cartItemId === cartItemId)
            if (existing) {
                return prev.map((i: any) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, { ...item, cartItemId, quantity: 1, ...options }]
        })
        setIsCartOpen(true)
    }

    const removeFromCart = (cartItemId: any) => {
        setCart(prev => prev.filter((i: any) => i.cartItemId !== cartItemId))
    }

    const updateQuantity = (cartItemId: any, delta: number) => {
        setCart(prev => prev.map((item: any) => {
            if (item.cartItemId === cartItemId) {
                const newQty = item.quantity + delta
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter((item: any) => item.quantity > 0))
    }

    const cartTotal = cart.reduce((sum, item: any) => sum + item.price * item.quantity, 0)
    const cartCount = cart.reduce((sum, item: any) => sum + item.quantity, 0)

    return (
        <div className="min-h-screen bg-white font-sans text-[#2D3142]">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Outfit:wght@300;500;700;900&display=swap');
        h1, h2, h3 { font-family: 'Outfit', sans-serif; }
        body { font-family: 'Inter', sans-serif; }
      `}</style>

            {/* Navigation */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl border-b border-[#4F6D7A]/10 py-4' : 'bg-transparent py-8'}`}>
                <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#4F6D7A] rounded-full flex items-center justify-center p-2">
                            <Leaf className="text-white w-full h-full" />
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter text-[#4F6D7A]">Incredibowl</h1>
                    </div>

                    <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-3 px-6 py-3 bg-[#4F6D7A] text-white rounded-full font-bold text-sm hover:translate-y-[-2px] transition-transform shadow-lg shadow-[#4F6D7A]/20 group">
                        <ShoppingBag size={18} className="group-hover:rotate-12 transition-transform" />
                        <span>Bag</span>
                        {cartCount > 0 && <span className="bg-white text-[#4F6D7A] px-2 rounded-md text-[10px]">{cartCount}</span>}
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-48 pb-32">
                <div className="max-w-7xl mx-auto px-8 grid lg:grid-cols-2 gap-24 items-center">
                    <div className="space-y-12">
                        <div className="space-y-6">
                            <span className="text-[#4F6D7A] font-black uppercase tracking-[0.3em] text-xs">Purity in every bowl</span>
                            <h1 className="text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter text-[#2D3142]">
                                Zero <span className="text-[#4F6D7A]">MSG.</span><br />
                                Pure <span className="text-[#4F6D7A]">Taste.</span>
                            </h1>
                        </div>
                        <p className="text-xl text-gray-500 max-w-lg leading-relaxed font-light">
                            We leverage tradition to optimize performance. Clean ingredients, scientifically balanced, home-cooked in Old Klang Road.
                        </p>
                        <div className="flex items-center gap-12">
                            {Object.entries(dailySpecial.macros).map(([k, v]) => (
                                <div key={k}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{k}</p>
                                    <p className="text-xl font-bold text-[#4F6D7A]">{v}</p>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => document.getElementById('bowl')?.scrollIntoView({ behavior: 'smooth' })}
                            className="px-12 py-5 border-2 border-[#4F6D7A] text-[#4F6D7A] rounded-full font-black text-lg hover:bg-[#4F6D7A] hover:text-white transition-all shadow-xl shadow-[#4F6D7A]/5"
                        >
                            Order Performance Fuel
                        </button>
                    </div>
                    <div className="relative group">
                        <div className="w-full aspect-square bg-[#EAE6E1] rounded-[80px] flex items-center justify-center text-[20rem] shadow-none group-hover:shadow-[0_40px_100px_rgba(79,109,122,0.15)] transition-all duration-700">
                            <span className="group-hover:scale-105 transition-transform duration-700">{dailySpecial.image}</span>
                        </div>
                        <div className="absolute -bottom-10 -right-10 p-10 bg-white rounded-[40px] shadow-2xl border border-gray-100 flex flex-col gap-4">
                            <ShieldCheck className="text-green-500 w-8 h-8" />
                            <p className="font-bold text-sm leading-tight text-gray-400">Certified Anti-Slump<br />Technology</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Ingredient transparency board */}
            <section id="bowl" className="py-32 bg-[#F7F9F9]">
                <div className="max-w-7xl mx-auto px-8">
                    <div className="text-center mb-24">
                        <h2 className="text-5xl font-black mb-6">Transparency Board</h2>
                        <p className="text-gray-400 font-light text-xl">Every component in your bowl has a purpose.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 mb-20">
                        {dailySpecial.ingredients.map((ing, i) => (
                            <div key={i} className="bg-white p-12 rounded-[48px] border border-gray-100 space-y-8 hover:translate-y-[-8px] transition-transform">
                                <div className="w-16 h-1 w-16 bg-[#4F6D7A]/20" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#4F6D7A] mb-2">{ing.source}</p>
                                    <h3 className="text-3xl font-black mb-4">{ing.name}</h3>
                                    <p className="text-gray-400 text-sm font-medium italic">Benefit: {ing.benefit}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-[#2D3142] rounded-[64px] p-12 md:p-24 text-white flex flex-col md:flex-row items-center gap-16">
                        <div className="text-[12rem] flex-shrink-0">{dailySpecial.image}</div>
                        <div className="space-y-10">
                            <h3 className="text-4xl md:text-6xl font-black italic">Next Generation Comfort Food.</h3>
                            <p className="text-xl text-white/50 leading-relaxed max-w-xl">
                                {dailySpecial.description} Pure Japanese nagaimo for cognitive support and slow-braised ribs for physical repair.
                            </p>
                            <div className="flex items-center justify-between pt-10 border-t border-white/10">
                                <span className="text-6xl font-black tracking-tighter">RM {dailySpecial.price}</span>
                                <button
                                    onClick={() => addToCart(dailySpecial)}
                                    className="px-12 py-5 bg-white text-[#2D3142] rounded-full font-black text-xl hover:scale-105 transition-transform"
                                >
                                    Add to Fuel Bag
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tea Section */}
            <section className="py-32 bg-white">
                <div className="max-w-7xl mx-auto px-8 grid lg:grid-cols-2 gap-24 items-center">
                    <div className="order-2 lg:order-1 relative">
                        <div className="w-full aspect-square bg-[#C0D6DF]/30 rounded-[80px] flex items-center justify-center text-[18rem]">🍵</div>
                        <div className="absolute top-10 right-10 flex flex-col gap-4">
                            {[Microscope, Thermometer, Droplets].map((Icon, i) => (
                                <div key={i} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg"><Icon size={20} className="text-[#4F6D7A]" /></div>
                            ))}
                        </div>
                    </div>
                    <div className="order-1 lg:order-2 space-y-12">
                        <h2 className="text-6xl font-black tracking-tight leading-none">Caffeine, <br /><span className="text-[#4F6D7A]">Refined.</span></h2>
                        <div className="space-y-6">
                            {drinks.map(drink => (
                                <div key={drink.id} className="group p-8 border-b-2 border-gray-100 flex justify-between items-center hover:bg-[#F7F9F9] transition-colors rounded-2xl">
                                    <div className="flex items-center gap-8">
                                        <span className="text-4xl">{drink.image}</span>
                                        <div>
                                            <h4 className="font-bold text-2xl">{drink.name}</h4>
                                            <p className="text-[10px] font-black uppercase text-gray-300 tracking-[0.2em] mt-1">{drink.note}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => addToCart(drink, { ice: true })} className="px-6 py-3 bg-white border border-gray-200 rounded-full font-bold text-xs hover:border-[#4F6D7A] transition-all">Iced</button>
                                        <button onClick={() => addToCart(drink, { ice: false })} className="px-6 py-3 bg-white border border-gray-200 rounded-full font-bold text-xs hover:border-[#4F6D7A] transition-all">Hot</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-32 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-[#4F6D7A] rounded-full" />
                        <h3 className="text-xl font-black uppercase tracking-tighter">Incredibowl</h3>
                    </div>
                    <div className="flex gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">
                        <span>Purity</span>
                        <span>Transparency</span>
                        <span>Performance</span>
                    </div>
                    <p className="text-gray-300 text-xs">&copy; 2026 Crafted in Old Klang Road.</p>
                </div>
            </footer>

            {/* Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-[#264653]/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsCartOpen(false)} />
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        <div className="p-12 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-3xl font-black tracking-tighter uppercase">Fuel Bag ({cartCount})</h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-3 bg-[#F7F9F9] rounded-full hover:scale-110 transition-transform"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 space-y-12">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 opacity-20">
                                    <UtensilsCrossed className="w-16 h-16 mx-auto mb-6" />
                                    <p className="font-bold text-sm tracking-widest uppercase">Bag is currently empty</p>
                                </div>
                            ) : (
                                cart.map((item, i) => (
                                    <div key={item.cartItemId} className="flex gap-8 group animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className="w-20 h-20 bg-[#F7F9F9] rounded-[24px] flex items-center justify-center text-4xl">{item.image}</div>
                                        <div className="flex-1 space-y-2">
                                            <h4 className="font-black text-lg uppercase tracking-tight">{item.name} {item.ice !== undefined && <span className="text-[10px] text-[#4F6D7A] border border-[#4F6D7A]/20 px-2 py-0.5 rounded-full ml-2">{item.ice ? 'ICED' : 'HOT'}</span>}</h4>
                                            <p className="text-[#4F6D7A] font-bold">RM {item.price}</p>
                                            <div className="flex items-center gap-6 mt-4">
                                                <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:text-[#4F6D7A] transition-colors"><Minus size={16} /></button>
                                                <span className="font-bold text-sm">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.cartItemId, 1)} className="p-1 hover:text-[#4F6D7A] transition-colors"><Plus size={16} /></button>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(item.cartItemId)} className="text-gray-200 hover:text-red-400 transition-colors self-start"><Trash2 size={20} /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="p-12 bg-[#F7F9F9] border-t border-gray-100 space-y-10">
                                <div className="flex justify-between items-baseline">
                                    <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest">Grand Total</h3>
                                    <p className="text-5xl font-black text-[#2D3142] tracking-tighter">RM {cartTotal}</p>
                                </div>
                                <button className="w-full py-6 bg-[#2D3142] text-white rounded-full font-black text-xl hover:translate-y-[-4px] transition-transform shadow-2xl shadow-[#2D3142]/20 flex items-center justify-center gap-6">
                                    <Phone size={24} /> Dispatch Order →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ModernNatural
