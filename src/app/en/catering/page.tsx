import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  DELIVERY_PROSE_EN,
  BEYOND_DELIVERY_NOTE_EN,
  COVERAGE_AREAS,
} from "@/lib/deliveryCopy";

// English catering landing page — mirrors /catering. Same honest positioning:
// home-kitchen individual meal boxes for groups, quote via WhatsApp, no
// invented per-pax pricing or capacity claims.

const WA_LINK = `https://wa.me/60103370197?text=${encodeURIComponent(
  "Hi BowlMama, I'd like a catering quote — date: _, pax: _, occasion: _"
)}`;

export const metadata: Metadata = {
  title:
    "Catering & Group Meal Boxes KL | Old Klang Road Home-cooked Catering — Incredibowl",
  description: `Home-cooked catering in Kuala Lumpur from Old Klang Road: office lunch, meeting meal boxes, small gatherings and long-term meal plans. No MSG, freshly sourced daily, individual meal boxes. Covering ${COVERAGE_AREAS.join(
    " / "
  )}. Quote via WhatsApp.`,
  keywords: [
    "catering KL",
    "catering Old Klang Road",
    "catering OUG KL",
    "office lunch catering KL",
    "meeting meal boxes KL",
    "group meal boxes KL",
    "home-cooked catering KL",
  ],
  alternates: {
    canonical: "/en/catering",
    languages: {
      "zh-MY": "/catering",
      "en-MY": "/en/catering",
      "x-default": "/catering",
    },
  },
  openGraph: {
    title: "Incredibowl Catering · Group Meal Boxes | Old Klang Road / OUG KL",
    description:
      "Office lunch, meeting meal boxes, small gatherings and long-term meal plans. No MSG, freshly sourced daily, individual meal boxes — quote via WhatsApp.",
    url: "https://www.incredibowl.my/en/catering",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Incredibowl home-cooked catering meal boxes",
      },
    ],
    locale: "en_MY",
    type: "website",
  },
};

