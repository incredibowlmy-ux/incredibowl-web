"use client";

import Image from "next/image";
import Link from 'next/link';
import React, { useState, useEffect } from 'react'
import { ShoppingBag, Star, X, Plus, Minus, Trash2, Heart, Smile, MapPin, Coffee, MessageCircle, Phone, Sparkles } from 'lucide-react'

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
    mood: "Monday Fuel: The energy boost you need to start the week right."
  },
  {
    id: 2,
    day: "Tue / 周二",
    name: "山药云耳海陆双鲜小炒",
    nameEn: "Surf & Turf Yam Stir-fry",
    description: "Nourishing yam and wood ear mushroom tossed with fresh seafood and meat. Light yet fulfilling.",
    price: 22.90,
    image: "🥘",
    mood: "Tuesday Balance: Light on the stomach, heavy on the nutrients."
  },
  {
    id: 3,
    day: "Wed / 周三",
    name: "招牌当归回味蒸鸡全腿",
    nameEn: "Signature Angelica Chicken",
    description: "Our #1 best-seller. Infused with premium herbs for a soul-warming recovery meal.",
    price: 26.90,
    image: "/angelica_chicken.png",
    mood: "Wednesday Revival: Mid-week healing for the busy soul."
  },
  {
    id: 4,
    day: "Thu / 周四",
    name: "马铃薯炖五花肉",
    nameEn: "Home-style Pork & Potato Stew",
    description: "Melt-in-your-mouth pork belly slow-cooked with organic potatoes. Just like home.",
    price: 21.90,
    image: "🥘",
    mood: "Thursday Comfort: A warm bowl of nostalgia to power through the finish line."
  },
  {
    id: 5,
    day: "Fri / 周五",
    name: "金黄葱香煎鸡腿汤",
    nameEn: "Scallion Pan-fried Chicken Soup",
    description: "A clear, fragrant broth that marks the perfect end to a productive week.",
    price: 23.90,
    image: "🍲",
    mood: "Friday Serenity: Liquid gold for your body and mind."
  }
]

const drinks = [
  { id: 201, name: "Garden Longjing / 西湖龙井", price: 4.5, image: "🍵", mood: "Peaceful morning" },
  { id: 202, name: "Honey Tie Guanyin / 安溪铁观音", price: 4.5, image: "🍵", mood: "Sunny afternoon" },
  { id: 203, name: "Warm Shui Xian / 岩韵水仙", price: 4.5, image: "🍵", mood: "Cozy rainy day" }
]

const stickyNotes = [
  { text: "Tastes like home! No MSG for real.", author: "Joey", color: "bg-yellow-100" },
  { text: "My go-to lunch at the office.", author: "Sam", color: "bg-pink-100" },
  { text: "The soup is so nourishing.", author: "Linh", color: "bg-green-100" },
  { text: "Finally, actual home-cooked food.", author: "Ben", color: "bg-blue-100" }
]

