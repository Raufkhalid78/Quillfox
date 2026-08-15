'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { encryptWorkspaceTitle, decryptWorkspaceTitle, encryptWorkspaceDescription, decryptWorkspaceDescription, encryptNoteTitle, encryptTodoTitle } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { rotateWorkspaceEncryptionKey } from '@/lib/workspace-rotation'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ManageMembersDialog } from './manage-members-dialog'
import { MultiInviteDialog } from '@/components/workspaces/multi-invite-dialog'
import { useRouter, useParams } from 'next/navigation'
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
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Users, Loader2, UserPlus, Trash2, Pencil, FileText, CheckSquare, ArrowLeft
} from 'lucide-react'
import { useTheme } from 'next-themes'

const workspaceColors = [
  { name: 'emerald', value: '#059669' },
  { name: 'teal', value: '#0d9488' },
  { name: 'amber', value: '#d97706' },
  { name: 'rose', value: '#e11d48' },
  { name: 'violet', value: '#7c3aed' },
  { name: 'blue', value: '#2563eb' },
]

export function WorkspaceDetailView() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.id as string

  const currentUser = useAppStore((s) => s.currentUser)
  const workspaces = useAppStore((s) => s.workspaces)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const setWorkspacesAction = useAppStore((s) => s.setWorkspaces)
  const addNote = useAppStore((s) => s.addNote)
  const addTodoList = useAppStore((s) => s.addTodoList)
  const setNotes = useAppStore((s) => s.setNotes)
  const setTodoLists = useAppStore((s) => s.setTodoLists)
  const userTier = useAppStore((s) => s.userTier)
  
  const { theme } = useTheme()

  const selectedWs = workspaces.find(w => w.id === workspaceId) || null

  const [wsMembers, setWsMembers] = useState<Array<{ id: string; userId: string; role: string; joinedAt: string; user: { id: string; name: string | null; email: string; image: string | null } }>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [quickNoteTitle, setQuickNoteTitle] = useState('')
  const [quickTodoTitle, setQuickTodoTitle] = useState('')
  const [isQuickCreating, setIsQuickCreating] = useState(false)
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(selectedWs?.title || '')
  const [editDescription, setEditDescription] = useState(selectedWs?.description || '')
  const [editColor, setEditColor] = useState(selectedWs?.color || '')
  const [isSaving, setIsSaving] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string, name: string } | null>(null)
  const [isRemovingMember, setIsRemovingMember] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth')
      return
    }
    if (!selectedWs && workspaces.length > 0) {
      // workspace not found
      router.push('/dashboard/workspaces')
    }
  }, [currentUser, router, selectedWs, workspaces.length])

  useEffect(() => {
    if (selectedWs) {
      setEditTitle(selectedWs.title)
      setEditDescription(selectedWs.description || '')
      setEditColor(selectedWs.color)
    }
  }, [selectedWs])

  useEffect(() => {
    const fetchMembers = async () => {
      if (!selectedWs) return
      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select('id, user_id, role, joined_at, profiles(id, name, email, image)')
          .eq('workspace_id', selectedWs.id)

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
    fetchMembers()
  }, [selectedWs])

  const handleInviteMember = async () => {
    if (!selectedWs || !inviteEmail.trim()) return

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
    setIsRemovingMember(true)
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberToRemove.id)

      if (error) {
        toast.error(error.message || 'Failed to remove member')
        return
      }

      // Automatically re-key the workspace for all remaining members
      // and re-encrypt all workspace data
      toast.info('Re-keying workspace for security...')
      await rotateWorkspaceEncryptionKey(selectedWs.id)

      setWsMembers(wsMembers.filter((m) => m.id !== memberToRemove.id))
      setWorkspacesAction(workspaces.map((w) => 
        w.id === selectedWs.id 
          ? { ...w, _count: { ...w._count, members: Math.max(1, w._count.members - 1) } }
          : w
      ))
      toast.success('Member removed and workspace re-keyed')
    } catch (err: any) {
      toast.error('Failed to rotate keys: ' + (err.message || 'Unknown error'))
    } finally {
      setIsRemovingMember(false)
      setMemberToRemove(null)
    }
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
      setEditOpen(false)
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

      setWorkspacesAction(workspaces.filter((w) => w.id !== selectedWs.id))
      setNotes(notes.filter((n) => n.workspaceId !== selectedWs.id))
      setTodoLists(todoLists.filter((t) => t.workspaceId !== selectedWs.id))
      toast.success('Workspace and all its notes & todos deleted')
      router.push('/dashboard/workspaces')
    } catch { toast.error('Failed to delete workspace') }
  }

  const handleQuickCreateNote = async () => {
    if (!currentUser || !selectedWs) return

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
        lockedBy: null,
        lockedAt: null,
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
        lockedBy: null,
        lockedAt: null,
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

  if (!currentUser || !selectedWs) return null

  return (
    <div className="min-h-screen flex bg-gradient-mesh-dash noise-overlay">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center h-14 px-4 md:px-8 glass-header gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/workspaces')} className="shrink-0 h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedWs.color }} />
            <h1 className="text-sm font-semibold tracking-tight truncate">{selectedWs.title}</h1>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          {selectedWs.description && (
            <p className="text-sm text-muted-foreground">{selectedWs.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 p-4 text-center bg-card/50">
              <FileText className="w-5 h-5 mx-auto mb-2 text-[#059669]" />
              <p className="text-2xl font-bold">{notes.filter((n) => n.workspaceId === selectedWs?.id && !n.isArchived).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Notes</p>
            </div>
            <div className="rounded-xl border border-border/50 p-4 text-center bg-card/50">
              <CheckSquare className="w-5 h-5 mx-auto mb-2 text-[#d97706]" />
              <p className="text-2xl font-bold">{todoLists.filter((t) => t.workspaceId === selectedWs?.id && !t.isArchived).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Todo Lists</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Create</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="New note title..."
                    value={quickNoteTitle}
                    onChange={(e) => setQuickNoteTitle(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateNote() } }}
                  />
                  <Button
                    className="bg-gradient-to-r from-[#059669] to-[#0d9488] text-white shrink-0"
                    onClick={handleQuickCreateNote}
                    disabled={isQuickCreating}
                  >
                    {isQuickCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New todo title..."
                    value={quickTodoTitle}
                    onChange={(e) => setQuickTodoTitle(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateTodo() } }}
                  />
                  <Button
                    className="bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white shrink-0"
                    onClick={handleQuickCreateTodo}
                    disabled={isQuickCreating}
                  >
                    {isQuickCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Members</h2>
              
              <div className="space-y-2">
                <ManageMembersDialog 
                  wsMembers={wsMembers} 
                  onRemoveClick={(id, name) => setMemberToRemove({ id, name })} 
                />
                
                <MultiInviteDialog defaultWorkspaceId={selectedWs.id}>
                  <Button variant="outline" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" /> Invite Members
                  </Button>
                </MultiInviteDialog>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/40 mt-8">
            <h2 className="text-sm font-semibold text-destructive mb-3">Danger Zone</h2>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Workspace
            </Button>
          </div>
        </main>
      </div>

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

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => { if (!open) setMemberToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &ldquo;{memberToRemove?.name}&rdquo; from this workspace? They will lose access to all notes and todos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isRemovingMember} onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isRemovingMember ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
