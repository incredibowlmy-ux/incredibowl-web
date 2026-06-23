import type { Metadata } from "next";

// privacy/page.tsx is a Client Component and cannot export metadata, so it
// inherited the root layout's Chinese homepage title AND its canonical "/"
// (marking this page a duplicate of the homepage). This server-component layout
// gives the page its own title + self-referencing canonical.
export const metadata: Metadata = {
  title: "隐私政策 Privacy Policy · Incredibowl",
  description:
    "Incredibowl（Incredibowl Services SA0649425-V）隐私政策：我们如何收集、使用与保护你的个人资料。",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
