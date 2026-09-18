'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { fetchSharedItem, type SharedItem } from '@/lib/share-links'
import { PenLine, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'

type Status = 'loading' | 'ok' | 'error' | 'nokey'

export default function SharedItemPage() {
  const params = useParams()
  const token = params?.token as string | undefined
  const [item, setItem] = useState<SharedItem | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    const match = window.location.hash.match(/k=([^&]+)/)
    if (!match) {
      setStatus('nokey')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const result = await fetchSharedItem(token, decodeURIComponent(match[1]))
        if (cancelled) return
        if (result) {
          setItem(result)
          setStatus('ok')
        } else {
          setStatus('error')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center">
            <PenLine className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold">QuillFox · Shared</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" /> Decrypted on your device
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {status === 'nokey' && (
          <div className="text-center py-24">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
            <h1 className="text-lg font-semibold">Decryption key missing</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              This link is missing the part after &ldquo;#&rdquo; that contains the decryption key. Ask
              the sender for the complete link.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-24">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive" />
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              This share link is invalid, expired or has been revoked.
            </p>
          </div>
        )}

        {status === 'ok' && item && (
          <article>
            <h1 className="text-2xl font-bold mb-4">{item.title || 'Untitled'}</h1>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
              {item.content || (item.type === 'todo' ? 'Shared task list' : '')}
            </pre>
          </article>
        )}
      </main>
    </div>
  )
}
