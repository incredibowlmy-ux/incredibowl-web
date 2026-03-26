import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, Facebook, Instagram, Leaf, Sun, Heart, MapPin } from 'lucide-react';

const XiaohongshuIcon = ({ size = 18, className = "" }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        fill="currentColor"
        className={className}
    >
        <path d="M787.2 208.2H236.8c-47.4 0-85.8 38.4-85.8 85.8v436c0 47.4 38.4 85.8 85.8 85.8h550.4c47.4 0 85.8-38.4 85.8-85.8v-436c0-47.4-38.4-85.8-85.8-85.8zM425.8 616L292.6 692c-12.4 7.2-28.6 2.8-35.8-9.6s-2.8-28.6 9.6-35.8l133.2-76v-210.6c0-14.4 11.6-26 26-26s26 11.6 26 26v200.4l91.2 42.6 91.2-42.6V383c0-14.4 11.6-26 26-26s26 11.6 26 26v210.6l133.2 76c12.4 7.2 16.8 23.4 9.6 35.8s-23.4 16.8-35.8 9.6l-133.2-76V616c-13.4-3.6-26.6-8.2-39.2-13.6-1.8-.8-3.4-1.6-5-2.6L512 565l-78.8 34.8c-1.6 1-3.2 1.8-5 2.6-12.6 5.4-25.8 10-39.2 13.6V616z" />
    </svg>
);

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
                        <div className="flex justify-center gap-6 mt-6">
                            <a href="https://www.facebook.com/profile.php?id=61587218759550" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E3EADA]/40 flex items-center justify-center text-[#1A2D23]/70 hover:bg-[#FF6B35] hover:text-white transition-all shadow-sm hover:-translate-y-1">
                                <Facebook size={18} />
                            </a>
                            <a href="https://www.instagram.com/incredibowl_my/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E3EADA]/40 flex items-center justify-center text-[#1A2D23]/70 hover:bg-[#FF6B35] hover:text-white transition-all shadow-sm hover:-translate-y-1">
                                <Instagram size={18} />
                            </a>
                            <a href="https://www.xiaohongshu.com/user/profile/69793d3f000000002603b93a" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E3EADA]/40 flex items-center justify-center text-[#1A2D23]/70 hover:bg-[#FF6B35] hover:text-white transition-all shadow-sm hover:-translate-y-1">
                                <XiaohongshuIcon size={18} />
                            </a>
                        </div>
                        <div className="mt-12 flex flex-col items-center justify-center gap-6 border-t border-[#E3EADA]/50 pt-10 w-full max-w-3xl mx-auto">
                            {/* Brand Trust Signals */}
                            <div className="flex justify-center flex-wrap gap-4 md:gap-10 text-[#1A2D23]/70 font-bold text-[11px] md:text-xs uppercase tracking-[0.2em] items-center">
                                <span className="flex items-center gap-1.5"><Leaf size={14} className="text-[#2D5F3E]" /> No MSG</span>
                                <span className="opacity-20 hidden md:block">•</span>
                                <span className="flex items-center gap-1.5"><Sun size={14} className="text-[#FF6B35]" /> Daily Fresh</span>
                                <span className="opacity-20 hidden md:block">•</span>
                                <span className="flex items-center gap-1.5"><Heart size={14} className="text-[#C76F40]" /> Mum's Recipe</span>
                            </div>

                            {/* Location/Community */}
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-[#1A2D23]/40 uppercase tracking-[0.2em] font-black mb-2 flex justify-center items-center gap-1.5">
                                    <MapPin size={12} className="text-[#FF6B35]" /> Serving Our Neighbours Around
                                </p>
                                <p className="text-[10px] md:text-xs text-[#1A2D23]/60 font-bold tracking-[0.1em] md:tracking-[0.2em] leading-relaxed">
                                    Pearl Point · Millerz Square · OUG · Old Klang Road
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-[#1A2D23]/30 text-[10px] uppercase font-black tracking-widest text-center">
                    <p>&copy; 2026 Incredibowl. 家的味道，每天新鲜采购。</p>
                    <p>Operated by INCREDIBOWL SERVICES 202603047882 (SA0649425-V)</p>
                </div>
            </div>
        </footer>
    );
}
