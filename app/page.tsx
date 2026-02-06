import Image from "next/image";
import { ArrowRight, Instagram, Facebook, Phone, CheckCircle2, Heart } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-slate-900">
      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-50 w-full bg-white/98 backdrop-blur-md shadow-sm border-b border-orange-100/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <div className="flex-shrink-0">
            <a href="#" className="inline-flex items-center gap-3 transition-opacity hover:opacity-80">
              <Image
                src="/logo.png"
                alt="Incredibowl"
                height={40}
                width={0}
                className="h-[40px] w-auto"
                priority
              />
              <span className="text-2xl font-bold text-orange-600">Incredibowl</span>
            </a>
          </div>

          {/* Navigation Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#menu" className="text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors">
              Menu <span className="text-xs text-slate-500">/ 菜单</span>
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors">
              About <span className="text-xs text-slate-500">/ 关于</span>
            </a>
            <a href="#contact" className="text-sm font-medium text-slate-700 hover:text-orange-600 transition-colors">
              Contact <span className="text-xs text-slate-500">/ 联系</span>
            </a>
          </div>

          {/* WhatsApp Order Button */}
          <div className="flex-shrink-0">
            <a
              href="https://wa.me/60103370197"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/30 transition hover:shadow-lg hover:shadow-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 sm:px-6 sm:py-2 sm:text-sm"
            >
              Order on WhatsApp
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-4 pb-20 pt-12 sm:px-6 sm:gap-24 sm:pt-16 lg:px-8 lg:gap-28 lg:pt-20">
        {/* Hero */}
        <section className="grid gap-12 sm:gap-14 md:grid-cols-2 md:items-center md:gap-16">
          <div className="space-y-8">
            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-balance text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl leading-tight">
                Taste of Home in Every <span className="text-orange-600">Bowl</span>
              </h1>
              <p className="text-lg sm:text-xl font-medium text-orange-700">
                每一口，都是家的味道
              </p>
            </div>

            {/* Description */}
            <div className="space-y-3 max-w-xl">
              <p className="text-base leading-relaxed text-slate-700 sm:text-lg">
                Cooked with a mother&apos;s heart. No MSG, no shortcuts—just fresh ingredients and pure love. Wholesome meals that make you feel good.
              </p>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                妈妈用心烹饪，绝无味精。精选新鲜食材，为您呈献最温暖、最健康的美味。
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="https://wa.me/60103370197"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              >
                Order Now <span className="ml-1 text-xs opacity-90">/ 立即点餐</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <button className="inline-flex items-center justify-center rounded-full border border-orange-200 bg-white/70 px-6 py-3 text-sm font-semibold text-orange-700 shadow-sm backdrop-blur transition hover:border-orange-300 hover:bg-orange-50">
                View Menu <span className="ml-1 text-xs opacity-80">/ 查看菜单</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-700 pt-2">
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>No MSG <span className="text-slate-500">/ 无味精</span></span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500 fill-red-500 flex-shrink-0" />
                <span>Made with Love <span className="text-slate-500">/ 用心制作</span></span>
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>Halal Friendly</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg aspect-square">
            {/* Yellow/Orange Blob Background Glow */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[120%] h-[120%] bg-gradient-to-br from-orange-300/40 via-amber-300/30 to-yellow-300/40 rounded-full blur-3xl" />
            </div>

            {/* Hero Image */}
            <div className="relative w-full aspect-square rounded-[2.5rem] overflow-hidden shadow-2xl animate-float">
              <Image
                src="/hero.png"
                alt="Signature Bowl"
                fill
                className="object-cover"
                priority
              />

              {/* Floating Price Tag (Glassmorphism) */}
              <div className="absolute bottom-6 left-6 bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/20">
                <p className="text-xs text-slate-600 mb-1">
                  Signature Bowl <span className="text-slate-500">/ 招牌菜</span>
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-orange-600">RM 18.90</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="space-y-8 sm:space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              How it Works
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              Build your bowl in 3 easy steps. Simple, fast, and customisable to your cravings.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                1
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Choose your main</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Pick from salmon, chicken, tofu, or seasonal specials on a base of rice, quinoa, or salad greens.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                2
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Add sides & toppings</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Load up with veggies, pickles, onsen egg, seaweed, and crunchy toppings for extra texture.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                3
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Choose your drinks</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Pair your bowl with house-made teas, sparkling yuzu, or kombucha for a refreshing finish.
              </p>
            </div>
          </div>
        </section>

        {/* Menu preview */}
        <section id="menu" className="space-y-8 sm:space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Our Menu
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              A sneak peek of what Malaysians are loving. Prices in RM.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
              <div className="relative h-32 w-full bg-gradient-to-tr from-orange-300 via-amber-300 to-rose-300">
                <div className="absolute inset-3 rounded-2xl border border-white/40 border-dashed bg-white/10 backdrop-blur-sm" />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Image placeholder
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Signature Salmon Bowl
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Torched salmon, Japanese rice, edamame, onsen egg, house pickles, and sesame dressing.
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                  <span className="font-semibold text-orange-600">From RM 24.90</span>
                  <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700">
                    Best seller
                  </span>
                </div>
              </div>
            </article>

            <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
              <div className="relative h-32 w-full bg-gradient-to-tr from-amber-300 via-lime-200 to-emerald-300">
                <div className="absolute inset-3 rounded-2xl border border-white/40 border-dashed bg-white/10 backdrop-blur-sm" />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Image placeholder
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Teriyaki Chicken Bowl
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Grilled chicken thigh, garlic butter rice, sweet teriyaki glaze, corn, and crunchy shallots.
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                  <span className="font-semibold text-orange-600">From RM 19.90</span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                    Crowd favourite
                  </span>
                </div>
              </div>
            </article>

            <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
              <div className="relative h-32 w-full bg-gradient-to-tr from-rose-300 via-fuchsia-300 to-orange-300">
                <div className="absolute inset-3 rounded-2xl border border-white/40 border-dashed bg-white/10 backdrop-blur-sm" />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Image placeholder
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Spicy Tofu Power Bowl
                </h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  Crispy tofu, quinoa, roasted veggies, sambal mayo, and crunchy nuts for a plant-powered kick.
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                  <span className="font-semibold text-orange-600">From RM 17.90</span>
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">
                    Vegetarian
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="border-t border-orange-100 bg-white/80 py-8 text-xs text-slate-500 backdrop-blur sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Incredibowl.my. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Instagram className="h-4 w-4" />
              <span className="hidden sm:inline">Instagram</span>
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Facebook className="h-4 w-4" />
              <span className="hidden sm:inline">Facebook</span>
            </a>
            <a
              href="tel:+60XXXXXXXXX"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Call us</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
