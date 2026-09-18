'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { decryptNoteTitle, decryptTodoTitle } from '@/lib/encrypted-api'

const NOTIFIED_KEY = 'quillfox-notified-reminders'

/**
 * Client-side due-date reminders using the browser Notification API.
 *
 * Notes: web push requires a service worker and a push subscription, which is
 * a larger piece of work. This provides in-session reminders (while a QuillFox
 * tab is open) and de-duplicates by due timestamp so a reminder fires once.
 */
export function useDueReminders() {
  const currentUser = useAppStore((s) => s.currentUser)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)

  useEffect(() => {
    if (!currentUser) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    let cancelled = false

    const getNotified = (): Record<string, number> => {
      try {
        return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}')
      } catch {
        return {}
      }
    }

    const check = async () => {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          // ignore
        }
      }
      if (Notification.permission !== 'granted' || cancelled) return

      const notified = getNotified()
      const now = Date.now()

      const dueNotes = notes.filter((n) => n.dueDate)
      const dueTodos = todoLists.filter((t) => t.dueDate)

      for (const n of dueNotes) {
        const key = `note-${n.id}`
        const due = new Date(n.dueDate as string).getTime()
        if (due <= now && notified[key] !== due) {
          const title = await decryptNoteTitle(n.title, n.workspaceId).catch(() => 'A note')
          new Notification('QuillFox — note due', { body: title, tag: key })
          notified[key] = due
        }
      }

      for (const t of dueTodos) {
        const key = `todo-${t.id}`
        const due = new Date(t.dueDate as string).getTime()
        if (due <= now && notified[key] !== due) {
          const title = await decryptTodoTitle(t.title, t.workspaceId).catch(() => 'A todo list')
          new Notification('QuillFox — todo due', { body: title, tag: key })
          notified[key] = due
        }
      }

      if (!cancelled) localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified))
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [currentUser, notes, todoLists])
}