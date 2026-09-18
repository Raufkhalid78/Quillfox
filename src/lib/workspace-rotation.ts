import { supabase } from './supabase'
import {
  generateMasterKey,
  exportKeyToString,
  encryptWithPublicKey,
  encrypt,
  decrypt,
  isEncrypted,
} from './e2ee'
import { useAppStore } from '@/stores/app-store'

interface MemberKeyPayload {
  user_id: string
  encrypted_workspace_key: string
}

interface ContentPayload {
  id: string
  title: string
  content?: string
}

/**
 * Re-encrypt securely-produces a plaintext using the new workspace key.
 * Encrypted values are decrypted with the old key first; a value that is not
 * encrypted (legacy plaintext) is passed through unchanged.
 */
async function reEncrypt(
  value: string | null,
  oldKey: CryptoKey,
  newKey: CryptoKey
): Promise<string | null> {
  if (!value) return value
  if (!isEncrypted(value)) return encrypt(value, newKey)

  const plaintext = await decrypt(value, oldKey)
  return encrypt(plaintext, newKey)
}

/**
 * Rotates a workspace's symmetric key after a member is removed.
 *
 * All wrapped member keys and re-encrypted content are written by a single
 * Postgres function (`rotate_workspace_keys`) in one transaction, so a partial
 * failure can never leave the workspace with mismatched keys or unreadable
 * notes. Data is read from the database (not the local store) so records are
 * never missed. If any value cannot be decrypted with the old key the rotation
 * aborts before writing anything.
 */
export async function rotateWorkspaceEncryptionKey(workspaceId: string): Promise<boolean> {
  // 0. The old key must be available in memory to decrypt existing content.
  const oldKey = useAppStore.getState().workspaceKeys[workspaceId]
  if (!oldKey) {
    throw new Error('Cannot rotate workspace key: the current workspace key is not loaded.')
  }

  // 1. Remaining members of the workspace.
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)

  if (membersError) throw new Error(`Failed to fetch workspace members: ${membersError.message}`)
  if (!members || members.length === 0) {
    throw new Error('Cannot rotate keys: workspace has no members')
  }

  // 2. Their RSA public keys (stored on profiles).
  const userIds = members.map((m) => m.user_id)
  const { data: profiles, error: keysError } = await supabase
    .from('profiles')
    .select('id, public_rsa_key')
    .in('id', userIds)

  if (keysError) throw new Error(`Failed to fetch member public keys: ${keysError.message}`)

  const publicKeyById = new Map<string, string>()
  for (const p of (profiles ?? []) as { id: string; public_rsa_key: string | null }[]) {
    if (p.public_rsa_key) publicKeyById.set(p.id, p.public_rsa_key)
  }

  // 3. Generate the new workspace key and wrap it for every member with a key.
  const newWorkspaceKey = await generateMasterKey()
  const newWorkspaceKeyStr = await exportKeyToString(newWorkspaceKey)

  const memberKeyPayloads = (
    await Promise.all(
      userIds.map(async (userId): Promise<MemberKeyPayload | null> => {
        const publicKey = publicKeyById.get(userId)
        if (!publicKey) return null // member has no RSA key yet; cannot be granted access
        return {
          user_id: userId,
          encrypted_workspace_key: await encryptWithPublicKey(newWorkspaceKeyStr, publicKey),
        }
      })
    )
  ).filter((x): x is MemberKeyPayload => x !== null)

  if (memberKeyPayloads.length === 0) {
    throw new Error('Cannot rotate keys: no members have a public key configured')
  }

  // 4. Fetch content from the database (source of truth).
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, title, content')
    .eq('workspace_id', workspaceId)
  if (notesError) throw new Error(`Failed to fetch notes: ${notesError.message}`)

  const { data: todos, error: todosError } = await supabase
    .from('todo_lists')
    .select('id, title')
    .eq('workspace_id', workspaceId)
  if (todosError) throw new Error(`Failed to fetch todo lists: ${todosError.message}`)

  const todoIds = (todos ?? []).map((t) => t.id)
  let items: { id: string; title: string }[] = []
  if (todoIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('todo_items')
      .select('id, title')
      .in('todo_list_id', todoIds)
    if (itemsError) throw new Error(`Failed to fetch todo items: ${itemsError.message}`)
    items = itemRows ?? []
  }

  // 5. Decrypt + re-encrypt everything. Any failure aborts before we write.
  const notePayloads = await Promise.all(
    (notes ?? []).map(async (n): Promise<ContentPayload> => ({
      id: n.id,
      title: (await reEncrypt(n.title, oldKey, newWorkspaceKey)) as string,
      content: (await reEncrypt(n.content, oldKey, newWorkspaceKey)) as string,
    }))
  )

  const todoPayloads = await Promise.all(
    (todos ?? []).map(async (t): Promise<ContentPayload> => ({
      id: t.id,
      title: (await reEncrypt(t.title, oldKey, newWorkspaceKey)) as string,
    }))
  )

  const itemPayloads = await Promise.all(
    items.map(async (i): Promise<ContentPayload> => ({
      id: i.id,
      title: (await reEncrypt(i.title, oldKey, newWorkspaceKey)) as string,
    }))
  )

  // 6. Commit all changes atomically.
  const { error: rpcError } = await supabase.rpc('rotate_workspace_keys', {
    p_workspace_id: workspaceId,
    p_member_keys: memberKeyPayloads,
    p_notes: notePayloads,
    p_todos: todoPayloads,
    p_items: itemPayloads,
  })

  if (rpcError) {
    throw new Error(`Failed to rotate workspace keys: ${rpcError.message}`)
  }

  // 7. Only after a successful commit, swap the in-memory key.
  const currentKeys = useAppStore.getState().workspaceKeys
  useAppStore.getState().setWorkspaceKeys({ ...currentKeys, [workspaceId]: newWorkspaceKey })

  return true
}