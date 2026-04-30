"use client";

import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, X } from 'lucide-react';
import { getApprovedFeedbacks, submitFeedback, Feedback } from '@/lib/feedbacks';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

type SeedFeedback = { name: string; text: string; time?: string; reviewDate?: string; isGoogle?: boolean };

// Google reviews first (highest credibility), then community WhatsApp messages
const SEED_FEEDBACKS: SeedFeedback[] = [
    { name: "Jia Chee Chong (Local Guide)", text: "I ordered two meals (Herbal Chicken & Prawn) for consecutive two days. To my surprise, the chicken thigh and prawns are huge and fresh, tastes good and healthy too. Will definitely reorder :)", reviewDate: "2026-05-01", isGoogle: true },
    { name: "ebby cheong", text: "是我喜欢的味道！不会咸，虾很大一下也很新鲜。有机会的话我还会再下单，推荐！", reviewDate: "2026-04-12", isGoogle: true },
    { name: "Curry", text: "Food is nice, price is okay. The downside is they have different menu everyday, that's mean I might not getting the dish I want.. Overall, I recommend this food seller I will repeat my order.", reviewDate: "2026-03-29", isGoogle: true },
    { name: "Little Jack (SkyVille 8 @ Benteng)", text: "练完gym最需要蛋白质，碗妈的鸡扒饭份量刚好，吃饱不撑。比自己煮鸡胸肉好吃一百倍。", time: "上午 11:42" },
    { name: "Ah Hao (Pearl Point)", text: "一开始看到纳豆有点怕，结果配上温泉蛋一拌，上瘾了😂 现在每天固定一碗。", time: "下午 12:15" },
    { name: "Amy Tan (Millerz Square)", text: "当归鸡真的很补，喝完整个人暖起来。我月经期每次都订这个，比自己炖方便太多。", time: "昨天" },
];

/** Format an ISO date string as a Chinese relative time. Returns "" if input is empty. */
function formatRelativeCN(dateStr?: string): string {
    if (!dateStr) return "";
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return "";
    const diffDays = Math.floor((Date.now() - target.getTime()) / 86400000);
    if (diffDays < 1) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
    return `${Math.floor(diffDays / 365)} 年前`;
}

