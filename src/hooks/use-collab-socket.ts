'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface CollabSocketOptions {
  documentType: 'note' | 'todolist'
  documentId: string
  userId: string
  userName: string
  avatar?: string | null
  onContentUpdate?: (content: string) => void
  onItemCompleted?: (itemId: string, completed: boolean) => void
}

interface CollabSocketReturn {
  isConnected: boolean
  activeUsers: Array<{ userId: string; userName: string; avatar?: string | null }>
  lockStatus: {
    isLocked: boolean
    lockedByUser: string | null
  }
  requestLock: () => void
  releaseLock: () => void
}

export function useCollabSocket(options: CollabSocketOptions): CollabSocketReturn {
  const {
    documentType,
    documentId,
    userId,
    userName,
    avatar,
    onContentUpdate,
    onItemCompleted,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<Array<{ userId: string; userName: string; avatar?: string | null }>>([])
  const [lockStatus, setLockStatus] = useState({
    isLocked: false,
    lockedByUser: null as string | null,
  })

  const socketRef = useRef<Socket | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Connect and setup event listeners
  useEffect(() => {
    if (!userId || !documentId) return

    const socket = io('/?XTransformPort=3004', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      // Join document session
      socket.emit('join-document', {
        documentType,
        documentId,
        userId,
        userName,
        avatar,
      })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    })

    socket.on('lock-status', (data: { isLocked: boolean; lockedByUser: string | null }) => {
      setLockStatus({
        isLocked: data.isLocked,
        lockedByUser: data.lockedByUser,
      })
    })

    socket.on('lock-granted', () => {
      setLockStatus({
        isLocked: true,
        lockedByUser: userName,
      })
      // Start heartbeat to keep lock alive
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      heartbeatIntervalRef.current = setInterval(() => {
        socket.emit('lock-heartbeat', { documentType, documentId })
      }, 10000)
    })

    socket.on('lock-denied', (data: { lockedByUser: string }) => {
      setLockStatus({
        isLocked: true,
        lockedByUser: data.lockedByUser,
      })
    })

    socket.on('lock-released', () => {
      setLockStatus({
        isLocked: false,
        lockedByUser: null,
      })
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    })

    socket.on('active-users', (data: { users: Array<{ userId: string; userName: string; avatar?: string | null }> }) => {
      setActiveUsers(data.users.filter((u) => u.userId !== userId))
    })

    socket.on('user-joined', (data: { userId: string; userName: string; avatar?: string | null }) => {
      setActiveUsers((prev) => {
        if (!prev.find((u) => u.userId === data.userId) && data.userId !== userId) {
          return [...prev, { userId: data.userId, userName: data.userName, avatar: data.avatar }]
        }
        return prev
      })
    })

    socket.on('user-left', (data: { userId: string }) => {
      setActiveUsers((prev) => prev.filter((u) => u.userId !== data.userId))
    })

    socket.on('content-update', (data: { content: string }) => {
      onContentUpdate?.(data.content)
    })

    socket.on('item-completed', (data: { itemId: string; completed: boolean }) => {
      onItemCompleted?.(data.itemId, data.completed)
    })

    return () => {
      if (socket.connected) {
        socket.emit('leave-document')
      }
      socket.disconnect()
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      socketRef.current = null
    }
  }, [documentType, documentId, userId, userName, avatar, onContentUpdate, onItemCompleted])

  const requestLock = useCallback(() => {
    socketRef.current?.emit('request-lock', {
      documentType,
      documentId,
    })
  }, [documentType, documentId])

  const releaseLock = useCallback(() => {
    socketRef.current?.emit('release-lock', {
      documentType,
      documentId,
    })
  }, [documentType, documentId])

  return {
    isConnected,
    activeUsers,
    lockStatus,
    requestLock,
    releaseLock,
  }
}
