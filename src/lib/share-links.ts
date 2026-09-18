import { supabase } from './supabase'
import { useAppStore } from '@/stores/app-store'
import { exportKeyToString, importKeyFromString, decrypt } from './e2ee'

export interface ShareLink {
  token: string
  entityType: 'note' | 'todo'
  entityId: string
  workspaceId: string | null
  createdBy: string
  createdAt: string
  revokedAt: string | null
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Creates a share link. The AES key is placed in the URL **fragment** only, so
 * it is never sent to the server or stored in the database.
 */
export async function createShareLink(
  entityType: 'note' | 'todo',
  entityId: string,
  workspaceId: string | null
): Promise<{ token: string; url: string } | null> {
  const state = useAppStore.getState()
  const user = state.currentUser
  if (!user) return null

  const key = workspaceId ? state.workspaceKeys[workspaceId] : state.encryptionKey
  if (!key) return null

  const keyStr = await exportKeyToString(key)
  const token = randomToken()

  const { error } = await supabase.from('share_links').insert({
    token,
    entity_type: entityType,
    entity_id: entityId,
    workspace_id: workspaceId,
    created_by: user.id,
  })
  if (error) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return { token, url: `${origin}/s/${token}#k=${encodeURIComponent(keyStr)}` }
}

export async function fetchShareLink(token: string): Promise<ShareLink | null> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error || !data) return null
  return {
    token: data.token,
    entityType: data.entity_type,
    entityId: data.entity_id,
    workspaceId: data.workspace_id ?? null,
    createdBy: data.created_by,
    createdAt: data.created_at,
    revokedAt: data.revoked_at ?? null,
  }
}

export async function revokeShareLink(token: string): Promise<boolean> {
  const { error } = await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
  return !error
}

export interface SharedItem {
  title: string
  content: string
  type: 'note' | 'todo'
}

/**
 * Fetches and decrypts a shared item using the key from the URL fragment.
 * Runs against the anon client; RLS only exposes items with a live share link.
 */
export async function fetchSharedItem(token: string, keyBase64: string): Promise<SharedItem | null> {
  const link = await fetchShareLink(token)
  if (!link || link.revokedAt) return null

  const table = link.entityType === 'note' ? 'notes' : 'todo_lists'
  const { data, error } = await supabase
    .from(table)
    .select(link.entityType === 'note' ? 'title, content' : 'title')
    .eq('id', link.entityId)
    .maybeSingle()
  if (error || !data) return null

  const key = await importKeyFromString(keyBase64)
  const title = await decrypt(data.title, key).catch(() => data.title)
  const content =
    link.entityType === 'note'
      ? await decrypt((data as { content?: string }).content || '', key).catch(() => (data as { content?: string }).content || '')
      : ''

  return { title, content, type: link.entityType }
}
