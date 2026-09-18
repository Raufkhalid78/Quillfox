'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Download, Database, Loader2, FileText, Upload, ShieldCheck, Table2 } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import {
  decryptNoteContent,
  decryptNoteTitle,
  decryptTodoTitle,
  decryptWorkspaceTitle,
  decryptWorkspaceDescription,
  encryptNoteContent,
  encryptNoteTitle,
  encryptTodoTitle,
} from '@/lib/encrypted-api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const hidePreviews = useAppStore((s) => s.hidePreviews)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const confirmPlaintext = () => {
    if (!hidePreviews) return true
    return window.confirm(
      'Your "hide previews" privacy setting is on. Exporting will write decrypted content to a file. Continue?'
    )
  }

  /** Loads the full vault (including archived items) and decrypts it. */
  const buildVault = async () => {
    const state = useAppStore.getState()
    const userId = state.currentUser?.id

    const [{ data: noteRows }, { data: todoRows }] = await Promise.all([
      supabase.from('notes').select('*').eq('author_id', userId),
      supabase
        .from('todo_lists')
        .select('*, todo_items(id,title,completed,completed_at,order)')
        .eq('author_id', userId),
    ])

    const notes = await Promise.all(
      (noteRows ?? []).map(async (n: any) => ({
        id: n.id,
        title: await decryptNoteTitle(n.title, n.workspace_id),
        content: await decryptNoteContent(n.content || '', n.workspace_id),
        tags: n.tags ?? [],
        attachments: n.attachments ?? [],
        workspaceId: n.workspace_id,
        isPinned: n.is_pinned,
        isArchived: n.is_archived,
        folderId: n.folder_id,
        dueDate: n.due_date,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }))
    )

    const todoLists = await Promise.all(
      (todoRows ?? []).map(async (t: any) => ({
        id: t.id,
        title: await decryptTodoTitle(t.title, t.workspace_id),
        workspaceId: t.workspace_id,
        isPinned: t.is_pinned,
        isArchived: t.is_archived,
        folderId: t.folder_id,
        dueDate: t.due_date,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        items: await Promise.all(
          (t.todo_items ?? []).map(async (item: any) => ({
            id: item.id,
            title: await decryptNoteContent(item.title, t.workspace_id),
            completed: item.completed,
            completedAt: item.completed_at,
            order: item.order,
          }))
        ),
      }))
    )

    const workspaces = await Promise.all(
      state.workspaces.map(async (w) => ({
        id: w.id,
        title: await decryptWorkspaceTitle(w.title, w.id),
        description: await decryptWorkspaceDescription(w.description, w.id),
        color: w.color,
        icon: w.icon,
        ownerId: w.ownerId,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }))
    )

    const folders = state.folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
    }))

    return { notes, todoLists, workspaces, folders }
  }

  const handleExportJson = async () => {
    if (!confirmPlaintext()) return
    setIsExporting(true)
    try {
      const vault = await buildVault()
      const payload = { exportedAt: new Date().toISOString(), version: 1, ...vault }
      download(
        `quillfox-vault-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
      )
      toast.success('Vault exported successfully')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export vault data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportMarkdown = async () => {
    if (!confirmPlaintext()) return
    setIsExporting(true)
    try {
      const { notes, todoLists, workspaces, folders } = await buildVault()
      const lines: string[] = ['# QuillFox Export', '', `Exported ${new Date().toISOString()}`, '']

      if (workspaces.length > 0) {
        lines.push('## Workspaces', '')
        workspaces.forEach((w) => lines.push(`- ${w.title}${w.description ? ` — ${w.description}` : ''}`))
        lines.push('')
      }
      if (folders.length > 0) {
        lines.push('## Folders', '')
        folders.forEach((f) => lines.push(`- ${f.name}`))
        lines.push('')
      }

      lines.push('## Notes', '')
      notes.forEach((n) => {
        lines.push(`### ${n.title}${n.isArchived ? ' (archived)' : ''}`, '', n.content || '', '')
      })

      lines.push('## Todo Lists', '')
      todoLists.forEach((t) => {
        lines.push(`### ${t.title}${t.isArchived ? ' (archived)' : ''}`, '')
        t.items.forEach((i) => lines.push(`- [${i.completed ? 'x' : ' '}] ${i.title}`))
        lines.push('')
      })

      download(`quillfox-vault-${new Date().toISOString().split('T')[0]}.md`, lines.join('\n'), 'text/markdown')
      toast.success('Vault exported as Markdown')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export vault data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportCsv = async () => {
    if (!confirmPlaintext()) return
    setIsExporting(true)
    try {
      const { notes } = await buildVault()
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
      const header = ['id', 'title', 'content', 'workspaceId', 'isArchived', 'tags', 'dueDate', 'updatedAt']
      const rows = notes.map((n) =>
        [
          n.id,
          n.title,
          n.content,
          n.workspaceId,
          n.isArchived,
          (n.tags ?? []).join('|'),
          n.dueDate,
          n.updatedAt,
        ]
          .map(escape)
          .join(',')
      )
      download(
        `quillfox-notes-${new Date().toISOString().split('T')[0]}.csv`,
        [header.join(','), ...rows].join('\n'),
        'text/csv'
      )
      toast.success('Notes exported as CSV')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export CSV')
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Exports the raw encrypted rows as-is. No decryption and no privacy prompt:
   * the file is ciphertext and can only be read with the user's keys.
   */
  const handleExportEncrypted = async () => {
    setIsExporting(true)
    try {
      const userId = useAppStore.getState().currentUser?.id
      const [{ data: noteRows }, { data: todoRows }, { data: itemRows }, { data: folderRows }] =
        await Promise.all([
          supabase.from('notes').select('*').eq('author_id', userId),
          supabase.from('todo_lists').select('*').eq('author_id', userId),
          supabase.from('todo_items').select('*'),
          supabase.from('folders').select('*').eq('user_id', userId),
        ])

      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        encrypted: true,
        notes: noteRows ?? [],
        todoLists: todoRows ?? [],
        todoItems: itemRows ?? [],
        folders: folderRows ?? [],
      }
      download(
        `quillfox-encrypted-backup-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(payload),
        'application/json'
      )
      toast.success('Encrypted backup downloaded')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export encrypted backup')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    if (!confirmPlaintext()) return
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const payload = JSON.parse(await file.text())
      if (!payload || !Array.isArray(payload.notes)) throw new Error('Not a QuillFox backup file')

      const state = useAppStore.getState()
      const userId = state.currentUser?.id
      if (!userId) throw new Error('Not signed in')

      const accessible = new Set(state.workspaces.map((w) => w.id))
      const nowIso = new Date().toISOString()
      let imported = 0

      for (const n of payload.notes) {
        try {
          const workspaceId = n.workspaceId && accessible.has(n.workspaceId) ? n.workspaceId : null
          const title = await encryptNoteTitle(n.title || 'Untitled', workspaceId)
          const content = await encryptNoteContent(n.content || '', workspaceId)
          const { error } = await supabase.from('notes').upsert({
            id: n.id,
            title,
            content,
            workspace_id: workspaceId,
            author_id: userId,
            is_pinned: !!n.isPinned,
            is_archived: !!n.isArchived,
            folder_id: null,
            due_date: n.dueDate ?? null,
            created_at: n.createdAt ?? nowIso,
            updated_at: nowIso,
          })
          if (!error) imported++
        } catch {
          // Skip rows that fail (e.g. id collision the user cannot access).
        }
      }

      for (const t of payload.todoLists ?? []) {
        try {
          const workspaceId = t.workspaceId && accessible.has(t.workspaceId) ? t.workspaceId : null
          const title = await encryptTodoTitle(t.title || 'Untitled', workspaceId)
          const { error } = await supabase.from('todo_lists').upsert({
            id: t.id,
            title,
            workspace_id: workspaceId,
            author_id: userId,
            is_pinned: !!t.isPinned,
            is_archived: !!t.isArchived,
            folder_id: null,
            due_date: t.dueDate ?? null,
            created_at: t.createdAt ?? nowIso,
            updated_at: nowIso,
          })
          if (error) continue
          imported++

          const items = await Promise.all(
            (t.items ?? []).map(async (item: any, idx: number) => ({
              id: item.id,
              title: await encryptNoteContent(item.title || '', workspaceId),
              completed: !!item.completed,
              completed_at: item.completedAt ?? null,
              order: item.order ?? idx,
              todo_list_id: t.id,
            }))
          )
          if (items.length > 0) await supabase.from('todo_items').upsert(items)
        } catch {
          // skip
        }
      }

      for (const f of payload.folders ?? []) {
        try {
          await supabase
            .from('folders')
            .upsert({ id: f.id, name: f.name, user_id: userId, created_at: f.createdAt ?? nowIso })
        } catch {
          // skip
        }
      }

      // Ask the data views to re-fetch (they listen to globalSyncTrigger).
      useAppStore.setState((s) => ({ globalSyncTrigger: (s.globalSyncTrigger || 0) + 1 }))
      toast.success(`Imported ${imported} item${imported === 1 ? '' : 's'} from backup`)
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`)
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Data Export</CardTitle>
            <CardDescription>Download a complete decrypted backup of your vault</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Export as JSON</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full backup: notes, todos, workspaces and folders — including archived items. Keep this file safe.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportJson} disabled={isExporting} className="shrink-0">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export JSON
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Export as Markdown</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Human-readable document of your notes and todo lists.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown} disabled={isExporting} className="shrink-0">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Export Markdown
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Export notes as CSV</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Spreadsheet-friendly export of your notes (title, content, tags, dates).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting} className="shrink-0">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Table2 className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Encrypted backup</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raw ciphertext backup — safe to store anywhere; only your keys can read it.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportEncrypted} disabled={isExporting} className="shrink-0">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Download Backup
          </Button>
        </div>

        <Separator className="opacity-50" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Import / Restore from JSON</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Restore notes and todo lists from a QuillFox JSON export. Existing items with the same id are updated.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleImportClick} disabled={isImporting} className="shrink-0">
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </CardContent>
    </Card>
  )
}