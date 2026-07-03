import type { Metadata } from "next";
import { DELIVERY_PROSE_SHORT_EN, COVERAGE_AREAS } from "@/lib/deliveryCopy";

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
// Positioning mirrors the Google Business Profile categories:
// primary = Chinese delivery restaurant, secondary = healthy food.
export const metadata: Metadata = {
  title: "Incredibowl | Chinese Home-cooked Delivery · Healthy, No MSG · Old Klang Road / OUG KL",
  description:
    `Chinese home-cooked food delivery from Pearl Point, Kuala Lumpur — covering ${COVERAGE_AREAS.join(" / ")}. Healthy, no MSG, freshly sourced from the wet market every morning. ${DELIVERY_PROSE_SHORT_EN}. Order by 6AM.`,
  keywords: [
    "chinese food delivery KL",
    "home-cooked food delivery KL",
    "healthy food delivery KL",
    "healthy bowl KL",
    "no MSG food delivery",
    ...COVERAGE_AREAS.map((a) => `${a} food delivery`),
  ],
  alternates: {
    canonical: "/en",
    languages: {
      "zh-MY": "/",
      "en-MY": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "Incredibowl | Chinese Home-cooked Delivery KL",
    description:
      `Healthy, no MSG, freshly sourced from the wet market every morning. From Pearl Point — ${DELIVERY_PROSE_SHORT_EN}.`,
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
    title: "Incredibowl | Chinese Home-cooked Delivery KL",
    description:
      `Healthy, no MSG, freshly sourced every morning. From Pearl Point — ${DELIVERY_PROSE_SHORT_EN}.`,
    images: ["https://www.incredibowl.my/pork_potato_stew.webp"],
  },
};

export default function EnLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
