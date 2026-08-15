import { supabase } from './supabase'
import { generateMasterKey, exportKeyToString, encryptWithPublicKey, encrypt } from './e2ee'
import { decryptNoteContentWithStatus } from './encrypted-api'
import { useAppStore } from '@/stores/app-store'

export async function rotateWorkspaceEncryptionKey(workspaceId: string) {
  try {
    // 1. Fetch remaining members of the workspace
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
    
    if (membersError || !members) throw new Error('Failed to fetch remaining workspace members')

    // 2. Fetch their public keys
    const userIds = members.map(m => m.user_id)
    const { data: publicKeys, error: keysError } = await supabase
      .from('public_keys')
      .select('id, public_key')
      .in('id', userIds)
    
    if (keysError || !publicKeys) throw new Error('Failed to fetch members public keys')

    // 3. Generate a new AES-GCM master key for the workspace
    const newWorkspaceKey = await generateMasterKey()
    const newWorkspaceKeyStr = await exportKeyToString(newWorkspaceKey)

    // 4. Encrypt the new workspace key for each remaining member using their RSA public key
    const newWorkspaceKeys = await Promise.all(
      publicKeys.map(async (pk) => {
        const encryptedWorkspaceKey = await encryptWithPublicKey(newWorkspaceKeyStr, pk.public_key)
        return {
          workspace_id: workspaceId,
          user_id: pk.id,
          encrypted_workspace_key: encryptedWorkspaceKey,
          workspace_public_key: pk.public_key // Not used anymore but required by schema if it exists? Wait, the schema has 'workspace_public_key' for workspace_keys? Let me check.
        }
      })
    )

    // 5. Fetch all notes and todos for this workspace BEFORE changing the key
    const store = useAppStore.getState()
    const oldNotes = store.notes.filter(n => n.workspaceId === workspaceId)
    const oldTodos = store.todoLists.filter(t => t.workspaceId === workspaceId)

    // 6. Decrypt and re-encrypt all notes with the NEW key
    const updatedNotes: any[] = []
    for (const note of oldNotes) {
      const { content: decTitle } = await decryptNoteContentWithStatus(note.title, workspaceId)
      const { content: decContent } = await decryptNoteContentWithStatus(note.content, workspaceId)
      
      const newEncTitle = await encrypt(decTitle, newWorkspaceKey)
      const newEncContent = await encrypt(decContent, newWorkspaceKey)
      
      updatedNotes.push({
        id: note.id,
        title: newEncTitle,
        content: newEncContent,
        updated_at: new Date().toISOString()
      })
    }

    // 7. Decrypt and re-encrypt all todos with the NEW key
    const updatedTodos: any[] = []
    const updatedTodoItems: any[] = []
    for (const todo of oldTodos) {
      const { content: decTitle } = await decryptNoteContentWithStatus(todo.title, workspaceId)
      const newEncTitle = await encrypt(decTitle, newWorkspaceKey)
      
      updatedTodos.push({
        id: todo.id,
        title: newEncTitle,
        updated_at: new Date().toISOString()
      })

      for (const item of todo.items) {
        const { content: decItemText } = await decryptNoteContentWithStatus(item.title, workspaceId)
        const newEncItemText = await encrypt(decItemText, newWorkspaceKey)
        
        updatedTodoItems.push({
          id: item.id,
          title: newEncItemText,
          updated_at: new Date().toISOString()
        })
      }
    }

    // 8. Execute a massive transaction to update keys and re-encrypted data
    // First, delete old workspace keys
    await supabase.from('workspace_keys').delete().eq('workspace_id', workspaceId)
    
    // Insert new workspace keys
    const { error: insertKeysError } = await supabase.from('workspace_keys').insert(
      newWorkspaceKeys.map(k => ({
        workspace_id: k.workspace_id,
        user_id: k.user_id,
        encrypted_workspace_key: k.encrypted_workspace_key
      }))
    )
    if (insertKeysError) throw insertKeysError

    // Upsert re-encrypted notes
    if (updatedNotes.length > 0) {
      const { error: updateNotesError } = await supabase.from('notes').upsert(updatedNotes)
      if (updateNotesError) throw updateNotesError
    }

    // Upsert re-encrypted todos
    if (updatedTodos.length > 0) {
      const { error: updateTodosError } = await supabase.from('todo_lists').upsert(updatedTodos)
      if (updateTodosError) throw updateTodosError
    }

    if (updatedTodoItems.length > 0) {
      const { error: updateItemsError } = await supabase.from('todo_items').upsert(updatedTodoItems)
      if (updateItemsError) throw updateItemsError
    }

    return true
  } catch (err) {
    console.error("Failed to rotate workspace keys:", err)
    throw err
  }
}
