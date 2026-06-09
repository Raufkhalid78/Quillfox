'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteTitle, decryptNoteTitle, decryptNoteContent } from '@/lib/encrypted-api'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Plus, FileText, Clock, ShieldCheck, PenLine, LogOut, Sun, Moon, StickyNote, Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow } from 'date-fns'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

export function NotesList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const workspaces = useAppStore((s) => s.workspaces)
  const selectNote = useAppStore((s) => s.selectNote)
  const addNote = useAppStore((s) => s.addNote)
  const setNotes = useAppStore((s) => s.setNotes)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWorkspace, setNewWorkspace] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12
  const { theme, setTheme } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)

  const [decryptedNotes, setDecryptedNotes] = useState<Map<string, { title: string; preview: string }>>(new Map())

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/notes?userId=${currentUser.id}`)
      if (res.ok) setNotes(await res.json())
    } catch {
      toast.error('Failed to load notes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [currentUser, setNotes])

  useEffect(() => {
    const decryptData = async () => {
      const noteMap = new Map<string, { title: string; preview: string }>()
      await Promise.all(
        notes.map(async (n) => {
          const title = await decryptNoteTitle(n.title)
          const preview = await decryptNoteContent(n.content.substring(0, 120))
          noteMap.set(n.id, { title, preview: preview || 'Empty note...' })
        })
      )
      setDecryptedNotes(noteMap)
    }
    if (!isLoading) decryptData()
  }, [notes, isLoading])

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleCreate = async () => {
    if (!currentUser) return
    const plainTitle = newTitle.trim() || 'Untitled Note'
    try {
      const encryptedTitle = await encryptNoteTitle(plainTitle)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: encryptedTitle, authorId: currentUser.id, workspaceId: newWorkspace || null }),
      })
      const data = await res.json()
      if (res.ok) {
        addNote(data)
        setCreateOpen(false)
        setNewTitle('')
        setNewWorkspace('')
        selectNote(data.id)
        toast.success('Note created')
      }
    } catch {
      toast.error('Failed to create note')
    }
  }

  if (!currentUser) return null

  const activeNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => {
      // Pinned items first, then by updatedAt desc
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const filteredNotes = searchQuery
    ? activeNotes.filter((n) => {
        const decrypted = decryptedNotes.get(n.id)
        return decrypted?.title.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : activeNotes

  const totalPages = Math.ceil(filteredNotes.length / PAGE_SIZE)
  const paginatedNotes = filteredNotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const paginationStart = (page - 1) * PAGE_SIZE + 1
  const paginationEnd = Math.min(page * PAGE_SIZE, filteredNotes.length)

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="notes" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
              <PenLine className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">All Notes</h1>
              <Badge variant="secondary" className="text-[10px] font-normal">{activeNotes.length}</Badge>
            </div>
            {isEncryptedSession && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#059669] bg-[#059669]/10 border-[#059669]/20 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">E2E</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>End-to-end encryption active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="relative max-w-[200px] sm:max-w-[280px] mx-3 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg pl-8"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90 rounded-lg text-xs h-8"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Note</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" ref={contentRef}>
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl border border-border/30 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : activeNotes.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#059669]/10 flex items-center justify-center mb-4">
                  <StickyNote className="w-8 h-8 text-[#059669]/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No notes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first note to get started</p>
                <Button
                  className="gap-2 bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90 rounded-xl"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create Note
                </Button>
              </motion.div>
            ) : filteredNotes.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No notes match your search</h3>
                <p className="text-sm text-muted-foreground mb-4">Try a different search term</p>
              </motion.div>
            ) : (
              <>
              <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-2">
                {paginatedNotes.map((note) => {
                  const decrypted = decryptedNotes.get(note.id)
                  const ws = workspaces.find((w) => w.id === note.workspaceId)
                  return (
                    <motion.div key={note.id} variants={fadeUp}>
                      <button
                        onClick={() => selectNote(note.id)}
                        className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 transition-all duration-200 p-4 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#059669]/8 dark:bg-[#059669]/15 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-[#059669]/70 dark:text-[#34d399]/70" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium line-clamp-1">{decrypted?.title || note.title}</p>
                              {isEncryptedSession && <ShieldCheck className="w-3 h-3 text-[#059669]/50 shrink-0" />}
                              {note.isPinned && <span className="text-[10px] text-muted-foreground">📌</span>}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{decrypted?.preview || 'Empty note...'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {ws && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                  {ws.title}
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-muted-foreground/50">
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
              </motion.div>
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {paginationStart}–{paginationEnd} of {filteredNotes.length}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => page > 1 && handlePageChange(page - 1)}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={p === page}
                                onClick={() => handlePageChange(p)}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        }
                        if (p === 2 && page > 4) {
                          return (
                            <PaginationItem key={`ellipsis-start-${p}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        if (p === totalPages - 1 && page < totalPages - 3) {
                          return (
                            <PaginationItem key={`ellipsis-end-${p}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return null
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => page < totalPages && handlePageChange(page + 1)}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Create Note Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>Add a new note to your collection</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="Enter note title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            />
            {workspaces.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Assign to workspace (optional)</p>
                <Select value={newWorkspace || '__none__'} onValueChange={(v) => setNewWorkspace(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                    <SelectValue placeholder="No workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No workspace</SelectItem>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                          {ws.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full bg-gradient-to-r from-[#059669] to-[#0d9488] text-white rounded-lg" onClick={handleCreate}>
              Create Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
