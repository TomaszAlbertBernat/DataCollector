import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  WebSocketMessage,
  JobStatusUpdateMessage,
  JobProgressUpdateMessage,
  SystemNotificationMessage,
  WebSocketMessageType,
} from '@/types/api'

interface UseWebSocketOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: WebSocketMessage | null
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options

  const socketRef = useRef<Socket | null>(null)
  const reconnectCountRef = useRef(0)
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
  })

  // Event listeners storage
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001'
    const socket = io(wsUrl, {
      transports: ['websocket'],
      timeout: 10000,
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
      reconnectCountRef.current = 0
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
      }))
    })

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }))

      // Auto-reconnect for client-side disconnections
      if (reason === 'io client disconnect') return
      
      if (reconnectCountRef.current < reconnectAttempts) {
        setTimeout(() => {
          reconnectCountRef.current++
          connect()
        }, reconnectDelay * Math.pow(2, reconnectCountRef.current))
      }
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error.message,
      }))
    })

    // Handle incoming messages
    socket.onAny((eventName: string, data: any) => {
      console.log('WebSocket message:', eventName, data)
      
      setState(prev => ({
        ...prev,
        lastMessage: { type: eventName as WebSocketMessageType, timestamp: new Date().toISOString(), data }
      }))

      // Trigger registered listeners
      const listeners = listenersRef.current.get(eventName)
      if (listeners) {
        listeners.forEach(callback => callback(data))
      }
    })

    socketRef.current = socket
  }, [reconnectAttempts, reconnectDelay])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }))
  }, [])

  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set())
    }
    listenersRef.current.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = listenersRef.current.get(eventType)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          listenersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  const subscribeToJobUpdates = useCallback((
    jobId: string,
    onStatusUpdate?: (update: JobStatusUpdateMessage['data']) => void,
    onProgressUpdate?: (update: JobProgressUpdateMessage['data']) => void
  ) => {
    const unsubscribers: (() => void)[] = []

    if (onStatusUpdate) {
      const unsubStatus = subscribe('job_status_update', (data: JobStatusUpdateMessage['data']) => {
        if (data.jobId === jobId) {
          onStatusUpdate(data)
        }
      })
      unsubscribers.push(unsubStatus)
    }

    if (onProgressUpdate) {
      const unsubProgress = subscribe('job_progress_update', (data: JobProgressUpdateMessage['data']) => {
        if (data.jobId === jobId) {
          onProgressUpdate(data)
        }
      })
      unsubscribers.push(unsubProgress)
    }

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [subscribe])

  const subscribeToSystemNotifications = useCallback((
    callback: (notification: SystemNotificationMessage['data']) => void
  ) => {
    return subscribe('system_notification', callback)
  }, [subscribe])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    subscribeToJobUpdates,
    subscribeToSystemNotifications,
  }
} 