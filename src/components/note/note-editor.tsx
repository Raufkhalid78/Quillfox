'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Lock, Loader2 } from 'lucide-react'

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
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
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
  const activeCollaborators = useAppStore((s) => s.activeCollaborators)
  const isLocked = useAppStore((s) => s.isLocked)
  const lockedByUser = useAppStore((s) => s.lockedByUser)
  const setView = useAppStore((s) => s.setView)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const note = notes.find((n) => n.id === selectedNoteId)

  // Load note data
  useEffect(() => {
    if (!selectedNoteId) return
    setInitialLoad(true)
    const loadNote = async () => {
      try {
        const res = await fetch(`/api/notes/${selectedNoteId}`)
        if (res.ok) {
          const data = await res.json()
          setTitle(data.title)
          setContent(data.content || '')
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

  // Auto-save debounced
  const saveContent = useCallback(async () => {
    if (!selectedNoteId || isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/notes/${selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) {
        toast.error('Failed to save')
      } else {
        updateNoteContent(selectedNoteId, content)
        updateNoteTitle(selectedNoteId, title)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedNoteId, title, content, isSaving, updateNoteContent, updateNoteTitle])

  const handleContentChange = useCallback(
    (newContent: string) => {
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
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView('dashboard')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Input
            value={title}
            onChange={handleTitleChange}
            className="flex-1 border-0 focus-visible:ring-0 text-lg font-semibold px-1 h-auto py-1 bg-transparent"
            placeholder="Untitled Note"
            disabled={isLocked}
          />

          <div className="flex items-center gap-2 shrink-0">
            {isSaving && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center text-xs text-muted-foreground"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving
              </motion.div>
            )}

            {/* Collaborators */}
            {activeCollaborators.length > 0 && (
              <div className="flex -space-x-2">
                {activeCollaborators.map((c) => (
                  <Avatar key={c.userId} className="w-7 h-7 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-teal-100 text-teal-700">
                      {getInitials(c.userName)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
              Delete
            </Button>
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
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {initialLoad ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
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
    </div>
  )
}
