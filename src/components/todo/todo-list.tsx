'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, TodoItemChild } from '@/stores/app-store'
import { encryptTodoTitle, decryptTodoTitle } from '@/lib/encrypted-api'
import { logActivity } from '@/lib/activity'
import { supabase } from '@/lib/supabase'
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
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Lock, ShieldCheck, ShieldAlert, Pin, Archive, ArchiveRestore, Share2, MoreVertical, Calendar } from 'lucide-react'
import { FolderPicker } from '@/components/shared/folder-picker'
import { useParams, useRouter } from 'next/navigation'

export function TodoList() {
  const currentUser = useAppStore((s) => s.currentUser)
  const params = useParams()
  const router = useRouter()
  const selectedTodoListId = params.id as string
  const todoLists = useAppStore((s) => s.todoLists)
  const updateTodoListItems = useAppStore((s) => s.updateTodoListItems)
  const updateTodoListTitle = useAppStore((s) => s.updateTodoListTitle)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const addTodoItem = useAppStore((s) => s.addTodoItem)
  const activeCollaborators = useAppStore((s) => s.activeCollaborators)
  const setTodoFolder = useAppStore((s) => s.setTodoFolder)
  const setTodoDueDate = useAppStore((s) => s.setTodoDueDate)

  const [title, setTitle] = useState('')
  const [items, setItems] = useState<TodoItemChild[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastLocalSaveTimeRef = useRef<number>(0)
  const isTyping = useRef(false)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const todoList = todoLists.find((t) => t.id === selectedTodoListId)

  const [isLockedByOther, setIsLockedByOther] = useState(false)
  const [lockedByInfo, setLockedByInfo] = useState<{name: string, email: string} | null>(null)

  // Load todo list data & decrypt + subscribe to realtime updates
  useEffect(() => {
    if (!selectedTodoListId || !currentUser) return
    const loadTodoList = async () => {
      try {
        // Attempt to acquire lock first
        const { data: lockAcquired } = await supabase.rpc('acquire_todo_list_lock', {
          p_list_id: selectedTodoListId,
          p_user_id: currentUser.id
        })

        const { data: listData, error: listError } = await supabase
          .from('todo_lists')
          .select('*, todo_items(*), locker:profiles!todo_lists_locked_by_fkey(id, name, email)')
          .eq('id', selectedTodoListId)
          .single()

        if (listError || !listData) {
          toast.error('Failed to load todo list')
          router.push('/dashboard/todos')
          return
        }

        if (!lockAcquired && listData.locked_by !== currentUser.id) {
          setIsLockedByOther(true)
          setLockedByInfo(Array.isArray(listData.locker) ? listData.locker[0] : listData.locker)
        }

        const decryptedTitle = await decryptTodoTitle(listData.title, listData.workspace_id)
        const decryptedItems = await Promise.all(
          (listData.todo_items || [])
            .sort((a: any, b: any) => a.order - b.order)
            .map(async (item: any) => ({
              id: item.id,
              title: await decryptTodoTitle(item.title, listData.workspace_id),
              completed: item.completed,
              order: item.order,
              todoListId: item.todo_list_id,
              completedAt: item.completed_at,
            }))
        )
        setTitle(decryptedTitle)
        setItems(decryptedItems)
      } catch {
        toast.error('Network error')
        router.push('/dashboard/todos')
      }
      setInitialLoad(false)
    }
    loadTodoList()

    // Subscribe to realtime database changes for this list
    const itemsChannel = supabase
      .channel(`todo-items-${selectedTodoListId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_items',
          filter: `todo_list_id=eq.${selectedTodoListId}`,
        },
        () => {
          if (!saveTimeoutRef.current && Date.now() - lastLocalSaveTimeRef.current > 2000) {
            loadTodoList()
          }
        }
      )
      .subscribe()

    // Subscribe to todo_lists changes for locks
    const listChannel = supabase
      .channel(`todo-list-${selectedTodoListId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'todo_lists',
          filter: `id=eq.${selectedTodoListId}`,
        },
        async (payload) => {
          if (payload.new.locked_by && payload.new.locked_by !== currentUser.id) {
            setIsLockedByOther(true)
            const { data: lockerData } = await supabase.from('profiles').select('name, email').eq('id', payload.new.locked_by).single()
            if (lockerData) setLockedByInfo(lockerData)
          } else if (!payload.new.locked_by) {
            setIsLockedByOther(false)
            setLockedByInfo(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(listChannel)
      supabase.rpc('release_todo_list_lock', {
        p_list_id: selectedTodoListId,
        p_user_id: currentUser.id
      }).then(res => { if(res.error) console.error(res.error) })
    }
  }, [selectedTodoListId, router, currentUser])

  // Calculate progress
  const completedCount = items.filter((i) => i.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Save items to API (with encryption, uses ref to avoid stale closures)
  const saveItemsFn = useCallback(async (itemsToSave: typeof items) => {
    if (!selectedTodoListId) return
    setIsSaving(true)
    try {
      // Fetch current IDs in database to find deleted items
      const { data: dbItems } = await supabase
        .from('todo_items')
        .select('id')
        .eq('todo_list_id', selectedTodoListId)
      
      const dbIds = (dbItems || []).map(i => i.id)
      const saveIds = itemsToSave.map(i => i.id)
      const idsToDelete = dbIds.filter(id => !saveIds.includes(id))

      if (idsToDelete.length > 0) {
        await supabase
          .from('todo_items')
          .delete()
          .in('id', idsToDelete)
      }

      // Encrypt all item titles before saving
      const encryptedItems = await Promise.all(
        itemsToSave.map(async (item) => ({
          ...item,
          title: await encryptTodoTitle(item.title, todoList?.workspaceId),
        }))
      )

      if (encryptedItems.length > 0) {
        const { error } = await supabase
          .from('todo_items')
          .upsert(
            encryptedItems.map((item) => ({
              id: item.id,
              title: item.title,
              completed: item.completed,
              order: item.order,
              todo_list_id: selectedTodoListId,
              completed_at: item.completed ? (item.completedAt || new Date().toISOString()) : null,
            }))
          )

        if (error) {
          toast.error('Failed to save items')
          return
        }
      }

      lastLocalSaveTimeRef.current = Date.now()
      updateTodoListItems(selectedTodoListId, encryptedItems)
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedTodoListId, updateTodoListItems])

  // Toggle item completion
  const handleToggle = useCallback(
    async (itemId: string) => {
      if (isLockedByOther) return
      const targetItem = itemsRef.current.find(item => item.id === itemId)
      const isNowCompleted = targetItem ? !targetItem.completed : false

      const newItems = itemsRef.current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : null,
            }
          : item
      )
      setItems(newItems)

      if (isNowCompleted) {
        logActivity('todo_complete')
      }

      // Debounce save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        await saveItemsFn(newItems)
      }, 500)
    },
    [isLockedByOther, saveItemsFn]
  )

  // Add new item
  const handleAddItem = async () => {
    if (!newItemText.trim() || isLockedByOther || !selectedTodoListId) return
    const itemId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    try {
      // Encrypt title before sending
      const encryptedTitle = await encryptTodoTitle(newItemText.trim(), todoList?.workspaceId)
      const { data: newItem, error } = await supabase
        .from('todo_items')
        .insert({
          id: itemId,
          title: encryptedTitle,
          completed: false,
          order: items.length,
          todo_list_id: selectedTodoListId,
        })
        .select()
        .single()

      if (error) {
        toast.error(error.message || 'Failed to add item')
        return
      }

      lastLocalSaveTimeRef.current = Date.now()

      const formattedItem = {
        id: newItem.id,
        title: newItemText.trim(),
        completed: newItem.completed,
        order: newItem.order,
        todoListId: newItem.todo_list_id,
      }

      setItems((prev) => [...prev, formattedItem])
      
      const encryptedItemForStore = {
        id: newItem.id,
        title: encryptedTitle,
        completed: newItem.completed,
        order: newItem.order,
        todoListId: newItem.todo_list_id,
      }
      addTodoItem(selectedTodoListId, encryptedItemForStore)
      
      setNewItemText('')
    } catch {
      toast.error('Failed to add item')
    }
  }

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (isLockedByOther) return
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
      if (!isTyping.current && selectedTodoListId) {
        isTyping.current = true
        supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: true })
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        if (!selectedTodoListId) return
        try {
          const encryptedTitle = await encryptTodoTitle(newTitle, todoList?.workspaceId)
          const { error } = await supabase
            .from('todo_lists')
            .update({ title: encryptedTitle })
            .eq('id', selectedTodoListId)

          if (error) {
            toast.error('Failed to save title')
            return
          }
          updateTodoListTitle(selectedTodoListId, encryptedTitle)
        } catch {
          toast.error('Failed to save title')
        }
        if (isTyping.current && selectedTodoListId) {
          isTyping.current = false
          supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: false })
        }
      }, 1500)
    },
    [selectedTodoListId, updateTodoListTitle, todoList, currentUser]
  )

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleDelete = async () => {
    if (!selectedTodoListId) return
    try {
      const { error } = await supabase
        .from('todo_lists')
        .delete()
        .eq('id', selectedTodoListId)

      if (error) {
        toast.error('Failed to delete')
        return
      }
      removeTodoList(selectedTodoListId)
      toast.success('Todo list deleted')
      setDeleteConfirmOpen(false)
      router.push('/dashboard/todos')
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
      const { error } = await supabase
        .from('todo_lists')
        .update({ is_pinned: newPinned })
        .eq('id', selectedTodoListId)

      if (error) {
        toast.error('Failed to update')
        return
      }
      const updated = todoLists.map((t) => t.id === selectedTodoListId ? { ...t, isPinned: newPinned } : t)
      setTodoListsAction(updated)
      toast.success(newPinned ? 'List pinned' : 'List unpinned')
    } catch { toast.error('Failed to update') }
  }

  const handleToggleArchive = async () => {
    if (!selectedTodoListId || !todoList) return
    const newArchived = !todoList.isArchived
    try {
      const { error } = await supabase
        .from('todo_lists')
        .update({ is_archived: newArchived })
        .eq('id', selectedTodoListId)

      if (error) {
        toast.error('Failed to update')
        return
      }
      if (newArchived) {
        const updated = todoLists.filter((t) => t.id !== selectedTodoListId)
        setTodoListsAction(updated)
        router.push('/dashboard/todos')
      } else {
        const updated = todoLists.map((t) => t.id === selectedTodoListId ? { ...t, isArchived: false } : t)
        setTodoListsAction(updated)
      }
      toast.success(newArchived ? 'List archived' : 'List restored')
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
    if (!todoList && !initialLoad) router.push('/dashboard/todos')
  }, [todoList, initialLoad, router])

  if (!todoList && !initialLoad) return null

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar  />

      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isTyping.current && selectedTodoListId) {
                  isTyping.current = false
                  supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: false })
                }
                router.push('/dashboard/todos')
              }}
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </motion.div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          <div className="flex items-center gap-2">
            {activeCollaborators.length > 0 && (
              <div className="flex items-center mr-2">
                {activeCollaborators.map((collaborator, index) => (
                  <div key={collaborator.userId} className={`relative ${index > 0 ? '-ml-2' : ''} w-6 h-6 rounded-full border-2 border-background bg-primary flex items-center justify-center`}>
                    {collaborator.avatar ? (
                      <img src={collaborator.avatar} alt={collaborator.userName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-primary-foreground font-bold">{collaborator.userName.charAt(0).toUpperCase()}</span>
                    )}
                    {collaborator.isTyping && (
                      <div className="absolute -bottom-1 -right-1 bg-green-500 w-2 h-2 rounded-full border-2 border-background" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Input
            value={title}
            onChange={handleTitleChange}
            className="flex-1 min-w-0 border-0 focus-visible:ring-0 text-base sm:text-lg font-semibold px-1 h-auto py-1 bg-transparent"
            placeholder="Untitled Todo List"
            disabled={isLockedByOther}
          />

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Due Date Picker */}
            {todoList?.id && (
              <div className="relative flex items-center hidden sm:flex">
                <Input
                  type="date"
                  value={todoList.dueDate || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setTodoDueDate(todoList.id, val)
                    supabase.from('todo_lists').update({ due_date: val || null }).eq('id', todoList.id)
                  }}
                  className="h-8 text-xs border-0 bg-transparent w-[130px] pl-8 focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                />
                <Calendar className="w-4 h-4 text-muted-foreground absolute left-2 pointer-events-none" />
              </div>
            )}

            {/* Folder Picker */}
            {todoList?.id && (
              <FolderPicker
                selectedFolderId={todoList.folderId}
                onSelect={async (folderId) => {
                  setTodoFolder(todoList.id, folderId)
                  if (!isTyping.current) {
                    isTyping.current = true
                    supabase.channel(`room:todo-${todoList.id}`).track({ userId: currentUser?.id, isTyping: true })
                  }
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                  saveTimeoutRef.current = setTimeout(async () => {
                    if (!selectedTodoListId) return
                    try {
                      // We don't need to re-encrypt the title just for the folder change in the current schema
                      // Wait, we need to update the folderId on the server.
                      // Let's add folder_id to the update.
                      const encryptedTitle = await encryptTodoTitle(title, todoList?.workspaceId)
                      const { error } = await supabase
                        .from('todo_lists')
                        .update({ folder_id: folderId || null, title: encryptedTitle })
                        .eq('id', selectedTodoListId)

                      if (error) {
                        toast.error('Failed to save folder')
                      }
                    } catch {
                      toast.error('Failed to save folder')
                    }
                    if (isTyping.current && selectedTodoListId) {
                      isTyping.current = false
                      supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: false })
                    }
                  }, 1500)
                }}
              />
            )}

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

            {/* Collaboration indicator - removed since Socket.io server is removed */}

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
      {isLockedByOther && lockedByInfo && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800"
        >
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <Lock className="w-4 h-4" />
            <span>
              {lockedByInfo.name || lockedByInfo.email} is currently editing — read-only mode
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
                draggable={!isLockedByOther}
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, item.id)}
                onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
                onDrop={(e) => handleDrop(e as unknown as React.DragEvent, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-purple-300 dark:hover:border-purple-800 transition-all ${
                  draggedId === item.id ? 'opacity-50 scale-95' : ''
                } ${item.completed ? 'bg-muted/50' : 'bg-card'}`}
              >
                {/* Drag Handle */}
                {!isLockedByOther && (
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0" />
                )}

                {/* Checkbox */}
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggle(item.id)}
                  disabled={isLockedByOther}
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
                      if (!isLockedByOther && !item.completed) {
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
                {!isLockedByOther && (
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
        {!isLockedByOther && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded border-2 border-dashed border-muted-foreground/30 shrink-0" />
              <Input
                    value={newItemText}
                    onChange={(e) => {
                      setNewItemText(e.target.value)
                      if (!isTyping.current && selectedTodoListId) {
                        isTyping.current = true
                        supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: true })
                      }
                    }}
                    onBlur={() => {
                      if (isTyping.current && selectedTodoListId) {
                        isTyping.current = false
                        supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: false })
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isLockedByOther) {
                        handleAddItem()
                        if (isTyping.current && selectedTodoListId) {
                          isTyping.current = false
                          supabase.channel(`room:todo-${selectedTodoListId}`).track({ userId: currentUser?.id, isTyping: false })
                        }
                      }
                    }}
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-sm"
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

