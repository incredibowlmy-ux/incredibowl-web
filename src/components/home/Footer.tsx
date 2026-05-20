import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, Mail, Leaf, Sun, Heart, MapPin, ShieldCheck } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="pt-20 pb-32 md:pb-36 bg-white border-t border-[#E3EADA]">
            <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b border-gray-100 pb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#E3EADA] flex items-center justify-center overflow-hidden shadow-sm">
                            <Image src="/logo.webp" alt="Incredibowl Logo" width={192} height={192} className="scale-110" />
                        </div>
                        <div className="text-left">
                            <span className="text-xl font-black tracking-tight uppercase text-[#1A2D23] leading-none">Incredibowl.my</span>
                            <p className="text-[13px] font-bold text-[#FF6B35] tracking-widest uppercase mt-1">Cook with Mum&apos;s Sincere Heart</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[#1A2D23]/60 font-bold text-xs uppercase tracking-widest">
                        <Link href="/blog" className="hover:text-[#FF6B35] transition-colors">Blog</Link>
                        <Link href="/privacy" className="hover:text-[#FF6B35] transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-[#FF6B35] transition-colors">Terms of Service</Link>
                        <Link href="/refund" className="hover:text-[#FF6B35] transition-colors">Refund & Cancellation</Link>
                    </div>
                </div>

                {/* Mobile: existing centered stack (preserved) */}
                <div className="grid md:grid-cols-1 gap-6 text-[#1A2D23] lg:hidden">
                    <div className="space-y-4">
                        <p className="text-base font-bold tracking-wide">Contact Us / 联系我们</p>
                        <div className="flex flex-col items-center gap-2.5 max-w-xs mx-auto">
                            <a
                                href="https://wa.me/60103370197"
                                className="w-full min-h-[44px] flex items-center gap-3 px-5 bg-[#FDFBF7] hover:bg-[#FFF3E0] border border-[#E3EADA] rounded-xl text-[#1A2D23] font-bold text-sm transition-colors active:scale-[0.98]"
                            >
                                <Phone size={16} className="text-[#FF6B35] shrink-0" />
                                <span>010-337 0197</span>
                            </a>
                            <a
                                href="mailto:hello@incredibowl.my"
                                className="w-full min-h-[44px] flex items-center gap-3 px-5 bg-[#FDFBF7] hover:bg-[#FFF3E0] border border-[#E3EADA] rounded-xl text-[#1A2D23] font-bold text-sm transition-colors active:scale-[0.98]"
                            >
                                <Mail size={16} className="text-[#FF6B35] shrink-0" />
                                <span>hello@incredibowl.my</span>
                            </a>
                        </div>
                        <div className="flex justify-center items-center gap-6 mt-6">
                            <a href="https://www.facebook.com/profile.php?id=61587218759550" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/fb-logo.png" alt="Facebook" width={46} height={46} className="w-[46px] h-[46px] object-contain scale-110" />
                            </a>
                            <a href="https://www.instagram.com/incredibowl_my/" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/ig-logo.png" alt="Instagram" width={40} height={40} className="w-[40px] h-[40px] object-contain" />
                            </a>
                            <a href="https://www.xiaohongshu.com/user/profile/69793d3f000000002603b93a" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/xhs-logo.png" alt="Xiaohongshu" width={40} height={40} className="w-[40px] h-[40px] object-contain" />
                            </a>
                        </div>
                        <div className="mt-12 flex flex-col items-center justify-center gap-6 border-t border-[#E3EADA]/50 pt-10 w-full max-w-3xl mx-auto">
                            {/* Brand Trust Signals */}
                            <div className="flex justify-center flex-wrap gap-4 md:gap-10 text-[#1A2D23]/70 font-bold text-[11px] md:text-xs uppercase tracking-[0.2em] items-center">
                                <span className="flex items-center gap-1.5"><Leaf size={14} className="text-[#2D5F3E]" /> No MSG</span>
                                <span className="opacity-20 hidden md:block">•</span>
                                <span className="flex items-center gap-1.5"><Sun size={14} className="text-[#FF6B35]" /> Daily Fresh</span>
                                <span className="opacity-20 hidden md:block">•</span>
                                <span className="flex items-center gap-1.5"><Heart size={14} className="text-[#C76F40]" /> Mum&apos;s Recipe</span>
                            </div>

                            {/* Location/Community */}
                            <div className="text-center mt-2">
                                <p className="text-xs text-[#1A2D23]/55 uppercase tracking-[0.2em] font-bold mb-2 flex justify-center items-center gap-1.5">
                                    <MapPin size={12} className="text-[#FF6B35]" /> Serving Our Neighbours Around
                                </p>
                                <p className="text-[13px] text-[#1A2D23]/65 font-semibold tracking-[0.1em] md:tracking-[0.15em] leading-relaxed">
                                    Pearl Point · Millerz Square · OUG · Old Klang Road
                                </p>
                                <ul className="text-[12px] text-[#1A2D23]/65 mt-3 mx-auto max-w-[260px] space-y-1">
                                    <li className="flex justify-between gap-3">
                                        <span className="font-semibold text-[#1A2D23]/80">2.5km 内</span>
                                        <span><span className="font-bold">RM 3</span> · 满 20 免运</span>
                                    </li>
                                    <li className="flex justify-between gap-3">
                                        <span className="font-semibold text-[#1A2D23]/80">2.5–5km</span>
                                        <span><span className="font-bold">RM 5</span> · 满 30 免运</span>
                                    </li>
                                    <li className="flex justify-between gap-3">
                                        <span className="font-semibold text-[#1A2D23]/80">5–7.5km</span>
                                        <span><span className="font-bold">RM 15</span> · 满 40 → RM 5</span>
                                    </li>
                                    <li className="text-[11px] text-[#1A2D23]/40 italic text-center pt-1">7.5km 以外暂不配送</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop: 3-col grid */}
                <div className="hidden lg:grid lg:grid-cols-3 lg:gap-12 lg:text-left text-[#1A2D23]">
                    {/* Col 1: Contact + Social */}
                    <div className="space-y-4">
                        <p className="text-base font-bold tracking-wide">Contact Us / 联系我们</p>
                        <div className="flex flex-col gap-2.5">
                            <a
                                href="https://wa.me/60103370197"
                                className="min-h-[44px] flex items-center gap-3 px-5 bg-[#FDFBF7] hover:bg-[#FFF3E0] border border-[#E3EADA] rounded-xl text-[#1A2D23] font-bold text-sm transition-colors"
                            >
                                <Phone size={16} className="text-[#FF6B35] shrink-0" />
                                <span>010-337 0197</span>
                            </a>
                            <a
                                href="mailto:hello@incredibowl.my"
                                className="min-h-[44px] flex items-center gap-3 px-5 bg-[#FDFBF7] hover:bg-[#FFF3E0] border border-[#E3EADA] rounded-xl text-[#1A2D23] font-bold text-sm transition-colors"
                            >
                                <Mail size={16} className="text-[#FF6B35] shrink-0" />
                                <span>hello@incredibowl.my</span>
                            </a>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <a href="https://www.facebook.com/profile.php?id=61587218759550" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/fb-logo.png" alt="Facebook" width={42} height={42} className="w-[42px] h-[42px] object-contain scale-110" />
                            </a>
                            <a href="https://www.instagram.com/incredibowl_my/" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/ig-logo.png" alt="Instagram" width={36} height={36} className="w-9 h-9 object-contain" />
                            </a>
                            <a href="https://www.xiaohongshu.com/user/profile/69793d3f000000002603b93a" target="_blank" rel="noopener noreferrer" className="block hover:-translate-y-1 transition-transform hover:shadow-md rounded-[8px] overflow-hidden bg-white">
                                <Image src="/xhs-logo.png" alt="Xiaohongshu" width={36} height={36} className="w-9 h-9 object-contain" />
                            </a>
                        </div>
                    </div>

                    {/* Col 2: Coverage */}
                    <div className="space-y-4">
                        <p className="text-base font-bold tracking-wide flex items-center gap-2">
                            <MapPin size={16} className="text-[#FF6B35]" />
                            服务范围 / Coverage
                        </p>
                        <div className="space-y-2 text-[14px] text-[#1A2D23]/75 font-semibold leading-relaxed">
                            <p>Pearl Point</p>
                            <p>Millerz Square</p>
                            <p>OUG</p>
                            <p>Old Klang Road</p>
                        </div>
                        <ul className="text-[13px] text-[#1A2D23]/65 space-y-1 max-w-[260px]">
                            <li className="flex justify-between gap-3">
                                <span className="font-semibold text-[#1A2D23]/80">2.5km 内</span>
                                <span><span className="font-bold">RM 3</span> · 满 20 免运</span>
                            </li>
                            <li className="flex justify-between gap-3">
                                <span className="font-semibold text-[#1A2D23]/80">2.5–5km</span>
                                <span><span className="font-bold">RM 5</span> · 满 30 免运</span>
                            </li>
                            <li className="flex justify-between gap-3">
                                <span className="font-semibold text-[#1A2D23]/80">5–7.5km</span>
                                <span><span className="font-bold">RM 15</span> · 满 40 → RM 5</span>
                            </li>
                            <li className="text-[11px] text-[#1A2D23]/40 italic pt-1">7.5km 以外暂不配送</li>
                        </ul>
                    </div>

                    {/* Col 3: Brand Promise */}
                    <div className="space-y-4">
                        <p className="text-base font-bold tracking-wide">品质承诺 / Our Promise</p>
                        <div className="space-y-3">
                            <p className="flex items-center gap-2.5 text-[14px] text-[#1A2D23]/75 font-semibold">
                                <Leaf size={16} className="text-[#2D5F3E] shrink-0" />
                                No MSG · 不加味精
                            </p>
                            <p className="flex items-center gap-2.5 text-[14px] text-[#1A2D23]/75 font-semibold">
                                <Sun size={16} className="text-[#FF6B35] shrink-0" />
                                Daily Fresh · 每日新鲜采购
                            </p>
                            <p className="flex items-center gap-2.5 text-[14px] text-[#1A2D23]/75 font-semibold">
                                <Heart size={16} className="text-[#C76F40] shrink-0" />
                                Mum&apos;s Recipe · 妈妈的味道
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-gray-500 text-xs font-medium tracking-wide text-center leading-relaxed">
                    <p>&copy; 2026 Incredibowl. 家的味道，每天新鲜采购。</p>
                    <p className="text-gray-400 max-w-prose">
                        <ShieldCheck size={12} className="inline align-[-2px] text-[#C9A24E] mr-1 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                        Operated by Incredibowl Services 202603047882 (SA0649425-V)
                    </p>
                </div>
            </div>
        </footer>
    );
}
