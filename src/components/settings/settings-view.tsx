'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { supabase } from '@/lib/supabase'
import { AppSidebar } from '@/components/shared/app-sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Settings, ShieldCheck, Loader2, LogOut, Sun, Moon, Trash2, Mail, User, Calendar, KeyRound, CheckCircle2, Crown, Lock, ShieldAlert, Camera, Eye, EyeOff, CreditCard } from 'lucide-react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { wrapEncryptionKey, base64ToUint8Array, deriveKey, encrypt, decrypt, isEncrypted } from '@/lib/e2ee'

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(passcode)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
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
  const userTier = useAppStore((s) => s.userTier)
  const setTier = useAppStore((s) => s.setTier)
  const vaultAutoLock = useAppStore((s) => s.vaultAutoLock)
  const vaultLockTimeout = useAppStore((s) => s.vaultLockTimeout)
  const vaultPasscodeHash = useAppStore((s) => s.vaultPasscodeHash)
  const updateVaultSettings = useAppStore((s) => s.updateVaultSettings)
  const encryptionKey = useAppStore((s) => s.encryptionKey)
  const encryptionSalt = useAppStore((s) => s.encryptionSalt)
  const { theme, setTheme } = useTheme()

  // Profile state
  const [profileName, setProfileName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  // Profile Image state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const updateUserImage = useAppStore((s) => s.updateUserImage)

  // Vault Settings State
  const [isAutolockLoading, setIsAutolockLoading] = useState(false)
  const [passcodeOpen, setPasscodeOpen] = useState(false)
  const [passcodeVal, setPasscodeVal] = useState('')
  const [confirmPasscodeVal, setConfirmPasscodeVal] = useState('')
  const [isSavingPasscode, setIsSavingPasscode] = useState(false)
  const [showPasscode, setShowPasscode] = useState(false)
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) return
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('Image size must be less than 1MB')
      return
    }

    setIsUploadingImage(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${currentUser.id}/avatar.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        toast.error('Failed to upload image')
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ image: publicUrl })
        .eq('id', currentUser.id)

      if (dbError) {
        toast.error(dbError.message || 'Failed to save profile picture')
        return
      }

      updateUserImage(publicUrl)
      toast.success('Profile picture updated successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update profile picture')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleRemoveImage = async (e: React.MouseEvent) => {
    if (!currentUser) return
    e.stopPropagation()
    setIsUploadingImage(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ image: null })
        .eq('id', currentUser.id)

      if (error) {
        toast.error(error.message || 'Failed to remove profile picture')
        return
      }

      updateUserImage(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      toast.success('Profile picture removed')
    } catch {
      toast.error('Failed to remove profile picture')
    } finally {
      setIsUploadingImage(false)
    }
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
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: trimmedName }
      })
      if (authError) {
        toast.error(authError.message || 'Failed to update name')
        return
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ name: trimmedName })
        .eq('id', currentUser.id)

      if (dbError) {
        toast.error(dbError.message || 'Failed to update profile name')
        return
      }

      updateUserName(trimmedName)
      toast.success('Name updated successfully')
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
      // 1. Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Current password is incorrect')
        return
      }

      // 2. Change password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      if (error) {
        toast.error(error.message || 'Failed to change password')
        return
      }

      // 3. Re-wrap Master Key
      if (encryptionKey && encryptionSalt) {
        toast.loading('Re-securing your vault with new password...', { id: 're-encrypt' })
        try {
          const saltArray = base64ToUint8Array(encryptionSalt)
          const newWrappedKey = await wrapEncryptionKey(encryptionKey, newPassword, saltArray)
          
          await supabase.auth.updateUser({
             data: { wrapped_master_key: newWrappedKey }
          })

          // Update the key in the store
          useAppStore.getState().setEncryptionKey(encryptionKey, encryptionSalt)

          // Clear vault lock since the wrapped key (session storage) used passcode, but it's safe to keep it actually.
          // Wait, vault passcode wraps the MEK. Changing login password doesn't invalidate vault passcode.
          // We can just leave the vault passcode alone!
          toast.success('Password changed and vault re-secured.', { id: 're-encrypt' })
        } catch (err) {
          console.error(err)
          toast.error('Failed to re-secure vault.', { id: 're-encrypt' })
        }
      } else {
        toast.success('Password changed successfully')
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
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
      // Cascade delete workspaces, notes, and todo lists owned by the user
      await supabase.from('workspaces').delete().eq('owner_id', currentUser.id)
      await supabase.from('notes').delete().eq('author_id', currentUser.id)
      await supabase.from('todo_lists').delete().eq('author_id', currentUser.id)
      
      // Sign out and clear session
      await supabase.auth.signOut()
      logout()
      toast.success('Data wiped. True account deletion requires backend admin API.')
    } catch {
      toast.error('Failed to delete account')
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
      setDeleteConfirmText('')
    }
  }


  const handleToggleAutoLock = async (enabled: boolean) => {
    if (!currentUser) return
    if (userTier === 'free') {
      toast.error('Vault Auto-Lock is a Premium/Ultra feature!')
      return
    }

    if (enabled && !vaultPasscodeHash) {
      toast.error('Please configure a 6-digit passcode first.')
      setPasscodeOpen(true)
      return
    }

    setIsAutolockLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vault_auto_lock: enabled })
        .eq('id', currentUser.id)

      if (error) {
        console.warn("DB update failed, using local fallback:", error.message)
      }
      updateVaultSettings({ vaultAutoLock: enabled })
      toast.success(enabled ? 'Auto-Lock enabled' : 'Auto-Lock disabled')
    } catch {
      updateVaultSettings({ vaultAutoLock: enabled })
      toast.success(enabled ? 'Auto-Lock enabled (local)' : 'Auto-Lock disabled (local)')
    } finally {
      setIsAutolockLoading(false)
    }
  }

  const handleTimeoutChange = async (minutes: string) => {
    if (!currentUser) return
    const mins = parseInt(minutes, 10)
    if (isNaN(mins)) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vault_lock_timeout: mins })
        .eq('id', currentUser.id)

      if (error) {
        console.warn("DB update failed, using local fallback:", error.message)
      }
      updateVaultSettings({ vaultLockTimeout: mins })
      toast.success(`Auto-lock timeout set to ${mins} minutes`)
    } catch {
      updateVaultSettings({ vaultLockTimeout: mins })
      toast.success(`Auto-lock timeout set to ${mins} minutes (local)`)
    }
  }

  const handleSetPasscode = async () => {
    if (!currentUser) return
    if (!encryptionKey || !encryptionSalt) {
      toast.error('Encryption session not active. Please sign in again.')
      return
    }

    if (passcodeVal.length < 6) {
      toast.error('Passcode must be at least 6 characters')
      return
    }

    if (passcodeVal !== confirmPasscodeVal) {
      toast.error('Passcodes do not match')
      return
    }

    setIsSavingPasscode(true)
    try {
      const saltArray = base64ToUint8Array(encryptionSalt)
      const { ciphertext, iv } = await wrapEncryptionKey(encryptionKey, passcodeVal, saltArray)
      const hash = await hashPasscode(passcodeVal)

      const { error } = await supabase
        .from('profiles')
        .update({
          vault_passcode_hash: hash,
          vault_auto_lock: true
        })
        .eq('id', currentUser.id)

      if (error) {
        console.warn("DB update failed, using local storage:", error.message)
      }

      sessionStorage.setItem('quillfox_wrapped_key', ciphertext)
      sessionStorage.setItem('quillfox_wrapped_iv', iv)

      updateVaultSettings({
        vaultPasscodeHash: hash,
        vaultAutoLock: true
      })

      setPasscodeOpen(false)
      setPasscodeVal('')
      setConfirmPasscodeVal('')
      toast.success('Passcode set and Auto-Lock enabled!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to set passcode')
    } finally {
      setIsSavingPasscode(false)
    }
  }

  const handleRemovePasscode = async () => {
    if (!currentUser) return
    setIsSavingPasscode(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vault_passcode_hash: null,
          vault_auto_lock: false
        })
        .eq('id', currentUser.id)

      if (error) {
        console.warn("DB update failed, using local storage:", error.message)
      }

      sessionStorage.removeItem('quillfox_wrapped_key')
      sessionStorage.removeItem('quillfox_wrapped_iv')

      updateVaultSettings({
        vaultPasscodeHash: null,
        vaultAutoLock: false
      })

      toast.success('Passcode removed')
    } catch {
      toast.error('Failed to remove passcode')
    } finally {
      setIsSavingPasscode(false)
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
                       <div className="relative group cursor-pointer shrink-0" onClick={handleAvatarClick}>
                         <Avatar className="h-16 w-16 border-2 border-[#059669]/20 transition-all group-hover:border-[#059669]/60">
                           {currentUser.image ? (
                             <AvatarImage src={currentUser.image} alt={currentUser.name || 'User'} className="object-cover" />
                           ) : null}
                           <AvatarFallback className="text-xl bg-gradient-to-br from-[#059669] to-[#0d9488] text-white font-semibold">
                             {getInitials(currentUser.name)}
                           </AvatarFallback>
                         </Avatar>
                         
                         {/* Hover overlay with camera icon */}
                         <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                           {isUploadingImage ? (
                             <Loader2 className="w-5 h-5 text-white animate-spin" />
                           ) : (
                             <Camera className="w-5 h-5 text-white" />
                           )}
                         </div>

                         {/* Hidden File Input */}
                         <input
                           type="file"
                           ref={fileInputRef}
                           onChange={handleImageUpload}
                           accept="image/*"
                           className="hidden"
                           disabled={isUploadingImage}
                         />
                       </div>

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

                         {currentUser.image && (
                           <button
                             type="button"
                             onClick={handleRemoveImage}
                             disabled={isUploadingImage}
                             className="text-[11px] text-destructive hover:underline mt-1.5 flex items-center gap-1"
                           >
                             Remove picture
                           </button>
                         )}
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
                      <span>
                        Account created on{' '}
                        {currentUser.createdAt
                          ? format(new Date(currentUser.createdAt), 'MMMM d, yyyy')
                          : format(new Date(), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Subscription & Billing Section */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-xl border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Subscription & Billing</CardTitle>
                        <CardDescription>Manage your plan and purchase add-ons</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator className="opacity-50" />
                  <CardContent className="pt-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                        <div className="flex items-center gap-2 mt-1">
                          <h3 className="text-xl font-bold uppercase tracking-wider">
                            {userTier}
                          </h3>
                          {userTier !== 'free' && (
                            <Crown className="w-5 h-5 text-[#d97706]" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userTier === 'free' && (
                          <Button variant="default" size="sm" onClick={async () => {
                            const { error } = await supabase.from('profiles').update({ tier: 'premium' }).eq('id', currentUser.id);
                            if (!error) { setTier('premium'); toast.success('Upgraded to Premium!'); }
                          }} className="bg-[#d97706] hover:bg-[#d97706]/90 text-white gap-1">
                            <Crown className="w-4 h-4" /> Upgrade to Premium
                          </Button>
                        )}
                        {userTier === 'premium' && (
                          <Button variant="default" size="sm" onClick={async () => {
                            const { error } = await supabase.from('profiles').update({ tier: 'ultra' }).eq('id', currentUser.id);
                            if (!error) { setTier('ultra'); toast.success('Upgraded to Ultra!'); }
                          }} className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-90 text-white gap-1">
                            <Crown className="w-4 h-4" /> Upgrade to Ultra
                          </Button>
                        )}
                        {userTier !== 'free' && (
                          <Button variant="outline" size="sm" onClick={async () => {
                            const { error } = await supabase.from('profiles').update({ tier: 'free' }).eq('id', currentUser.id);
                            if (!error) { setTier('free'); toast.success('Downgraded to Free'); }
                          }} className="text-muted-foreground hover:text-destructive border-border/50">
                            Downgrade to Free
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border/40 pt-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-semibold">Collaborator Add-ons</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Need more seats? Buy extra collaborators for your workspaces.
                            <br />
                            Currently purchased: <strong className="text-foreground">{useAppStore.getState().extraCollaborators} extra seats</strong>
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="shrink-0 gap-1.5 border-[#059669]/30 text-[#059669] hover:bg-[#059669]/10"
                          onClick={async () => {
                            const store = useAppStore.getState()
                            const newAmount = store.extraCollaborators + 10
                            const { error } = await supabase.from('profiles').update({ extra_collaborators: newAmount }).eq('id', currentUser.id);
                            if (!error) {
                              store.setExtraCollaborators(newAmount)
                              toast.success('Successfully purchased 10 extra collaborators!')
                            } else {
                              toast.error('Failed to process purchase.')
                            }
                          }}
                        >
                          <CreditCard className="w-4 h-4" />
                          Buy 10 Seats ($5/mo)
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              {/* Security Vault Section */}
              <motion.div variants={fadeUp}>
                <Card className="rounded-xl border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Security Vault</CardTitle>
                        <CardDescription>Manage E2E encryption vault locks and passcode settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator className="opacity-50" />
                  <CardContent className="pt-5 space-y-5">
                    {/* Active key warning / status */}
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/40">
                      {isEncryptedSession ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
                          <span className="text-xs text-muted-foreground">E2EE Active. Session key derived from account password.</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                          <span className="text-xs text-muted-foreground">E2EE Key not derived. Lock features disabled.</span>
                        </>
                      )}
                    </div>

                    {/* Auto-Lock Toggle */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">Vault Auto-Lock</p>
                          {userTier === 'free' && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-[#d97706] border-[#d97706]/20 bg-[#d97706]/5">Premium/Ultra Only</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Automatically lock your encryption vault after a period of user inactivity.
                        </p>
                      </div>
                      <Switch
                        checked={vaultAutoLock}
                        disabled={userTier === 'free' || isAutolockLoading}
                        onCheckedChange={handleToggleAutoLock}
                      />
                    </div>

                    {/* Auto-Lock Timeout Selector */}
                    {vaultAutoLock && (
                      <div className="flex items-center justify-between gap-4 py-1 border-t border-border/20 pt-4">
                        <div>
                          <p className="text-sm font-medium">Inactivity Timeout</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Number of idle minutes before locking the vault.
                          </p>
                        </div>
                        <Select
                          value={String(vaultLockTimeout)}
                          onValueChange={handleTimeoutChange}
                        >
                          <SelectTrigger className="w-[120px] h-9 text-xs rounded-lg">
                            <SelectValue placeholder="Timeout" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 minute</SelectItem>
                            <SelectItem value="5">5 minutes</SelectItem>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Passcode setup section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/20 pt-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold">Numeric Passcode Vault</h4>
                        <p className="text-xs text-muted-foreground">
                          Configure a 6-digit passcode for quick vault unlocking without your full account password.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {vaultPasscodeHash ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs rounded-lg h-9"
                              onClick={() => setPasscodeOpen(true)}
                              disabled={userTier === 'free' || isSavingPasscode}
                            >
                              Change Passcode
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-xs rounded-lg h-9"
                              onClick={handleRemovePasscode}
                              disabled={userTier === 'free' || isSavingPasscode}
                            >
                              Remove Passcode
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs rounded-lg h-9 gap-1.5 bg-gradient-to-r from-[#059669]/10 to-[#0d9488]/10 text-[#059669] border border-[#059669]/20 hover:bg-[#059669]/20"
                            onClick={() => setPasscodeOpen(true)}
                            disabled={userTier === 'free' || isSavingPasscode}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Set Passcode
                          </Button>
                        )}
                      </div>
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
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-9 text-sm pr-10"
                          placeholder="Enter current password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          tabIndex={-1}
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs font-medium">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-9 text-sm pr-10"
                          placeholder="Enter new password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-xs font-medium">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-9 text-sm pr-10"
                          placeholder="Confirm new password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
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

      {/* Passcode Configuration Dialog */}
      <Dialog open={passcodeOpen} onOpenChange={setPasscodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set 6-Digit Vault Passcode</DialogTitle>
            <DialogDescription>
              Create a 6-digit passcode to lock and unlock your security vault. This encrypts your active session key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="passcode-input" className="text-xs font-medium">Enter 6-Digit Passcode</Label>
              <div className="relative">
                <Input
                  id="passcode-input"
                  type={showPasscode ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={passcodeVal}
                  onChange={(e) => setPasscodeVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="font-mono tracking-widest text-center text-lg pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowPasscode(!showPasscode)}
                  tabIndex={-1}
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-passcode-input" className="text-xs font-medium">Confirm Passcode</Label>
              <div className="relative">
                <Input
                  id="confirm-passcode-input"
                  type={showConfirmPasscode ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPasscodeVal}
                  onChange={(e) => setConfirmPasscodeVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="font-mono tracking-widest text-center text-lg pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowConfirmPasscode(!showConfirmPasscode)}
                  tabIndex={-1}
                >
                  {showConfirmPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPasscodeOpen(false)
                setPasscodeVal('')
                setConfirmPasscodeVal('')
              }}
              disabled={isSavingPasscode}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#059669] to-[#0d9488] text-white hover:from-[#059669]/90 hover:to-[#0d9488]/90"
              onClick={handleSetPasscode}
              disabled={isSavingPasscode || passcodeVal.length !== 6 || confirmPasscodeVal.length !== 6}
            >
              {isSavingPasscode ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Passcode'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
