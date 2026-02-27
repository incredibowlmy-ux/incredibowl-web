"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Calendar, Clock, MapPin, User, ArrowRight, CheckCircle2, MessageCircle, Info, Phone, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';
import CartDrawer from '@/components/cart/CartDrawer';
import AddOnModal from '@/components/menu/AddOnModal';
import { onAuthChange } from '@/lib/auth';
import { User as FirebaseUser } from 'firebase/auth';

// Weekly Menu Data
const weeklyMenu = [
    {
        id: 6,
        day: "Daily / 常驻",
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Rice Bowl",
        price: 16.90,
        image: "/natto_bowl.jpg",
        tags: ["益生菌", "轻食主义", "健康长寿"],
        desc: "经典的健康选择。纳豆的鲜香配上顺滑的月见蛋，简单却极富层次。"
    },
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Golden Crispy Chicken Chop",
        price: 19.90,
        image: "/chicken_chop.png",
        tags: ["优质蛋白", "焦香四溢"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。"
    },
    {
        id: 2,
        day: "Tue / 周二",
        name: "山药云耳海陆双鲜",
        nameEn: "Surf & Turf Yam Stir-fry",
        price: 22.90,
        image: "/yam_surf_turf_egg.jpg",
        tags: ["健脾益胃", "清肺润燥"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。"
    },
    {
        id: 3,
        day: "Wed / 周三",
        name: "招牌当归回味蒸鸡全腿",
        nameEn: "Signature Angelica Chicken",
        price: 26.90,
        image: "/angelica_chicken.png",
        tags: ["补血活血", "增强免疫", "阿姨拿手"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。"
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖五花肉",
        nameEn: "Home-style Pork & Potato Stew",
        price: 21.90,
        image: "/pork_potato_stew.jpg",
        tags: ["能量补给", "软糯入味"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。"
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡腿汤",
        nameEn: "Scallion Pan-fried Chicken Soup",
        price: 23.90,
        image: "/scallion_chicken_soup.jpg",
        tags: ["清淡排毒", "治愈高汤"],
        desc: "一碗葱香清汤，洗去一周疲惫，干干净净迎周末。"
    }
];

export default function V4BentoLayout() {
    const [cart, setCart] = useState<any[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [heroImgIdx, setHeroImgIdx] = useState(0);
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [selectedDish, setSelectedDish] = useState<typeof weeklyMenu[0] | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => setCurrentUser(user));
        return () => unsubscribe();
    }, []);

    // Hero background image rotation (every 8 seconds)
    useEffect(() => {
        const timer = setInterval(() => {
            setHeroImgIdx(prev => (prev + 1) % weeklyMenu.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    // Booking State
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("Lunch");

    // Calculate tomorrow's date in local timezone (fixes UTC offset bug on mobile)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    // Scroll state for Navigation Header
    const [scrolled, setScrolled] = useState(false);

    // Horizontal Scroll State for Menu
    const [activeIdx, setActiveIdx] = useState(-1); // Start with no item selected
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to center (Wednesday) on mount after a short delay
        const timer = setTimeout(() => {
            scrollToIndex(2); // Wednesday is index 2
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScrollEvent = () => {
            const container = scrollContainerRef.current;
            if (!container) return;

            const menuItems = Array.from(container.children).filter(child =>
                child instanceof HTMLElement && child.classList.contains('menu-item')
            ) as HTMLElement[];

            if (menuItems.length === 0) return;

            const containerCenter = container.scrollLeft + container.offsetWidth / 2;
            let closestIdx = 0;
            let minDistance = Infinity;

            menuItems.forEach((item, idx) => {
                const itemCenter = item.offsetLeft + item.offsetWidth / 2;
                const distance = Math.abs(containerCenter - itemCenter);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestIdx = idx;
                }
            });

            if (closestIdx !== activeIdx && closestIdx < weeklyMenu.length) {
                setActiveIdx(closestIdx);
            }
        };

        container.addEventListener('scroll', handleScrollEvent, { passive: true });
        return () => container.removeEventListener('scroll', handleScrollEvent);
    }, [activeIdx]);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const addToCart = (item: any) => {
        setCart(prev => {
            const existing = prev.find((i: any) => i.id === item.id);
            if (existing) {
                return prev.map((i: any) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, cartItemId: item.id, quantity: 1, selectedDate, selectedTime }];
        });
        setIsCartOpen(true);
    };

    // Open the add-on modal for a specific dish
    const openAddOnModal = (dish: typeof weeklyMenu[0]) => {
        setSelectedDish(dish);
        setIsAddOnOpen(true);
    };

    // Handle "Add to Cart" from the AddOnModal
    const handleAddWithAddOns = (dish: any, addOns: { item: any; quantity: number }[], totalPrice: number, note: string) => {
        // Add the main dish
        setCart(prev => {
            const newItems = [...prev];
            // Add main dish
            const existingDish = newItems.find((i: any) => i.id === dish.id && !i.isAddOn);
            if (existingDish) {
                existingDish.quantity += 1;
                existingDish.note = note; // Update note if exists
            } else {
                newItems.push({ ...dish, cartItemId: dish.id, quantity: 1, selectedDate: selectedDate || minDate, selectedTime, note });
            }
            // Add each add-on as a separate cart line
            addOns.forEach(({ item, quantity }) => {
                const addOnCartId = `${dish.id}-addon-${item.id}`;
                const existingAddOn = newItems.find((i: any) => i.cartItemId === addOnCartId);
                if (existingAddOn) {
                    existingAddOn.quantity += quantity;
                } else {
                    newItems.push({
                        id: addOnCartId,
                        cartItemId: addOnCartId,
                        name: `↳ ${item.name}`,
                        nameEn: item.nameEn,
                        price: item.price,
                        image: item.image || dish.image,
                        quantity,
                        isAddOn: true,
                        parentDishId: dish.id,
                        selectedDate: selectedDate || minDate,
                        selectedTime,
                    });
                }
            });
            return newItems;
        });
        setIsCartOpen(true);
    };

    const updateQuantity = (cartItemId: any, delta: number) => {
        setCart(prev => prev.map((item: any) => {
            if (item.cartItemId === cartItemId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter((item: any) => item.quantity > 0));
    };

    const removeFromCart = (cartItemId: any) => {
        setCart(prev => prev.filter((i: any) => i.cartItemId !== cartItemId));
    };

    const scrollToIndex = (index: number) => {
        const container = scrollContainerRef.current;
        if (container && index >= 0 && index < weeklyMenu.length) {
            const menuItems = Array.from(container.children).filter(child =>
                child instanceof HTMLElement && child.classList.contains('menu-item')
            ) as HTMLElement[];

            if (menuItems[index]) {
                const item = menuItems[index];
                const scrollPos = item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        }
    };

    const cartTotal = cart.reduce((sum, item: any) => sum + item.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item: any) => sum + item.quantity, 0);

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
                h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
                body { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
                
                /* Hide scrollbar for carousel */
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                .menu-carousel-padding {
                    padding-left: calc(50% - 150px);
                    padding-right: calc(50% - 150px);
                    scroll-padding-inline: calc(50% - 150px);
                }

                @media (min-width: 768px) {
                    .menu-carousel-padding {
                        padding-left: calc(50% - 180px);
                        padding-right: calc(50% - 180px);
                        scroll-padding-inline: calc(50% - 180px);
                    }
                }
            `}</style>

            {/* Navigation - v1 Style adapted to v4 colors */}
            <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#FDFBF7]/95 backdrop-blur-md shadow-md border-b border-[#E3EADA]/60 py-3' : 'bg-gradient-to-b from-[#FDFBF7]/80 to-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border-2 border-[#E3EADA] hover:scale-105 transition-transform duration-300">
                            <Image src="/logo.png" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-[#1A2D23]">阿姨的厨房</h1>
                            <div className="flex items-center gap-2">
                                <span className="h-[1px] w-3 bg-[#FF6B35]"></span>
                                <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#FF6B35]">Incredibowl.my</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        {currentUser ? (
                            <>
                                {/* Mobile: avatar only */}
                                <a href="/member" className="md:hidden">
                                    <div className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-black text-sm border-2 border-[#E3EADA] shadow-sm overflow-hidden">
                                        {currentUser.photoURL ? (
                                            <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (currentUser.displayName || 'U')[0].toUpperCase()
                                        )}
                                    </div>
                                </a>
                                {/* Desktop: avatar + name */}
                                <a href="/member" className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                                        {currentUser.photoURL ? (
                                            <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            (currentUser.displayName || 'U')[0].toUpperCase()
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-[#1A2D23] max-w-[100px] truncate">{currentUser.displayName || '会员中心'}</span>
                                    <Sparkles size={12} className="text-[#FF6B35]" />
                                </a>
                            </>
                        ) : (
                            <>
                                {/* Mobile: icon-only login button */}
                                <button onClick={() => setIsAuthOpen(true)} className="md:hidden p-2.5 bg-[#E3EADA]/60 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                    <User size={18} className="text-[#1A2D23]" />
                                </button>
                                {/* Desktop: full login button */}
                                <button onClick={() => setIsAuthOpen(true)} className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-[#E3EADA]/50 rounded-full border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                    <User size={16} className="text-[#1A2D23]" />
                                    <span className="text-xs font-bold text-[#1A2D23]">登录 / 邻里会员</span>
                                </button>
                            </>
                        )}
                        <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 md:p-3 bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 hover:border-[#1A2D23]/20 transition-all">
                            <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-[#1A2D23]" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-[#FF6B35] text-white text-[10px] md:text-xs rounded-full flex items-center justify-center font-black animate-pulse shadow-md">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Layout - Bento Box Style */}
            <main className="pt-32 pb-32 px-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">

                    {/* Hero Bento 1: Main Promise */}
                    <div className="lg:col-span-8 bg-[#E3EADA] rounded-[32px] p-8 md:p-12 relative overflow-hidden flex flex-col justify-end min-h-[400px]">
                        {/* Rotating Background Images */}
                        <div className="absolute inset-0 pointer-events-none">
                            {weeklyMenu.map((dish, i) => (
                                <div key={dish.id} className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out" style={{ opacity: heroImgIdx === i ? 0.25 : 0 }}>
                                    <Image src={dish.image} alt="" fill className="object-cover object-center mix-blend-multiply" />
                                </div>
                            ))}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#E3EADA] via-transparent to-[#E3EADA]/80 z-10" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#E3EADA] via-transparent to-transparent z-10" />
                        </div>

                        <div className="relative z-20 max-w-xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-xs font-bold mb-6 text-[#1A2D23]">
                                <MapPin size={12} className="text-[#FF6B35]" /> Old Klang Road 邻里私房菜
                            </div>
                            <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight mb-4">
                                家的味道，<br />
                                每天新鲜采购。
                            </h2>
                            <p className="text-lg md:text-xl font-medium text-[#1A2D23]/70 mb-8 max-w-md">
                                "没时间做菜，但要吃得健康。无味精、真材实料，阿姨每天只专注煮一道拿手好菜。"
                            </p>
                        </div>
                    </div>

                    {/* Hero Bento 2: Delivery & Trust */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="bg-[#1A2D23] rounded-[32px] p-8 text-white flex-1 flex flex-col justify-center relative overflow-hidden">
                            <div className="w-32 h-32 bg-[#FF6B35] rounded-full blur-3xl opacity-20 absolute -top-10 -right-10" />
                            <h3 className="text-2xl font-bold mb-2">限量供应</h3>
                            <p className="text-white/60 text-sm mb-6">阿姨每天下巴刹，食材有限，售完即刻收火。</p>
                            <ul className="space-y-3">
                                {['100% 无味精', '少盐少油', '选用鲜切好肉'].map((feat, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-sm font-medium">
                                        <CheckCircle2 size={16} className="text-[#FF6B35]" /> {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex items-center justify-between group cursor-pointer hover:border-[#E3EADA] transition-colors" onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Explore</p>
                                <p className="font-extrabold text-lg">看看今日菜单</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-[#FDFBF7] flex items-center justify-center group-hover:bg-[#FF6B35] group-hover:text-white transition-colors">
                                <ArrowRight size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Pre-order Widget (Full Width spanning) */}
                    <div className="lg:col-span-12 bg-white rounded-[32px] p-4 md:p-6 lg:p-8 shadow-sm border border-gray-100 mt-4 flex flex-col gap-4" id="menu">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-[#FDFBF7] rounded-2xl flex items-center justify-center text-[#FF6B35]">
                                    <Calendar size={28} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-xl">预约你的这周的午饭</h3>
                                    <p className="text-sm font-medium text-gray-500">选择接收时间，每天阿姨准时开饭</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <input
                                    type="date"
                                    className="flex-1 px-4 py-3 md:py-4 bg-[#FDFBF7] border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#E3EADA] font-medium"
                                    onChange={(e) => {
                                        const selected = e.target.value;
                                        if (selected < minDate) {
                                            e.target.value = minDate;
                                            setSelectedDate(minDate);
                                            return;
                                        }
                                        setSelectedDate(selected);
                                    }}
                                    min={minDate}
                                    defaultValue={minDate}
                                />
                                <select
                                    className="flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 bg-[#FDFBF7] border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#E3EADA] font-medium cursor-pointer"
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                >
                                    <option value="Lunch (11AM-1PM)">🌞 午餐 11AM - 1PM</option>
                                    <option value="Dinner (6PM-8PM)">🌙 晚餐 6PM - 8PM</option>
                                </select>
                            </div>
                        </div>
                        {/* Next-day reminder */}
                        <div className="bg-[#FFF3E0] rounded-2xl border border-[#FFE0B2] px-4 py-3 md:px-5 md:py-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#FF6B35]/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Info size={16} className="text-[#FF6B35]" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#E65100] mb-1">
                                        📌 所有订单为<span className="underline">隔天</span>的预订
                                    </p>
                                    <p className="text-[11px] text-[#1A2D23]/60 leading-relaxed">
                                        阿姨每天清早亲自去巴刹挑选最新鲜的食材，需要提前一天知道份量才能准确采购，确保你吃到的每一口都是当天现煮、真材实料。
                                    </p>
                                    <p className="text-[10px] text-[#FF6B35]/70 mt-1 font-medium italic">
                                        Auntie visits the market fresh every morning — we need your order a day ahead to buy just the right amount. That's our promise of freshness.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Horizontal Interactive Menu Carousel */}
                    <div className="lg:col-span-12 mt-8">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <div>
                                <h2 className="text-2xl font-extrabold tracking-tight">每日一味 / Weekly Rotation</h2>
                                <p className="text-xs text-gray-400 font-medium mt-1">点击或滑动切换每日精选菜单</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => scrollToIndex(activeIdx - 1)}
                                    disabled={activeIdx <= 0}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-300 ${activeIdx <= 0 ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-[#E3EADA] text-[#1A2D23] bg-white hover:bg-[#1A2D23] hover:text-white shadow-sm'}`}
                                >
                                    <ChevronLeft size={22} />
                                </button>
                                <button
                                    onClick={() => scrollToIndex(activeIdx + 1)}
                                    disabled={activeIdx === weeklyMenu.length - 1}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-300 ${activeIdx === weeklyMenu.length - 1 ? 'border-gray-100 text-gray-200 cursor-not-allowed bg-gray-50/50' : 'border-[#E3EADA] text-[#1A2D23] bg-white hover:bg-[#1A2D23] hover:text-white shadow-sm'}`}
                                >
                                    <ChevronRight size={22} />
                                </button>
                            </div>
                        </div>

                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto pb-8 pt-4 no-scrollbar snap-x snap-mandatory scroll-smooth relative menu-carousel-padding"
                        >
                            {weeklyMenu.map((dish, i) => (
                                <div key={dish.id}
                                    className={`menu-item w-[300px] md:w-[360px] snap-center shrink-0 rounded-[32px] p-6 transition-all duration-300 mx-2 ${activeIdx === i ? 'bg-[#1A2D23] text-white shadow-2xl scale-100 transform -translate-y-2' : 'bg-white text-[#1A2D23] border border-gray-100 scale-95 opacity-80 hover:opacity-100 cursor-pointer'}`}
                                    onClick={() => scrollToIndex(i)}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${activeIdx === i ? 'bg-white/10 text-white' : 'bg-[#FDFBF7] text-gray-500'}`}>
                                            {dish.day}
                                        </div>
                                        <p className="font-extrabold text-xl">RM {dish.price.toFixed(2)}</p>
                                    </div>

                                    <div className="aspect-square w-full rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-7xl mb-6 relative overflow-hidden border-4 border-transparent">
                                        {dish.image.startsWith('/') ? <Image src={dish.image} alt={dish.name} fill className="object-cover" /> : dish.image}
                                    </div>

                                    <h3 className="font-extrabold text-xl mb-1">{dish.name}</h3>
                                    <h4 className={`text-sm font-medium mb-4 ${activeIdx === i ? 'text-white/60' : 'text-gray-400'}`}>{dish.nameEn}</h4>

                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {dish.tags.map(tag => (
                                            <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-md ${activeIdx === i ? 'bg-[#FF6B35]/20 text-[#FF6B35]' : 'bg-[#E3EADA]/50 text-[#1A2D23]'}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    {activeIdx === i && (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <p className="text-sm font-medium text-white/80 leading-relaxed mb-6 italic">"{dish.desc}"</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openAddOnModal(dish); }}
                                                className="w-full py-4 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"
                                            >
                                                <ShoppingBag size={18} /> 加入预订
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Right Spacer */}
                            <div className="min-w-[calc(50%-150px)] md:min-w-[calc(50%-180px)] shrink-0" />
                        </div>
                    </div>

                    {/* WhatsApp Contextual Social Proof (Bento style) */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="md:col-span-1 bg-[#E3EADA] rounded-[32px] p-8 flex flex-col justify-center">
                            <MessageCircle size={32} className="text-[#1A2D23] mb-4" />
                            <h2 className="text-3xl font-extrabold mb-4 leading-tight">来自邻里的<br />真实反馈</h2>
                            <p className="text-[#1A2D23]/70 font-medium text-sm">这些都是来自 Pearl Suria 与周边公寓邻居们在 WhatsApp 里的留言。绝不作假。</p>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { name: "Jason L. (Block B, Pearl Suria)", text: "昨天的排骨很酥烂，我老婆说比外面的健康多了。今天的鸡腿我还想加一份！", time: "上午 11:42" },
                                { name: "Sarah M. (Millerz Square)", text: "No MSG is a lifesaver. I don't feel sleepy at all after lunch. Recommend!", time: "昨天" }
                            ].map((msg, idx) => (
                                <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="bg-[#FDFBF7] p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl mb-4 relative before:absolute before:-left-2 before:top-4 before:w-4 before:h-4 before:bg-[#FDFBF7] before:rotate-45">
                                        <p className="text-[#1A2D23] font-medium text-sm leading-relaxed relative z-10">{msg.text}</p>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                                        <span>{msg.name}</span>
                                        <span>{msg.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>

            {/* Footer - v1 Style adapted to v4 colors */}
            <footer className="py-20 bg-white border-t border-[#E3EADA]">
                <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-gray-100 pb-12">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white border-2 border-[#E3EADA] flex items-center justify-center overflow-hidden shadow-sm">
                                <Image src="/logo.png" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                            </div>
                            <div className="text-left">
                                <span className="text-2xl font-black tracking-tighter uppercase text-[#1A2D23]">Incredibowl.my</span>
                                <p className="text-[10px] font-bold text-[#FF6B35] tracking-widest uppercase">Cook with Mum's Sincere Heart</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[#1A2D23]/60 font-bold text-xs uppercase tracking-widest">
                            <Link href="/privacy" className="hover:text-[#FF6B35] transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="hover:text-[#FF6B35] transition-colors">Terms of Service</Link>
                            <Link href="/refund" className="hover:text-[#FF6B35] transition-colors">Refund & Cancellation</Link>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-1 gap-6 text-[#1A2D23]">
                        <div className="space-y-4">
                            <p className="text-lg font-black">Contact Us / 联系我们</p>
                            <div className="flex justify-center gap-8 text-sm font-bold">
                                <a href="https://wa.me/60103370197" className="flex items-center gap-2 text-[#FF6B35] hover:text-[#E95D31] transition-colors"><Phone size={18} /> 010-337 0197</a>
                                <span className="opacity-20 text-[#1A2D23]">|</span>
                                <a href="mailto:incredibowl.my@gmail.com" className="flex items-center gap-2 text-[#FF6B35] hover:text-[#E95D31] transition-colors">incredibowl.my@gmail.com</a>
                            </div>
                            <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black">📍 Pearl Suria / Millerz Square / OUG, Kuala Lumpur</p>
                        </div>
                    </div>

                    <div className="flex justify-center flex-wrap gap-8 md:gap-12 text-[#1A2D23]/30 font-bold text-xs uppercase tracking-[0.2em]">
                        <span>Old Klang Road</span>
                        <span>No MSG</span>
                        <span>Daily Fresh</span>
                    </div>
                    <p className="text-[#1A2D23]/30 text-[10px] uppercase font-black tracking-widest">&copy; 2026 Incredibowl. 家的味道，每天新鲜采购。</p>
                </div>
            </footer>

            {/* Integrated Renderers */}
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} cartTotal={cartTotal} cartCount={cartCount} selectedDate={selectedDate || minDate} selectedTime={selectedTime} onAuthOpen={() => { setIsCartOpen(false); setIsAuthOpen(true); }} onClearCart={() => setCart([])} />
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            <AddOnModal
                isOpen={isAddOnOpen}
                onClose={() => setIsAddOnOpen(false)}
                dish={selectedDish}
                onAddToCart={handleAddWithAddOns}
            />
        </div>
    );
}
