import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
