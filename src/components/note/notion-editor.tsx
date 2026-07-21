'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Code, Quote, AlertCircle, Bold, Italic, Sparkles } from 'lucide-react'

interface NotionEditorProps {
  content: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function NotionEditor({ content, onChange, disabled }: NotionEditorProps) {
  const userTier = useAppStore((s) => s.userTier)
  const setTier = useAppStore((s) => s.setTier)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Slash menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashMenuCoords, setSlashMenuCoords] = useState({ top: 0, left: 0 })
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedMenuIdx, setSelectedMenuIdx] = useState(0)

  // Bubble toolbar state
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [bubbleCoords, setBubbleCoords] = useState({ top: 0, left: 0 })

  const menuItems = [
    { label: 'Heading 1', icon: Heading1, md: '# ' },
    { label: 'Heading 2', icon: Heading2, md: '## ' },
    { label: 'Heading 3', icon: Heading3, md: '### ' },
    { label: 'Todo List', icon: CheckSquare, md: '- [ ] ' },
    { label: 'Bullet List', icon: List, md: '- ' },
    { label: 'Numbered List', icon: ListOrdered, md: '1. ' },
    { label: 'Code Block', icon: Code, md: '```\n\n```' },
    { label: 'Quote', icon: Quote, md: '> ' },
    { label: 'Callout Box', icon: AlertCircle, md: '> [!NOTE]\n> ' },
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.label.toLowerCase().includes(slashFilter.toLowerCase())
  )

  useEffect(() => {
    if (selectedMenuIdx >= filteredMenuItems.length) {
      setSelectedMenuIdx(0)
    }
  }, [filteredMenuItems, selectedMenuIdx])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled || userTier === 'free') return

    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMenuIdx(prev => (prev + 1) % filteredMenuItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMenuIdx(prev => (prev - 1 + filteredMenuItems.length) % filteredMenuItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredMenuItems[selectedMenuIdx]) {
          applyMarkdown(filteredMenuItems[selectedMenuIdx].md)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMenuOpen(false)
      }
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChange(val)

    if (userTier === 'free') return

    // Detect slash command trigger
    const cursorIdx = e.target.selectionStart
    const textBeforeCursor = val.substring(0, cursorIdx)
    const lines = textBeforeCursor.split('\n')
    const currentLine = lines[lines.length - 1]

    if (currentLine.startsWith('/')) {
      setSlashFilter(currentLine.substring(1))
      setSlashMenuOpen(true)
      updateMenuPosition(e.target)
    } else {
      setSlashMenuOpen(false)
    }
  }

  const updateMenuPosition = (textarea: HTMLTextAreaElement) => {
    const { selectionStart } = textarea
    // Simple position calculation near the typing area
    const lines = textarea.value.substring(0, selectionStart).split('\n')
    const lineCount = lines.length
    const charCount = lines[lines.length - 1].length

    const top = Math.min(100 + lineCount * 20, textarea.clientHeight - 200)
    const left = Math.min(20 + charCount * 8, textarea.clientWidth - 200)

    setSlashMenuCoords({ top, left })
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (userTier === 'free') return
    const textarea = e.currentTarget
    const { selectionStart, selectionEnd } = textarea

    if (selectionStart !== selectionEnd) {
      const textBefore = textarea.value.substring(0, selectionStart)
      const lines = textBefore.split('\n')
      const top = Math.max(30 + (lines.length - 1) * 20 - textarea.scrollTop, 10)
      const left = Math.min(80 + lines[lines.length - 1].length * 8, textarea.clientWidth - 150)
      
      setBubbleCoords({ top, left })
      setBubbleOpen(true)
    } else {
      setBubbleOpen(false)
    }
  }

  const applyMarkdown = (markdown: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd } = textarea
    const val = textarea.value

    let newVal = ''
    let newCursorIdx = 0

    if (markdown.startsWith('#') || markdown.startsWith('-') || markdown.startsWith('1.') || markdown.startsWith('>')) {
      // Line transform command
      const textBefore = val.substring(0, selectionStart)
      const textAfter = val.substring(selectionStart)
      const linesBefore = textBefore.split('\n')
      // Remove the slash char
      linesBefore[linesBefore.length - 1] = markdown + linesBefore[linesBefore.length - 1].replace('/', '')
      
      newVal = linesBefore.join('\n') + textAfter
      newCursorIdx = newVal.length - textAfter.length
    } else {
      // Wrap/Insert command
      const textBefore = val.substring(0, selectionStart).replace(/\/$/, '')
      const selectedText = val.substring(selectionStart, selectionEnd)
      const textAfter = val.substring(selectionEnd)

      if (markdown.includes('\n\n')) {
        // e.g. code block
        newVal = textBefore + '```\n' + (selectedText || 'code') + '\n```' + textAfter
        newCursorIdx = textBefore.length + 4 + (selectedText || 'code').length
      } else {
        // inline styling wrap
        newVal = textBefore + markdown + selectedText + markdown + textAfter
        newCursorIdx = textBefore.length + markdown.length + selectedText.length + markdown.length
      }
    }

    onChange(newVal)
    setSlashMenuOpen(false)
    setBubbleOpen(false)

    // Reset cursor focus
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorIdx, newCursorIdx)
    }, 50)
  }

  return (
    <div className="relative w-full">
      {/* Notion Editor Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        className={`w-full min-h-[60vh] resize-y rounded-xl border border-border/50 bg-card/50 p-6 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40 font-mono`}
        placeholder={
          userTier !== 'free' 
            ? "Type '/' for Notion-Style slash commands...\nHighlight text to open the formatting bubble."
            : "Start writing..."
        }
        disabled={disabled}
      />

      {/* Free Tier Banner */}
      {userTier === 'free' && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Notion-Style Slash Commands Locked</h3>
              <p className="text-xs text-muted-foreground">
                Upgrade to Premium to unlock '/' commands, formatting bubbles, and advanced blocks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Slash Command Dropdown */}
      <AnimatePresence>
        {slashMenuOpen && filteredMenuItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-[80] w-52 max-h-60 overflow-y-auto bg-popover border border-border rounded-xl shadow-xl p-1.5 space-y-0.5"
            style={{ top: slashMenuCoords.top, left: slashMenuCoords.left }}
          >
            <p className="text-[10px] text-muted-foreground px-2 py-1 select-none">Basic Blocks</p>
            {filteredMenuItems.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                    idx === selectedMenuIdx ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => applyMarkdown(item.md)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Selection Formatting Bubble */}
      <AnimatePresence>
        {bubbleOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute z-[80] bg-popover border border-border rounded-lg shadow-lg flex items-center p-1 gap-1"
            style={{ top: bubbleCoords.top - 40, left: bubbleCoords.left }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => applyMarkdown('**')}
            >
              <Bold className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => applyMarkdown('*')}
            >
              <Italic className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => applyMarkdown('`')}
            >
              <Code className="w-3.5 h-3.5" />
            </Button>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
