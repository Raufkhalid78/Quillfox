// Encrypted API wrapper functions
// These functions wrap the fetch calls with encryption/decryption
import { useAppStore } from '@/stores/app-store'
import { encrypt, decrypt, isEncrypted } from './e2ee'

// Helper to get current encryption key from store
function getKey(workspaceId?: string | null): CryptoKey | null {
  const state = useAppStore.getState()
  if (!state.isEncryptedSession) return null
  
  if (workspaceId && state.workspaceKeys) {
    return state.workspaceKeys[workspaceId] || null
  }
  return state.encryptionKey
}

export async function encryptNoteContent(content: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return content
  return encrypt(content, key)
}

export async function decryptNoteContent(content: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key || !content) return content
  if (!isEncrypted(content)) return content
  try {
    return await decrypt(content, key)
  } catch {
    return content // Return as-is if decryption fails
  }
}

export async function encryptNoteTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptNoteTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}

export async function encryptTodoTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptTodoTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}

export async function encryptWorkspaceTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptWorkspaceTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}

export async function encryptWorkspaceDescription(desc: string | null, workspaceId?: string | null): Promise<string | null> {
  if (!desc) return desc
  const key = getKey(workspaceId)
  if (!key) return desc
  return encrypt(desc, key)
}

export async function decryptWorkspaceDescription(desc: string | null, workspaceId?: string | null): Promise<string | null> {
  const key = getKey(workspaceId)
  if (!key || !desc) return desc
  if (!isEncrypted(desc)) return desc
  try {
    return await decrypt(desc, key)
  } catch {
    return desc
  }
}
