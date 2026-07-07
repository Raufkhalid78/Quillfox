'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { decryptNoteContent, decryptNoteTitle, decryptTodoTitle, encryptNoteTitle, encryptTodoTitle, decryptWorkspaceTitle, decryptWorkspaceDescription } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { TodosList } from '@/components/todos/todos-list'
import { WorkspacesView } from '@/components/workspaces/workspaces-view'
import { MultiInviteDialog } from '@/components/workspaces/multi-invite-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/shared/app-sidebar'
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
  FileText,
  ListTodo,
  Sparkles,
  TrendingUp,
  Activity,
  Crown,
  Layers,
  Clock,
  Trash2,
  ChevronRight,
  Mail,
} from 'lucide-react'
import { DashboardHeader } from './dashboard-header'
import { DashboardQuickActions } from './dashboard-quick-actions'
import { DashboardRecentItems } from './dashboard-recent-items'
import { useTheme } from 'next-themes'
import { format, formatDistanceToNow } from 'date-fns'
import { DashboardAnalytics } from './dashboard-analytics'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
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
  const userTier = useAppStore((s) => s.userTier)

  const [isLoading, setIsLoading] = useState(true)
  const [selectedWs, setSelectedWs] = useState<WorkspaceData | null>(null)
  const [wsDetailOpen, setWsDetailOpen] = useState(false)
  const [wsMembers, setWsMembers] = useState<Array<{ id: string; userId: string; role: string; joinedAt: string; user: { id: string; name: string | null; email: string; image: string | null } }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [quickNoteTitle, setQuickNoteTitle] = useState('')
  const [quickTodoTitle, setQuickTodoTitle] = useState('')
  const [isQuickCreating, setIsQuickCreating] = useState(false)

  const [decryptedNotes, setDecryptedNotes] = useState<Map<string, { title: string; preview: string; updatedAt: string }>>(new Map())
  const [decryptedTodos, setDecryptedTodos] = useState<Map<string, { title: string; updatedAt: string }>>(new Map())
  const decryptedNotesRef = useRef<Map<string, { title: string; preview: string; updatedAt: string }>>(new Map())
  const decryptedTodosRef = useRef<Map<string, { title: string; updatedAt: string }>>(new Map())

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      // 1. Fetch non-archived notes
      const { data: notesData, error: notesErr } = await supabase
        .from('notes')
        .select('*')
        .eq('is_archived', false)

      // 2. Fetch non-archived todo lists and their items
      const { data: todosData, error: todosErr } = await supabase
        .from('todo_lists')
        .select('*, todo_items(*)')
        .eq('is_archived', false)

      // 3. Fetch owned workspaces
      const { data: ownedWorkspaces, error: ownedErr } = await supabase
        .from('workspaces')
        .select('*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived)')
        .eq('owner_id', currentUser.id)

      // 4. Fetch workspaces user is a member of
      const { data: memberOf, error: memberErr } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived))')
        .eq('user_id', currentUser.id)
        .not('workspaces.owner_id', 'eq', currentUser.id)

      // 5. Fetch user profile for tier and collabs
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tier, extra_collaborators')
        .eq('id', currentUser.id)
        .single()

      if (profileData) {
        const t = profileData.tier;
        useAppStore.getState().setTier(t === 'ultra' || t === 'ultra_premium' ? 'ultra' : t === 'premium' ? 'premium' : 'free');
        useAppStore.getState().setActiveCollaborators(profileData.extra_collaborators || 0);
      }

      if (notesErr || todosErr || ownedErr || memberErr) {
        toast.error('Failed to load data')
        return
      }

      // Format notes
      const formattedNotes = (notesData || []).map((n: any) => ({
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
      setNotes(formattedNotes)

      // Format todos
      const formattedTodos = (todosData || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        content: '',
        workspaceId: t.workspace_id,
        authorId: t.author_id,
        isPinned: t.is_pinned,
        isArchived: t.is_archived,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        items: (t.todo_items || [])
          .sort((a: any, b: any) => a.order - b.order)
          .map((i: any) => ({
            id: i.id,
            title: i.title,
            completed: i.completed,
            order: i.order,
            todoListId: i.todo_list_id,
            completedAt: i.completed_at,
          })),
      }))
      setTodoListsAction(formattedTodos)

      // Format workspaces
      const memberWorkspaces = (memberOf || [])
        .map((m: any) => m.workspaces)
        .filter(Boolean)
      const allWs = [...(ownedWorkspaces || []), ...memberWorkspaces]
      const formattedWorkspaces = await Promise.all(allWs.map(async (ws: any) => {
        const activeNotesCount = (ws.notes || []).filter((n: any) => !n.is_archived).length
        const activeTodosCount = (ws.todo_lists || []).filter((t: any) => !t.is_archived).length
        
        return {
          id: ws.id,
          title: await decryptWorkspaceTitle(ws.title, ws.id),
          description: await decryptWorkspaceDescription(ws.description, ws.id),
          color: ws.color,
          icon: ws.icon,
          ownerId: ws.owner_id,
          createdAt: ws.created_at,
          updatedAt: ws.updated_at,
          _count: {
            notes: activeNotesCount,
            todoLists: activeTodosCount,
            members: (ws.workspace_members || []).length || 1,
          },
        }
      }))
      formattedWorkspaces.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      setWorkspacesAction(formattedWorkspaces)

    } catch {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const globalSyncTrigger = useAppStore((s) => s.globalSyncTrigger)

  useEffect(() => {
    fetchData()
  }, [currentUser, globalSyncTrigger, setNotes, setTodoListsAction, setWorkspacesAction])

  useEffect(() => {
    const decryptData = async () => {
      const currentNotesMap = decryptedNotesRef.current
      const currentTodosMap = decryptedTodosRef.current
      
      const noteMap = new Map(currentNotesMap)
      const todoMap = new Map(currentTodosMap)
      
      let notesChanged = false
      let todosChanged = false

      await Promise.all(
        notes.map(async (n) => {
          const existing = noteMap.get(n.id)
          if (existing && existing.updatedAt === n.updatedAt) return
          const title = await decryptNoteTitle(n.title, n.workspaceId)
          const decryptedContent = await decryptNoteContent(n.content, n.workspaceId)
          const preview = decryptedContent.substring(0, 120)
          noteMap.set(n.id, { title, preview: preview || 'Empty note...', updatedAt: n.updatedAt })
          notesChanged = true
        })
      )
      await Promise.all(
        todoLists.map(async (t) => {
          const existing = todoMap.get(t.id)
          if (existing && existing.updatedAt === t.updatedAt) return
          const title = await decryptTodoTitle(t.title, t.workspaceId)
          todoMap.set(t.id, { title, updatedAt: t.updatedAt })
          todosChanged = true
        })
      )
      
      if (notesChanged) {
        decryptedNotesRef.current = noteMap
        setDecryptedNotes(noteMap)
      }
      if (todosChanged) {
        decryptedTodosRef.current = todoMap
        setDecryptedTodos(todoMap)
      }
    }
    if (!isLoading) decryptData()
  }, [notes, todoLists, isLoading])

  const handleQuickCreateNote = async () => {
    if (!currentUser || !selectedWs) return
    const plainTitle = quickNoteTitle.trim() || 'Untitled Note'
    setIsQuickCreating(true)
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle, selectedWs.id)
      const noteId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
      
      const { data, error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          title: encryptedTitle,
          content: '',
          author_id: currentUser.id,
          workspace_id: selectedWs.id,
        })
        .select()
        .single()

      if (error) throw error

      const formatted = {
        id: data.id,
        title: data.title,
        content: data.content,
        workspaceId: data.workspace_id,
        authorId: data.author_id,
        isPinned: data.is_pinned,
        isArchived: data.is_archived,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }

      addNote(formatted)
      logActivity('note_create')
      setQuickNoteTitle('')
      toast.success('Note added to workspace')
    } catch { 
      toast.error('Failed to create note') 
    } finally { 
      setIsQuickCreating(false) 
    }
  }

  const handleQuickCreateTodo = async () => {
    if (!currentUser || !selectedWs) return
    const plainTitle = quickTodoTitle.trim() || 'Untitled Todo List'
    setIsQuickCreating(true)
    try {
      const encryptedTitle = await encryptTodoTitle(plainTitle, selectedWs.id)
      const listId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

      const { data, error } = await supabase
        .from('todo_lists')
        .insert({
          id: listId,
          title: encryptedTitle,
          author_id: currentUser.id,
          workspace_id: selectedWs.id,
        })
        .select()
        .single()

      if (error) throw error

      const formatted = {
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
      setQuickTodoTitle('')
      toast.success('Todo list added to workspace')
    } catch { 
      toast.error('Failed to create todo list') 
    } finally { 
      setIsQuickCreating(false) 
    }
  }

  const handleOpenWsDetail = async (ws: WorkspaceData) => {
    setSelectedWs(ws)
    setWsDetailOpen(true)
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('id, user_id, role, joined_at, profiles(id, name, email, image)')
        .eq('workspace_id', ws.id)

      if (error) throw error

      const formatted = data.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        user: {
          id: m.profiles.id,
          name: m.profiles.name,
          email: m.profiles.email,
          image: m.profiles.image,
        },
      }))

      setWsMembers(formatted)
    } catch { /* ignore */ }
  }

  const handleInviteMember = async () => {
    if (!selectedWs || !inviteEmail.trim()) return

    // Enforce collaborator limit
    const membersCount = wsMembers.filter((m) => m.role === 'member').length
    const extraCollabs = useAppStore.getState().extraCollaborators
    
    let maxCollabs = 2
    if (userTier === 'premium') maxCollabs = 15
    if (userTier === 'ultra') maxCollabs = 35
    maxCollabs += extraCollabs

    if (membersCount >= maxCollabs) {
      toast.error(`Limit reached: Maximum ${maxCollabs} collaborators allowed. Please upgrade or buy an add-on.`)
      return
    }

    setIsInviting(true)
    try {
      const { data: profileData, error: profileErr } = await supabase
        .rpc('get_profile_by_email', { search_email: inviteEmail.trim().toLowerCase() })
      
      const profile = profileData && profileData.length > 0 ? profileData[0] : null

      if (profileErr || !profile) {
        toast.error('User with this email not found')
        return
      }

      const alreadyMember = wsMembers.some((m) => m.userId === profile.id)
      if (alreadyMember) {
        toast.error('User is already a member of this workspace')
        return
      }

      let encryptedWorkspaceKey: string | null = null
      
      const isEncryptedSession = useAppStore.getState().isEncryptedSession
      if (isEncryptedSession) {
        if (!profile.public_rsa_key) {
          toast.error("User's encryption keys are missing. They may need to sign in again.")
          setIsInviting(false)
          return
        }
        
        const wsKey = useAppStore.getState().workspaceKeys[selectedWs.id]
        if (!wsKey) {
          toast.error("Workspace key not found.")
          setIsInviting(false)
          return
        }

        const { exportKeyToString, encryptWithPublicKey } = await import('@/lib/e2ee')
        const rawKeyStr = await exportKeyToString(wsKey)
        encryptedWorkspaceKey = await encryptWithPublicKey(rawKeyStr, profile.public_rsa_key)
      }

      const memberId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
      const { data: newMember, error: insertErr } = await supabase
        .from('workspace_members')
        .insert({
          id: memberId,
          workspace_id: selectedWs.id,
          user_id: profile.id,
          role: 'member',
          encrypted_workspace_key: encryptedWorkspaceKey
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      const formatted = {
        id: newMember.id,
        userId: newMember.user_id,
        role: newMember.role,
        joinedAt: newMember.joined_at,
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.image,
        },
      }

      setWsMembers([...wsMembers, formatted])
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, members: w._count.members + 1 } }
          : w
      ))
      setInviteEmail('')
      toast.success(`Invited ${inviteEmail.trim()}`)
    } catch { 
      toast.error('Failed to invite member') 
    } finally { 
      setIsInviting(false) 
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedWs) return
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId)
      
      if (error) throw error

      setWsMembers(wsMembers.filter((m) => m.id !== memberId))
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, members: Math.max(1, w._count.members - 1) } }
          : w
      ))
      toast.success('Member removed')
    } catch { 
      toast.error('Failed to remove member') 
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedWs) return
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', selectedWs.id)

      if (error) throw error

      setWorkspacesAction(workspaces.filter((w) => w.id !== selectedWs.id))
      setWsDetailOpen(false)
      setSelectedWs(null)
      toast.success('Workspace deleted')
    } catch { 
      toast.error('Failed to delete workspace') 
    }
  }

  const recentNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    .slice(0, 4)

  const recentTodos = todoLists
    .filter((t) => !t.isArchived)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
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

  const { theme, setTheme } = useTheme()

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
    <div className="min-h-screen flex bg-gradient-mesh-dash noise-overlay">
      <AppSidebar activeView="dashboard" onUpgradeClick={() => setView('pricing')} />

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (visible on mobile, supplementary on desktop) */}
        <DashboardHeader
          isEncryptedSession={isEncryptedSession}
          theme={theme}
          setTheme={setTheme}
          currentUser={currentUser!}
          userTier={userTier}
          setView={setView}
          logout={logout}
        />

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
                <DashboardQuickActions
                  currentUser={currentUser}
                  workspaces={workspaces}
                  userTier={userTier}
                  notes={notes}
                  todoLists={todoLists}
                  theme={theme}
                  addNote={addNote}
                  addTodoList={addTodoList}
                  setWorkspacesAction={setWorkspacesAction}
                  selectNote={selectNote}
                  selectTodo={selectTodo}
                />
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
                  <div className="relative group rounded-2xl border border-border/50 p-4 md:p-5 glass-card card-lift inner-glow overflow-hidden">
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

            {/* ── Productivity Analytics ── */}
            <motion.section initial="hidden" animate="visible" variants={fadeUp} className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Workspace Analytics</h3>
              </div>
              <DashboardAnalytics />
            </motion.section>

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
                      className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card card-lift inner-glow group"
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

                <DashboardRecentItems
                  totalNotes={totalNotes}
                  totalTodos={totalTodos}
                  recentNotes={recentNotes}
                  recentTodos={recentTodos}
                  decryptedNotes={decryptedNotes}
                  decryptedTodos={decryptedTodos}
                  setView={setView}
                  selectNote={selectNote}
                  selectTodo={selectTodo}
                  isEncryptedSession={isEncryptedSession}
                />
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
                  <div key={item.label} className="rounded-xl glass-card p-3 text-center inner-glow">
                    <p className="text-xl font-bold bg-gradient-to-r from-[#059669] to-[#0d9488] bg-clip-text text-transparent">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center text-xs text-muted-foreground gap-2">
                <Clock className="w-3 h-3" />
                Created {formatDistanceToNow(new Date(selectedWs.createdAt), { addSuffix: true })}
              </div>
              {/* Quick Create */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Plus className="w-3 h-3" /> Quick Add
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg glass-card p-2.5 space-y-2 inner-glow">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3 text-[#059669]" />
                      <span>New Note</span>
                    </div>
                    <Input
                      placeholder="Note title..."
                      value={quickNoteTitle}
                      onChange={(e) => setQuickNoteTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateNote() } }}
                      className="h-8 text-xs rounded-md"
                    />
                    <Button size="sm" className="w-full h-7 text-[11px] bg-gradient-to-r from-[#059669] to-[#0d9488] text-white rounded-md" onClick={handleQuickCreateNote} disabled={isQuickCreating}>
                      {isQuickCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-0.5" />} Add
                    </Button>
                  </div>
                  <div className="rounded-lg glass-card p-2.5 space-y-2 inner-glow">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckSquare className="w-3 h-3 text-[#d97706]" />
                      <span>New Todo</span>
                    </div>
                    <Input
                      placeholder="Todo title..."
                      value={quickTodoTitle}
                      onChange={(e) => setQuickTodoTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateTodo() } }}
                      className="h-8 text-xs rounded-md"
                    />
                    <Button size="sm" className="w-full h-7 text-[11px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white rounded-md" onClick={handleQuickCreateTodo} disabled={isQuickCreating}>
                      {isQuickCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-0.5" />} Add
                    </Button>
                  </div>
                </div>
              </div>
              {/* Invite */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Invite Members</Label>
                <MultiInviteDialog>
                  <Button size="sm" className="bg-gradient-to-r from-[#059669] to-[#0d9488] text-white h-9 rounded-lg w-full">
                    Invite Members
                  </Button>
                </MultiInviteDialog>
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
              {/* Delete Workspace */}
              <div className="pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-9 text-xs gap-1.5"
                  onClick={handleDeleteWorkspace}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Workspace
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  )
}
