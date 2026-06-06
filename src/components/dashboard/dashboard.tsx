'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { decryptNoteContent, decryptNoteTitle, decryptTodoTitle, encryptNoteTitle, encryptTodoTitle } from '@/lib/encrypted-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  StickyNote,
  CheckSquare,
  Plus,
  LogOut,
  Moon,
  Sun,
  LayoutGrid,
  FolderOpen,
  Loader2,
  Eye,
  Clock,
  FileText,
  ListTodo,
  Users,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Mail,
  Crown,
  Trash2,
  Pin,
  Archive,
  MoreVertical,
  Star,
  Zap,
  Check,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow } from 'date-fns'

export function Dashboard() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const setView = useAppStore((s) => s.setView)
  const selectNote = useAppStore((s) => s.selectNote)
  const selectTodo = useAppStore((s) => s.selectTodo)
  const logout = useAppStore((s) => s.logout)
  const addNote = useAppStore((s) => s.addNote)
  const addTodoList = useAppStore((s) => s.addTodoList)
  const setNotes = useAppStore((s) => s.setNotes)
  const setTodoListsAction = useAppStore((s) => s.setTodoLists)
  const setWorkspacesAction = useAppStore((s) => s.setWorkspaces)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newWsTitle, setNewWsTitle] = useState('')
  const [newWsDescription, setNewWsDescription] = useState('')
  const [newWsColor, setNewWsColor] = useState('#059669')
  const [selectedWs, setSelectedWs] = useState<WorkspaceData | null>(null)
  const [wsDetailOpen, setWsDetailOpen] = useState(false)
  const [wsMembers, setWsMembers] = useState<Array<{ id: string; userId: string; role: string; joinedAt: string; user: { id: string; name: string | null; email: string; image: string | null } }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  // Decrypted preview data
  const [decryptedNotes, setDecryptedNotes] = useState<Map<string, { title: string; preview: string }>>(new Map())
  const [decryptedTodos, setDecryptedTodos] = useState<Map<string, string>>(new Map())

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const [notesRes, todosRes, wsRes] = await Promise.all([
        fetch(`/api/notes?userId=${currentUser.id}`),
        fetch(`/api/todos?userId=${currentUser.id}`),
        fetch(`/api/workspaces?userId=${currentUser.id}`),
      ])
      if (notesRes.ok) {
        const notesData = await notesRes.json()
        setNotes(notesData)
      }
      if (todosRes.ok) {
        const todosData = await todosRes.json()
        setTodoListsAction(todosData)
      }
      if (wsRes.ok) {
        const wsData = await wsRes.json()
        setWorkspacesAction(wsData)
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentUser, setNotes, setTodoListsAction, setWorkspacesAction])

  // Decrypt previews for notes and todos
  useEffect(() => {
    const decryptData = async () => {
      const noteMap = new Map<string, { title: string; preview: string }>()
      const todoMap = new Map<string, string>()

      await Promise.all(
        notes.map(async (n) => {
          const title = await decryptNoteTitle(n.title)
          const preview = await decryptNoteContent(n.content.substring(0, 120))
          noteMap.set(n.id, { title, preview: preview || 'Empty note...' })
        })
      )

      await Promise.all(
        todoLists.map(async (t) => {
          const title = await decryptNoteTitle(t.title)
          todoMap.set(t.id, title)
        })
      )

      setDecryptedNotes(noteMap)
      setDecryptedTodos(todoMap)
    }
    if (!isLoading) {
      decryptData()
    }
  }, [notes, todoLists, isLoading])

  const handleCreateNote = async () => {
    if (!currentUser) return
    const plainTitle = newNoteTitle.trim() || 'Untitled Note'
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, authorId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addNote(data)
        setDialogOpen(false)
        setNewNoteTitle('')
        selectNote(data.id)
        toast.success('Note created')
      }
    } catch {
      toast.error('Failed to create note')
    }
  }

  const handleCreateTodo = async () => {
    if (!currentUser) return
    const plainTitle = newTodoTitle.trim() || 'Untitled Todo List'
    try {
      const encryptedTitle = await encryptTodoTitle(plainTitle)
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, authorId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addTodoList(data)
        setDialogOpen(false)
        setNewTodoTitle('')
        selectTodo(data.id)
        toast.success('Todo list created')
      }
    } catch {
      toast.error('Failed to create todo list')
    }
  }

  const workspaceColors = [
    { name: 'emerald', value: '#059669' },
    { name: 'teal', value: '#0d9488' },
    { name: 'amber', value: '#d97706' },
    { name: 'rose', value: '#e11d48' },
    { name: 'violet', value: '#7c3aed' },
    { name: 'blue', value: '#2563eb' },
  ]

  const handleCreateWorkspace = async () => {
    if (!currentUser) return
    const title = newWsTitle.trim() || 'Untitled Workspace'
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: newWsDescription.trim() || null, color: newWsColor, ownerId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setWorkspacesAction([...workspaces, data])
        setDialogOpen(false)
        setNewWsTitle('')
        setNewWsDescription('')
        setNewWsColor('#059669')
        toast.success('Workspace created')
      }
    } catch {
      toast.error('Failed to create workspace')
    }
  }

  const handleOpenWsDetail = async (ws: WorkspaceData) => {
    setSelectedWs(ws)
    setWsDetailOpen(true)
    // Fetch workspace members
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members`)
      if (res.ok) {
        const data = await res.json()
        setWsMembers(data)
      }
    } catch { /* ignore */ }
  }

  const handleInviteMember = async () => {
    if (!selectedWs || !inviteEmail.trim()) return
    setIsInviting(true)
    try {
      const res = await fetch(`/api/workspaces/${selectedWs.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'member' }),
      })
      if (res.ok) {
        const member = await res.json()
        setWsMembers([...wsMembers, member])
        setInviteEmail('')
        toast.success(`Invited ${inviteEmail.trim()}`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to invite')
      }
    } catch {
      toast.error('Failed to invite member')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedWs) return
    try {
      const res = await fetch(`/api/workspaces/${selectedWs.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      if (res.ok) {
        setWsMembers(wsMembers.filter((m) => m.id !== memberId))
        toast.success('Member removed')
      }
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const recentNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  const recentTodos = todoLists
    .filter((t) => !t.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!currentUser) {
    setView('auth')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/40 dark:from-emerald-950/10 dark:via-background dark:to-teal-950/10">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <StickyNote className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight truncate">QuillFox</h1>
            {/* Encryption status badge */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isEncryptedSession ? (
                    <Badge variant="secondary" className="gap-1 text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">E2E</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 shrink-0">
                      <ShieldAlert className="w-3 h-3" />
                      <span className="hidden sm:inline">No E2E</span>
                    </Badge>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {isEncryptedSession ? 'End-to-end encryption active' : 'Encryption not set up'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Premium Upgrade */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                    onClick={() => setPricingOpen(true)}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs font-medium">Upgrade</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upgrade to QuillFox Premium</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>

            <span className="text-sm font-medium hidden sm:inline max-w-[100px] truncate">
              {currentUser.name || currentUser.email}
            </span>

            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Notes', value: notes.filter((n) => !n.isArchived).length, icon: FileText, color: 'text-emerald-600' },
            { label: 'Todo Lists', value: todoLists.filter((t) => !t.isArchived).length, icon: ListTodo, color: 'text-teal-600' },
            { label: 'Workspaces', value: workspaces.length, icon: Users, color: 'text-amber-600' },
            { label: 'Completed', value: todoLists.reduce((acc, t) => acc + t.items.filter((i) => i.completed).length, 0), icon: Sparkles, color: 'text-violet-600' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Workspaces */}
        {workspaces.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Workspaces</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <motion.div
                  key={ws.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenWsDetail(ws)}
                >
                  <Card className="overflow-hidden border-border/50 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="h-2" style={{ backgroundColor: ws.color }} />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{ws.title}</CardTitle>
                      {ws.description && (
                        <p className="text-xs text-muted-foreground">{ws.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {ws._count.notes} notes
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ws._count.todoLists} todos
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <>
            {/* Recent Notes */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">Recent Notes</h2>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {notes.filter((n) => !n.isArchived).length} total
                </Badge>
              </div>
              {recentNotes.length === 0 ? (
                <Card className="border-dashed border-border/50">
                  <CardContent className="py-12 text-center">
                    <StickyNote className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No notes yet. Create your first note!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {recentNotes.map((note, index) => {
                      const decrypted = decryptedNotes.get(note.id)
                      return (
                        <motion.div
                          key={note.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectNote(note.id)}
                        >
                          <Card className="cursor-pointer border-border/50 hover:shadow-md transition-shadow h-full">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base line-clamp-1">
                                  {decrypted?.title || note.title}
                                </CardTitle>
                                {isEncryptedSession && (
                                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {decrypted?.preview || 'Empty note...'}
                              </p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Recent Todo Lists */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-teal-600" />
                  <h2 className="text-lg font-semibold">Recent Todo Lists</h2>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {todoLists.filter((t) => !t.isArchived).length} total
                </Badge>
              </div>
              {recentTodos.length === 0 ? (
                <Card className="border-dashed border-border/50">
                  <CardContent className="py-12 text-center">
                    <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No todo lists yet. Create your first list!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {recentTodos.map((todo, index) => {
                      const completed = todo.items.filter((i) => i.completed).length
                      const total = todo.items.length
                      const progress = total > 0 ? (completed / total) * 100 : 0
                      const decryptedTitle = decryptedTodos.get(todo.id) || todo.title
                      return (
                        <motion.div
                          key={todo.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectTodo(todo.id)}
                        >
                          <Card className="cursor-pointer border-border/50 hover:shadow-md transition-shadow h-full">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base line-clamp-1">{decryptedTitle}</CardTitle>
                                {isEncryptedSession && (
                                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-muted-foreground">
                                  {completed}/{total} completed
                                </span>
                                <span className="text-emerald-600 font-medium">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <motion.div
                                  className="bg-emerald-600 h-2 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.05 }}
                                />
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground mt-3">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* FAB - Create New */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <motion.div
            className="fixed bottom-20 right-6 z-50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </motion.div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New</DialogTitle>
            <DialogDescription>What would you like to create?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* New Note */}
            <Card className="cursor-pointer border-border/50 hover:border-emerald-300 hover:shadow-md transition-all" onClick={() => { /* Focus note input */ }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <StickyNote className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium">New Note</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-note-title">Title</Label>
                  <Input
                    id="new-note-title"
                    placeholder="Enter note title..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateNote()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateNote()
                    }}
                  >
                    Create Note
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* New Todo */}
            <Card className="cursor-pointer border-border/50 hover:border-teal-300 hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium">New Todo List</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-todo-title">Title</Label>
                  <Input
                    id="new-todo-title"
                    placeholder="Enter todo list title..."
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateTodo()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateTodo()
                    }}
                  >
                    Create Todo List
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* New Workspace */}
            <Card className="cursor-pointer border-border/50 hover:border-emerald-300 hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium">New Workspace</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-ws-title">Title</Label>
                  <Input
                    id="new-ws-title"
                    placeholder="Enter workspace title..."
                    value={newWsTitle}
                    onChange={(e) => setNewWsTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label htmlFor="new-ws-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="new-ws-desc"
                    placeholder="Brief description..."
                    value={newWsDescription}
                    onChange={(e) => setNewWsDescription(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <div className="flex gap-2">
                      {workspaceColors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                          style={{
                            backgroundColor: c.value,
                            borderColor: newWsColor === c.value ? '#171717' : 'transparent',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setNewWsColor(c.value)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateWorkspace()
                    }}
                  >
                    Create Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace Detail Dialog */}
      <Dialog open={wsDetailOpen} onOpenChange={setWsDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedWs?.color }} />
              {selectedWs?.title || 'Workspace'}
            </DialogTitle>
            <DialogDescription>{selectedWs?.description || 'No description'}</DialogDescription>
          </DialogHeader>
          {selectedWs && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedWs._count.notes}</p>
                    <p className="text-xs text-muted-foreground">Notes</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-teal-600">{selectedWs._count.todoLists}</p>
                    <p className="text-xs text-muted-foreground">Todo Lists</p>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{selectedWs._count.notes + selectedWs._count.todoLists}</p>
                    <p className="text-xs text-muted-foreground">Total Items</p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Created {formatDistanceToNow(new Date(selectedWs.createdAt), { addSuffix: true })}
              </div>
              {/* Invite Member */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  Invite Members
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleInviteMember() }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleInviteMember}
                    disabled={isInviting || !inviteEmail.trim()}
                  >
                    {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Members List */}
              {wsMembers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Members ({wsMembers.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {wsMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.user.name || member.user.email}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-[10px]">
                            {member.role === 'owner' && <Crown className="w-2.5 h-2.5 mr-0.5" />}
                            {member.role}
                          </Badge>
                          {member.role !== 'owner' && currentUser?.id !== member.userId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setWsDetailOpen(false)
                    const wsNotes = notes.filter((n) => n.workspaceId === selectedWs.id)
                    if (wsNotes.length > 0) {
                      selectNote(wsNotes[0].id)
                    } else {
                      toast.info('No notes in this workspace yet')
                    }
                  }}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View Notes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setWsDetailOpen(false)
                    const wsTodos = todoLists.filter((t) => t.workspaceId === selectedWs.id)
                    if (wsTodos.length > 0) {
                      selectTodo(wsTodos[0].id)
                    } else {
                      toast.info('No todo lists in this workspace yet')
                    }
                  }}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View Todos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Pricing Dialog */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Choose Your Plan
            </DialogTitle>
            <DialogDescription>Unlock the full power of QuillFox</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Free Plan */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Free</CardTitle>
                <p className="text-xs text-muted-foreground">For individuals</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Unlimited local notes</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Unlimited todo lists</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Sync up to 2 devices</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Share with 1 person</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> End-to-end encryption</div>
                </div>
                <Button variant="outline" size="sm" className="w-full" disabled>Current Plan</Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-amber-300 dark:border-amber-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">POPULAR</div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500" />
                  Premium
                </CardTitle>
                <p className="text-xs text-muted-foreground">For teams & power users</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">$2.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Everything in Free</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Unlimited collaborators</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Unlimited device sync</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Version history</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Custom themes</div>
                  <div className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Ad-free experience</div>
                </div>
                <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => toast.info('Premium subscription coming soon!')}>
                  Upgrade Now
                </Button>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Annual plan: $29.99/year — Save 17%
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
