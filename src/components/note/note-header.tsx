'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Loader2, ShieldCheck, ShieldAlert, Pin, Archive, ArchiveRestore, History, MoreVertical, Trash2, Calendar } from 'lucide-react'
import { FolderPicker } from '@/components/shared/folder-picker'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'

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
  onDelete
}: NoteHeaderProps) {
  const router = useRouter()
  const setNoteFolder = useAppStore((s) => s.setNoteFolder)
  const setNoteDueDate = useAppStore((s) => s.setNoteDueDate)

  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/notes')}
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
          {/* Due Date Picker */}
          {note?.id && (
            <div className="relative flex items-center hidden sm:flex">
              <Input
                type="date"
                value={note.dueDate || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setNoteDueDate(note.id, val)
                  supabase.from('notes').update({ due_date: val || null }).eq('id', note.id)
                }}
                className="h-8 text-xs border-0 bg-transparent w-[130px] pl-8 focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-muted-foreground absolute left-2 pointer-events-none" />
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
                    await supabase.from('notes').update({ folder_id: folderId || null }).eq('id', note.id)
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
    </header>
  )
}
