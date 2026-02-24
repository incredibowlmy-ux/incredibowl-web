"use client";

import Image from "next/image";
import Link from 'next/link';
import React, { useState, useEffect } from 'react'
import { ShoppingBag, Star, Clock, Phone, X, Plus, Minus, Trash2, Heart, Award, Utensils, BookOpen, Coffee, MessageCircle, Sparkles, User } from 'lucide-react'
import AuthModal from '@/components/auth/AuthModal';
import CartDrawer from '@/components/cart/CartDrawer';

// Data models - Weekly Menu
const weeklyMenu = [
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Golden Crispy Chicken Chop",
        description: "Pan-seared to perfection with just salt and pepper. Simple, clean, and incredibly satisfying.",
        price: 19.90,
        image: "/chicken_chop.png",
        story: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。",
        benefits: "优质蛋白质，补充周一活力。"
    },
    {
        id: 2,
        day: "Tue / 周二",
        name: "山药云耳海陆双鲜小炒",
        nameEn: "Surf & Turf Yam Stir-fry",
        description: "Nourishing yam and wood ear mushroom tossed with fresh seafood and meat.",
        price: 22.90,
        image: "🥘",
        story: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。",
        benefits: "健脾益胃，清肺润燥。"
    },
    {
        id: 3,
        day: "Wed / 周三",
        name: "招牌当归回味蒸鸡全腿",
        nameEn: "Signature Angelica Chicken",
        description: "Our #1 best-seller. Infused with premium herbs for a soul-warming recovery meal.",
        price: 26.90,
        image: "/angelica_chicken.png",
        story: "阿姨拿手好戏。当归香渗进鸡肉，喝一口汤，魂都暖了。",
        benefits: "补血活血，调经止痛，增强免疫。"
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖五花肉",
        nameEn: "Home-style Pork & Potato Stew",
        description: "Melt-in-your-mouth pork belly slow-cooked with organic potatoes.",
        price: 21.90,
        image: "🥘",
        story: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。",
        benefits: "能量补给，暖胃暖心。"
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡腿汤",
        nameEn: "Scallion Pan-fried Chicken Soup",
        description: "A clear, fragrant broth that marks the perfect end to a productive week.",
        price: 23.90,
        image: "🍲",
        story: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。",
        benefits: "清淡排毒，平衡周五心态。"
    }
]

const drinks = [
    { id: 201, name: "Garden Longjing / 西湖龙井", price: 4.5, image: "🍵", mood: "阿姨亲选手摘原叶" },
    { id: 202, name: "Honey Tie Guanyin / 安溪铁观音", price: 4.5, image: "🍵", mood: "香气悠长，回味甘甜" },
    { id: 203, name: "Warm Shui Xian / 岩韵水仙", price: 4.5, image: "🍵", mood: "醇厚岩韵，暖胃生津" }
]

const diaryEntries = [
    { time: "06:30 AM", event: "巴刹选肉", detail: "今天食材很正，山药也很粉糯。" },
    { time: "09:00 AM", event: "慢火熬制", detail: "慢火4小时，原汁原味已经出来了。" },
    { time: "11:30 AM", event: "准时配送", detail: "香气在厨房里飘，准备送到你们桌上。" }
]

