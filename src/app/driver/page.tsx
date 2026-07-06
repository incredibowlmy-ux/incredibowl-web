import type { Metadata } from "next";
import DriverClient from "./DriverClient";

// Internal delivery tool — never index
export const metadata: Metadata = {
    title: "配送模式 | Incredibowl",
    robots: { index: false, follow: false },
};

export default function DriverPage() {
    return <DriverClient />;
}
