'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import {
  decryptNoteTitle,
  decryptNoteContent,
  decryptTodoTitle,
  decryptWorkspaceTitle,
} from '@/lib/encrypted-api'
import { searchDocuments, splitHighlight, type SearchDoc, type SearchFilters } from '@/lib/search'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, FileText, ListTodo, Loader2, Search } from 'lucide-react'

type TypeFilter = 'all' | 'note' | 'todo'

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = splitHighlight(text, query)
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-[#059669]/25 text-foreground rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

function snippet(content: string, query: string, max = 160): string {
  if (!content) return ''
  const lower = content.toLowerCase()
  const firstTerm = query.trim().toLowerCase().split(/\s+/)[0]
  const idx = firstTerm ? lower.indexOf(firstTerm) : -1
  if (idx === -1) return content.slice(0, max)
  const start = Math.max(0, idx - 40)
  return `${start > 0 ? '…' : ''}${content.slice(start, start + max)}${start + max < content.length ? '…' : ''}`
}

export function SearchView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const router = useRouter()

  const [docs, setDocs] = useState<SearchDoc[]>([])
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({})
  const [isIndexing, setIsIndexing] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState('')

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth')
      return
    }
    let cancelled = false
    setIsIndexing(true)
    ;(async () => {
      const noteDocs = await Promise.all(
        notes.map(async (n) => ({
          id: n.id,
          type: 'note' as const,
          title: await decryptNoteTitle(n.title, n.workspaceId).catch(() => n.title),
          content: await decryptNoteContent(n.content || '', n.workspaceId).catch(() => n.content || ''),
          tags: n.tags || [],
          workspaceId: n.workspaceId ?? null,
          folderId: n.folderId ?? null,
          updatedAt: n.updatedAt,
        }))
      )
      const todoDocs = await Promise.all(
        todoLists.map(async (t) => {
          const title = await decryptTodoTitle(t.title, t.workspaceId).catch(() => t.title)
          const itemTitles = await Promise.all(
            (t.items || []).map((item) =>
              decryptTodoTitle(item.title, t.workspaceId).catch(() => item.title)
            )
          )
          return {
            id: t.id,
            type: 'todo' as const,
            title,
            content: itemTitles.join('\n'),
            tags: (t as { tags?: string[] }).tags || [],
            workspaceId: t.workspaceId ?? null,
            folderId: t.folderId ?? null,
            updatedAt: t.updatedAt,
          }
        })
      )
      if (!cancelled) {
        setDocs([...noteDocs, ...todoDocs])
        setIsIndexing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUser, notes, todoLists, router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        workspaces.map(async (w) => [
          w.id,
          await decryptWorkspaceTitle(w.title, w.id).catch(() => w.title),
        ] as const)
      )
      if (!cancelled) setWorkspaceNames(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [workspaces])

  const filters: SearchFilters = useMemo(
    () => ({
      types: typeFilter === 'all' ? undefined : [typeFilter],
      workspaceId: workspaceFilter === 'all' ? null : workspaceFilter,
      tag: tagFilter.trim() || null,
    }),
    [typeFilter, workspaceFilter, tagFilter]
  )

  const results = useMemo(
    () => searchDocuments(docs, query, filters).slice(0, 100),
    [docs, query, filters]
  )

  const workspaceName = useCallback(
    (id: string | null) => {
      if (!id) return null
      return workspaceNames[id] || null
    },
    [workspaceNames]
  )

  const open = (doc: SearchDoc) => {
    router.push(doc.type === 'note' ? `/dashboard/notes/${doc.id}` : `/dashboard/todos/${doc.id}`)
  }

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
              <Search className="w-4 h-4 text-[#059669]" />
              <h1 className="text-sm font-semibold tracking-tight">Search</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, content, and tags…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex rounded-lg border border-border/60 p-0.5">
                {(['all', 'note', 'todo'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      typeFilter === t ? 'bg-[#059669]/15 text-[#059669] font-medium' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'note' ? 'Notes' : 'Todos'}
                  </button>
                ))}
              </div>

              <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workspaces</SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workspaceNames[w.id] || w.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Filter by tag…"
                className="h-8 w-[150px] text-xs"
              />
            </div>

            {isIndexing ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : query.trim() === '' ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Start typing to search across your encrypted notes and todos.
              </p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No results for &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">{results.length} result{results.length === 1 ? '' : 's'}</p>
                {results.map((r) => {
                  const wsName = workspaceName(r.doc.workspaceId)
                  return (
                    <button
                      key={`${r.doc.type}-${r.doc.id}`}
                      type="button"
                      onClick={() => open(r.doc)}
                      className="w-full text-left rounded-xl border border-border/50 bg-card/50 p-3 hover:border-[#059669]/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {r.doc.type === 'note' ? (
                          <FileText className="w-4 h-4 text-[#059669] shrink-0" />
                        ) : (
                          <ListTodo className="w-4 h-4 text-[#d97706] shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                          <Highlight text={r.doc.title || 'Untitled'} query={query} />
                        </span>
                        {wsName && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {wsName}
                          </Badge>
                        )}
                      </div>
                      {r.doc.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                          <Highlight text={snippet(r.doc.content, query)} query={query} />
                        </p>
                      )}
                      {r.doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pl-6">
                          {r.doc.tags.map((tag) => (
                            <span key={tag} className="text-[10px] rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