export default function LandingPage() {
  const [cart, setCart] = useState<any[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeDish, setActiveDish] = useState(weeklyMenu[2]) // Default to Wednesday's star dish

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
    <div className="min-h-screen bg-[#FEFAE0] font-sans text-[#264653]">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@300;500;700&family=Fredoka+One&display=swap');
        h1, h2, h3 { font-family: 'Fredoka One', cursive; }
        body { font-family: 'Quicksand', sans-serif; }
      `}</style>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-4' : 'bg-transparent py-8'}`}>
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-xl border-4 border-[#F4A261]/20 hover:scale-110 transition-transform duration-500">
              <Image src="/logo_hd.png" alt="Incredibowl Logo" width={64} height={64} className="scale-110" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter text-[#E76F51] leading-none mb-1">Incredibowl</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4A261]">Cook with Sincere Heart</p>
            </div>
          </div>

          <button onClick={() => setIsCartOpen(true)} className="relative p-4 bg-white rounded-3xl shadow-xl hover:scale-110 transition-transform flex items-center gap-4">
            <ShoppingBag size={24} className="text-[#F4A261]" />
            <span className="font-bold text-sm hidden sm:block">My Lunchbox</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#E76F51] text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 overflow-hidden">
        <div className="absolute top-20 right-[-10%] w-[60%] aspect-square bg-[#E9C46A] opacity-10 rounded-full blur-[100px]" />
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-md text-[#E76F51] font-bold text-sm">
              <Sparkles size={18} />
              <span>Today's pot is ready! Only 50 portions.</span>
            </div>
            <h1 className="text-6xl md:text-8xl text-[#264653] leading-tight">
              Taste <span className="text-[#F4A261]">Home.</span><br />
              Love <span className="text-[#F4A261]">Healthy.</span>
            </h1>
            <p className="text-xl text-[#264653]/70 font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
              "Authentic recipes, mom-approved ingredients, and zero MSG. Because you deserve a lunch that loves you back."
              <br /><span className="text-sm opacity-60">老 Klang Road 的味道，没有味精，只有真心。</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-12 py-6 bg-[#E76F51] text-white rounded-[40px] font-bold text-xl hover:bg-[#F4A261] transition-colors shadow-2xl shadow-[#E76F51]/30"
              >
                Order Now / 立即订餐
              </button>
              <div className="px-8 py-6 bg-white border-4 border-[#F4A261]/20 rounded-[40px] text-center">
                <p className="text-xs uppercase tracking-widest font-black text-[#F4A261]">Weekly Pass</p>
                <p className="text-xl font-bold">RM 97 / Week</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="w-full aspect-square bg-white rounded-[100px] flex items-center justify-center shadow-2xl rotate-2 relative group overflow-hidden border-8 border-white">
              <Image
                src={activeDish.image.startsWith('/') ? activeDish.image : "/angelica_chicken.png"}
                alt="Featured Dish"
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700"
              />
            </div>
            <div className="absolute top-10 left-[-40px] p-6 bg-[#E9C46A] text-white rounded-[32px] font-bold shadow-xl rotate-[-12deg] z-10">
              No MSG<br />100% Sincere
            </div>
          </div>
        </div>
      </section>

      {/* Menu & Cart Section */}
      <section id="menu" className="py-32 bg-white rounded-t-[100px] shadow-[0_-50px_100px_rgba(231,111,81,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20 text-center md:text-left">
            <div className="space-y-4">
              <span className="text-[#F4A261] font-bold uppercase tracking-widest text-sm italic">Daily Specials / 每日精选</span>
              <h2 className="text-5xl md:text-6xl text-[#264653]">The Weekly Rotation</h2>
            </div>
            <p className="text-[#264653]/40 text-sm max-w-[200px]">We cook one soul-warming dish each day to ensure every bite is perfect. <br /> 每天专注一道菜，把味道做到极致。</p>
          </div>

          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 mb-20">
            {weeklyMenu.map((dish) => (
              <button
                key={dish.id}
                onClick={() => setActiveDish(dish)}
                className={`p-8 rounded-[40px] text-left transition-all ${activeDish.id === dish.id ? 'bg-[#E76F51] text-white shadow-2xl scale-105' : 'bg-[#FAF9F6] border-4 border-[#F4A261]/5 hover:border-[#F4A261]/20'}`}
              >
                <span className={`text-[10px] uppercase font-black tracking-widest mb-4 block ${activeDish.id === dish.id ? 'text-white/60' : 'text-[#F4A261]'}`}>{dish.day}</span>
                <div className="w-full aspect-square bg-white/10 rounded-2xl mb-6 flex items-center justify-center text-4xl overflow-hidden border border-black/5 relative">
                  {dish.image.startsWith('/') ? <Image src={dish.image} alt={dish.name} fill className="object-cover" /> : dish.image}
                </div>
                <h4 className="font-bold text-lg leading-tight mb-2">{dish.nameEn}</h4>
                <p className={`text-xs ${activeDish.id === dish.id ? 'text-white/60' : 'text-gray-400'}`}>RM {dish.price.toFixed(2)}</p>
              </button>
            ))}
          </div>

          <div className="bg-[#FEFAE0] rounded-[60px] p-12 flex flex-col md:flex-row gap-12 items-center border-4 border-[#E9C46A]/20">
            <div className="w-80 h-80 bg-white rounded-[40px] flex items-center justify-center shadow-inner overflow-hidden relative border-8 border-white">
              {activeDish.image.startsWith('/') ? <Image src={activeDish.image} alt={activeDish.name} fill className="object-cover" /> : <span className="text-9xl">{activeDish.image}</span>}
            </div>
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-4xl text-[#264653]">{activeDish.name}</h3>
                <p className="text-lg font-black text-[#E76F51] mt-2 italic">{activeDish.nameEn}</p>
              </div>
              <p className="text-lg leading-relaxed text-[#264653]/60 italic font-medium">"{activeDish.description}"</p>
              <div className="flex items-center justify-between pt-6 border-t-2 border-[#E9C46A]/20">
                <span className="text-5xl font-black text-[#264653]">RM {activeDish.price.toFixed(2)}</span>
                <button
                  onClick={() => addToCart(activeDish)}
                  className="px-10 py-5 bg-[#264653] text-white rounded-[32px] font-bold text-lg hover:bg-[#E76F51] transition-colors"
                >
                  Add to Bag / 订餐
                </button>
              </div>
            </div>
          </div>

          <div className="mt-20 bg-[#FAF9F6] rounded-[60px] p-10 border-4 border-[#F4A261]/10">
            <h3 className="text-2xl text-[#264653] mb-8 flex items-center gap-3">🍵 Auntie's Favorites</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {drinks.map(drink => (
                <div key={drink.id} className="p-6 bg-white rounded-[40px] border-2 border-transparent hover:border-[#E76F51]/20 transition-all group">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-5">
                      <span className="text-4xl group-hover:scale-110 transition-transform">{drink.image}</span>
                      <div>
                        <h4 className="font-bold text-lg">{drink.name}</h4>
                        <p className="text-[10px] text-[#264653]/30 font-bold uppercase tracking-widest">{drink.mood}</p>
                      </div>
                    </div>
                    <span className="font-bold text-[#E76F51]">RM 4.5</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addToCart(drink, { ice: true })} className="flex-1 py-3 bg-[#FEFAE0] text-[#264653] rounded-2xl text-[10px] font-black uppercase hover:bg-[#F4A261] hover:text-white transition-colors">Ice</button>
                    <button onClick={() => addToCart(drink, { ice: false })} className="flex-1 py-3 bg-[#FEFAE0] text-[#264653] rounded-2xl text-[10px] font-black uppercase hover:bg-[#F4A261] hover:text-white transition-colors">Hot</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Neighbor's Noticeboard */}
      <section className="py-32 bg-[#FEFAE0]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-7xl mb-6">Neighbor's Noticeboard</h2>
            <p className="text-xl font-medium text-[#264653]/50">Community reviews from the OKR neighborhood.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stickyNotes.map((note, i) => (
              <div key={i} className={`${note.color} p-10 rounded-lg shadow-xl transform ${i % 2 === 0 ? 'rotate-2' : '-rotate-3'} hover:rotate-0 transition-transform cursor-pointer relative`}>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/50 border border-black/5" />
                <p className="text-lg font-bold italic mb-6 leading-relaxed">"{note.text}"</p>
                <p className="text-xs font-black uppercase tracking-widest text-[#264653]/40">-- {note.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 bg-white rounded-t-[100px] border-t-8 border-[#FEFAE0]">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-gray-100 pb-12">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white border-4 border-[#FEFAE0] rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                <Image src="/logo_hd.png" alt="Logo" width={64} height={64} className="scale-110" />
              </div>
              <div className="text-left">
                <span className="text-3xl font-bold tracking-tighter text-[#E76F51]">Incredibowl.my</span>
                <p className="text-[10px] font-bold text-[#F4A261] tracking-widest uppercase">Cook with Mum's Sincere Heart</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-xs font-black uppercase tracking-widest text-[#264653]/40">
              <Link href="/privacy" className="hover:text-[#E76F51] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[#E76F51] transition-colors">Terms of Service</Link>
              <Link href="/refund" className="hover:text-[#E76F51] transition-colors">Refund & Cancellation</Link>
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-8 text-center">
            <div className="space-y-4">
              <p className="text-lg font-bold">Contact Us / 联系我们</p>
              <div className="flex justify-center gap-8 text-sm">
                <a href="https://wa.me/60103370197" className="flex items-center gap-2 text-[#E76F51] font-bold"><Phone size={18} /> 010-337 0197</a>
                <span className="text-[#264653]/20">|</span>
                <a href="mailto:incredibowl.my@gmail.com" className="flex items-center gap-2 text-[#E76F51] font-bold">incredibowl.my@gmail.com</a>
              </div>
              <p className="text-xs text-[#264653]/40">📍 Pearl Suria / Millerz Square / OUG, Kuala Lumpur</p>
            </div>
          </div>

          <div className="flex justify-center flex-wrap gap-12 font-bold text-sm text-[#264653]/30 uppercase tracking-[0.2em]">
            <span>Old Klang Road</span>
            <span>No MSG</span>
            <span>Home Taste</span>
          </div>
          <p className="text-xs font-medium text-[#264653]/20">&copy; 2026 Incredibowl. Made with Sincere Heart in KL.</p>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-[#264653]/40 backdrop-blur-md" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-[#FEFAE0] h-full shadow-2xl flex flex-col border-l-8 border-[#E9C46A]/20">
            <div className="p-12 border-b-4 border-[#E9C46A]/10 flex justify-between items-center">
              <h2 className="text-3xl tracking-tighter">My Lunchbox ({cartCount})</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-4 bg-white rounded-3xl hover:scale-110 transition-transform"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8">
              {cart.length === 0 ? (
                <div className="text-center py-20 opacity-20">
                  <MessageCircle size={64} className="mx-auto mb-6" />
                  <p className="font-black uppercase tracking-widest text-sm">Nothing packed yet!</p>
                </div>
              ) : (
                cart.map((item, i) => (
                  <div key={item.cartItemId} className="bg-white rounded-[40px] p-8 border-4 border-transparent hover:border-[#F4A261]/10 transition-all flex gap-8">
                    <div className="w-20 h-20 bg-[#FEFAE0] rounded-[24px] flex items-center justify-center text-4xl overflow-hidden relative">
                      {item.image.startsWith('/') ? <Image src={item.image} alt={item.name} fill className="object-cover" /> : item.image}
                    </div>
                    <div className="flex-1 space-y-3">
                      <h4 className="font-bold text-xl">{item.name} {item.ice !== undefined && <span className="text-[10px] bg-[#E9C46A] text-white px-3 py-1 rounded-full ml-2">{item.ice ? 'ICY' : 'WARM'}</span>}</h4>
                      <p className="text-[#E76F51] font-black text-2xl">RM {item.price.toFixed(2)}</p>
                      <div className="flex items-center gap-6 pt-2">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-8 h-8 rounded-xl bg-[#FEFAE0] flex items-center justify-center hover:bg-[#F4A261] hover:text-white transition-colors"><Minus size={16} /></button>
                        <span className="font-black text-lg">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-8 h-8 rounded-xl bg-[#FEFAE0] flex items-center justify-center hover:bg-[#F4A261] hover:text-white transition-colors"><Plus size={16} /></button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-gray-200 hover:text-[#E76F51] transition-colors self-start"><Trash2 size={24} /></button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-12 bg-white rounded-t-[80px] space-y-10 shadow-[0_-30px_60px_rgba(38,70,83,0.05)]">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-sm font-black uppercase text-[#264653]/20 tracking-widest">Total Bill</h3>
                  <p className="text-5xl font-black text-[#264653]">RM {cartTotal.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-[#E9C46A]/20 rounded-2xl border border-[#E9C46A]/30">
                  <p className="text-xs font-bold text-[#E76F51] text-center italic">Tip: Pay with Bank QR to get a FREE Miso Soup! 🥣</p>
                </div>
                <button className="w-full py-8 bg-[#E76F51] text-white rounded-[40px] font-bold text-2xl hover:bg-[#F4A261] transition-all shadow-2xl shadow-[#E76F51]/20 flex items-center justify-center gap-6">
                  <Phone size={28} /> WhatsApp Order →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