export default function FeedbackSection() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackName, setFeedbackName] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    // Defer relative-time computation to client-side to avoid SSR/CSR mismatch
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        getApprovedFeedbacks()
            .then(data => {
                setFeedbacks(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch feedbacks:", err);
                setFeedbacks([]);
                setLoading(false);
            });
    }, []);

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackName.trim() || !feedbackText.trim()) return;
        setFeedbackSubmitting(true);
        try {
            await submitFeedback(feedbackName, feedbackText);
            alert("留言提交成功！感谢您的真实反馈。");
            setFeedbackName('');
            setFeedbackText('');
            setIsFeedbackModalOpen(false);
        } catch (error) {
            console.error("Feedback submit error", error);
            alert("提交失败，请重试。");
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    const allMessages = [
        ...SEED_FEEDBACKS.map(msg => ({
            name: msg.name,
            text: msg.text,
            time: msg.reviewDate ? (mounted ? formatRelativeCN(msg.reviewDate) : '近期') : (msg.time || ''),
            isGoogle: !!msg.isGoogle,
        })),
        ...feedbacks.map(f => ({
            name: f.name,
            text: f.text,
            time: mounted && f.createdAt ? formatRelativeCN(f.createdAt) : f.time,
            isGoogle: false,
        })),
    ];

    // Marquee duplicates the list to enable seamless infinite scroll
    const marqueeMessages = allMessages.length > 0 ? [...allMessages, ...allMessages] : [];
    const marqueeDurationSec = Math.max(40, allMessages.length * 8);

    return (
        <>
            <div id="feedback" className="lg:col-span-12 mt-4 scroll-mt-32">
                {/* Compact header — single row */}
                <div className="bg-[#E3EADA] rounded-t-[32px] px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/60 flex items-center justify-center shrink-0">
                            <MessageCircle size={18} className="text-[#1A2D23]" />
                        </div>
                        <div>
                            <h2 className="text-[22px] lg:text-[40px] font-extrabold tracking-tight text-[#1A2D23] leading-tight">隔壁邻居怎么说</h2>
                            <p className="text-[13px] lg:text-base text-[#1A2D23]/65 font-medium leading-relaxed mt-0.5 lg:mt-2">
                                Old Klang Road 邻居真实留言 · 没有网红，没有广告
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats summary — sits between header and grid */}
                <div className="bg-[#E3EADA] px-4 md:px-8 pb-4">
                    <div className="bg-white/55 backdrop-blur-sm rounded-2xl px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 border border-white/70">
                        <span className="inline-flex items-center gap-1 text-[14px] font-extrabold text-[#1A2D23]">
                            Google <span className="text-amber-500">5.0 ★</span>
                        </span>
                        <span className="text-[#1A2D23]/30 mx-1.5 hidden sm:inline">·</span>
                        <span className="text-[14px] font-extrabold text-[#1A2D23]">{allMessages.length} 条真实留言</span>
                        <span className="text-[#1A2D23]/30 mx-1.5 hidden sm:inline">·</span>
                        <span className="text-[13px] font-semibold text-[#1A2D23]/75">来自 Pearl Point / Millerz / SkyVille 8 等社区</span>
                    </div>
                </div>

                {/* Reviews marquee — horizontal auto-scroll, hover to pause */}
                <div className="bg-[#E3EADA] pb-6">
                    {loading ? (
                        <div className="px-4 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                    <div className="bg-[#FDFBF7] p-4 rounded-tl-xl rounded-tr-xl rounded-br-xl mb-4">
                                        <SkeletonBlock className="h-3.5 w-full mb-2" />
                                        <SkeletonBlock className="h-3.5 w-4/5 mb-2" />
                                        <SkeletonBlock className="h-3.5 w-3/5" />
                                    </div>
                                    <SkeletonBlock className="h-3 w-32" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="feedback-marquee group/marquee relative overflow-hidden">
                                {/* Edge fades */}
                                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 md:w-16 bg-gradient-to-r from-[#E3EADA] to-transparent z-10" aria-hidden="true" />
                                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 md:w-16 bg-gradient-to-l from-[#E3EADA] to-transparent z-10" aria-hidden="true" />

                                <div
                                    className="feedback-marquee-track flex gap-4 w-max"
                                    style={{ animationDuration: `${marqueeDurationSec}s` }}
                                >
                                    {marqueeMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            aria-hidden={idx >= allMessages.length}
                                            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col w-[280px] md:w-[320px] shrink-0"
                                        >
                                            {/* Quote bubble */}
                                            <div className="bg-[#FDFBF7] p-4 rounded-tl-xl rounded-tr-xl rounded-br-xl mb-3 relative before:absolute before:-left-2 before:top-4 before:w-4 before:h-4 before:bg-[#FDFBF7] before:rotate-45">
                                                <p className="text-[#1A2D23] font-medium leading-relaxed text-sm line-clamp-5">
                                                    &ldquo;{msg.text}&rdquo;
                                                </p>
                                            </div>

                                            {/* Single-line meta: stars + name · time */}
                                            <div className="mt-auto flex items-center justify-between gap-2 px-1">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {msg.isGoogle && (
                                                        <span className="text-amber-400 text-xs shrink-0" title="Google Review">⭐⭐⭐⭐⭐</span>
                                                    )}
                                                    <span className="text-xs font-bold text-[#1A2D23]/75 truncate">— {msg.name}</span>
                                                </div>
                                                {msg.time && (
                                                    <span className="text-xs text-[#1A2D23]/45 font-medium shrink-0">{msg.time}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bottom CTA — write your own */}
                            <div className="mt-6 px-4 md:px-8 flex justify-center">
                                <button
                                    onClick={() => setIsFeedbackModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A2D23] hover:bg-[#2A3D33] text-white text-sm font-bold rounded-full transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] active:brightness-95"
                                >
                                    <Plus size={16} /> 写下您的留言
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Bottom corner radius */}
                <div className="bg-[#E3EADA] rounded-b-[32px] h-2" />
            </div>

            {/* Feedback Modal */}
            {isFeedbackModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#1A2D23]/40 backdrop-blur-sm" onClick={() => setIsFeedbackModalOpen(false)}></div>
                    <div className="bg-[#FDFBF7] rounded-[32px] w-full max-w-md relative z-10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 md:p-8 border-b border-[#E3EADA]">
                            <button onClick={() => setIsFeedbackModalOpen(false)} className="absolute right-6 top-6 w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1A2D23] border border-[#E3EADA] hover:bg-[#E3EADA] transition-colors">
                                <X size={20} />
                            </button>
                            <h3 className="text-2xl font-black text-[#1A2D23] pr-12">留下真实评价</h3>
                            <p className="text-sm font-medium text-[#1A2D23]/60 mt-2">分享您的用餐体验给邻居们吧</p>
                        </div>
                        <div className="p-6 md:p-8 bg-white">
                            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">你的称呼 (选填居住地)</label>
                                    <input
                                        type="text"
                                        value={feedbackName}
                                        onChange={e => setFeedbackName(e.target.value)}
                                        placeholder="例如: Amy Tan (Pearl Point)"
                                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E3EADA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] font-medium"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">留言内容</label>
                                    <textarea
                                        value={feedbackText}
                                        onChange={e => setFeedbackText(e.target.value)}
                                        placeholder="碗妈煮的菜好吃吗？"
                                        rows={4}
                                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#E3EADA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] font-medium resize-none"
                                        required
                                    ></textarea>
                                </div>
                                <button disabled={feedbackSubmitting} type="submit" className="w-full py-4 mt-2 bg-[#FF6B35] hover:bg-[#E95D31] text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
                                    {feedbackSubmitting ? '提交中...' : '提交留言'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
