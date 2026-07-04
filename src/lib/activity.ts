import { supabase } from './supabase'
import { useAppStore } from '@/stores/app-store'

export type ActivityType = 'note_create' | 'note_update' | 'todo_complete' | 'workspace_create'

export async function logActivity(activityType: ActivityType) {
  const currentUser = useAppStore.getState().currentUser
  if (!currentUser) return

  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    await supabase.from('activity_logs').insert({
      id,
      user_id: currentUser.id,
      activity_type: activityType,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.warn('[Activity Log] Failed to write activity log:', err)
  }
}
