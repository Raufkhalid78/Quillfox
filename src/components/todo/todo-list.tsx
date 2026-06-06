'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Lock } from 'lucide-react'

export function TodoList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const selectedTodoListId = useAppStore((s) => s.selectedTodoListId)
  const todoLists = useAppStore((s) => s.todoLists)
  const updateTodoListItems = useAppStore((s) => s.updateTodoListItems)
  const updateTodoListTitle = useAppStore((s) => s.updateTodoListTitle)
  const isLocked = useAppStore((s) => s.isLocked)
  const lockedByUser = useAppStore((s) => s.lockedByUser)
  const setView = useAppStore((s) => s.setView)

  const [title, setTitle] = useState('')
  const [items, setItems] = useState<Array<{
    id: string
    title: string
    completed: boolean
    order: number
    todoListId: string
  }>>([])
  const [newItemText, setNewItemText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const todoList = todoLists.find((t) => t.id === selectedTodoListId)

  // Load todo list data
  useEffect(() => {
    if (!selectedTodoListId) return
    const loadTodoList = async () => {
      try {
        const res = await fetch(`/api/todos/${selectedTodoListId}`)
        if (res.ok) {
          const data = await res.json()
          setTitle(data.title)
          setItems(data.items.sort((a: any, b: any) => a.order - b.order))
          setInitialLoad(false)
        } else {
          toast.error('Failed to load todo list')
          setView('dashboard')
        }
      } catch {
        toast.error('Network error')
        setView('dashboard')
      }
    }
    loadTodoList()
  }, [selectedTodoListId, setView])

  // Calculate progress
  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Save items to API (uses ref to avoid stale closures)
  const saveItemsFn = useCallback(async (itemsToSave: typeof items) => {
    if (!selectedTodoListId) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSave }),
      })
      if (res.ok) {
        updateTodoListItems(selectedTodoListId, itemsToSave)
      } else {
        toast.error('Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedTodoListId, updateTodoListItems])

  // Toggle item completion
  const handleToggle = useCallback(
    async (itemId: string) => {
      if (isLocked) return
      const newItems = itemsRef.current.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
      setItems(newItems)
      // Debounce save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        await saveItemsFn(newItems)
      }, 500)
    },
    [isLocked, saveItemsFn]
  )

  // Add new item
  const handleAddItem = async () => {
    if (!newItemText.trim() || isLocked || !selectedTodoListId) return
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newItemText.trim(),
          order: items.length,
        }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setItems((prev) => [...prev, newItem])
        setNewItemText('')
      }
    } catch {
      toast.error('Failed to add item')
    }
  }

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (isLocked) return
    const updatedItems = itemsRef.current.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, order: idx }))
    setItems(updatedItems)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveItemsFn(updatedItems)
    }, 500)
  }

  // Handle drag reorder (HTML5 drag-and-drop)
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedId(itemId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', itemId)
  }

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedId) return

    const sourceIndex = items.findIndex((i) => i.id === draggedId)
    if (sourceIndex === -1 || sourceIndex === targetIndex) return

    const newItems = [...items]
    const [removed] = newItems.splice(sourceIndex, 1)
    newItems.splice(targetIndex, 0, removed)
    const reorderedItems = newItems.map((item, idx) => ({ ...item, order: idx }))

    setItems(reorderedItems)
    setDraggedId(null)

    // Save reorder
    saveItemsFn(reorderedItems)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  // Save title
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        if (!selectedTodoListId) return
        try {
          await fetch(`/api/todos/${selectedTodoListId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }),
          })
          updateTodoListTitle(selectedTodoListId, newTitle)
        } catch {
          toast.error('Failed to save title')
        }
      }, 1500)
    },
    [selectedTodoListId, updateTodoListTitle]
  )

  const handleDelete = async () => {
    if (!selectedTodoListId) return
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Todo list deleted')
        setView('dashboard')
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (!todoList && !initialLoad) {
    setView('dashboard')
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView('dashboard')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Input
            value={title}
            onChange={handleTitleChange}
            className="flex-1 border-0 focus-visible:ring-0 text-lg font-semibold px-1 h-auto py-1 bg-transparent"
            placeholder="Untitled Todo List"
            disabled={isLocked}
          />

          <div className="flex items-center gap-2 shrink-0">
            {isSaving && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center text-xs text-muted-foreground"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving
              </motion.div>
            )}
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Lock Banner */}
      {isLocked && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800"
        >
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <Lock className="w-4 h-4" />
            <span>
              {lockedByUser === currentUser?.name
                ? 'You are editing this list'
                : `${lockedByUser} is currently editing — read-only mode`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {completedCount}/{totalCount} completed
          </span>
          <span className="text-sm font-bold text-emerald-600">{progress}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <motion.div
            className="bg-emerald-600 h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Todo Items */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <AnimatePresence>
          <div className="space-y-2">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.2 }}
                draggable={!isLocked}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all ${
                  draggedId === item.id ? 'opacity-50 scale-95' : ''
                } ${item.completed ? 'bg-muted/50' : 'bg-card'}`}
              >
                {/* Drag Handle */}
                {!isLocked && (
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0" />
                )}

                {/* Checkbox */}
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggle(item.id)}
                  disabled={isLocked}
                  className="shrink-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />

                {/* Title */}
                <span
                  className={`flex-1 text-sm transition-all ${
                    item.completed
                      ? 'line-through text-muted-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {item.title}
                </span>

                {/* Delete */}
                {!isLocked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* Add New Item */}
        {!isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded border-2 border-dashed border-muted-foreground/30 shrink-0" />
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddItem()
                  }
                }}
                placeholder="Add a new item..."
                className="border-0 focus-visible:ring-0 text-sm bg-transparent"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
                className="shrink-0 text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
