import { supabase } from './supabase'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteContent, decryptNoteContent } from './encrypted-api'

export interface Comment {
  id: string
  entityType: 'note' | 'todo'
  entityId: string
  workspaceId: string | null
  authorId: string
  content: string
  mentions: string[]
  parentId: string | null
  createdAt: string
  author?: { id: string; name: string | null; image: string | null }
}

function rowToComment(row: any): Comment {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workspaceId: row.workspace_id ?? null,
    authorId: row.author_id,
    content: row.content,
    mentions: row.mentions ?? [],
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
    author: row.profiles
      ? { id: row.profiles.id, name: row.profiles.name, image: row.profiles.image }
      : undefined,
  }
}

export async function fetchComments(
  entityType: 'note' | 'todo',
  entityId: string,
  workspaceId: string | null
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(id, name, image)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error || !data) return []

  return Promise.all(
    data.map(async (row: any) => {
      const comment = rowToComment(row)
      comment.content = await decryptNoteContent(row.content, workspaceId).catch(() => row.content)
      return comment
    })
  )
}

export async function addComment(input: {
  entityType: 'note' | 'todo'
  entityId: string
  workspaceId: string | null
  content: string
  mentions?: string[]
}): Promise<Comment | null> {
  const currentUser = useAppStore.getState().currentUser
  if (!currentUser) return null

  const encrypted = await encryptNoteContent(input.content, input.workspaceId)
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

  const { data, error } = await supabase
    .from('comments')
    .insert({
      id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      workspace_id: input.workspaceId,
      author_id: currentUser.id,
      content: encrypted,
      mentions: input.mentions ?? [],
    })
    .select('*, profiles(id, name, image)')
    .single()

  if (error || !data) return null
  const comment = rowToComment(data)
  comment.content = input.content
  return comment
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

/** Extracts `@Name` tokens from comment text. */
export function parseMentions(text: string): string[] {
  const matches = text.match(/@[\w.-]+/g) ?? []
  return Array.from(new Set(matches.map((m) => m.slice(1))))
}
