import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_SC, Inter, Outfit, Quicksand } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "600", "800"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "500", "700", "900"],
  variable: "--font-outfit",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "500", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Incredibowl | Old Klang Road 邻里的家常料理",
  description: "每天为您新鲜采购、坚持无味精烹调的「每日一味」。Incredibowl 就在 Pearl Point 附近，专注为您送上最安心的妈妈味道。让您和家人每餐都吃得健康无负担。",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
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
        className={`${plusJakarta.variable} ${notoSansSC.variable} ${inter.variable} ${outfit.variable} ${quicksand.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
