"use client";

import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, X } from 'lucide-react';
import { getApprovedFeedbacks, submitFeedback, Feedback } from '@/lib/feedbacks';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

const SEED_FEEDBACKS = [
    { name: "Little Jack (SkyVille 8 @ Benteng)", text: "练完gym最需要蛋白质，阿姨的鸡扒饭份量刚好，吃饱不撑。比自己煮鸡胸肉好吃一百倍。", time: "上午 11:42" },
    { name: "Ah Hao (Pearl Point)", text: "一开始看到纳豆有点怕，结果配上温泉蛋一拌，上瘾了😂 现在每天固定一碗。", time: "下午 12:15" },
    { name: "Amy Tan (Millerz Square)", text: "当归鸡真的很补，喝完整个人暖起来。我月经期每次都订这个，比自己炖方便太多。", time: "昨天" },
];

export default function FeedbackSection() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackName, setFeedbackName] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

    useEffect(() => {
        getApprovedFeedbacks().then(data => { setFeedbacks(data); setLoading(false); });
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
        ...SEED_FEEDBACKS,
        ...feedbacks.map(f => ({ name: f.name, text: f.text, time: f.time })),
    ];

    return (
        <>
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="md:col-span-1 bg-[#E3EADA] rounded-[32px] p-8 flex flex-col justify-center">
                    <MessageCircle size={32} className="text-[#1A2D23] mb-4" />
                    <h2 className="text-3xl font-extrabold mb-4 leading-tight">隔壁邻居<br />怎么说</h2>
                    <p className="text-[#1A2D23]/70 font-medium text-sm mb-6">每一条都来自 Old Klang Road 周边公寓邻居的真实 WhatsApp 留言。<br /><br />没有网红，没有广告，只有吃过的人说的真心话。</p>
                    <button onClick={() => setIsFeedbackModalOpen(true)} className="w-full py-3 bg-[#1A2D23] text-white rounded-xl font-bold hover:bg-[#2A3D33] transition-colors flex items-center justify-center gap-2">
                        <Plus size={18} /> 写下您的留言
                    </button>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                                <div className="bg-[#FDFBF7] p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl mb-4">
                                    <SkeletonBlock className="h-4 w-full mb-2" />
                                    <SkeletonBlock className="h-4 w-4/5 mb-2" />
                                    <SkeletonBlock className="h-4 w-3/5" />
                                </div>
                                <div className="flex justify-end gap-2 mt-3 px-4">
                                    <SkeletonBlock className="h-3 w-24" />
                                    <SkeletonBlock className="h-3 w-12" />
                                </div>
                            </div>
                        ))
                    ) : (
                        allMessages.map((msg, idx) => (
                            <div key={idx} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                                <div className="bg-[#FDFBF7] p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl mb-4 relative before:absolute before:-left-2 before:top-4 before:w-4 before:h-4 before:bg-[#FDFBF7] before:rotate-45">
                                    <p className="text-[#1A2D23] font-medium leading-relaxed italic text-sm">
                                        "{msg.text}"
                                    </p>
                                    <div className="flex gap-2 justify-end mb-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#1A2D23]/20" />
                                    </div>
                                </div>
                                <div className="text-right mt-3 text-xs text-[#1A2D23]/50 font-bold px-4 flex justify-end gap-2 items-center">
                                    <span>— {msg.name}</span>
                                    <span>{msg.time}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
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
                                        placeholder="阿姨煮的菜好吃吗？"
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
