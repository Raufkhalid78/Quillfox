'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { encryptWorkspaceTitle, decryptWorkspaceTitle, encryptWorkspaceDescription, decryptWorkspaceDescription, encryptNoteTitle, encryptTodoTitle } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Layers, ShieldCheck, Users, PenLine, LogOut, Sun, Moon,
  FileText, CheckSquare, Loader2, UserPlus, Mail, Trash2, ChevronRight, Pencil,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { format, formatDistanceToNow } from 'date-fns'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

const workspaceColors = [
  { name: 'emerald', value: '#059669' },
  { name: 'teal', value: '#0d9488' },
  { name: 'amber', value: '#d97706' },
  { name: 'rose', value: '#e11d48' },
  { name: 'violet', value: '#7c3aed' },
  { name: 'blue', value: '#2563eb' },
]

export function WorkspacesView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const workspaces = useAppStore((s) => s.workspaces)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const setWorkspacesAction = useAppStore((s) => s.setWorkspaces)
  const addNote = useAppStore((s) => s.addNote)
  const addTodoList = useAppStore((s) => s.addTodoList)
  const setNotes = useAppStore((s) => s.setNotes)
  const setTodoLists = useAppStore((s) => s.setTodoLists)
  const selectNote = useAppStore((s) => s.selectNote)
  const selectTodo = useAppStore((s) => s.selectTodo)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const userTier = useAppStore((s) => s.userTier)

  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState('#059669')
  const [isCreating, setIsCreating] = useState(false)

  const [selectedWs, setSelectedWs] = useState<WorkspaceData | null>(null)
  const [wsDetailOpen, setWsDetailOpen] = useState(false)
  const [wsMembers, setWsMembers] = useState<Array<{ id: string; userId: string; role: string; joinedAt: string; user: { id: string; name: string | null; email: string; image: string | null } }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [quickNoteTitle, setQuickNoteTitle] = useState('')
  const [quickTodoTitle, setQuickTodoTitle] = useState('')
  const [isQuickCreating, setIsQuickCreating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string, name: string } | null>(null)

  const { theme, setTheme } = useTheme()

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      // Fetch workspaces where owner_id = currentUser.id
      const { data: owned, error: ownedErr } = await supabase
        .from('workspaces')
        .select('*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived)')
        .eq('owner_id', currentUser.id)

      // Fetch workspaces where user is a member
      const { data: memberOf, error: memberErr } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*, workspace_members(user_id), notes(id, is_archived), todo_lists(id, is_archived))')
        .eq('user_id', currentUser.id)
        .not('workspaces.owner_id', 'eq', currentUser.id)

      if (ownedErr || memberErr) {
        toast.error('Failed to load workspaces')
        return
      }

      const memberWorkspaces = (memberOf || [])
        .map((m: any) => m.workspaces)
        .filter(Boolean)

      const all = [...(owned || []), ...memberWorkspaces]

      // Format data to match WorkspaceData type
      const formatted = await Promise.all(all.map(async (ws: any) => {
        const activeNotes = (ws.notes || []).filter((n: any) => !n.is_archived)
        const activeTodos = (ws.todo_lists || []).filter((t: any) => !t.is_archived)
        
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
            notes: activeNotes.length,
            todoLists: activeTodos.length,
            members: (ws.workspace_members || []).length || 1,
          },
        }
      }))

      // Sort by updatedAt desc
      formatted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

      setWorkspacesAction(formatted)
    } catch {
      toast.error('Failed to load workspaces')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [currentUser, setWorkspacesAction])

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  const handleCreate = async () => {
    if (!currentUser || isCreating) return
    setIsCreating(true)

    // Enforce workspace creation limit based on subscription tier
    const ownedWorkspacesCount = workspaces.filter((w) => w.ownerId === currentUser.id).length
    if (userTier === 'free' && ownedWorkspacesCount >= 1) {
      toast.error('Free tier is limited to 1 workspace. Please upgrade to Premium or Ultra Premium!')
      return
    }
    if (userTier === 'premium' && ownedWorkspacesCount >= 10) {
      toast.error('Premium tier is limited to 10 workspaces. Please upgrade to Ultra Premium!')
      return
    }

    const title = newTitle.trim() || 'Untitled Workspace'
    const wsId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      let encryptedWorkspaceKey = null;

      const isEncryptedSession = useAppStore.getState().isEncryptedSession;
      if (isEncryptedSession) {
        // 1. Generate AES Master Key for Workspace
        const { generateMasterKey, exportKeyToString, encryptWithPublicKey } = require('@/lib/e2ee');
        const wsAesKey = await generateMasterKey();
        
        // Temporarily store in Zustand so `encryptWorkspaceTitle` can use it
        const currentWsKeys = useAppStore.getState().workspaceKeys;
        useAppStore.getState().setWorkspaceKeys({ ...currentWsKeys, [wsId]: wsAesKey });

        // 2. Fetch User's Public RSA Key
        const { data: profile } = await supabase.from('profiles').select('public_rsa_key').eq('id', currentUser.id).single();
        if (profile?.public_rsa_key) {
          const rawAesStr = await exportKeyToString(wsAesKey);
          encryptedWorkspaceKey = await encryptWithPublicKey(rawAesStr, profile.public_rsa_key);
        }
      }

      const encryptedTitle = await encryptWorkspaceTitle(title, wsId)
      const encryptedDesc = await encryptWorkspaceDescription(newDescription.trim() || null, wsId)

      // 1. Insert workspace
      const { data: ws, error } = await supabase
        .from('workspaces')
        .insert({
          id: wsId,
          title: encryptedTitle,
          description: encryptedDesc,
          color: newColor,
          owner_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create workspace')
        return
      }

      // 2. Insert owner as workspace member
      const memberId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
      await supabase
        .from('workspace_members')
        .insert({
          id: memberId,
          user_id: currentUser.id,
          workspace_id: wsId,
          role: 'owner',
          encrypted_workspace_key: encryptedWorkspaceKey
        })

      const newWs: WorkspaceData = {
        id: ws.id,
        title,
        description: newDescription.trim() || null,
        color: ws.color,
        icon: ws.icon,
        ownerId: ws.owner_id,
        createdAt: ws.created_at,
        updatedAt: ws.updated_at,
        _count: {
          notes: 0,
          todoLists: 0,
          members: 1,
        },
      }

      setWorkspacesAction([...workspaces, newWs])
      setCreateOpen(false)
      setNewTitle('')
      setNewDescription('')
      setNewColor('#059669')
      toast.success('Workspace created')
    } catch {
      toast.error('Failed to create workspace')
    } finally {
      setIsCreating(false)
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

    // Enforce collaborator limit based on subscription tier
    const membersCount = wsMembers.filter((m) => m.role === 'member').length
    if (userTier === 'free' && membersCount >= 2) {
      toast.error('Free tier is limited to 2 collaborators. Please upgrade to Premium or Ultra Premium!')
      return
    }
    if (userTier === 'premium' && membersCount >= 20) {
      toast.error('Premium tier is limited to 20 collaborators. Please upgrade to Ultra Premium!')
      return
    }
    if (userTier === 'ultra' && membersCount >= 70) {
      toast.error('Ultra Premium tier is limited to 70 collaborators.')
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

      if (insertErr) {
        toast.error(insertErr.message || 'Failed to invite member')
        return
      }

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

  const handleRemoveMember = async () => {
    if (!selectedWs || !memberToRemove) return
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberToRemove.id)

      if (error) {
        toast.error(error.message || 'Failed to remove member')
        return
      }

      setWsMembers(wsMembers.filter((m) => m.id !== memberToRemove.id))
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, members: Math.max(1, w._count.members - 1) } }
          : w
      ))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setMemberToRemove(null)
    }
  }

  const handleOpenEdit = () => {
    if (!selectedWs) return
    setEditTitle(selectedWs.title)
    setEditDescription(selectedWs.description || '')
    setEditColor(selectedWs.color)
    setEditOpen(true)
  }

  const handleEditWorkspace = async () => {
    if (!selectedWs) return
    setIsSaving(true)
    try {
      const cleanTitle = editTitle.trim() || 'Untitled Workspace'
      const cleanDesc = editDescription.trim() || null
      const encryptedTitle = await encryptWorkspaceTitle(cleanTitle, selectedWs.id)
      const encryptedDesc = await encryptWorkspaceDescription(cleanDesc, selectedWs.id)

      const { data: updated, error } = await supabase
        .from('workspaces')
        .update({
          title: encryptedTitle,
          description: encryptedDesc,
          color: editColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedWs.id)
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to update workspace')
        return
      }

      const updatedWs: WorkspaceData = {
        id: updated.id,
        title: cleanTitle,
        description: cleanDesc,
        color: updated.color,
        icon: updated.icon,
        ownerId: updated.owner_id,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        _count: selectedWs._count,
      }

      setWorkspacesAction(workspaces.map((w) => (w.id === selectedWs.id ? updatedWs : w)))
      setSelectedWs(updatedWs)
      setEditOpen(false)
      setWsDetailOpen(false)
      toast.success('Workspace updated')
    } catch {
      toast.error('Failed to update workspace')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedWs) return
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', selectedWs.id)

      if (error) {
        toast.error(error.message || 'Failed to delete workspace')
        return
      }

      // Remove workspace from store
      setWorkspacesAction(workspaces.filter((w) => w.id !== selectedWs.id))
      // Cascade delete: remove all notes and todos belonging to this workspace
      setNotes(notes.filter((n) => n.workspaceId !== selectedWs.id))
      setTodoLists(todoLists.filter((t) => t.workspaceId !== selectedWs.id))
      setWsDetailOpen(false)
      setDeleteConfirmOpen(false)
      setSelectedWs(null)
      toast.success('Workspace and all its notes & todos deleted')
    } catch { toast.error('Failed to delete workspace') }
  }

  const handleQuickCreateNote = async () => {
    if (!currentUser || !selectedWs) return

    // Enforce Free tier notes limit (10 notes max)
    const ownedNotesCount = notes.filter((n) => n.authorId === currentUser.id && !n.isArchived).length
    if (userTier === 'free' && ownedNotesCount >= 10) {
      toast.error('Free tier is limited to 10 notes. Please upgrade to Premium or Ultra Premium!')
      return
    }

    const plainTitle = quickNoteTitle.trim() || 'Untitled Note'
    setIsQuickCreating(true)
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle, selectedWs.id)
      const noteId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
      
      const { data: note, error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          title: encryptedTitle,
          content: '',
          workspace_id: selectedWs.id,
          author_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create note')
        return
      }

      const formatted = {
        id: note.id,
        title: note.title,
        content: note.content,
        workspaceId: note.workspace_id,
        authorId: note.author_id,
        isPinned: note.is_pinned,
        isArchived: note.is_archived,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }

      addNote(formatted)
      logActivity('note_create')
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, notes: w._count.notes + 1 } }
          : w
      ))
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

    // Enforce Free tier todo lists limit (3 todo lists max)
    const ownedTodoListsCount = todoLists.filter((t) => t.authorId === currentUser.id && !t.isArchived).length
    if (userTier === 'free' && ownedTodoListsCount >= 3) {
      toast.error('Free tier is limited to 3 todo lists. Please upgrade to Premium or Ultra Premium!')
      return
    }

    const plainTitle = quickTodoTitle.trim() || 'Untitled Todo List'
    setIsQuickCreating(true)
    try {
      const encryptedTitle = await encryptTodoTitle(plainTitle, selectedWs.id)
      const listId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
      
      const { data: todoList, error } = await supabase
        .from('todo_lists')
        .insert({
          id: listId,
          title: encryptedTitle,
          workspace_id: selectedWs.id,
          author_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create todo list')
        return
      }

      const formatted = {
        id: todoList.id,
        title: todoList.title,
        content: '',
        workspaceId: todoList.workspace_id,
        authorId: todoList.author_id,
        isPinned: todoList.is_pinned,
        isArchived: todoList.is_archived,
        createdAt: todoList.created_at,
        updatedAt: todoList.updated_at,
        items: [],
      }

      addTodoList(formatted)
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, todoLists: w._count.todoLists + 1 } }
          : w
      ))
      setQuickTodoTitle('')
      toast.success('Todo list added to workspace')
    } catch {
      toast.error('Failed to create todo list')
    } finally {
      setIsQuickCreating(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="workspaces" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#8b5cf6] text-white flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">Workspaces</h1>
              <Badge variant="secondary" className="text-[10px] font-normal">{workspaces.length}</Badge>
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

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white hover:from-[#7c3aed]/90 hover:to-[#8b5cf6]/90 rounded-lg text-xs h-8"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Workspace</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 rounded-xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : workspaces.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/10 flex items-center justify-center mb-4">
                  <Layers className="w-8 h-8 text-[#7c3aed]/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No workspaces yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create a workspace to organize your notes and tasks</p>
                <Button
                  className="gap-2 bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white hover:from-[#7c3aed]/90 hover:to-[#8b5cf6]/90 rounded-xl"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create Workspace
                </Button>
              </motion.div>
            ) : (
              <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((ws) => {
                  const wsNotes = notes.filter((n) => n.workspaceId === ws.id && !n.isArchived)
                  const wsTodos = todoLists.filter((t) => t.workspaceId === ws.id && !t.isArchived)
                  return (
                    <motion.div key={ws.id} variants={fadeUp}>
                      <Card
                        className="cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 group border-border/50"
                        onClick={() => handleOpenWsDetail(ws)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                              <h3 className="text-sm font-semibold line-clamp-1">{ws.title}</h3>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {ws.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ws.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {wsNotes.length} notes
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CheckSquare className="w-3 h-3" />
                              {wsTodos.length} todos
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(ws.createdAt), 'MMM d, yyyy')}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="w-3 h-3" />
                              1
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </div>
        </main>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>Organize your notes and tasks in a workspace</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Workspace title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            />
            <Input
              placeholder="Description (optional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Color:</span>
              {workspaceColors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={`Select color ${c.name}`}
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: c.value, borderColor: newColor === c.value ? (theme === 'dark' ? '#fff' : '#000') : 'transparent' }}
                  onClick={() => setNewColor(c.value)}
                />
              ))}
            </div>
            <Button className="w-full bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white rounded-lg" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace Detail Dialog */}
      <Dialog open={wsDetailOpen} onOpenChange={setWsDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedWs?.color }} />
              {selectedWs?.title}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-1 shrink-0"
                onClick={(e) => { e.stopPropagation(); handleOpenEdit() }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedWs?.description || 'No description'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 p-3 text-center bg-card/50">
                <FileText className="w-4 h-4 mx-auto mb-1 text-[#059669]" />
                <p className="text-lg font-bold">{notes.filter((n) => n.workspaceId === selectedWs?.id && !n.isArchived).length}</p>
                <p className="text-[10px] text-muted-foreground">Notes</p>
              </div>
              <div className="rounded-xl border border-border/50 p-3 text-center bg-card/50">
                <CheckSquare className="w-4 h-4 mx-auto mb-1 text-[#d97706]" />
                <p className="text-lg font-bold">{todoLists.filter((t) => t.workspaceId === selectedWs?.id && !t.isArchived).length}</p>
                <p className="text-[10px] text-muted-foreground">Todo Lists</p>
              </div>
            </div>

            {/* Quick Create */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Create</p>
              <div className="flex gap-2">
                <Input
                  placeholder="New note title..."
                  value={quickNoteTitle}
                  onChange={(e) => setQuickNoteTitle(e.target.value)}
                  className="flex-1 h-9 text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateNote() } }}
                />
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#059669] to-[#0d9488] text-white h-9"
                  onClick={handleQuickCreateNote}
                  disabled={isQuickCreating}
                >
                  {isQuickCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="New todo title..."
                  value={quickTodoTitle}
                  onChange={(e) => setQuickTodoTitle(e.target.value)}
                  className="flex-1 h-9 text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateTodo() } }}
                />
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white h-9"
                  onClick={handleQuickCreateTodo}
                  disabled={isQuickCreating}
                >
                  {isQuickCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Members */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</p>
              <div className="space-y-2">
                {wsMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-[#7c3aed]/10 text-[#7c3aed]">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{member.user.name || member.user.email}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <Button aria-label="Remove member" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setMemberToRemove({ id: member.id, name: member.user.name || member.user.email })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite */}
              <div className="flex gap-2">
                <Input
                  placeholder="Invite by email..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 h-9 text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInviteMember() } }}
                />
                <Button variant="outline" size="sm" className="h-9" onClick={handleInviteMember} disabled={isInviting}>
                  {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            {/* Delete Workspace */}
            <div className="pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-9 text-xs gap-1.5"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update workspace name, description, and color</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Workspace title..."
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Color:</span>
              {workspaceColors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={`Select color ${c.name}`}
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: c.value, borderColor: editColor === c.value ? (theme === 'dark' ? '#fff' : '#000') : 'transparent' }}
                  onClick={() => setEditColor(c.value)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-600 to-violet-600 text-white hover:from-emerald-600/90 hover:to-violet-600/90 rounded-lg"
                onClick={handleEditWorkspace}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{selectedWs?.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workspace and <strong>all its notes and todo lists</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteWorkspace}
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => { if (!open) setMemberToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &ldquo;{memberToRemove?.name}&rdquo; from this workspace? They will lose access to all notes and todos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
