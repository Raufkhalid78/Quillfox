'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, TodoItemData } from '@/stores/app-store'
import { encryptTodoTitle, decryptTodoTitle } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Plus, CheckSquare, ShieldCheck, Loader2, PenLine, LogOut, Sun, Moon, Search } from 'lucide-react'
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

export function TodosList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const selectTodo = useAppStore((s) => s.selectTodo)
  const addTodoList = useAppStore((s) => s.addTodoList)
  const setTodoLists = useAppStore((s) => s.setTodoLists)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const userTier = useAppStore((s) => s.userTier)

  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWorkspace, setNewWorkspace] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12
  const { theme, setTheme } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)

  const [decryptedTodos, setDecryptedTodos] = useState<Map<string, string>>(new Map())

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('todo_lists')
        .select('*, todo_items(*)')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })

      if (error) {
        toast.error('Failed to load todo lists')
        return
      }

      const formatted: TodoItemData[] = (data || []).map((t: any) => ({
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

      setTodoLists(formatted)
    } catch {
      toast.error('Failed to load todo lists')
    } finally {
      setIsLoading(false)
    }
  }

  const globalSyncTrigger = useAppStore((s) => s.globalSyncTrigger)

  useEffect(() => {
    fetchData()
  }, [currentUser, globalSyncTrigger, setTodoLists])

  useEffect(() => {
    const decryptData = async () => {
      const todoMap = new Map<string, string>()
      await Promise.all(
        todoLists.map(async (t) => {
          const title = await decryptTodoTitle(t.title, t.workspaceId)
          todoMap.set(t.id, title)
        })
      )
      setDecryptedTodos(todoMap)
    }
    if (!isLoading) decryptData()
  }, [todoLists, isLoading])

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleCreate = async () => {
    if (!currentUser || isCreating) return
    setIsCreating(true)

    // Enforce Free tier todo lists limit (3 todo lists max)
    const ownedTodoListsCount = todoLists.filter((t) => t.authorId === currentUser.id && !t.isArchived).length
    if (userTier === 'free' && ownedTodoListsCount >= 3) {
      toast.error('Free tier is limited to 3 todo lists. Please upgrade to Premium or Ultra Premium!')
      return
    }

    const plainTitle = newTitle.trim() || 'Untitled Todo List'
    const todoListId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      const encryptedTitle = await encryptTodoTitle(plainTitle, newWorkspace || null)
      const { data, error } = await supabase
        .from('todo_lists')
        .insert({
          id: todoListId,
          title: encryptedTitle,
          workspace_id: newWorkspace || null,
          author_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create todo list')
        return
      }

      const formatted: TodoItemData = {
        id: data.id,
        title: data.title,
        content: '',
        workspaceId: data.workspace_id,
        authorId: data.author_id,
        isPinned: data.is_pinned,
        isArchived: data.is_archived,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        items: [],
      }

      addTodoList(formatted)
      setCreateOpen(false)
      setNewTitle('')
      setNewWorkspace('')
      selectTodo(formatted.id)
      toast.success('Todo list created')
    } catch {
      toast.error('Failed to create todo list')
    } finally {
      setIsCreating(false)
    }
  }

  const activeTodos = todoLists
    .filter((t) => !t.isArchived)
    .sort((a, b) => {
      // Pinned items first, then by updatedAt desc
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const filteredTodos = searchQuery
    ? activeTodos.filter((t) => {
        const decrypted = decryptedTodos.get(t.id)
        return decrypted?.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : activeTodos

  const totalPages = Math.ceil(filteredTodos.length / PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages)
    }
  }, [filteredTodos.length, totalPages, page])

  if (!currentUser) return null

  const paginatedTodos = filteredTodos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const paginationStart = (page - 1) * PAGE_SIZE + 1
  const paginationEnd = Math.min(page * PAGE_SIZE, filteredTodos.length)

  return (
    <div className="min-h-screen flex bg-gradient-mesh-dash-light dark:bg-gradient-mesh-dash-dark noise-overlay">
      <AppSidebar activeView="todos" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 glass-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#d97706] to-[#f59e0b] text-white flex items-center justify-center shrink-0">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">All Todo Lists</h1>
              <Badge variant="secondary" className="text-[10px] font-normal">{activeTodos.length}</Badge>
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
              placeholder="Search todos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg pl-8"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white hover:from-[#d97706]/90 hover:to-[#f59e0b]/90 rounded-lg text-xs h-8 btn-shine"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Todo</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" ref={contentRef}>
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : activeTodos.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#d97706]/10 flex items-center justify-center mb-4">
                  <CheckSquare className="w-8 h-8 text-[#d97706]/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No todo lists yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first list to start tracking tasks</p>
                <Button
                  className="gap-2 bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white hover:from-[#d97706]/90 hover:to-[#f59e0b]/90 rounded-xl btn-shine"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create Todo List
                </Button>
              </motion.div>
            ) : filteredTodos.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No todo lists match your search</h3>
                <p className="text-sm text-muted-foreground mb-4">Try a different search term</p>
              </motion.div>
            ) : (
              <>
              <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                {paginatedTodos.map((todo, index) => {
                  const completed = todo.items.filter((i) => i.completed).length
                  const total = todo.items.length
                  const progress = total > 0 ? (completed / total) * 100 : 0
                  const decryptedTitle = decryptedTodos.get(todo.id) || todo.title
                  const ws = workspaces.find((w) => w.id === todo.workspaceId)
                  return (
                    <motion.div key={todo.id} variants={fadeUp}>
                      <button
                        onClick={() => selectTodo(todo.id)}
                        className="w-full text-left rounded-xl glass-card card-lift inner-glow p-4 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#d97706]/8 dark:bg-[#d97706]/15 flex items-center justify-center shrink-0">
                            <CheckSquare className="w-4 h-4 text-[#d97706]/70 dark:text-[#fbbf24]/70" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium line-clamp-1">{decryptedTitle}</p>
                              {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                            </div>
                            {/* Progress bar */}
                            <div className="flex items-center gap-3 mb-1.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-[#d97706] to-[#f59e0b]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                {completed}/{total}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {ws && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                  {ws.title}
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-muted-foreground/50">
                                <span className="text-[10px]">{formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  )
                })}
              </motion.div>
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {paginationStart}–{paginationEnd} of {filteredTodos.length}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => page > 1 && handlePageChange(page - 1)}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={p === page}
                                onClick={() => handlePageChange(p)}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        }
                        if (p === 2 && page > 4) {
                          return (
                            <PaginationItem key={`ellipsis-start-${p}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        if (p === totalPages - 1 && page < totalPages - 3) {
                          return (
                            <PaginationItem key={`ellipsis-end-${p}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return null
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => page < totalPages && handlePageChange(page + 1)}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Create Todo Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Todo List</DialogTitle>
            <DialogDescription>Add a new todo list to track your tasks</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Enter todo list title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            />
            {workspaces.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Assign to workspace (optional)</p>
                <Select value={newWorkspace || '__none__'} onValueChange={(v) => setNewWorkspace(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                    <SelectValue placeholder="No workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No workspace</SelectItem>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                          {ws.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white rounded-lg btn-shine" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isCreating ? 'Creating...' : 'Create List'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
