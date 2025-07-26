import { create } from 'zustand'
import type { ClientNotification } from '@/types/api'

interface NotificationStore {
  // State
  notifications: ClientNotification[]
  
  // Actions
  addNotification: (notification: Omit<ClientNotification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  
  // Computed selectors
  getUnreadCount: () => number
  getUnreadNotifications: () => ClientNotification[]
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // Initial state
  notifications: [],

  // Actions
  addNotification: (notification) => {
    const newNotification: ClientNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      isRead: false,
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
    }))

    // Auto-remove notification after duration (if specified)
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(newNotification.id)
      }, notification.duration)
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),

  clearAll: () => set({ notifications: [] }),

  // Computed selectors
  getUnreadCount: () => get().notifications.filter((n) => !n.isRead).length,

  getUnreadNotifications: () => get().notifications.filter((n) => !n.isRead),
}))

// Selector hooks
export const useUnreadNotifications = () =>
  useNotificationStore((state) => state.getUnreadNotifications())

export const useUnreadCount = () =>
  useNotificationStore((state) => state.getUnreadCount()) 