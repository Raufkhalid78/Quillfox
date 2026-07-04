'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Check, Crown } from 'lucide-react'

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 font-sans overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-white/70 hover:text-white">
          <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </Button>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">Simple, transparent pricing.</h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Choose the plan that fits your needs. 
            All plans include end-to-end encryption by default because your privacy is a right, not a luxury.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center" style={{ perspective: "1500px" }}>
          
          {/* Free */}
          <motion.div 
            whileHover={{ translateZ: 50, scale: 1.05 }}
            style={{ transformStyle: "preserve-3d" }}
            className="p-8 rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl"
          >
            <h3 className="text-xl font-bold text-white/80">Free</h3>
            <div className="my-4"><span className="text-5xl font-black">$0</span></div>
            <p className="text-sm text-white/50 mb-6">Perfect for personal use and evaluating the platform.</p>
            <ul className="space-y-4 text-sm text-white/70 mb-8">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 1 Active Device</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 2 Collaborators</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Unlimited Notes</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> End-to-End Encryption</li>
            </ul>
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full rounded-full border-white/20">Get Started for Free</Button>
          </motion.div>

          {/* Premium */}
          <motion.div 
            initial={{ translateZ: 100, scale: 1.05 }}
            whileHover={{ translateZ: 150, scale: 1.1 }}
            style={{ transformStyle: "preserve-3d", boxShadow: "0 0 100px -20px rgba(16,185,129,0.3)" }}
            className="p-8 rounded-3xl border border-emerald-500/30 bg-black/80 backdrop-blur-xl relative z-10"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
            <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">Premium</h3>
            <div className="my-4"><span className="text-5xl font-black">$7</span><span className="text-white/50">/mo</span></div>
            <p className="text-sm text-white/60 mb-6">For power users and small teams who need more flexibility.</p>
            <ul className="space-y-4 text-sm text-white/90 mb-8 font-medium">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 3 Active Devices</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 15 Collaborators</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Advanced E2EE Controls</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Purchase Extra Seats ($5/10 seats)</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Priority Sync</li>
            </ul>
            <Button onClick={() => router.push('/dashboard')} className="w-full rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold">Start Free Trial</Button>
          </motion.div>

          {/* Ultra */}
          <motion.div 
            whileHover={{ translateZ: 50, scale: 1.05 }}
            style={{ transformStyle: "preserve-3d" }}
            className="p-8 rounded-3xl border border-violet-500/20 bg-black/60 backdrop-blur-xl"
          >
            <h3 className="text-xl font-bold text-violet-400 flex items-center gap-2"><Crown className="w-5 h-5" /> Ultra</h3>
            <div className="my-4"><span className="text-5xl font-black">$17</span><span className="text-white/50">/mo</span></div>
            <p className="text-sm text-white/50 mb-6">Maximum limits and dedicated support for enterprises.</p>
            <ul className="space-y-4 text-sm text-white/70 mb-8">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> 5 Active Devices</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> 35 Collaborators included</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Custom Themes & Branding</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> 24/7 Priority Support</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Audit Logs (Coming Soon)</li>
            </ul>
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full rounded-full border-violet-500/30 hover:bg-violet-500/10 text-violet-300">Upgrade to Ultra</Button>
          </motion.div>

        </div>
      </main>

      <footer className="border-t border-white/5 py-12 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} QuillFox. A product by TechyDez. All rights reserved.</p>
      </footer>
    </div>
  )
}
