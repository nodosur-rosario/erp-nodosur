import { create } from "zustand";

export interface NotificationItem {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: string; // Serialized ISO string for Next.js hydration compatibility
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (message: string, type: "success" | "error" | "info" | "warning") => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (message, type) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newNotification: NotificationItem = {
      id,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    };

    set((state) => {
      // Limit history to 50 logs for memory safety
      const updatedList = [newNotification, ...state.notifications].slice(0, 50);
      const unreadCount = updatedList.filter((n) => !n.read).length;
      return {
        notifications: updatedList,
        unreadCount,
      };
    });
  },
  markAllAsRead: () => {
    set((state) => {
      const updatedList = state.notifications.map((n) => ({ ...n, read: true }));
      return {
        notifications: updatedList,
        unreadCount: 0,
      };
    });
  },
  markAsRead: (id) => {
    set((state) => {
      const updatedList = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = updatedList.filter((n) => !n.read).length;
      return {
        notifications: updatedList,
        unreadCount,
      };
    });
  },
  clearNotification: (id) => {
    set((state) => {
      const updatedList = state.notifications.filter((n) => n.id !== id);
      const unreadCount = updatedList.filter((n) => !n.read).length;
      return {
        notifications: updatedList,
        unreadCount,
      };
    });
  },
  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },
}));
