'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Sparkles, Calendar, TrendingUp, CircleDot, Activity, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ActivityLog {
  created_at: string
  activity_type: string
}

export function DashboardAnalytics() {
  const userTier = useAppStore((s) => s.userTier)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const currentUser = useAppStore((s) => s.currentUser)
  const router = useRouter()

  const [logs, setLogs] = useState<ActivityLog[]>([])

  const isFree = userTier === 'free'

  useEffect(() => {
    // Entitlement is enforced here: free users never query analytics data.
    if (!currentUser || isFree) return
    const fetchLogs = async () => {
      try {
        const twentyEightDaysAgo = new Date()
        twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 27)
        twentyEightDaysAgo.setHours(0, 0, 0, 0)

        const { data, error } = await supabase
          .from('activity_logs')
          .select('created_at, activity_type')
          .eq('user_id', currentUser.id)
          .gte('created_at', twentyEightDaysAgo.toISOString())

        if (!error && data) setLogs(data as ActivityLog[])
      } catch (err) {
        console.warn('Failed to fetch activity logs:', err)
      }
    }
    fetchLogs()
  }, [currentUser, isFree])

  const pieData = useMemo(() => {
    const workspacesMap = new Map<string, { notes: number; todos: number }>()
    notes.forEach((n) => {
      const wsId = n.workspaceId || 'standalone'
      const cur = workspacesMap.get(wsId) || { notes: 0, todos: 0 }
      workspacesMap.set(wsId, { ...cur, notes: cur.notes + 1 })
    })
    todoLists.forEach((t) => {
      const wsId = t.workspaceId || 'standalone'
      const cur = workspacesMap.get(wsId) || { notes: 0, todos: 0 }
      workspacesMap.set(wsId, { ...cur, todos: cur.todos + 1 })
    })

    const data = Array.from(workspacesMap.entries())
      .map(([wsId, count]) => {
        const ws = workspaces.find((w) => w.id === wsId)
        return {
          name: ws ? ws.title : 'Personal Stash',
          value: count.notes + count.todos,
          color: ws ? ws.color : '#6d28d9',
        }
      })
      .filter((item) => item.value > 0)

    if (data.length === 0) {
      data.push({ name: 'Empty Workspace', value: 1, color: '#e2e8f0' })
    }
    return data
  }, [notes, todoLists, workspaces])

  const lineData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - idx))
      const dayLabel = days[date.getDay()]
      const dateString = date.toDateString()

      let completedCount = 0
      todoLists.forEach((t) => {
        ;(t.items || []).forEach((item) => {
          if (item.completed && item.completedAt) {
            if (new Date(item.completedAt).toDateString() === dateString) completedCount++
          }
        })
      })

      return { day: dayLabel, completed: completedCount }
    })
  }, [todoLists])

  const contributionGrid = useMemo(() => {
    return Array.from({ length: 28 }).map((_, idx) => {
      const date = new Date()
      date.setDate(date.getDate() - (27 - idx))
      const dateString = date.toDateString()
      const activityCount = logs.filter((log) => new Date(log.created_at).toDateString() === dateString).length

      let colorClass = 'bg-muted/40'
      if (activityCount > 0 && activityCount <= 2) colorClass = 'bg-emerald-500/20'
      else if (activityCount > 2 && activityCount <= 5) colorClass = 'bg-emerald-500/40'
      else if (activityCount > 5 && activityCount <= 8) colorClass = 'bg-emerald-500/70'
      else if (activityCount > 8) colorClass = 'bg-emerald-500'

      return {
        day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: activityCount,
        colorClass,
      }
    })
  }, [logs])

  // Real streak: consecutive days with at least one activity, ending today or yesterday.
  const streak = useMemo(() => {
    if (logs.length === 0) return 0
    const activeDays = new Set(logs.map((l) => new Date(l.created_at).toDateString()))
    let count = 0
    const cursor = new Date()
    if (!activeDays.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1)
      if (!activeDays.has(cursor.toDateString())) return 0
    }
    while (activeDays.has(cursor.toDateString())) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [logs])

  if (isFree) {
    return (
      <Card className="rounded-xl border-border/50 bg-card/40 overflow-hidden">
        <CardContent className="p-8">
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md mx-auto flex flex-col items-center text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">Unlock Productivity Insights</h3>
              <p className="text-xs text-muted-foreground">
                Task velocity charts, workspace distribution and a cryptographic activity grid are included with
                Premium and Ultra.
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/pricing')} className="gap-2">
              Upgrade to unlock <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Task Velocity Chart */}
        <Card className="md:col-span-2 rounded-xl border-border/50 bg-card/40 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              Task Completion Velocity
            </CardTitle>
            <CardDescription className="text-xs">Weekly completed todo items history</CardDescription>
          </CardHeader>
          <CardContent className="h-[180px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="day" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={20} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Note/Todo Distribution */}
        <Card className="rounded-xl border-border/50 bg-card/40 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <CircleDot className="w-3.5 h-3.5 text-primary" />
              Workspace Distribution
            </CardTitle>
            <CardDescription className="text-xs">Notes and tasks ratio per workspace</CardDescription>
          </CardHeader>
          <CardContent className="h-[180px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center select-none">
              <span className="text-lg font-bold text-foreground">{notes.length + todoLists.length}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Total Items</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Heat Grid */}
        <Card className="md:col-span-3 rounded-xl border-border/50 bg-card/40 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Activity — {streak}-day streak
            </CardTitle>
            <CardDescription className="text-xs">Your activity over the last 28 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-1.5">
              {contributionGrid.map((day) => (
                <div
                  key={day.day}
                  className={`w-6 h-6 rounded ${day.colorClass} hover:scale-105 transition-all`}
                  title={`${day.day}: ${day.count} activities`}
                  aria-label={`${day.day}: ${day.count} activities`}
                />
              ))}
            </div>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-4 select-none">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Last 4 weeks history
              </span>
              <div className="flex gap-1 items-center">
                <span>Less</span>
                <span className="w-2.5 h-2.5 bg-muted/40 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-emerald-500/20 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-emerald-500/70 rounded-sm" />
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                <span>More</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}