'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthPage } from '@/components/auth/auth-page'
import { Dashboard } from '@/components/dashboard/dashboard'
import { NoteEditor } from '@/components/note/note-editor'
import { TodoList } from '@/components/todo/todo-list'
import { NotesList } from '@/components/notes/notes-list'
import { TodosList } from '@/components/todos/todos-list'
import { WorkspacesView } from '@/components/workspaces/workspaces-view'
import { SettingsView } from '@/components/settings/settings-view'
import { PricingView } from '@/components/pricing/pricing-view'
import { ArchiveView } from '@/components/archive/archive-view'
import { MobileNav } from '@/components/shared/mobile-nav'
import { useAppStore } from '@/stores/app-store'

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    filter: 'blur(4px)',
    transition: {
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

function AppContent() {
  const currentView = useAppStore((s) => s.currentView)
  const showFooter = currentView !== 'auth'

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden noise-overlay">
      <main className="flex-1">
        <MobileNav />
        <AnimatePresence mode="wait">
          {currentView === 'auth' && (
            <motion.div
              key="auth"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <AuthPage />
            </motion.div>
          )}
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Dashboard />
            </motion.div>
          )}
          {currentView === 'note-editor' && (
            <motion.div
              key="note-editor"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <NoteEditor />
            </motion.div>
          )}
          {currentView === 'todo-list' && (
            <motion.div
              key="todo-list"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <TodoList />
            </motion.div>
          )}
          {currentView === 'notes' && (
            <motion.div
              key="notes"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <NotesList />
            </motion.div>
          )}
          {currentView === 'todos' && (
            <motion.div
              key="todos"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <TodosList />
            </motion.div>
          )}
          {currentView === 'workspaces' && (
            <motion.div
              key="workspaces"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <WorkspacesView />
            </motion.div>
          )}
          {currentView === 'settings' && (
            <motion.div
              key="settings"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <SettingsView />
            </motion.div>
          )}
          {currentView === 'pricing' && (
            <motion.div
              key="pricing"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <PricingView />
            </motion.div>
          )}
          {currentView === 'archive' && (
            <motion.div
              key="archive"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ArchiveView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer - hidden on auth view, shown on other views */}
      <AnimatePresence>
        {showFooter && (
          <motion.footer
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mt-auto py-4 text-center text-sm text-muted-foreground footer-gradient-border"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>© 2025 QuillFox. Built with</span>
              <motion.span
                animate={{
                  scale: [1, 1.15, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-block text-[#6d28d9] dark:text-[#a855f7]"
              >
                ❤️
              </motion.span>
            </span>
          </motion.footer>
        )}
      </AnimatePresence>
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
