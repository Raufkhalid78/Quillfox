// Client-side E2E encryption using Web Crypto API
// Uses PBKDF2 to derive AES-GCM key from user password

const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_ITERATIONS = 100000

// Generate a random salt for key derivation
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

// Derive an AES-GCM encryption key from password + salt using PBKDF2
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt plaintext string → returns base64 encoded string (salt:iv:ciphertext)
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  if (!plaintext) return plaintext
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  // Combine salt + iv + ciphertext and base64 encode
  const combined = new Uint8Array(
    salt.length + iv.length + new Uint8Array(ciphertext).length
  )
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  // Chunked conversion to avoid "Maximum call stack size exceeded" on large data
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// Decrypt base64 encoded string → returns plaintext
export async function decrypt(
  encoded: string,
  key: CryptoKey
): Promise<string> {
  if (!encoded) return encoded
  const binary = atob(encoded)
  const combined = new Uint8Array(binary.length)
  // Chunked conversion to avoid stack overflow on large data
  const chunkSize = 0x8000
  for (let i = 0; i < binary.length; i += chunkSize) {
    const chunk = binary.substring(i, i + chunkSize)
    for (let j = 0; j < chunk.length; j++) {
      combined[i + j] = chunk.charCodeAt(j)
    }
  }
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}

// Check if a string looks like encrypted data (base64 format)
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 50) return false
  try {
    const decoded = atob(value)
    return decoded.length > 0 && /^[A-Za-z0-9+/=]+$/.test(value)
  } catch {
    return false
  }
}

// Convert base64 salt string back to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  // Chunked conversion to avoid "Maximum call stack size exceeded" on large data
  const chunkSize = 0x8000
  for (let i = 0; i < binary.length; i += chunkSize) {
    const chunk = binary.substring(i, i + chunkSize)
    for (let j = 0; j < chunk.length; j++) {
      bytes[i + j] = chunk.charCodeAt(j)
    }
  }
  return bytes
}
