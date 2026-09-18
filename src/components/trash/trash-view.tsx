'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'
import { decryptNoteTitle, decryptTodoTitle } from '@/lib/encrypted-api'
import { restoreNote, purgeNote, restoreTodoList, purgeTodoList, purgeExpiredTrash } from '@/lib/trash'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppSidebar } from '@/components/shared/app-sidebar'
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
import { motion } from 'framer-motion'
import { Trash2, RotateCcw, FileText, ListTodo, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TrashItem {
  id: string
  type: 'note' | 'todo'
  title: string
  deletedAt: string
}

export function TrashView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const router = useRouter()
  const [items, setItems] = useState<TrashItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [emptyOpen, setEmptyOpen] = useState(false)

  const load = useCallback(async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      // Enforce the retention window before listing.
      await purgeExpiredTrash().catch(() => {})

      const [notesRes, todosRes] = await Promise.all([
        supabase.from('notes').select('id,title,workspace_id,deleted_at').not('deleted_at', 'is', null).limit(200),
        supabase.from('todo_lists').select('id,title,workspace_id,deleted_at').not('deleted_at', 'is', null).limit(200),
      ])

      const notes = await Promise.all(
        (notesRes.data ?? []).map(async (n: any) => ({
          id: n.id,
          type: 'note' as const,
          title: await decryptNoteTitle(n.title, n.workspace_id).catch(() => n.title),
          deletedAt: n.deleted_at,
        }))
      )
      const todos = await Promise.all(
        (todosRes.data ?? []).map(async (t: any) => ({
          id: t.id,
          type: 'todo' as const,
          title: await decryptTodoTitle(t.title, t.workspace_id).catch(() => t.title),
          deletedAt: t.deleted_at,
        }))
      )

      const merged = [...notes, ...todos].sort(
        (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      )
      setItems(merged)
    } catch {
      toast.error('Failed to load trash')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth')
      return
    }
    load()
  }, [currentUser, load, router])

  const handleRestore = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      if (item.type === 'note') await restoreNote(item.id)
      else await restoreTodoList(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('Restored')
    } catch {
      toast.error('Failed to restore')
    } finally {
      setBusyId(null)
    }
  }

  const handlePurge = async (item: TrashItem) => {
    setBusyId(item.id)
    try {
      if (item.type === 'note') await purgeNote(item.id)
      else await purgeTodoList(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success('Deleted forever')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setBusyId(null)
    }
  }

  const handleEmptyTrash = async () => {
    setBusyId('__all__')
    try {
      await Promise.all([
        ...items.filter((i) => i.type === 'note').map((i) => purgeNote(i.id)),
        ...items.filter((i) => i.type === 'todo').map((i) => purgeTodoList(i.id)),
      ])
      setItems([])
      toast.success('Trash emptied')
    } catch {
      toast.error('Failed to empty trash')
    } finally {
      setBusyId(null)
      setEmptyOpen(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Trash</h1>
                <p className="text-sm text-muted-foreground">
                  Deleted notes and lists stay here until you remove them permanently.
                </p>
              </div>
            </div>
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setEmptyOpen(true)} className="text-destructive">
                Empty trash
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : items.length === 0 ? (
            <Card className="rounded-xl border-border/50">
              <CardContent className="py-16 text-center">
                <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Trash is empty.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="rounded-xl border-border/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      {item.type === 'note' ? (
                        <FileText className="w-4 h-4 text-[#059669] shrink-0" aria-hidden="true" />
                      ) : (
                        <ListTodo className="w-4 h-4 text-[#d97706] shrink-0" aria-hidden="true" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">
                          Deleted {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(item)}
                        disabled={busyId === item.id}
                        className="gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePurge(item)}
                        disabled={busyId === item.id}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {items.length} item(s). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}