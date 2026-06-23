import type { Metadata } from "next";

// The English home (en/page.tsx) is a Client Component, so it cannot export
// `metadata` itself — without this layout it would inherit the root layout's
// Chinese <title>/description AND its canonical "/", telling Google the English
// page is a duplicate of the Chinese homepage. This server-component layout
// overrides those fields for /en and its children with English copy and a
// self-referencing canonical, so the English page ranks as its own page.
//
// NOTE: it intentionally does NOT render <html>/<body> — only the root layout
// may, per Next.js. The <html lang> swap to en-MY is handled client-side in
// en/page.tsx (document.documentElement.lang), which JS-rendering crawlers
// (Googlebot) pick up after render.
export const metadata: Metadata = {
  title: "Incredibowl | Home-cooked Delivery · No MSG · Pearl Point / Old Klang Road / OUG KL",
  description:
    "Home-cooked food delivery from Pearl Point, Old Klang Road, Kuala Lumpur. No MSG, freshly sourced from the wet market every morning. Within 2.5km RM 3 (free over RM 20) · 2.5–5km RM 5 (free over RM 30). Order by 6AM. www.incredibowl.my/en",
  alternates: {
    canonical: "/en",
    languages: {
      "zh-MY": "/",
      "en-MY": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "Incredibowl | Pearl Point Home-cooked Delivery",
    description:
      "No MSG, freshly sourced from the wet market every morning. From Pearl Point — within 2.5km RM 3 (free over RM 20) · 2.5–5km RM 5 (free over RM 30).",
    url: "https://www.incredibowl.my/en",
    siteName: "Incredibowl Malaysia",
    images: [
      {
        url: "https://www.incredibowl.my/pork_potato_stew.webp",
        width: 1200,
        height: 630,
        alt: "Incredibowl - home-cooked taste",
      },
    ],
    locale: "en_MY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Incredibowl | Pearl Point Home-cooked Delivery",
    description:
      "No MSG, freshly sourced every morning. From Pearl Point — within 2.5km RM 3 (free over RM 20) · 2.5–5km RM 5 (free over RM 30).",
    images: ["https://www.incredibowl.my/pork_potato_stew.webp"],
  },
};

export default function EnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
