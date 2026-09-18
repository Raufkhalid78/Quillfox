'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { decryptNoteTitle, decryptNoteContent, encryptNoteTitle, encryptNoteContent } from '@/lib/encrypted-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface NoteHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNoteId: string
  workspaceId?: string | null
  currentTitle: string
  currentContent: string
  onRestore: (title: string, content: string) => void
}

type DiffLine = { type: 'added' | 'removed' | 'context'; text: string }

/**
 * Minimal LCS line diff so users can preview what a restore will change before
 * confirming. Inputs are note-sized, so the O(n*m) table is fine.
 */
function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'context', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'removed', text: a[i] })
      i++
    } else {
      out.push({ type: 'added', text: b[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'removed', text: a[i++] })
  while (j < m) out.push({ type: 'added', text: b[j++] })
  return out
}

const DIFF_PREVIEW_LIMIT = 40

function DiffPreview({ current, target }: { current: string; target: string }) {
  const lines = diffLines(current, target)
  const changed = lines.filter((l) => l.type !== 'context').length
  const shown = lines.slice(0, DIFF_PREVIEW_LIMIT)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {changed === 0 ? 'No text changes' : `${changed} changed line${changed === 1 ? '' : 's'}`}
      </p>
      <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
        {shown.map((line, idx) => (
          <div
            key={idx}
            className={
              line.type === 'added'
                ? 'text-emerald-600 dark:text-emerald-400'
                : line.type === 'removed'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
            }
          >
            <span className="select-none pr-1 opacity-60">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.text || '\u00a0'}
          </div>
        ))}
        {lines.length > DIFF_PREVIEW_LIMIT && (
          <div className="pt-1 text-muted-foreground opacity-70">
            … {lines.length - DIFF_PREVIEW_LIMIT} more lines
          </div>
        )}
      </div>
    </div>
  )
}


export function NoteHistoryDialog({
  open,
  onOpenChange,
  selectedNoteId,
  workspaceId,
  currentTitle,
  currentContent,
  onRestore,
}: NoteHistoryDialogProps) {
  const [decryptedVersions, setDecryptedVersions] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<any | null>(null)

  const loadHistory = useCallback(async () => {
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

      const decrypted = await Promise.all(
        (data ?? []).map(async (v: any) => ({
          id: v.id,
          version: v.version,
          createdAt: v.created_at,
          title: await decryptNoteTitle(v.title, workspaceId),
          content: await decryptNoteContent(v.content || '', workspaceId),
        }))
      )

      setDecryptedVersions(decrypted)
    } catch {
      toast.error('Failed to load history')
    }
  }, [selectedNoteId, workspaceId])

  useEffect(() => {
    if (open && selectedNoteId) {
      loadHistory()
    }
  }, [open, selectedNoteId, loadHistory])

  /**
   * Persists the note's current title/content as a new version.
   * Returns the created version, or null on failure.
   */
  const saveCurrentAsVersion = useCallback(
    async (notify = true) => {
      if (!selectedNoteId) return null
      const encryptedTitle = await encryptNoteTitle(currentTitle, workspaceId)
      const encryptedContent = await encryptNoteContent(currentContent, workspaceId)

      // Retry once on a version-number race (UNIQUE(note_id, version)).
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: latest } = await supabase
          .from('note_versions')
          .select('version')
          .eq('note_id', selectedNoteId)
          .order('version', { ascending: false })
          .limit(1)

        const nextVer = (latest && latest.length > 0 ? latest[0].version : 0) + 1
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

        if (!error && newVer) {
          const formatted = {
            id: newVer.id,
            version: newVer.version,
            createdAt: newVer.created_at,
            title: currentTitle,
            content: currentContent,
          }
          setDecryptedVersions((prev) => [formatted, ...prev])
          if (notify) toast.success('Version saved')
          return formatted
        }

        // Unique-violation → retry; otherwise give up.
        if (error && error.code !== '23505') break
      }

      if (notify) toast.error('Failed to save version')
      return null
    },
    [selectedNoteId, workspaceId, currentTitle, currentContent]
  )

  const handleSaveVersion = async () => {
    setIsSaving(true)
    try {
      await saveCurrentAsVersion()
    } finally {
      setIsSaving(false)
    }
  }

  const confirmRestore = async () => {
    if (!pendingRestore) return
    setIsSaving(true)
    try {
      // Snapshot the current content first so a restore is reversible.
      await saveCurrentAsVersion(false)
      onRestore(pendingRestore.title, pendingRestore.content)
      toast.success(`Restored version v${pendingRestore.version}`)
      setPendingRestore(null)
      onOpenChange(false)
    } catch {
      toast.error('Failed to restore version')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
              disabled={isSaving}
            >
              Save Current Version
            </Button>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {decryptedVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No versions saved yet. Click &ldquo;Save Current Version&rdquo; to create a snapshot.
                </p>
              ) : (
                decryptedVersions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-[#059669]/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          v{v.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate mt-1">{v.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.content.substring(0, 80)}...</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPendingRestore(v)} disabled={isSaving}>
                      Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingRestore} onOpenChange={(o) => !o && setPendingRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version v{pendingRestore?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current note will be saved as a new version first, so you can undo this restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingRestore && (
            <div className="space-y-3">
              {pendingRestore.title !== currentTitle && (
                <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                  <span className="text-muted-foreground">Title: </span>
                  <span className="text-red-600 dark:text-red-400 line-through">{currentTitle}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="text-emerald-600 dark:text-emerald-400">{pendingRestore.title}</span>
                </div>
              )}
              <DiffPreview current={currentContent} target={pendingRestore.content} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={isSaving}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}