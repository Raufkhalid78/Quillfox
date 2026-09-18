'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { Markdown } from 'tiptap-markdown'
import { SlashCommand } from '@/components/note/slash-command'
import { useAppStore } from '@/stores/app-store'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
} from 'lucide-react'
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
        avatar: currentUser.avatar || null,
      })

      setProvider(p)
      setProviderError(null)
    } catch (err) {
      console.error('[NotionEditor] Failed to init SupabaseProvider:', err)
      setProviderError('Failed to connect to live room')
      // Still show the editor without collaboration
    }

    return () => {
      try {
        p?.destroy()
      } catch {}
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
      `}</style>

      {providerError ? (
        <EditorWithProvider
          ydoc={ydoc}
          provider={null}
          content={content}
          onChange={onChange}
          disabled={disabled}
        />
      ) : provider ? (
        <EditorWithProvider
          ydoc={ydoc}
          provider={provider}
          content={content}
          onChange={onChange}
          disabled={disabled}
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
function EditorWithProvider({ ydoc, provider, content, onChange, disabled }: any) {
  const initialized = useRef(false)

  const extensions = [
    StarterKit,
    Markdown,
    SlashCommand,
    Placeholder.configure({
      placeholder: 'Start writing… type "/" for commands or select text for formatting.',
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    ...(provider
      ? [
          CollaborationCursor.configure({
            provider: provider,
            // @ts-ignore
            user: provider.awareness?.getLocalState()?.user,
          }),
        ]
      : []),
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
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] p-6 text-sm leading-relaxed font-sans tiptap-editor',
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
    <div
      className={`w-full min-h-[60vh] rounded-xl border border-border/50 bg-card/50 transition-all ${
        disabled
          ? 'opacity-50 pointer-events-none'
          : 'focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40'
      }`}
    >
      {editor && !disabled && <FormattingBubble editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

/**
 * Floating formatting menu shown when text is selected.
 * Uses only commands guaranteed by StarterKit.
 */
function FormattingBubble({ editor }: { editor: any }) {
  return (
    <BubbleMenu
      editor={editor}
      updateDelay={100}
      options={{ placement: 'top' }}
      shouldShow={({ editor: e, from, to }: any) => from !== to && !e.isActive('codeBlock')}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-1 shadow-lg">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          label="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </BubbleMenu>
  )
}

function ToolbarButton({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}