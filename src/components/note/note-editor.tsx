'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteContent, encryptNoteTitle, decryptNoteContent, decryptNoteTitle } from '@/lib/encrypted-api'
import { useCollabSocket } from '@/hooks/use-collab-socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { ArrowLeft, Lock, Loader2, ShieldCheck, ShieldAlert, Users, Pin, Archive, ArchiveRestore, Share2, History, MoreVertical, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'

// Lazy-loaded MDX Editor
function LazyEditor({ content, onChange, isLocked }: { content: string; onChange: (val: string) => void; isLocked: boolean }) {
  const [EditorModule, setEditorModule] = useState<any>(null)

  useEffect(() => {
    import('@mdxeditor/editor').then((mod) => {
      setEditorModule(mod)
    }).catch(() => {
      // Fallback: show textarea
      setEditorModule(null)
    })
  }, [])

  if (!EditorModule) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" />
        <span className="ml-2 text-muted-foreground">Loading editor...</span>
      </div>
    )
  }

  const { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, markdownShortcutPlugin } = EditorModule

  return (
    <MDXEditor
      className="prose prose-sm dark:prose-invert max-w-none min-h-[60vh] focus:outline-none"
      contentEditable={!isLocked}
      markdown={content}
      onChange={onChange}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        markdownShortcutPlugin(),
      ]}
    />
  )
}

export function NoteEditor() {
  const currentUser = useAppStore((s) => s.currentUser)
  const selectedNoteId = useAppStore((s) => s.selectedNoteId)
  const notes = useAppStore((s) => s.notes)
  const updateNoteContent = useAppStore((s) => s.updateNoteContent)
  const updateNoteTitle = useAppStore((s) => s.updateNoteTitle)
  const setActiveCollaborators = useAppStore((s) => s.setActiveCollaborators)
  const setLock = useAppStore((s) => s.setLock)
  const setView = useAppStore((s) => s.setView)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<Array<{ id: string; title: string; content: string; version: number; createdAt: string }>>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const note = notes.find((n) => n.id === selectedNoteId)

  // Wire collab socket hook
  const collab = useCollabSocket({
    documentType: 'note',
    documentId: selectedNoteId || '',
    userId: currentUser?.id || '',
    userName: currentUser?.name || currentUser?.email || '',
    avatar: currentUser?.image,
    onContentUpdate: (newContent) => {
      // When another user updates content, reload
      setContent(newContent)
      toast.info('Note updated by collaborator')
    },
  })

  // Sync collab state to store
  useEffect(() => {
    setActiveCollaborators(collab.activeUsers.map(u => ({ userId: u.userId, userName: u.userName, avatar: u.avatar })))
  }, [collab.activeUsers, setActiveCollaborators])

  useEffect(() => {
    setLock(collab.lockStatus.isLocked, collab.lockStatus.lockedByUser)
  }, [collab.lockStatus.isLocked, collab.lockStatus.lockedByUser, setLock])

  const isLocked = useAppStore((s) => s.isLocked)
  const lockedByUser = useAppStore((s) => s.lockedByUser)
  const activeCollaborators = useAppStore((s) => s.activeCollaborators)

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

  // Request lock when user starts editing, release when idle
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      // Request lock if not locked by us
      if (!collab.lockStatus.isLocked || collab.lockStatus.lockedByUser !== currentUser?.name) {
        collab.requestLock()
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveContent()
      }, 1500)
    },
    [saveContent, collab, currentUser?.name]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (!collab.lockStatus.isLocked || collab.lockStatus.lockedByUser !== currentUser?.name) {
        collab.requestLock()
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveContent()
      }, 1500)
    },
    [saveContent, collab, currentUser?.name]
  )

  const handleDelete = async () => {
    if (!selectedNoteId) return
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Note deleted')
        setView('dashboard')
      }
    } catch {
      toast.error('Failed to delete note')
    }
  }

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

  const handleRestoreVersion = async (version: typeof versions[0]) => {
    if (!selectedNoteId) return
    setTitle(version.title)
    setContent(version.content)
    setHistoryOpen(false)
    toast.success(`Restored version ${version.version}`)
    // Trigger auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => { saveContent() }, 500)
  }

  if (!note && !initialLoad) {
    setView('dashboard')
    return null
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
            disabled={isLocked}
          />

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Encryption indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isEncryptedSession ? (
                    <ShieldCheck className="w-4 h-4 text-[#a855f7]" />
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

            {/* Collaboration indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 ${collab.isConnected ? 'text-[#a855f7] border-purple-300 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800' : 'text-muted-foreground'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${collab.isConnected ? 'bg-[#a855f7] animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="hidden sm:inline">{collab.isConnected ? 'Live' : 'Offline'}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{collab.isConnected ? 'Real-time collaboration active' : 'Collaboration disconnected'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Collaborators (desktop only) */}
            {activeCollaborators.length > 0 && (
              <div className="hidden sm:flex -space-x-2">
                {activeCollaborators.map((c) => (
                  <Avatar key={c.userId} className="w-7 h-7 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-purple-100 text-[#6d28d9] dark:bg-purple-950/40 dark:text-[#a855f7]">
                      {getInitials(c.userName)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-purple-50 dark:hover:bg-purple-950/30">
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
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Lock Banner */}
      {isLocked && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800"
        >
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <Lock className="w-4 h-4" />
            <span>
              {lockedByUser === currentUser?.name
                ? 'You are editing this note'
                : `${lockedByUser} is currently editing — read-only mode`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Editor */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 bg-background">
        {initialLoad ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" />
            <span className="ml-2 text-muted-foreground">Loading note...</span>
          </div>
        ) : (
          <LazyEditor
            content={content}
            onChange={handleContentChange}
            isLocked={isLocked}
          />
        )}
      </div>

      {/* Version History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#a855f7]" />
              Version History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              size="sm"
              className="w-full btn-gradient"
              onClick={handleSaveVersion}
            >
              Save Current Version
            </Button>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No versions saved yet. Click &ldquo;Save Current Version&rdquo; to create a snapshot.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-purple-300 transition-colors">
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
                      onClick={() => handleRestoreVersion(v)}
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
    </div>
  )
}
