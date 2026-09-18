'use client'

import { useState, useEffect } from 'react'
import { Folder, Plus, X, Pencil, Trash2, Check } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { encryptNoteTitle, decryptNoteTitle } from '@/lib/encrypted-api'
import { toast } from 'sonner'

export function FolderPicker({
  selectedFolderId,
  onSelect,
}: {
  selectedFolderId?: string
  onSelect: (folderId: string | undefined) => void
}) {
  const folders = useAppStore((s) => s.folders)
  const addFolder = useAppStore((s) => s.addFolder)
  const currentUser = useAppStore((s) => s.currentUser)

  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderNames, setFolderNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        folders.map(async (f) => [f.id, await decryptNoteTitle(f.name, null).catch(() => f.name)] as const)
      )
      if (!cancelled) setFolderNames(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [folders])

  const nameFor = (f: { id: string; name: string }) => folderNames[f.id] || f.name

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser) return
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

    try {
      const encryptedName = await encryptNoteTitle(newFolderName.trim(), null)
      const { data, error } = await supabase
        .from('folders')
        .insert({ id, name: encryptedName, user_id: currentUser.id })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create folder')
        return
      }

      addFolder({ id: data.id, name: data.name, userId: data.user_id, createdAt: data.created_at })
      onSelect(data.id)
      setNewFolderName('')
      setIsCreating(false)
    } catch {
      toast.error('Network error')
    }
  }

  const handleRename = async (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    try {
      const encryptedName = await encryptNoteTitle(name, null)
      const { error } = await supabase.from('folders').update({ name: encryptedName }).eq('id', id)
      if (error) throw error
      useAppStore.setState((s) => ({
        folders: s.folders.map((f) => (f.id === id ? { ...f, name: encryptedName } : f)),
      }))
      setFolderNames((prev) => ({ ...prev, [id]: name }))
      setRenamingId(null)
      toast.success('Folder renamed')
    } catch {
      toast.error('Failed to rename folder')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this folder? Items inside will be kept but unfiled.')) return
    try {
      const { error } = await supabase.from('folders').delete().eq('id', id)
      if (error) throw error
      useAppStore.setState((s) => ({ folders: s.folders.filter((f) => f.id !== id) }))
      if (selectedFolderId === id) onSelect(undefined)
      toast.success('Folder deleted')
    } catch {
      toast.error('Failed to delete folder')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#6366f1]/10" aria-label="Folders">
          <Folder className={`w-4 h-4 ${selectedFolderId ? 'text-[#6366f1] fill-[#6366f1]/20' : ''}`} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
          Folders
        </div>
        {selectedFolderId && (
          <>
            <button
              onClick={() => onSelect(undefined)}
              className="flex w-full items-center rounded-md px-2 py-2 text-sm text-destructive hover:bg-accent"
            >
              <X className="w-4 h-4 mr-2" aria-hidden="true" />
              Remove from folder
            </button>
            <DropdownMenuSeparator />
          </>
        )}

        {folders.map((f) =>
          renamingId === f.id ? (
            <div key={f.id} className="flex items-center gap-1.5 p-1">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(f.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRename(f.id)} aria-label="Save name">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div
              key={f.id}
              className="group flex items-center rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <button
                onClick={() => onSelect(f.id)}
                className="flex flex-1 items-center text-sm text-left min-w-0"
              >
                <Folder
                  className={`w-4 h-4 mr-2 shrink-0 ${
                    selectedFolderId === f.id ? 'text-[#6366f1] fill-[#6366f1]' : 'text-muted-foreground'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{nameFor(f)}</span>
              </button>
              <button
                onClick={() => {
                  setRenamingId(f.id)
                  setRenameValue(nameFor(f))
                }}
                className="ml-1 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                aria-label={`Rename ${nameFor(f)}`}
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
              </button>
              <button
                onClick={() => handleDelete(f.id)}
                className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                aria-label={`Delete ${nameFor(f)}`}
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )
        )}

        {folders.length === 0 && (
          <div className="text-sm text-muted-foreground px-2 py-2 text-center">No folders yet</div>
        )}
        <DropdownMenuSeparator />
        {isCreating ? (
          <div className="flex items-center gap-2 p-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setIsCreating(false)
              }}
            />
            <Button size="sm" className="h-8 bg-[#6366f1] hover:bg-[#6366f1]/90" onClick={handleCreateFolder}>
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              setIsCreating(true)
            }}
            className="flex w-full items-center rounded-md px-2 py-2 text-sm text-[#6366f1] font-medium hover:bg-accent"
          >
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Create new folder
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}