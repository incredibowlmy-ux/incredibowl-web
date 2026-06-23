import type { Metadata } from "next";

// terms/page.tsx is a Client Component (cannot export metadata) — without this
// it inherited the root's Chinese homepage title and canonical "/". This
// server-component layout gives the page its own title + self-canonical.
export const metadata: Metadata = {
  title: "服务条款 Terms & Conditions · Incredibowl",
  description:
    "Incredibowl 服务条款：下单、配送、付款与使用条款。",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
