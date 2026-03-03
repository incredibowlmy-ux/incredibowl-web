"use client";

import React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';

export default function AuthHeader({ onClose }: { onClose: () => void }) {
    return (
        <div className="p-10 text-center bg-white border-b border-[#E3EADA] relative">
            <button onClick={onClose} className="absolute top-5 right-5 p-2 text-gray-400 hover:text-[#1A2D23] transition-colors">
                <X size={24} />
            </button>
            <div className="w-24 h-24 mx-auto mb-5 bg-white border-2 border-[#E3EADA] rounded-full flex items-center justify-center overflow-hidden shadow-md">
                <Image src="/logo.png" alt="Logo" width={128} height={128} className="scale-110" />
            </div>
            <h2 className="text-3xl font-black text-[#1A2D23]">Incredibowl</h2>
            <p className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest mt-2">
                Cook with Mum&#39;s Sincere Heart
            </p>
        </div>
    );
}
