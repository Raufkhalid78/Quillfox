'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/app-store'
import { encryptNoteContent, encryptNoteTitle, decryptNoteContent, decryptNoteTitle } from '@/lib/encrypted-api'
import { logActivity } from '@/lib/activity'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Loader2, Paperclip, Lock } from 'lucide-react'
import { NotionEditor } from './notion-editor'
import { useParams, useRouter } from 'next/navigation'
import { NoteHeader } from './note-header'
import { NoteHistoryDialog } from './note-history-dialog'
import { NoteAttachments } from './note-attachments'

export function NoteEditor() {
  const currentUser = useAppStore((s) => s.currentUser)
  const params = useParams()
  const router = useRouter()
  const selectedNoteId = params.id as string
  const notes = useAppStore((s) => s.notes)
  const updateNoteTitle = useAppStore((s) => s.updateNoteTitle)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const activeCollaborators = useAppStore((s) => s.activeCollaborators)
  const userTier = useAppStore((s) => s.userTier)
  const addAttachmentToNote = useAppStore((s) => s.addAttachmentToNote)
  const removeAttachmentFromNote = useAppStore((s) => s.removeAttachmentFromNote)
  const updateNoteContent = useAppStore((s) => s.updateNoteContent)

  const note = notes.find((n) => n.id === selectedNoteId)

  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [initialLoad, setInitialLoad] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  
  const [isLockedByOther, setIsLockedByOther] = useState(false)
  const [lockedByInfo, setLockedByInfo] = useState<{name: string, email: string} | null>(null)

  const titleRef = useRef(title)
  const contentRef = useRef(content)
  const lastVersionSaveTime = useRef(Date.now())
  const lastLocalSaveTimeRef = useRef<number>(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTyping = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    titleRef.current = title
    contentRef.current = content
  }, [title, content])

  // Load note data & decrypt + subscribe to realtime updates
  useEffect(() => {
    if (!selectedNoteId || !currentUser) return
    setInitialLoad(true)
    const loadNote = async () => {
      try {
        // Attempt to acquire lock first
        const { data: lockAcquired } = await supabase.rpc('acquire_note_lock', {
          p_note_id: selectedNoteId,
          p_user_id: currentUser.id
        })

        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', selectedNoteId)
          .single()

        if (error || !data) {
          toast.error('Failed to load note')
          router.push('/dashboard/notes')
          return
        }

        if (!lockAcquired && data.locked_by && data.locked_by !== currentUser.id) {
          setIsLockedByOther(true)
          // Fetch locker profile separately to avoid FK hint issues
          const { data: lockerData } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('id', data.locked_by)
            .single()
          if (lockerData) setLockedByInfo(lockerData)
        }

        const decryptedTitle = await decryptNoteTitle(data.title, data.workspace_id)
        const decryptedContent = await decryptNoteContent(data.content || '', data.workspace_id)
        setTitle(decryptedTitle)
        setContent(decryptedContent)
        setInitialLoad(false)
      } catch {
        toast.error('Network error')
        router.push('/dashboard/notes')
      }
      setInitialLoad(false)
    }
    loadNote()

    // Subscribe to realtime updates for this note
    const channel = supabase
      .channel(`note-${selectedNoteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${selectedNoteId}`,
        },
        async (payload) => {
          // Check for lock changes
          if (payload.new.locked_by && payload.new.locked_by !== currentUser.id) {
             setIsLockedByOther(true)
             // Refetch locker info
             const { data: lockerData } = await supabase.from('profiles').select('name, email').eq('id', payload.new.locked_by).single()
             if (lockerData) setLockedByInfo(lockerData)
          } else if (!payload.new.locked_by) {
             setIsLockedByOther(false)
             setLockedByInfo(null)
          }

          // Only sync if the user is not actively typing and hasn't just saved
          if (!saveTimeoutRef.current && Date.now() - lastLocalSaveTimeRef.current > 2000) {
            try {
              const decTitle = await decryptNoteTitle(payload.new.title, payload.new.workspace_id)
              const decContent = await decryptNoteContent(payload.new.content || '', payload.new.workspace_id)
              setTitle((prev) => (prev === decTitle ? prev : decTitle))
              setContent((prev) => (prev === decContent ? prev : decContent))
            } catch (err) {
              console.warn('Failed to decrypt realtime note update', err)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.rpc('release_note_lock', {
        p_note_id: selectedNoteId,
        p_user_id: currentUser.id
      }).then(res => { if(res.error) console.error(res.error) })
    }
  }, [selectedNoteId, router, currentUser])

  // Auto-save debounced (with encryption)
  const saveContent = useCallback(async () => {
    if (!selectedNoteId || isSaving) return
    setIsSaving(true)
    try {
      const currentTitle = titleRef.current
      const currentContent = contentRef.current
      
      // Encrypt before sending to server
      const noteWsId = note?.workspaceId;
      const encryptedTitle = await encryptNoteTitle(currentTitle, noteWsId)
      const encryptedContent = await encryptNoteContent(currentContent, noteWsId)
      const { error } = await supabase
        .from('notes')
        .update({
          title: encryptedTitle,
          content: encryptedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNoteId)

      if (error) {
        toast.error('Failed to save')
      } else {
        lastLocalSaveTimeRef.current = Date.now()
        updateNoteContent(selectedNoteId, encryptedContent)
        updateNoteTitle(selectedNoteId, encryptedTitle)
        logActivity('note_update')

        // Auto versioning every 15 minutes
        const now = Date.now()
        if (now - lastVersionSaveTime.current > 15 * 60 * 1000) {
          lastVersionSaveTime.current = now
          const { data: vList } = await supabase
            .from('note_versions')
            .select('version')
            .eq('note_id', selectedNoteId)
            .order('version', { ascending: false })
            .limit(1)
          
          const nextVer = (vList && vList.length > 0 ? vList[0].version : 0) + 1
          const versionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
          await supabase.from('note_versions').insert({
            id: versionId,
            note_id: selectedNoteId,
            title: encryptedTitle,
            content: encryptedContent,
            version: nextVer,
          })
        }
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedNoteId, isSaving, updateNoteContent, updateNoteTitle, note])

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value
      setTitle(newTitle)
      if (!isTyping.current && selectedNoteId) {
        isTyping.current = true
        supabase.channel(`room:note-${selectedNoteId}`).track({ userId: currentUser?.id, isTyping: true })
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null
        saveContent()
        if (isTyping.current && selectedNoteId) {
          isTyping.current = false
          supabase.channel(`room:note-${selectedNoteId}`).track({ userId: currentUser?.id, isTyping: false })
        }
      }, 1500)
    },
    [saveContent, selectedNoteId, currentUser]
  )

  const handleDelete = async () => {
    if (!selectedNoteId) return
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', selectedNoteId)

      if (error) {
        toast.error(error.message || 'Failed to delete note')
        return
      }

      removeNote(selectedNoteId)
      toast.success('Note deleted')
      setDeleteConfirmOpen(false)
      router.push('/dashboard/notes')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const removeNote = useAppStore((s) => s.removeNote)
  const setNotesAction = useAppStore((s) => s.setNotes)

  const handleTogglePin = async () => {
    if (!selectedNoteId || !note) return
    const newPinned = !note.isPinned
    try {
      await supabase.from('notes').update({ is_pinned: newPinned }).eq('id', selectedNoteId)
      updateNoteTitle(selectedNoteId, title) // Trigger re-render (hack)
      setNotesAction(notes.map((n) => (n.id === selectedNoteId ? { ...n, isPinned: newPinned } : n)))
    } catch {}
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !note) return

    if (userTier === 'free' && (note.attachments?.length || 0) >= 2) {
      toast.error('Free tier is limited to 2 attachments per note.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size cannot exceed 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const storagePath = `${currentUser?.id}/${note.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('attachments').upload(storagePath, file)
      
      if (error) throw error

      const newAttachment = {
        id: crypto.randomUUID(),
        filename: file.name,
        mimeType: file.type,
        storagePath,
        iv: ''
      }
      
      const updatedAttachments = [...(note.attachments || []), newAttachment]
      const { error: updateError } = await supabase.from('notes').update({ attachments: updatedAttachments }).eq('id', note.id)
      
      if (updateError) throw updateError
      
      addAttachmentToNote(note.id, newAttachment)
      toast.success('File uploaded successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string, storagePath: string) => {
    if (!note) return
    try {
      const { error: storageError } = await supabase.storage.from('attachments').remove([storagePath])
      if (storageError) throw storageError
      
      const updatedAttachments = (note.attachments || []).filter(a => a.id !== attachmentId)
      const { error: dbError } = await supabase.from('notes').update({ attachments: updatedAttachments }).eq('id', note.id)
      if (dbError) throw dbError
      
      removeAttachmentFromNote(note.id, attachmentId)
      toast.success('Attachment deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete attachment')
    }
  }

  const handleDownloadAttachment = async (storagePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage.from('attachments').createSignedUrl(storagePath, 60)
      if (error) throw error
      if (data?.signedUrl) {
        const link = document.createElement('a')
        link.href = data.signedUrl
        link.download = filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error: any) {
      toast.error('Failed to download file')
    }
  }

  const handleToggleArchive = async () => {
    if (!selectedNoteId || !note) return
    const newArchived = !note.isArchived
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          is_archived: newArchived,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedNoteId)

      if (!error) {
        if (newArchived) {
          const updated = notes.filter((n) => n.id !== selectedNoteId)
          setNotesAction(updated)
          router.push('/dashboard/notes')
        } else {
          const updated = notes.map((n) => n.id === selectedNoteId ? { ...n, isArchived: false } : n)
          setNotesAction(updated)
        }
        toast.success(newArchived ? 'Note archived' : 'Note restored')
      } else {
        toast.error('Failed to update')
      }
    } catch { toast.error('Failed to update') }
  }

  const handleRestoreVersion = (restoredTitle: string, restoredContent: string) => {
    setTitle(restoredTitle)
    setContent(restoredContent)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      saveContent()
    }, 500)
  }

  useEffect(() => {
    if (!note && !initialLoad) router.push('/dashboard/notes')
  }, [note, initialLoad, router])

  if (!note && !initialLoad) return null

  return (
    <div className="min-h-screen flex bg-gradient-mesh-dash noise-overlay">
      <AppSidebar  />

      <div className="flex-1 flex flex-col min-w-0">
        <NoteHeader
          note={note}
          title={title}
          handleTitleChange={handleTitleChange}
          isSaving={isSaving}
          isEncryptedSession={isEncryptedSession}
          currentUser={currentUser}
          isTypingRef={isTyping}
          saveTimeoutRef={saveTimeoutRef}
          saveContent={saveContent}
          onOpenHistory={() => setHistoryOpen(true)}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onDelete={() => setDeleteConfirmOpen(true)}
        />
        
        {/* Editor Area */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
          <div className="glass-card inner-glow rounded-3xl min-h-[calc(100vh-8rem)]">
            {initialLoad ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#059669]" />
                <span className="ml-2 text-muted-foreground">Loading note...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-2 border-b border-white/5 bg-black/20">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (isTyping.current && note?.id) {
                        isTyping.current = false
                        supabase.channel(`room:note-${note.id}`).track({ userId: currentUser?.id, isTyping: false })
                      }
                      router.push('/dashboard/notes')
                    }}>
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {activeCollaborators.length > 0 && (
                      <div className="flex items-center mr-2">
                        {activeCollaborators.map((collaborator, index) => (
                          <div key={collaborator.userId} className={`relative ${index > 0 ? '-ml-2' : ''} w-8 h-8 rounded-full border-2 border-background bg-primary flex items-center justify-center`}>
                            {collaborator.avatar ? (
                              <img src={collaborator.avatar} alt={collaborator.userName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-primary-foreground font-bold">{collaborator.userName.charAt(0).toUpperCase()}</span>
                            )}
                            {collaborator.isTyping && (
                              <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-background" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 mb-3">
                            <p className="text-xs text-muted-foreground">
                              Start typing to edit. Content auto-saves every 1.5 seconds.
                            </p>
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {content.length} chars
                            </Badge>
                          </div>
                        </TooltipTrigger>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <Button variant="outline" size="sm" className="h-8 gap-2 ml-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                      Attach
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  {/* Lock Banner */}
                  {isLockedByOther && lockedByInfo && (
                    <div className="mb-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-full shrink-0">
                        <Lock className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Read-Only Mode</p>
                        <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-0.5">
                          {lockedByInfo.name || lockedByInfo.email} is currently editing this note.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Attachments Section */}
                  <NoteAttachments
                    attachments={note?.attachments}
                    onDownload={handleDownloadAttachment}
                    onDelete={handleDeleteAttachment}
                  />

                  {/* Notion-Style Markdown Editor */}
                  <NotionEditor
                    noteId={note?.id || ''}
                    currentUser={currentUser}
                    content={content}
                    onChange={(val) => {
                      setContent(val)
                      if (!isTyping.current && note?.id) {
                        isTyping.current = true
                        supabase.channel(`room:note-${note.id}`).track({ userId: currentUser?.id, userName: currentUser?.name || currentUser?.email?.split('@')[0] || 'Anonymous', name: currentUser?.name || currentUser?.email?.split('@')[0] || 'Anonymous', avatar: currentUser?.image || null, isTyping: true })
                      }
                      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
                      saveTimeoutRef.current = setTimeout(() => {
                        saveTimeoutRef.current = null
                        saveContent()
                        if (isTyping.current && note?.id) {
                          isTyping.current = false
                          supabase.channel(`room:note-${note.id}`).track({ userId: currentUser?.id, userName: currentUser?.name || currentUser?.email?.split('@')[0] || 'Anonymous', name: currentUser?.name || currentUser?.email?.split('@')[0] || 'Anonymous', avatar: currentUser?.image || null, isTyping: false })
                        }
                      }, 1500)
                    }}
                    disabled={initialLoad || isLockedByOther}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <NoteHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        selectedNoteId={selectedNoteId}
        workspaceId={note?.workspaceId}
        currentTitle={title}
        currentContent={content}
        onRestore={handleRestoreVersion}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This note will be permanently deleted.
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
