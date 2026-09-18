/**
 * Note/todo templates. Built-in templates ship with the app; users can also
 * save their own (persisted in localStorage on web, AsyncStorage on mobile via
 * the same shape).
 */

export interface Template {
  id: string
  name: string
  description: string
  type: 'note' | 'todo'
  /** Markdown content for notes. */
  content?: string
  /** Item titles for todo lists. */
  items?: string[]
  builtin?: boolean
}

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin-meeting',
    name: 'Meeting Notes',
    description: 'Agenda, attendees, decisions and action items.',
    type: 'note',
    builtin: true,
    content: `## Attendees\n- \n\n## Agenda\n1. \n\n## Notes\n\n\n## Decisions\n- \n\n## Action items\n- [ ] `,
  },
  {
    id: 'builtin-daily',
    name: 'Daily Journal',
    description: 'A quick daily reflection.',
    type: 'note',
    builtin: true,
    content: `## What went well\n- \n\n## What could improve\n- \n\n## Gratitude\n- \n\n## Tomorrow's focus\n- [ ] `,
  },
  {
    id: 'builtin-project',
    name: 'Project Plan',
    description: 'Goals, milestones and risks.',
    type: 'note',
    builtin: true,
    content: `## Goal\n\n\n## Milestones\n- [ ] \n- [ ] \n\n## Risks\n- \n\n## Notes\n`,
  },
  {
    id: 'builtin-1on1',
    name: '1:1 Agenda',
    description: 'Topics, blockers and feedback for a 1:1.',
    type: 'note',
    builtin: true,
    content: `## Since last time\n- \n\n## Topics\n- \n\n## Blockers\n- \n\n## Feedback\n`,
  },
  {
    id: 'builtin-todo-grocery',
    name: 'Grocery List',
    description: 'A simple shopping list.',
    type: 'todo',
    builtin: true,
    items: ['Milk', 'Eggs', 'Bread', 'Fruit', 'Vegetables'],
  },
  {
    id: 'builtin-todo-trip',
    name: 'Trip Checklist',
    description: 'Packing and travel tasks.',
    type: 'todo',
    builtin: true,
    items: ['Passport / ID', 'Book tickets', 'Pack clothes', 'Charge devices', 'Arrange transport'],
  },
  {
    id: 'builtin-todo-launch',
    name: 'Launch Checklist',
    description: 'Pre-launch tasks for a release.',
    type: 'todo',
    builtin: true,
    items: ['Write release notes', 'Run full test suite', 'Update docs', 'Notify stakeholders', 'Monitor after deploy'],
  },
]

const STORAGE_KEY = 'quillfox-custom-templates'

export function getCustomTemplates(): Template[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Template[]
  } catch {
    return []
  }
}

export function getAllTemplates(): Template[] {
  return [...getCustomTemplates(), ...BUILTIN_TEMPLATES]
}

export function saveCustomTemplate(template: Omit<Template, 'id' | 'builtin'>): Template {
  const full: Template = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
  const next = [full, ...getCustomTemplates()]
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return full
}

export function deleteCustomTemplate(id: string): void {
  if (typeof window === 'undefined') return
  const next = getCustomTemplates().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
