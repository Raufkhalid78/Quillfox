'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  StickyNote,
  CheckSquare,
  Plus,
  LogOut,
  Moon,
  Sun,
  LayoutGrid,
  Loader2,
  Clock,
  FileText,
  ListTodo,
  Users,
  Sparkles,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow } from 'date-fns'

export function Dashboard() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const setView = useAppStore((s) => s.setView)
  const selectNote = useAppStore((s) => s.selectNote)
  const selectTodo = useAppStore((s) => s.selectTodo)
  const logout = useAppStore((s) => s.logout)
  const addNote = useAppStore((s) => s.addNote)
  const addTodoList = useAppStore((s) => s.addTodoList)
  const setNotes = useAppStore((s) => s.setNotes)
  const setTodoListsAction = useAppStore((s) => s.setTodoLists)
  const setWorkspacesAction = useAppStore((s) => s.setWorkspaces)

  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const { theme, setTheme } = useTheme()

  const fetchData = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const [notesRes, todosRes, wsRes] = await Promise.all([
        fetch(`/api/notes?userId=${currentUser.id}`),
        fetch(`/api/todos?userId=${currentUser.id}`),
        fetch(`/api/workspaces?userId=${currentUser.id}`),
      ])
      if (notesRes.ok) {
        const notesData = await notesRes.json()
        setNotes(notesData)
      }
      if (todosRes.ok) {
        const todosData = await todosRes.json()
        setTodoListsAction(todosData)
      }
      if (wsRes.ok) {
        const wsData = await wsRes.json()
        setWorkspacesAction(wsData)
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentUser, setNotes, setTodoListsAction, setWorkspacesAction])

  const handleCreateNote = async () => {
    if (!currentUser) return
    const title = newNoteTitle.trim() || 'Untitled Note'
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, authorId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addNote(data)
        setDialogOpen(false)
        setNewNoteTitle('')
        selectNote(data.id)
        toast.success('Note created')
      }
    } catch {
      toast.error('Failed to create note')
    }
  }

  const handleCreateTodo = async () => {
    if (!currentUser) return
    const title = newTodoTitle.trim() || 'Untitled Todo List'
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, authorId: currentUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        addTodoList(data)
        setDialogOpen(false)
        setNewTodoTitle('')
        selectTodo(data.id)
        toast.success('Todo list created')
      }
    } catch {
      toast.error('Failed to create todo list')
    }
  }

  const recentNotes = notes
    .filter((n) => !n.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  const recentTodos = todoLists
    .filter((t) => !t.isArchived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  const getInitials = (name: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!currentUser) {
    setView('auth')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/40 dark:from-emerald-950/10 dark:via-background dark:to-teal-950/10">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <StickyNote className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Notely</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>

            <span className="text-sm font-medium hidden sm:inline max-w-[120px] truncate">
              {currentUser.name || currentUser.email}
            </span>

            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Notes', value: notes.filter((n) => !n.isArchived).length, icon: FileText, color: 'text-emerald-600' },
            { label: 'Todo Lists', value: todoLists.filter((t) => !t.isArchived).length, icon: ListTodo, color: 'text-teal-600' },
            { label: 'Workspaces', value: workspaces.length, icon: Users, color: 'text-amber-600' },
            { label: 'Completed', value: todoLists.reduce((acc, t) => acc + t.items.filter((i) => i.completed).length, 0), icon: Sparkles, color: 'text-violet-600' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Workspaces */}
        {workspaces.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Workspaces</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <motion.div
                  key={ws.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="overflow-hidden border-border/50 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="h-2" style={{ backgroundColor: ws.color }} />
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{ws.title}</CardTitle>
                      {ws.description && (
                        <p className="text-xs text-muted-foreground">{ws.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {ws._count.notes} notes
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ws._count.todoLists} todos
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <>
            {/* Recent Notes */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">Recent Notes</h2>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {notes.filter((n) => !n.isArchived).length} total
                </Badge>
              </div>
              {recentNotes.length === 0 ? (
                <Card className="border-dashed border-border/50">
                  <CardContent className="py-12 text-center">
                    <StickyNote className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No notes yet. Create your first note!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {recentNotes.map((note, index) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => selectNote(note.id)}
                      >
                        <Card className="cursor-pointer border-border/50 hover:shadow-md transition-shadow h-full">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base line-clamp-1">{note.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {note.content.substring(0, 120) || 'Empty note...'}
                            </p>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Recent Todo Lists */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-teal-600" />
                  <h2 className="text-lg font-semibold">Recent Todo Lists</h2>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {todoLists.filter((t) => !t.isArchived).length} total
                </Badge>
              </div>
              {recentTodos.length === 0 ? (
                <Card className="border-dashed border-border/50">
                  <CardContent className="py-12 text-center">
                    <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No todo lists yet. Create your first list!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {recentTodos.map((todo, index) => {
                      const completed = todo.items.filter((i) => i.completed).length
                      const total = todo.items.length
                      const progress = total > 0 ? (completed / total) * 100 : 0
                      return (
                        <motion.div
                          key={todo.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectTodo(todo.id)}
                        >
                          <Card className="cursor-pointer border-border/50 hover:shadow-md transition-shadow h-full">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base line-clamp-1">{todo.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-muted-foreground">
                                  {completed}/{total} completed
                                </span>
                                <span className="text-emerald-600 font-medium">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <motion.div
                                  className="bg-emerald-600 h-2 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.05 }}
                                />
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground mt-3">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDistanceToNow(new Date(todo.updatedAt), { addSuffix: true })}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* FAB - Create New */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <motion.div
            className="fixed bottom-20 right-6 z-50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </motion.div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New</DialogTitle>
            <DialogDescription>What would you like to create?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* New Note */}
            <Card className="cursor-pointer border-border/50 hover:border-emerald-300 hover:shadow-md transition-all" onClick={() => { /* Focus note input */ }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <StickyNote className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium">New Note</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-note-title">Title</Label>
                  <Input
                    id="new-note-title"
                    placeholder="Enter note title..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateNote()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateNote()
                    }}
                  >
                    Create Note
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* New Todo */}
            <Card className="cursor-pointer border-border/50 hover:border-teal-300 hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium">New Todo List</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-todo-title">Title</Label>
                  <Input
                    id="new-todo-title"
                    placeholder="Enter todo list title..."
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateTodo()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateTodo()
                    }}
                  >
                    Create Todo List
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
