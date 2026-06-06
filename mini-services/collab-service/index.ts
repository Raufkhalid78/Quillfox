import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Document sessions: { documentKey -> Set<socketId> }
const documentSessions = new Map<string, Set<string>>()

// Active users per document: { documentKey -> Map<socketId, { userId, userName, avatar }> }
const documentUsers = new Map<string, Map<string, { userId: string; userName: string; avatar?: string }>>()

// Locks: { documentKey -> { userId, userName, lockedAt, expiresAt } | null }
const documentLocks = new Map<string, { userId: string; userName: string; lockedAt: number; expiresAt: number } | null>()

// Activity tracking for lock auto-expiry
const lastActivity = new Map<string, number>()

const LOCK_TIMEOUT = 30 * 1000 // 30 seconds

function getDocumentKey(documentType: string, documentId: string): string {
  return `${documentType}:${documentId}`
}

function getActiveUsers(documentKey: string) {
  const usersMap = documentUsers.get(documentKey)
  if (!usersMap) return []
  return Array.from(usersMap.values())
}

function broadcastActiveUsers(documentKey: string) {
  const users = getActiveUsers(documentKey)
  const sessions = documentSessions.get(documentKey)
  if (!sessions) return

  for (const socketId of sessions) {
    io.to(socketId).emit('active-users', { users })
  }
}

function checkLockExpiry() {
  const now = Date.now()
  for (const [documentKey, lock] of documentLocks.entries()) {
    if (lock && now > lock.expiresAt) {
      console.log(`Lock expired for ${documentKey}`)
      documentLocks.set(documentKey, null)

      const sessions = documentSessions.get(documentKey)
      if (sessions) {
        for (const socketId of sessions) {
          io.to(socketId).emit('lock-released', {
            releasedBy: lock.userName,
            reason: 'timeout',
          })
        }
      }
    }
  }
}

