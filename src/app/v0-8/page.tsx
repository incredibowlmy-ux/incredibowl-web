"use client";

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Leaf, ShoppingBag, ShieldCheck, Star, Clock, MapPin, ChevronRight, Play, CheckCircle2, X, Thermometer, Droplets, UtensilsCrossed, Phone, ArrowRight, Plus, Minus, Trash2 } from 'lucide-react'

// Data models
const dishes = [
  {
    id: 1,
    day: "Monday",
    name: "山药排骨饭",
    nameEn: "Vitality Bone Broth Bowl",
    description: "Lean Protein + Japanese Nagaimo. Designed for cognitive performance and steady digestion.",
    price: 28,
    image: "🍱",
    macros: { carb: "45g", protein: "32g", fat: "12g", cal: "420kcal" },
    ingredients: [
      { name: "Japanese Nagaimo", source: "Cameron Highlands", benefit: "Digestive Health" },
      { name: "Iberico Spare Ribs", source: "Sustainable Farm", benefit: "Essential Amino Acids" },
      { name: "Jasmine Brown Rice", source: "Local Paddy", benefit: "Slow Release Energy" }
    ]
  },
  {
    id: 2,
    day: "Tuesday",
    name: "三文鱼能量饭",
    nameEn: "Omega-3 Performance Bowl",
    description: "Miso-glazed Salmon + Superfoods. High Omega-3 for sustained focus and eye health.",
    price: 32,
    image: "🥗",
    macros: { carb: "38g", protein: "28g", fat: "18g", cal: "450kcal" },
    ingredients: [
      { name: "Atlantic Salmon", source: "Cold Water Farm", benefit: "Omega-3 Brain Support" },
      { name: "Quinoa & Rice", source: "Ancient Grains", benefit: "Low Glycemic Index" },
      { name: "Baby Spinach", source: "Organic Highlands", benefit: "Magnesium Boost" }
    ]
  },
  {
    id: 3,
    day: "Wednesday",
    name: "人参黄酒鸡饭",
    nameEn: "Cognitive Recovery Bowl",
    description: "Corn-fed Chicken + Ginseng. Ancient recovery tradition meets modern energy needs.",
    price: 26,
    image: "🥘",
    macros: { carb: "42g", protein: "35g", fat: "8g", cal: "380kcal" },
    ingredients: [
      { name: "Corn-fed Chicken", source: "Free Range", benefit: "High Bioavailability Protein" },
      { name: "Red Ginseng", source: "Korean Export", benefit: "Adaptogenic Energy" },
      { name: "Goji Berries", source: "Premium Grade", benefit: "Antioxidant Rich" }
    ]
  },
  {
    id: 4,
    day: "Thursday",
    name: "胡桃木耳豆腐饭",
    nameEn: "Plant-Based Focus Bowl",
    description: "Walnut + Silken Tofu. High nutrient density without the heavy feel of animal proteins.",
    price: 24,
    image: "🍲",
    macros: { carb: "35g", protein: "22g", fat: "14g", cal: "340kcal" },
    ingredients: [
      { name: "Silken Tofu", source: "Local Artisan", benefit: "Clean Soy Protein" },
      { name: "Roasted Walnuts", source: "California", benefit: "Neuroprotective Fats" },
      { name: "Black Fungus", source: "Wood Grown", benefit: "Phytochemical Energy" }
    ]
  },
  {
    id: 5,
    day: "Friday",
    name: "草饲牛肉能量饭",
    nameEn: "Iron-Rich Muscle Fuel",
    description: "NZ Grass-fed Beef + Iron. Designed to combat end-of-week fatigue and replenish iron.",
    price: 35,
    image: "🥣",
    macros: { carb: "48g", protein: "40g", fat: "12g", cal: "490kcal" },
    ingredients: [
      { name: "Grass-fed Beef", source: "New Zealand", benefit: "High Iron & Zinc" },
      { name: "Pickled Beetroot", source: "Home Fermented", benefit: "Nitrate Performance" },
      { name: "Sweet Potato", source: "Local Valley", benefit: "Complex Energy" }
    ]
  }
]

