import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export interface User {
  id: string
  email: string
  name: string | null
  image?: string | null
  createdAt?: string
}

export interface Collaborator {
  userId: string
  userName: string
  avatar?: string | null
  isTyping?: boolean
}

export interface FolderData {
  id: string
  name: string
  userId: string
  createdAt: string
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  storagePath: string
  iv: string
}

export interface NoteItem {
  id: string
  title: string
  content: string
  tags?: string[]
  attachments?: Attachment[]
  dueDate?: string
  folderId?: string
  workspaceId: string | null
  authorId: string
  isPinned: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
  lockedBy: string | null
  lockedAt: string | null
}

export interface TodoItemData {
  id: string
  title: string
  content: string
  workspaceId: string | null
  authorId: string
  isPinned: boolean
  isArchived: boolean
  dueDate?: string
  folderId?: string
  createdAt: string
  updatedAt: string
  items: TodoItemChild[]
}

export interface TodoItemChild {
  id: string
  title: string
  completed: boolean
  order: number
  todoListId: string
  completedAt?: string | null
}

export interface WorkspaceData {
  id: string
  title: string
  description: string | null
  color: string
  icon: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
  _count: {
    notes: number
    todoLists: number
    members: number
  }
}

interface AppState {
  // Auth
  currentUser: User | null
  // Collaboration
  activeCollaborators: Collaborator[]
  isLocked: boolean
  lockedByUser: string | null
  // Data cache
  notes: NoteItem[]
  todoLists: TodoItemData[]
  workspaces: WorkspaceData[]
  folders: FolderData[]
  // E2E Encryption (CryptoKey NOT persisted, excluded via partialize)
  encryptionKey: CryptoKey | null
  encryptionSalt: Uint8Array | null
  isEncryptedSession: boolean
  workspaceKeys: Record<string, CryptoKey>

  // Pro Tier and Auto-Lock Security State
  userTier: 'free' | 'premium' | 'ultra'
  isVaultLocked: boolean
  vaultAutoLock: boolean
  vaultLockTimeout: number // in milliseconds
  vaultPasscodeHash: string | null
  extraCollaborators: number
  hidePreviews: boolean
  
  globalSyncTrigger: number
  migratedLegacyNoteCount: number

