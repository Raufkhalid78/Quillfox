'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useSpring, useMotionValue, useAnimationFrame } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Shield, Users, Lock, ChevronRight, Zap, Sparkles } from 'lucide-react'

// --- Reusable 3D Tilt Card ---
function TiltCard({ children, className }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 })
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 })

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-8 ${className}`}
    >
      <div
        style={{
          transform: "translateZ(50px)",
        }}
        className="relative z-10"
      >
        {children}
      </div>
    </motion.div>
  )
}

// --- Floating Particles Background ---
function Particles() {
  const [particles, setParticles] = useState<{ id: number, x: number, y: number, size: number, speed: number }[]>([])

  useEffect(() => {
    const arr = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 0.5 + 0.1,
    }))
    setParticles(arr)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/40 blur-[2px]"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
          }}
          transition={{
            duration: 20 / p.speed,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  )
}

import { useAppStore } from '@/stores/app-store'

export function LandingPage() {
  const router = useRouter()
  const currentUser = useAppStore(s => s.currentUser)
  const { scrollY } = useScroll()

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard')
    }
  }, [currentUser, router])
  
  // Parallax effects
  const y1 = useTransform(scrollY, [0, 1000], [0, 200])
  const y2 = useTransform(scrollY, [0, 1000], [0, -200])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 font-sans overflow-hidden">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/20 blur-[150px] mix-blend-screen" />
        <Particles />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter">QuillFox</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-white/70 hover:text-white" onClick={() => router.push('/dashboard')}>Log in</Button>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-medium shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-shadow hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-4" style={{ perspective: "1000px" }}>
          <motion.div style={{ y: y1, opacity }} className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1.1] mb-6">
                The Spatial Workspace for <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-500 to-violet-500">
                  Your Thoughts.
                </span>
              </h1>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl mx-auto font-light"
            >
              End-to-end encrypted notes, tasks, and real-time collaboration wrapped in a stunning, physics-based interface.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button 
                onClick={() => router.push('/dashboard')}
                size="lg" 
                className="h-14 px-8 text-lg rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.6)] transition-all group"
              >
                Enter the Vault <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => router.push('/pricing')}
                className="h-14 px-8 text-lg rounded-full border-white/20 text-white hover:bg-white/5"
              >
                View Pricing
              </Button>
            </motion.div>
          </motion.div>

          {/* 3D Floating Dashboard Mockup */}
          <motion.div 
            initial={{ opacity: 0, rotateX: 40, y: 100, z: -500 }}
            animate={{ opacity: 1, rotateX: 15, y: 0, z: 0 }}
            transition={{ duration: 1.2, delay: 0.6, type: "spring", bounce: 0.4 }}
            className="mt-20 w-full max-w-5xl mx-auto"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="relative aspect-video rounded-2xl border border-white/10 bg-black/80 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_rgba(16,185,129,0.2)] overflow-hidden backdrop-blur-2xl">
              {/* Fake UI */}
              <div className="absolute top-0 left-0 right-0 h-12 border-b border-white/5 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="absolute top-12 bottom-0 w-64 border-r border-white/5 p-4 space-y-4">
                <div className="h-8 rounded-md bg-white/5" />
                <div className="h-8 rounded-md bg-white/5 w-4/5" />
                <div className="h-8 rounded-md bg-emerald-500/20 w-full border border-emerald-500/30" />
              </div>
              <div className="absolute top-12 bottom-0 left-64 right-0 p-8 space-y-4">
                <div className="h-12 w-1/2 rounded-lg bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/5" />
                <div className="h-4 w-5/6 rounded bg-white/5" />
                <div className="h-4 w-4/6 rounded bg-white/5" />
                <div className="h-32 w-full mt-8 rounded-xl bg-gradient-to-br from-emerald-500/10 to-violet-500/10 border border-white/5" />
              </div>
            </div>
          </motion.div>
        </section>

        {/* FEATURES GRID */}
        <section className="py-32 px-4 max-w-7xl mx-auto relative" style={{ perspective: "1000px" }}>
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">A new dimension of productivity.</h2>
            <p className="text-white/50 text-xl">Everything you need, secured by default.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <TiltCard className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-white/5 to-white/0">
              <Shield className="w-12 h-12 text-emerald-400 mb-6" />
              <h3 className="text-2xl font-bold mb-2">Zero-Knowledge Encryption</h3>
              <p className="text-white/60">Your master key never leaves your device. We couldn't read your notes even if we wanted to.</p>
            </TiltCard>
            
            <TiltCard className="bg-gradient-to-br from-violet-500/10 to-white/0">
              <Users className="w-12 h-12 text-violet-400 mb-6" />
              <h3 className="text-2xl font-bold mb-2">Real-time Collab</h3>
              <p className="text-white/60">Invite your team to workspaces. See their cursors in real-time.</p>
            </TiltCard>

            <TiltCard className="bg-gradient-to-br from-blue-500/10 to-white/0">
              <Zap className="w-12 h-12 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-2">Lightning Fast</h3>
              <p className="text-white/60">Optimized for speed. Notes load instantly, synced in the background.</p>
            </TiltCard>

            <TiltCard className="col-span-1 md:col-span-2 bg-gradient-to-br from-amber-500/10 to-white/0">
              <Lock className="w-12 h-12 text-amber-400 mb-6" />
              <h3 className="text-2xl font-bold mb-2">Vault Auto-Lock</h3>
              <p className="text-white/60">Step away with peace of mind. QuillFox automatically drops your decryption keys after inactivity, requiring a passcode to re-enter.</p>
            </TiltCard>
          </div>
        </section>

        {/* PRODUCT DEMO / USE CASES */}
        <section className="py-32 px-4 max-w-7xl mx-auto relative border-t border-white/5" style={{ perspective: "1000px" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Designed for those who demand privacy.</h2>
              <p className="text-white/60 text-lg mb-8 leading-relaxed">
                Whether you're a developer documenting code, a founder drafting business plans, or a team collaborating on sensitive projects, QuillFox provides the tools you need without compromising your data.
              </p>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Rich Text & Markdown</h4>
                    <p className="text-white/50 text-sm">Write beautifully formatted notes with embedded code blocks, tables, and images.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Workspaces</h4>
                    <p className="text-white/50 text-sm">Organize your life into distinct vaults. Share specific workspaces with your team.</p>
                  </div>
                </li>
              </ul>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, rotateY: -30, x: 50 }}
              whileInView={{ opacity: 1, rotateY: -15, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, type: "spring" }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative aspect-[4/3] rounded-2xl border border-white/10 bg-black/80 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Demo Editor Mockup */}
              <div className="p-8">
                <div className="h-8 w-2/3 rounded-lg bg-white/10 mb-6" />
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-white/5" />
                  <div className="h-4 w-11/12 rounded bg-white/5" />
                  <div className="h-4 w-4/5 rounded bg-white/5" />
                  <div className="h-24 w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-6" />
                  <div className="h-4 w-3/4 rounded bg-white/5 mt-6" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-32 px-4 relative bg-white/5 border-y border-white/5">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Trusted by professionals.</h2>
            <p className="text-white/50 text-xl">Don't just take our word for it.</p>
          </div>
          
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <TiltCard className="bg-black/60">
              <p className="text-white/80 italic mb-6">"QuillFox completely changed how our remote team collaborates. The zero-knowledge architecture means we can finally share sensitive client notes without legal worry."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500" />
                <div>
                  <h4 className="font-bold text-sm">Sarah Jenkins</h4>
                  <p className="text-xs text-white/40">CTO, SecurTech</p>
                </div>
              </div>
            </TiltCard>
            <TiltCard className="bg-black/60">
              <p className="text-white/80 italic mb-6">"I've tried Notion, Obsidian, and Evernote. QuillFox is the only one that perfectly balances a beautiful UI with uncompromising privacy. The Vault lock feature is genius."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500" />
                <div>
                  <h4 className="font-bold text-sm">Marcus Chen</h4>
                  <p className="text-xs text-white/40">Freelance Developer</p>
                </div>
              </div>
            </TiltCard>
            <TiltCard className="bg-black/60">
              <p className="text-white/80 italic mb-6">"The speed of this app is unreal. Everything syncs instantly across my devices, and the UI is just gorgeous. It feels like software from the future."</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500" />
                <div>
                  <h4 className="font-bold text-sm">Elena Rodriguez</h4>
                  <p className="text-xs text-white/40">Product Designer</p>
                </div>
              </div>
            </TiltCard>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section className="py-32 px-4 relative">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Pricing built for scale.</h2>
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
              <ul className="space-y-3 text-sm text-white/60 mb-8">
                <li>1 Active Device</li>
                <li>2 Collaborators</li>
                <li>Unlimited Notes</li>
                <li>Basic Encryption</li>
              </ul>
              <Button variant="outline" className="w-full rounded-full border-white/20">Get Started</Button>
            </motion.div>

            {/* Premium (Extruded) */}
            <motion.div 
              initial={{ translateZ: 100, scale: 1.05 }}
              whileHover={{ translateZ: 150, scale: 1.1 }}
              style={{ transformStyle: "preserve-3d", boxShadow: "0 0 100px -20px rgba(16,185,129,0.3)" }}
              className="p-8 rounded-3xl border border-emerald-500/30 bg-black/80 backdrop-blur-xl relative z-10"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
              <h3 className="text-xl font-bold text-emerald-400">Premium</h3>
              <div className="my-4"><span className="text-5xl font-black">$7</span><span className="text-white/50">/mo</span></div>
              <ul className="space-y-3 text-sm text-white/80 mb-8 font-medium">
                <li>3 Active Devices</li>
                <li>15 Collaborators</li>
                <li>Advanced E2EE</li>
                <li>Add-ons Available</li>
              </ul>
              <Button onClick={() => router.push('/dashboard')} className="w-full rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold">Start Free Trial</Button>
            </motion.div>

            {/* Ultra */}
            <motion.div 
              whileHover={{ translateZ: 50, scale: 1.05 }}
              style={{ transformStyle: "preserve-3d" }}
              className="p-8 rounded-3xl border border-violet-500/20 bg-black/60 backdrop-blur-xl"
            >
              <h3 className="text-xl font-bold text-violet-400">Ultra</h3>
              <div className="my-4"><span className="text-5xl font-black">$17</span><span className="text-white/50">/mo</span></div>
              <ul className="space-y-3 text-sm text-white/60 mb-8">
                <li>5 Active Devices</li>
                <li>35 Collaborators</li>
                <li>Priority Support</li>
                <li>Custom Themes</li>
              </ul>
              <Button variant="outline" className="w-full rounded-full border-violet-500/30 hover:bg-violet-500/10 text-violet-300">Upgrade to Ultra</Button>
            </motion.div>

          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-32 px-4 max-w-4xl mx-auto relative border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Frequently Asked Questions.</h2>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
              <h4 className="text-xl font-bold mb-2">Can TechyDez read my notes?</h4>
              <p className="text-white/60">Absolutely not. QuillFox uses Zero-Knowledge End-to-End Encryption. Your data is encrypted on your device before it ever reaches our servers. Without your master password, your data looks like random gibberish to us.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
              <h4 className="text-xl font-bold mb-2">What happens if I lose my master password?</h4>
              <p className="text-white/60">Because we don't store your master password, we cannot recover it for you. If you lose it, your encrypted data will be unrecoverable. We highly recommend using a password manager.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
              <h4 className="text-xl font-bold mb-2">How does Real-time Collaboration work with E2EE?</h4>
              <p className="text-white/60">When you invite a collaborator to a workspace, QuillFox securely encrypts the workspace's symmetric key using their public key. This ensures only invited users can decrypt and read the workspace contents.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
              <h4 className="text-xl font-bold mb-2">Can I upgrade or downgrade my plan later?</h4>
              <p className="text-white/60">Yes! You can upgrade to Premium or Ultra at any time from the Settings menu. If you downgrade to Free, your extra workspaces will be archived, but you will not lose your data.</p>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 py-12 px-6 flex flex-col md:flex-row items-center justify-between text-white/40 text-sm">
          <p>© {new Date().getFullYear()} QuillFox. A product by <strong>TechyDez</strong>. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Button variant="link" className="text-white/40 hover:text-white p-0 h-auto" onClick={() => router.push('/privacy')}>Privacy Policy</Button>
            <Button variant="link" className="text-white/40 hover:text-white p-0 h-auto" onClick={() => router.push('/terms')}>Terms of Service</Button>
          </div>
        </footer>

      </main>
    </div>
  )
}