// Check lock expiry every 5 seconds
setInterval(checkLockExpiry, 5000)

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Join a document editing session
  socket.on('join-document', (data: { documentType: string; documentId: string; userId: string; userName: string; avatar?: string }) => {
    const { documentType, documentId, userId, userName, avatar } = data
    const documentKey = getDocumentKey(documentType, documentId)

    // Add to sessions
    if (!documentSessions.has(documentKey)) {
      documentSessions.set(documentKey, new Set())
    }
    documentSessions.get(documentKey)!.add(socket.id)

    // Add to users map
    if (!documentUsers.has(documentKey)) {
      documentUsers.set(documentKey, new Map())
    }
    documentUsers.get(documentKey)!.set(socket.id, { userId, userName, avatar })

    // Store session info on socket
    socket.data.documentKey = documentKey
    socket.data.userId = userId
    socket.data.userName = userName

    // Send current lock status
    const currentLock = documentLocks.get(documentKey)
    if (currentLock) {
      socket.emit('lock-status', {
        isLocked: true,
        lockedByUser: currentLock.userName,
      })
    } else {
      socket.emit('lock-status', {
        isLocked: false,
        lockedByUser: null,
      })
    }

    // Broadcast updated users
    broadcastActiveUsers(documentKey)

    // Broadcast user joined
    const sessions = documentSessions.get(documentKey)
    if (sessions) {
      for (const sid of sessions) {
        if (sid !== socket.id) {
          io.to(sid).emit('user-joined', {
            userId,
            userName,
            avatar,
          })
        }
      }
    }

    console.log(`${userName} joined document ${documentKey}, active users: ${documentSessions.get(documentKey)?.size}`)
  })

  // Leave a document editing session
  socket.on('leave-document', () => {
    const documentKey = socket.data.documentKey
    const userName = socket.data.userName
    const userId = socket.data.userId

    if (documentKey) {
      // Remove from sessions
      const sessions = documentSessions.get(documentKey)
      if (sessions) {
        sessions.delete(socket.id)
        if (sessions.size === 0) {
          documentSessions.delete(documentKey)
          documentUsers.delete(documentKey)
          documentLocks.delete(documentKey)
        }
      }

      // Remove from users map
      const usersMap = documentUsers.get(documentKey)
      if (usersMap) {
        usersMap.delete(socket.id)
      }

      // Release lock if this user held it
      const lock = documentLocks.get(documentKey)
      if (lock && lock.userId === userId) {
        documentLocks.set(documentKey, null)
        const remainingSessions = documentSessions.get(documentKey)
        if (remainingSessions) {
          for (const sid of remainingSessions) {
            io.to(sid).emit('lock-released', {
              releasedBy: userName,
              reason: 'disconnect',
            })
          }
        }
      }

      // Broadcast user left
      const remainingSessions = documentSessions.get(documentKey)
      if (remainingSessions) {
        for (const sid of remainingSessions) {
          io.to(sid).emit('user-left', {
            userId,
            userName,
          })
        }
        broadcastActiveUsers(documentKey)
      }

      console.log(`${userName} left document ${documentKey}`)
    }
  })

  // Request exclusive edit lock
  socket.on('request-lock', (data: { documentType: string; documentId: string }) => {
    const { documentType, documentId } = data
    const documentKey = getDocumentKey(documentType, documentId)
    const userId = socket.data.userId
    const userName = socket.data.userName

    const currentLock = documentLocks.get(documentKey)

    if (currentLock && currentLock.userId !== userId) {
      // Lock is held by someone else
      socket.emit('lock-denied', {
        lockedByUser: currentLock.userName,
      })
      return
    }

    // Grant or renew lock
    const now = Date.now()
    documentLocks.set(documentKey, {
      userId,
      userName,
      lockedAt: now,
      expiresAt: now + LOCK_TIMEOUT,
    })

    lastActivity.set(documentKey, now)

    socket.emit('lock-granted', {
      documentKey,
      lockedByUser: userName,
      expiresAt: now + LOCK_TIMEOUT,
    })

    // Broadcast lock status to others
    const sessions = documentSessions.get(documentKey)
    if (sessions) {
      for (const sid of sessions) {
        if (sid !== socket.id) {
          io.to(sid).emit('lock-status', {
            isLocked: true,
            lockedByUser: userName,
          })
        }
      }
    }
  })

  // Release lock
  socket.on('release-lock', (data: { documentType: string; documentId: string }) => {
    const { documentType, documentId } = data
    const documentKey = getDocumentKey(documentType, documentId)
    const userId = socket.data.userId
    const userName = socket.data.userName

    const lock = documentLocks.get(documentKey)
    if (lock && lock.userId === userId) {
      documentLocks.set(documentKey, null)

      const sessions = documentSessions.get(documentKey)
      if (sessions) {
        for (const sid of sessions) {
          io.to(sid).emit('lock-released', {
            releasedBy: userName,
            reason: 'manual',
          })
        }
      }
    }
  })

  // Heartbeat to keep lock alive
  socket.on('lock-heartbeat', (data: { documentType: string; documentId: string }) => {
    const { documentType, documentId } = data
    const documentKey = getDocumentKey(documentType, documentId)
    const userId = socket.data.userId
    const now = Date.now()

    const lock = documentLocks.get(documentKey)
    if (lock && lock.userId === userId) {
      lock.expiresAt = now + LOCK_TIMEOUT
      lastActivity.set(documentKey, now)
    }
  })

  // Content update broadcast
  socket.on('content-update', (data: { documentType: string; documentId: string; content: string }) => {
    const { documentType, documentId, content } = data
    const documentKey = getDocumentKey(documentType, documentId)
    const userId = socket.data.userId

    const sessions = documentSessions.get(documentKey)
    if (sessions) {
      for (const sid of sessions) {
        if (sid !== socket.id) {
          io.to(sid).emit('content-update', {
            userId,
            content,
          })
        }
      }
    }
  })

  // Item completed broadcast
  socket.on('item-completed', (data: { documentType: string; documentId: string; itemId: string; completed: boolean }) => {
    const { documentType, documentId, itemId, completed } = data
    const documentKey = getDocumentKey(documentType, documentId)
    const userId = socket.data.userId

    const sessions = documentSessions.get(documentKey)
    if (sessions) {
      for (const sid of sessions) {
        if (sid !== socket.id) {
          io.to(sid).emit('item-completed', {
            userId,
            itemId,
            completed,
          })
        }
      }
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    const documentKey = socket.data.documentKey
    const userName = socket.data.userName
    const userId = socket.data.userId

    if (documentKey) {
      // Remove from sessions
      const sessions = documentSessions.get(documentKey)
      if (sessions) {
        sessions.delete(socket.id)
        if (sessions.size === 0) {
          documentSessions.delete(documentKey)
          documentUsers.delete(documentKey)
          documentLocks.delete(documentKey)
          lastActivity.delete(documentKey)
        }
      }

      // Remove from users map
      const usersMap = documentUsers.get(documentKey)
      if (usersMap) {
        usersMap.delete(socket.id)
      }

      // Release lock if this user held it
      const lock = documentLocks.get(documentKey)
      if (lock && lock.userId === userId) {
        documentLocks.set(documentKey, null)
        const remainingSessions = documentSessions.get(documentKey)
        if (remainingSessions) {
          for (const sid of remainingSessions) {
            io.to(sid).emit('lock-released', {
              releasedBy: userName,
              reason: 'disconnect',
            })
          }
        }
      }

      // Broadcast user left
      const remainingSessions = documentSessions.get(documentKey)
      if (remainingSessions) {
        for (const sid of remainingSessions) {
          io.to(sid).emit('user-left', {
            userId,
            userName,
          })
        }
        broadcastActiveUsers(documentKey)
      }

      console.log(`${userName || 'User'} disconnected from ${documentKey}`)
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3004
httpServer.listen(PORT, () => {
  console.log(`Collaboration WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down collaboration server...')
  httpServer.close(() => {
    console.log('Collaboration server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down collaboration server...')
  httpServer.close(() => {
    console.log('Collaboration server closed')
    process.exit(0)
  })
})