  // Actions
  setHidePreviews: (hide: boolean) => void
  incrementMigratedCount: () => void
  login: (user: User) => void
  logout: () => void
  setEncryptionKey: (key: CryptoKey, salt: Uint8Array) => void
  setWorkspaceKeys: (keys: Record<string, CryptoKey>) => void
  clearEncryption: () => void
  setActiveCollaborators: (collaborators: Collaborator[]) => void
  setLock: (isLocked: boolean, lockedByUser: string | null) => void
  setNotes: (notes: NoteItem[]) => void
  setTodoLists: (todoLists: TodoItemData[]) => void
  setWorkspaces: (workspaces: WorkspaceData[]) => void
  setFolders: (folders: FolderData[]) => void
  updateNoteContent: (noteId: string, content: string) => void
  updateNoteTitle: (noteId: string, title: string) => void
  addNote: (note: NoteItem) => void
  removeNote: (noteId: string) => void
  addAttachmentToNote: (noteId: string, attachment: Attachment) => void
  removeAttachmentFromNote: (noteId: string, attachmentId: string) => void
  setNoteDueDate: (id: string, dueDate?: string) => void
  setNoteFolder: (id: string, folderId?: string) => void
  addTodoList: (todoList: TodoItemData) => void
  updateTodoListTitle: (todoListId: string, title: string) => void
  removeTodoList: (todoListId: string) => void
  updateTodoListItems: (todoListId: string, items: TodoItemChild[]) => void
  addTodoItem: (todoListId: string, item: TodoItemChild) => void
  setTodoDueDate: (id: string, dueDate?: string) => void
  setTodoFolder: (id: string, folderId?: string) => void
  addFolder: (folder: FolderData) => void
  removeFolder: (id: string) => void
  updateUserName: (name: string) => void
  updateUserImage: (image: string | null) => void
  setTier: (tier: 'free' | 'premium' | 'ultra') => void
  lockVault: () => void
  unlockVault: () => void
  updateVaultSettings: (settings: { vaultAutoLock?: boolean; vaultLockTimeout?: number; vaultPasscodeHash?: string | null }) => void
  setExtraCollaborators: (count: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentUser: null,
      activeCollaborators: [],
      isLocked: false,
      lockedByUser: null,
      notes: [],
      todoLists: [],
      workspaces: [],
      folders: [],
      // E2E encryption state
      encryptionKey: null,
      encryptionSalt: null,
      isEncryptedSession: false,
      workspaceKeys: {},

      // Pro Tier and Auto-Lock initial state
      userTier: 'free',
      isVaultLocked: false,
      vaultAutoLock: false,
      vaultLockTimeout: 5 * 60 * 1000,
      vaultPasscodeHash: null,
      extraCollaborators: 0,
      hidePreviews: false,
      globalSyncTrigger: 0,
      migratedLegacyNoteCount: 0,

      // Actions
      setHidePreviews: (hide: boolean) => set({ hidePreviews: hide }),
      incrementMigratedCount: () => set((state) => ({ migratedLegacyNoteCount: state.migratedLegacyNoteCount + 1 })),
      login: (user) =>
        set({ currentUser: user }),

      logout: () => {
        supabase.auth.signOut().catch(console.error)
        set({
          currentUser: null,
          activeCollaborators: [],
          isLocked: false,
          lockedByUser: null,
          notes: [],
          todoLists: [],
          workspaces: [],
          encryptionKey: null,
          encryptionSalt: null,
          isEncryptedSession: false,
          workspaceKeys: {},
          isVaultLocked: false,
        })
      },

      setEncryptionKey: (key, salt) =>
        set({ encryptionKey: key, encryptionSalt: salt, isEncryptedSession: true }),

      setWorkspaceKeys: (keys) =>
        set({ workspaceKeys: keys }),

      clearEncryption: () =>
        set({ encryptionKey: null, encryptionSalt: null, isEncryptedSession: false, workspaceKeys: {} }),

      setActiveCollaborators: (collaborators) =>
        set({ activeCollaborators: collaborators }),

      setLock: (isLocked, lockedByUser) =>
        set({ isLocked, lockedByUser }),

      setNotes: (notes) => set({ notes }),

      setTodoLists: (todoLists) => set({ todoLists }),

      setWorkspaces: (workspaces) => set({ workspaces }),

      setFolders: (folders) => set({ folders }),

      updateNoteContent: (noteId, content) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === noteId ? { ...n, content } : n
          ),
        })),

      updateNoteTitle: (noteId, title) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === noteId ? { ...n, title } : n
          ),
        })),

      addNote: (note) =>
        set((state) => ({ notes: [note, ...state.notes] })),

      removeNote: (noteId) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== noteId),
        })),

      addAttachmentToNote: (noteId, attachment) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === noteId ? { ...n, attachments: [...(n.attachments || []), attachment] } : n
          ),
        })),

      removeAttachmentFromNote: (noteId, attachmentId) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === noteId
              ? { ...n, attachments: (n.attachments || []).filter((a) => a.id !== attachmentId) }
              : n
          ),
        })),

      setNoteDueDate: (id, dueDate) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, dueDate } : n)),
        })),

      setNoteFolder: (id, folderId) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, folderId } : n)),
        })),

      addTodoList: (todoList) =>
        set((state) => ({ todoLists: [todoList, ...state.todoLists] })),

      updateTodoListTitle: (todoListId, title) =>
        set((state) => ({
          todoLists: state.todoLists.map((t) =>
            t.id === todoListId ? { ...t, title } : t
          ),
        })),

      removeTodoList: (todoListId) =>
        set((state) => ({
          todoLists: state.todoLists.filter((t) => t.id !== todoListId),
        })),

      updateTodoListItems: (todoListId, items) =>
        set((state) => ({
          todoLists: state.todoLists.map((t) =>
            t.id === todoListId ? { ...t, items } : t
          ),
        })),

      addTodoItem: (todoListId, item) =>
        set((state) => ({
          todoLists: state.todoLists.map((t) =>
            t.id === todoListId ? { ...t, items: [...t.items, item] } : t
          ),
        })),

      setTodoDueDate: (id, dueDate) =>
        set((state) => ({
          todoLists: state.todoLists.map((t) => (t.id === id ? { ...t, dueDate } : t)),
        })),

      setTodoFolder: (id, folderId) =>
        set((state) => ({
          todoLists: state.todoLists.map((t) => (t.id === id ? { ...t, folderId } : t)),
        })),

      addFolder: (folder) =>
        set((state) => ({ folders: [folder, ...state.folders] })),

      removeFolder: (id) =>
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
        })),

      updateUserName: (name) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, name }
            : null,
        })),
      updateUserImage: (image) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, image }
            : null,
        })),

      setTier: (tier) => set({ userTier: tier }),
      lockVault: () => set({ isVaultLocked: true }),
      unlockVault: () => set({ isVaultLocked: false }),
      updateVaultSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setExtraCollaborators: (count) => set({ extraCollaborators: count }),
    }),
    {
      name: 'quillfox-app-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        encryptionSalt: state.encryptionSalt,
        userTier: state.userTier,
        extraCollaborators: state.extraCollaborators,
        vaultAutoLock: state.vaultAutoLock,
        vaultLockTimeout: state.vaultLockTimeout,
        vaultPasscodeHash: state.vaultPasscodeHash,
      }),
    }
  )
)
