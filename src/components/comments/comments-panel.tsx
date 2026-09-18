'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'
import { fetchComments, addComment, deleteComment, parseMentions, type Comment } from '@/lib/comments'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react'

interface CommentsPanelProps {
  entityType: 'note' | 'todo'
  entityId: string
  workspaceId: string | null
  /** When true, only render the list (no composer). */
  readOnly?: boolean
}

function initials(name?: string | null) {
  return name ? name.substring(0, 2).toUpperCase() : '?'
}

export function CommentsPanel({ entityType, entityId, workspaceId, readOnly }: CommentsPanelProps) {
  const currentUser = useAppStore((s) => s.currentUser)
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!entityId) return
    setIsLoading(true)
    try {
      setComments(await fetchComments(entityType, entityId, workspaceId))
    } finally {
      setIsLoading(false)
    }
  }, [entityType, entityId, workspaceId])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: refresh when a comment for this entity changes.
  useEffect(() => {
    if (!entityId) return
    const channel = supabase
      .channel(`comments-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `entity_id=eq.${entityId}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [entityType, entityId, load])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || isSending) return
    setIsSending(true)
    try {
      const created = await addComment({
        entityType,
        entityId,
        workspaceId,
        content: text,
        mentions: parseMentions(text),
      })
      if (created) {
        setComments((prev) => [...prev, created])
        setDraft('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        toast.error('Failed to post comment')
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await deleteComment(id)
    if (ok) setComments((prev) => prev.filter((c) => c.id !== id))
    else toast.error('Failed to delete comment')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="w-4 h-4 text-[#059669]" />
        Comments
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No comments yet. Start the conversation.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                {c.author?.image && <AvatarImage src={c.author.image} alt="" />}
                <AvatarFallback className="text-[10px] bg-[#059669]/10 text-[#059669]">
                  {initials(c.author?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {c.author?.name || 'Someone'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
              {!readOnly && c.authorId === currentUser?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete comment"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment… use @name to mention someone"
            className="min-h-[38px] text-sm resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button size="icon" onClick={handleSend} disabled={isSending || !draft.trim()} aria-label="Send comment">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
