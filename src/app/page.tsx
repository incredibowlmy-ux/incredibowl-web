"use client";

import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import AuthModal from '@/components/auth/AuthModal';
import CartDrawer from '@/components/cart/CartDrawer';
import AddOnModal from '@/components/menu/AddOnModal';
import { onAuthChange } from '@/lib/auth';
import NavBar from '@/components/home/NavBar';
import HeroSection from '@/components/home/HeroSection';
import DeliveryWidget from '@/components/home/DeliveryWidget';
import MenuCarousel from '@/components/home/MenuCarousel';
import FeedbackSection from '@/components/home/FeedbackSection';
import Footer from '@/components/home/Footer';
import FloatingChatbot from '@/components/home/FloatingChatbot';
import { weeklyMenu, MenuItem } from '@/data/weeklyMenu';

export default function V4BentoLayout() {
    const [cart, setCart] = useState<any[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
    const [editConfig, setEditConfig] = useState<any>(null);

    // Dynamic delivery dates
    const fallbackTomorrow = new Date();
    fallbackTomorrow.setDate(fallbackTomorrow.getDate() + 1);
    const fallbackDateStr = `${fallbackTomorrow.getFullYear()}-${String(fallbackTomorrow.getMonth() + 1).padStart(2, '0')}-${String(fallbackTomorrow.getDate()).padStart(2, '0')}`;
    const [minDate, setMinDate] = useState<string>(fallbackDateStr);
    const [menuDates, setMenuDates] = useState<any>({});

    useEffect(() => {
        const unsubscribe = onAuthChange((user) => setCurrentUser(user));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const now = new Date();
        const cutoffHour = 22;
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
                newMenuDates[dish.id] = { topTag: `常驻供应 · Daily`, btnText: `加入${relativeDay}的预订 · RM ${dish.price.toFixed(2)}`, disabled: false, actualDate: nextAvailStr };
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

            newMenuDates[dish.id] = { topTag: `${formatMD(targetDate)} ${wdCn[targetWd]} · ${wdEn[targetWd]}`, btnText, disabled: isDisabled, actualDate: formatYMD(targetDate) };
        });

        setMenuDates(newMenuDates);
    }, []);

    const openAddOnModal = (dish: MenuItem) => {
        const dInfo = menuDates[dish.id];
        if (dInfo && dInfo.disabled) return;
        setSelectedDish(dish);
        setIsAddOnOpen(true);
    };

    const handleAddWithAddOns = (dish: any, addOns: { item: any; quantity: number }[], bundleTotalPrice: number, note: string, sDate: string, sTime: string, dishQty: number, editCartItemId?: string) => {
        setCart(prev => {
            const newItems = [...prev];
            if (editCartItemId) {
                const index = newItems.findIndex((i: any) => i.cartItemId === editCartItemId);
                if (index >= 0) {
                    newItems[index] = { ...newItems[index], dish, dishQty, addOns, price: bundleTotalPrice, note, selectedDate: sDate, selectedTime: sTime };
                }
            } else {
                const cartItemId = `${dish.id}-${Date.now()}`;
                newItems.push({ cartItemId, dish, dishQty, addOns, note, selectedDate: sDate, selectedTime: sTime, price: bundleTotalPrice, quantity: 1 });
            }
            return newItems;
        });
        setEditConfig(null);
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

    const handleEditCartItem = (bundle: any) => {
        setSelectedDish(bundle.dish);
        const initQuantities: Record<string, number> = {};
        bundle.addOns.forEach((a: any) => { initQuantities[a.item.id] = a.quantity; });
        setEditConfig({ cartItemId: bundle.cartItemId, quantities: initQuantities, dishQty: bundle.dishQty, note: bundle.note, selectedDate: bundle.selectedDate, selectedTime: bundle.selectedTime });
        setIsCartOpen(false);
        setIsAddOnOpen(true);
    };

    const cartTotal = cart.reduce((sum, item: any) => sum + item.price * item.quantity, 0);
    const cartCount = cart.length;

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2D23] font-sans">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&family=Noto+Sans+SC:wght@400;500;700;900&display=swap');
                h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
                body { font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif; }
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

            <NavBar
                currentUser={currentUser}
                cartCount={cartCount}
                onCartOpen={() => setIsCartOpen(true)}
                onAuthOpen={() => setIsAuthOpen(true)}
            />

            <main className="pt-32 pb-32 px-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
                    <HeroSection />
                    <DeliveryWidget />
                    <MenuCarousel menuDates={menuDates} onOpenAddOn={openAddOnModal} />
                    <FeedbackSection />
                </div>
            </main>

            <Footer />
            <FloatingChatbot />

            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                cart={cart}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                cartTotal={cartTotal}
                cartCount={cartCount}
                onAuthOpen={() => { setIsCartOpen(false); setIsAuthOpen(true); }}
                onClearCart={() => setCart([])}
                onEditItem={handleEditCartItem}
            />
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            {selectedDish && (
                <AddOnModal
                    isOpen={isAddOnOpen}
                    onClose={() => { setIsAddOnOpen(false); setEditConfig(null); }}
                    dish={selectedDish}
                    onAddToCart={handleAddWithAddOns}
                    defaultDate={menuDates[selectedDish.id]?.actualDate}
                    isDaily={selectedDish.id === 6}
                    minDate={minDate}
                    dateLabel={menuDates[selectedDish.id]?.topTag}
                    initialConfig={editConfig}
                />
            )}
        </div>
    );
}
