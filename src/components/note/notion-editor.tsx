'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { Markdown } from 'tiptap-markdown'
import { useAppStore } from '@/stores/app-store'
import { Sparkles } from 'lucide-react'
import * as Y from 'yjs'
import { SupabaseProvider } from '@supabase-labs/y-supabase'
import { supabase } from '@/lib/supabase'

interface NotionEditorProps {
  noteId: string
  currentUser: any
  content: string
  onChange: (value: string) => void
  disabled?: boolean
}

// Generate a stable color based on a string (like a user ID)
const getColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777215)).toString(16)
  return '#' + '000000'.substring(0, 6 - color.length) + color
}

export function NotionEditor({ noteId, currentUser, content, onChange, disabled }: NotionEditorProps) {
  const userTier = useAppStore((s) => s.userTier)
  const [provider, setProvider] = useState<SupabaseProvider | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  
  // 1. Initialize a Yjs Document. One per note.
  const ydoc = useMemo(() => new Y.Doc(), [noteId])

  // 2. Setup the Supabase Realtime Provider
  useEffect(() => {
    if (!noteId || !currentUser) return

    let p: SupabaseProvider | null = null
    try {
      const channelName = `yjs-note-${noteId}`
      p = new SupabaseProvider(channelName, ydoc, supabase as any)

      // Setup awareness (Cursor + Avatar Presence)
      const userColor = getColor(currentUser.id)
      // @ts-ignore
      p.awareness.setLocalStateField('user', {
        name: currentUser.name || currentUser.email,
        color: userColor,
        avatar: currentUser.avatar || null
      })

      setProvider(p)
      setProviderError(null)
    } catch (err) {
      console.error('[NotionEditor] Failed to init SupabaseProvider:', err)
      setProviderError('Failed to connect to live room')
      // Still show the editor without collaboration
    }

    return () => {
      try { p?.destroy() } catch {}
    }
  }, [noteId, currentUser, ydoc])

  return (
    <div className="relative w-full notion-editor-wrapper">
      {/* Collaboration cursor styles — using standard style tag, not styled-jsx */}
      <style>{`
        .collaboration-cursor__caret {
          position: relative;
          margin-left: -1px;
          margin-right: -1px;
          border-left: 2px solid #000;
          border-right: 2px solid #000;
          word-break: normal;
          pointer-events: none;
        }
        .collaboration-cursor__label {
          position: absolute;
          top: -1.4em;
          left: -1px;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          line-height: normal;
          user-select: none;
          color: #000;
          padding: 0.1rem 0.3rem;
          border-radius: 3px 3px 3px 0;
          white-space: nowrap;
          pointer-events: none;
        }
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .tiptap-editor h1 { font-size: 1.875rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .tiptap-editor h2 { font-size: 1.5rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .tiptap-editor h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
        .tiptap-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .tiptap-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .tiptap-editor blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #6b7280; font-style: italic; }
        .dark .tiptap-editor blockquote { border-left-color: #4b5563; color: #9ca3af; }
        .tiptap-editor pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .tiptap-editor code { background: #e5e7eb; color: #111827; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875em; }
        .dark .tiptap-editor code { background: #374151; color: #f9fafb; }
        .tiptap-editor pre code { background: transparent; color: inherit; padding: 0; }
        .tiptap-editor mark { background-color: #fef08a; padding: 0.125rem 0; border-radius: 0.125rem; }
        .dark .tiptap-editor mark { background-color: #854d0e; color: #f9fafb; }
      `}</style>

      {/* Free Tier Banner */}
      {userTier === 'free' && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Advanced Formatting Locked</h3>
              <p className="text-xs text-muted-foreground">
                Upgrade to Premium to unlock &apos;/&apos; commands, formatting bubbles, and advanced blocks.
              </p>
            </div>
          </div>
        </div>
      )}

      {providerError ? (
        // Fallback: show editor without collaboration if provider fails
        <EditorWithProvider
          ydoc={ydoc}
          provider={null}
          content={content}
          onChange={onChange}
          disabled={disabled}
          userTier={userTier}
        />
      ) : provider ? (
        <EditorWithProvider
          ydoc={ydoc}
          provider={provider}
          content={content}
          onChange={onChange}
          disabled={disabled}
          userTier={userTier}
        />
      ) : (
        <div className="w-full min-h-[60vh] rounded-xl border border-border/50 bg-card/50 flex items-center justify-center">
          <span className="text-muted-foreground text-sm animate-pulse">Connecting to live room...</span>
        </div>
      )}
    </div>
  )
}

// Separate component to handle editor initialization cleanly with a ready provider
function EditorWithProvider({ ydoc, provider, content, onChange, disabled, userTier }: any) {
  const initialized = useRef(false)

  const extensions = [
    StarterKit,
    Markdown,
    Placeholder.configure({
      placeholder: userTier !== 'free'
        ? "Type '/' for Notion-Style slash commands...\nHighlight text to open the formatting bubble."
        : 'Start writing...',
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    // Only add collaboration cursor if provider is available
    ...(provider ? [CollaborationCursor.configure({
      provider: provider,
      // @ts-ignore
      user: provider.awareness?.getLocalState()?.user,
    })] : []),
  ]

  const editor = useEditor({
    extensions,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      try {
        const markdown = (editor.storage as any).markdown.getMarkdown()
        onChange(markdown)
      } catch (e) {
        console.error('[NotionEditor] onUpdate error:', e)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] p-6 text-sm leading-relaxed font-sans tiptap-editor',
      },
    },
  })

  // Set initial content if the Yjs doc is empty
  useEffect(() => {
    if (editor && !initialized.current) {
      initialized.current = true
      try {
        const ytext = ydoc.getXmlFragment('default')
        if (ytext.length === 0 && content) {
          editor.commands.setContent(content)
        }
      } catch (e) {
        // Fallback: set content directly
        if (content) editor.commands.setContent(content)
      }
    }
  }, [editor, content, ydoc])

  // Sync disabled state dynamically
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  return (
    <div className={`w-full min-h-[60vh] rounded-xl border border-border/50 bg-card/50 transition-all ${disabled ? 'opacity-50 pointer-events-none' : 'focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40'}`}>
      <EditorContent editor={editor} />
    </div>
  )
}
