'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Share2, Copy, Loader2 } from 'lucide-react'
import { createShareLink } from '@/lib/share-links'
import { toast } from 'sonner'

interface ShareLinkButtonProps {
  entityType: 'note' | 'todo'
  entityId: string
  workspaceId: string | null
  size?: 'sm' | 'default'
}

export function ShareLinkButton({ entityType, entityId, workspaceId, size = 'sm' }: ShareLinkButtonProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const result = await createShareLink(entityType, entityId, workspaceId)
      if (result) {
        setUrl(result.url)
        setOpen(true)
      } else {
        toast.error('Unable to create a share link')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <>
      <Button variant="outline" size={size} className="gap-1.5" onClick={handleCreate} disabled={isCreating}>
        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Read-only share link</DialogTitle>
            <DialogDescription>
              Anyone with this link can view the content. The decryption key is in the part after
              &ldquo;#&rdquo; and is never sent to our servers or stored in the database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button size="icon" onClick={copy} aria-label="Copy link">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
