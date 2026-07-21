'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'
import { useParams, usePathname } from 'next/navigation'

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

  const setActiveCollaborators = useAppStore((s) => s.setActiveCollaborators)
  
  const pathname = usePathname()
  const params = useParams()
  const isNote = pathname?.includes('/notes/')
  const isTodo = pathname?.includes('/todos/')
  const selectedNoteId = isNote ? params?.id as string : null
  const selectedTodoListId = isTodo ? params?.id as string : null

  useEffect(() => {
    if (!currentUser) return
    
    const roomId = selectedNoteId ? `note-${selectedNoteId}` : (selectedTodoListId ? `todo-${selectedTodoListId}` : null)
    if (!roomId) {
      setActiveCollaborators([])
      return
    }

    const presenceChannel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const collaborators: any[] = []
        
        for (const id in state) {
          if (id === currentUser.id) continue
          const userState = state[id][0] as any
          if (userState) {
            collaborators.push({
              userId: id,
              userName: userState.name || 'Anonymous',
              avatar: userState.avatar || null,
              isTyping: userState.isTyping || false,
            })
          }
        }
        
        setActiveCollaborators(collaborators)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            name: currentUser.name || currentUser.email.split('@')[0],
            avatar: currentUser.image || null,
            isTyping: false
          })
        }
      })

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [currentUser, selectedNoteId, selectedTodoListId, setActiveCollaborators])
}
