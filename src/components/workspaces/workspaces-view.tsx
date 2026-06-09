'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { encryptNoteTitle, encryptTodoTitle } from '@/lib/encrypted-api'
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
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

  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState('#059669')

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

  const { theme, setTheme } = useTheme()

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/workspaces?userId=${currentUser.id}`)
      if (res.ok) setWorkspacesAction(await res.json())
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
    if (!currentUser) return
    const title = newTitle.trim() || 'Untitled Workspace'
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: newDescription.trim() || null, color: newColor, ownerId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setWorkspacesAction([...workspaces, data])
        setCreateOpen(false)
        setNewTitle('')
        setNewDescription('')
        setNewColor('#059669')
        toast.success('Workspace created')
      }
    } catch {
      toast.error('Failed to create workspace')
    }
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
      const res = await fetch(`/api/workspaces/${selectedWs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() || 'Untitled Workspace', description: editDescription.trim() || null, color: editColor }),
      })
      if (res.ok) {
        const updated = await res.json()
        setWorkspacesAction(workspaces.map((w) => (w.id === selectedWs.id ? updated : w)))
        setSelectedWs(updated)
        setEditOpen(false)
        setWsDetailOpen(false)
        toast.success('Workspace updated')
      } else {
        toast.error('Failed to update workspace')
      }
    } catch {
      toast.error('Failed to update workspace')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedWs) return
    try {
      const res = await fetch(`/api/workspaces/${selectedWs.id}`, { method: 'DELETE' })
      if (res.ok) {
        // Remove workspace from store
        setWorkspacesAction(workspaces.filter((w) => w.id !== selectedWs.id))
        // Cascade delete: remove all notes and todos belonging to this workspace
        setNotes(notes.filter((n) => n.workspaceId !== selectedWs.id))
        setTodoLists(todoLists.filter((t) => t.workspaceId !== selectedWs.id))
        setWsDetailOpen(false)
        setDeleteConfirmOpen(false)
        setSelectedWs(null)
        toast.success('Workspace and all its notes & todos deleted')
      }
    } catch { toast.error('Failed to delete workspace') }
  }

  const handleQuickCreateNote = async () => {
    if (!currentUser || !selectedWs) return
    const plainTitle = quickNoteTitle.trim() || 'Untitled Note'
    setIsQuickCreating(true)
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, authorId: currentUser.id, workspaceId: selectedWs.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addNote(data)
        setQuickNoteTitle('')
        toast.success('Note added to workspace')
      }
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
      const encryptedTitle = await encryptTodoTitle(plainTitle)
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, authorId: currentUser.id, workspaceId: selectedWs.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addTodoList(data)
        setQuickTodoTitle('')
        toast.success('Todo list added to workspace')
      }
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
                              {wsMembers.length > 0 && wsMembers.find(m => selectedWs?.id === ws.id) ? wsMembers.length : 1}
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
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: c.value, borderColor: newColor === c.value ? (theme === 'dark' ? '#fff' : '#000') : 'transparent' }}
                  onClick={() => setNewColor(c.value)}
                />
              ))}
            </div>
            <Button className="w-full bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white rounded-lg" onClick={handleCreate}>
              Create Workspace
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveMember(member.id)}>
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
    </div>
  )
}
