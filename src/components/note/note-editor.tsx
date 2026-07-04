'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteContent, encryptNoteTitle, decryptNoteContent, decryptNoteTitle } from '@/lib/encrypted-api'
import { logActivity } from '@/lib/activity'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Loader2, ShieldCheck, ShieldAlert, Pin, Archive, ArchiveRestore, Share2, History, MoreVertical, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'
import { NotionEditor } from './notion-editor'

export function NoteEditor() {
  const currentUser = useAppStore((s) => s.currentUser)
  const selectedNoteId = useAppStore((s) => s.selectedNoteId)
  const notes = useAppStore((s) => s.notes)
  const updateNoteContent = useAppStore((s) => s.updateNoteContent)
  const updateNoteTitle = useAppStore((s) => s.updateNoteTitle)
  const setView = useAppStore((s) => s.setView)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

  const note = notes.find((n) => n.id === selectedNoteId)

  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [initialLoad, setInitialLoad] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Array<{ id: string; title: string; content: string; version: number; createdAt: string }>>([])
  const [decryptedVersions, setDecryptedVersions] = useState<Array<{ id: string; title: string; content: string; version: number; createdAt: string }>>([])
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleRef = useRef(title)
  const contentRef = useRef(content)
  const lastVersionSaveTime = useRef(Date.now())
  const lastLocalSaveTimeRef = useRef<number>(0)

  useEffect(() => {
    titleRef.current = title
    contentRef.current = content
  }, [title, content])

  // Load note data & decrypt + subscribe to realtime updates
  useEffect(() => {
    if (!selectedNoteId) return
    setInitialLoad(true)
    const loadNote = async () => {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', selectedNoteId)
          .single()

        if (error || !data) {
          toast.error('Failed to load note')
          setView('notes')
          return
        }

        const decryptedTitle = await decryptNoteTitle(data.title)
        const decryptedContent = await decryptNoteContent(data.content || '')
        setTitle(decryptedTitle)
        setContent(decryptedContent)
        setInitialLoad(false)
      } catch {
        toast.error('Network error')
        setView('notes')
      }
      setInitialLoad(false)
    }
    loadNote()

    // Subscribe to realtime updates for this note
    const channel = supabase
      .channel(`note-${selectedNoteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${selectedNoteId}`,
        },
        async (payload) => {
          // Only sync if the user is not actively typing and hasn't just saved
          if (!saveTimeoutRef.current && Date.now() - lastLocalSaveTimeRef.current > 2000) {
            try {
              const decTitle = await decryptNoteTitle(payload.new.title)
              const decContent = await decryptNoteContent(payload.new.content || '')
              setTitle((prev) => (prev === decTitle ? prev : decTitle))
              setContent((prev) => (prev === decContent ? prev : decContent))
            } catch (err) {
              console.warn('Failed to decrypt realtime note update', err)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedNoteId, setView])

  // Auto-save debounced (with encryption)
  const saveContent = useCallback(async () => {
    if (!selectedNoteId || isSaving) return
    setIsSaving(true)
    try {
      const currentTitle = titleRef.current
      const currentContent = contentRef.current
      
      // Encrypt before sending to server
      const encryptedTitle = await encryptNoteTitle(currentTitle)
      const encryptedContent = await encryptNoteContent(currentContent)
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNoteId)

      if (error) {
        toast.error('Failed to save')
      } else {
        lastLocalSaveTimeRef.current = Date.now()
        updateNoteContent(selectedNoteId, encryptedContent)
        updateNoteTitle(selectedNoteId, encryptedTitle)
        logActivity('note_update')

        // Auto versioning every 15 minutes
        const now = Date.now()
        if (now - lastVersionSaveTime.current > 15 * 60 * 1000) {
          lastVersionSaveTime.current = now
          const { data: vList } = await supabase
            .from('note_versions')
            .select('version')
            .eq('note_id', selectedNoteId)
            .order('version', { ascending: false })
            .limit(1)
          
          const nextVer = (vList && vList.length > 0 ? vList[0].version : 0) + 1
          const versionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
          await supabase.from('note_versions').insert({
            id: versionId,
            note_id: selectedNoteId,
            title: encryptedTitle,
            content: encryptedContent,
            version: nextVer,
          })
        }
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedNoteId, isSaving, updateNoteContent, updateNoteTitle])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setContent(newContent)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null
        saveContent()
      }, 1500)
    },
    [saveContent]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null
        saveContent()
      }, 1500)
    },
    [saveContent]
  )

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleDelete = async () => {
    if (!selectedNoteId) return
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', selectedNoteId)

      if (error) {
        toast.error(error.message || 'Failed to delete note')
        return
      }

      removeNote(selectedNoteId)
      toast.success('Note deleted')
      setDeleteConfirmOpen(false)
      setView('notes')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const removeNote = useAppStore((s) => s.removeNote)
  const setNotesAction = useAppStore((s) => s.setNotes)

  const handleTogglePin = async () => {
    if (!selectedNoteId || !note) return
    const newPinned = !note.isPinned
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          is_pinned: newPinned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNoteId)

      if (!error) {
        const updated = notes.map((n) => n.id === selectedNoteId ? { ...n, isPinned: newPinned } : n)
        setNotesAction(updated)
        toast.success(newPinned ? 'Note pinned' : 'Note unpinned')
      } else {
        toast.error('Failed to update')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleToggleArchive = async () => {
    if (!selectedNoteId || !note) return
    const newArchived = !note.isArchived
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          is_archived: newArchived,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNoteId)

      if (!error) {
        if (newArchived) {
          const updated = notes.filter((n) => n.id !== selectedNoteId)
          setNotesAction(updated)
          setView('notes')
        } else {
          const updated = notes.map((n) => n.id === selectedNoteId ? { ...n, isArchived: false } : n)
          setNotesAction(updated)
        }
        toast.success(newArchived ? 'Note archived' : 'Note restored')
      } else {
        toast.error('Failed to update')
      }
    } catch { toast.error('Failed to update') }
  }


  const handleOpenHistory = async () => {
    if (!selectedNoteId) return
    try {
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', selectedNoteId)
        .order('version', { ascending: false })

      if (error) {
        toast.error('Failed to load history')
        return
      }

      const formatted = data.map((v: any) => ({
        id: v.id,
        title: v.title,
        content: v.content,
        version: v.version,
        createdAt: v.created_at,
      }))

      const decrypted = await Promise.all(formatted.map(async (v: any) => ({
        ...v,
        title: await decryptNoteTitle(v.title),
        content: await decryptNoteContent(v.content || ''),
      })))

      setDecryptedVersions(decrypted)
      setVersions(formatted)
      setHistoryOpen(true)
    } catch { toast.error('Failed to load history') }
  }

  const handleSaveVersion = async () => {
    if (!selectedNoteId) return
    try {
      const encryptedTitle = await encryptNoteTitle(title)
      const encryptedContent = await encryptNoteContent(content)
      
      const { data: versionsList, error: verErr } = await supabase
        .from('note_versions')
        .select('version')
        .eq('note_id', selectedNoteId)
        .order('version', { ascending: false })
        .limit(1)

      const lastVer = versionsList && versionsList.length > 0 ? versionsList[0].version : 0
      const nextVer = lastVer + 1
      const versionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

      const { data: newVer, error } = await supabase
        .from('note_versions')
        .insert({
          id: versionId,
          note_id: selectedNoteId,
          title: encryptedTitle,
          content: encryptedContent,
          version: nextVer,
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to save version')
        return
      }

      const formatted = {
        id: newVer.id,
        title: newVer.title,
        content: newVer.content,
        version: newVer.version,
        createdAt: newVer.created_at,
      }

      setVersions([formatted, ...versions])
      setDecryptedVersions((prev) => [{
        ...formatted,
        title,
        content,
      }, ...prev])
      toast.success('Version saved')
    } catch { toast.error('Failed to save version') }
  }

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedNoteId) return
    const decrypted = decryptedVersions.find((v) => v.id === versionId)
    if (!decrypted) return
    setTitle(decrypted.title)
    setContent(decrypted.content)
    setHistoryOpen(false)
    toast.success(`Restored version ${decrypted.version}`)
    // Trigger auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      saveContent()
    }, 500)
  }

  useEffect(() => {
    if (!note && !initialLoad) setView('notes')
  }, [note, initialLoad, setView])

  if (!note && !initialLoad) return null

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="note-editor" />

      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('notes')}
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </motion.div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          <Input
            value={title}
            onChange={handleTitleChange}
            className="flex-1 min-w-0 border-0 focus-visible:ring-0 text-base sm:text-lg font-semibold px-1 h-auto py-1 bg-transparent"
            placeholder="Untitled Note"
          />

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Encryption indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isEncryptedSession ? (
                    <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {isEncryptedSession ? 'End-to-end encrypted' : 'Encryption not active'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isSaving && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center text-xs text-muted-foreground"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                <span className="hidden sm:inline">Saving</span>
              </motion.div>
            )}

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-[#059669]/10 dark:hover:bg-[#059669]/20">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleOpenHistory}>
                  <History className="w-4 h-4 mr-2" />
                  Version History
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleTogglePin}>
                  <Pin className={`w-4 h-4 mr-2 ${note?.isPinned ? 'fill-current' : ''}`} />
                  {note?.isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleArchive}>
                  {note?.isArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                  {note?.isArchived ? 'Restore from Archive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Editor Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 bg-background">
        {initialLoad ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#059669]" />
            <span className="ml-2 text-muted-foreground">Loading note...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Toolbar hint */}
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-muted-foreground">
                Start typing to edit. Content auto-saves every 1.5 seconds.
              </p>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {content.length} chars
              </Badge>
            </div>
            {/* Notion-Style Markdown Editor */}
            <NotionEditor
              content={content}
              onChange={(val) => {
                setContent(val)
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                saveTimeoutRef.current = setTimeout(() => {
                  saveTimeoutRef.current = null
                  saveContent()
                }, 1500)
              }}
              disabled={initialLoad}
            />
          </div>
        )}
      </div>

      </div>
      {/* Version History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#059669]" />
              Version History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90"
              onClick={handleSaveVersion}
            >
              Save Current Version
            </Button>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {decryptedVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No versions saved yet. Click &ldquo;Save Current Version&rdquo; to create a snapshot.</p>
              ) : (
                decryptedVersions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-[#059669]/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-1">{v.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.content.substring(0, 80)}...</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(v.id)}
                    >
                      Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
