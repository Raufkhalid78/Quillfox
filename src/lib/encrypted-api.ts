// Encrypted API wrapper functions
// These functions wrap the fetch calls with encryption/decryption
import { useAppStore } from '@/stores/app-store'
import { encrypt, decrypt, isEncrypted, decryptWithStatus } from './e2ee'

// In-memory cache for decrypted content to avoid expensive WebCrypto operations on every tab navigation
const DECRYPTION_CACHE_MAX = 1000
const decryptionCache = new Map<string, { content: string; usedLegacyFallback: boolean }>()

export function clearDecryptionCache() {
  decryptionCache.clear()
}

function getCachedOrDecrypt(
  ciphertext: string,
  decryptFn: () => Promise<{ content: string; usedLegacyFallback: boolean }>
): Promise<{ content: string; usedLegacyFallback: boolean }> {
  const cached = decryptionCache.get(ciphertext)
  if (cached) {
    return Promise.resolve(cached)
  }

  return decryptFn().then((result) => {
    if (decryptionCache.size >= DECRYPTION_CACHE_MAX) {
      const firstKey = decryptionCache.keys().next().value
      if (firstKey) decryptionCache.delete(firstKey)
    }
    decryptionCache.set(ciphertext, result)
    return result
  })
}

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

export async function decryptNoteContentWithStatus(content: string, workspaceId?: string | null): Promise<{ content: string; usedLegacyFallback: boolean }> {
  const key = getKey(workspaceId)
  if (!key || !content) return { content, usedLegacyFallback: false }
  if (!isEncrypted(content)) return { content, usedLegacyFallback: false }

  return getCachedOrDecrypt(content, async () => {
    try {
      return await decryptWithStatus(content, key)
    } catch {
      return { content, usedLegacyFallback: false }
    }
  })
}

export async function decryptNoteContent(content: string, workspaceId?: string | null): Promise<string> {
  const result = await decryptNoteContentWithStatus(content, workspaceId)
  return result.content
}

export async function encryptNoteTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptNoteTitleWithStatus(title: string, workspaceId?: string | null): Promise<{ content: string; usedLegacyFallback: boolean }> {
  const key = getKey(workspaceId)
  if (!key || !title) return { content: title, usedLegacyFallback: false }
  if (!isEncrypted(title)) return { content: title, usedLegacyFallback: false }

  return getCachedOrDecrypt(title, async () => {
    try {
      return await decryptWithStatus(title, key)
    } catch {
      return { content: title, usedLegacyFallback: false }
    }
  })
}

export async function decryptNoteTitle(title: string, workspaceId?: string | null): Promise<string> {
  const result = await decryptNoteTitleWithStatus(title, workspaceId)
  return result.content
}

export async function encryptTodoTitle(title: string, workspaceId?: string | null): Promise<string> {
  const key = getKey(workspaceId)
  if (!key) return title
  return encrypt(title, key)
}

export async function decryptTodoTitleWithStatus(title: string, workspaceId?: string | null): Promise<{ content: string; usedLegacyFallback: boolean }> {
  const key = getKey(workspaceId)
  if (!key || !title) return { content: title, usedLegacyFallback: false }
  if (!isEncrypted(title)) return { content: title, usedLegacyFallback: false }

  return getCachedOrDecrypt(title, async () => {
    try {
      return await decryptWithStatus(title, key)
    } catch {
      return { content: title, usedLegacyFallback: false }
    }
  })
}

export async function decryptTodoTitle(title: string, workspaceId?: string | null): Promise<string> {
  const result = await decryptTodoTitleWithStatus(title, workspaceId)
  return result.content
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

  const cached = decryptionCache.get(title)
  if (cached) return cached.content

  try {
    const res = await decrypt(title, key)
    if (decryptionCache.size >= DECRYPTION_CACHE_MAX) {
      const firstKey = decryptionCache.keys().next().value
      if (firstKey) decryptionCache.delete(firstKey)
    }
    decryptionCache.set(title, { content: res, usedLegacyFallback: false })
    return res
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

  const cached = decryptionCache.get(desc)
  if (cached) return cached.content

  try {
    const res = await decrypt(desc, key)
    if (decryptionCache.size >= DECRYPTION_CACHE_MAX) {
      const firstKey = decryptionCache.keys().next().value
      if (firstKey) decryptionCache.delete(firstKey)
    }
    decryptionCache.set(desc, { content: res, usedLegacyFallback: false })
    return res
  } catch {
    return desc
  }
}
