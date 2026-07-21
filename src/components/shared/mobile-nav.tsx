'use client'

import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Home,
  FileText,
  ListTodo,
  Layers,
  Crown,
  LogOut,
  Moon,
  Sun,
  Menu,
  PenLine,
  Archive,
  Settings,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { key: 'dashboard', view: 'dashboard' as const, icon: Home, label: 'Dashboard' },
  { key: 'notes', view: 'notes' as const, icon: FileText, label: 'Notes' },
  { key: 'todos', view: 'todos' as const, icon: ListTodo, label: 'Todos' },
  { key: 'workspaces', view: 'workspaces' as const, icon: Layers, label: 'Workspaces' },
  { key: 'archive', view: 'archive' as const, icon: Archive, label: 'Archive' },
  { key: 'settings', view: 'settings' as const, icon: Settings, label: 'Settings' },
]

export function MobileNav() {
  const [open, setOpen] = React.useState(false)
  const logout = useAppStore((s) => s.logout)
  const userTier = useAppStore((s) => s.userTier)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  // Don't render on mobile when user is on auth view (root route)
  if (pathname === '/') return null

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

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="md:hidden">
      {/* Fixed bottom hamburger button */}
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          size="icon"
          onClick={() => setOpen(true)}
          className="h-12 w-12 rounded-full bg-card/90 backdrop-blur-sm border border-border/60 shadow-lg shadow-black/10 hover:bg-accent transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground" />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </div>

      {/* Sheet sliding up from bottom */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#059669] to-[#0d9488] text-white flex items-center justify-center shadow-lg shadow-[#059669]/20">
                <PenLine className="w-4 h-4" />
              </div>
              <SheetTitle className="text-lg">QuillFox</SheetTitle>
            </div>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
          </SheetHeader>

          {/* Navigation links */}
          <nav className="flex flex-col gap-1 px-4 pb-4">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={getHref(item.key)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors w-full ${
                  isActive(item.key)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}

            {/* Pricing */}
            {userTier === 'free' && (
              <Link
                href="/dashboard/pricing"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors w-full ${
                  pathname === '/dashboard/pricing'
                    ? 'bg-[#d97706]/10 text-[#d97706]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Crown className="h-5 w-5 shrink-0" />
                <span className="font-medium">Pricing</span>
              </Link>
            )}
          </nav>

          {/* Bottom actions: divider */}
          <div className="border-t border-border/60" />

          <div className="flex flex-col gap-1 px-4 pb-6 pt-3">
            {/* Theme toggle */}
            <button
              onClick={handleThemeToggle}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 shrink-0" />
              ) : (
                <Moon className="h-5 w-5 shrink-0" />
              )}
              <span className="font-medium">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            </button>

            {/* Sign out */}
            <button
              onClick={() => {
                logout()
                setOpen(false)
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
