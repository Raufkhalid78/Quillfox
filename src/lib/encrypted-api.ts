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

export async function encryptWorkspaceTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptWorkspaceTitle(title: string): Promise<string> {
  const key = getKey()
  if (!key || !title) return title
  if (!isEncrypted(title)) return title
  try {
    return await decrypt(title, key)
  } catch {
    return title
  }
}

export async function encryptWorkspaceDescription(desc: string | null): Promise<string | null> {
  if (!desc) return desc
  const key = getKey()
  if (!key) return desc
  return encrypt(desc, key)
}

export async function decryptWorkspaceDescription(desc: string | null): Promise<string | null> {
  const key = getKey()
  if (!key || !desc) return desc
  if (!isEncrypted(desc)) return desc
  try {
    return await decrypt(desc, key)
  } catch {
    return desc
  }
}
