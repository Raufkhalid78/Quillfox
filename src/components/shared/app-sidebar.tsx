'use client'

import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Home,
  FileText,
  ListTodo,
  Layers,
  Crown,
  LogOut,
  Moon,
  Sun,
  PenLine,
  Archive,
  Settings,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AppSidebarProps {
  onUpgradeClick?: () => void
}

const navItems = [
  { key: 'dashboard', view: 'dashboard' as const, icon: Home, label: 'Dashboard' },
  { key: 'notes', view: 'notes' as const, icon: FileText, label: 'Notes' },
  { key: 'todos', view: 'todos' as const, icon: ListTodo, label: 'Todos' },
  { key: 'workspaces', view: 'workspaces' as const, icon: Layers, label: 'Workspaces' },
  { key: 'archive', view: 'archive' as const, icon: Archive, label: 'Archive' },
  { key: 'settings', view: 'settings' as const, icon: Settings, label: 'Settings' },
]

export function AppSidebar({ onUpgradeClick }: AppSidebarProps) {
  const logout = useAppStore((s) => s.logout)
  const userTier = useAppStore((s) => s.userTier)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const isActive = (key: string) => {
    if (key === 'dashboard') return pathname === '/dashboard'
    if (key === 'notes') return pathname.startsWith('/dashboard/notes')
    if (key === 'todos') return pathname.startsWith('/dashboard/todos')
    if (key === 'workspaces') return pathname.startsWith('/dashboard/workspaces')
    if (key === 'archive') return pathname.startsWith('/dashboard/archive')
    if (key === 'settings') return pathname.startsWith('/dashboard/settings')
    return false
  }

  const getHref = (key: string) => {
    if (key === 'dashboard') return '/dashboard'
    return `/dashboard/${key}`
  }

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-[72px] border-r border-border/60 glass-strong z-50">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-border/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shadow-lg shadow-[#059669]/20">
          <PenLine className="w-4 h-4" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-4">
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <Link
                  href={getHref(item.key)}
                  className={`w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center ${
                    isActive(item.key)
                      ? 'bg-[#6d28d9]/15 dark:bg-[#a855f7]/20 text-[#6d28d9] dark:text-[#a855f7] glow-purple inner-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 card-lift'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>

        {userTier === 'free' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/pricing"
                  className={`w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center ${
                    pathname === '/dashboard/pricing'
                      ? 'bg-[#d97706]/15 text-[#d97706] glow-coral inner-glow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 card-lift'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Pricing</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 py-4 border-t border-border/40">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl transition-all duration-300 text-muted-foreground hover:text-foreground hover:bg-muted/50 card-lift"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl transition-all duration-300 text-muted-foreground hover:text-destructive hover:bg-destructive/10 card-lift"
                onClick={logout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
