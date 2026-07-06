'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { deriveKey, unwrapEncryptionKey, base64ToUint8Array } from '@/lib/e2ee'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowRightLeft, Lock, Loader2, Eye, EyeOff, LogOut } from 'lucide-react'

export function VaultLockScreen() {
  const currentUser = useAppStore((s) => s.currentUser)
  const isVaultLocked = useAppStore((s) => s.isVaultLocked)
  const unlockVault = useAppStore((s) => s.unlockVault)
  const setEncryptionKey = useAppStore((s) => s.setEncryptionKey)
  const encryptionSalt = useAppStore((s) => s.encryptionSalt)
  const logout = useAppStore((s) => s.logout)

  const [unlockMethod, setUnlockMethod] = useState<'passcode' | 'password'>(() => {
    if (typeof window !== 'undefined') {
      const hasPasscode = sessionStorage.getItem('quillfox_wrapped_key')
      return hasPasscode ? 'passcode' : 'password'
    }
    return 'passcode'
  })
  const [passcode, setPasscode] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)

  const handleKeypadPress = (num: string) => {
    if (lockoutUntil && Date.now() < lockoutUntil) return
    if (passcode.length < 6) {
      setPasscode(prev => prev + num)
      setIsError(false)
    }
  }

  const handleBackspace = () => {
    setPasscode(prev => prev.slice(0, -1))
    setIsError(false)
  }

  const handleClear = () => {
    setPasscode('')
    setIsError(false)
  }

  const handlePasscodeSubmit = async () => {
    if (!currentUser || !encryptionSalt) return
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000)
      toast.error(`Too many attempts. Locked for ${remainingSeconds}s.`)
      setPasscode('')
      return
    }

    setIsLoading(true)
    try {
      const wrappedKeyStr = sessionStorage.getItem('quillfox_wrapped_key')
      const wrappedIvStr = sessionStorage.getItem('quillfox_wrapped_iv')
      
      if (!wrappedKeyStr || !wrappedIvStr) {
        toast.error('Passcode session expired. Please unlock with your password.')
        setUnlockMethod('password')
        setIsLoading(false)
        return
      }

      const key = await unwrapEncryptionKey(wrappedKeyStr, wrappedIvStr, passcode, encryptionSalt)
      
      setEncryptionKey(key, encryptionSalt)

      // Get user metadata for PKI
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.encrypted_private_rsa_key) {
        const { loadWorkspaceKeys } = await import('@/lib/e2ee')
        const wsKeys = await loadWorkspaceKeys(key, user.user_metadata.encrypted_private_rsa_key, currentUser.id)
        useAppStore.getState().setWorkspaceKeys(wsKeys)
      } else {
        const { generateRSAKeyPair, encrypt } = await import('@/lib/e2ee')
        const keyPair = await generateRSAKeyPair()
        const encryptedPrivateKey = await encrypt(keyPair.privateKey, key)
        await supabase.auth.updateUser({
          data: { encrypted_private_rsa_key: encryptedPrivateKey }
        })
        await supabase.from('profiles').update({
          public_rsa_key: keyPair.publicKey
        }).eq('id', currentUser.id)
      }
      unlockVault()
      setPasscode('')
      setFailedAttempts(0)
      toast.success('Vault unlocked')
    } catch {
      setIsError(true)
      setPasscode('')
      
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      if (newAttempts >= 5) {
        setLockoutUntil(Date.now() + 60000) // Lock out for 1 minute
        toast.error('Too many failed attempts. Locked for 1 minute.')
      } else {
        toast.error(`Incorrect Passcode. ${5 - newAttempts} attempts remaining.`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (passcode.length === 6) {
      handlePasscodeSubmit()
    }
  }, [passcode])

  // Clear lockout when it expires
  useEffect(() => {
    if (lockoutUntil) {
      const timer = setInterval(() => {
        if (Date.now() >= lockoutUntil) {
          setLockoutUntil(null)
          setFailedAttempts(0)
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [lockoutUntil])

  // Keyboard support for passcode
  useEffect(() => {
    if (unlockMethod !== 'passcode' || isVaultLocked === false) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (just in case)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Delete' || e.key === 'Escape') {
        handleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [unlockMethod, isVaultLocked, passcode, lockoutUntil])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !currentUser || !encryptionSalt) return
    setIsLoading(true)

    // Fix Zustand hydration corruption of Uint8Array
    const saltArray = encryptionSalt instanceof Uint8Array 
      ? encryptionSalt 
      : Uint8Array.from(Object.values(encryptionSalt as any))
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: password,
      })

      if (error || !data.user) {
        toast.error('Incorrect password')
        setIsError(true)
        setIsLoading(false)
        return
      }

      const wrappedMasterKeyObj = data.user.user_metadata?.wrapped_master_key

      if (wrappedMasterKeyObj) {
        const { ciphertext, iv } = wrappedMasterKeyObj
        const masterKey = await unwrapEncryptionKey(ciphertext, iv, password, saltArray)
        setEncryptionKey(masterKey, saltArray)

        if (data.user.user_metadata?.encrypted_private_rsa_key) {
          const { loadWorkspaceKeys } = await import('@/lib/e2ee')
          const wsKeys = await loadWorkspaceKeys(masterKey, data.user.user_metadata.encrypted_private_rsa_key, currentUser.id)
          useAppStore.getState().setWorkspaceKeys(wsKeys)
        } else {
          const { generateRSAKeyPair, encrypt } = await import('@/lib/e2ee')
          const keyPair = await generateRSAKeyPair()
          const encryptedPrivateKey = await encrypt(keyPair.privateKey, masterKey)
          await supabase.auth.updateUser({
            data: { encrypted_private_rsa_key: encryptedPrivateKey }
          })
          await supabase.from('profiles').update({
            public_rsa_key: keyPair.publicKey
          }).eq('id', currentUser.id)
        }
      } else {
        const key = await deriveKey(password, saltArray)
        setEncryptionKey(key, saltArray)
      }
      
      unlockVault()
      setFailedAttempts(0)
      toast.success('Vault unlocked')
    } catch {
      setIsError(true)
      toast.error('Failed to unlock vault')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVaultLocked) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-lg">
      <div className="w-full max-w-sm px-6 py-8 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary animate-pulse"
        >
          <Lock className="w-8 h-8" />
        </motion.div>

        <h2 className="text-xl font-bold tracking-tight text-foreground mb-1">Vault Locked</h2>
        <p className="text-sm text-muted-foreground mb-8 text-center">
          QuillFox is locked due to inactivity.
        </p>

        <AnimatePresence mode="wait">
          {unlockMethod === 'passcode' ? (
            <motion.div
              key="passcode"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full flex flex-col items-center"
            >
              <div className="flex gap-3 mb-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={isError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-3.5 h-3.5 rounded-full border-2 ${
                      i < passcode.length
                        ? 'bg-primary border-primary scale-110'
                        : 'bg-transparent border-muted-foreground/30'
                    } transition-all duration-150`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-8">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    className="h-12 w-full text-lg font-semibold rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                    onClick={() => handleKeypadPress(num)}
                    disabled={isLoading || !!lockoutUntil}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="h-12 w-full text-xs font-semibold rounded-xl hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClear}
                  disabled={isLoading || !!lockoutUntil}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full text-lg font-semibold rounded-xl hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                  onClick={() => handleKeypadPress('0')}
                  disabled={isLoading || !!lockoutUntil}
                >
                  0
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 w-full text-xs font-semibold rounded-xl hover:bg-primary/10 hover:text-primary"
                  onClick={handleBackspace}
                  disabled={isLoading || !!lockoutUntil}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="password"
              onSubmit={handlePasswordSubmit}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex flex-col items-stretch space-y-4 max-w-[280px] mb-8"
            >
              <div className="space-y-1">
                <Label htmlFor="lock-password">Password</Label>
                <div className="relative">
                  <Input
                    id="lock-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="h-10 text-sm pr-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10 gap-2" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Unlock Vault
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        <Button
          variant="link"
          size="sm"
          onClick={() => {
            setUnlockMethod(unlockMethod === 'passcode' ? 'password' : 'passcode')
            handleClear()
            setPassword('')
          }}
          className="text-xs text-muted-foreground hover:text-primary"
          disabled={isLoading}
        >
          <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
          Unlock with {unlockMethod === 'passcode' ? 'Password' : 'Passcode'}
        </Button>

        <Button
          variant="link"
          size="sm"
          onClick={() => {
            logout()
          }}
          className="text-xs text-muted-foreground hover:text-destructive"
          disabled={isLoading}
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Log Out
        </Button>
      </div>
    </div>
  )
}
