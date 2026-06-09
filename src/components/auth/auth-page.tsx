'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { deriveKey, generateSalt } from '@/lib/e2ee'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Sparkles, Loader2, ShieldCheck, PenTool, ArrowLeft, Mail } from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      delay: 0.15,
    },
  },
}

export function AuthPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const login = useAppStore((s) => s.login)
  const setEncryptionKey = useAppStore((s) => s.setEncryptionKey)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        return
      }
      login({ id: data.user.id, email: data.user.email, name: data.user.name })

      // Derive encryption key from password + salt
      if (data.user.salt) {
        try {
          const saltArray = Uint8Array.from(atob(data.user.salt), (c) => c.charCodeAt(0))
          const key = await deriveKey(loginPassword, saltArray)
          setEncryptionKey(key, data.user.salt)
        } catch {
          toast.error('Failed to setup encryption. Your data may not be decrypted.')
        }
      }

      toast.success('Welcome back!')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (registerPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setIsLoading(true)
    try {
      // Generate encryption salt client-side
      const salt = generateSalt()
      let saltBinary = ''
      for (let i = 0; i < salt.length; i++) {
        saltBinary += String.fromCharCode(salt[i])
      }
      const saltBase64 = btoa(saltBinary)

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          salt: saltBase64,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Registration failed')
        return
      }
      login({ id: data.user.id, email: data.user.email, name: data.user.name })

      // Derive encryption key from password + salt
      try {
        const key = await deriveKey(registerPassword, salt)
        setEncryptionKey(key, saltBase64)
      } catch {
        toast.error('Failed to setup encryption.')
      }

      toast.success('Account created successfully!')
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      toast.error('Please enter your email address')
      return
    }
    setIsForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      if (res.ok) {
        setForgotSent(true)
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsForgotLoading(false)
    }
  }

  const resetForgotPassword = () => {
    setShowForgotPassword(false)
    setForgotEmail('')
    setForgotSent(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-mesh-light dark:bg-gradient-mesh-dark relative overflow-hidden noise-overlay">
      {/* Animated Gradient Orbs */}
      <div className="gradient-orb gradient-orb-purple w-[400px] h-[400px] -top-20 -left-20 animate-float" />
      <div className="gradient-orb gradient-orb-coral w-[350px] h-[350px] -bottom-10 -right-10 animate-float-delayed" />
      <div className="gradient-orb gradient-orb-violet w-[300px] h-[300px] top-1/2 right-1/4 animate-float-slow" />
      <div className="gradient-orb gradient-orb-purple w-[250px] h-[250px] top-1/4 right-1/3 animate-float" />
      <div className="gradient-orb gradient-orb-coral w-[200px] h-[200px] bottom-1/4 left-1/4 animate-float-delayed" />

      {/* Spinning gradient ring (subtle) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] animate-spin-slow pointer-events-none"
        style={{
          background: 'conic-gradient(from 0deg, #6D28D9, #F97316, #9333EA, #EA580C, #6D28D9)',
        }}
      />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 relative"
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {/* Gradient background for logo */}
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7e22ce] to-[#6d28d9] opacity-90"
            />
            <div
              className="absolute inset-0 rounded-2xl animate-gradient-shift"
              style={{
                background: 'linear-gradient(135deg, #7e22ce, #c084fc, #6d28d9, #a855f7)',
                backgroundSize: '300% 300%',
              }}
            />
            <PenTool className="w-9 h-9 text-white relative z-10 drop-shadow-lg" />
            {/* Glow ring */}
            <div className="absolute inset-[-4px] rounded-2xl border border-purple-400/20 animate-glow-pulse pointer-events-none" />
          </motion.div>

          <motion.h1
            className="text-3xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #6d28d9, #c084fc, #6d28d9)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'gradient-shift 4s ease infinite',
            }}
          >
            QuillFox
          </motion.h1>

          {/* Animated tagline */}
          <motion.p
            className="text-sm text-muted-foreground mt-2"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            Your ideas,{' '}
            <motion.span
              className="text-[#6d28d9] dark:text-[#a855f7] font-medium"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              encrypted
            </motion.span>
            .
          </motion.p>
        </motion.div>

        {/* Auth Card */}
        <motion.div variants={cardVariants}>
          <Card className="glass-card glow-purple shadow-2xl">
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-xl">Get Started</CardTitle>
              <CardDescription>Sign in or create a new account</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
                {/* Custom tab design with sliding indicator */}
                <div className="relative mb-6">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 h-11 p-1 rounded-xl">
                    <TabsTrigger
                      value="login"
                      className="rounded-lg text-sm font-medium data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
                      style={{
                        // @ts-expect-error CSS custom property
                        '--trigger-gradient': 'linear-gradient(135deg, #7e22ce, #6d28d9)',
                      }}
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="rounded-lg text-sm font-medium data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
                    >
                      Register
                    </TabsTrigger>
                  </TabsList>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: activeTab === 'login' ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: activeTab === 'login' ? 12 : -12 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <TabsContent value="login" className="mt-0">
                      {showForgotPassword ? (
                        forgotSent ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center text-center py-4 space-y-3"
                          >
                            <div className="w-12 h-12 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                              <Mail className="w-6 h-6 text-[#6d28d9] dark:text-[#a855f7]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Check your email</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                If an account exists with that email, a reset link has been sent.
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs text-[#6d28d9] dark:text-[#a855f7] hover:text-[#5b21b6] dark:hover:text-[#c084fc]"
                              onClick={resetForgotPassword}
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              Back to login
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7 px-0"
                              onClick={resetForgotPassword}
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              Back to login
                            </Button>
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="forgot-email" className="text-sm font-medium">Email Address</Label>
                                <div className="relative">
                                  <Input
                                    id="forgot-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    disabled={isForgotLoading}
                                    className="h-11 glass-input pl-4 pr-4 rounded-xl"
                                  />
                                </div>
                              </div>
                              <Button
                                type="submit"
                                className="w-full h-11 rounded-xl text-sm font-semibold btn-gradient btn-shine"
                                disabled={isForgotLoading}
                              >
                                <span className="flex items-center justify-center">
                                  {isForgotLoading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    'Send Reset Link'
                                  )}
                                </span>
                              </Button>
                            </form>
                          </motion.div>
                        )
                      ) : (
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                          <div className="relative">
                            <Input
                              id="login-email"
                              type="email"
                              placeholder="you@example.com"
                              value={loginEmail}
                              onChange={(e) => setLoginEmail(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-4 rounded-xl"
                            />
                            <div className="absolute inset-0 rounded-xl border-2 border-transparent transition-all duration-300 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                          <div className="relative">
                            <Input
                              id="login-password"
                              type="password"
                              placeholder="Enter your password"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-4 rounded-xl"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setShowForgotPassword(true)}
                              className="text-xs font-medium text-[#6d28d9] dark:text-[#a855f7] hover:text-[#5b21b6] dark:hover:text-[#c084fc] transition-colors"
                            >
                              Forgot password?
                            </button>
                          </div>
                        </div>
                        <motion.div
                          className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30"
                          animate={isLoading ? { opacity: 0.5 } : { opacity: 1 }}
                        >
                          <motion.div
                            animate={{
                              boxShadow: [
                                '0 0 4px rgba(109, 40, 217, 0.3)',
                                '0 0 12px rgba(109, 40, 217, 0.5)',
                                '0 0 4px rgba(109, 40, 217, 0.3)',
                              ],
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="shrink-0"
                          >
                            <ShieldCheck className="w-4 h-4 text-[#6d28d9] dark:text-[#a855f7]" />
                          </motion.div>
                          <span className="text-[#6d28d9] dark:text-purple-300">Your password derives your encryption key. Never share it.</span>
                        </motion.div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl text-sm font-semibold btn-gradient btn-shine"
                          disabled={isLoading}
                        >
                          <span className="flex items-center justify-center">
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Signing in...
                              </>
                            ) : (
                              'Sign In'
                            )}
                          </span>
                        </Button>
                      </form>
                      )}
                    </TabsContent>

                    <TabsContent value="register" className="mt-0">
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="register-name" className="text-sm font-medium">Name</Label>
                          <div className="relative">
                            <Input
                              id="register-name"
                              type="text"
                              placeholder="Your name"
                              value={registerName}
                              onChange={(e) => setRegisterName(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-4 rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-email" className="text-sm font-medium">Email</Label>
                          <div className="relative">
                            <Input
                              id="register-email"
                              type="email"
                              placeholder="you@example.com"
                              value={registerEmail}
                              onChange={(e) => setRegisterEmail(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-4 rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                          <div className="relative">
                            <Input
                              id="register-password"
                              type="password"
                              placeholder="Min. 6 characters"
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-4 rounded-xl"
                            />
                          </div>
                        </div>
                        <motion.div
                          className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30"
                          animate={isLoading ? { opacity: 0.5 } : { opacity: 1 }}
                        >
                          <motion.div
                            animate={{
                              boxShadow: [
                                '0 0 4px rgba(109, 40, 217, 0.3)',
                                '0 0 12px rgba(109, 40, 217, 0.5)',
                                '0 0 4px rgba(109, 40, 217, 0.3)',
                              ],
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="shrink-0"
                          >
                            <ShieldCheck className="w-4 h-4 text-[#6d28d9] dark:text-[#a855f7]" />
                          </motion.div>
                          <span className="text-[#6d28d9] dark:text-purple-300">End-to-end encryption enabled. Your password secures your data.</span>
                        </motion.div>
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-xl text-sm font-semibold btn-gradient btn-shine"
                          disabled={isLoading}
                        >
                          <span className="flex items-center justify-center">
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating account...
                              </>
                            ) : (
                              'Create Account'
                            )}
                          </span>
                        </Button>
                      </form>
                    </TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subtle branding at bottom */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <Sparkles className="w-3 h-3" />
            <span>Powered by end-to-end encryption</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
