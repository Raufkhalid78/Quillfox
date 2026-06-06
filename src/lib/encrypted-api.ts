// Encrypted API wrapper functions
// These functions wrap the fetch calls with encryption/decryption
import { useAppStore } from '@/stores/app-store'
import { encrypt, decrypt, isEncrypted } from './e2ee'

// Helper to get current encryption key from store
function getKey(): CryptoKey | null {
  return useAppStore.getState().encryptionKey
}

// Encrypt note content before saving
export async function encryptNoteContent(content: string): Promise<string> {
  const key = getKey()
  if (!key) return content
  return encrypt(content, key)
}

// Decrypt note content after loading
export async function decryptNoteContent(content: string): Promise<string> {
  const key = getKey()
  if (!key || !content) return content
  if (!isEncrypted(content)) return content
  try {
    return await decrypt(content, key)
  } catch {
    return content // Return as-is if decryption fails
  }
}

// Encrypt note title before saving
export async function encryptNoteTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key) return title
  return encrypt(title, key)
}

// Decrypt note title after loading
export async function decryptNoteTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}

// Same pattern for todo items
export async function encryptTodoTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptTodoTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}
