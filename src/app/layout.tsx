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
  metadataBase: new URL("https://incredibowl.my"),
  title: "Incredibowl | Old Klang Road 邻里的家常料理",
  description: "每天为您新鲜采购、坚持无味精烹调的“每日一味”。Incredibowl 就在 Pearl Point 附近，专注为您送上最安心的妈妈味道。让您和家人每餐都吃得健康无负担。",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Incredibowl | Old Klang Road 邻里的家常料理",
    description: "每天为您新鲜采购、坚持无味精烹调的“每日一味”。Incredibowl 就在 Pearl Point 附近，专注为您送上最安心的妈妈味道。",
    url: "https://incredibowl.my",
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
    title: "Incredibowl | Old Klang Road 邻里的家常料理",
    description: "每天为您新鲜采购、坚持无味精烹调的“每日一味”。Incredibowl 就在 Pearl Point 附近，专注为您送上最安心的妈妈味道。",
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
