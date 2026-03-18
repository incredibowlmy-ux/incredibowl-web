import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="py-20 bg-white border-t border-[#E3EADA]">
            <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-gray-100 pb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#E3EADA] flex items-center justify-center overflow-hidden shadow-sm">
                            <Image src="/logo.png" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                        </div>
                        <div className="text-left">
                            <span className="text-2xl font-black tracking-tighter uppercase text-[#1A2D23]">Incredibowl.my</span>
                            <p className="text-[10px] font-bold text-[#FF6B35] tracking-widest uppercase">Cook with Mum&apos;s Sincere Heart</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[#1A2D23]/60 font-bold text-xs uppercase tracking-widest">
                        <Link href="/privacy" className="hover:text-[#FF6B35] transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[#FF6B35] transition-colors">Terms of Service</Link>
                        <Link href="/refund" className="hover:text-[#FF6B35] transition-colors">Refund & Cancellation</Link>
                    </div>
                </div>

                <div className="grid md:grid-cols-1 gap-6 text-[#1A2D23]">
                    <div className="space-y-4">
                        <p className="text-lg font-black">Contact Us / 联系我们</p>
                        <div className="flex justify-center gap-8 text-sm font-bold">
                            <a href="https://wa.me/60103370197" className="flex items-center gap-2 text-[#FF6B35] hover:text-[#E95D31] transition-colors"><Phone size={18} /> 010-337 0197</a>
                            <span className="opacity-20 text-[#1A2D23]">|</span>
                            <a href="mailto:hello@incredibowl.my" className="flex items-center gap-2 text-[#FF6B35] hover:text-[#E95D31] transition-colors">hello@incredibowl.my</a>
                        </div>
                        <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black">📍 Pearl Point / Millerz Square / OUG, Kuala Lumpur</p>
                    </div>
                </div>

                <div className="flex justify-center flex-wrap gap-8 md:gap-12 text-[#1A2D23]/30 font-bold text-xs uppercase tracking-[0.2em]">
                    <span>Old Klang Road</span>
                    <span>No MSG</span>
                    <span>Daily Fresh</span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#1A2D23]/30 text-[10px] uppercase font-black tracking-widest text-center">
                    <p>&copy; 2026 Incredibowl. 家的味道，每天新鲜采购。</p>
                    <p>Operated by INCREDIBOWL SERVICES 202603047882 (SA0649425-V)</p>
                </div>
            </div>
        </footer>
    );
}
