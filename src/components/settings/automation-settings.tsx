'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/stores/app-store'
import { fetchRules, upsertRule, applyAutoArchiveCompleted } from '@/lib/automation'
import { toast } from 'sonner'
import { Zap, Loader2 } from 'lucide-react'

const OFFSETS = [0, 5, 15, 30, 60, 1440]

export function AutomationSettings() {
  const workspaces = useAppStore((s) => s.workspaces)
  const [autoArchive, setAutoArchive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [reminderWs, setReminderWs] = useState('__global__')
  const [offset, setOffset] = useState(15)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const rules = await fetchRules()
      if (cancelled) return
      setAutoArchive(rules.some((r) => r.ruleType === 'auto_archive_completed' && r.enabled))
      const reminder = rules.find((r) => r.ruleType === 'reminder_defaults' && r.enabled)
      if (reminder) {
        setReminderWs(reminder.workspaceId ?? '__global__')
        if (typeof reminder.config.offsetMinutes === 'number') setOffset(reminder.config.offsetMinutes)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleAutoArchive = async (value: boolean) => {
    setAutoArchive(value)
    const ok = await upsertRule('auto_archive_completed', null, value)
    if (!ok) {
      setAutoArchive(!value)
      toast.error('Failed to update rule')
      return
    }
    if (value) {
      const archived = await applyAutoArchiveCompleted()
      toast.success(archived > 0 ? `Rule enabled — archived ${archived} list(s)` : 'Rule enabled')
    } else {
      toast.success('Rule disabled')
    }
  }

  const saveReminderDefault = async () => {
    setIsSaving(true)
    try {
      const wsId = reminderWs === '__global__' ? null : reminderWs
      const ok = await upsertRule('reminder_defaults', wsId, true, { offsetMinutes: offset })
      toast[ok ? 'success' : 'error'](ok ? 'Reminder default saved' : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Automation</CardTitle>
            <CardDescription>Rules applied automatically as you work</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Auto-archive completed lists</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Archive a todo list automatically once every task is complete.
            </p>
          </div>
          <Switch checked={autoArchive} onCheckedChange={toggleAutoArchive} disabled={isLoading} aria-label="Auto-archive completed lists" />
        </div>

        <Separator className="opacity-50" />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Default reminder time</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How long before a due date to notify, per workspace.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={reminderWs} onValueChange={setReminderWs}>
              <SelectTrigger className="h-9 text-xs sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">All workspaces</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(offset)} onValueChange={(v) => setOffset(Number(v))}>
              <SelectTrigger className="h-9 text-xs sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFSETS.map((o) => (
                  <SelectItem key={o} value={String(o)}>
                    {o === 0 ? 'At due time' : `${o} min before`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={saveReminderDefault} disabled={isSaving} className="shrink-0">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
