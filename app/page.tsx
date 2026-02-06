import Image from "next/image";
import { ArrowRight, Instagram, Facebook, Phone, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-slate-900">
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
              Fresh • Fast • Flavour-packed
            </p>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Happiness in a Bowl
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Build your perfect bowl with fresh ingredients, bold sauces, and crunchy toppings.
              Crafted daily in Malaysia, made to keep you feeling light, energised, and satisfied.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="https://wa.me/60103370197"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              >
                Order Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <button className="inline-flex items-center justify-center rounded-full border border-orange-200 bg-white/70 px-6 py-3 text-sm font-semibold text-orange-700 shadow-sm backdrop-blur transition hover:border-orange-300 hover:bg-orange-50">
                View Full Menu
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Halal-friendly ingredients</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Ready in under 10 minutes</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto h-72 w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-tr from-orange-500 via-red-500 to-amber-400 shadow-xl sm:h-80 md:h-96">
            {/* Hero image placeholder */}
            <div className="absolute inset-4 rounded-3xl bg-white/10 ring-1 ring-white/30 backdrop-blur-sm" />
            <div className="relative flex h-full flex-col justify-between p-6 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-100">
                  Coming soon
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-tight">
                  Incredibowl&apos;s Signature
                </h2>
                <p className="mt-2 max-w-xs text-sm text-amber-50/90">
                  Perfect balance of protein, grains, and greens. Swap toppings, add sauces, and
                  make it truly yours.
                </p>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-amber-100">Calories</span>
                  <span className="font-semibold">~550 kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-100">Protein</span>
                  <span className="font-semibold">27g</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold">From RM 18.90</span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wide">
                    Hero Image Placeholder
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              How it works
            </h2>
            <p className="max-w-md text-sm text-slate-600">
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
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Best-selling bowls
            </h2>
            <p className="max-w-md text-sm text-slate-600">
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
      <footer className="border-t border-orange-100 bg-white/80 py-5 text-xs text-slate-500 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Incredibowl.my. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Instagram className="h-4 w-4" />
              <span>Instagram</span>
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Facebook className="h-4 w-4" />
              <span>Facebook</span>
            </a>
            <a
              href="tel:+60XXXXXXXXX"
              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-orange-600"
            >
              <Phone className="h-4 w-4" />
              <span>Call us</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