export default function GrandmaKitchen() {
    const [cart, setCart] = useState<any[]>([])
    const [activeDish, setActiveDish] = useState(weeklyMenu[2]) // Wed is the star

    const [deliveryDate, setDeliveryDate] = useState("")
    const [deliveryTime, setDeliveryTime] = useState("Lunch (12:00 PM)")
    const [isAuthOpen, setIsAuthOpen] = useState(false)
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
            return [...prev, { ...item, cartItemId, quantity: 1, ...options, selectedDate: deliveryDate, selectedTime: deliveryTime }]
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
    const freeDelivery = cartCount >= 10

    return (
        <div className="min-h-screen bg-[#FAF9F6] font-[serif] text-[#5D4037]">
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&family=Noto+Serif+SC:wght@400;700;900&display=swap');
        h1, h2, h3 { font-family: 'Noto Serif SC', serif; }
        body { font-family: 'Noto Serif SC', serif; }
      `}</style>

            {/* Navigation */}
            <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-[#B04A33]/10 py-3' : 'bg-transparent py-6'}`}>
                <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-[#B04A33]/10 hover:scale-105 transition-transform duration-300">
                            <Image src="/logo_hd.png" alt="Incredibowl Logo" width={64} height={64} className="scale-110" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-[#B04A33]">阿姨的厨房</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4A373]">Incredibowl.my</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={() => setIsAuthOpen(true)} className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#B04A33]/5 rounded-full border border-[#B04A33]/10 hover:bg-[#B04A33]/10 transition-colors">
                            <User size={16} className="text-[#B04A33]" />
                            <span className="text-xs font-bold text-[#5D4037]">登录 / 邻里会员</span>
                        </button>
                        <button onClick={() => setIsCartOpen(true)} className="relative p-4 bg-white rounded-2xl shadow-sm border border-[#B04A33]/5">
                            <ShoppingBag className="w-6 h-6 text-[#B04A33]" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-6 h-6 bg-[#D4A373] text-white text-xs rounded-full flex items-center justify-center font-black animate-pulse">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section - 方案 A */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-block px-4 py-1.5 bg-[#B04A33]/10 text-[#B04A33] rounded-full text-xs font-bold border border-[#B04A33]/20">
                            Pearl Suria 邻里私房菜 | 每天新鲜采购
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-[#5D4037] leading-[1.1] tracking-tight">
                            Taste of Home <br />
                            <span className="text-[#B04A33] underline decoration-[#D4A373] underline-offset-8">in Every Bowl</span>
                        </h1>
                        <p className="text-xl text-[#795548] leading-relaxed italic border-l-4 border-[#D4A373] pl-6 py-2">
                            想念家里的味道？我们就在 Pearl Suria 隔壁。<br />
                            阿姨每天只煮一道菜，0 味精，每天巴刹现采。<br />
                            只为在这个城市努力的你，递上一碗有温度的热饭。
                        </p>

                        {/* 预订系统 Pre-order Selection */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D4A373]/10 space-y-4">
                            <p className="font-bold text-sm text-[#5D4037] flex items-center gap-2">
                                <Clock size={16} className="text-[#B04A33]" /> 预约配送 (Pearl Suria 3km 专送)
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="date"
                                    className="px-4 py-3 bg-[#FAF9F6] border border-[#D4A373]/20 rounded-xl text-sm outline-none focus:border-[#B04A33]"
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <select
                                    className="px-4 py-3 bg-[#FAF9F6] border border-[#D4A373]/20 rounded-xl text-sm outline-none focus:border-[#B04A33]"
                                    onChange={(e) => setDeliveryTime(e.target.value)}
                                >
                                    <option>Lunch (12:00 PM)</option>
                                    <option>Dinner (6:30 PM)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                                className="px-10 py-5 bg-[#B04A33] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all hover:-translate-y-1"
                            >
                                看看今天煮什么 / View Menu →
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square bg-white border-[12px] border-white shadow-2xl rounded-[40px] overflow-hidden flex items-center justify-center relative group rotate-2">
                            <Image
                                src={activeDish.image.startsWith('/') ? activeDish.image : "/angelica_chicken.png"}
                                alt="Hero Dish"
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#5D4037]/20 to-transparent pointer-events-none" />
                            <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/95 backdrop-blur-md rounded-2xl border border-[#B04A33]/10 shadow-xl">
                                <p className="font-bold text-[#B04A33] uppercase text-xs tracking-widest mb-1">Today's Kitchen / 今日开火</p>
                                <h3 className="text-2xl font-black">{activeDish.name}</h3>
                            </div>
                        </div>
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4A373] rounded-full border-[8px] border-[#FAF9F6] flex items-center justify-center text-white font-black rotate-12 shadow-xl z-20">
                            <span className="text-center text-xs leading-none">NO MSG<br />DAILY FRESH</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Weekly Menu Section */}
            <section id="menu" className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black text-[#5D4037]">每日一味</h2>
                        <p className="text-[#D4A373] font-bold text-sm tracking-widest uppercase mt-4">The Weekly Rotation</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-20">
                        {weeklyMenu.map((dish) => (
                            <button
                                key={dish.id}
                                onClick={() => setActiveDish(dish)}
                                className={`p-6 rounded-3xl text-left border-2 transition-all ${activeDish.id === dish.id ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-xl scale-105' : 'bg-[#FAF9F6] border-transparent hover:border-[#B04A33]/20'}`}
                            >
                                <span className={`text-[10px] uppercase font-black tracking-widest mb-2 block ${activeDish.id === dish.id ? 'text-white/40' : 'text-[#B04A33]'}`}>{dish.day}</span>
                                <h4 className="font-bold text-sm leading-tight mb-2 h-10 overflow-hidden">{dish.nameEn}</h4>
                                <p className={`text-xs ${activeDish.id === dish.id ? 'text-white/60' : 'text-[#D4A373]'}`}>RM {dish.price.toFixed(2)}</p>
                            </button>
                        ))}
                    </div>

                    <div className="max-w-4xl mx-auto p-10 bg-[#FAF9F6] border-2 border-[#B04A33]/10 rounded-[40px] grid md:grid-cols-2 gap-12 items-center">
                        <div className="aspect-square relative rounded-[32px] overflow-hidden border-8 border-white shadow-xl">
                            {activeDish.image.startsWith('/') ? <Image src={activeDish.image} alt={activeDish.name} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-9xl">{activeDish.image}</div>}
                        </div>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-3xl font-black">{activeDish.name}</h3>
                                <p className="text-[#B04A33] font-bold text-sm tracking-widest uppercase mt-2 italic">{activeDish.nameEn}</p>
                            </div>
                            <p className="text-lg italic text-[#795548] leading-relaxed">
                                "{activeDish.story}"
                            </p>
                            <div className="bg-[#B04A33]/5 p-4 rounded-2xl border border-[#B04A33]/10">
                                <p className="text-xs font-bold text-[#B04A33] uppercase mb-1">Health Benefits / 养生功效</p>
                                <p className="text-sm text-[#5D4037]">{activeDish.benefits}</p>
                            </div>
                            <div className="flex items-center justify-between pt-6 border-t border-[#B04A33]/10">
                                <span className="text-4xl font-black text-[#5D4037]">RM {activeDish.price.toFixed(2)}</span>
                                <button
                                    onClick={() => addToCart(activeDish)}
                                    className="px-8 py-4 bg-[#B04A33] text-white rounded-xl font-bold text-lg hover:bg-[#8D3421] transition-all"
                                >
                                    下单 / Add to Bag
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Neighbor's Feedback Section */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-[#5D4037]">邻居们的评价</h2>
                        <p className="text-[#D4A373] mt-2 italic">来自 Pearl Suria 与周边公寓的真实反馈</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { name: "张小姐 (Pearl Suria Block B 12楼)", text: "真的是家的味道，当归鸡腿汤好浓郁，跟我妈熬的一样！尤其是那个鸡肉，很滑。", date: "昨天" },
                            { name: "陈先生 (Millerz Square Tower A)", text: "每天下班不想煮，订阿姨的饭最安心，真材实料没味精，吃了不口渴。", date: "3天前" },
                            { name: "Linh (OUG Residents)", text: "Fresh ingredients and no shortcuts. My go-to healthy dinner for my family.", date: "1周前" }
                        ].map((review, i) => (
                            <div key={i} className="p-8 bg-[#FAF9F6] rounded-3xl border border-[#D4A373]/10 relative group hover:shadow-lg transition-all hover:-translate-y-1">
                                <div className="absolute top-4 right-6 flex gap-1">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className="fill-[#D4A373] text-[#D4A373]" />)}
                                </div>
                                <p className="text-[#5D4037] font-medium leading-relaxed mb-6 italic pt-4">"{review.text}"</p>
                                <div className="flex items-center gap-4 border-t border-[#D4A373]/10 pt-4">
                                    <div className="w-10 h-10 rounded-full bg-[#D4A373]/10 flex items-center justify-center text-[#D4A373] font-bold text-xs">
                                        {review.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-black text-[#B04A33]">{review.name}</h4>
                                        <p className="text-[10px] text-[#D4A373]">{review.date}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 手机实拍感的提示 / Micro-copy for authenticity */}
                    <div className="mt-12 text-center">
                        <p className="text-xs text-[#5D4037]/40 flex items-center justify-center gap-2">
                            <Sparkles size={14} /> 评价均来自邻里 WhatsApp 社群真实反馈
                        </p>
                    </div>
                </div>
            </section>

            {/* Kitchen Diary Section */}
            <section id="diary" className="py-24 bg-[#FAF9F6] relative">
                <div className="max-w-4xl mx-auto px-6 relative">
                    <div className="text-center mb-16">
                        <div className="w-16 h-1 w-16 bg-[#B04A33] mx-auto mb-6" />
                        <h2 className="text-4xl md:text-5xl font-black">阿姨的厨房日记</h2>
                        <p className="text-[#D4A373] mt-4 font-bold tracking-widest uppercase text-xs">Behind the kitchen door</p>
                    </div>

                    <div className="space-y-12">
                        {diaryEntries.map((entry, i) => (
                            <div key={i} className="flex gap-8 group">
                                <div className="flex flex-col items-center">
                                    <div className="w-4 h-4 rounded-full border-2 border-[#B04A33] group-hover:bg-[#B04A33] transition-colors" />
                                    {i !== diaryEntries.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-[#B04A33] to-transparent my-2" />}
                                </div>
                                <div className="pb-8">
                                    <span className="text-sm font-black text-[#D4A373] italic">{entry.time}</span>
                                    <h3 className="text-2xl font-black mt-2 mb-3">{entry.event}</h3>
                                    <p className="text-[#795548] text-lg leading-relaxed">{entry.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Drinks Section */}
            <section className="py-24 bg-[#5D4037] text-white overflow-hidden relative">
                <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">
                    <div className="space-y-8">
                        <h2 className="text-5xl font-black leading-tight">饭后一盏茶<br />慢品寻常美</h2>
                        <p className="text-white/70 text-lg leading-relaxed italic">
                            「喝茶不只是解渴，是给自己几分钟慢下来的喘息。」
                        </p>
                        <div className="grid gap-6">
                            {drinks.map(drink => (
                                <div key={drink.id} className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors flex justify-between items-center group">
                                    <div className="flex items-center gap-6">
                                        <span className="text-4xl group-hover:scale-110 transition-transform">{drink.image}</span>
                                        <div>
                                            <h4 className="font-black text-xl">{drink.name}</h4>
                                            <p className="text-white/40 text-xs italic">{drink.mood}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => addToCart(drink, { ice: true })} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">加冰</button>
                                        <button onClick={() => addToCart(drink, { ice: false })} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">温饮</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative hidden lg:block">
                        <div className="w-[400px] h-[400px] bg-[#B04A33] rounded-[60px] opacity-20 absolute -top-10 -left-10 rotate-12 blur-3xl" />
                        <div className="w-[450px] h-[450px] border border-white/10 rounded-[80px] flex items-center justify-center text-[15rem] relative z-10 rotate-3 backdrop-blur-sm">
                            🍵
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 bg-[#FAF9F6] border-t border-[#B04A33]/10">
                <div className="max-w-6xl mx-auto px-6 text-center space-y-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-[#B04A33]/5 pb-12">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white border-2 border-[#B04A33]/10 flex items-center justify-center overflow-hidden shadow-sm">
                                <Image src="/logo_hd.png" alt="Incredibowl Logo" width={64} height={64} className="scale-110" />
                            </div>
                            <div className="text-left">
                                <span className="text-2xl font-black tracking-tighter uppercase italic text-[#B04A33]">Incredibowl.my</span>
                                <p className="text-[10px] font-bold text-[#D4A373] tracking-widest uppercase">Cook with Mum's Sincere Heart</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8 text-[#D4A373] font-black text-[10px] uppercase tracking-widest">
                            <Link href="/privacy" className="hover:text-[#B04A33]">Privacy Policy</Link>
                            <Link href="/terms" className="hover:text-[#B04A33]">Terms of Service</Link>
                            <Link href="/refund" className="hover:text-[#B04A33]">Refund & Cancellation</Link>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-1 gap-6 text-[#5D4037]">
                        <div className="space-y-4">
                            <p className="text-lg font-black italic">Contact Us / 联系我们</p>
                            <div className="flex justify-center gap-8 text-sm font-bold">
                                <a href="https://wa.me/60103370197" className="flex items-center gap-2 text-[#B04A33]"><Phone size={18} /> 010-337 0197</a>
                                <span className="opacity-20">|</span>
                                <a href="mailto:incredibowl.my@gmail.com" className="flex items-center gap-2 text-[#B04A33]">incredibowl.my@gmail.com</a>
                            </div>
                            <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black">📍 Pearl Suria / Millerz Square / OUG, Kuala Lumpur</p>
                        </div>
                    </div>

                    <div className="flex justify-center gap-12 text-[#D4A373] font-bold text-xs uppercase tracking-[0.2em] opacity-30">
                        <span>Old Klang Road</span>
                        <span>No MSG</span>
                        <span>Home Taste</span>
                    </div>
                    <p className="text-[#795548]/30 text-[10px] uppercase font-black tracking-widest">&copy; 2026 Incredibowl. 慢一点，才好吃。</p>
                </div>
            </footer>

            {/* Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-[#5D4037]/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#FAF9F6] h-full shadow-2xl flex flex-col border-l border-[#B04A33]/20 animate-in slide-in-from-right duration-500">
                        <div className="p-8 bg-white border-b border-[#B04A33]/10 flex justify-between items-center">
                            <h2 className="text-2xl font-black italic flex items-center gap-3"><ShoppingBag className="text-[#B04A33]" /> 拎走温暖 ({cartCount})</h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-[#FAF9F6] rounded-xl"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 opacity-20 italic">
                                    <Utensils className="w-16 h-16 mx-auto mb-4" />
                                    <p className="font-bold uppercase tracking-widest text-sm">还没有挑中心水的家味</p>
                                </div>
                            ) : (
                                cart.map((item, i) => (
                                    <div key={item.cartItemId} className="bg-white rounded-3xl p-5 border border-[#B04A33]/5 shadow-sm flex gap-4 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className="w-16 h-16 rounded-2xl bg-[#FAF9F6] flex items-center justify-center text-3xl overflow-hidden relative">
                                            {item.image.startsWith('/') ? <Image src={item.image} alt={item.name} fill className="object-cover" /> : item.image}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-[#5D4037]">{item.name} {item.ice !== undefined && <span className="text-[10px] bg-[#B04A33]/10 text-[#B04A33] px-2 py-0.5 rounded-full ml-1">{item.ice ? '冷' : '温'}</span>}</h4>
                                            <p className="text-[#B04A33] font-bold text-xl">RM {item.price.toFixed(2)}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-6 h-6 rounded-md border border-[#B04A33]/10 flex items-center justify-center hover:bg-[#B04A33] hover:text-white transition-colors"><Minus size={12} /></button>
                                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-6 h-6 rounded-md border border-[#B04A33]/10 flex items-center justify-center hover:bg-[#B04A33] hover:text-white transition-colors"><Plus size={12} /></button>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(item.cartItemId)} className="text-[#D4A373]/30 hover:text-[#B04A33] transition-colors self-start"><Trash2 size={20} /></button>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="p-8 bg-white border-t border-[#B04A33]/10 space-y-6 shadow-[0_-20px_40px_rgba(176,74,51,0.05)] text-[#5D4037]">
                                <div className="flex justify-between items-baseline mb-4">
                                    <h3 className="text-lg font-bold italic opacity-40 uppercase tracking-widest">Grand Total</h3>
                                    <p className="text-4xl font-black text-[#B04A33] italic text-right">RM {cartTotal.toFixed(2)}</p>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-[#B04A33]/10">
                                    <p className="text-sm font-black italic flex items-center gap-2">
                                        <Sparkles size={16} className="text-[#D4A373]" /> 扫码付款 (Bank QR)
                                    </p>
                                    <div className="aspect-square w-48 mx-auto bg-white p-4 border-4 border-[#FAF9F6] rounded-2xl shadow-inner flex items-center justify-center relative">
                                        {/* 这里放你的真实 QR Code */}
                                        <div className="text-center font-black opacity-20 text-xs">BANK QR CODE <br />PLACEHOLDER</div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Image src="/logo_hd.png" alt="QR" width={48} height={48} className="rounded-full opacity-60 bg-white" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-center opacity-40">付款后请上传截图，阿姨核实后即刻开火</p>

                                    <div className="flex flex-col gap-3">
                                        <label className="w-full py-4 bg-[#FAF9F6] border-2 border-dashed border-[#D4A373]/30 rounded-xl flex items-center justify-center gap-3 cursor-pointer hover:bg-[#D4A373]/5 transition-colors">
                                            <Plus size={20} className="text-[#D4A373]" />
                                            <span className="text-sm font-bold text-[#D4A373]">上传付款凭证 / Receipt</span>
                                            <input type="file" className="hidden" />
                                        </label>
                                        <button className="w-full py-5 bg-[#B04A33] text-white rounded-2xl font-bold text-xl hover:bg-[#8D3421] transition-all flex items-center justify-center gap-4 shadow-xl shadow-[#B04A33]/20">
                                            <Phone size={24} /> WhatsApp 确认并下单 →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
