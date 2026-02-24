"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Leaf, ArrowRight, User, Mail, Lock, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const router = useRouter()
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Check if already logged in
    useEffect(() => {
        const user = localStorage.getItem('incredibowl_user')
        if (user) router.push('/v0-8')
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        // Simulate network delay
        setTimeout(() => {
            const userData = {
                id: Math.random().toString(36).substr(2, 9),
                name: isLogin ? 'User' : name,
                email,
                joinedDate: new Date().toISOString()
            }
            localStorage.setItem('incredibowl_user', JSON.stringify(userData))
            setIsLoading(false)
            router.push('/v0-8')
        }, 1200)
    }

    return (
        <div className="min-h-screen bg-[#F7F9F9] font-sans text-[#2D3142] flex flex-col items-center justify-center p-6">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Outfit:wght@300;500;700;900&display=swap');
                h1, h2, h3 { font-family: 'Outfit', sans-serif; }
                body { font-family: 'Inter', sans-serif; }
            `}</style>

            <Link href="/v0-8" className="flex items-center gap-4 mb-12 hover:scale-105 transition-transform group">
                <div className="w-10 h-10 bg-[#4F6D7A] rounded-full flex items-center justify-center p-2 group-hover:rotate-12 transition-transform">
                    <Leaf className="text-white w-full h-full" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-[#4F6D7A]">Incredibowl</h1>
            </Link>

            <div className="w-full max-w-md bg-white rounded-[48px] shadow-2xl shadow-[#4F6D7A]/5 overflow-hidden border border-gray-100">
                <div className="p-12 space-y-8">
                    <div className="text-center space-y-4">
                        <h2 className="text-4xl font-black tracking-tight leading-none">
                            {isLogin ? 'Welcome Back.' : 'Join the Tribe.'}
                        </h2>
                        <p className="text-gray-400 font-medium">
                            {isLogin ? 'Fuel your performance with every bowl.' : 'Start your journey to zero-slump productivity.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="relative">
                                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full pl-14 pr-6 py-5 bg-[#F7F9F9] rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-14 pr-6 py-5 bg-[#F7F9F9] rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-14 pr-6 py-5 bg-[#F7F9F9] rounded-3xl border-2 border-transparent focus:border-[#4F6D7A]/20 transition-all outline-none font-bold placeholder:text-gray-300 text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-5 bg-[#4F6D7A] text-white rounded-3xl font-black text-lg hover:translate-y-[-2px] hover:shadow-xl hover:shadow-[#4F6D7A]/20 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Enter Kitchen' : 'Create Account'}
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-[#4F6D7A] transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign up" : "Already a member? Login here"}
                        </button>
                    </div>
                </div>

                <div className="p-8 bg-[#4F6D7A]/5 border-t border-[#4F6D7A]/10 flex items-center justify-center gap-3">
                    <ShieldCheck size={16} className="text-[#4F6D7A]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#4F6D7A]">Secure Incredibowl Access</span>
                </div>
            </div>

            <p className="mt-12 text-gray-300 text-[10px] font-black uppercase tracking-[0.3em]">
                &copy; 2026 Crafted in Old Klang Road
            </p>
        </div>
    )
}
