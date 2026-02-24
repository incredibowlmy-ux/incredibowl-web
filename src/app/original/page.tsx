"use client";

import React, { useState, useEffect } from 'react'
import { ShoppingBag, Heart, Star, Clock, MapPin, Phone, Leaf, Award, X, Plus, Minus, Trash2, Zap, Home, User, CheckCircle, Instagram, Facebook } from 'lucide-react'

// Incredibowl Daily Special Model
const dailySpecial = {
  id: 1,
  name: "山药排骨饭",
  nameEn: "Brain Fuel Rice Bowl",
  description: "今日特供：日本山药 + 黑毛猪排骨。补脑提神，下午meeting不ngantuk。",
  price: 28,
  image: "🥘",
  tags: ["今日主打", "抗 afternoon slump"],
  performance: "专注力 + 记忆力"
}

const drinks = [
  { id: 201, name: "龙井茶", nameEn: "Longjing Tea", price: 4.5, image: "🍵", description: "清香甘甜，去油解腻" },
  { id: 202, name: "铁观音", nameEn: "Tie Guanyin", price: 4.5, image: "🍵", description: "兰花香浓，提神醒脑" },
  { id: 203, name: "老枞水仙", nameEn: "Shui Xian", price: 4.5, image: "🍵", description: "岩骨花香，醇厚回甘" }
]

