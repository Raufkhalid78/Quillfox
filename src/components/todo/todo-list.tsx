'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { encryptTodoTitle, decryptTodoTitle } from '@/lib/encrypted-api'
import { useCollabSocket } from '@/hooks/use-collab-socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Lock, ShieldCheck, ShieldAlert, Pin, Archive, ArchiveRestore, Share2, MoreVertical } from 'lucide-react'

export function TodoList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const selectedTodoListId = useAppStore((s) => s.selectedTodoListId)
  const todoLists = useAppStore((s) => s.todoLists)
  const updateTodoListItems = useAppStore((s) => s.updateTodoListItems)
  const updateTodoListTitle = useAppStore((s) => s.updateTodoListTitle)
  const setActiveCollaborators = useAppStore((s) => s.setActiveCollaborators)
  const setLock = useAppStore((s) => s.setLock)
  const setView = useAppStore((s) => s.setView)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)

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

  // Wire collab socket hook
  const collab = useCollabSocket({
    documentType: 'todolist',
    documentId: selectedTodoListId || '',
    userId: currentUser?.id || '',
    userName: currentUser?.name || currentUser?.email || '',
    avatar: currentUser?.image,
    onItemCompleted: (itemId, completed) => {
      setItems((prev) => prev.map((item) =>
        item.id === itemId ? { ...item, completed } : item
      ))
      toast.info(`Item ${completed ? 'completed' : 'unchecked'} by collaborator`)
    },
  })

  // Sync collab state to store
  useEffect(() => {
    setActiveCollaborators(collab.activeUsers.map(u => ({ userId: u.userId, userName: u.userName, avatar: u.avatar })))
  }, [collab.activeUsers, setActiveCollaborators])

  useEffect(() => {
    setLock(collab.lockStatus.isLocked, collab.lockStatus.lockedByUser)
  }, [collab.lockStatus.isLocked, collab.lockStatus.lockedByUser, setLock])

  const isLocked = useAppStore((s) => s.isLocked)
  const lockedByUser = useAppStore((s) => s.lockedByUser)

  // Load todo list data & decrypt
  useEffect(() => {
    if (!selectedTodoListId) return
    const loadTodoList = async () => {
      try {
        const res = await fetch(`/api/todos/${selectedTodoListId}`)
        if (res.ok) {
          const data = await res.json()
          // Decrypt title and item titles
          const decryptedTitle = await decryptTodoTitle(data.title)
          const decryptedItems = await Promise.all(
            data.items
              .sort((a: any, b: any) => a.order - b.order)
              .map(async (item: any) => ({
                ...item,
                title: await decryptTodoTitle(item.title),
              }))
          )
          setTitle(decryptedTitle)
          setItems(decryptedItems)
        } else {
          toast.error('Failed to load todo list')
          setView('todos')
        }
      } catch {
        toast.error('Network error')
        setView('todos')
      }
      setInitialLoad(false)
    }
    loadTodoList()
  }, [selectedTodoListId, setView])

  // Calculate progress
  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Save items to API (with encryption, uses ref to avoid stale closures)
  const saveItemsFn = useCallback(async (itemsToSave: typeof items) => {
    if (!selectedTodoListId) return
    setIsSaving(true)
    try {
      // Encrypt all item titles before saving
      const encryptedItems = await Promise.all(
        itemsToSave.map(async (item) => ({
          ...item,
          title: await encryptTodoTitle(item.title),
        }))
      )
      const res = await fetch(`/api/todos/${selectedTodoListId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: encryptedItems }),
      })
      if (res.ok) {
        updateTodoListItems(selectedTodoListId, encryptedItems)
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
      // Encrypt title before sending
      const encryptedTitle = await encryptTodoTitle(newItemText.trim())
      const res = await fetch(`/api/todos/${selectedTodoListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: encryptedTitle,
          order: items.length,
        }),
      })
      if (res.ok) {
        const newItem = await res.json()
        // Store plaintext version locally, but keep encrypted for cache sync
        setItems((prev) => [...prev, { ...newItem, title: newItemText.trim() }])
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

  // Save title (with encryption)
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        if (!selectedTodoListId) return
        try {
          const encryptedTitle = await encryptTodoTitle(newTitle)
          await fetch(`/api/todos/${selectedTodoListId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: encryptedTitle }),
          })
          updateTodoListTitle(selectedTodoListId, encryptedTitle)
        } catch {
          toast.error('Failed to save title')
        }
      }, 1500)
    },
    [selectedTodoListId, updateTodoListTitle]
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleDelete = async () => {
    if (!selectedTodoListId) return
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        removeTodoList(selectedTodoListId)
        toast.success('Todo list deleted')
        setDeleteConfirmOpen(false)
        setView('todos')
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  const removeTodoList = useAppStore((s) => s.removeTodoList)
  const setTodoListsAction = useAppStore((s) => s.setTodoLists)

  const handleTogglePin = async () => {
    if (!selectedTodoListId || !todoList) return
    const newPinned = !todoList.isPinned
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinned }),
      })
      if (res.ok) {
        const updated = todoLists.map((t) => t.id === selectedTodoListId ? { ...t, isPinned: newPinned } : t)
        setTodoListsAction(updated)
        toast.success(newPinned ? 'List pinned' : 'List unpinned')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleToggleArchive = async () => {
    if (!selectedTodoListId || !todoList) return
    const newArchived = !todoList.isArchived
    try {
      const res = await fetch(`/api/todos/${selectedTodoListId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchived }),
      })
      if (res.ok) {
        if (newArchived) {
          const updated = todoLists.filter((t) => t.id !== selectedTodoListId)
          setTodoListsAction(updated)
          setView('todos')
        } else {
          const updated = todoLists.map((t) => t.id === selectedTodoListId ? { ...t, isArchived: false } : t)
          setTodoListsAction(updated)
        }
        toast.success(newArchived ? 'List archived' : 'List restored')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleShare = async () => {
    if (!selectedTodoListId) return
    const url = `${window.location.origin}/?todo=${selectedTodoListId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied to clipboard!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  useEffect(() => {
    if (!todoList && !initialLoad) setView('todos')
  }, [todoList, initialLoad, setView])

  if (!todoList && !initialLoad) return null

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="todo-list" />

      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('todos')}
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </motion.div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          <Input
            value={title}
            onChange={handleTitleChange}
            className="flex-1 min-w-0 border-0 focus-visible:ring-0 text-base sm:text-lg font-semibold px-1 h-auto py-1 bg-transparent"
            placeholder="Untitled Todo List"
            disabled={isLocked}
          />

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Encryption indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isEncryptedSession ? (
                    <ShieldCheck className="w-4 h-4 text-[#a855f7]" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {isEncryptedSession ? 'End-to-end encrypted' : 'Encryption not active'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isSaving && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center text-xs text-muted-foreground"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin text-[#a855f7]" />
                <span className="hidden sm:inline">Saving</span>
              </motion.div>
            )}

            {/* Collaboration indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 ${collab.isConnected ? 'text-[#a855f7] border-purple-300 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800' : 'text-muted-foreground'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${collab.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="hidden sm:inline">{collab.isConnected ? 'Live' : 'Offline'}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{collab.isConnected ? 'Real-time collaboration active' : 'Collaboration disconnected'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-purple-50 dark:hover:bg-purple-950/30">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleTogglePin}>
                  <Pin className={`w-4 h-4 mr-2 ${todoList?.isPinned ? 'fill-current' : ''}`} />
                  {todoList?.isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleArchive}>
                  {todoList?.isArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                  {todoList?.isArchived ? 'Restore from Archive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <span className="text-sm text-gradient-purple font-bold">{progress}%</span>
        </div>
        <div className="w-full bg-muted/60 rounded-full h-3 shadow-inner overflow-hidden">
          <motion.div
            className="progress-gradient h-3 rounded-full"
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
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, item.id)}
                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
                onDrop={(e) => handleDrop(e as unknown as React.DragEvent, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-purple-300 dark:hover:border-purple-800 transition-all ${
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
                  className="shrink-0 data-[state=checked]:bg-[#6d28d9] data-[state=checked]:border-[#6d28d9]"
                />

                {/* Title */}
                {editingItemId === item.id ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (editValue.trim()) {
                          const updatedItems = itemsRef.current.map((i) =>
                            i.id === item.id ? { ...i, title: editValue.trim() } : i
                          )
                          setItems(updatedItems)
                          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                          saveTimeoutRef.current = setTimeout(() => {
                            saveItemsFn(updatedItems)
                          }, 500)
                        }
                        setEditingItemId(null)
                        setEditValue('')
                      } else if (e.key === 'Escape') {
                        setEditingItemId(null)
                        setEditValue('')
                      }
                    }}
                    className="h-7 text-sm border-0 focus-visible:ring-1 px-1 bg-transparent"
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      if (!isLocked && !item.completed) {
                        setEditingItemId(item.id)
                        setEditValue(item.title)
                      }
                    }}
                    className={`flex-1 text-sm transition-all ${
                      item.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.title}
                  </span>
                )}

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
                className="shrink-0 text-[#a855f7] hover:text-[#6d28d9]"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this todo list?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This list and all its items will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
