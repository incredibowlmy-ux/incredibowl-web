import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.incredibowl.my"),
  title: "Incredibowl | Pearl Point 私厨外送 · 无味精家常菜 · OKR / OUG",
  description: "吉隆坡 Old Klang Road 私厨外送。不加味精，每天巴刹新鲜现煮。Pearl Point 出发，OKR / OUG 一带 2km 免运。早上 6AM 截单。www.incredibowl.my",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Incredibowl | Pearl Point 私厨外送",
    description: "不加味精，每天巴刹新鲜现煮。Pearl Point 出发，2km 免运。",
    url: "https://www.incredibowl.my",
    siteName: "Incredibowl",
    images: [
      {
        url: "/pork_potato_stew.jpg",
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
    images: ["/pork_potato_stew.jpg"],
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
    <html lang="en">
      <head>
        <Script
          id="fb-pixel"
          strategy="afterInteractive"
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
fbq('init', '927185646587424');
fbq('track', 'PageView');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=927185646587424&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