function App() {
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
  const freeDelivery = cartCount >= 10

  return (
    <div className="min-h-screen bg-kraft font-sans text-incredibowl-text">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-kraft rounded-full shadow-md flex items-center justify-center overflow-hidden border-2 border-incredibowl-secondary">
              <img src="/logo.jpg" alt="Incredibowl Logo" className="w-full h-full object-cover scale-[1.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-incredibowl-text tracking-tighter">Incredibowl</h1>
              <p className="text-[10px] text-incredibowl-primary hidden sm:block font-black uppercase tracking-widest">Old Klang Road 家常味</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['menu', 'reviews', 'faq', 'contact'].map(link => (
              <a key={link} href={`#${link}`} className="text-sm font-black text-incredibowl-text hover:text-incredibowl-primary transition-colors uppercase tracking-widest">{link}</a>
            ))}
          </div>

          <button onClick={() => setIsCartOpen(true)} className="relative p-3 bg-white rounded-full shadow-xl hover:scale-110 transition-all border-2 border-kraft-dark">
            <ShoppingBag className="w-6 h-6 text-incredibowl-primary" strokeWidth={2.5} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-incredibowl-rooster text-white text-[10px] rounded-full flex items-center justify-center font-black animate-pulse shadow-lg">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 bg-kraft overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10 text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-xl border-4 border-kraft-dark">
              <div className="w-2 h-2 bg-incredibowl-primary rounded-full animate-ping" />
              <span className="text-xs font-black text-incredibowl-text uppercase tracking-[0.2em]">今日限量供应 50 份</span>
            </div>
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-[0.9] text-incredibowl-text tracking-tighter">
              我孩子吃的，<br />
              <span className="text-incredibowl-primary italic decoration-accent decoration-8 underline-offset-10 underline">才给你吃</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed italic">
              "不是工厂生产，是 Old Klang Road 邻居阿姨的厨房。3点点开会不 ngantuk，这就是妈妈的标准。"
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start">
              <button
                onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-12 py-6 bg-incredibowl-primary text-white rounded-[32px] font-black text-xl hover:bg-incredibowl-rooster hover:scale-105 transition-all shadow-2xl shadow-primary/30 uppercase tracking-tighter italic"
              >
                今日菜单 →
              </button>
            </div>
          </div>
          <div className="relative group perspective-1000">
            <div className="relative bg-white rounded-[64px] p-8 border-[6px] border-kraft-dark shadow-2xl overflow-hidden group-hover:rotate-2 transition-transform duration-700">
              <div className="relative h-[400px] sm:h-[500px] bg-gradient-to-br from-kraft to-secondary/10 flex items-center justify-center text-[12rem] sm:text-[18rem] rounded-[48px]">
                <span className="group-hover:scale-110 group-hover:rotate-6 transition-transform duration-700">{dailySpecial.image}</span>
              </div>
              <div className="absolute top-12 left-12 flex flex-col gap-3">
                {dailySpecial.tags.map(tag => (
                  <span key={tag} className="px-5 py-2 bg-white/95 backdrop-blur-md text-[10px] font-black text-incredibowl-primary rounded-full shadow-lg border-2 border-kraft-dark uppercase tracking-widest">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-24 bg-incredibowl-primary text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-16 text-center">
          {[
            { icon: User, title: "Mom Standard", desc: "我孩子每天吃的，绝对无味精添加" },
            { icon: Zap, title: "Anti-Slump", desc: "精准控碳，下午 meeting 不困" },
            { icon: Heart, title: "Real Flavor", desc: "巴刹每日直采，6小时极速出餐" }
          ].map((item, i) => (
            <div key={i} className="space-y-6 group">
              <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6 border-2 border-white/10">
                <item.icon className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black uppercase italic tracking-tight">{item.title}</h3>
              <p className="text-white/80 text-lg font-medium italic">"{item.desc}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Menu & Drinks Section */}
      <section id="menu" className="py-24 sm:py-32 bg-kraft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-20 space-y-6">
            <span className="inline-block px-4 py-2 bg-incredibowl-primary/10 text-incredibowl-primary rounded-full text-xs font-black tracking-[0.2em] uppercase tracking-[0.3em]">TODAY'S SPECIAL</span>
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-incredibowl-text tracking-tighter leading-none">今日主打 <span className="text-incredibowl-primary italic">{dailySpecial.name}</span></h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-2 bg-white rounded-[48px] p-8 border-4 border-kraft-dark shadow-xl">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="relative h-80 bg-kraft rounded-[36px] flex items-center justify-center text-9xl shadow-inner active:scale-95 transition-all">
                  <span>{dailySpecial.image}</span>
                </div>
                <div className="space-y-8 flex flex-col justify-center">
                  <div>
                    <h3 className="text-4xl font-black text-incredibowl-text tracking-tighter">{dailySpecial.name}</h3>
                    <p className="text-sm font-black text-secondary tracking-[0.2em] uppercase mt-2 opacity-60">{dailySpecial.nameEn}</p>
                  </div>
                  <p className="text-xl text-gray-600 font-medium italic">"{dailySpecial.description}"</p>
                  <div className="flex items-center justify-between pt-4 border-t-2 border-kraft">
                    <span className="text-5xl font-black text-incredibowl-primary tracking-tighter italic">RM{dailySpecial.price}</span>
                    <button onClick={() => addToCart(dailySpecial)} className="px-12 py-5 bg-incredibowl-primary text-white rounded-[24px] font-black text-lg hover:bg-incredibowl-rooster transition-all shadow-xl shadow-primary/20 scale-105 active:scale-95">加入购物车</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-8 border-4 border-kraft-dark shadow-xl h-full">
              <h3 className="text-xl font-black text-incredibowl-text uppercase tracking-widest mb-8 flex items-center gap-3">🍵 高山原叶茶 <span className="text-sm font-bold opacity-40">RM4.5</span></h3>
              <div className="space-y-4">
                {drinks.map(drink => (
                  <div key={drink.id} className="p-5 rounded-[28px] border-2 border-kraft bg-kraft/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{drink.image}</span>
                        <div>
                          <h4 className="font-black text-incredibowl-text leading-tight">{drink.name}</h4>
                          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">{drink.nameEn}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => addToCart(drink, { ice: true })} className="flex-1 py-3 bg-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-incredibowl-primary hover:text-white transition-all border-2 border-kraft-dark shadow-sm">加冰 Cold</button>
                      <button onClick={() => addToCart(drink, { ice: false })} className="flex-1 py-3 bg-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-incredibowl-primary hover:text-white transition-all border-2 border-kraft-dark shadow-sm">热饮 Hot</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wall of Love Section */}
      <section id="reviews" className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-24 space-y-6">
            <span className="inline-block px-5 py-2 bg-incredibowl-secondary/10 text-incredibowl-secondary rounded-full text-xs font-black tracking-[0.3em] uppercase">WALL OF LOVE</span>
            <h2 className="text-4xl sm:text-6xl font-black text-incredibowl-text tracking-tighter italic leading-none">大家的 <span className="text-incredibowl-primary">Incredibowl</span> 时刻</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {/* The Capybara Mascot */}
            <div className="bg-kraft rounded-[56px] p-10 border-4 border-kraft-dark shadow-xl hover:rotate-1 transition-transform relative group">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-6xl border-4 border-kraft-dark animate-bounce">🦦</div>
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5 fill-accent text-accent" />)}
              </div>
              <p className="text-3xl font-black text-incredibowl-text tracking-tighter leading-tight italic mb-8">"yum, yum, yum, raining taco"</p>
              <div className="flex items-center gap-4 border-t-2 border-kraft-dark pt-6">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-md border-2 border-kraft-dark">🥘</div>
                <div>
                  <p className="font-black text-incredibowl-text uppercase tracking-tighter italic">Incredibowl Capybara</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Chief Happiness Officer</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[56px] p-10 border-4 border-kraft-dark shadow-xl hover:-rotate-1 transition-transform">
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5 fill-accent text-accent" />)}
              </div>
              <p className="text-xl font-bold text-gray-700 italic leading-relaxed mb-8">"吃了这里的山药排骨，下午真的不会想睡觉！比咖啡还有效。包装也超级有仪式感的。"</p>
              <div className="flex items-center gap-4 pt-6 border-t-2 border-kraft">
                <div className="w-12 h-12 bg-kraft rounded-2xl flex items-center justify-center font-black shadow-sm">JD</div>
                <div>
                  <p className="font-black text-incredibowl-text tracking-tighter italic">Jason D.</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Tech Lead @ TRX</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[56px] p-10 border-4 border-kraft-dark shadow-xl hover:rotate-1 transition-transform">
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5 fill-accent text-accent" />)}
              </div>
              <p className="text-xl font-bold text-gray-700 italic leading-relaxed mb-8">"感觉就像妈妈煮的一样，很干净。尤其那个手写感谢卡，在CBD这种冷冰冰的地方真的很暖心。"</p>
              <div className="flex items-center gap-4 pt-6 border-t-2 border-kraft">
                <div className="w-12 h-12 bg-kraft rounded-2xl flex items-center justify-center font-black shadow-sm">SL</div>
                <div>
                  <p className="font-black text-incredibowl-text tracking-tighter italic">Sarah Lim</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">HR @ KLCC</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 sm:py-32 bg-kraft relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-5xl sm:text-7xl font-black text-incredibowl-text tracking-tighter uppercase leading-none italic">常见问题 FAQ</h2>
            <p className="text-gray-500 font-black uppercase tracking-[0.4em] text-xs">Everything you need to know</p>
          </div>

          <div className="grid gap-6">
            {[
              { q: "是否清真 (Halal Friendly)?", a: "我们采用无猪肉、无猪油食材。虽未获官方认证，但所有肉类均来自清真认证供应商。" },
              { q: "配送范围在哪里?", a: "目前的配送主打 KL CBD 区域，包括 TRX, KLCC, Mid Valley, Bangsar, Sentral 等。" },
              { q: "需要提前预订吗?", a: "建议提前 1 天或在当天 10:00 前下单，以确保食材绝对新鲜。" },
              { q: "有提供公司集体订餐优惠吗?", a: "有的！10 份起免运费，20 份起更有团体折扣。欢迎 WhatsApp 咨询。" }
            ].map((item, i) => (
              <details key={i} className="group bg-white rounded-[32px] border-4 border-kraft-dark shadow-lg overflow-hidden">
                <summary className="flex items-center justify-between p-8 cursor-pointer font-black text-xl text-incredibowl-text list-none uppercase tracking-tighter italic">
                  {item.q}
                  <Plus className="w-8 h-8 group-open:rotate-45 transition-transform duration-300" strokeWidth={4} />
                </summary>
                <div className="px-8 pb-8 text-gray-600 font-bold leading-relaxed italic border-t-2 border-kraft">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 sm:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <h2 className="text-6xl sm:text-8xl font-black text-incredibowl-text tracking-tighter uppercase leading-none italic mb-20">联系阿姨</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 max-w-4xl mx-auto">
            <div className="bg-kraft rounded-[56px] p-12 border-4 border-kraft-dark shadow-xl group hover:scale-105 transition-transform duration-500">
              <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-lg border-2 border-kraft-dark">
                <Phone className="w-12 h-12 text-incredibowl-primary" strokeWidth={3} />
              </div>
              <h3 className="font-black text-incredibowl-text text-3xl italic tracking-tighter mb-4 uppercase">WhatsApp</h3>
              <p className="text-xl font-black text-incredibowl-primary tracking-widest">012-345-6789</p>
            </div>
            <div className="bg-kraft rounded-[56px] p-12 border-4 border-kraft-dark shadow-xl group hover:scale-105 transition-transform duration-500">
              <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-lg border-2 border-kraft-dark">
                <Clock className="w-12 h-12 text-incredibowl-secondary" strokeWidth={3} />
              </div>
              <h3 className="font-black text-incredibowl-text text-3xl italic tracking-tighter mb-4 uppercase">Hours</h3>
              <p className="text-xl font-black text-gray-500 tracking-widest">MON - FRI<br />10am - 2pm</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-incredibowl-text text-white py-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-12">
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 bg-kraft rounded-2xl overflow-hidden border-2 border-white/20">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover scale-[1.5]" />
            </div>
            <span className="text-4xl font-black tracking-tighter uppercase italic">Incredibowl</span>
          </div>
          <p className="text-gray-500 font-black uppercase tracking-[0.5em] text-[10px]">© 2026 Incredibowl. Made with ❤️ by Neighbor Auntie.</p>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-incredibowl-text/80 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-lg bg-kraft h-full shadow-2xl flex flex-col border-l-[12px] border-kraft-dark animate-in slide-in-from-right duration-500">
            <div className="p-10 bg-incredibowl-primary text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
              <h2 className="text-4xl font-black uppercase tracking-tighter italic flex items-center gap-5 z-10"><ShoppingBag className="w-10 h-10" /> 购物车 ({cartCount})</h2>
              <button onClick={() => setIsCartOpen(false)} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 z-10"><X size={32} strokeWidth={4} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center py-32 opacity-30">
                  <ShoppingBag className="w-24 h-24 mx-auto mb-6" />
                  <p className="font-black uppercase tracking-widest italic">空空如也</p>
                </div>
              ) : (
                cart.map((item, i) => (
                  <div key={item.cartItemId} className="bg-white rounded-[32px] p-6 border-4 border-kraft-dark shadow-xl group flex gap-6 animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="w-20 h-20 bg-kraft rounded-2xl flex items-center justify-center text-4xl shadow-inner">{item.image}</div>
                    <div className="flex-1">
                      <h4 className="font-black text-xl italic tracking-tighter uppercase">{item.name} {item.ice !== undefined && <span className="text-[10px] bg-secondary/10 px-2 py-1 rounded-full not-italic">{item.ice ? 'ICE' : 'HOT'}</span>}</h4>
                      <p className="text-incredibowl-primary font-black text-2xl italic tracking-tighter">RM{item.price}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-8 h-8 rounded-lg bg-kraft border-2 border-kraft-dark flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Minus size={16} strokeWidth={4} /></button>
                        <span className="font-black text-xl">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-8 h-8 rounded-lg bg-kraft border-2 border-kraft-dark flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><Plus size={16} strokeWidth={4} /></button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-gray-200 hover:text-rooster transition-colors"><Trash2 size={24} /></button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-10 bg-white border-t-[8px] border-kraft-dark space-y-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
                <div className="flex justify-between items-baseline mb-6">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter opacity-40">Total</h3>
                  <p className="text-6xl font-black text-incredibowl-primary italic tracking-tighter leading-none">RM{cartTotal}</p>
                </div>
                {!freeDelivery && <p className="text-center text-[10px] font-black uppercase tracking-widest text-secondary mb-4 italic">再买 {10 - cartCount} 份即可免费配送 🎁</p>}
                <button className="w-full py-8 bg-gradient-to-br from-incredibowl-primary to-incredibowl-secondary text-white rounded-[40px] font-black text-3xl italic shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-6 uppercase tracking-tighter">
                  <Phone fill="white" className="w-10 h-10" /> WhatsApp 下单 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] sm:hidden w-full px-6">
        <button
          onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full bg-incredibowl-primary text-white p-6 rounded-[32px] font-black text-2xl italic tracking-tighter shadow-[0_20px_60px_rgba(var(--primary-rgb),0.5)] flex items-center justify-between border-4 border-white/20"
        >
          <span>ORDER NOW 🥗</span>
          <span className="bg-white/20 px-4 py-1 rounded-full text-sm font-black not-italic tracking-widest">RM{dailySpecial.price}</span>
        </button>
      </div>
    </div>
  )
}

export default App
