/**
 * Cross-platform encryption interoperability tests.
 *
 * QuillFox encrypts on one platform and decrypts on the other, so the wire
 * format must match exactly:
 *   - content: "enc:" + base64( iv(12) || ciphertext || gcmTag(16) )
 *   - wrapped key: { ciphertext: base64(ciphertext||tag), iv: base64(iv) }
 *   - RSA-OAEP (SHA-1) over the base64 AES key, PKCS#1 PEM keys
 *
 * The `mobile*` helpers below mirror quillfox-mobile/src/lib/e2ee.ts exactly
 * (which is backed by react-native-quick-crypto / Node crypto). If either side
 * changes format, these tests fail.
 */
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto'
import { encrypt, decrypt, deriveKey, generateSalt } from '../e2ee'

const b64 = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString('base64')

// ---- mobile-side format helpers (mirror mobile e2ee.ts) ----
function mobileEncrypt(plaintext: string, keyB64: string): string {
  const keyBuffer = Buffer.from(keyB64, 'base64')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'enc:' + Buffer.concat([iv, encrypted, tag]).toString('base64')
}

function mobileDecrypt(encoded: string, keyB64: string): string {
  const keyBuffer = Buffer.from(keyB64, 'base64')
  const binary = Buffer.from(encoded.replace(/^enc:/, ''), 'base64')
  const iv = binary.subarray(0, 12)
  const encAndTag = binary.subarray(12)
  const ciphertext = encAndTag.subarray(0, encAndTag.length - 16)
  const tag = encAndTag.subarray(encAndTag.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

async function importWebKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', Buffer.from(keyB64, 'base64'), { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}

describe('cross-platform crypto interop', () => {
  const keyB64 = b64(randomBytes(32))

  it('web encrypt -> mobile decrypt', async () => {
    const key = await importWebKey(keyB64)
    const ciphertext = await encrypt('web note title 🦊', key)
    expect(mobileDecrypt(ciphertext, keyB64)).toBe('web note title 🦊')
  })

  it('mobile encrypt -> web decrypt', async () => {
    const key = await importWebKey(keyB64)
    const ciphertext = mobileEncrypt('mobile todo item', keyB64)
    expect(await decrypt(ciphertext, key)).toBe('mobile todo item')
  })

  it('web and mobile produce the same AES key from the same password + salt', async () => {
    const saltBytes = generateSalt()
    const saltB64 = b64(saltBytes)
    // mobile: pbkdf2Sync(passcode, salt, 600000, 32, sha256) -> base64
    const mobileKey = pbkdf2Sync('passphrase', Buffer.from(saltB64, 'base64'), 600000, 32, 'sha256').toString(
      'base64'
    )
    // web: deriveKey returns a CryptoKey; export raw and compare
    const webKey = await deriveKey('passphrase', saltBytes)
    const raw = await crypto.subtle.exportKey('raw', webKey)
    expect(b64(new Uint8Array(raw))).toBe(mobileKey)
  })

  it('round-trips through the mobile format for todos and note content', () => {
    const todo = 'Buy milk #groceries'
    expect(mobileDecrypt(mobileEncrypt(todo, keyB64), keyB64)).toBe(todo)
  })
})