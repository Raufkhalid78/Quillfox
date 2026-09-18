'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { decryptNoteTitle, decryptTodoTitle, decryptWorkspaceTitle } from '@/lib/encrypted-api'
import { FileText, ListTodo, Layers, Search, CornerDownLeft } from 'lucide-react'

interface Result {
  id: string
  type: 'note' | 'todo' | 'workspace'
  title: string
  subtitle?: string
  href: string
}

/**
 * Global search palette. Content is end-to-end encrypted, so search runs
 * entirely on the client over decrypted titles.
 */
export function CommandPalette() {
  const router = useRouter()
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<{ notes: Result[]; todos: Result[]; workspaces: Result[] }>({
    notes: [],
    todos: [],
    workspaces: [],
  })
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+K opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  // Build a decrypted index when the palette opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [n, t, w] = await Promise.all([
        Promise.all(
          notes.map(async (note) => ({
            id: note.id,
            type: 'note' as const,
            title: await decryptNoteTitle(note.title, note.workspaceId).catch(() => note.title),
            subtitle: note.isArchived ? 'Archived note' : 'Note',
            href: `/dashboard/notes/${note.id}`,
          }))
        ),
        Promise.all(
          todoLists.map(async (todo) => ({
            id: todo.id,
            type: 'todo' as const,
            title: await decryptTodoTitle(todo.title, todo.workspaceId).catch(() => todo.title),
            subtitle: todo.isArchived ? 'Archived list' : 'Todo list',
            href: `/dashboard/todos/${todo.id}`,
          }))
        ),
        Promise.all(
          workspaces.map(async (ws) => ({
            id: ws.id,
            type: 'workspace' as const,
            title: await decryptWorkspaceTitle(ws.title, ws.id).catch(() => ws.title),
            subtitle: 'Workspace',
            href: `/dashboard/workspaces/${ws.id}`,
          }))
        ),
      ])
      if (!cancelled) {
        setIndex({ notes: n, todos: t, workspaces: w })
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, notes, todoLists, workspaces])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...index.notes, ...index.todos, ...index.workspaces]
    if (!q) return all.slice(0, 8)
    return all.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 12)
  }, [query, index])

  useEffect(() => setActive(0), [query])

  const go = useCallback(
    (result: Result | undefined) => {
      if (!result) return
      setOpen(false)
      setQuery('')
      router.push(result.href)
    },
    [router]
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    }
  }

  const iconFor = (type: Result['type']) => {
    if (type === 'note') return <FileText className="w-4 h-4 text-[#059669]" />
    if (type === 'todo') return <ListTodo className="w-4 h-4 text-[#d97706]" />
    return <Layers className="w-4 h-4 text-[#6d28d9]" />
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 sm:max-w-xl overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/60 px-4">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notes, todos, workspaces…"
            aria-label="Search"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Decrypting your vault…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query ? 'No matches found.' : 'Start typing to search.'}
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-muted' : 'hover:bg-muted/60'
                }`}
              >
                {iconFor(r.type)}
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title || 'Untitled'}</span>
                  <span className="block text-xs text-muted-foreground">{r.subtitle}</span>
                </span>
                {i === active && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}