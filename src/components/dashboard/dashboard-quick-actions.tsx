import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, StickyNote, CheckSquare, FolderOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { encryptNoteTitle, encryptTodoTitle, encryptWorkspaceTitle, encryptWorkspaceDescription } from '@/lib/encrypted-api'
import type { WorkspaceData, NoteItem, TodoItemData } from '@/stores/app-store'
import { useAppStore } from '@/stores/app-store'

interface DashboardQuickActionsProps {
  currentUser: { id: string } | null
  workspaces: WorkspaceData[]
  userTier: string
  notes: NoteItem[]
  todoLists: TodoItemData[]
  theme: string | undefined
  addNote: (note: NoteItem) => void
  addTodoList: (todoList: TodoItemData) => void
  setWorkspacesAction: (workspaces: WorkspaceData[]) => void
  selectNote: (id: string) => void
  selectTodo: (id: string) => void
}

const workspaceColors = [
  { name: 'Emerald', value: '#059669' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Amber', value: '#d97706' },
]

export function DashboardQuickActions({
  currentUser,
  workspaces,
  userTier,
  notes,
  todoLists,
  theme,
  addNote,
  addTodoList,
  setWorkspacesAction,
  selectNote,
  selectTodo
}: DashboardQuickActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteWorkspace, setNewNoteWorkspace] = useState<string>('')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoWorkspace, setNewTodoWorkspace] = useState<string>('')
  const [newWsTitle, setNewWsTitle] = useState('')
  const [newWsDescription, setNewWsDescription] = useState('')
  const [newWsColor, setNewWsColor] = useState('#059669')
  const [isQuickCreating, setIsQuickCreating] = useState(false)

  const handleCreateNote = async () => {
    if (!currentUser || isQuickCreating) return
    setIsQuickCreating(true)

    // Enforce Free tier notes limit (10 notes max)
    const ownedNotesCount = notes.filter((n) => n.authorId === currentUser.id && !n.isArchived).length
    if (userTier === 'free' && ownedNotesCount >= 10) {
      toast.error('Free tier is limited to 10 notes. Please upgrade to Premium or Ultra Premium!')
      setIsQuickCreating(false)
      return
    }

    const plainTitle = newNoteTitle.trim() || 'Untitled Note'
    const noteId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle)
      const { data: note, error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          title: encryptedTitle,
          content: '',
          workspace_id: newNoteWorkspace || null,
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
      setDialogOpen(false)
      setNewNoteTitle('')
      setNewNoteWorkspace('')
      selectNote(formatted.id)
      toast.success('Note created')
    } catch {
      toast.error('Failed to create note')
    } finally {
      setIsQuickCreating(false)
    }
  }

  const handleCreateTodo = async () => {
    if (!currentUser || isQuickCreating) return
    setIsQuickCreating(true)

    // Enforce Free tier todo lists limit (3 todo lists max)
    const ownedTodoListsCount = todoLists.filter((t) => t.authorId === currentUser.id && !t.isArchived).length
    if (userTier === 'free' && ownedTodoListsCount >= 3) {
      toast.error('Free tier is limited to 3 todo lists. Please upgrade to Premium or Ultra Premium!')
      setIsQuickCreating(false)
      return
    }

    const plainTitle = newTodoTitle.trim() || 'Untitled Todo List'
    const todoId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      const encryptedTitle = await encryptTodoTitle(plainTitle)
      const { data, error } = await supabase
        .from('todo_lists')
        .insert({
          id: todoId,
          title: encryptedTitle,
          workspace_id: newTodoWorkspace || null,
          author_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create todo list')
        return
      }

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
      setDialogOpen(false)
      setNewTodoTitle('')
      setNewTodoWorkspace('')
      selectTodo(formatted.id)
      toast.success('Todo list created')
    } catch {
      toast.error('Failed to create todo list')
    } finally {
      setIsQuickCreating(false)
    }
  }

  const handleCreateWorkspace = async () => {
    if (!currentUser || isQuickCreating) return
    setIsQuickCreating(true)

    const title = newWsTitle.trim() || 'Untitled Workspace'
    const wsId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      let encryptedWorkspaceKey: string | null = null;

      const isEncryptedSession = useAppStore.getState().isEncryptedSession
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
      const encryptedDesc = newWsDescription.trim() ? await encryptWorkspaceDescription(newWsDescription.trim(), wsId) : null

      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          id: wsId,
          title: encryptedTitle,
          description: encryptedDesc,
          color: newWsColor,
          owner_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to create workspace')
        return
      }

      // Automatically add owner to members list for RLS policies
      await supabase.from('workspace_members').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        user_id: currentUser.id,
        workspace_id: data.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
        encrypted_workspace_key: encryptedWorkspaceKey
      })

      const formatted = {
        id: data.id,
        title: data.title,
        description: data.description,
        color: data.color,
        icon: data.icon,
        ownerId: data.owner_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        members: [{
          id: `member_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`,
          userId: currentUser.id,
          role: 'owner',
          joinedAt: new Date().toISOString(),
          user: {
            id: currentUser.id,
            name: 'You',
            email: '',
            image: null
          }
        }],
        notes: [],
        todoLists: [],
        _count: {
          notes: 0,
          todoLists: 0,
          members: 1,
        },
      }

      setWorkspacesAction([formatted, ...workspaces])
      logActivity('workspace_create')
      setDialogOpen(false)
      setNewWsTitle('')
      setNewWsDescription('')
      setNewWsColor('#059669')
      toast.success('Workspace created')
    } catch {
      toast.error('Failed to create workspace')
    } finally {
      setIsQuickCreating(false)
    }
  }

  return (
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
              {workspaces.length > 0 && (
                <Select value={newNoteWorkspace} onValueChange={(v) => setNewNoteWorkspace(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Assign to workspace (optional)" />
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
              )}
              <Button size="sm" className="w-full bg-gradient-to-r from-[#059669] to-[#0d9488] text-white rounded-lg" onClick={handleCreateNote} disabled={isQuickCreating}>
                {isQuickCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isQuickCreating ? 'Creating...' : 'Create Note'}
              </Button>
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
              {workspaces.length > 0 && (
                <Select value={newTodoWorkspace} onValueChange={(v) => setNewTodoWorkspace(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Assign to workspace (optional)" />
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
              )}
              <Button size="sm" className="w-full bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white rounded-lg" onClick={handleCreateTodo} disabled={isQuickCreating}>
                {isQuickCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isQuickCreating ? 'Creating...' : 'Create Todo List'}
              </Button>
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
                  <button key={c.name} type="button" aria-label={`Select color ${c.name}`} className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110" style={{ backgroundColor: c.value, borderColor: newWsColor === c.value ? (theme === 'dark' ? '#fff' : '#000') : 'transparent' }} onClick={() => setNewWsColor(c.value)} />
                ))}
              </div>
              <Button size="sm" className="w-full bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white rounded-lg" onClick={handleCreateWorkspace} disabled={isQuickCreating}>
                {isQuickCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isQuickCreating ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
