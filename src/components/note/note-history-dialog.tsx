'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { decryptNoteTitle, decryptNoteContent, encryptNoteTitle, encryptNoteContent } from '@/lib/encrypted-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

export function NoteHistoryDialog({
  open,
  onOpenChange,
  selectedNoteId,
  workspaceId,
  currentTitle,
  currentContent,
  onRestore,
}: NoteHistoryDialogProps) {
  const [versions, setVersions] = useState<any[]>([])
  const [decryptedVersions, setDecryptedVersions] = useState<any[]>([])

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

      const formatted = data.map((v: any) => ({
        id: v.id,
        title: v.title,
        content: v.content,
        version: v.version,
        createdAt: v.created_at,
      }))

      const decrypted = await Promise.all(formatted.map(async (v: any) => ({
        ...v,
        title: await decryptNoteTitle(v.title, workspaceId),
        content: await decryptNoteContent(v.content || '', workspaceId),
      })))

      setDecryptedVersions(decrypted)
      setVersions(formatted)
    } catch {
      toast.error('Failed to load history')
    }
  }, [selectedNoteId, workspaceId])

  useEffect(() => {
    if (open && selectedNoteId) {
      loadHistory()
    }
  }, [open, selectedNoteId, loadHistory])

  const handleSaveVersion = async () => {
    if (!selectedNoteId) return
    try {
      const encryptedTitle = await encryptNoteTitle(currentTitle, workspaceId)
      const encryptedContent = await encryptNoteContent(currentContent, workspaceId)
      
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
        title: currentTitle,
        content: currentContent,
      }, ...prev])
      toast.success('Version saved')
    } catch {
      toast.error('Failed to save version')
    }
  }

  const handleRestoreVersion = async (versionId: string) => {
    const decrypted = decryptedVersions.find((v) => v.id === versionId)
    if (!decrypted) return
    onRestore(decrypted.title, decrypted.content)
    onOpenChange(false)
  }

  return (
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
  )
}
