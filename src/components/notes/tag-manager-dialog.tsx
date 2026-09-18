'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { Check, Pencil, Tag, Trash2, X } from 'lucide-react'

interface TagManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: string[]
}

/**
 * Rename or delete a tag across every note that uses it.
 */
export function TagManagerDialog({ open, onOpenChange, tags }: TagManagerDialogProps) {
  const notes = useAppStore((s) => s.notes)
  const setNotes = useAppStore((s) => s.setNotes)
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const applyTag = async (oldTag: string, newTag: string | null) => {
    const trimmed = newTag?.trim()
    if (newTag !== null && !trimmed) return
    if (trimmed === oldTag) {
      setEditing(null)
      return
    }

    setBusy(true)
    try {
      const affected = notes.filter((n) => (n.tags || []).includes(oldTag))
      await Promise.all(
        affected.map(async (n) => {
          const next = trimmed
            ? (n.tags || []).map((t) => (t === oldTag ? trimmed : t))
            : (n.tags || []).filter((t) => t !== oldTag)
          const { error } = await supabase.from('notes').update({ tags: next }).eq('id', n.id)
          if (error) throw error
        })
      )

      setNotes(
        notes.map((n) => {
          if (!(n.tags || []).includes(oldTag)) return n
          const next = trimmed
            ? (n.tags || []).map((t) => (t === oldTag ? trimmed : t))
            : (n.tags || []).filter((t) => t !== oldTag)
          return { ...n, tags: next }
        })
      )
      toast.success(trimmed ? `Renamed to #${trimmed}` : `Deleted #${oldTag}`)
    } catch {
      toast.error('Failed to update tag')
    } finally {
      setBusy(false)
      setEditing(null)
      setValue('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#059669]" />
            Manage Tags
          </DialogTitle>
          <DialogDescription>
            Rename or delete a tag everywhere it is used. Changes apply to all your notes.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-1.5 mt-2">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tags yet.</p>
          ) : (
            tags.map((tag) => (
              <div key={tag} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                {editing === tag ? (
                  <>
                    <Input
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyTag(tag, value)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="h-8 text-sm"
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => applyTag(tag, value)} disabled={busy}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditing(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">#{tag}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={`Rename ${tag}`}
                      onClick={() => {
                        setEditing(tag)
                        setValue(tag)
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Delete ${tag}`}
                      onClick={() => applyTag(tag, null)}
                      disabled={busy}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
