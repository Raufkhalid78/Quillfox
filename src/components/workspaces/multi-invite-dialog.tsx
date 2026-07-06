'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, UserPlus } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { encryptWithPublicKey } from '@/lib/e2ee'

interface MultiInviteDialogProps {
  children?: React.ReactNode
  defaultWorkspaceId?: string
}

export function MultiInviteDialog({ children, defaultWorkspaceId }: MultiInviteDialogProps) {
  const currentUser = useAppStore((s) => s.currentUser)
  const workspaces = useAppStore((s) => s.workspaces)
  const workspaceKeys = useAppStore((s) => s.workspaceKeys)
  
  // Only owners can invite
  const ownedWorkspaces = workspaces.filter(w => w.ownerId === currentUser?.id)

  const [isOpen, setIsOpen] = useState(false)
  const [emailsInput, setEmailsInput] = useState('')
  const [selectedWsIds, setSelectedWsIds] = useState<string[]>(defaultWorkspaceId ? [defaultWorkspaceId] : [])
  const [isInviting, setIsInviting] = useState(false)

  const handleToggleWorkspace = (id: string) => {
    setSelectedWsIds(prev => 
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    )
  }

  const handleInvite = async () => {
    if (!currentUser) return
    const emails = emailsInput.split(',').map(e => e.trim().toLowerCase()).filter(e => e)
    
    if (emails.length === 0) {
      toast.error('Please enter at least one email address.')
      return
    }
    if (selectedWsIds.length === 0) {
      toast.error('Please select at least one workspace.')
      return
    }

    setIsInviting(true)
    let successCount = 0
    let failureCount = 0

    try {
      for (const email of emails) {
        // 1. Get profile by email
        const { data: profile } = await supabase
          .rpc('get_profile_by_email', { search_email: email })
          .single()

        if (!profile) {
          toast.error(`User not found: ${email}`)
          failureCount++
          continue
        }

        const inviteeId = (profile as any).id
        const publicRsaKey = (profile as any).public_rsa_key

        if (!publicRsaKey) {
          toast.error(`${email} has not set up encryption yet.`)
          failureCount++
          continue
        }

        // 2. Add to each selected workspace
        for (const wsId of selectedWsIds) {
          const wsKey = workspaceKeys[wsId]
          if (!wsKey) {
            console.error(`Missing symmetric key for workspace ${wsId}`)
            continue
          }

          try {
            // Export AES key and wrap it with invitee's public RSA key
            const { exportKeyToString } = await import('@/lib/e2ee')
            const rawKeyStr = await exportKeyToString(wsKey)
            const wrappedKey = await encryptWithPublicKey(rawKeyStr, publicRsaKey)

            const { error: insertErr } = await supabase
              .from('workspace_members')
              .insert({
                user_id: inviteeId,
                workspace_id: wsId,
                role: 'member',
                encrypted_workspace_key: wrappedKey,
                joined_at: new Date().toISOString()
              })

            if (insertErr) {
              if (insertErr.code !== '23505') { // Ignore unique violation (already a member)
                throw insertErr
              }
            } else {
              successCount++
            }
          } catch (e) {
            console.error(`Failed to invite ${email} to ${wsId}`, e)
            failureCount++
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} invitation(s)!`)
        setEmailsInput('')
        setIsOpen(false)
      } else if (failureCount > 0) {
        toast.error('Failed to send some invitations.')
      }

    } catch (e) {
      console.error(e)
      toast.error('An unexpected error occurred.')
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Invite Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Invite multiple people to one or more of your workspaces.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Email Addresses</Label>
            <Input 
              placeholder="alice@example.com, bob@example.com" 
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas.</p>
          </div>

          <div className="space-y-2">
            <Label>Select Workspaces</Label>
            <ScrollArea className="h-[120px] rounded-md border p-2">
              {ownedWorkspaces.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">You don't own any workspaces yet.</p>
              ) : (
                <div className="space-y-2 p-1">
                  {ownedWorkspaces.map(ws => (
                    <div key={ws.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`ws-${ws.id}`} 
                        checked={selectedWsIds.includes(ws.id)}
                        onCheckedChange={() => handleToggleWorkspace(ws.id)}
                      />
                      <label 
                        htmlFor={`ws-${ws.id}`} 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {ws.title}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={isInviting || ownedWorkspaces.length === 0}>
            {isInviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Send Invites
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
