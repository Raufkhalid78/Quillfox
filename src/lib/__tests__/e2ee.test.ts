import {
  generateMasterKey,
  exportKeyToString,
  importKeyFromString,
  encrypt,
  decrypt,
  generateRSAKeyPair,
  encryptWithPublicKey,
  decryptWithPrivateKey
} from '../e2ee'

describe('End-to-End Encryption (E2EE) Core', () => {
  it('should generate, export, and import a symmetric master key', async () => {
    const key = await generateMasterKey()
    const exported = await exportKeyToString(key)
    const imported = await importKeyFromString(exported)
    
    expect(exported).toBeDefined()
    expect(imported.type).toBe('secret')
    expect(imported.algorithm.name).toBe('AES-GCM')
  })

  it('should encrypt and decrypt a string using a symmetric key', async () => {
    const key = await generateMasterKey()
    const plaintext = 'This is a top secret note.'
    
    const encrypted = await encrypt(plaintext, key)
    const decrypted = await decrypt(encrypted, key)
    
    expect(encrypted).not.toBe(plaintext)
    expect(decrypted).toBe(plaintext)
  })

  it('should generate an RSA key pair', async () => {
    const keyPair = await generateRSAKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
  })

  it('should encrypt and decrypt with RSA', async () => {
    const keyPair = await generateRSAKeyPair()
    const secretData = 'WrappedAESKeyData'
    
    const encrypted = await encryptWithPublicKey(secretData, keyPair.publicKey)
    const decrypted = await decryptWithPrivateKey(encrypted, keyPair.privateKey)
    
    expect(encrypted).not.toBe(secretData)
    expect(decrypted).toBe(secretData)
  })
})
