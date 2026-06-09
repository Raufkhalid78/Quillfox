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
} from 'lucide-react'
import { useTheme } from 'next-themes'

interface AppSidebarProps {
  activeView: string
  onUpgradeClick?: () => void
}

const navItems = [
  { key: 'dashboard', view: 'dashboard' as const, icon: Home, label: 'Dashboard' },
  { key: 'notes', view: 'notes' as const, icon: FileText, label: 'Notes' },
  { key: 'todos', view: 'todos' as const, icon: ListTodo, label: 'Todos' },
  { key: 'workspaces', view: 'workspaces' as const, icon: Layers, label: 'Workspaces' },
]

export function AppSidebar({ activeView, onUpgradeClick }: AppSidebarProps) {
  const setView = useAppStore((s) => s.setView)
  const logout = useAppStore((s) => s.logout)
  const { theme, setTheme } = useTheme()

  const isActive = (key: string) => {
    if (key === 'dashboard') return activeView === 'dashboard'
    if (key === 'notes') return activeView === 'notes' || activeView === 'note-editor'
    if (key === 'todos') return activeView === 'todos' || activeView === 'todo-list'
    if (key === 'workspaces') return activeView === 'workspaces'
    return false
  }

  const handleClick = (key: string) => {
    if (key === 'dashboard') setView('dashboard')
    else if (key === 'notes') setView('notes')
    else if (key === 'todos') setView('todos')
    else if (key === 'workspaces') setView('workspaces')
  }

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
    } else {
      setView('pricing')
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-[72px] border-r border-border/60 bg-card/50 backdrop-blur-sm">
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
                <Button
                  variant="ghost"
                  size="icon"
                  className={`w-10 h-10 rounded-xl transition-colors ${
                    isActive(item.key)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => handleClick(item.key)}
                >
                  <item.icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-10 h-10 rounded-xl transition-colors ${
                  activeView === 'pricing'
                    ? 'bg-[#d97706]/10 text-[#d97706]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={handleUpgrade}
              >
                <Crown className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Pricing</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 py-4 border-t border-border/40">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground"
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
                className="w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive"
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
