'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Pin,
  Archive,
  ArchiveRestore,
  History,
  MoreVertical,
  Trash2,
  Calendar,
  Tag,
  X,
} from 'lucide-react'
import { FolderPicker } from '@/components/shared/folder-picker'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'
import { saveReminder, deleteReminderForEntity } from '@/lib/reminders'
import { updateRow } from '@/lib/offline-queue'
import { toast } from 'sonner'

interface NoteHeaderProps {
  note: any
  title: string
  handleTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  isSaving: boolean
  isEncryptedSession: boolean
  currentUser: any
  isTypingRef: React.MutableRefObject<boolean>
  saveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
  saveContent: () => void
  onOpenHistory: () => void
  onTogglePin: () => void
  onToggleArchive: () => void
  onDelete: () => void
}

export function NoteHeader({
  note,
  title,
  handleTitleChange,
  isSaving,
  isEncryptedSession,
  currentUser,
  isTypingRef,
  saveTimeoutRef,
  saveContent,
  onOpenHistory,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: NoteHeaderProps) {
  const router = useRouter()
  const setNoteFolder = useAppStore((s) => s.setNoteFolder)
  const setNoteDueDate = useAppStore((s) => s.setNoteDueDate)
  const setNoteTags = useAppStore((s) => s.setNoteTags)

  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(note?.tags || [])

  const handleDueDate = async (val: string) => {
    if (!note?.id) return
    setNoteDueDate(note.id, val)
    try {
      await updateRow('notes', { due_date: val || null }, { column: 'id', value: note.id })
      const userId = useAppStore.getState().currentUser?.id
      try {
        if (val && userId) {
          await saveReminder({
            entityType: 'note',
            entityId: note.id,
            workspaceId: note.workspaceId ?? null,
            remindAt: new Date(val),
            userId,
          })
        } else {
          await deleteReminderForEntity('note', note.id)
        }
      } catch {
        // Reminder sync is best-effort; the due date is queued above.
      }
    } catch {
      toast.error('Failed to update due date')
    }
  }

  const persistTags = async (next: string[]) => {
    if (!note?.id) return
    setTags(next)
    setNoteTags?.(note.id, next)
    try {
      await updateRow('notes', { tags: next }, { column: 'id', value: note.id })
    } catch {
      toast.error('Failed to save tags')
    }
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (!t || tags.includes(t)) {
      setTagInput('')
      return
    }
    persistTags([...tags, t])
    setTagInput('')
  }

  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/notes')}
            className="shrink-0 h-8 w-8"
            aria-label="Back to notes"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
        </motion.div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        <Input
          value={title}
          onChange={handleTitleChange}
          className="flex-1 min-w-0 border-0 focus-visible:ring-0 text-base sm:text-lg font-semibold px-1 h-auto py-1 bg-transparent"
          placeholder="Untitled Note"
          aria-label="Note title"
        />

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Tags */}
          {note?.id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTagsOpen(true)}
              aria-label="Edit tags"
            >
              <Tag className={`w-4 h-4 ${tags.length > 0 ? 'text-[#6366f1]' : 'text-muted-foreground'}`} aria-hidden="true" />
            </Button>
          )}

          {/* Due Date Picker */}
          {note?.id && (
            <div className="relative items-center hidden sm:flex">
              <Input
                type="date"
                value={note.dueDate || ''}
                onChange={(e) => handleDueDate(e.target.value)}
                aria-label="Due date"
                className="h-8 text-xs border-0 bg-transparent w-[130px] pl-8 focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-2 pointer-events-none" aria-hidden="true" />
            </div>
          )}

          {/* Folder Picker */}
          {note?.id && (
            <FolderPicker
              selectedFolderId={note.folderId}
              onSelect={async (folderId) => {
                setNoteFolder(note.id, folderId)
                if (!isTypingRef.current) {
                  isTypingRef.current = true
                  supabase.channel(`room:note-${note.id}`).track({ userId: currentUser?.id, isTyping: true })
                }
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                saveTimeoutRef.current = setTimeout(async () => {
                  saveTimeoutRef.current = null
                  try {
                    await updateRow('notes', { folder_id: folderId || null }, { column: 'id', value: note.id })
                  } catch {}
                  saveContent()
                  if (isTypingRef.current) {
                    isTypingRef.current = false
                    supabase.channel(`room:note-${note.id}`).track({ userId: currentUser?.id, isTyping: false })
                  }
                }, 1500)
              }}
            />
          )}

          {/* Encryption indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {isEncryptedSession ? (
                  <ShieldCheck className="w-4 h-4 text-[#059669]" aria-label="End-to-end encrypted" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-500" aria-label="Encryption not active" />
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
              <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">Saving</span>
            </motion.div>
          )}

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hover:bg-[#059669]/10 dark:hover:bg-[#059669]/20"
                aria-label="Note actions"
              >
                <MoreVertical className="w-4 h-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onOpenHistory}>
                <History className="w-4 h-4 mr-2" />
                Version History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTogglePin}>
                <Pin className={`w-4 h-4 mr-2 ${note?.isPinned ? 'fill-current' : ''}`} />
                {note?.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>
                {note?.isArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                {note?.isArchived ? 'Restore from Archive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tags dialog */}
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet.</p>
              ) : (
                tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    #{t}
                    <button
                      onClick={() => persistTags(tags.filter((x) => x !== t))}
                      aria-label={`Remove tag ${t}`}
                      className="ml-1 rounded hover:text-destructive"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add a tag and press Enter"
                aria-label="Add tag"
              />
              <Button onClick={addTag}>Add</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}