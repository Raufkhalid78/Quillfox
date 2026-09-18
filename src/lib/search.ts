/**
 * Client-side search over decrypted notes/todo lists.
 *
 * QuillFox is end-to-end encrypted, so the server never sees plaintext and
 * cannot run full-text search. All indexing/ranking therefore happens locally
 * on already-decrypted in-memory data. This module is intentionally pure so it
 * can be unit-tested and reused by any view.
 */

export interface SearchDoc {
  id: string
  type: 'note' | 'todo'
  title: string
  content: string
  tags: string[]
  workspaceId: string | null
  folderId?: string | null
  updatedAt: string
}

export interface SearchFilters {
  types?: Array<'note' | 'todo'>
  workspaceId?: string | null
  tag?: string | null
  /** Only include documents updated on/after this ISO date. */
  since?: string | null
}

export interface SearchResult {
  doc: SearchDoc
  score: number
  /** Fields that matched, for highlighting/UI. */
  matchedIn: Array<'title' | 'content' | 'tag'>
}

function tokenize(value: string): string {
  return value.toLowerCase()
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count++
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

export function searchDocuments(
  docs: SearchDoc[],
  query: string,
  filters: SearchFilters = {}
): SearchResult[] {
  const q = tokenize(query.trim())
  const terms = q.split(/\s+/).filter(Boolean)

  const results: SearchResult[] = []

  for (const doc of docs) {
    if (filters.types && filters.types.length > 0 && !filters.types.includes(doc.type)) continue
    if (filters.workspaceId !== undefined && filters.workspaceId !== null) {
      if ((doc.workspaceId ?? null) !== filters.workspaceId) continue
    }
    if (filters.tag && !doc.tags.map(tokenize).includes(tokenize(filters.tag))) continue
    if (filters.since && new Date(doc.updatedAt).getTime() < new Date(filters.since).getTime()) continue

    if (terms.length === 0) {
      results.push({ doc, score: 0, matchedIn: [] })
      continue
    }

    const title = tokenize(doc.title)
    const content = tokenize(doc.content)
    const tags = doc.tags.map(tokenize)

    let score = 0
    const matchedIn = new Set<'title' | 'content' | 'tag'>()

    for (const term of terms) {
      const inTitle = countOccurrences(title, term)
      const inContent = countOccurrences(content, term)
      const inTags = tags.filter((t) => t.includes(term)).length

      if (inTitle > 0) {
        score += 5 + inTitle
        matchedIn.add('title')
      }
      if (inTags > 0) {
        score += 4 + inTags
        matchedIn.add('tag')
      }
      if (inContent > 0) {
        score += 1 + Math.min(inContent, 5)
        matchedIn.add('content')
      }
    }

    if (score > 0) {
      results.push({ doc, score, matchedIn: [...matchedIn] })
    }
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.doc.updatedAt).getTime() - new Date(a.doc.updatedAt).getTime()
  })
}

/**
 * Splits `text` into alternating plain / matched segments so the UI can wrap
 * matches in a highlight element. Case-insensitive; matches any query term.
 */
export function splitHighlight(
  text: string,
  query: string
): Array<{ text: string; match: boolean }> {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (terms.length === 0) return [{ text, match: false }]

  const regex = new RegExp(`(${terms.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts
    .filter((p) => p !== '')
    .map((p) => ({
      text: p,
      match: terms.some((t) => new RegExp(`^${t}$`, 'i').test(p)),
    }))
}
