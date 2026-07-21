'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type NoteItem, type TodoItemData } from '@/stores/app-store'
import { decryptNoteTitle, decryptTodoTitle } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Archive,
  FileText,
  CheckSquare,
  Clock,
  ShieldCheck,
  RotateCcw,
  Trash2,
  LogOut,
  Sun,
  Moon,
  Search,
  PenLine,
  Inbox,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow } from 'date-fns'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

export function ArchiveView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const setNotes = useAppStore((s) => s.setNotes)
  const setTodoLists = useAppStore((s) => s.setTodoLists)
  const removeNote = useAppStore((s) => s.removeNote)
  const removeTodoList = useAppStore((s) => s.removeTodoList)
  const logout = useAppStore((s) => s.logout)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { theme, setTheme } = useTheme()

  // Archived data loaded separately
  const [archivedNotes, setArchivedNotes] = useState<NoteItem[]>([])
  const [archivedTodos, setArchivedTodos] = useState<TodoItemData[]>([])
  const [decryptedNotes, setDecryptedNotes] = useState<Map<string, string>>(new Map())
  const [decryptedTodos, setDecryptedTodos] = useState<Map<string, string>>(new Map())

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'note' | 'todo'; id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchArchivedData = useCallback(async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const [notesRes, todosRes] = await Promise.all([
        supabase
          .from('notes')
          .select('*')
          .eq('is_archived', true),
        supabase
          .from('todo_lists')
          .select('*, todo_items(*)')
          .eq('is_archived', true)
      ])

      if (notesRes.error || todosRes.error) {
        toast.error('Failed to load archived items')
        return
      }

      const formattedNotes = (notesRes.data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags || [],
        workspaceId: n.workspace_id,
        authorId: n.author_id,
        isPinned: n.is_pinned,
        isArchived: n.is_archived,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }))

      const formattedTodos = (todosRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        content: '',
        workspaceId: t.workspace_id,
        authorId: t.author_id,
        isPinned: t.is_pinned,
        isArchived: t.is_archived,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        items: (t.todo_items || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          completed: i.completed,
          order: i.order,
          todoListId: i.todo_list_id,
          completedAt: i.completed_at,
        })).sort((a: any, b: any) => a.order - b.order),
      }))

      setArchivedNotes(formattedNotes)
      setArchivedTodos(formattedTodos)
    } catch {
      toast.error('Failed to load archived items')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    fetchArchivedData()
  }, [fetchArchivedData])

  useEffect(() => {
    const decryptData = async () => {
      const noteMap = new Map<string, string>()
      const todoMap = new Map<string, string>()
      await Promise.all([
        ...archivedNotes.map(async (n) => {
          const title = await decryptNoteTitle(n.title, n.workspaceId)
          noteMap.set(n.id, title)
        }),
        ...archivedTodos.map(async (t) => {
          const title = await decryptTodoTitle(t.title, t.workspaceId)
          todoMap.set(t.id, title)
        }),
      ])
      setDecryptedNotes(noteMap)
      setDecryptedTodos(todoMap)
    }
    if (!isLoading) decryptData()
  }, [archivedNotes, archivedTodos, isLoading])

  const globalSyncTrigger = useAppStore((s) => s.globalSyncTrigger)

  useEffect(() => {
    if (!currentUser) router.push('/auth')
  }, [currentUser, router])

  // Also refresh active notes/todos list so restoring works correctly
  const refreshActiveData = useCallback(async () => {
    if (!currentUser) return
    try {
      const [notesRes, todosRes] = await Promise.all([
        supabase
          .from('notes')
          .select('*')
          .eq('is_archived', false),
        supabase
          .from('todo_lists')
          .select('*, todo_items(*)')
          .eq('is_archived', false)
      ])

      if (notesRes.data) {
        setNotes(notesRes.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          tags: n.tags || [],
          workspaceId: n.workspace_id,
          authorId: n.author_id,
          isPinned: n.is_pinned,
          isArchived: n.is_archived,
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        })))
      }

      if (todosRes.data) {
        setTodoLists(todosRes.data.map((t: any) => ({
          id: t.id,
          title: t.title,
          content: '',
          workspaceId: t.workspace_id,
          authorId: t.author_id,
          isPinned: t.is_pinned,
          isArchived: t.is_archived,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          items: (t.todo_items || []).map((i: any) => ({
            id: i.id,
            title: i.title,
            completed: i.completed,
            order: i.order,
            todoListId: i.todo_list_id,
            completedAt: i.completed_at,
          })).sort((a: any, b: any) => a.order - b.order),
        })))
      }
    } catch {
      // silent
    }
  }, [currentUser, setNotes, setTodoLists])

  useEffect(() => {
    fetchArchivedData()
    refreshActiveData()
  }, [currentUser, globalSyncTrigger, refreshActiveData])

  const handleRestoreNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_archived: false })
        .eq('id', noteId)

      if (!error) {
        setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId))
        await refreshActiveData()
        toast.success('Note restored')
      } else {
        toast.error('Failed to restore note')
      }
    } catch {
      toast.error('Failed to restore note')
    }
  }

  const handleRestoreTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from('todo_lists')
        .update({ is_archived: false })
        .eq('id', todoId)

      if (!error) {
        setArchivedTodos((prev) => prev.filter((t) => t.id !== todoId))
        await refreshActiveData()
        toast.success('Todo list restored')
      } else {
        toast.error('Failed to restore todo list')
      }
    } catch {
      toast.error('Failed to restore todo list')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from(deleteTarget.type === 'note' ? 'notes' : 'todo_lists')
        .delete()
        .eq('id', deleteTarget.id)

      if (!error) {
        if (deleteTarget.type === 'note') {
          setArchivedNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
          removeNote(deleteTarget.id)
        } else {
          setArchivedTodos((prev) => prev.filter((t) => t.id !== deleteTarget.id))
          removeTodoList(deleteTarget.id)
        }
        toast.success(
          deleteTarget.type === 'note' ? 'Note permanently deleted' : 'Todo list permanently deleted'
        )
      } else {
        toast.error('Failed to delete item')
      }
    } catch {
      toast.error('Failed to delete item')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (!currentUser) return null

  const totalArchived = archivedNotes.length + archivedTodos.length

  // Filter by search query
  const filteredArchivedNotes = searchQuery
    ? archivedNotes.filter((n) => {
        const decrypted = decryptedNotes.get(n.id)
        return decrypted?.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : archivedNotes

  const filteredArchivedTodos = searchQuery
    ? archivedTodos.filter((t) => {
        const decrypted = decryptedTodos.get(t.id)
        return decrypted?.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : archivedTodos

  const hasResults = filteredArchivedNotes.length > 0 || filteredArchivedTodos.length > 0

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar  />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
              <Archive className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">Archive</h1>
              <Badge variant="secondary" className="text-[10px] font-normal">{totalArchived}</Badge>
            </div>
            {isEncryptedSession && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#059669] bg-[#059669]/10 border-[#059669]/20 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">E2E</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>End-to-end encryption active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="relative max-w-[200px] sm:max-w-[280px] mx-3 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              placeholder="Search archive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg pl-8"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : totalArchived === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#059669]/10 flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-[#059669]/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No archived items</h3>
                <p className="text-sm text-muted-foreground">Items you archive will appear here</p>
              </motion.div>
            ) : !hasResults ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No items match your search</h3>
                <p className="text-sm text-muted-foreground mb-4">Try a different search term</p>
              </motion.div>
            ) : (
              <div className="space-y-8">
                {/* Archived Notes Section */}
                {filteredArchivedNotes.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-md bg-[#059669]/10 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-[#059669]/70" />
                      </div>
                      <h2 className="text-sm font-semibold tracking-tight">
                        Archived Notes
                      </h2>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {filteredArchivedNotes.length}
                      </Badge>
                    </div>

                    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                      {filteredArchivedNotes.map((note) => {
                        const decrypted = decryptedNotes.get(note.id)
                        const ws = workspaces.find((w) => w.id === note.workspaceId)
                        return (
                          <motion.div key={note.id} variants={fadeUp}>
                            <div className="rounded-xl border border-border/40 bg-card/40 p-4 group">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#059669]/8 dark:bg-[#059669]/15 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-[#059669]/70 dark:text-[#34d399]/70" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium line-clamp-1">
                                      {decrypted || note.title}
                                    </p>
                                    {isEncryptedSession && (
                                      <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {ws && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                        {ws.title}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1 text-muted-foreground/50">
                                      <Clock className="w-3 h-3" />
                                      <span className="text-[10px]">
                                        {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-[#059669] hover:text-[#059669] hover:bg-[#059669]/10 rounded-lg"
                                          onClick={() => handleRestoreNote(note.id)}
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Restore</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: 'note',
                                              id: note.id,
                                              title: decrypted || note.title,
                                            })
                                          }
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete permanently</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  </section>
                )}

                {/* Archived Todos Section */}
                {filteredArchivedTodos.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-md bg-[#d97706]/10 flex items-center justify-center">
                        <CheckSquare className="w-3.5 h-3.5 text-[#d97706]/70" />
                      </div>
                      <h2 className="text-sm font-semibold tracking-tight">
                        Archived Todo Lists
                      </h2>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {filteredArchivedTodos.length}
                      </Badge>
                    </div>

                    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                      {filteredArchivedTodos.map((todo) => {
                        const decryptedTitle = decryptedTodos.get(todo.id) || todo.title
                        const ws = workspaces.find((w) => w.id === todo.workspaceId)
                        const completed = todo.items.filter((i) => i.completed).length
                        const total = todo.items.length
                        return (
                          <motion.div key={todo.id} variants={fadeUp}>
                            <div className="rounded-xl border border-border/40 bg-card/40 p-4 group">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#d97706]/8 dark:bg-[#d97706]/15 flex items-center justify-center shrink-0">
                                  <CheckSquare className="w-4 h-4 text-[#d97706]/70 dark:text-[#fbbf24]/70" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium line-clamp-1">
                                      {decryptedTitle}
                                    </p>
                                    {isEncryptedSession && (
                                      <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {ws && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                        {ws.title}
                                      </span>
                                    )}
                                    {total > 0 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {completed}/{total} tasks
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1 text-muted-foreground/50">
                                      <Clock className="w-3 h-3" />
                                      <span className="text-[10px]">
                                        {formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-[#059669] hover:text-[#059669] hover:bg-[#059669]/10 rounded-lg"
                                          onClick={() => handleRestoreTodo(todo.id)}
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Restore</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: 'todo',
                                              id: todo.id,
                                              title: decryptedTitle,
                                            })
                                          }
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete permanently</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              {isDeleting ? 'Deleting...' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

