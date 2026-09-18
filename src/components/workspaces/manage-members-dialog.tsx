'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Users, Crown } from 'lucide-react'

function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.substring(0, 2).toUpperCase()
}

interface Member {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; name: string | null; email: string; image: string | null }
}

interface ManageMembersDialogProps {
  wsMembers: Member[]
  onRemoveClick: (memberId: string, memberName: string) => void
  onRoleChange?: (memberId: string, role: string) => void
  onTransferOwnership?: (memberId: string, memberName: string) => void
  /** True when the signed-in user owns the workspace. */
  canManage?: boolean
  children?: React.ReactNode
}

const ROLES = ['admin', 'editor', 'viewer', 'member'] as const

export function ManageMembersDialog({
  wsMembers,
  onRemoveClick,
  onRoleChange,
  onTransferOwnership,
  canManage = false,
  children,
}: ManageMembersDialogProps) {
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
            View and manage access for members of this workspace. Editors and admins can modify content;
            viewers are read-only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 mt-4">
          {wsMembers.map((member) => {
            const isOwner = member.role === 'owner'
            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/40 bg-card/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-[#7c3aed]/10 text-[#7c3aed]">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.user.name || member.user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                      {isOwner && <Crown className="w-3 h-3 text-[#d97706]" aria-hidden="true" />}
                      {member.role}
                    </p>
                  </div>
                </div>

                {canManage && !isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onRoleChange && (
                      <Select value={member.role} onValueChange={(role) => onRoleChange(member.id, role)}>
                        <SelectTrigger className="h-8 w-[110px] text-xs" aria-label={`Role for ${member.user.name || member.user.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="capitalize">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {onTransferOwnership && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-[#d97706]"
                        aria-label={`Make ${member.user.name || member.user.email} owner`}
                        title="Transfer ownership"
                        onClick={() => onTransferOwnership(member.id, member.user.name || member.user.email)}
                      >
                        <Crown className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      aria-label="Remove member"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveClick(member.id, member.user.name || member.user.email)}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
          {wsMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No members found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}