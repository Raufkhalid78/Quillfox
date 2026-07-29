'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'
import { useRouter } from 'next/navigation'

export function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // If the backend session dies (user deleted, token revoked, or signed out locally)
      // and we still have a local currentUser in Zustand, we must clear it to avoid
      // leaving the user stranded on the Vault Locked screen.
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session) || event === 'USER_DELETED') {
        const store = useAppStore.getState()
        if (store.currentUser) {
          store.logout()
          router.push('/')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return <>{children}</>
}
