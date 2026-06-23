import type { Metadata } from "next";

// refund/page.tsx is a Client Component (cannot export metadata) — without this
// it inherited the root's Chinese homepage title and canonical "/". This
// server-component layout gives the page its own title + self-canonical.
export const metadata: Metadata = {
  title: "退款与取消政策 Refund & Cancellation Policy · Incredibowl",
  description:
    "Incredibowl 退款与取消政策：订单取消、退款条件与流程说明。",
  alternates: {
    canonical: "/refund",
  },
};

export default function RefundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