// Determine today's dish
const todayIdx = Math.max(0, Math.min(4, new Date().getDay() - 1)) // 0 (Mon) to 4 (Fri)
const dailySpecialDefault = dishes[todayIdx]

const drinks = [
  { id: 201, name: "Longjing Cold Brew", price: 4.5, image: "🍵", note: "Antioxidant Rich" },
  { id: 202, name: "Tie Guanyin Oolong", price: 4.5, image: "🍵", note: "Metabolism Boost" },
  { id: 203, name: "Aged Shui Xian", price: 4.5, image: "🍵", note: "Digestion Support" }
]

function Incredibowl() {
  const router = useRouter()
  const [cart, setCart] = useState<any[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isAddOnModalOpen, setIsAddOnModalOpen] = useState(false)
  const [selectedDishForAddOn, setSelectedDishForAddOn] = useState<any>(null)
  const [activeDish, setActiveDish] = useState<any>(dailySpecialDefault)
  const [user, setUser] = useState<any>(null)

  const isToday = (dayName: string) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return days[new Date().getDay()] === dayName
  }

  // Sync cart and user from localStorage
  useEffect(() => {
    const storedCart = localStorage.getItem('incredibowl_cart')
    const storedUser = localStorage.getItem('incredibowl_user')
    if (storedCart) setCart(JSON.parse(storedCart))
    if (storedUser) setUser(JSON.parse(storedUser))

    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sync cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('incredibowl_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (item: any, options: any = {}) => {
    // If it's a dish, show add-on modal first
    if (item.macros && !options.isAddOnStage) {
      setSelectedDishForAddOn(item)
      setIsAddOnModalOpen(true)
      return
    }

    setCart(prev => {
      const cartItemId = options.ice !== undefined ? `${item.id}-${options.ice}` : item.id
      const existing = prev.find((i: any) => i.cartItemId === cartItemId)
      if (existing) {
        return prev.map((i: any) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...item, cartItemId, quantity: 1, ...options }]
    })

    if (options.isAddOnStage) {
      setIsAddOnModalOpen(false)
      setIsCartOpen(true)
    } else if (!item.macros) { // Direct drinks should also open cart
      setIsCartOpen(true)
    }
  }

  const handleSkipAddOn = () => {
    if (selectedDishForAddOn) {
      addToCart(selectedDishForAddOn, { isAddOnStage: true })
    }
  }

  const handleAddWithTea = (tea: any, ice: boolean) => {
    if (selectedDishForAddOn) {
      // Add dish first without triggering modal
      setCart(prev => {
        const item = selectedDishForAddOn
        const cartItemId = item.id
        const existing = prev.find((i: any) => i.cartItemId === cartItemId)
        let newCart = []
        if (existing) {
          newCart = prev.map((i: any) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i)
        } else {
          newCart = [...prev, { ...item, cartItemId, quantity: 1 }]
        }

        // Then add tea
        const teaItemId = `${tea.id}-${ice}`
        const existingTea = newCart.find((i: any) => i.cartItemId === teaItemId)
        if (existingTea) {
          return newCart.map((i: any) => i.cartItemId === teaItemId ? { ...i, quantity: i.quantity + 1 } : i)
        }
        return [...newCart, { ...tea, cartItemId: teaItemId, quantity: 1, ice }]
      })
      setIsAddOnModalOpen(false)
      setIsCartOpen(true)
    }
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

          <div className="flex items-center gap-6">
            {user ? (
              <Link href="/v0-8/account" className="flex items-center gap-3 px-6 py-3 bg-white border border-[#4F6D7A]/10 text-[#2D3142] rounded-full font-bold text-sm hover:bg-[#F7F9F9] transition-colors group">
                <div className="w-6 h-6 bg-[#4F6D7A]/10 rounded-full flex items-center justify-center text-xs">🥘</div>
                <span className="max-w-[100px] truncate">{user.name}</span>
              </Link>
            ) : (
              <Link href="/v0-8/login" className="px-6 py-3 text-[#4F6D7A] font-bold text-sm uppercase tracking-widest hover:text-[#2D3142] transition-colors">
                Login
              </Link>
            )}
            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-3 px-6 py-3 bg-[#4F6D7A] text-white rounded-full font-bold text-sm hover:translate-y-[-2px] transition-transform shadow-lg shadow-[#4F6D7A]/20 group">
              <ShoppingBag size={18} className="group-hover:rotate-12 transition-transform" />
              <span>Bag</span>
              {cartCount > 0 && <span className="bg-white text-[#4F6D7A] px-2 rounded-md text-[10px]">{cartCount}</span>}
            </button>
          </div>
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
              {Object.entries(activeDish.macros as Record<string, string>).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{k}</p>
                  <p className="text-xl font-bold text-[#4F6D7A]">{v}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => document.getElementById('weekly')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-12 py-5 border-2 border-[#4F6D7A] text-[#4F6D7A] rounded-full font-black text-lg hover:bg-[#4F6D7A] hover:text-white transition-all shadow-xl shadow-[#4F6D7A]/5"
            >
              View Weekly Lineup
            </button>
          </div>
          <div className="relative group">
            <div className="w-full aspect-square bg-[#EAE6E1] rounded-[80px] flex items-center justify-center text-[20rem] shadow-none group-hover:shadow-[0_40px_100px_rgba(79,109,122,0.15)] transition-all duration-700">
              <span className="group-hover:scale-105 transition-transform duration-700">{activeDish.image}</span>
            </div>
            <div className="absolute -bottom-10 -right-10 p-10 bg-white rounded-[40px] shadow-2xl border border-gray-100 flex flex-col gap-4">
              <ShieldCheck className="text-green-500 w-8 h-8" />
              <p className="font-bold text-sm leading-tight text-gray-400">Certified Anti-Slump<br />Technology</p>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Lineup Section */}
      <section id="weekly" className="py-24 bg-white border-y border-gray-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
              <span className="text-[#4F6D7A] font-black uppercase tracking-[0.3em] text-[10px] mb-4 block">The Schedule</span>
              <h2 className="text-5xl font-black tracking-tight">Weekly <span className="text-[#4F6D7A]">Fuel Lineup.</span></h2>
            </div>
            <p className="text-gray-400 max-w-sm text-sm font-medium italic">
              We focus on one single performance-optimized dish per day. Zero MSG, maximum focus.
            </p>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
            {dishes.map((dish: any) => {
              const current = isToday(dish.day)
              const selected = activeDish.id === dish.id

              return (
                <button
                  key={dish.id}
                  onClick={() => setActiveDish(dish)}
                  className={`flex-shrink-0 w-72 snap-center rounded-[40px] p-8 transition-all duration-500 text-left border-2 ${selected ? 'bg-[#4F6D7A] border-[#4F6D7A] text-white' : 'bg-[#F7F9F9] border-transparent text-[#2D3142] hover:border-[#4F6D7A]/20'}`}
                >
                  <div className="flex justify-between items-start mb-12">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${selected ? 'text-white/60' : 'text-[#4F6D7A]'}`}>{dish.day}</span>
                    {current && <span className="bg-white text-[#4F6D7A] px-3 py-1 rounded-full text-[8px] font-black uppercase">Today</span>}
                  </div>
                  <div className="text-5xl mb-6">{dish.image}</div>
                  <h4 className="font-black text-xl leading-tight mb-2 uppercase tracking-tight">{dish.nameEn}</h4>
                  <p className={`text-xs font-medium ${selected ? 'text-white/60' : 'text-gray-400'}`}>RM {dish.price}</p>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Ingredient transparency board */}
      <section id="bowl" className="py-32 bg-[#F7F9F9]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-black mb-6">Transparency Board</h2>
            <p className="text-gray-400 font-light text-xl">Every component in the {activeDish.nameEn} has a purpose.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 mb-20">
            {activeDish.ingredients.map((ing: any, i: number) => (
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
            <div className="text-[12rem] flex-shrink-0">{activeDish.image}</div>
            <div className="space-y-10">
              <h3 className="text-4xl md:text-6xl font-black italic">{activeDish.day}&apos;s Clean Comfort.</h3>
              <p className="text-xl text-white/50 leading-relaxed max-w-xl">
                {activeDish.description} Designed for CBD professionals who need to maintain elite focus without the post-lunch crash.
              </p>
              <div className="flex items-center justify-between pt-10 border-t border-white/10">
                <span className="text-6xl font-black tracking-tighter">RM {activeDish.price}</span>
                {isToday(activeDish.day) ? (
                  <button
                    onClick={() => addToCart(activeDish)}
                    className="px-12 py-5 bg-white text-[#2D3142] rounded-full font-black text-xl hover:scale-105 transition-transform"
                  >
                    Add to Fuel Bag
                  </button>
                ) : (
                  <div className="px-12 py-5 bg-white/10 text-white/40 rounded-full font-black text-sm uppercase tracking-widest border border-white/5 cursor-not-allowed">
                    Coming This {activeDish.day}
                  </div>
                )}
              </div>
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

      {/* Add-on Modal */}
      {isAddOnModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#2D3142]/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsAddOnModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[64px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-12 text-center border-b border-gray-100 space-y-4">
              <div className="w-20 h-2 bg-[#4F6D7A]/10 mx-auto rounded-full" />
              <h2 className="text-4xl font-black tracking-tight">Pair with <span className="text-[#4F6D7A]">Refined Caffeine?</span></h2>
              <p className="text-gray-400 font-medium">Add a high-mountain cold brew to complete your performance fuel.</p>
            </div>

            <div className="p-12 overflow-y-auto space-y-6">
              {drinks.map(drink => (
                <div key={drink.id} className="group p-8 border-2 border-gray-50 rounded-[40px] flex flex-col sm:flex-row justify-between items-center hover:border-[#4F6D7A]/20 transition-all gap-6">
                  <div className="flex items-center gap-6">
                    <span className="text-5xl group-hover:scale-110 transition-transform">{drink.image}</span>
                    <div className="text-center sm:text-left">
                      <h4 className="font-bold text-2xl">{drink.name}</h4>
                      <p className="text-[10px] font-black uppercase text-gray-300 tracking-[0.2em] mt-1">{drink.note}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => handleAddWithTea(drink, true)} className="flex-1 sm:flex-none px-8 py-4 bg-[#F7F9F9] rounded-full font-black text-xs hover:bg-[#4F6D7A] hover:text-white transition-all">Iced (+RM4.5)</button>
                    <button onClick={() => handleAddWithTea(drink, false)} className="flex-1 sm:flex-none px-8 py-4 bg-[#F7F9F9] rounded-full font-black text-xs hover:bg-[#4F6D7A] hover:text-white transition-all">Hot (+RM4.5)</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-gray-100 flex justify-center">
              <button onClick={handleSkipAddOn} className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs hover:text-[#4F6D7A] transition-colors">No tea, just the bowl →</button>
            </div>
          </div>
        </div>
      )}

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
                <button
                  onClick={() => router.push('/v0-8/checkout')}
                  disabled={cart.length === 0}
                  className="w-full py-6 bg-[#2D3142] text-white rounded-[32px] font-black text-lg hover:translate-y-[-4px] transition-transform shadow-2xl shadow-[#2D3142]/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
                >
                  Dispatch Orders <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Incredibowl
