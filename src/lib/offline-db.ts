const DB_NAME = 'quillfox_offline_cache'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheData(storeName: 'workspaces' | 'notes' | 'todos', items: any[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    store.clear()
    for (const item of items) {
      store.put(item)
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.warn(`[Offline Cache] Failed to write to ${storeName}:`, err)
  }
}

export async function getCachedData(storeName: 'workspaces' | 'notes' | 'todos'): Promise<any[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn(`[Offline Cache] Failed to read from ${storeName}:`, err)
    return []
  }
}
