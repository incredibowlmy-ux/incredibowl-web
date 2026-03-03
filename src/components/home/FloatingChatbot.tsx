"use client";

import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function FloatingChatbot() {
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end space-y-4">
            {isChatbotOpen && (
                <div className="w-[340px] md:w-[400px] h-[580px] max-h-[75vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E3EADA] animate-in slide-in-from-bottom-5 flex flex-col">
                    <iframe
                        src="https://udify.app/chatbot/sYBrRfnjikAZm3S5"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        frameBorder={0}
                        allow="microphone"
                    />
                </div>
            )}

            <button
                onClick={() => setIsChatbotOpen(!isChatbotOpen)}
                className="w-[56px] h-[56px] bg-[#1A2D23] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 hover:bg-[#2A3D33] border-2 border-[#E3EADA] transition-all duration-300 relative group"
            >
                {isChatbotOpen ? <X size={26} /> : (
                    <>
                        <MessageCircle size={26} />
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#FF6B35] rounded-full border-2 border-[#1A2D23] animate-pulse"></span>
                    </>
                )}
            </button>
        </div>
    );
}
