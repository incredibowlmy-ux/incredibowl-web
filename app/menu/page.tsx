"use client";
import React, { useState, useEffect } from 'react'
import { ShoppingBag, Heart, Star, Clock, MapPin, Phone, Leaf, Award, X, Plus, Minus, Trash2, Zap, Home, User } from 'lucide-react'

// Incredibowl menu - Performance Food for KL office workers
const menuItems = [
  {
    id: 1,
    name: "山药排骨饭",
    nameEn: "Brain Fuel Rice Bowl",
    description: "日本山药 + 黑毛猪排骨，补脑提神，下午meeting不ngantuk",
    price: 28,
    category: "Brain Fuel",
    image: "🥘",
    tags: ["抗 afternoon slump", "孩子最爱"],
    calories: "450 kcal",
    performance: "专注力 + 记忆力"
  },
  {
    id: 2,
    name: "纳豆三文鱼饭",
    nameEn: "Energy Bowl",
    description: "日本纳豆 + 挪威三文鱼，protein满满，能量持续4小时",
    price: 32,
    category: "Energy",
    image: "🐟",
    tags: ["高蛋白", "无味精"],
    calories: "520 kcal",
    performance: "持久能量 + 专注力"
  },
  {
    id: 3,
    name: "藜麦鸡胸肉饭",
    nameEn: "Focus Bowl",
    description: "有机藜麦 + 香草鸡胸，low GI不犯困，brain清晰",
    price: 26,
    category: "Focus",
    image: "🍗",
    tags: ["低GI", "减脂友好"],
    calories: "380 kcal",
    performance: "稳定血糖 + 专注力"
  },
  {
    id: 4,
    name: "鲜虾豆腐饭",
    nameEn: "Fresh Catch Bowl",
    description: "Old Klang Road巴刹新鲜虾，早上买中午煮，鲜甜弹牙",
    price: 30,
    category: "Brain Fuel",
    image: "🦐",
    tags: ["每日鲜货", "高钙"],
    calories: "420 kcal",
    performance: "大脑营养 + 骨骼健康"
  },
  {
    id: 5,
    name: "时蔬糙米饭",
    nameEn: "Clean Bowl",
    description: "5种颜色蔬菜 + 有机糙米，fiber满满，身体轻松",
    price: 22,
    category: "Clean",
    image: "🥗",
    tags: ["高纤维", "排毒"],
    calories: "350 kcal",
    performance: "消化顺畅 + 身体轻盈"
  },
  {
    id: 6,
    name: "药膳鸡汤饭",
    nameEn: "Recovery Bowl",
    description: "妈妈秘方药材 + kampung鸡，滋补不燥热，sick also can eat",
    price: 28,
    category: "Recovery",
    image: "🍲",
    tags: ["温和滋补", "无添加"],
    calories: "480 kcal",
    performance: "免疫提升 + 恢复元气"
  }
]

