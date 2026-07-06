'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthPage } from '@/components/auth/auth-page'
import { Dashboard } from '@/components/dashboard/dashboard'
import { NoteEditor } from '@/components/note/note-editor'
import { TodoList } from '@/components/todo/todo-list'
import { NotesList } from '@/components/notes/notes-list'
import { TodosList } from '@/components/todos/todos-list'
import { WorkspacesView } from '@/components/workspaces/workspaces-view'
import { SettingsView } from '@/components/settings/settings-view'
import { PricingView } from '@/components/pricing/pricing-view'
import { ArchiveView } from '@/components/archive/archive-view'
import { MobileNav } from '@/components/shared/mobile-nav'
import { useAppStore } from '@/stores/app-store'
import { useVaultAutolock } from '@/hooks/use-vault-autolock'
import { useGlobalRealtime } from '@/hooks/use-global-realtime'
import { VaultLockScreen } from '@/components/auth/vault-lock-screen'
import { supabase } from '@/lib/supabase'

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    filter: 'blur(4px)',
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

function AppContent() {
  const currentView = useAppStore((s) => s.currentView)
  const currentUser = useAppStore((s) => s.currentUser)
  const updateVaultSettings = useAppStore((s) => s.updateVaultSettings)
  const setTier = useAppStore((s) => s.setTier)
  const showFooter = currentView !== 'auth' && currentView !== 'landing'

  // Global vault auto-lock timer hook
  useVaultAutolock()
  // Global realtime syncing hook
  useGlobalRealtime()

  // Sync profile details on mount or login
  const currentUserId = currentUser?.id
  useEffect(() => {
    if (!currentUserId) return

    const syncProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, image, tier, vault_auto_lock, vault_lock_timeout, vault_passcode_hash, extra_collaborators')
          .eq('id', currentUserId)
          .single()

        if (error) {
          console.warn('DB profile sync: columns might not exist. Run migration SQL.', error.message)
          return
        }

        if (data) {
          let mappedTier: 'free' | 'premium' | 'ultra' = 'free'
          if (data.tier === 'pro' || data.tier === 'premium') {
            mappedTier = 'premium'
          } else if (data.tier === 'ultra') {
            mappedTier = 'ultra'
          }
          setTier(mappedTier)
          useAppStore.getState().setExtraCollaborators(data.extra_collaborators ?? 0)
          updateVaultSettings({
            vaultAutoLock: data.vault_auto_lock ?? false,
            vaultLockTimeout: data.vault_lock_timeout ?? 15,
            vaultPasscodeHash: data.vault_passcode_hash ?? null,
          })

          // Sync profile fields to currentUser (only if changed to avoid loop)
          const store = useAppStore.getState()
          if (store.currentUser) {
            const hasNameChanged = data.name !== store.currentUser.name
            const hasImageChanged = data.image !== store.currentUser.image
            if (hasNameChanged || hasImageChanged) {
              useAppStore.setState({
                currentUser: {
                  ...store.currentUser,
                  name: data.name ?? store.currentUser.name,
                  image: data.image ?? store.currentUser.image,
                }
              })
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync profile settings:', err)
      }
    }

    syncProfile()
  }, [currentUserId, setTier, updateVaultSettings])

  // Lock the vault on page refresh if we are logged in but don't have the encryption key in memory
  const encryptionKey = useAppStore((s) => s.encryptionKey)
  const isVaultLocked = useAppStore((s) => s.isVaultLocked)
  const lockVault = useAppStore((s) => s.lockVault)

  useEffect(() => {
    if (currentUser && !encryptionKey && !isVaultLocked) {
      lockVault()
    }
  }, [currentUser, encryptionKey, isVaultLocked, lockVault])

  // If we arrived at dashboard but currentView is landing, default to auth or dashboard
  useEffect(() => {
    if (currentView === 'landing') {
      if (currentUser) {
        useAppStore.setState({ currentView: 'dashboard' })
      } else {
        useAppStore.setState({ currentView: 'auth' })
      }
    }
  }, [currentView, currentUser])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden noise-overlay">
      <main className="flex-1">
        <MobileNav />
        <AnimatePresence mode="wait">
          {currentView === 'auth' && (
            <motion.div
              key="auth"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <AuthPage />
            </motion.div>
          )}
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Dashboard />
            </motion.div>
          )}
          {currentView === 'note-editor' && (
            <motion.div
              key="note-editor"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <NoteEditor />
            </motion.div>
          )}
          {currentView === 'todo-list' && (
            <motion.div
              key="todo-list"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <TodoList />
            </motion.div>
          )}
          {currentView === 'notes' && (
            <motion.div
              key="notes"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <NotesList />
            </motion.div>
          )}
          {currentView === 'todos' && (
            <motion.div
              key="todos"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <TodosList />
            </motion.div>
          )}
          {currentView === 'workspaces' && (
            <motion.div
              key="workspaces"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <WorkspacesView />
            </motion.div>
          )}
          {currentView === 'settings' && (
            <motion.div
              key="settings"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <SettingsView />
            </motion.div>
          )}
          {currentView === 'pricing' && (
            <motion.div
              key="pricing"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <PricingView />
            </motion.div>
          )}
          {currentView === 'archive' && (
            <motion.div
              key="archive"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ArchiveView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer - hidden on auth view, shown on other views */}
      <AnimatePresence>
        {showFooter && (
          <motion.footer
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mt-auto py-4 text-center text-sm text-muted-foreground footer-gradient-border"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>© 2026 QuillFox. Built with</span>
              <motion.span
                animate={{
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-block text-[#6d28d9] dark:text-[#a855f7]"
              >
                ❤️
              </motion.span>
            </span>
          </motion.footer>
        )}
      </AnimatePresence>
      {isVaultLocked && <VaultLockScreen />}
    </div>
  )
}

function HomeContent() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
      </div>
    )
  }

  return <AppContent />
}

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <HomeContent />
      <Toaster position="bottom-right" richColors />
    </ThemeProvider>
  )
}
