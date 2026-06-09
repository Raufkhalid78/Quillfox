'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteContent, encryptNoteTitle, decryptNoteContent, decryptNoteTitle } from '@/lib/encrypted-api'
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

export function NoteEditor() {
  const currentUser = useAppStore((s) => s.currentUser)
  const selectedNoteId = useAppStore((s) => s.selectedNoteId)
  const notes = useAppStore((s) => s.notes)
  const updateNoteContent = useAppStore((s) => s.updateNoteContent)
  const updateNoteTitle = useAppStore((s) => s.updateNoteTitle)
  const setView = useAppStore((s) => s.setView)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Array<{ id: string; title: string; content: string; version: number; createdAt: string }>>([])
  const [decryptedVersions, setDecryptedVersions] = useState<Array<{ id: string; title: string; content: string; version: number; createdAt: string }>>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const note = notes.find((n) => n.id === selectedNoteId)

  // Load note data & decrypt
  useEffect(() => {
    if (!selectedNoteId) return
    setInitialLoad(true)
    const loadNote = async () => {
      try {
        const res = await fetch(`/api/notes/${selectedNoteId}`)
        if (res.ok) {
          const data = await res.json()
          // Decrypt title and content if encrypted
          const decryptedTitle = await decryptNoteTitle(data.title)
          const decryptedContent = await decryptNoteContent(data.content || '')
          setTitle(decryptedTitle)
          setContent(decryptedContent)
          setInitialLoad(false)
        } else {
          toast.error('Failed to load note')
          setView('dashboard')
        }
      } catch {
        toast.error('Network error')
        setView('dashboard')
      }
      setInitialLoad(false)
    }
    loadNote()
  }, [selectedNoteId, setView])

  // Auto-save debounced (with encryption)
  const saveContent = useCallback(async () => {
    if (!selectedNoteId || isSaving) return
    setIsSaving(true)
    try {
      // Encrypt before sending to server
      const encryptedTitle = await encryptNoteTitle(title)
      const encryptedContent = await encryptNoteContent(content)
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, content: encryptedContent }),
      })
      if (!res.ok) {
        toast.error('Failed to save')
      } else {
        updateNoteContent(selectedNoteId, encryptedContent)
        updateNoteTitle(selectedNoteId, encryptedTitle)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedNoteId, title, content, isSaving, updateNoteContent, updateNoteTitle])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      setContent(newContent)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
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
        saveContent()
      }, 1500)
    },
    [saveContent]
  )

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleDelete = async () => {
    if (!selectedNoteId) return
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        removeNote(selectedNoteId)
        toast.success('Note deleted')
        setDeleteConfirmOpen(false)
        setView('notes')
      }
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
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinned }),
      })
      if (res.ok) {
        const updated = notes.map((n) => n.id === selectedNoteId ? { ...n, isPinned: newPinned } : n)
        setNotesAction(updated)
        toast.success(newPinned ? 'Note pinned' : 'Note unpinned')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleToggleArchive = async () => {
    if (!selectedNoteId || !note) return
    const newArchived = !note.isArchived
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchived }),
      })
      if (res.ok) {
        if (newArchived) {
          const updated = notes.filter((n) => n.id !== selectedNoteId)
          setNotesAction(updated)
          setView('dashboard')
        } else {
          const updated = notes.map((n) => n.id === selectedNoteId ? { ...n, isArchived: false } : n)
          setNotesAction(updated)
        }
        toast.success(newArchived ? 'Note archived' : 'Note restored')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleShare = async () => {
    if (!selectedNoteId) return
    const url = `${window.location.origin}/?note=${selectedNoteId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied to clipboard!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleOpenHistory = async () => {
    if (!selectedNoteId) return
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}/versions`)
      if (res.ok) {
        const data = await res.json()
        const decrypted = await Promise.all(data.map(async (v) => ({
          ...v,
          title: await decryptNoteTitle(v.title),
          content: await decryptNoteContent(v.content || ''),
        })))
        setDecryptedVersions(decrypted)
        setVersions(data)
        setHistoryOpen(true)
      }
    } catch { toast.error('Failed to load history') }
  }

  const handleSaveVersion = async () => {
    if (!selectedNoteId) return
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (res.ok) {
        toast.success('Version saved')
        const updatedVersions = await res.json()
        setVersions([updatedVersions, ...versions])
      }
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
    saveTimeoutRef.current = setTimeout(() => { saveContent() }, 500)
  }

  useEffect(() => {
    if (!note && !initialLoad) setView('dashboard')
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
              onClick={() => setView('dashboard')}
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
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </DropdownMenuItem>
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
            {/* Textarea Editor */}
            <textarea
              value={content}
              onChange={handleContentChange}
              className="w-full min-h-[60vh] resize-y rounded-xl border border-border/50 bg-card/50 p-6 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]/40 transition-all placeholder:text-muted-foreground/40 font-[inherit]"
              placeholder="Start writing your note here...&#10;&#10;Supports plain text. You can use it for notes, ideas, journaling, and more."
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
