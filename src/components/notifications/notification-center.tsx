'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { fetchReminders, deleteReminderForEntity, type ReminderRecord } from '@/lib/reminders'
import { decryptNoteContent } from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Bell, BellRing, FileText, ListTodo, Loader2, X, ArrowLeft, Check } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export function NotificationCenter() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const router = useRouter()

  const [reminders, setReminders] = useState<ReminderRecord[]>([])
  const [mentions, setMentions] = useState<Array<{ id: string; entityType: 'note' | 'todo'; entityId: string; content: string; createdAt: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')

  const load = useCallback(async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      setReminders(await fetchReminders())

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('comments')
        .select('id, entity_type, entity_id, workspace_id, content, mentions, author_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50)
      const myName = currentUser.name?.toLowerCase()
      const mine = (data ?? []).filter(
        (cm: any) =>
          cm.author_id !== currentUser.id &&
          Array.isArray(cm.mentions) &&
          myName &&
          cm.mentions.some((m: string) => m.toLowerCase() === myName)
      )
      const decrypted = await Promise.all(
        mine.map(async (cm: any) => ({
          id: cm.id,
          entityType: cm.entity_type as 'note' | 'todo',
          entityId: cm.entity_id,
          content: await decryptNoteContent(cm.content, cm.workspace_id).catch(() => cm.content),
          createdAt: cm.created_at,
        }))
      )
      setMentions(decrypted)
    } catch {
      toast.error('Failed to load reminders')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth')
      return
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    } else {
      setPermission('unsupported')
    }
    load()
  }, [currentUser, load, router])

  const titleFor = (r: ReminderRecord) => {
    const entity =
      r.entityType === 'note'
        ? notes.find((n) => n.id === r.entityId)
        : todoLists.find((t) => t.id === r.entityId)
    return entity?.title || (r.entityType === 'note' ? 'Untitled note' : 'Untitled task list')
  }

  const handleOpen = (r: ReminderRecord) => {
    if (r.entityType === 'note') router.push(`/dashboard/notes/${r.entityId}`)
    else router.push(`/dashboard/todos/${r.entityId}`)
  }

  const handleCancel = async (r: ReminderRecord) => {
    setBusyId(r.id)
    try {
      await deleteReminderForEntity(r.entityType, r.entityId)
      setReminders((prev) => prev.filter((x) => x.id !== r.id))
      toast.success('Reminder removed')
    } catch {
      toast.error('Failed to remove reminder')
    } finally {
      setBusyId(null)
    }
  }

  const requestPermission = async () => {
    if (permission === 'unsupported') return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') toast.success('Browser reminders enabled')
    } catch {
      // ignore
    }
  }

  const now = Date.now()

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="shrink-0 h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#059669]" />
              <h1 className="text-sm font-semibold tracking-tight">Notification Center</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
            {permission !== 'granted' && permission !== 'unsupported' && (
              <Card className="mb-6 border-[#059669]/30 bg-[#059669]/5">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <BellRing className="w-5 h-5 text-[#059669] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Enable browser reminders</p>
                      <p className="text-xs text-muted-foreground">
                        Get notified about due notes and tasks while QuillFox is open.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={requestPermission} className="shrink-0">
                    Enable
                  </Button>
                </CardContent>
              </Card>
            )}

            {mentions.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Mentions
                </h2>
                <div className="space-y-2">
                  {mentions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          m.entityType === 'note'
                            ? `/dashboard/notes/${m.entityId}`
                            : `/dashboard/todos/${m.entityId}`
                        )
                      }
                      className="w-full text-left rounded-xl border border-[#d97706]/30 bg-[#d97706]/5 p-3 hover:border-[#d97706]/50 transition-colors"
                    >
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Bell className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground max-w-sm">
                  No reminders yet. Add a due date to a note or todo list to create one.
                </p>
              </div>
            ) : (
              <motion.div initial="hidden" animate="visible" className="space-y-2">
                {reminders.map((r) => {
                  const overdue = new Date(r.remindAt).getTime() <= now
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 hover:border-[#059669]/30 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpen(r)}
                        className="flex flex-1 items-center gap-3 min-w-0 text-left"
                      >
                        {r.entityType === 'note' ? (
                          <FileText className="w-5 h-5 text-[#059669] shrink-0" />
                        ) : (
                          <ListTodo className="w-5 h-5 text-[#059669] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{titleFor(r)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.remindAt), 'MMM d, yyyy · h:mm a')}
                            {r.recurrence !== 'none' ? ` · repeats ${r.recurrence}` : ''}
                          </p>
                        </div>
                      </button>
                      <Badge variant={overdue ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                        {overdue ? 'Overdue' : formatDistanceToNow(new Date(r.remindAt), { addSuffix: true })}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove reminder"
                        onClick={() => handleCancel(r)}
                        disabled={busyId === r.id}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </Button>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {permission === 'granted' && (
              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-[#059669]" /> Browser reminders are enabled
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
