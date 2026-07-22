'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { deriveKey, generateSalt } from '@/lib/e2ee'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Sparkles, Loader2, ShieldCheck, PenTool, ArrowLeft, Mail, Eye, EyeOff, Moon, Sun, Lock, Copy } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const [recoveryPassword, setRecoveryPassword] = useState('')
  
  // Recovery key UI state
  const [newRecoveryKey, setNewRecoveryKey] = useState('')
  const [inputRecoveryKey, setInputRecoveryKey] = useState('')
  
  const login = useAppStore((s) => s.login)
  const setEncryptionKey = useAppStore((s) => s.setEncryptionKey)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const currentUser = useAppStore((s) => s.currentUser)

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard')
    }
  }, [currentUser, router])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('recovery') === 'true') {
        setIsRecovery(true)
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })
      if (error) {
        toast.error(error.message || 'Login failed')
        return
      }
      const user = data.user
      if (!user) {
        toast.error('Login failed')
        return
      }
      const salt = user.user_metadata?.salt
      const name = user.user_metadata?.name || null
      const wrappedMasterKeyObj = user.user_metadata?.wrapped_master_key

      login({ 
        id: user.id, 
        email: user.email!, 
        name: name,
        createdAt: user.created_at
      })

      // KEK/MEK Architecture: Unwrap master key using password-derived KEK
      if (salt && wrappedMasterKeyObj) {
        try {
          const saltArray = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
          const { ciphertext, iv } = wrappedMasterKeyObj
          const { unwrapEncryptionKey, loadWorkspaceKeys } = await import('@/lib/e2ee')
          const masterKey = await unwrapEncryptionKey(ciphertext, iv, loginPassword, saltArray)
          setEncryptionKey(masterKey, saltArray)

          if (user.user_metadata?.encrypted_private_rsa_key) {
             const wsKeys = await loadWorkspaceKeys(masterKey, user.user_metadata.encrypted_private_rsa_key, user.id)
             useAppStore.getState().setWorkspaceKeys(wsKeys)
          } else {
             // Generate RSA Keypair for legacy user who has MEK but no RSA keys
             const { generateRSAKeyPair, encrypt } = await import('@/lib/e2ee')
             const keyPair = await generateRSAKeyPair()
             const encryptedPrivateKey = await encrypt(keyPair.privateKey, masterKey)
             
             await supabase.auth.updateUser({
               data: { encrypted_private_rsa_key: encryptedPrivateKey }
             })
             await supabase.from('profiles').update({
               public_rsa_key: keyPair.publicKey
             }).eq('id', user.id)
          }
        } catch (e) {
          console.error('Failed to unwrap encryption key during login:', e)
          toast.error('Decryption failed. Please enter your Recovery Key to restore access.')
          setIsRecovery(true)
          return
        }
      } else {
        // Fallback for old users without KEK/MEK
        if (salt) {
           try {
             const saltArray = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
             const { deriveKey } = await import('@/lib/e2ee')
             const key = await deriveKey(loginPassword, saltArray)
             setEncryptionKey(key, saltArray)
           } catch {
             toast.error('Failed to setup encryption.')
           }
        }
      }

      toast.success('Welcome back!')
      router.push('/dashboard')
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

      // KEK/MEK Architecture: Generate MEK and wrap with KEK
      const { generateMasterKey, wrapEncryptionKey, generateRSAKeyPair, deriveKey, encrypt, generateRecoveryKey } = await import('@/lib/e2ee')
      const masterKey = await generateMasterKey()
      const wrappedMasterKeyObj = await wrapEncryptionKey(masterKey, registerPassword, salt)
      
      // Recovery Key Architecture
      const recoveryKey = generateRecoveryKey()
      const recoveryWrappedMasterKeyObj = await wrapEncryptionKey(masterKey, recoveryKey, salt)

      // Generate RSA Key Pair for the user
      const { publicKey, privateKey } = await generateRSAKeyPair()
      
      // Encrypt the RSA Private Key using the MEK (Personal Master Key)
      const encryptedPrivateKey = await encrypt(privateKey, masterKey)

      const { data, error } = await supabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        options: {
          data: {
            name: registerName.trim(),
            salt: saltBase64,
            wrapped_master_key: wrappedMasterKeyObj, // store MEK wrapped by password
            recovery_wrapped_master_key: recoveryWrappedMasterKeyObj, // store MEK wrapped by recovery key
            public_rsa_key: publicKey,
            encrypted_private_rsa_key: encryptedPrivateKey,
          }
        }
      })

      if (error) {
        console.error("Signup error:", error)
        let errMsg = error.message || 'Registration failed'
        if (typeof errMsg === 'object' || errMsg === '{}') errMsg = JSON.stringify(error)
        toast.error(errMsg)
        return
      }

      const user = data.user
      if (!user) {
        toast.error('Registration failed')
        return
      }

      if (!data.session) {
        toast.success('Registration successful! Please check your email to verify your account.')
        setActiveTab('login')
        setLoginEmail(registerEmail.trim())
        return
      }

      // Show recovery key modal
      setNewRecoveryKey(recoveryKey)
      
      // Delay routing/login until they acknowledge the recovery key
      // The actual login/routing logic is handled in the modal's acknowledge handler
      login({ 
        id: user.id, 
        email: user.email!, 
        name: registerName.trim(),
        createdAt: user.created_at
      })

      setEncryptionKey(masterKey, salt)
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
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/?recovery=true`,
      })
      if (error) {
        toast.error(error.message || 'Something went wrong. Please try again.')
      } else {
        setForgotSent(true)
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (recoveryPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user session found.")

      let updatedData: any = {}

      if (inputRecoveryKey.trim()) {
        const { unwrapEncryptionKey, wrapEncryptionKey } = await import('@/lib/e2ee')
        const salt = user.user_metadata?.salt
        const recoveryWrappedObj = user.user_metadata?.recovery_wrapped_master_key
        if (!salt || !recoveryWrappedObj) {
            toast.error('Recovery metadata missing. Cannot recover keys.')
            setIsLoading(false)
            return
        }
        try {
            const saltArray = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
            const masterKey = await unwrapEncryptionKey(recoveryWrappedObj.ciphertext, recoveryWrappedObj.iv, inputRecoveryKey.trim(), saltArray)
            const newWrappedObj = await wrapEncryptionKey(masterKey, recoveryPassword, salt)
            updatedData = { wrapped_master_key: newWrappedObj }
        } catch (err) {
            toast.error('Invalid Recovery Key. Please check for typos.')
            setIsLoading(false)
            return
        }
      } else {
        if (!window.confirm("WARNING: You did not provide a Recovery Key. Proceeding will wipe your old encryption keys and permanently lose access to previous notes. Continue?")) {
            setIsLoading(false)
            return
        }
        const { generateMasterKey, wrapEncryptionKey, generateRSAKeyPair, encrypt, generateRecoveryKey } = await import('@/lib/e2ee')
        const masterKey = await generateMasterKey()
        let salt = user.user_metadata?.salt
        if (!salt) {
            const newSalt = crypto.getRandomValues(new Uint8Array(16))
            salt = btoa(String.fromCharCode(...Array.from(newSalt)))
        }
        const wrappedMasterKeyObj = await wrapEncryptionKey(masterKey, recoveryPassword, salt)
        const recoveryKey = generateRecoveryKey()
        const recoveryWrappedMasterKeyObj = await wrapEncryptionKey(masterKey, recoveryKey, salt)
        const { publicKey, privateKey } = await generateRSAKeyPair()
        const encryptedPrivateKey = await encrypt(privateKey, masterKey)
        
        updatedData = {
            salt,
            wrapped_master_key: wrappedMasterKeyObj,
            recovery_wrapped_master_key: recoveryWrappedMasterKeyObj,
            public_rsa_key: publicKey,
            encrypted_private_rsa_key: encryptedPrivateKey,
        }
        await supabase.from('profiles').update({ public_rsa_key: publicKey }).eq('id', user.id)
        setNewRecoveryKey(recoveryKey)
      }

      const { error } = await supabase.auth.updateUser({ 
        password: recoveryPassword,
        data: updatedData
      })
      if (error) {
        toast.error(error.message || 'Failed to update password')
        return
      }
      toast.success('Password updated! Please log in.')
      if (!updatedData.recovery_wrapped_master_key) {
        setIsRecovery(false)
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcknowledgeRecoveryKey = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      toast.success('Registration completed!')
      router.push('/dashboard')
    } else {
      toast.success('Registration successful! Please check your email to verify your account.')
      setActiveTab('login')
      setLoginEmail(registerEmail.trim())
    }
    setNewRecoveryKey('')
    setIsRecovery(false)
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-mesh relative overflow-hidden noise-overlay">
        
        {/* Recovery Key Modal Overlay */}
        {newRecoveryKey && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card border shadow-2xl rounded-2xl p-8 max-w-md w-full relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-coral-500" />
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-foreground">
                <Lock className="w-6 h-6 text-purple-500" /> Save Your Recovery Key
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Because your notes are end-to-end encrypted, Quillo cannot reset your password without losing your data. 
                <strong className="text-foreground"> Write down this Recovery Key.</strong> It is the ONLY way to recover your notes if you forget your password.
              </p>
              <div className="bg-muted p-4 rounded-xl flex items-center justify-between mb-6 border font-mono text-lg text-foreground text-center">
                <span className="flex-1 tracking-wider">{newRecoveryKey}</span>
                <Button variant="ghost" size="icon" onClick={() => {
                  navigator.clipboard.writeText(newRecoveryKey)
                  toast.success('Copied to clipboard!')
                }}>
                  <Copy className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
              <Button 
                onClick={handleAcknowledgeRecoveryKey} 
                className="w-full btn-gradient btn-shine h-12 text-base font-medium"
              >
                I have saved it safely
              </Button>
            </div>
          </div>
        )}

      {/* Animated Gradient Orbs */}
      <div className="gradient-orb gradient-orb-purple w-[400px] h-[400px] -top-20 -left-20 animate-float" />
      <div className="gradient-orb gradient-orb-coral w-[350px] h-[350px] -bottom-10 -right-10 animate-float-delayed" />
      <div className="gradient-orb gradient-orb-violet w-[300px] h-[300px] top-1/2 right-1/4 animate-float-slow" />
      <div className="gradient-orb gradient-orb-purple w-[250px] h-[250px] top-1/4 right-1/3 animate-float" />
      <div className="gradient-orb gradient-orb-coral w-[200px] h-[200px] bottom-1/4 left-1/4 animate-float-delayed" />

      {/* Theme Toggle */}
      {mounted && (
        <div className="absolute top-6 right-6 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 rounded-full bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/40 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-300" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </Button>
        </div>
      )}

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
          <Link href="/" className="inline-block cursor-pointer outline-none">
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
          </Link>
        </motion.div>

        {/* Auth Card */}
        <motion.div variants={cardVariants}>
          <Card className="glass-card glow-purple shadow-2xl">
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-xl">Get Started</CardTitle>
              <CardDescription>Sign in or create a new account</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {isRecovery ? (
                <div className="space-y-6">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
                    <strong>Warning:</strong> You must enter your Recovery Key to preserve your old encrypted notes. If you lost it, leave the field blank to start fresh (old notes will be lost).
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recovery-password">New Password</Label>
                      <div className="relative">
                        <Input
                          id="recovery-password"
                          type={showRecoveryPassword ? 'text' : 'password'}
                          value={recoveryPassword}
                          onChange={(e) => setRecoveryPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          disabled={isLoading}
                          className="h-11 rounded-xl pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-transparent"
                          onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                          tabIndex={-1}
                        >
                          {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="recovery-key">Recovery Key (Optional)</Label>
                      <Input
                        id="recovery-key"
                        type="text"
                        value={inputRecoveryKey}
                        onChange={(e) => setInputRecoveryKey(e.target.value)}
                        placeholder="e.g. A1B2-C3D4-E5F6-G7H8"
                        disabled={isLoading}
                        className="h-11 rounded-xl font-mono uppercase"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl btn-gradient btn-shine"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Update Password
                    </Button>
                  </form>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsRecovery(false)
                      window.history.replaceState({}, document.title, window.location.pathname)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
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
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 mb-4">
                                <strong>Warning:</strong> You MUST have your Recovery Key to restore your encrypted notes after a password reset. Otherwise, previously saved data will be lost forever.
                              </div>
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
                              type={showLoginPassword ? 'text' : 'password'}
                              placeholder="Enter your password"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-10 rounded-xl"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-transparent"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              tabIndex={-1}
                            >
                              {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
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
                              type={showRegisterPassword ? 'text' : 'password'}
                              placeholder="Min. 6 characters"
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              disabled={isLoading}
                              className="h-11 glass-input pl-4 pr-10 rounded-xl"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-transparent"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              tabIndex={-1}
                            >
                              {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
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
              )}
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
