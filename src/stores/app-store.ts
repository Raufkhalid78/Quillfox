import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppView = 'auth' | 'dashboard' | 'note-editor' | 'todo-list' | 'notes' | 'todos' | 'workspaces' | 'settings' | 'pricing' | 'archive'

export interface User {
  id: string
  email: string
  name: string | null
  image?: string | null
}

export interface Collaborator {
  userId: string
  userName: string
  avatar?: string | null
}

export interface NoteItem {
  id: string
  title: string
  content: string
  workspaceId: string | null
  authorId: string
  isPinned: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface TodoItemData {
  id: string
  title: string
  content: string
  workspaceId: string | null
  authorId: string
  isPinned: boolean
  isArchived: boolean
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
  }
}

interface AppState {
  // View
  currentView: AppView
  // Auth
  currentUser: User | null
  // Selection
  selectedNoteId: string | null
  selectedTodoListId: string | null
  selectedWorkspaceId: string | null
  // Collaboration
  activeCollaborators: Collaborator[]
  isLocked: boolean
  lockedByUser: string | null
  // Data cache
  notes: NoteItem[]
  todoLists: TodoItemData[]
  workspaces: WorkspaceData[]
  // E2E Encryption (CryptoKey NOT persisted, excluded via partialize)
  encryptionKey: CryptoKey | null
  encryptionSalt: string | null
  isEncryptedSession: boolean

  // Actions
  setView: (view: AppView) => void
  login: (user: User) => void
  logout: () => void
  setEncryptionKey: (key: CryptoKey, salt: string) => void
  clearEncryption: () => void
  selectNote: (noteId: string | null) => void
  selectTodo: (todoListId: string | null) => void
  setSelectedWorkspaceId: (id: string | null) => void
  setActiveCollaborators: (collaborators: Collaborator[]) => void
  setLock: (isLocked: boolean, lockedByUser: string | null) => void
  setNotes: (notes: NoteItem[]) => void
  setTodoLists: (todoLists: TodoItemData[]) => void
  setWorkspaces: (workspaces: WorkspaceData[]) => void
  updateNoteContent: (noteId: string, content: string) => void
  updateNoteTitle: (noteId: string, title: string) => void
  addNote: (note: NoteItem) => void
  removeNote: (noteId: string) => void
  addTodoList: (todoList: TodoItemData) => void
  updateTodoListTitle: (todoListId: string, title: string) => void
  removeTodoList: (todoListId: string) => void
  updateTodoListItems: (todoListId: string, items: TodoItemChild[]) => void
  addTodoItem: (todoListId: string, item: TodoItemChild) => void
  updateUserName: (name: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentView: 'auth',
      currentUser: null,
      selectedNoteId: null,
      selectedTodoListId: null,
      selectedWorkspaceId: null,
      activeCollaborators: [],
      isLocked: false,
      lockedByUser: null,
      notes: [],
      todoLists: [],
      workspaces: [],
      // E2E encryption state
      encryptionKey: null,
      encryptionSalt: null,
      isEncryptedSession: false,

      // Actions
      setView: (view) => set({ currentView: view }),

      login: (user) =>
        set({ currentUser: user, currentView: 'dashboard' }),

      logout: () =>
        set({
          currentUser: null,
          currentView: 'auth',
          selectedNoteId: null,
          selectedTodoListId: null,
          selectedWorkspaceId: null,
          activeCollaborators: [],
          isLocked: false,
          lockedByUser: null,
          notes: [],
          todoLists: [],
          workspaces: [],
          encryptionKey: null,
          encryptionSalt: null,
          isEncryptedSession: false,
        }),

      setEncryptionKey: (key, salt) =>
        set({ encryptionKey: key, encryptionSalt: salt, isEncryptedSession: true }),

      clearEncryption: () =>
        set({ encryptionKey: null, encryptionSalt: null, isEncryptedSession: false }),

      selectNote: (noteId) =>
        set({
          selectedNoteId: noteId,
          currentView: noteId ? 'note-editor' : 'notes',
        }),

      selectTodo: (todoListId) =>
        set({
          selectedTodoListId: todoListId,
          currentView: todoListId ? 'todo-list' : 'todos',
        }),

      setSelectedWorkspaceId: (id) =>
        set({ selectedWorkspaceId: id }),

      setActiveCollaborators: (collaborators) =>
        set({ activeCollaborators: collaborators }),

      setLock: (isLocked, lockedByUser) =>
        set({ isLocked, lockedByUser }),

      setNotes: (notes) => set({ notes }),

      setTodoLists: (todoLists) => set({ todoLists }),

      setWorkspaces: (workspaces) => set({ workspaces }),

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

      updateUserName: (name) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, name }
            : null,
        })),
    }),
    {
      name: 'quillfox-app-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentView: state.currentView === 'auth' ? 'auth' : state.currentView,
        encryptionSalt: state.encryptionSalt,
      }),
    }
  )
)
