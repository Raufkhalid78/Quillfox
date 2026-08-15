'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MonitorSmartphone, Loader2, LogOut, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

type Session = {
  id: string
  created_at: string
  updated_at: string
  user_agent: string
  ip: string
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchSessions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_my_sessions')
      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.warn('get_my_sessions RPC not installed yet.')
          setSessions([])
        } else {
          throw error
        }
      } else {
        setSessions(data || [])
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId)
    try {
      const { error } = await supabase.rpc('revoke_session', { session_id: sessionId })
      if (error) throw error
      
      toast.success('Session revoked successfully')
      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (err) {
      console.error("Failed to revoke session:", err)
      toast.error('Failed to revoke session')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Card className="rounded-xl border-border/50 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center shrink-0">
            <MonitorSmartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Device Sessions</CardTitle>
            <CardDescription>Manage devices signed into your account</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator className="opacity-50" />
      <CardContent className="pt-5 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4">
            <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No sessions found or RPC script not executed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/50 bg-black/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={session.user_agent}>
                    {session.user_agent || 'Unknown Device'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">IP: {session.ip}</p>
                    <span className="text-xs text-muted-foreground">&bull;</span>
                    <p className="text-xs text-muted-foreground">
                      Active {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="shrink-0 h-8 text-xs"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokingId === session.id}
                >
                  {revokingId === session.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <LogOut className="w-3 h-3 mr-1" />}
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
