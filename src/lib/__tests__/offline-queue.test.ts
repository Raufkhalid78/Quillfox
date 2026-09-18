import { getQueue, enqueue, flushQueue, queueLength, isNetworkError } from '../offline-queue'

describe('offline-queue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('enqueues operations and reports the length', () => {
    expect(queueLength()).toBe(0)
    enqueue({ table: 'notes', kind: 'update', values: { title: 'x' }, match: { column: 'id', value: 'n1' } })
    enqueue({ table: 'todo_lists', kind: 'delete', match: { column: 'id', value: 't1' } })
    expect(queueLength()).toBe(2)
    expect(getQueue()[0].table).toBe('notes')
  })

  it('flushes queued operations and clears the queue', async () => {
    enqueue({ table: 'notes', kind: 'update', values: { title: 'x' }, match: { column: 'id', value: 'n1' } })
    enqueue({ table: 'todo_lists', kind: 'delete', match: { column: 'values', values: ['a', 'b'] } })
    const applied = await flushQueue()
    expect(applied).toBe(2)
    expect(queueLength()).toBe(0)
  })

  it('recognizes network errors', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})
