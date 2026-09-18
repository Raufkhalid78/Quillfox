import { supabase } from './supabase'

/**
 * Persisted write queue for offline-first web.
 *
 * Components call `updateRow`/`deleteRow` instead of Supabase directly. If the
 * request fails because the network is unavailable, the operation is stored in
 * localStorage and replayed by `flushQueue()` when connectivity returns.
 */

export type QueueMatch =
  | { column: string; value: string }
  | { column: string; values: string[] }

export interface QueuedOp {
  id: string
  table: string
  kind: 'update' | 'delete'
  values?: Record<string, unknown>
  match: QueueMatch
  ts: number
}

const STORAGE_KEY = 'quillfox-offline-queue'

export function isNetworkError(error: unknown): boolean {
  if (!error) return false
  const message = (error as { message?: string })?.message?.toLowerCase() ?? ''
  return (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  )
}

export function getQueue(): QueuedOp[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as QueuedOp[]
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedOp[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new CustomEvent('quillfox-queue-change', { detail: queue.length }))
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'ts'>): void {
  const queue = getQueue()
  queue.push({
    ...op,
    id: `${op.table}-${op.match.column}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  })
  saveQueue(queue)
}

export function queueLength(): number {
  return getQueue().length
}

async function applyOp(op: QueuedOp) {
  const query =
    op.kind === 'delete'
      ? supabase.from(op.table).delete()
      : supabase.from(op.table).update(op.values ?? {})

  if ('values' in op.match) {
    return query.in(op.match.column, op.match.values)
  }
  return query.eq(op.match.column, op.match.value)
}

/** Replays queued operations. Returns the number successfully applied. */
export async function flushQueue(): Promise<number> {
  const queue = getQueue()
  if (queue.length === 0) return 0

  const remaining: QueuedOp[] = []
  let applied = 0

  for (const op of queue) {
    try {
      const { error } = await applyOp(op)
      if (error) throw error
      applied++
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(op)
      } else {
        // Non-network error (e.g. RLS) — drop it so the queue cannot wedge.
        console.warn('[offline-queue] dropping op', op, err)
      }
    }
  }

  saveQueue(remaining)
  return applied
}

/**
 * Tries a Supabase write immediately; falls back to the offline queue on
 * network failure. Returns true when the write was queued.
 */
export async function updateRow(
  table: string,
  values: Record<string, unknown>,
  match: QueueMatch
): Promise<boolean> {
  try {
    const { error } = await applyOp({ id: '', table, kind: 'update', values, match, ts: 0 })
    if (error) throw error
    return false
  } catch (err) {
    if (isNetworkError(err)) {
      enqueue({ table, kind: 'update', values, match })
      return true
    }
    throw err
  }
}
