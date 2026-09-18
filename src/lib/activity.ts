import { supabase } from './supabase'
import { useAppStore } from '@/stores/app-store'

export type ActivityType =
  | 'note_create'
  | 'note_update'
  | 'note_delete'
  | 'todo_complete'
  | 'todo_create'
  | 'workspace_create'
  | 'member_invite'
  | 'member_remove'

export interface ActivityOptions {
  workspaceId?: string | null
  entityType?: 'note' | 'todo' | 'workspace' | 'member'
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function logActivity(activityType: ActivityType, options: ActivityOptions = {}) {
  const currentUser = useAppStore.getState().currentUser
  if (!currentUser) return

  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    await supabase.from('activity_logs').insert({
      id,
      user_id: currentUser.id,
      activity_type: activityType,
      workspace_id: options.workspaceId ?? null,
      entity_type: options.entityType ?? null,
      entity_id: options.entityId ?? null,
      metadata: options.metadata ?? {},
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[Activity Log] Failed to write activity log:', err)
  }
}
