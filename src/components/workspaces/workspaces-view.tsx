'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type WorkspaceData } from '@/stores/app-store'
import { encryptWorkspaceTitle, decryptWorkspaceTitle, encryptWorkspaceDescription, decryptWorkspaceDescription } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Plus, Layers, ShieldCheck, Users, LogOut, Sun, Moon,
  FileText, CheckSquare, Loader2, ChevronRight,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { generateMasterKey, exportKeyToString, encryptWithPublicKey } from '@/lib/e2ee'

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
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const userTier = useAppStore((s) => s.userTier)
  const logout = useAppStore((s) => s.logout)
  
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newColor, setNewColor] = useState('#059669')
  const [isCreating, setIsCreating] = useState(false)

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

  const globalSyncTrigger = useAppStore((s) => s.globalSyncTrigger)

  useEffect(() => {
    fetchData()
  }, [currentUser, globalSyncTrigger, setWorkspacesAction])

  useEffect(() => {
    if (!currentUser) router.push('/auth')
  }, [currentUser, router])

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
      let encryptedWorkspaceKey: string | null = null;

      const isEncryptedSession = useAppStore.getState().isEncryptedSession;
      if (isEncryptedSession) {
        // 1. Generate AES Master Key for Workspace
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

  if (!currentUser) return null

  return (
    <div className="min-h-screen flex bg-gradient-mesh-dash noise-overlay">
      <AppSidebar  />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 glass-header">
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
              className="gap-1.5 btn-gradient btn-shine text-white rounded-lg text-xs h-8"
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
                  className="gap-2 btn-gradient btn-shine text-white rounded-xl"
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
                        className="cursor-pointer glass-card card-lift inner-glow group"
                        onClick={() => router.push(`/dashboard/workspaces/${ws.id}`)}
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
                              {ws._count?.members || 1}
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
            <Button className="w-full btn-gradient btn-shine text-white rounded-lg" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

