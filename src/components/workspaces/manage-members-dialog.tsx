'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trash2, Users } from 'lucide-react'

// getInitials helper
function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.substring(0, 2).toUpperCase()
}

interface ManageMembersDialogProps {
  wsMembers: Array<{ id: string; userId: string; role: string; joinedAt: string; user: { id: string; name: string | null; email: string; image: string | null } }>
  onRemoveClick: (memberId: string, memberName: string) => void
  children?: React.ReactNode
}

export function ManageMembersDialog({ wsMembers, onRemoveClick, children }: ManageMembersDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full">
            <Users className="w-4 h-4 mr-2" /> Manage Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            View and manage access for members of this workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 mt-4">
          {wsMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-[#7c3aed]/10 text-[#7c3aed]">
                    {getInitials(member.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.user.name || member.user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>
              {member.role !== 'owner' && (
                <Button aria-label="Remove member" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onRemoveClick(member.id, member.user.name || member.user.email)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {wsMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
