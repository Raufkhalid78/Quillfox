'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'

export function useGlobalRealtime() {
  const currentUser = useAppStore((s) => s.currentUser)
  const encryptionKey = useAppStore((s) => s.encryptionKey)

  useEffect(() => {
    if (!currentUser || !encryptionKey) return

    const handlePayload = (payload: any) => {
      // Only trigger a full refresh for INSERT and DELETE to avoid 
      // excessive fetching when a collaborator is actively typing (UPDATE).
      // Active editors handle their own UPDATE subscriptions.
      if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
        useAppStore.setState((s) => ({ globalSyncTrigger: (s.globalSyncTrigger || 0) + 1 }))
      }
    }

    const channel = supabase.channel('global-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, handlePayload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists' }, handlePayload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, handlePayload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, handlePayload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, handlePayload)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, encryptionKey])
}
