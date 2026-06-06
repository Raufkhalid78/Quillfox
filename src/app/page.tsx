'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthPage } from '@/components/auth/auth-page'
import { Dashboard } from '@/components/dashboard/dashboard'
import { NoteEditor } from '@/components/note/note-editor'
import { TodoList } from '@/components/todo/todo-list'
import { useAppStore } from '@/stores/app-store'

function AppContent() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1">
        {currentView === 'auth' && <AuthPage />}
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'note-editor' && <NoteEditor />}
        {currentView === 'todo-list' && <TodoList />}
      </main>
      <footer className="mt-auto py-4 text-center text-sm text-muted-foreground border-t border-border">
        © 2025 QuillFox. Built with ❤️
      </footer>
    </div>
  )
}

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppContent />
      <Toaster position="bottom-right" richColors />
    </ThemeProvider>
  )
}
