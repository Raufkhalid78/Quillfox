'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Sparkles, Calendar, TrendingUp, CircleDot, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function DashboardAnalytics() {
  const userTier = useAppStore((s) => s.userTier)
  const setTier = useAppStore((s) => s.setTier)
  const notes = useAppStore((s) => s.notes)
  const todoLists = useAppStore((s) => s.todoLists)
  const workspaces = useAppStore((s) => s.workspaces)
  const currentUser = useAppStore((s) => s.currentUser)

  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    if (!currentUser) return
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

        if (!error && data) {
          setLogs(data)
        }
      } catch (err) {
        console.warn('Failed to fetch activity logs:', err)
      }
    }
    fetchLogs()
  }, [currentUser])

  // 1. Process distribution data
  const pieData = useMemo(() => {
    const workspacesMap = new Map<string, { notes: number; todos: number }>()
    notes.forEach(n => {
      const wsId = n.workspaceId || 'standalone'
      const cur = workspacesMap.get(wsId) || { notes: 0, todos: 0 }
      workspacesMap.set(wsId, { ...cur, notes: cur.notes + 1 })
    })
    todoLists.forEach(t => {
      const wsId = t.workspaceId || 'standalone'
      const cur = workspacesMap.get(wsId) || { notes: 0, todos: 0 }
      workspacesMap.set(wsId, { ...cur, todos: cur.todos + 1 })
    })

    const data = Array.from(workspacesMap.entries()).map(([wsId, count]) => {
      const ws = workspaces.find(w => w.id === wsId)
      return {
        name: ws ? ws.title : 'Personal Stash',
        value: count.notes + count.todos,
        color: ws ? ws.color : '#6d28d9',
      }
    }).filter(item => item.value > 0)

    if (data.length === 0) {
      data.push({ name: 'Empty Workspace', value: 1, color: '#e2e8f0' })
    }
    return data
  }, [notes, todoLists, workspaces])

  // 2. Dynamic line chart data for last 7 days (Task velocity)
  const lineData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - idx))
      const dayLabel = days[date.getDay()]
      const dateString = date.toDateString()

      let completedCount = 0
      todoLists.forEach(t => {
        (t.items || []).forEach(item => {
          if (item.completed && item.completedAt) {
            const completionDate = new Date(item.completedAt)
            if (completionDate.toDateString() === dateString) {
              completedCount++
            }
          }
        })
      })

      return {
        day: dayLabel,
        completed: completedCount
      }
    })
  }, [todoLists])

  // 3. Dynamic 28 days activity contribution squares
  const contributionGrid = useMemo(() => {
    return Array.from({ length: 28 }).map((_, idx) => {
      const date = new Date()
      date.setDate(date.getDate() - (27 - idx))
      const dateString = date.toDateString()

      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.created_at)
        return logDate.toDateString() === dateString
      })

      const activityCount = dayLogs.length

      let colorClass = 'bg-muted/40'
      if (activityCount > 0 && activityCount <= 2) {
        colorClass = 'bg-emerald-500/20'
      } else if (activityCount > 2 && activityCount <= 5) {
        colorClass = 'bg-emerald-500/40'
      } else if (activityCount > 5 && activityCount <= 8) {
        colorClass = 'bg-emerald-500/70'
      } else if (activityCount > 8) {
        colorClass = 'bg-emerald-500'
      }

      return {
        day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: activityCount,
        colorClass
      }
    })
  }, [logs])

  return (
    <div className="relative w-full">
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-300 ${
        userTier === 'free' ? 'blur-[2px] select-none pointer-events-none' : ''
      }`}>
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
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="completed" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
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
              Productivity Contribution Streak
            </CardTitle>
            <CardDescription className="text-xs">Your encryption activity grid for the last 28 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-1.5">
              {contributionGrid.map((day) => (
                <div
                  key={day.day}
                  className={`w-6 h-6 rounded ${day.colorClass} hover:scale-105 active:scale-95 transition-all cursor-pointer`}
                  title={`${day.day}: ${day.count} activities tracked`}
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

      {/* Pro Tier Lock Overlay */}
      {userTier === 'free' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20 rounded-xl backdrop-blur-[2px]">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md p-6 bg-card/95 border border-border/80 rounded-2xl shadow-xl flex flex-col items-center text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">Unlock Pro Productivity Charts</h3>
              <p className="text-xs text-muted-foreground">
                Gain deep insights into your productivity with interactive task graphs, note-to-todo ratios, and cryptographic activity grids.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg text-xs"
              onClick={() => {
                setTier('premium')
                toast.success('Premium Tier Simulated! Enjoy analytics dashboard.')
              }}
            >
              Simulate Premium Tier
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
