'use client'

import { useEffect, useState } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { flushQueue, queueLength } from '@/lib/offline-queue'
import { toast } from 'sonner'
import { WifiOff, RefreshCw } from 'lucide-react'
import { t } from '@/lib/i18n'

/**
 * Shows when the browser is offline and flushes queued writes on reconnect.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const update = () => setPending(queueLength())
    update()
    window.addEventListener('quillfox-queue-change', update)
    return () => window.removeEventListener('quillfox-queue-change', update)
  }, [])

  useEffect(() => {
    if (!online) return
    let cancelled = false
    ;(async () => {
      const applied = await flushQueue()
      if (cancelled) return
      setPending(queueLength())
      if (applied > 0) {
        toast.success(`Synced ${applied} offline change${applied === 1 ? '' : 's'}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [online])

  if (online && pending === 0) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border-b border-amber-500/20"
    >
      {online ? <RefreshCw className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {online
        ? t('offline.pending', { count: pending })
        : t('offline.title')}
    </div>
  )
}
