import {
  encryptNoteTitle,
  decryptNoteTitle,
  encryptNoteContent,
  decryptNoteContent
} from '../encrypted-api'
import { useAppStore } from '@/stores/app-store'
import { generateMasterKey } from '../e2ee'

// Mock the Zustand store
jest.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: jest.fn()
  }
}))

describe('Encrypted API', () => {
  let personalKey: CryptoKey
  let workspaceKey: CryptoKey

  beforeAll(async () => {
    personalKey = await generateMasterKey()
    workspaceKey = await generateMasterKey()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAppStore.getState as jest.Mock).mockReturnValue({
      isEncryptedSession: true,
      encryptionKey: personalKey,
      workspaceKeys: {
        'ws-123': workspaceKey
      }
    })
  })

  it('should encrypt and decrypt using the personal key when no workspaceId is provided', async () => {
    const title = 'Personal Note Title'
    const encryptedTitle = await encryptNoteTitle(title)
    const decryptedTitle = await decryptNoteTitle(encryptedTitle)

    expect(encryptedTitle).not.toBe(title)
    expect(decryptedTitle).toBe(title)
  })

  it('should encrypt and decrypt using the workspace key when a workspaceId is provided', async () => {
    const content = 'This is shared workspace content.'
    const encryptedContent = await encryptNoteContent(content, 'ws-123')
    
    // Simulate changing the personal key to prove workspace key was actually used
    ;(useAppStore.getState as jest.Mock).mockReturnValue({
      isEncryptedSession: true,
      encryptionKey: await generateMasterKey(), // Random new personal key
      workspaceKeys: {
        'ws-123': workspaceKey
      }
    })

    const decryptedContent = await decryptNoteContent(encryptedContent, 'ws-123')
    expect(decryptedContent).toBe(content)
  })

  it('should fallback to personal key if workspace key is missing', async () => {
    // Missing workspace key
    ;(useAppStore.getState as jest.Mock).mockReturnValue({
      isEncryptedSession: true,
      encryptionKey: personalKey,
      workspaceKeys: {}
    })

    const title = 'Fallback Title'
    const encryptedTitle = await encryptNoteTitle(title, 'missing-ws')
    const decryptedTitle = await decryptNoteTitle(encryptedTitle, 'missing-ws')

    expect(decryptedTitle).toBe(title)
  })
})
