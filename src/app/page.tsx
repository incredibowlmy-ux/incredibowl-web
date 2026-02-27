"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Calendar, Clock, MapPin, User, ArrowRight, CheckCircle2, MessageCircle, Info, Phone, ChevronLeft, ChevronRight, Sparkles, Plus, X } from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';
import CartDrawer from '@/components/cart/CartDrawer';
import AddOnModal from '@/components/menu/AddOnModal';
import { onAuthChange } from '@/lib/auth';
import { User as FirebaseUser } from 'firebase/auth';
import { getApprovedFeedbacks, submitFeedback, Feedback } from '@/lib/feedbacks';

// Weekly Menu Data
const weeklyMenu = [
    {
        id: 6,
        day: "Daily / 常驻",
        name: "纳豆月见海苔饭",
        nameEn: "Natto Tsukimi Rice Bowl",
        price: 16.90,
        image: "/natto_bowl.jpg",
        tags: ["~485 kcal*", "高蛋白 25g+", "无味精", "益生菌"],
        desc: "经典的健康选择。纳豆的鲜香配上顺滑的月见蛋，简单却极富层次。"
    },
    {
        id: 1,
        day: "Mon / 周一",
        name: "香煎金黄鸡扒饭",
        nameEn: "Golden Crispy Chicken Chop",
        price: 18.50,
        image: "/chicken_chop.png",
        tags: ["优质蛋白", "焦香四溢"],
        desc: "小时候最盼这口焦香，不用花哨调料，盐和胡椒足矣。"
    },
    {
        id: 2,
        day: "Tue / 周二",
        name: "山药云耳海陆双鲜炒",
        nameEn: "Surf & Turf Yam Stir-fry",
        price: 18.50,
        image: "/yam_surf_turf_egg.jpg",
        tags: ["健脾益胃", "清肺润燥"],
        desc: "新鲜山药配上爽口云耳，是对脾胃最温柔的照顾。"
    },
    {
        id: 3,
        day: "Wed / 周三",
        name: "招牌当归回味蒸鸡全腿",
        nameEn: "Signature Angelica Chicken",
        price: 18.50,
        image: "/angelica_chicken.png",
        tags: ["补血活血", "增强免疫", "阿姨拿手"],
        desc: "当归香渗进鸡肉，喝一口汤，魂都暖了。"
    },
    {
        id: 4,
        day: "Thu / 周四",
        name: "马铃薯炖五花肉",
        nameEn: "Home-style Pork & Potato Stew",
        price: 19.90,
        image: "/pork_potato_stew.jpg",
        tags: ["能量补给", "软糯入味"],
        desc: "土豆炖得烂烂的，拌在米饭里，就是最踏实的幸福。"
    },
    {
        id: 5,
        day: "Fri / 周五",
        name: "金黄葱香煎鸡腿汤",
        nameEn: "Scallion Pan-fried Chicken Soup",
        price: 18.50,
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

    // Feedback State
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackName, setFeedbackName] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

    useEffect(() => {
        getApprovedFeedbacks().then(data => setFeedbacks(data));
    }, []);

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

    // Booking State is now per-dish, handled via AddOnModal


    // Calculate dynamic dates and cutoff
    const fallbackTomorrow = new Date();
    fallbackTomorrow.setDate(fallbackTomorrow.getDate() + 1);
    const fallbackDateStr = `${fallbackTomorrow.getFullYear()}-${String(fallbackTomorrow.getMonth() + 1).padStart(2, '0')}-${String(fallbackTomorrow.getDate()).padStart(2, '0')}`;

    const [minDate, setMinDate] = useState<string>(fallbackDateStr);
    const [menuDates, setMenuDates] = useState<any>({});

    useEffect(() => {
        const now = new Date();
        const cutoffHour = 22; // 10:30 PM cut-off
        const cutoffMinute = 30;
        const isPastCutoff = now.getHours() > cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() >= cutoffMinute);

        let nextAvail = new Date(now);
        nextAvail.setDate(now.getDate() + (isPastCutoff ? 2 : 1));

        if (nextAvail.getDay() === 6) nextAvail.setDate(nextAvail.getDate() + 2);
        else if (nextAvail.getDay() === 0) nextAvail.setDate(nextAvail.getDate() + 1);

        const formatYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const formatMD = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

        const nextAvailStr = formatYMD(nextAvail);
        setMinDate(nextAvailStr);

        const nowMid = new Date(now).setHours(0, 0, 0, 0);
        const nextAvailMid = new Date(nextAvail).setHours(0, 0, 0, 0);
        const diffDays = Math.round((nextAvailMid - nowMid) / 86400000);
        let relativeDay = "明天";
        if (diffDays === 2) relativeDay = "后天";
        else if (diffDays > 2) relativeDay = `${formatMD(nextAvail)}`;

        const wdCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const wdEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const newMenuDates: any = {};

        weeklyMenu.forEach(dish => {
            if (dish.id === 6) {
                newMenuDates[dish.id] = {
                    topTag: `常驻供应 · Daily`,
                    btnText: `加入${relativeDay}的预订 · RM ${dish.price.toFixed(2)}`,
                    disabled: false,
                    actualDate: nextAvailStr
                };
                return;
            }

            const targetWd = dish.id;

            let targetDate = new Date(now);
            targetDate.setDate(now.getDate() + 1);
            while (targetDate.getDay() !== targetWd) targetDate.setDate(targetDate.getDate() + 1);

            const cutoffForTarget = new Date(targetDate);
            cutoffForTarget.setDate(targetDate.getDate() - 1);
            cutoffForTarget.setHours(cutoffHour, cutoffMinute, 0, 0);

            let isDisabled = false;
            let btnText = "";

            if (now >= cutoffForTarget) {
                targetDate.setDate(targetDate.getDate() + 7);
                isDisabled = true;
                btnText = `明日已截单 · 可预订 ${formatMD(targetDate)} (${wdCn[targetWd]})`;
            } else {
                btnText = `预订 ${formatMD(targetDate)} (${wdCn[targetWd]}) · RM ${dish.price.toFixed(2)}`;
            }

            newMenuDates[dish.id] = {
                topTag: `${formatMD(targetDate)} ${wdCn[targetWd]} · ${wdEn[targetWd]}`,
                btnText,
                disabled: isDisabled,
                actualDate: formatYMD(targetDate)
            };
        });

        setMenuDates(newMenuDates);
    }, []);

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
        // Obsolete global addToCart (kept for safety if used elsewhere, but with generic defaults)
        setCart(prev => {
            const defaultDateStr = minDate;
            const existing = prev.find((i: any) => i.id === item.id && !i.isAddOn && i.selectedDate === defaultDateStr);
            if (existing) {
                return prev.map((i: any) => i.cartItemId === existing.cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, cartItemId: `${item.id}-${defaultDateStr}-Lunch`, quantity: 1, selectedDate: defaultDateStr, selectedTime: "Lunch (11AM-1PM)" }];
        });
        setIsCartOpen(true);
    };

    // Open the add-on modal for a specific dish
    const openAddOnModal = (dish: typeof weeklyMenu[0]) => {
        const dInfo = menuDates[dish.id];
        if (dInfo && dInfo.disabled) return;
        setSelectedDish(dish);
        setIsAddOnOpen(true);
    };

    // Handle "Add to Cart" from the AddOnModal
    const handleAddWithAddOns = (dish: any, addOns: { item: any; quantity: number }[], totalPrice: number, note: string, sDate: string, sTime: string) => {
        setCart(prev => {
            const newItems = [...prev];
            // Add main dish
            const dishCartId = `${dish.id}-${sDate}-${sTime}`;
            const existingDish = newItems.find((i: any) => i.cartItemId === dishCartId && !i.isAddOn);
            if (existingDish) {
                existingDish.quantity += 1;
                existingDish.note = note; // Update note if exists
            } else {
                newItems.push({ ...dish, cartItemId: dishCartId, quantity: 1, selectedDate: sDate, selectedTime: sTime, note });
            }
            // Add each add-on as a separate cart line linked to the same delivery dimension
            addOns.forEach(({ item, quantity }) => {
                const addOnCartId = `${dishCartId}-addon-${item.id}`;
                const existingAddOn = newItems.find((i: any) => i.cartItemId === addOnCartId);
                if (existingAddOn) {
                    existingAddOn.quantity += quantity;
                } else {
                    newItems.push({
                        id: item.id,
                        cartItemId: addOnCartId,
                        name: `↳ ${item.name}`,
                        nameEn: item.nameEn,
                        price: item.price,
                        category: item.category,
                        image: item.image,
                        isAddOn: true,
                        parentId: dishCartId,
                        quantity,
                        selectedDate: sDate,
                        selectedTime: sTime
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

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackName.trim() || !feedbackText.trim()) return;
        setFeedbackSubmitting(true);
        try {
            await submitFeedback(feedbackName, feedbackText);
            alert("留言提交成功！感谢您的真实反馈。");
            setFeedbackName('');
            setFeedbackText('');
            setIsFeedbackModalOpen(false);
        } catch (error) {
            console.error("Feedback submit error", error);
            alert("提交失败，请重试。");
        } finally {
            setFeedbackSubmitting(false);
        }
    };

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
                            <div className="flex items-center gap-3 mb-3">
                                <div className="px-2.5 py-1 rounded-md bg-[#FF6B35] text-white text-[11px] font-black tracking-widest animate-pulse shadow-lg shadow-[#FF6B35]/20">BETA</div>
                                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">邻里内测中</h3>
                            </div>
                            <p className="text-white/80 text-sm md:text-base mb-6 leading-relaxed">
                                阿姨的厨房正式开灶！首批仅开放 <span className="text-white font-bold">Pearl Suria</span> 周边邻居试吃。<br />
                                名额有限，<span className="text-[#FF6B35] font-black text-base underline decoration-[#FF6B35]/30 underline-offset-4">每天限量 25 份</span>。
                            </p>
                            <div className="w-full h-px bg-white/10 mb-5" />
                            <ul className="space-y-3.5">
                                {['100% 无味精', '少盐少油', '选用鲜切好肉'].map((feat, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-sm font-bold text-white/90">
                                        <CheckCircle2 size={18} className="text-[#FF6B35]" /> {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-[#FF6B35] rounded-[32px] p-6 shadow-lg shadow-[#FF6B35]/30 flex items-center justify-between group cursor-pointer hover:bg-[#E95D31] hover:shadow-xl hover:shadow-[#FF6B35]/40 transition-all duration-300 transform hover:-translate-y-1" onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}>
                            <div>
                                <p className="text-xs font-black text-white/80 uppercase tracking-widest mb-1 animate-pulse">Explore Menu</p>
                                <p className="font-extrabold text-xl md:text-2xl text-white">去看看今日菜单</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#FF6B35] group-hover:scale-110 transition-transform duration-300 shadow-md">
                                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {/* Delivery Coverage Widget */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="md:col-span-2 bg-[#1A2D23] text-white rounded-[32px] p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
                            <div className="w-40 h-40 bg-[#FF6B35] rounded-full blur-3xl opacity-20 absolute -bottom-10 -right-10 pointer-events-none" />
                            <div className="flex items-center gap-3 mb-4">
                                <MapPin size={24} className="text-[#FF6B35]" />
                                <h3 className="font-extrabold text-2xl tracking-tight">阿姨的配送范围 / Delivery Coverage</h3>
                            </div>
                            <p className="text-white/80 font-medium text-sm leading-relaxed mb-6 max-w-xl">
                                阿姨骑着小电驴，只送家门口的邻居。<br />
                                新鲜现煮，不跑远路，味道不打折。<br />
                                <span className="text-xs text-white/50 italic mt-1 block">Auntie delivers on her trusty e-bike — only to neighbours within reach, so every meal arrives hot & fresh.</span>
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs font-bold text-white/90">
                                {['Pearl Suria (大本营)', 'Millerz Square', 'The Scott Garden', "D'Ivoz Residences", 'Pearl Point', 'Verve Suites', 'The Harmony', 'Platinum Arena', 'Citizen 1&2', 'Petalz', "D'Sands", 'SkyVille 8 @ Benteng'].map(loc => (
                                    <div key={loc} className="flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-[#FF6B35] shrink-0" />
                                        <span className="truncate">{loc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-1 bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col justify-center text-center items-center">
                            <div className="w-12 h-12 bg-[#FFF3E0] rounded-full flex items-center justify-center text-[#FF6B35] mb-4">
                                <MapPin size={24} />
                            </div>
                            <p className="font-extrabold text-[#1A2D23] text-sm mb-1">以 Pearl Suria 为中心，</p>
                            <p className="font-extrabold text-[#1A2D23] text-sm mb-2">方圆 2 公里内的公寓邻居。</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6 border-b border-gray-100 pb-4 w-full">Within 2km along Old Klang Road</p>

                            <p className="text-xs font-bold text-gray-500 mb-1">🤔 不确定你家在不在范围内？</p>
                            <p className="text-[10px] text-gray-400 italic mb-4">Not sure if we deliver to you?</p>

                            <a href="https://wa.me/60103370197?text=Hi%20Auntie%21%20%E7%9C%8B%E4%BA%86%E4%BD%A0%E7%9A%84%E8%8F%9C%E5%8D%95%E6%9E%81%E5%BA%A6%E6%83%B3%E5%BF%B5%20home-cooked%20food%20%F0%9F%8D%B3%EF%BC%8C%E6%83%B3%E7%A1%AE%E8%AE%A4%E6%88%91%E8%BF%99%E8%BE%B9%E7%9A%84%20condo%20%E6%9C%89%E6%B2%A1%E6%9C%89%E5%9C%A8%20delivery%20coverage%20%E9%87%8C%E9%9D%A2%E5%91%A2%EF%BC%9F" target="_blank" rel="noopener noreferrer" className="w-full py-3.5 bg-[#25D366] hover:bg-[#20BE5A] text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-md shadow-[#25D366]/20">
                                <Phone size={16} /> WhatsApp 问阿姨
                            </a>
                        </div>
                    </div>

                    {/* Horizontal Interactive Menu Carousel */}
                    <div className="lg:col-span-12 mt-8" id="menu">
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
                                            {menuDates[dish.id] ? menuDates[dish.id].topTag : dish.day}
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
                                                disabled={menuDates[dish.id]?.disabled}
                                                className={`w-full py-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors text-sm ${menuDates[dish.id]?.disabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#FF6B35] hover:bg-[#E95D31] text-white'}`}
                                            >
                                                {!menuDates[dish.id]?.disabled && <ShoppingBag size={18} />}
                                                {menuDates[dish.id] ? menuDates[dish.id].btnText : '加入明天的预订'}
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
                            <h2 className="text-3xl font-extrabold mb-4 leading-tight">隔壁邻居<br />怎么说</h2>
                            <p className="text-[#1A2D23]/70 font-medium text-sm mb-6">每一条都来自 Pearl Suria 和周边公寓邻居的真实 WhatsApp 留言。<br /><br />没有网红，没有广告，只有吃过的人说的真心话。</p>
                            <button onClick={() => setIsFeedbackModalOpen(true)} className="w-full py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors flex items-center justify-center gap-2">
                                <Plus size={18} /> 写下您的留言
                            </button>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { name: "Little Jack (SkyVille 8 @ Benteng)", text: "练完gym最需要蛋白质，阿姨的鸡扒饭份量刚好，吃饱不撑。比自己煮鸡胸肉好吃一百倍。", time: "上午 11:42" },
                                { name: "Ah Hao (Pearl Suria)", text: "一开始看到纳豆有点怕，结果配上温泉蛋一拌，上瘾了😂 现在每天固定一碗。", time: "下午 12:15" },
                                { name: "Amy Tan (Millerz Square)", text: "当归鸡真的很补，喝完整个人暖起来。我月经期每次都订这个，比自己炖方便太多。", time: "昨天" },
                                ...feedbacks.map(f => ({ name: f.name, text: f.text, time: f.time }))
                            ].map((msg, idx) => (
                                <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div className="bg-[#FDFBF7] p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl mb-4 relative before:absolute before:-left-2 before:top-4 before:w-4 before:h-4 before:bg-[#FDFBF7] before:rotate-45">
                                        <p className="text-[#1A2D23] font-medium leading-relaxed italic text-sm">
                                            "{msg.text}"
                                        </p>
                                        <div className="flex gap-2 justify-end mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                        </div>
                                    </div>
                                    <div className="text-right mt-3 text-xs text-[#1A2D23]/50 font-bold px-4 flex justify-end gap-2 items-center">
                                        <span>— {msg.name}</span>
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
                    <div className="flex flex-col items-center gap-2 text-[#1A2D23]/30 text-[10px] uppercase font-black tracking-widest text-center">
                        <p>&copy; 2026 Incredibowl. 家的味道，每天新鲜采购。</p>
                        <p>Operated by INCREDIBOWL SERVICES 202603047882 (SA0649425-V)</p>
                    </div>
                </div>
            </footer>

            {/* Integrated Renderers */}
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} updateQuantity={updateQuantity} removeFromCart={removeFromCart} cartTotal={cartTotal} cartCount={cartCount} onAuthOpen={() => { setIsCartOpen(false); setIsAuthOpen(true); }} onClearCart={() => setCart([])} />
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            {selectedDish && (
                <AddOnModal
                    isOpen={isAddOnOpen}
                    onClose={() => setIsAddOnOpen(false)}
                    dish={selectedDish}
                    onAddToCart={handleAddWithAddOns}
                    defaultDate={menuDates[selectedDish.id]?.actualDate}
                    isDaily={selectedDish.id === 6}
                    minDate={minDate}
                    dateLabel={menuDates[selectedDish.id]?.topTag}
                />
            )}
            {/* Feedback Modal */}
            {isFeedbackModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#1A2D23]/40 backdrop-blur-sm" onClick={() => setIsFeedbackModalOpen(false)}></div>
                    <div className="bg-[#FDFBF7] rounded-[32px] w-full max-w-md relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 md:p-8 border-b border-[#E3EADA]">
                            <button onClick={() => setIsFeedbackModalOpen(false)} className="absolute right-6 top-6 w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1A2D23] border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <X size={20} />
                            </button>
                            <h3 className="text-2xl font-black text-[#1A2D23] pr-12">留下真实评价</h3>
                            <p className="text-sm font-medium text-[#1A2D23]/60 mt-2">分享您的用餐体验给邻居们吧</p>
                        </div>
                        <div className="p-6 md:p-8 bg-white">
                            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">你的称呼 (选填居住地)</label>
                                    <input
                                        type="text"
                                        value={feedbackName}
                                        onChange={e => setFeedbackName(e.target.value)}
                                        placeholder="例如: Amy Tan (Pearl Suria)"
                                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E3EADA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] font-medium"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">留言内容</label>
                                    <textarea
                                        value={feedbackText}
                                        onChange={e => setFeedbackText(e.target.value)}
                                        placeholder="阿姨煮的菜好吃吗？"
                                        rows={4}
                                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E3EADA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] font-medium resize-none"
                                        required
                                    ></textarea>
                                </div>
                                <button disabled={feedbackSubmitting} type="submit" className="w-full py-4 mt-2 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
                                    {feedbackSubmitting ? '提交中...' : '提交留言'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
