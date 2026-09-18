'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteTitle, decryptNoteTitleWithStatus, decryptNoteContentWithStatus, encryptNoteContent } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { Virtuoso } from 'react-virtuoso'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Plus, FileText, Clock, ShieldCheck, PenLine, LogOut, Sun, Moon, StickyNote, Search, Loader2, CalendarDays, Archive, Pin, Trash2, X, CheckCircle2, Circle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow, format } from 'date-fns'
import { getDueDateColor } from '@/lib/utils'
import { getPlanLimits, isAtLimit, formatLimit } from '@/lib/plans'
import { TagManagerDialog } from '@/components/notes/tag-manager-dialog'
import { getAllTemplates } from '@/lib/templates'

const PAGE_SIZE = 30

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

export function NotesList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const workspaces = useAppStore((s) => s.workspaces)
  const addNote = useAppStore((s) => s.addNote)
  const setNotes = useAppStore((s) => s.setNotes)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const userTier = useAppStore((s) => s.userTier)
  const logout = useAppStore((s) => s.logout)
  const hidePreviews = useAppStore((s) => s.hidePreviews)
  
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWorkspace, setNewWorkspace] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { theme, setTheme } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const [decryptedNotes, setDecryptedNotes] = useState<Map<string, { title: string; preview: string; updatedAt: string }>>(new Map())
  const decryptedNotesRef = useRef<Map<string, { title: string; preview: string; updatedAt: string }>>(new Map())

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (error) {
        toast.error('Failed to load notes')
        return
      }

      const formatted = data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags || [],
        workspaceId: n.workspace_id,
        authorId: n.author_id,
        isPinned: n.is_pinned,
        isArchived: n.is_archived,
        createdAt: n.created_at,
        updatedAt: n.updated_at, lockedBy: n.locked_by || null, lockedAt: n.locked_at || null,
      }))

      setNotes(formatted)
      setHasMore(formatted.length === PAGE_SIZE)
    } catch {
      toast.error('Failed to load notes')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = async () => {
    if (isFetchingMore || !hasMore || !currentUser) return
    setIsFetchingMore(true)
    try {
      const from = useAppStore.getState().notes.length
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) return
      const formatted = data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags || [],
        workspaceId: n.workspace_id,
        authorId: n.author_id,
        isPinned: n.is_pinned,
        isArchived: n.is_archived,
        createdAt: n.created_at,
        updatedAt: n.updated_at, lockedBy: n.locked_by || null, lockedAt: n.locked_at || null,
      }))
      setNotes([...useAppStore.getState().notes, ...formatted])
      setHasMore(formatted.length === PAGE_SIZE)
    } finally {
      setIsFetchingMore(false)
    }
  }

  const globalSyncTrigger = useAppStore((s) => s.globalSyncTrigger)

  useEffect(() => {
    fetchData()
  }, [currentUser, globalSyncTrigger, setNotes])

  useEffect(() => {
    let isActive = true
    const decryptData = async () => {
      const currentMap = decryptedNotesRef.current
      const noteMap = new Map(currentMap)
      
      const unencryptedNotes = notes.filter(n => {
        const existing = noteMap.get(n.id)
        return !existing || existing.updatedAt !== n.updatedAt
      })
      
      if (unencryptedNotes.length === 0) return
      
      const chunkSize = 10
      for (let i = 0; i < unencryptedNotes.length; i += chunkSize) {
        if (!isActive) break
        const chunk = unencryptedNotes.slice(i, i + chunkSize)
        let changed = false
        
        await Promise.all(
          chunk.map(async (n) => {
            const { content: title, usedLegacyFallback: titleLegacy } = await decryptNoteTitleWithStatus(n.title, n.workspaceId)
            const { content: decryptedContent, usedLegacyFallback: contentLegacy } = await decryptNoteContentWithStatus(n.content, n.workspaceId)
            
            if (titleLegacy || contentLegacy) {
              useAppStore.getState().updateNoteContent(n.id, decryptedContent)
              useAppStore.getState().updateNoteTitle(n.id, title)
              useAppStore.getState().incrementMigratedCount()
            }
            
            const preview = decryptedContent.substring(0, 120)
            noteMap.set(n.id, { title, preview: preview || 'Empty note...', updatedAt: n.updatedAt })
            changed = true
          })
        )
        
        if (changed && isActive) {
          decryptedNotesRef.current = noteMap
          setDecryptedNotes(new Map(noteMap))
        }
        
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    
    if (!isLoading) decryptData()
    return () => { isActive = false }
  }, [notes, isLoading])

  const handleCreate = async () => {
    if (!currentUser || isCreating) return

    // Enforce notes limit for the user's plan
    const limits = getPlanLimits(userTier)
    const ownedNotesCount = notes.filter((n) => n.authorId === currentUser.id && !n.isArchived).length
    if (isAtLimit(ownedNotesCount, limits.notes)) {
      toast.error(`Your plan allows up to ${formatLimit(limits.notes)} notes. Please upgrade to add more.`)
      return
    }

    setIsCreating(true)

    const template = getAllTemplates().find((t) => t.id === templateId && t.type === 'note')
    const plainTitle = newTitle.trim() || template?.name || 'Untitled Note'
    const noteId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle, newWorkspace || null)
      const encryptedContent = await encryptNoteContent(template?.content || '', newWorkspace || null)
      const { data: note, error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          title: encryptedTitle,
          content: encryptedContent,
          workspace_id: newWorkspace || null,
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
      setCreateOpen(false)
      setNewTitle('')
      setNewWorkspace('')
      setTemplateId('')
      router.push(`/dashboard/notes/${formatted.id}`)
      toast.success('Note created')
    } catch {
      toast.error('Failed to create note')
    } finally {
      setIsCreating(false)
    }
  }

  const handleBulkArchive = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const { error } = await supabase.from('notes').update({ is_archived: true }).in('id', ids)
    if (error) {
      toast.error('Bulk archive failed')
      return
    }
    setNotes(notes.map((n) => (selectedIds.has(n.id) ? { ...n, isArchived: true } : n)))
    toast.success(`Archived ${ids.length} note${ids.length === 1 ? '' : 's'}`)
    exitSelection()
  }

  const handleBulkPin = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const { error } = await supabase.from('notes').update({ is_pinned: true }).in('id', ids)
    if (error) {
      toast.error('Bulk pin failed')
      return
    }
    setNotes(notes.map((n) => (selectedIds.has(n.id) ? { ...n, isPinned: true } : n)))
    toast.success(`Pinned ${ids.length} note${ids.length === 1 ? '' : 's'}`)
    exitSelection()
  }

  const handleBulkTrash = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const { error } = await supabase
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
    if (error) {
      toast.error('Bulk delete failed')
      return
    }
    setNotes(notes.filter((n) => !selectedIds.has(n.id)))
    toast.success(`Moved ${ids.length} note${ids.length === 1 ? '' : 's'} to trash`)
    exitSelection()
  }

  const activeNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => {
      // Pinned items first, then by updatedAt desc
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const availableTags = Array.from(
    new Set(activeNotes.flatMap((n) => n.tags || []))
  ).sort()

  const filteredNotes = activeNotes.filter((n) => {
    if (selectedTag && !(n.tags || []).includes(selectedTag)) return false
    if (searchQuery) {
      const decrypted = decryptedNotes.get(n.id)
      return decrypted?.title.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
    }
    return true
  })

  if (!currentUser) return null

  return (
    <div className="min-h-screen flex bg-gradient-mesh-dash noise-overlay">
      <AppSidebar  />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 glass-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
              <PenLine className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">All Notes</h1>
              <Badge variant="secondary" className="text-[10px] font-normal">{activeNotes.length}</Badge>
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
              placeholder="Search notes..."
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
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 btn-gradient btn-shine text-white rounded-lg text-xs h-8"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Note</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" ref={contentRef}>
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {availableTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${
                    selectedTag === null
                      ? 'bg-[#059669]/15 text-[#059669] border-[#059669]/30 font-medium'
                      : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${
                      selectedTag === tag
                        ? 'bg-[#059669]/15 text-[#059669] border-[#059669]/30 font-medium'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTagManagerOpen(true)}
                  aria-label="Manage tags"
                  className="text-[11px] rounded-full px-2 py-1 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Manage
                </button>
              </div>
            )}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : activeNotes.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#059669]/10 flex items-center justify-center mb-4">
                  <StickyNote className="w-8 h-8 text-[#059669]/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No notes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first note to get started</p>
                <Button
                  className="gap-2 btn-gradient btn-shine text-white rounded-xl"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create Note
                </Button>
              </motion.div>
            ) : filteredNotes.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No notes match your search</h3>
                <p className="text-sm text-muted-foreground mb-4">Try a different search term</p>
              </motion.div>
            ) : (
              <>
              <div className="h-[calc(100vh-140px)]">
                <Virtuoso
                  style={{ height: '100%' }}
                  data={filteredNotes}
                  endReached={() => {
                    if (!searchQuery) loadMore()
                  }}
                  itemContent={(index, note) => {
                    const decrypted = decryptedNotes.get(note.id)
                    const ws = workspaces.find((w) => w.id === note.workspaceId)
                    return (
                      <div className="pb-2">
                        <button
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelected(note.id)
                              return
                            }
                            router.push(`/dashboard/notes/${note.id}`)
                          }}
                          className={`w-full text-left rounded-xl glass-card card-lift inner-glow p-4 group ${
                            selectionMode && selectedIds.has(note.id) ? 'ring-2 ring-[#059669]/50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {selectionMode && (
                              <div className="mt-0.5 shrink-0">
                                {selectedIds.has(note.id) ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#059669]" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground/50" />
                                )}
                              </div>
                            )}
                            <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#059669]/8 dark:bg-[#059669]/15 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-[#059669]/70 dark:text-[#34d399]/70" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-medium line-clamp-1">{decrypted?.title || note.title}</p>
                                {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                                {note.isPinned && <span className="text-[10px] text-muted-foreground">📌</span>}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{hidePreviews ? '••••••••' : (decrypted?.preview || 'Empty note...')}</p>
                              <div className="flex items-center gap-2 mt-2">
                                {ws && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                    {ws.title}
                                  </span>
                                )}
                                {note.dueDate && (
                                  <span className={`inline-flex items-center gap-1 text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-md ${getDueDateColor(note.dueDate)}`}>
                                    <CalendarDays className="w-2.5 h-2.5" />
                                    {format(new Date(note.dueDate), 'MMM d, yyyy')}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 text-muted-foreground/50">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-[10px]">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    )
                  }}
                />
              </div>
              </>
            )}
          </div>
        </main>
      </div>

      {selectionMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-2 shadow-xl">
          <span className="text-xs font-medium px-1 whitespace-nowrap">{selectedIds.size} selected</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setSelectedIds(new Set(filteredNotes.map((n) => n.id)))}
          >
            Select all
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleBulkArchive} disabled={selectedIds.size === 0}>
            <Archive className="w-3.5 h-3.5" />
            Archive
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleBulkPin} disabled={selectedIds.size === 0}>
            <Pin className="w-3.5 h-3.5" />
            Pin
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
            onClick={handleBulkTrash}
            disabled={selectedIds.size === 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Trash
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Exit selection" onClick={exitSelection}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <TagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} tags={availableTags} />

      {/* Create Note Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>Add a new note to your collection</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Enter note title..."
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
            {(() => {
              const noteTemplates = getAllTemplates().filter((t) => t.type === 'note')
              if (noteTemplates.length === 0) return null
              return (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Start from a template (optional)</p>
                  <Select value={templateId || '__none__'} onValueChange={(v) => setTemplateId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                      <SelectValue placeholder="Blank note" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Blank note</SelectItem>
                      {noteTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })()}
            <Button className="w-full btn-gradient btn-shine text-white rounded-lg" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isCreating ? 'Creating...' : 'Create Note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
