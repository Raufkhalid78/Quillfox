'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { decryptNoteContent, decryptNoteTitle, encryptNoteTitle, encryptTodoTitle } from '@/lib/encrypted-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
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
  Check,
  PenLine,
  ChevronRight,
  Layers,
  TrendingUp,
  Activity,
  Home,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { format, formatDistanceToNow } from 'date-fns'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

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
      if (notesRes.ok) setNotes(await notesRes.json())
      if (todosRes.ok) setTodoListsAction(await todosRes.json())
      if (wsRes.ok) setWorkspacesAction(await wsRes.json())
    } catch {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [currentUser, setNotes, setTodoListsAction, setWorkspacesAction])

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
    if (!isLoading) decryptData()
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
    } catch { toast.error('Failed to create note') }
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
    } catch { toast.error('Failed to create todo list') }
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
    } catch { toast.error('Failed to create workspace') }
  }

  const handleOpenWsDetail = async (ws: WorkspaceData) => {
    setSelectedWs(ws)
    setWsDetailOpen(true)
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members`)
      if (res.ok) setWsMembers(await res.json())
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
        setWsMembers([...wsMembers, await res.json()])
        setInviteEmail('')
        toast.success(`Invited ${inviteEmail.trim()}`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to invite')
      }
    } catch { toast.error('Failed to invite member') }
    finally { setIsInviting(false) }
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
    } catch { toast.error('Failed to remove member') }
  }

  const recentNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)

  const recentTodos = todoLists
    .filter((t) => !t.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  if (!currentUser) return null

  const totalNotes = notes.filter((n) => !n.isArchived).length
  const totalTodos = todoLists.filter((t) => !t.isArchived).length
  const totalCompleted = todoLists.reduce((acc, t) => acc + t.items.filter((i) => i.completed).length, 0)
  const totalItems = todoLists.reduce((acc, t) => acc + t.items.length, 0)
  const overallProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-[72px] border-r border-border/60 bg-card/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shadow-lg shadow-[#059669]/20">
            <PenLine className="w-4 h-4" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col items-center gap-1 py-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-primary/10 text-primary">
                  <Home className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => selectNote('')}>
                  <FileText className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Notes</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => selectTodo('')}>
                  <ListTodo className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Todo Lists</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setPricingOpen(true)}>
                  <Crown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Upgrade</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1 py-4 border-t border-border/40">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive" onClick={logout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (visible on mobile, supplementary on desktop) */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile logo */}
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
              <PenLine className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight truncate">QuillFox</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isEncryptedSession ? (
                    <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#059669] bg-[#059669]/10 border-[#059669]/20 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">E2E</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#d97706] bg-[#d97706]/10 border-[#d97706]/20 shrink-0">
                      <ShieldAlert className="w-3 h-3" />
                      <span className="hidden sm:inline">No E2E</span>
                    </Badge>
                  )}
                </TooltipTrigger>
                <TooltipContent>{isEncryptedSession ? 'End-to-end encryption active' : 'Encryption not set up'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile theme toggle */}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#34d399] text-[10px] font-semibold">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium hidden sm:block max-w-[80px] truncate">
              {currentUser.name || currentUser.email}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6 md:space-y-8">

            {/* ── Greeting + Quick Actions ── */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <motion.div variants={fadeUp}>
                <p className="text-sm text-muted-foreground mb-1">{format(new Date(), 'EEEE, MMMM d')}</p>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {getGreeting()},{' '}
                  <span className="bg-gradient-to-r from-[#059669] to-[#0d9488] bg-clip-text text-transparent">
                    {currentUser.name?.split(' ')[0] || 'there'}
                  </span>
                </h2>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90 shadow-lg shadow-[#059669]/25 rounded-xl px-5">
                      <Plus className="w-4 h-4" />
                      <span>Create new</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New</DialogTitle>
                      <DialogDescription>What would you like to create?</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                      {/* New Note */}
                      <div className="rounded-xl border border-border/60 p-4 space-y-3 hover:border-[#059669]/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#34d399]">
                            <StickyNote className="w-4 h-4" />
                          </div>
                          <h3 className="font-medium text-sm">New Note</h3>
                        </div>
                        <div className="space-y-2">
                          <Input placeholder="Enter note title..." value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNote() } }} />
                          <Button size="sm" className="w-full bg-gradient-to-r from-[#059669] to-[#0d9488] text-white rounded-lg" onClick={handleCreateNote}>Create Note</Button>
                        </div>
                      </div>
                      {/* New Todo */}
                      <div className="rounded-xl border border-border/60 p-4 space-y-3 hover:border-[#d97706]/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#d97706]/10 text-[#d97706] dark:bg-[#d97706]/20 dark:text-[#fbbf24]">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                          <h3 className="font-medium text-sm">New Todo List</h3>
                        </div>
                        <div className="space-y-2">
                          <Input placeholder="Enter todo list title..." value={newTodoTitle} onChange={(e) => setNewTodoTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTodo() } }} />
                          <Button size="sm" className="w-full bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white rounded-lg" onClick={handleCreateTodo}>Create Todo List</Button>
                        </div>
                      </div>
                      {/* New Workspace */}
                      <div className="rounded-xl border border-border/60 p-4 space-y-3 hover:border-[#7c3aed]/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#7c3aed]/10 text-[#7c3aed] dark:bg-[#7c3aed]/20 dark:text-[#a78bfa]">
                            <FolderOpen className="w-4 h-4" />
                          </div>
                          <h3 className="font-medium text-sm">New Workspace</h3>
                        </div>
                        <div className="space-y-2">
                          <Input placeholder="Workspace title..." value={newWsTitle} onChange={(e) => setNewWsTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateWorkspace() } }} />
                          <Input placeholder="Description (optional)..." value={newWsDescription} onChange={(e) => setNewWsDescription(e.target.value)} />
                          <div className="flex gap-2">
                            {workspaceColors.map((c) => (
                              <button key={c.name} type="button" className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110" style={{ backgroundColor: c.value, borderColor: newWsColor === c.value ? (theme === 'dark' ? '#fff' : '#000') : 'transparent' }} onClick={() => setNewWsColor(c.value)} />
                            ))}
                          </div>
                          <Button size="sm" className="w-full bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white rounded-lg" onClick={handleCreateWorkspace}>Create Workspace</Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            </motion.div>

            {/* ── Bento Stats Grid ── */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: 'Notes', value: totalNotes, icon: FileText, accent: 'from-[#059669] to-[#0d9488]', bgLight: 'bg-[#059669]/5', bgDark: 'dark:bg-[#059669]/10', textColor: 'text-[#059669] dark:text-[#34d399]' },
                { label: 'Todo Lists', value: totalTodos, icon: ListTodo, accent: 'from-[#d97706] to-[#f59e0b]', bgLight: 'bg-[#d97706]/5', bgDark: 'dark:bg-[#d97706]/10', textColor: 'text-[#d97706] dark:text-[#fbbf24]' },
                { label: 'Completed', value: totalCompleted, icon: Sparkles, accent: 'from-[#e11d48] to-[#f43f5e]', bgLight: 'bg-[#e11d48]/5', bgDark: 'dark:bg-[#e11d48]/10', textColor: 'text-[#e11d48] dark:text-[#fb7185]' },
                { label: 'Progress', value: `${overallProgress}%`, icon: TrendingUp, accent: 'from-[#7c3aed] to-[#8b5cf6]', bgLight: 'bg-[#7c3aed]/5', bgDark: 'dark:bg-[#7c3aed]/10', textColor: 'text-[#7c3aed] dark:text-[#a78bfa]', isText: true },
              ].map((stat) => (
                <motion.div key={stat.label} variants={fadeUp}>
                  <div className="relative group rounded-2xl border border-border/50 p-4 md:p-5 bg-card/30 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-xl ${stat.bgLight} ${stat.bgDark}`}>
                        <stat.icon className={`w-4 h-4 ${stat.textColor}`} />
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Activity className={`w-3.5 h-3.5 ${stat.textColor}`} />
                      </div>
                    </div>
                    <p className={`text-2xl md:text-3xl font-bold tracking-tight ${stat.isText ? 'bg-gradient-to-r ' + stat.accent + ' bg-clip-text text-transparent' : ''}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                    <div className={`absolute inset-x-0 bottom-0 h-[2px] rounded-b-2xl bg-gradient-to-r ${stat.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* ── Workspaces ── */}
            {workspaces.length > 0 && (
              <motion.section initial="hidden" animate="visible" variants={stagger}>
                <motion.div variants={fadeUp} className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Workspaces</h3>
                  </div>
                </motion.div>
                <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
                  {workspaces.map((ws) => (
                    <motion.button
                      key={ws.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleOpenWsDetail(ws)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors group"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                      <span className="text-sm font-medium">{ws.title}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">{ws._count.notes + ws._count.todoLists}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </motion.div>
              </motion.section>
            )}

            {/* ── Loading State ── */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* ── Two-Column Layout: Notes + Todos ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                  {/* Recent Notes Column */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#34d399]">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-semibold">Notes</h3>
                        <Badge variant="secondary" className="text-[10px] font-normal">{totalNotes}</Badge>
                      </div>
                      {totalNotes > 4 && (
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => selectNote('')}>
                          View all <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {recentNotes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
                        <StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No notes yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Create your first note to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <AnimatePresence>
                          {recentNotes.map((note, index) => {
                            const decrypted = decryptedNotes.get(note.id)
                            return (
                              <motion.div
                                key={note.id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.06, duration: 0.3 }}
                              >
                                <button
                                  onClick={() => selectNote(note.id)}
                                  className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 transition-all duration-200 p-3.5 group"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#059669]/8 dark:bg-[#059669]/15 flex items-center justify-center shrink-0">
                                      <FileText className="w-3.5 h-3.5 text-[#059669]/70 dark:text-[#34d399]/70" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-sm font-medium line-clamp-1">{decrypted?.title || note.title}</p>
                                        {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-1">{decrypted?.preview || 'Empty note...'}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/50">
                                      <Clock className="w-3 h-3" />
                                      <span className="text-[10px]">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                                    </div>
                                  </div>
                                </button>
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>

                  {/* Recent Todos Column */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#d97706]/10 text-[#d97706] dark:bg-[#d97706]/20 dark:text-[#fbbf24]">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-semibold">Todo Lists</h3>
                        <Badge variant="secondary" className="text-[10px] font-normal">{totalTodos}</Badge>
                      </div>
                      {totalTodos > 4 && (
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => selectTodo('')}>
                          View all <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {recentTodos.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
                        <CheckSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No todo lists yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Create your first list to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <AnimatePresence>
                          {recentTodos.map((todo, index) => {
                            const completed = todo.items.filter((i) => i.completed).length
                            const total = todo.items.length
                            const progress = total > 0 ? (completed / total) * 100 : 0
                            const decryptedTitle = decryptedTodos.get(todo.id) || todo.title
                            return (
                              <motion.div
                                key={todo.id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.06, duration: 0.3 }}
                              >
                                <button
                                  onClick={() => selectTodo(todo.id)}
                                  className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 transition-all duration-200 p-3.5 group"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#d97706]/8 dark:bg-[#d97706]/15 flex items-center justify-center shrink-0">
                                      <CheckSquare className="w-3.5 h-3.5 text-[#d97706]/70 dark:text-[#fbbf24]/70" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <p className="text-sm font-medium line-clamp-1">{decryptedTitle}</p>
                                        {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                          <motion.div
                                            className="h-full rounded-full bg-gradient-to-r from-[#d97706] to-[#f59e0b]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.6, delay: index * 0.06 }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{completed}/{total}</span>
                                        <span className="text-[10px] font-semibold text-[#d97706] dark:text-[#fbbf24] tabular-nums">{Math.round(progress)}%</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/50">
                                      <Clock className="w-3 h-3" />
                                      <span className="text-[10px]">{formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}</span>
                                    </div>
                                  </div>
                                </button>
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── Workspace Detail Dialog ── */}
      <Dialog open={wsDetailOpen} onOpenChange={setWsDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedWs?.color }} />
              {selectedWs?.title || 'Workspace'}
            </DialogTitle>
            <DialogDescription>{selectedWs?.description || 'No description'}</DialogDescription>
          </DialogHeader>
          {selectedWs && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Notes', value: selectedWs._count.notes },
                  { label: 'Todo Lists', value: selectedWs._count.todoLists },
                  { label: 'Total', value: selectedWs._count.notes + selectedWs._count.todoLists },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/40 p-3 text-center bg-card/30">
                    <p className="text-xl font-bold bg-gradient-to-r from-[#059669] to-[#0d9488] bg-clip-text text-transparent">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center text-xs text-muted-foreground gap-2">
                <Clock className="w-3 h-3" />
                Created {formatDistanceToNow(new Date(selectedWs.createdAt), { addSuffix: true })}
              </div>
              {/* Invite */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Invite Members</Label>
                <div className="flex gap-2">
                  <Input placeholder="Email address..." value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInviteMember() } }} className="flex-1 h-9" />
                  <Button size="sm" className="bg-gradient-to-r from-[#059669] to-[#0d9488] text-white h-9 rounded-lg" onClick={handleInviteMember} disabled={isInviting || !inviteEmail.trim()}>
                    {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {/* Members */}
              {wsMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Members ({wsMembers.length})</Label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {wsMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px] bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#34d399]">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{member.user.name || member.user.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-[9px]">
                          {member.role === 'owner' && <Crown className="w-2 h-2 mr-0.5" />}
                          {member.role}
                        </Badge>
                        {member.role !== 'owner' && currentUser?.id !== member.userId && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(member.id)}>
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => {
                  setWsDetailOpen(false)
                  const wsNotes = notes.filter((n) => n.workspaceId === selectedWs.id)
                  if (wsNotes.length > 0) selectNote(wsNotes[0].id)
                  else toast.info('No notes in this workspace yet')
                }}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Notes
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => {
                  setWsDetailOpen(false)
                  const wsTodos = todoLists.filter((t) => t.workspaceId === selectedWs.id)
                  if (wsTodos.length > 0) selectTodo(wsTodos[0].id)
                  else toast.info('No todo lists in this workspace yet')
                }}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Todos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Pricing Dialog ── */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#d97706]" />
              Choose Your Plan
            </DialogTitle>
            <DialogDescription>Unlock the full power of QuillFox</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {/* Free Plan */}
            <div className="rounded-2xl border border-border/50 p-5 bg-card/30">
              <h4 className="font-semibold text-sm mb-0.5">Free</h4>
              <p className="text-[10px] text-muted-foreground mb-3">For individuals</p>
              <p className="text-2xl font-bold mb-4">$0<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Unlimited local notes</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Unlimited todo lists</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Sync up to 2 devices</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Share with 1 person</div>
              </div>
              <Button variant="outline" className="w-full mt-4 rounded-xl" disabled>Current Plan</Button>
            </div>
            {/* Premium Plan */}
            <div className="rounded-2xl border-2 border-[#d97706]/40 p-5 bg-gradient-to-b from-[#d97706]/5 to-transparent relative overflow-hidden">
              <Badge className="absolute top-3 right-3 text-[9px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white border-0">Popular</Badge>
              <h4 className="font-semibold text-sm mb-0.5">Premium</h4>
              <p className="text-[10px] text-muted-foreground mb-3">For power users</p>
              <p className="text-2xl font-bold mb-4">$9<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Everything in Free</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Unlimited devices</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Unlimited collaborators</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Version history</div>
                <div className="flex items-center gap-2"><Check className="w-3 h-3 text-[#059669]" /> Priority support</div>
              </div>
              <Button className="w-full mt-4 rounded-xl bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white hover:from-[#d97706]/90 hover:to-[#f59e0b]/90">Upgrade Now</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
