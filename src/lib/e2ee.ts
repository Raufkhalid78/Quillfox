// Client-side E2E encryption using Web Crypto API
// Uses PBKDF2 to derive AES-GCM key from user password

const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_ITERATIONS = 600000 // OWASP recommended minimum

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
      salt: salt as any,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // Must be extractable to wrap it
    ['encrypt', 'decrypt']
  )
}

// Generate a random AES-GCM key (Master Encryption Key)
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // Must be extractable to wrap it
    ['encrypt', 'decrypt']
  )
}

// Encrypt plaintext string → returns base64 encoded string (iv + ciphertext)
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  if (!plaintext) return plaintext
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  
  // Combine iv + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  
  // Chunked conversion to avoid "Maximum call stack size exceeded" on large data
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return 'enc:' + btoa(binary)
}

// Decrypt base64 encoded string → returns plaintext
export async function decrypt(
  encoded: string,
  key: CryptoKey
): Promise<string> {
  if (!encoded) return encoded
  const b64 = encoded.startsWith('enc:') ? encoded.slice(4) : encoded
  const binary = atob(b64)
  const combined = new Uint8Array(binary.length)
  
  // Chunked conversion to avoid stack overflow on large data
  const chunkSize = 0x8000
  for (let i = 0; i < binary.length; i += chunkSize) {
    const chunk = binary.substring(i, i + chunkSize)
    for (let j = 0; j < chunk.length; j++) {
      combined[i + j] = chunk.charCodeAt(j)
    }
  }
  
  // If the string starts with enc:, it uses the new (IV+Ciphertext) format.
  // Legacy strings (before the 'enc:' prefix was added) might have Salt+IV+Ciphertext.
  // For safety, we only support the new format for now, assuming Phase 1 is a clean slate or data wipe.
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}

// Check if a string looks like encrypted data (base64 format)
export function isEncrypted(value: string): boolean {
  if (!value) return false
  return value.startsWith('enc:')
}

// Convert base64 salt string back to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  const chunkSize = 0x8000
  for (let i = 0; i < binary.length; i += chunkSize) {
    const chunk = binary.substring(i, i + chunkSize)
    for (let j = 0; j < chunk.length; j++) {
      bytes[i + j] = chunk.charCodeAt(j)
    }
  }
  return bytes
}

// Wrap the active E2EE key (Master Key) using a derived key from the passcode
export async function wrapEncryptionKey(
  keyToWrap: CryptoKey,
  passcode: string,
  salt: Uint8Array
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey']
  )
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv: iv as any }
  )
  
  // Safe chunked conversion
  const wrappedArray = new Uint8Array(wrapped)
  let binary = ''
  for (let i = 0; i < wrappedArray.length; i += 0x8000) {
    binary += String.fromCharCode(...wrappedArray.subarray(i, i + 0x8000))
  }
  
  let ivBinary = ''
  for (let i = 0; i < iv.length; i++) {
    ivBinary += String.fromCharCode(iv[i])
  }
  
  return {
    ciphertext: btoa(binary),
    iv: btoa(ivBinary),
  }
}

// Unwrap the E2EE key (Master Key) using the passcode
export async function unwrapEncryptionKey(
  ciphertext: string,
  ivString: string,
  passcode: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['unwrapKey']
  )
  
  const encryptedData = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivString), (c) => c.charCodeAt(0))
  
  return crypto.subtle.unwrapKey(
    'raw',
    encryptedData,
    wrappingKey,
    { name: 'AES-GCM', iv: iv as any },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}
