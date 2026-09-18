'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Extension, type Editor, type Range } from '@tiptap/core'
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
} from 'lucide-react'

export interface SlashCommandItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (props: { editor: Editor; range: Range }) => void
}

const iconClass = 'h-4 w-4'

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: <Type className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list of items',
    icon: <List className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list of items',
    icon: <ListOrdered className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quotation',
    icon: <Quote className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Preformatted code block',
    icon: <Code2 className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Visual separator',
    icon: <Minus className={iconClass} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
]

export function getSlashCommandItems({ query }: { query: string }): SlashCommandItem[] {
  const q = query.toLowerCase().trim()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  )
}

export type SlashCommandListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SuggestionProps<SlashCommandItem>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const items = props.items

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = (index: number) => {
    const item = items[index]
    if (item) props.command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">No matching commands</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  )
})
SlashCommandList.displayName = 'SlashCommandList'

/**
 * Slash-command extension. Type `/` at the start of a line (or after a space)
 * to open the block-insert menu.
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        items: ({ query }) => getSlashCommandItems({ query }),
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              })
              unmount = props.mount(component.element)
            },
            onUpdate: (props) => {
              component?.updateProps(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') return false
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              component?.destroy()
              component = null
              unmount = null
            },
          }
        },
      }),
    ]
  },
})
