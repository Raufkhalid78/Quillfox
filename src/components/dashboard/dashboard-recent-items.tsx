import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { FileText, StickyNote, ListTodo, CheckSquare, ChevronRight, Clock, ShieldCheck, CalendarDays } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { getDueDateColor } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

interface DashboardRecentItemsProps {
  totalNotes: number
  totalTodos: number
  recentNotes: any[]
  recentTodos: any[]
  decryptedNotes: Map<string, { title: string; preview: string; updatedAt: string }>
  decryptedTodos: Map<string, { title: string; updatedAt: string }>
  isEncryptedSession: boolean
}

export function DashboardRecentItems({
  totalNotes,
  totalTodos,
  recentNotes,
  recentTodos,
  decryptedNotes,
  decryptedTodos,
  isEncryptedSession
}: DashboardRecentItemsProps) {
  const router = useRouter()
  const hidePreviews = useAppStore((s) => s.hidePreviews)

  return (
    <motion.div variants={fadeUp}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Recent Notes Column */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Recent Notes
            </h3>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => router.push('/dashboard/notes')}>
              View all {totalNotes > 0 && `(${totalNotes})`}
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {recentNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
              <StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notes yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first note to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {recentNotes.map((note, index) => {
                  const decrypted = decryptedNotes.get(note.id)
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                    >
                      <button
                        onClick={() => router.push(`/dashboard/notes/${note.id}`)}
                        className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 transition-all duration-200 p-3.5 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#059669]/8 dark:bg-[#059669]/15 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5 text-[#059669]/70 dark:text-[#34d399]/70" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium line-clamp-1">{decrypted?.title || note.title}</p>
                              {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{hidePreviews ? '••••••••' : (decrypted?.preview || 'Empty note...')}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {note.dueDate && (
                                <div className={`flex items-center gap-1 shrink-0 ${getDueDateColor(note.dueDate)}`}>
                                  <CalendarDays className="w-3 h-3" />
                                  <span className="text-[10px]">{format(new Date(note.dueDate), 'MMM d, yyyy')}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/50">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px]">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Recent Todos Column */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-rose-500" />
              Recent Todos
            </h3>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1" onClick={() => router.push('/dashboard/todos')}>
              View all {totalTodos > 0 && `(${totalTodos})`}
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {recentTodos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
              <CheckSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No todo lists yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create your first list to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {recentTodos.map((todo, index) => {
                  const completed = todo.items.filter((i: any) => i.completed).length
                  const total = todo.items.length
                  const progress = total > 0 ? (completed / total) * 100 : 0
                  const decryptedTitle = decryptedTodos.get(todo.id)?.title || todo.title
                  return (
                    <motion.div
                      key={todo.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                    >
                      <button
                        onClick={() => router.push(`/dashboard/todos/${todo.id}`)}
                        className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 transition-all duration-200 p-3.5 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#d97706]/8 dark:bg-[#d97706]/15 flex items-center justify-center shrink-0">
                            <ListTodo className="w-3.5 h-3.5 text-[#d97706]/70 dark:text-[#fbbf24]/70" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium line-clamp-1">{decryptedTitle}</p>
                              {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#d97706]/50 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-[#d97706] to-[#f59e0b]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.6, delay: index * 0.06 }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">{completed}/{total}</span>
                              <span className="text-[10px] font-semibold text-[#d97706] dark:text-[#fbbf24] tabular-nums shrink-0">{Math.round(progress)}%</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {todo.dueDate && (
                                <div className={`flex items-center gap-1 shrink-0 ${getDueDateColor(todo.dueDate)}`}>
                                  <CalendarDays className="w-3 h-3" />
                                  <span className="text-[10px]">{format(new Date(todo.dueDate), 'MMM d, yyyy')}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/50">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px]">{formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </motion.div>
  )
}
