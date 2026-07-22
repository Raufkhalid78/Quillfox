import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PenLine, ShieldCheck, ShieldAlert, Sun, Moon, Settings, Crown, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// Helper for initials
function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

interface DashboardHeaderProps {
  isEncryptedSession: boolean
  theme: string | undefined
  setTheme: (theme: string) => void
  currentUser: { id: string; email: string; name: string | null; image?: string | null }
  userTier: string
  logout: () => void
}

export function DashboardHeader({
  isEncryptedSession,
  theme,
  setTheme,
  currentUser,
  userTier,
  logout
}: DashboardHeaderProps) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:px-8 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shrink-0">
            <PenLine className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">QuillFox</h1>
        </Link>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {isEncryptedSession ? (
                <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#059669] bg-[#059669]/10 border-[#059669]/20 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="hidden sm:inline">E2E</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-[10px] font-medium text-[#d97706] bg-[#d97706]/10 border-[#d97706]/20 shrink-0">
                  <ShieldAlert className="w-3 h-3" />
                  <span className="hidden sm:inline">No E2E</span>
                </Badge>
              )}
            </TooltipTrigger>
            <TooltipContent>{isEncryptedSession ? 'End-to-end encryption active' : 'Encryption not set up'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile theme toggle */}
        <Button aria-label="Toggle theme" variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden h-8 w-8">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="User profile menu" className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/50 transition-colors focus:outline-none shrink-0 cursor-pointer text-left">
              <Avatar className="h-7 w-7 border border-[#059669]/20">
                {currentUser.image ? (
                  <AvatarImage src={currentUser.image} alt={currentUser.name || 'User'} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-[#059669]/10 text-[#059669] dark:bg-[#059669]/20 dark:text-[#34d399] text-[10px] font-semibold">
                  {getInitials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium hidden sm:block max-w-[100px] truncate">
                {currentUser.name || currentUser.email}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{currentUser.name || 'QuillFox User'}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">{currentUser.email}</p>
                <div className="pt-1.5">
                  <Badge variant="secondary" className={`text-[10px] font-semibold ${userTier !== 'free' ? 'text-[#d97706] bg-[#d97706]/10 border-[#d97706]/20' : 'text-muted-foreground'}`}>
                    {userTier === 'ultra' ? 'ULTRA PREMIUM TIER' : userTier === 'premium' ? 'PREMIUM TIER' : 'FREE TIER'}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/pricing')} className="cursor-pointer gap-2">
              <Crown className="w-4 h-4 text-emerald-500" />
              <span>Subscription</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
