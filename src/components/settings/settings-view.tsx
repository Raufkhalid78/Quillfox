'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { Settings, ShieldCheck, Loader2, LogOut, Sun, Moon, Trash2, Mail, User, Calendar, KeyRound, CheckCircle2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

export function SettingsView() {
  const currentUser = useAppStore((s) => s.currentUser)
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const updateUserName = useAppStore((s) => s.updateUserName)
  const isEncryptedSession = useAppStore((s) => s.isEncryptedSession)
  const { theme, setTheme } = useTheme()

  // Profile state
  const [profileName, setProfileName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!currentUser) setView('auth')
  }, [currentUser, setView])

  useEffect(() => {
    if (currentUser?.name) {
      setProfileName(currentUser.name)
    }
  }, [currentUser])

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const handleSaveName = async () => {
    if (!currentUser) return
    const trimmedName = profileName.trim()
    if (!trimmedName) {
      toast.error('Name cannot be empty')
      return
    }
    setIsSavingName(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name: trimmedName }),
      })
      if (res.ok) {
        updateUserName(trimmedName)
        toast.success('Name updated successfully')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update name')
      }
    } catch {
      toast.error('Failed to update name')
    } finally {
      setIsSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentUser) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setIsChangingPassword(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          currentPassword,
          newPassword,
        }),
      })
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        toast.success('Password changed successfully')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to change password')
      }
    } catch {
      toast.error('Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!currentUser) return
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm')
      return
    }
    setIsDeleting(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      })
      if (res.ok) {
        toast.success('Account deleted. Goodbye!')
        logout()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete account')
      }
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
      setDeleteConfirmText('')
    }
  }

  if (!currentUser) return null

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar activeView="settings" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate">Settings</h1>
            </div>
            {isEncryptedSession && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#059669] bg-[#059669]/10 border-[#059669]/20 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">E2E</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>End-to-end encryption active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="md:hidden h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6">

              {/* Profile Section */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-xl border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Profile</CardTitle>
                        <CardDescription>Manage your account information</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator className="opacity-50" />
                  <CardContent className="pt-5 space-y-5">
                    {/* Avatar + Name row */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-[#059669]/20">
                        <AvatarFallback className="text-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white font-semibold">
                          {getInitials(currentUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="space-y-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="profile-name" className="text-xs font-medium">Name</Label>
                            <div className="flex gap-2">
                              <Input
                                id="profile-name"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="h-9 text-sm"
                                placeholder="Your name"
                              />
                              <Button
                                size="sm"
                                className="gap-1.5 bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90 rounded-lg text-xs h-9 shrink-0"
                                onClick={handleSaveName}
                                disabled={isSavingName || profileName.trim() === currentUser.name}
                              >
                                {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">Save</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Email</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={currentUser.email}
                          readOnly
                          disabled
                          className="h-9 text-sm bg-muted/50"
                        />
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
                          <Mail className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                    </div>

                    {/* Account Created */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Account created on {format(new Date(), 'MMMM d, yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Change Password Section */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-xl border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Change Password</CardTitle>
                        <CardDescription>Update your account password</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator className="opacity-50" />
                  <CardContent className="pt-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-password" className="text-xs font-medium">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs font-medium">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-xs font-medium">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Confirm new password"
                      />
                    </div>
                    <Button
                      className="gap-1.5 bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90 rounded-lg text-xs h-9"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      Update Password
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Danger Zone Section */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-xl border-destructive/30 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible account actions</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator className="opacity-50" />
                  <CardContent className="pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Delete Account</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Permanently delete your account and all associated data including notes, todos, and workspaces.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        className="gap-1.5 rounded-lg text-xs h-9 shrink-0"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Account
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            </motion.div>
          </div>
        </main>
      </div>

      {/* Delete Account AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and <strong>all associated data</strong> including notes, todo lists, workspaces, and member relationships. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 mt-2">
            <Label htmlFor="delete-confirm" className="text-xs font-medium">
              Type <span className="font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="h-9 text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteOpen(false); setDeleteConfirmText('') }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
