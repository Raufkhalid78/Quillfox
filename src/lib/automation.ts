import { supabase } from './supabase'
import { useAppStore } from '@/stores/app-store'

export type RuleType = 'auto_archive_completed' | 'recurring_todo' | 'reminder_defaults'

export interface AutomationRule {
  id: string
  ruleType: RuleType
  workspaceId: string | null
  enabled: boolean
  config: Record<string, unknown>
}

function rowToRule(row: any): AutomationRule {
  return {
    id: row.id,
    ruleType: row.rule_type,
    workspaceId: row.workspace_id ?? null,
    enabled: row.enabled,
    config: row.config ?? {},
  }
}

export async function fetchRules(): Promise<AutomationRule[]> {
  const { data, error } = await supabase.from('automation_rules').select('*')
  if (error || !data) return []
  return data.map(rowToRule)
}

export async function upsertRule(
  ruleType: RuleType,
  workspaceId: string | null,
  enabled: boolean,
  config: Record<string, unknown> = {}
): Promise<boolean> {
  const userId = useAppStore.getState().currentUser?.id
  if (!userId) return false
  const id = `${ruleType}:${workspaceId ?? 'global'}`
  const { error } = await supabase.from('automation_rules').upsert(
    { id, user_id: userId, workspace_id: workspaceId, rule_type: ruleType, enabled, config },
    { onConflict: 'id' }
  )
  return !error
}

export async function isRuleEnabled(ruleType: RuleType): Promise<boolean> {
  const rules = await fetchRules()
  return rules.some((r) => r.ruleType === ruleType && r.enabled)
}

/** Per-workspace reminder offset (minutes), falling back to null. */
export async function getReminderDefault(workspaceId: string | null): Promise<number | null> {
  const rules = await fetchRules()
  const rule = rules.find(
    (r) => r.ruleType === 'reminder_defaults' && r.enabled && r.workspaceId === workspaceId
  )
  const value = rule?.config?.offsetMinutes
  return typeof value === 'number' ? value : null
}

/**
 * Archives any todo list whose items are all complete. Returns the number of
 * lists archived. Idempotent and safe to call after a sync.
 */
export async function applyAutoArchiveCompleted(): Promise<number> {
  const state = useAppStore.getState()
  const userId = state.currentUser?.id
  if (!userId) return 0
  if (!(await isRuleEnabled('auto_archive_completed'))) return 0

  const candidates = state.todoLists.filter(
    (t) => !t.isArchived && t.items.length > 0 && t.items.every((i) => i.completed)
  )
  if (candidates.length === 0) return 0

  let archived = 0
  for (const list of candidates) {
    const { error } = await supabase
      .from('todo_lists')
      .update({ is_archived: true })
      .eq('id', list.id)
    if (!error) archived++
  }

  if (archived > 0) {
    const archivedIds = new Set(candidates.map((c) => c.id))
    useAppStore.setState((s) => ({
      todoLists: s.todoLists.map((t) => (archivedIds.has(t.id) ? { ...t, isArchived: true } : t)),
    }))
  }
  return archived
}

/**
 * Creates the next occurrence of a recurring todo list (daily/weekly/monthly).
 * Returns the new list's id, or null when recurrence is not configured.
 */
export function nextOccurrence(from: Date, recurrence: 'daily' | 'weekly' | 'monthly'): Date {
  const next = new Date(from)
  if (recurrence === 'daily') next.setDate(next.getDate() + 1)
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7)
  else next.setMonth(next.getMonth() + 1)
  return next
}
