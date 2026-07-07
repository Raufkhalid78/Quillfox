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
    // Yield to the event loop every 4 chunks (approx 128KB) to prevent UI freezing
    if (i > 0 && i % (chunkSize * 4) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
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
    // Yield to the event loop every 4 chunks (approx 128KB) to prevent UI freezing
    if (i > 0 && i % (chunkSize * 4) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
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

// ==========================================
// ASYMMETRIC ENCRYPTION (RSA-OAEP 2048)
// ==========================================
import forge from 'node-forge'

export async function generateRSAKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
      if (err) return reject(err);
      resolve({
        publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
      });
    });
  });
}

// Encrypts a raw AES Master Key (exported as string) using RSA Public Key
export async function encryptWithPublicKey(plaintext: string, publicKeyPem: string): Promise<string> {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  // @ts-ignore
  const encrypted = publicKey.encrypt(plaintext, 'RSA-OAEP');
  return forge.util.encode64(encrypted);
}

// Decrypts the raw AES Master Key using RSA Private Key
export async function decryptWithPrivateKey(ciphertextB64: string, privateKeyPem: string): Promise<string> {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const encrypted = forge.util.decode64(ciphertextB64);
  // @ts-ignore
  const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
  return decrypted;
}

// Export CryptoKey to binary string for RSA encryption
export async function exportKeyToString(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

// Import binary string back to CryptoKey
export async function importKeyFromString(binaryString: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

// Load and decrypt all workspace keys for a user
export async function loadWorkspaceKeys(mek: CryptoKey, encryptedPrivateKey: string, userId: string): Promise<Record<string, CryptoKey>> {
  const { decrypt } = await import('./e2ee');
  const { supabase } = await import('./supabase');
  
  // 1. Decrypt Private RSA Key using MEK
  const privateKeyPem = await decrypt(encryptedPrivateKey, mek);
  
  // 2. Fetch all workspace memberships with an encrypted_workspace_key
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, encrypted_workspace_key')
    .eq('user_id', userId)
    .not('encrypted_workspace_key', 'is', null);

  if (!members) return {};

  const workspaceKeys: Record<string, CryptoKey> = {};

  // 3. Decrypt each workspace key using the Private RSA Key
  for (const member of members) {
    try {
      const rawKeyStr = await decryptWithPrivateKey(member.encrypted_workspace_key, privateKeyPem);
      const wsKey = await importKeyFromString(rawKeyStr);
      workspaceKeys[member.workspace_id] = wsKey;
    } catch (e) {
      console.error(`Failed to decrypt workspace key for ${member.workspace_id}`, e);
    }
  }

  return workspaceKeys;
}
