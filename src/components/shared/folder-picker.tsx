'use client'

import { useState } from 'react'
import { Folder, Plus, X } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
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

  const selectedFolder = folders.find((f) => f.id === selectedFolderId)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser) return
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          id,
          name: newFolderName.trim(),
          user_id: currentUser.id,
        })
        .select()
        .single()

      if (error) {
        toast.error('Failed to create folder')
        return
      }

      addFolder({
        id: data.id,
        name: data.name,
        userId: data.user_id,
        createdAt: data.created_at,
      })
      onSelect(data.id)
      setNewFolderName('')
      setIsCreating(false)
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#6366f1]/10">
          <Folder className={`w-4 h-4 ${selectedFolderId ? 'text-[#6366f1] fill-[#6366f1]/20' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
          Folders
        </div>
        {selectedFolderId && (
          <DropdownMenuItem onClick={() => onSelect(undefined)}>
            <X className="w-4 h-4 mr-2 text-destructive" />
            <span className="text-destructive">Remove from Folder</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {folders.map((f) => (
          <DropdownMenuItem
            key={f.id}
            onClick={() => onSelect(f.id)}
            className="flex items-center"
          >
            <Folder className={`w-4 h-4 mr-2 ${selectedFolderId === f.id ? 'text-[#6366f1] fill-[#6366f1]' : 'text-muted-foreground'}`} />
            {f.name}
          </DropdownMenuItem>
        ))}
        {folders.length === 0 && (
          <div className="text-sm text-muted-foreground px-2 py-2 text-center">
            No folders yet
          </div>
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
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setIsCreating(true); }}>
            <Plus className="w-4 h-4 mr-2 text-[#6366f1]" />
            <span className="text-[#6366f1] font-medium">Create New Folder</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
