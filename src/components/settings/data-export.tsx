'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Download, Database, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { decryptNoteContent } from '@/lib/encrypted-api'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const state = useAppStore.getState()
      const notes = state.notes
      const todos = state.todoLists

      const exportedNotes = await Promise.all(notes.map(async (n) => ({
        ...n,
        title: await decryptNoteContent(n.title, n.workspaceId),
        content: await decryptNoteContent(n.content, n.workspaceId),
      })))

      const exportedTodos = await Promise.all(todos.map(async (t) => ({
        ...t,
        title: await decryptNoteContent(t.title, t.workspaceId),
        items: await Promise.all(t.items.map(async (item) => ({
          ...item,
          title: await decryptNoteContent(item.title, t.workspaceId)
        })))
      })))

      const vaultData = {
        exportedAt: new Date().toISOString(),
        notes: exportedNotes,
        todoLists: exportedTodos
      }

      const blob = new Blob([JSON.stringify(vaultData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quillfox-vault-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('Vault exported successfully')
    } catch (err) {
      console.error("Export failed:", err)
      toast.error('Failed to export vault data')
    } finally {
      setIsExporting(false)
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
            <CardDescription>Download a decrypted backup of your vault</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="text-sm font-medium">Export Vault as JSON</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Downloads all notes and to-dos in a decrypted format. Keep this file safe.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
