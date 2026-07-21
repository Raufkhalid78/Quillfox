'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useVaultAutolock } from '@/hooks/use-vault-autolock'
import { useGlobalRealtime } from '@/hooks/use-global-realtime'
import { VaultLockScreen } from '@/components/auth/vault-lock-screen'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MobileNav } from '@/components/shared/mobile-nav'
import { Loader2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const currentUser = useAppStore((s) => s.currentUser)
  const updateVaultSettings = useAppStore((s) => s.updateVaultSettings)
  const setTier = useAppStore((s) => s.setTier)
  
  const router = useRouter()
  const pathname = usePathname()
  
  // Global vault auto-lock timer hook
  useVaultAutolock()
  // Global realtime syncing hook
  useGlobalRealtime()

  // Sync profile details on mount or login
  const currentUserId = currentUser?.id
  useEffect(() => {
    if (!currentUserId) {
      router.push('/auth')
      return
    }

    const syncProfile = async () => {
      try {
        let { data, error } = await supabase
          .from('profiles')
          .select('name, image, tier, trial_ends_at, vault_auto_lock, vault_lock_timeout, vault_passcode_hash, extra_collaborators')
          .eq('id', currentUserId)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.warn('DB profile sync error', error.message)
        }

        if (!data) {
          // Profile might be missing, try to upsert it
          const { data: newProfile, error: upsertErr } = await supabase
            .from('profiles')
            .upsert({ 
              id: currentUserId, 
              name: currentUser.name, 
              email: currentUser.email, 
              image: currentUser.image 
            })
            .select()
            .maybeSingle()
          
          if (!upsertErr && newProfile) {
            data = newProfile
          }
        }

        if (data) {
          let mappedTier: 'free' | 'premium' | 'ultra' = 'free'
          if (data.tier === 'pro' || data.tier === 'premium') {
            mappedTier = 'premium'
          } else if (data.tier === 'ultra') {
            mappedTier = 'ultra'
          }

          if (data.trial_ends_at && mappedTier !== 'free') {
            const trialEndsAt = new Date(data.trial_ends_at).getTime()
            if (Date.now() > trialEndsAt) {
              mappedTier = 'free'
              const { error: updateErr } = await supabase
                .from('profiles')
                .update({ tier: 'free', trial_ends_at: null })
                .eq('id', currentUserId)
              
              if (!updateErr) {
                toast.error('Your free trial has expired. You have been reverted to the Free plan.')
              }
            }
          }

          const store = useAppStore.getState()
          useAppStore.setState({
            userTier: mappedTier,
            extraCollaborators: data.extra_collaborators ?? 0,
            vaultAutoLock: data.vault_auto_lock ?? false,
            vaultLockTimeout: data.vault_lock_timeout ?? 15,
            vaultPasscodeHash: data.vault_passcode_hash ?? null,
            ...(store.currentUser && (data.name !== store.currentUser.name || data.image !== store.currentUser.image)
              ? {
                  currentUser: {
                    ...store.currentUser,
                    name: data.name ?? store.currentUser.name,
                    image: data.image ?? store.currentUser.image,
                  }
                }
              : {})
          })
        }
      } catch (err) {
        console.error('Failed to sync profile settings:', err)
      }
    }

    syncProfile()
  }, [currentUserId, setTier, updateVaultSettings, router])

  // Lock the vault on page refresh if we are logged in but don't have the encryption key in memory
  const encryptionKey = useAppStore((s) => s.encryptionKey)
  const isVaultLocked = useAppStore((s) => s.isVaultLocked)
  const lockVault = useAppStore((s) => s.lockVault)

  useEffect(() => {
    if (currentUser && !encryptionKey && !isVaultLocked) {
      lockVault()
    }
  }, [currentUser, encryptionKey, isVaultLocked, lockVault])

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden noise-overlay">
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <MobileNav />
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
      {isVaultLocked && <VaultLockScreen />}
    </div>
  )
}
