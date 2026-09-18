'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Activity, FileText, ListTodo, Layers, UserPlus, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityRow {
  id: string
  activity_type: string
  created_at: string
  user_id: string
  workspace_id: string | null
}

interface FeedItem extends ActivityRow {
  actorName: string
  actorImage: string | null
}

const ICONS: Record<string, typeof Activity> = {
  note_create: FileText,
  note_update: FileText,
  note_delete: Trash2,
  todo_create: ListTodo,
  todo_update: ListTodo,
  todo_complete: ListTodo,
  workspace_create: Layers,
  member_invite: UserPlus,
  member_remove: UserPlus,
}

function describe(type: string): string {
  switch (type) {
    case 'note_create': return 'created a note'
    case 'note_update': return 'updated a note'
    case 'note_delete': return 'deleted a note'
    case 'todo_create': return 'created a todo list'
    case 'todo_update': return 'updated a todo list'
    case 'todo_complete': return 'completed a task'
    case 'workspace_create': return 'created a workspace'
    case 'member_invite': return 'invited a member'
    case 'member_remove': return 'removed a member'
    default: return 'made a change'
  }
}

export function ActivityFeed() {
  const currentUser = useAppStore((s) => s.currentUser)
  const [items, setItems] = useState<FeedItem[]>([])

  const load = useCallback(async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from('activity_logs')
      .select('id, activity_type, created_at, user_id, workspace_id')
      .order('created_at', { ascending: false })
      .limit(15)
    const rows = (data as ActivityRow[]) ?? []
    if (rows.length === 0) {
      setItems([])
      return
    }
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, image')
      .in('id', userIds)
    const profileRows = (profiles ?? []) as Array<{ id: string; name: string | null; image: string | null }>
    const byId = new Map(profileRows.map((p) => [p.id, p]))
    setItems(
      rows.map((r) => {
        const p = byId.get(r.user_id)
        return {
          ...r,
          actorName: p?.name || (r.user_id === currentUser.id ? 'You' : 'Someone'),
          actorImage: p?.image ?? null,
        }
      })
    )
  }, [currentUser])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser, load])

  return (
    <Card className="rounded-xl border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#059669]" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No recent activity.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = ICONS[item.activity_type] || Activity
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <Avatar className="h-7 w-7 shrink-0">
                    {item.actorImage && <AvatarImage src={item.actorImage} alt="" />}
                    <AvatarFallback className="text-[10px] bg-[#059669]/10 text-[#059669]">
                      {item.actorName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      <span className="font-medium">{item.actorName}</span>{' '}
                      <span className="text-muted-foreground">{describe(item.activity_type)}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
