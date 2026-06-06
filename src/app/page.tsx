'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AuthPage } from '@/components/auth/auth-page'
import { Dashboard } from '@/components/dashboard/dashboard'
import { NoteEditor } from '@/components/note/note-editor'
import { TodoList } from '@/components/todo/todo-list'
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
