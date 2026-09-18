import { supabase } from './supabase'

/**
 * Soft-delete ("trash") helpers. Items moved to trash set `deleted_at` and can
 * be restored; purging is a permanent hard delete.
 */

async function setDeleted(table: 'notes' | 'todo_lists', id: string, deleted: boolean) {
  const { error } = await supabase
    .from(table)
    .update(
      deleted
        ? { deleted_at: new Date().toISOString() }
        : { deleted_at: null, deleted_by: null }
    )
    .eq('id', id)
  if (error) throw error
}

async function purge(table: 'notes' | 'todo_lists', id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export const trashNote = (id: string) => setDeleted('notes', id, true)
export const restoreNote = (id: string) => setDeleted('notes', id, false)
export const purgeNote = (id: string) => purge('notes', id)

export const trashTodoList = (id: string) => setDeleted('todo_lists', id, true)
export const restoreTodoList = (id: string) => setDeleted('todo_lists', id, false)
export const purgeTodoList = (id: string) => purge('todo_lists', id)

/** Items are permanently deleted after this many days in the trash. */
export const TRASH_RETENTION_DAYS = 30

/**
 * Permanently deletes trashed notes/todo lists older than the retention window.
 * Returns the number of rows purged. Safe to call on every dashboard load.
 */
export async function purgeExpiredTrash(retentionDays = TRASH_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  let purged = 0

  for (const table of ['notes', 'todo_lists'] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff)
    if (error || !data || data.length === 0) continue

    const ids = data.map((row: any) => row.id)
    const { error: deleteError } = await supabase.from(table).delete().in('id', ids)
    if (!deleteError) purged += ids.length
  }

  return purged
}