export default function MenuPage() {
  const [cart, setCart] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find((i: any) => i.id === item.id)
      if (existing) {
        return prev.map((i: any) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (id: any) => {
    setCart(prev => prev.filter((i: any) => i.id !== id))
  }

    const updateQuantity = (id: any, delta: any) => {
    setCart(prev => prev.map((item: any) => {
      if (item.id === id) {
        const newQty = item.quantity + delta
        return newQty > 0 ? { ...item, quantity: newQty } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const freeDelivery = cartCount >= 10

  const categories = ['全部', 'Brain Fuel', 'Energy', 'Focus', 'Clean', 'Recovery']
  const filteredItems = selectedCategory === '全部' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory)

  return (
    <div className="min-h-screen bg-kraft font-sans">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden border-2 border-incredibowl-secondary">
              <span className="text-2xl">🐓</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-incredibowl-text">
                Incredibowl
              </h1>
              <p className="text-xs text-incredibowl-primary hidden sm:block">Old Klang Road 家常味</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#menu" className="text-incredibowl-text hover:text-incredibowl-primary transition-colors font-medium">Menu</a>
            <a href="#story" className="text-incredibowl-text hover:text-incredibowl-primary transition-colors font-medium">Our Story</a>
            <a href="#contact" className="text-incredibowl-text hover:text-incredibowl-primary transition-colors font-medium">Contact</a>
          </div>

          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105 border-2 border-incredibowl-secondary"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-incredibowl-primary" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-incredibowl-rooster text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-kraft">
        <div className="absolute top-20 right-0 w-64 h-64 bg-incredibowl-secondary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-incredibowl-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-incredibowl-secondary">
              <Home className="w-4 h-4 text-incredibowl-primary" />
              <span className="text-sm font-medium text-incredibowl-text">Old Klang Road 住家厨房</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-incredibowl-text">
              我孩子吃的，<br />
              <span className="text-incredibowl-primary">才给你吃</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-700 max-w-lg mx-auto md:mx-0">
              不是工厂生产，不是商业标准。<br className="hidden sm:block"/>
              我7岁和5岁孩子每天吃的住家饭，<br className="hidden sm:block"/>
              现在 share 给 CBD 的你们。
            </p>

            <div className="handwritten-note inline-block p-4 rounded-lg transform -rotate-1 mx-auto md:mx-0">
              <p className="text-incredibowl-primary text-lg">
                "Afternoon slump? 吃我的饭，<br/>
                3点开会不 ngantuk!"
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <a 
                href="#menu"
                className="px-6 sm:px-8 py-3 sm:py-4 bg-incredibowl-primary text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                立即点餐
              </a>
              <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-full shadow-md border-2 border-incredibowl-secondary">
                <Award className="w-5 h-6 text-incredibowl-primary" />
                <span className="font-semibold text-incredibowl-text text-sm sm:text-base">Buy 10 Free Delivery</span>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-center md:justify-start pt-4">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-white flex items-center justify-center text-xs">
                    👤
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 fill-incredibowl-accent text-incredibowl-accent" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-gray-600">500+ KL 白领的选择</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-6 sm:p-8 transform rotate-2 hover:rotate-0 transition-transform duration-500 max-w-sm mx-auto border-twine">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-incredibowl-kraft to-incredibowl-secondary/30 flex items-center justify-center relative overflow-hidden">
                <span className="text-8xl sm:text-9xl">🍱</span>
                <div className="absolute top-4 right-4 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-incredibowl-rooster fill-incredibowl-rooster" />
                </div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                  <div className="steam-particle text-4xl opacity-0" style={{animationDelay: '0s'}}>♨️</div>
                  <div className="steam-particle text-3xl opacity-0" style={{animationDelay: '1s'}}>♨️</div>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-incredibowl-primary/10 text-incredibowl-primary text-xs rounded-full font-bold">BEST SELLER</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-incredibowl-text">今日特选套餐</h3>
                <p className="text-sm text-gray-600">山药排骨 + 时蔬 + 糙米饭 + 例汤</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-bold text-incredibowl-primary">RM28</span>
                  <button 
                    onClick={() => addToCart({id: 99, name: "特选套餐", price: 28, description: "今日特选"})}
                    className="px-4 sm:px-6 py-2 bg-incredibowl-primary text-white rounded-full hover:bg-incredibowl-rooster transition-colors text-sm sm:text-base"
                  >
                    加入购物车
                  </button>
                </div>
              </div>
            </div>
            
            <div className="absolute -left-4 sm:-left-8 top-1/4 bg-white rounded-xl shadow-xl p-3 sm:p-4 sticker hidden sm:block">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-incredibowl-text text-sm sm:text-base">100%</p>
                  <p className="text-xs text-gray-500">天然食材</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 sm:-right-4 bottom-1/4 bg-white rounded-xl shadow-xl p-3 sm:p-4 sticker hidden sm:block" style={{transform: 'rotate(2deg)'}}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-incredibowl-accent/30 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-incredibowl-secondary" />
                </div>
                <div>
                  <p className="font-bold text-incredibowl-text text-sm sm:text-base">30min</p>
                  <p className="text-xs text-gray-500">准时送达</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-12 bg-incredibowl-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Mom Standard</h3>
              <p className="text-white/90 text-sm">我7岁和5岁孩子吃的，<br/>才卖给你</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">No Afternoon Slump</h3>
              <p className="text-white/90 text-sm">精准配方，<br/>下午meeting不ngantuk</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Real Neighbor</h3>
              <p className="text-white/90 text-sm">Old Klang Road住家厨房，<br/>不是工厂</p>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-16 sm:py-24 bg-kraft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-incredibowl-primary/10 text-incredibowl-primary rounded-full text-sm font-bold mb-4">
              PERFORMANCE FOOD
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-incredibowl-text mb-4">
              抗 Afternoon Slump 专用菜单
            </h2>
            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
              不是普通的healthy food，是让你下午3点还能集中精神的<br className="hidden sm:block"/>
              Brain Fuel & Energy Bowl
            </p>
          </div>

          <div className="flex justify-center gap-2 sm:gap-4 mb-8 sm:mb-12 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 sm:px-6 py-2 sm:py-3 rounded-full font-medium transition-all text-sm sm:text-base ${selectedCategory === cat ? 'bg-incredibowl-primary text-white shadow-lg' : 'bg-white text-incredibowl-text hover:bg-incredibowl-kraft-dark border border-incredibowl-secondary'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredItems.map((item) => (
              <div key={item.id} className="group bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-incredibowl-secondary/30">
                <div className="relative h-48 sm:h-56 bg-gradient-to-br from-incredibowl-kraft to-incredibowl-secondary/20 flex items-center justify-center text-6xl sm:text-7xl overflow-hidden">
                  {item.image}
                  <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex flex-wrap gap-1 sm:gap-2">
                    {item.tags.map(tag => (
                      <span key={tag} className="px-2 sm:px-3 py-1 bg-white/90 backdrop-blur text-xs font-bold text-incredibowl-primary rounded-full">{tag}</span>
                    ))}
                  </div>
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-incredibowl-accent/90 backdrop-blur px-2 sm:px-3 py-1 rounded-full">
                    <span className="text-xs font-bold text-incredibowl-text">{item.category}</span>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-incredibowl-text">{item.name}</h3>
                      <p className="text-xs text-gray-500">{item.nameEn}</p>
                    </div>
                    <span className="text-xs text-gray-500 bg-incredibowl-kraft px-2 py-1 rounded">{item.calories}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                  <div className="bg-incredibowl-kraft/50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-incredibowl-primary font-medium">💪 {item.performance}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl sm:text-2xl font-bold text-incredibowl-primary">RM{item.price}</span>
                    <button onClick={() => addToCart(item)} className="w-10 h-10 sm:w-12 sm:h-12 bg-incredibowl-primary text-white rounded-full flex items-center justify-center hover:bg-incredibowl-rooster hover:scale-110 transition-all shadow-lg">
                      <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section id="story" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
            <div className="relative order-2 md:order-1">
              <div className="aspect-[4/3] rounded-2xl sm:rounded-3xl bg-gradient-to-br from-incredibowl-kraft to-incredibowl-secondary/30 flex items-center justify-center text-6xl sm:text-8xl border-4 border-white shadow-xl">
                👩‍🍳
              </div>
              <div className="absolute -bottom-4 sm:-bottom-6 -right-4 sm:-right-6 bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 max-w-xs sticker">
                <div className="flex items-center gap-1 mb-2">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 sm:w-4 sm:h-4 fill-incredibowl-accent text-incredibowl-accent" />)}
                </div>
                <p className="text-gray-600 text-xs sm:text-sm">"吃了这里的山药排骨，下午真的不会想睡觉！比咖啡还有效。"</p>
                <p className="text-incredibowl-text font-bold mt-2 text-xs sm:text-sm">— Jason, KLCC 某投行</p>
              </div>
            </div>
            <div className="space-y-4 sm:space-y-6 order-1 md:order-2">
              <span className="inline-block px-3 sm:px-4 py-1 sm:py-2 bg-incredibowl-primary/10 text-incredibowl-primary rounded-full text-xs sm:text-sm font-bold">OLD KLANG ROAD 住家厨房</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-incredibowl-text">不是工厂，<br />是邻居阿姨的厨房</h2>
              <div className="space-y-3 sm:space-y-4 text-gray-600">
                <p className="text-base sm:text-lg leading-relaxed">每天早上6点，我会去 Old Klang Road 的巴刹买最新鲜的虾和菜。不是超市的冷冻货，是pasar阿姨刚从渔船拿上来的。</p>
                <p className="text-base sm:text-lg leading-relaxed">我的7岁和5岁孩子每天午餐吃这些。如果食材不新鲜、有农药，我绝对不会给他们吃——当然也不会给你吃。</p>
                <p className="text-base sm:text-lg leading-relaxed">这就是为什么我们的饭可以抗 afternoon slump。不是 magic，是妈妈的标准。</p>
              </div>
              <div className="handwritten-note inline-block p-3 sm:p-4 rounded-lg">
                <p className="text-incredibowl-primary text-base sm:text-lg">"孩子生病时，我会调整菜单。<br/>这种 flexibility，工厂给不了你。"<br/><span className="text-sm">— Incredibowl 妈妈</span></p>
              </div>
              <div className="flex gap-4 sm:gap-8 pt-2 sm:pt-4">
                <div><p className="text-2xl sm:text-3xl font-bold text-incredibowl-primary">3年</p><p className="text-xs sm:text-sm text-gray-500">住家经营</p></div>
                <div><p className="text-2xl sm:text-3xl font-bold text-incredibowl-primary">2个</p><p className="text-xs sm:text-sm text-gray-500">孩子当试吃员</p></div>
                <div><p className="text-2xl sm:text-3xl font-bold text-incredibowl-primary">0</p><p className="text-xs sm:text-sm text-gray-500">味精添加</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packaging Section */}
      <section className="py-16 sm:py-24 bg-incredibowl-kraft-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-incredibowl-text mb-4">牛皮纸 + 麻绳 + 手写卡</h2>
          <p className="text-gray-600 text-base sm:text-lg mb-8 sm:mb-12 max-w-2xl mx-auto">不是 plastic 盒，是邻居阿姨送来的爱心午餐的感觉</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="text-4xl sm:text-5xl mb-4">📦</div>
              <h3 className="text-lg sm:text-xl font-bold text-incredibowl-text mb-2">Kraft Paper Box</h3>
              <p className="text-gray-600 text-sm">可降解牛皮纸，环保有温度</p>
            </div>
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="text-4xl sm:text-5xl mb-4">🎀</div>
              <h3 className="text-lg sm:text-xl font-bold text-incredibowl-text mb-2">Hand-tied Twine</h3>
              <p className="text-gray-600 text-sm">每一条麻绳都是亲手绑的</p>
            </div>
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="text-4xl sm:text-5xl mb-4">✍️</div>
              <h3 className="text-lg sm:text-xl font-bold text-incredibowl-text mb-2">Handwritten Note</h3>
              <p className="text-gray-600 text-sm">每一单都有手写感谢卡</p>
            </div>
          </div>
        </div>
      </section>

      {/* Promo Banner */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-incredibowl-primary to-incredibowl-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-white">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">Buy 10 Bowls Free Delivery</h2>
          <p className="text-lg sm:text-xl opacity-90 mb-6 sm:mb-8 max-w-2xl mx-auto">和同事一起订，share 运费。<br className="hidden sm:block"/>KL CBD area (TRX, KLCC, Mid Valley, Bangsar) 都送。</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm">
            <div className="flex items-center gap-2"><div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center text-xs sm:text-base">✓</div><span>新鲜食材</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center text-xs sm:text-base">✓</div><span>准时送达</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center text-xs sm:text-base">✓</div><span>可开公司发票</span></div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-incredibowl-text mb-8 sm:mb-12">联系我们</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-incredibowl-kraft rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 bg-incredibowl-primary/10 rounded-full flex items-center justify-center">
                <Phone className="w-6 h-6 sm:w-7 sm:h-7 text-incredibowl-primary" />
              </div>
              <h3 className="font-bold text-incredibowl-text mb-2 text-sm sm:text-base">WhatsApp 订餐</h3>
              <p className="text-gray-600 text-sm">012-345-6789</p>
            </div>
            <div className="bg-incredibowl-kraft rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 bg-incredibowl-secondary/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-incredibowl-secondary" />
              </div>
              <h3 className="font-bold text-incredibowl-text mb-2 text-sm sm:text-base">营业时间</h3>
              <p className="text-gray-600 text-sm">周一至周五<br/>10:00 - 14:00</p>
            </div>
            <div className="bg-incredibowl-kraft rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 bg-incredibowl-accent/30 rounded-full flex items-center justify-center">
                <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-incredibowl-secondary" />
              </div>
              <h3 className="font-bold text-incredibowl-text mb-2 text-sm sm:text-base">配送范围</h3>
              <p className="text-gray-600 text-sm">KL CBD<br/>Old Klang Road 出发</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-incredibowl-text text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl sm:text-3xl">🐓</span>
            <span className="text-xl sm:text-2xl font-bold">Incredibowl</span>
          </div>
          <p className="text-gray-400 mb-2 text-sm sm:text-base">Old Klang Road 住家厨房</p>
          <p className="text-gray-500 text-xs sm:text-sm mb-4">我孩子吃的，才给你吃 | 抗 Afternoon Slump</p>
          <p className="text-gray-600 text-xs">© 2026 Incredibowl. Made with ❤️ in KL.</p>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-gradient-to-r from-incredibowl-primary to-incredibowl-secondary text-white">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" /> 购物车 ({cartCount})</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm sm:text-base">购物车是空的</p>
                  <button onClick={() => setIsCartOpen(false)} className="mt-4 text-incredibowl-primary font-bold hover:underline text-sm sm:text-base">去点餐 →</button>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3 sm:gap-4 bg-incredibowl-kraft rounded-xl p-3 sm:p-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-lg flex items-center justify-center text-xl sm:text-2xl shadow-sm">{item.image || '🍱'}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-incredibowl-text text-sm sm:text-base truncate">{item.name}</h4>
                        <p className="text-incredibowl-primary font-bold text-sm">RM{item.price}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100"><Minus className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100"><Plus className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t p-4 sm:p-6 bg-incredibowl-kraft">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-gray-600 text-sm sm:text-base"><span>Subtotal</span><span>RM{cartTotal}</span></div>
                  <div className="flex justify-between text-gray-600 text-sm sm:text-base"><span>Delivery Fee</span><span className={freeDelivery ? 'text-green-600 font-bold' : ''}>{freeDelivery ? 'FREE' : 'RM5'}</span></div>
                  {!freeDelivery && <p className="text-xs sm:text-sm text-incredibowl-primary">再买 {10 - cartCount} 份即可免运费</p>}
                  <div className="flex justify-between text-lg sm:text-xl font-bold text-incredibowl-text pt-2 border-t"><span>Total</span><span className="text-incredibowl-primary">RM{freeDelivery ? cartTotal : cartTotal + 5}</span></div>
                </div>
                <button className="w-full py-3 sm:py-4 bg-gradient-to-r from-incredibowl-primary to-incredibowl-secondary text-white rounded-xl font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all">WhatsApp 下单 →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
