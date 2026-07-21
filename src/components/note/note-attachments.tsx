'use client'

import { File, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NoteAttachmentsProps {
  attachments?: Array<{
    id: string
    filename: string
    storagePath: string
    mimeType?: string
  }>
  onDownload: (storagePath: string, filename: string) => void
  onDelete: (id: string, storagePath: string) => void
}

export function NoteAttachments({ attachments, onDownload, onDelete }: NoteAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div key={att.id} className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-lg p-2 pl-3 group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-muted/80 opacity-0 group-hover:opacity-100 transition-opacity" />
          <File className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium truncate max-w-[150px] relative z-10">{att.filename}</span>
          <div className="flex items-center ml-2 relative z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/20"
              onClick={() => onDownload(att.storagePath, att.filename)}
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
              onClick={() => onDelete(att.id, att.storagePath)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
