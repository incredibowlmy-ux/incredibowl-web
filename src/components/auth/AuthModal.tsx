import React from 'react';
import { X, Mail, MapPin, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#5D4037]/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#FAF9F6] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 text-center bg-white border-b border-[#D4A373]/20 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 text-[#D4A373] hover:text-[#B04A33] transition-colors">
                        <X size={20} />
                    </button>
                    <div className="w-16 h-16 mx-auto mb-4 bg-white border border-[#D4A373]/20 rounded-full flex items-center justify-center p-1 shadow-md">
                        <Image src="/logo.png" alt="Logo" width={60} height={60} className="scale-105" />
                    </div>
                    <h2 className="text-2xl font-black text-[#5D4037] italic">Incredibowl 邻里</h2>
                    <p className="text-xs font-bold text-[#D4A373] uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                        <MapPin size={12} /> Pearl Suria 限定
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h3 className="font-bold text-[#B04A33] text-lg">注册/登录会员</h3>
                        <p className="text-xs text-[#795548] leading-relaxed">
                            加入我们，享受「免配送费」福利与每日精选菜单推送。每次下单还能赚取积分哦！
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* OAuth 模拟按钮 */}
                        <button className="w-full py-4 bg-white border-2 border-[#D4A373]/20 rounded-xl flex items-center justify-center gap-3 font-bold text-[#5D4037] hover:border-[#B04A33] hover:bg-[#B04A33]/5 transition-all">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                            使用 Google 继续
                        </button>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#D4A373]/20"></div></div>
                            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-[#FAF9F6] px-4 text-[#D4A373]">Or</span></div>
                        </div>

                        {/* Email 登录模拟 */}
                        <button className="w-full py-4 bg-[#B04A33] text-white rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-[#8D3421] transition-all shadow-xl shadow-[#B04A33]/20">
                            <Mail size={18} />
                            使用邮箱登录
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-[#D4A373]/10 text-center border-t border-[#D4A373]/20">
                    <p className="text-[10px] font-bold text-[#B04A33] flex items-center justify-center gap-1 uppercase tracking-wider">
                        <Sparkles size={12} /> RM 1 = 1 积分，推荐好友即获 RM5 折扣
                    </p>
                </div>
            </div>
        </div>
    );
}
