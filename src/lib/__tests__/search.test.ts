import { searchDocuments, splitHighlight, type SearchDoc } from '../search'

const docs: SearchDoc[] = [
  {
    id: 'n1',
    type: 'note',
    title: 'Grocery list',
    content: 'milk, eggs and bread',
    tags: ['shopping'],
    workspaceId: 'w1',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'n2',
    type: 'note',
    title: 'Meeting notes',
    content: 'discuss the grocery budget',
    tags: [],
    workspaceId: null,
    updatedAt: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 't1',
    type: 'todo',
    title: 'Errands',
    content: 'pick up bread',
    tags: [],
    workspaceId: 'w1',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
]

describe('searchDocuments', () => {
  it('ranks title matches above content matches', () => {
    const results = searchDocuments(docs, 'grocery')
    expect(results.map((r) => r.doc.id)).toEqual(['n1', 'n2'])
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[0].matchedIn).toContain('title')
  })

  it('matches tags', () => {
    const results = searchDocuments(docs, 'shopping')
    expect(results).toHaveLength(1)
    expect(results[0].doc.id).toBe('n1')
    expect(results[0].matchedIn).toContain('tag')
  })

  it('filters by type', () => {
    const results = searchDocuments(docs, 'bread', { types: ['todo'] })
    expect(results.map((r) => r.doc.id)).toEqual(['t1'])
  })

  it('filters by workspace', () => {
    const results = searchDocuments(docs, 'bread', { workspaceId: 'w1' })
    expect(results.map((r) => r.doc.id)).toEqual(['n1', 't1'])
  })

  it('returns no results for an empty query term', () => {
    expect(searchDocuments(docs, 'zzzzz')).toHaveLength(0)
  })
})

describe('splitHighlight', () => {
  it('marks matching segments case-insensitively', () => {
    const parts = splitHighlight('Grocery list', 'grocery')
    expect(parts.some((p) => p.match && p.text.toLowerCase() === 'grocery')).toBe(true)
  })

  it('returns the whole string when the query is empty', () => {
    expect(splitHighlight('hello', '')).toEqual([{ text: 'hello', match: false }])
  })
})
