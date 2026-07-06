import type { Metadata } from "next";
import TrackClient from "./TrackClient";

// Token-keyed private page — never index
export const metadata: Metadata = {
    title: "订单跟踪 Order Tracking | Incredibowl",
    robots: { index: false, follow: false },
};

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <TrackClient token={token} />;
}
