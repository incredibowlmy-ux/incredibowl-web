import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_SC } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { weeklyMenu } from "@/data/weeklyMenu";

// Build Menu structured data from the live menu so Google's food rich
// results stay in sync with the actual dishes shown on the page.
const dailySection = {
  "@type": "MenuSection",
  name: "Daily / 常驻菜",
  hasMenuItem: weeklyMenu
    .filter(d => d.day.startsWith("Daily"))
    .map(d => ({
      "@type": "MenuItem",
      name: d.name,
      description: d.desc,
      image: `https://www.incredibowl.my${d.image}`,
      offers: {
        "@type": "Offer",
        price: d.price.toFixed(2),
        priceCurrency: "MYR",
        availability: "https://schema.org/InStock",
      },
    })),
};

const weeklySection = {
  "@type": "MenuSection",
  name: "Weekly Rotation / 每周轮换",
  hasMenuItem: weeklyMenu
    .filter(d => !d.day.startsWith("Daily"))
    .map(d => ({
      "@type": "MenuItem",
      name: d.name,
      description: d.desc,
      image: `https://www.incredibowl.my${d.image}`,
      offers: {
        "@type": "Offer",
        price: d.price.toFixed(2),
        priceCurrency: "MYR",
        availability: "https://schema.org/InStock",
      },
    })),
};

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "800"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.incredibowl.my"),
  title: "Incredibowl | Pearl Point 私厨外送 · 无味精家常菜 · Old Klang Road / OUG",
  description: "吉隆坡 Old Klang Road 私厨外送。不加味精，每天巴刹新鲜现煮。Pearl Point 出发，Old Klang Road / OUG 一带 2km 免运。早上 6AM 截单。www.incredibowl.my",
  alternates: {
    canonical: "/",
    languages: {
      "zh-MY": "/",
      "en-MY": "/en",
      "x-default": "/",
    },
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Incredibowl | Pearl Point 私厨外送",
    description: "不加味精，每天巴刹新鲜现煮。Pearl Point 出发，2km 免运。",
    url: "https://www.incredibowl.my",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Incredibowl - 妈妈的味道",
      },
    ],
    locale: "zh_MY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Incredibowl | Pearl Point 私厨外送",
    description: "不加味精，每天巴刹新鲜现煮。Pearl Point 出发，2km 免运。",
    images: ["https://www.incredibowl.my/pork_potato_stew.webp"],
  },
  verification: {
    other: {
      "facebook-domain-verification": "hgdbmiq3t1274hajwj8m1sxj889sfn",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-MY">
      <head>
        <link rel="preconnect" href="https://firebaseinstallations.googleapis.com" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="preconnect" href="https://apis.google.com" />
        <link rel="preconnect" href="https://www.clarity.ms" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://www.incredibowl.my/#website",
                  name: "Incredibowl Malaysia",
                  url: "https://www.incredibowl.my/",
                  inLanguage: "zh-MY"
                },
                {
                  "@type": "Restaurant",
                  "@id": "https://www.incredibowl.my/#restaurant",
                  name: "Incredibowl",
                  alternateName: "碗妈私厨 (BowlMama)",
                  description: "吉隆坡 Old Klang Road 私厨外送。不加味精，每天巴刹新鲜现煮。Pearl Point 出发，Old Klang Road / OUG 一带 2km 免运。",
                  url: "https://www.incredibowl.my/",
                  telephone: "+60103370197",
                  image: [
                    "https://www.incredibowl.my/pork_potato_stew.webp",
                    "https://www.incredibowl.my/chia_seed_pudding.webp",
                    "https://www.incredibowl.my/potato_fried_egg.webp"
                  ],
                  priceRange: "RM 15-25",
                  servesCuisine: ["Chinese", "Home-cooked", "Malaysian Chinese"],
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "Pearl Point, Old Klang Road",
                    addressLocality: "Kuala Lumpur",
                    addressRegion: "Wilayah Persekutuan Kuala Lumpur",
                    postalCode: "58000",
                    addressCountry: "MY"
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: 3.0853475861917716,
                    longitude: 101.67428154483449
                  },
                  openingHoursSpecification: [
                    {
                      "@type": "OpeningHoursSpecification",
                      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                      opens: "11:00",
                      closes: "20:00"
                    }
                  ],
                  areaServed: [
                    { "@type": "Place", name: "Pearl Point" },
                    { "@type": "Place", name: "Meadow Park" },
                    { "@type": "Place", name: "Millerz Square" },
                    { "@type": "Place", name: "The Scott Garden" },
                    { "@type": "Place", name: "D'Ivoz Residences" },
                    { "@type": "Place", name: "Verve Suites" },
                    { "@type": "Place", name: "The Harmony" },
                    { "@type": "Place", name: "Platinum Arena" },
                    { "@type": "Place", name: "Citizen 1 & 2" },
                    { "@type": "Place", name: "Petalz" },
                    { "@type": "Place", name: "D'Sands" },
                    { "@type": "Place", name: "SkyVille 8 @ Benteng" }
                  ],
                  hasMenu: {
                    "@type": "Menu",
                    name: "Incredibowl Daily Menu",
                    inLanguage: ["zh-MY", "en-MY"],
                    hasMenuSection: [dailySection, weeklySection]
                  },
                  serviceArea: {
                    "@type": "GeoCircle",
                    geoMidpoint: {
                      "@type": "GeoCoordinates",
                      latitude: 3.0853475861917716,
                      longitude: 101.67428154483449
                    },
                    geoRadius: "5000"
                  },
                  potentialAction: {
                    "@type": "OrderAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://www.incredibowl.my/",
                      inLanguage: "zh-MY",
                      actionPlatform: [
                        "http://schema.org/DesktopWebPlatform",
                        "http://schema.org/MobileWebPlatform"
                      ]
                    },
                    deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"
                  },
                  acceptsReservations: false,
                  paymentAccepted: ["DuitNow QR", "FPX", "Credit Card"],
                  currenciesAccepted: "MYR",
                  sameAs: [
                    "https://wa.me/60103370197",
                    "https://www.facebook.com/profile.php?id=61587218759550",
                    "https://www.instagram.com/incredibowl_my/",
                    "https://www.xiaohongshu.com/user/profile/69793d3f000000002603b93a"
                  ]
                  // aggregateRating removed: Schema.org guidelines require visible
                  // on-page Review schema to back the rating, which we don't have.
                  // Re-enable once a real review system is wired in.
                }
              ]
            })
          }}
        />
        <Script
          id="fb-pixel"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '762982966692354');
fbq('track', 'PageView');
            `,
          }}
        />
        {/* Microsoft Clarity — heatmaps + session recordings (free, no quota). */}
        <Script
          id="ms-clarity"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "wohye2ojk4");
            `,
          }}
        />
        {/* Google Analytics 4. Measurement IDs are not secrets — they're
            included in the client-side bundle that fires every PageView,
            so hardcoding here is functionally identical to setting an env
            var. The env var override is kept so the ID can be swapped or
            disabled per environment without a code change. */}
        <Script
          id="ga4-loader"
          strategy="lazyOnload"
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-Z78ZLBH7CF'}`}
        />
        <Script
          id="ga4-init"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-Z78ZLBH7CF'}');
            `,
          }}
        />

      </head>
      <body
        className={`${plusJakarta.variable} ${notoSansSC.variable} antialiased`}
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans SC', system-ui, -apple-system, sans-serif" }}
      >
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=762982966692354&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