const FAQS = [
  {
    q: "Is Incredibowl catering a buffet service?",
    a: "No. Incredibowl is a home kitchen serving box-style group catering — one individual meal box per person, based on the current week's home-cooked Chinese menu (no MSG, freshly sourced from the wet market every morning). We don't provide buffet trays, on-site setup or serving staff.",
  },
  {
    q: "How do I order office lunch or meeting meal boxes?",
    a: "WhatsApp BowlMama at 010-337 0197 with your date, headcount and occasion. She'll suggest dishes from the week's menu and quote based on kitchen availability. For larger groups, please reach out early to secure the date.",
  },
  {
    q: "Do you offer long-term meal plans?",
    a: "Yes. We offer prepaid meal voucher bundles (buy multiple meals at a better rate) and a weekly subscription plan (fixed delivery days to your home or office) — popular with neighbours and office workers who want home-cooked food regularly.",
  },
  {
    q: "What areas do you deliver catering to?",
    a: `We deliver from Pearl Point (Old Klang Road), covering ${COVERAGE_AREAS.join(
      ", "
    )}. ${DELIVERY_PROSE_EN}. ${BEYOND_DELIVERY_NOTE_EN} — for group orders, WhatsApp us to discuss.`,
  },
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.incredibowl.my/en/catering#service",
  serviceType: "Catering",
  name: "Incredibowl Home-cooked Catering · Group Meal Boxes",
  description:
    "Home-cooked catering in Kuala Lumpur from Old Klang Road: office lunch, meeting meal boxes, small gatherings and long-term meal plans. Individual meal boxes, no MSG, freshly sourced daily.",
  provider: { "@id": "https://www.incredibowl.my/#restaurant" },
  areaServed: COVERAGE_AREAS.map((a) => ({
    "@type": "Place",
    name: `${a}, Kuala Lumpur`,
  })),
  availableChannel: {
    "@type": "ServiceChannel",
    name: "WhatsApp",
    serviceUrl: "https://wa.me/60103370197",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function CateringPageEN() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#1A2D23]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <Link
          href="/en"
          className="text-[#FF6B35] font-bold mb-6 inline-block hover:underline"
        >
          ← Back to home
        </Link>

        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1A2D23]/50 mb-3">
            Catering · Group Orders
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
            Home-cooked Catering
            <br className="hidden md:block" />
            <span className="text-[#FF6B35]">
              Office Lunch / Small Gatherings / Meal Plans
            </span>
          </h1>
          <p className="text-lg text-[#1A2D23]/65">
            Home-kitchen Chinese comfort food from Old Klang Road — no MSG,
            freshly sourced every morning, delivered as individual meal boxes
            to your office or gathering.
          </p>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-[#E3EADA]">
          <Image
            src="/pork_potato_stew.webp"
            alt="Incredibowl home-cooked catering meal boxes"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        <div className="mb-10 p-5 md:p-6 bg-[#E3EADA]/50 border-l-4 border-[#FF6B35] rounded-r-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-[#1A2D23]/50 mb-2">
            To set expectations
          </p>
          <p className="text-[15px] md:text-[16px] leading-relaxed text-[#1A2D23]/85">
            Incredibowl is a <strong>home kitchen</strong>. We do{" "}
            <strong>box-style group catering</strong> — one individual meal box
            per person — not buffet trays or on-site setup. What you get is{" "}
            <strong>no-MSG, cooked-the-same-day home food</strong> your team and
            family will actually enjoy.
          </p>
        </div>

        <div className="space-y-6 leading-relaxed text-[#1A2D23]/85 text-[16px] md:text-[17px]">
          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            Good for
          </h2>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>Office lunch / meeting meal boxes</strong> — one box per
              person, dishes picked from the week&apos;s menu; light, clean
              food that won&apos;t put the team to sleep.
            </li>
            <li>
              <strong>Small gatherings / family events</strong> — meal boxes by
              headcount, delivered to your venue.
            </li>
            <li>
              <strong>Long-term meal plans</strong> —{" "}
              <Link
                href="/en/meal-vouchers"
                className="text-[#FF6B35] font-bold hover:underline"
              >
                prepaid meal voucher bundles
              </Link>{" "}
              and a weekly subscription plan (fixed delivery days to your home
              or office).
            </li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            Why a home kitchen
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Zero MSG</strong> — flavour from real ingredients;
            </li>
            <li>
              <strong>Sourced from the wet market every morning</strong>,
              cooked the same day — never frozen and reheated;
            </li>
            <li>Real protein grams labelled on mains — balanced group meals;</li>
            <li>Home-style, less oil and salt — food you can eat every day.</li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            How to order
          </h2>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>WhatsApp BowlMama</strong> (010-337 0197) with your date,
              headcount and occasion;
            </li>
            <li>
              She&apos;ll suggest dishes from the <strong>week&apos;s menu</strong>{" "}
              and quote based on kitchen availability;
            </li>
            <li>Confirm, and it&apos;s cooked fresh and delivered on the day.</li>
          </ol>
          <p className="text-[#1A2D23]/65 text-[15px]">
            * Home-kitchen capacity is limited — for larger groups, please
            reach out early. For everyday individual meals, just{" "}
            <Link
              href="/en"
              className="text-[#FF6B35] font-bold hover:underline"
            >
              order on the website
            </Link>{" "}
            (order by 6AM daily).
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            Delivery coverage
          </h2>
          <p>
            From Pearl Point (Old Klang Road), covering{" "}
            {COVERAGE_AREAS.join(", ")}. Delivery: {DELIVERY_PROSE_EN}.{" "}
            {BEYOND_DELIVERY_NOTE_EN} — for group orders, WhatsApp us to
            discuss.
          </p>

          <h2 className="text-2xl md:text-3xl font-black mt-12 mb-4 text-[#1A2D23]">
            FAQ
          </h2>
          <div className="space-y-5">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="font-black text-lg mb-1">Q: {f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 md:p-8 bg-[#FF6B35]/8 border-2 border-[#FF6B35]/20 rounded-2xl text-center">
            <h3 className="text-xl md:text-2xl font-black mb-3 text-[#1A2D23]">
              Feeding a team or a gathering?
            </h3>
            <p className="text-[#1A2D23]/70 mb-5 text-sm md:text-base">
              Tell BowlMama the date and headcount — she&apos;ll plan the boxes
              from the week&apos;s menu
            </p>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#FF6B35] text-white font-bold px-8 py-3 rounded-full hover:bg-[#E55A24] transition-colors"
            >
              WhatsApp for a quote →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
