import { supabase } from './supabase'

export type ReminderEntity = 'note' | 'todo'
export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type ReminderChannel = 'push' | 'email' | 'both'

export interface ReminderRecord {
  id: string
  entityType: ReminderEntity
  entityId: string
  workspaceId: string | null
  remindAt: string
  recurrence: ReminderRecurrence
  channel: ReminderChannel
}

function reminderId(entityType: ReminderEntity, entityId: string): string {
  return `${entityType}:${entityId}`
}

function rowToRecord(row: any): ReminderRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workspaceId: row.workspace_id ?? null,
    remindAt: row.remind_at,
    recurrence: row.recurrence,
    channel: row.channel,
  }
}

export interface SaveReminderInput {
  entityType: ReminderEntity
  entityId: string
  workspaceId: string | null
  remindAt: Date
  userId: string
  recurrence?: ReminderRecurrence
  channel?: ReminderChannel
}

export async function saveReminder(input: SaveReminderInput): Promise<void> {
  const { error } = await supabase.from('reminders').upsert(
    {
      id: reminderId(input.entityType, input.entityId),
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      workspace_id: input.workspaceId,
      remind_at: input.remindAt.toISOString(),
      recurrence: input.recurrence ?? 'none',
      channel: input.channel ?? 'push',
      notification_id: null,
      sent_at: null,
    },
    { onConflict: 'id' }
  )
  if (error) throw error
}

export async function deleteReminderForEntity(
  entityType: ReminderEntity,
  entityId: string
): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
  if (error) throw error
}

export async function fetchReminders(): Promise<ReminderRecord[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToRecord)
}
