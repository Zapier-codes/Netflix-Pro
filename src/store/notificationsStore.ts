// src/store/notificationsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  data?: any;
}

interface NotificationsState {
  items: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
  getNotificationsByType: (type: NotificationItem['type']) => NotificationItem[];
  getRecentNotifications: (limit?: number) => NotificationItem[];
}

export const useNotifications = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],

      addNotification: (notification) => {
        const newItem: NotificationItem = {
          ...notification,
          timestamp: new Date().toISOString(),
          read: false,
        };
        set((state) => ({
          items: [newItem, ...state.items].slice(0, 100)
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          items: state.items.map(item =>
            item.id === id ? { ...item, read: true } : item
          )
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map(item => ({ ...item, read: true }))
        }));
      },

      removeNotification: (id) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== id)
        }));
      },

      clearAll: () => {
        set({ items: [] });
      },

      getUnreadCount: () => {
        return get().items.filter(item => !item.read).length;
      },

      getNotificationsByType: (type) => {
        return get().items.filter(item => item.type === type);
      },

      getRecentNotifications: (limit = 20) => {
        return get().items.slice(0, limit);
      },
    }),
    {
      name: 'notifications-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useUnreadCount = () => {
  const count = useNotifications((state) => state.items.filter(i => !i.read).length);
  return count;
};

export const useHasUnread = () => {
  const hasUnread = useNotifications((state) => state.items.some(i => !i.read));
  return hasUnread;
};

export default useNotifications;