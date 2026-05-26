import { toast as sonnerToast } from "sonner";
import { useNotificationStore } from "./notification-store";

// Deduplication map to prevent toasts from piling up in a short window of time (e.g. 2 seconds)
const activeToasts = new Map<string, number>();
const DEBOUNCE_MS = 2000;

function isDuplicate(message: string, type: string): boolean {
  const key = `${type}:${message}`;
  const now = Date.now();
  const lastTime = activeToasts.get(key);

  if (lastTime && now - lastTime < DEBOUNCE_MS) {
    return true; // Ignore duplicate toast trigger
  }

  activeToasts.set(key, now);
  
  // Cleanup old keys to prevent a memory leak over long sessions
  if (activeToasts.size > 200) {
    for (const [k, v] of activeToasts.entries()) {
      if (now - v > DEBOUNCE_MS * 2) {
        activeToasts.delete(k);
      }
    }
  }

  return false;
}

export const toast = {
  success: (message: string, options?: any) => {
    if (isDuplicate(message, "success")) return "";
    
    // 1. Log in history (Zustand)
    useNotificationStore.getState().addNotification(message, "success");

    // 2. Show visual toast ONLY if explicitly requested via visual: true
    if (options?.visual) {
      const { visual, ...sonnerOptions } = options;
      return sonnerToast.success(message, sonnerOptions);
    }
    return "";
  },
  error: (message: string, options?: any) => {
    // Errors are critical, always visual
    if (isDuplicate(message, "error")) return "";

    const id = sonnerToast.error(message, options);
    useNotificationStore.getState().addNotification(message, "error");
    return id;
  },
  info: (message: string, options?: any) => {
    if (isDuplicate(message, "info")) return "";

    useNotificationStore.getState().addNotification(message, "info");
    
    if (options?.visual) {
      const { visual, ...sonnerOptions } = options;
      return sonnerToast.info(message, sonnerOptions);
    }
    return "";
  },
  warning: (message: string, options?: any) => {
    // Warnings are critical, always visual
    if (isDuplicate(message, "warning")) return "";

    const id = sonnerToast.warning(message, options);
    useNotificationStore.getState().addNotification(message, "warning");
    return id;
  },
  message: (message: string, options?: any) => {
    if (isDuplicate(message, "info")) return "";

    useNotificationStore.getState().addNotification(message, "info");
    
    if (options?.visual) {
      const { visual, ...sonnerOptions } = options;
      return sonnerToast(message, sonnerOptions);
    }
    return "";
  }
};
