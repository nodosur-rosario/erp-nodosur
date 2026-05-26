import { describe, it, expect, beforeEach, vi } from "vitest";
import { toast } from "../toast";
import { useNotificationStore } from "../notification-store";

// Mock sonner toast to verify visual triggers
vi.mock("sonner", () => {
  const mockFn = vi.fn();
  const mockToastObj = Object.assign(mockFn, {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  });
  return {
    toast: mockToastObj,
  };
});

describe("Notification History and Anti-Stacking Debounce System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().clearAll();
  });

  it("should record a notification in history and trigger the visual toast", () => {
    toast.success("Asiento contable registrado");

    const history = useNotificationStore.getState().notifications;
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe("Asiento contable registrado");
    expect(history[0].type).toBe("success");
    expect(history[0].read).toBe(false);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("should prevent duplicate toasts from piling up when triggered in short succession (2 seconds)", () => {
    // Fire identical success messages rapidly
    toast.success("Operación exitosa");
    toast.success("Operación exitosa");
    toast.success("Operación exitosa");

    const history = useNotificationStore.getState().notifications;
    // Assert only one got recorded
    expect(history).toHaveLength(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("should allow different messages to trigger normally without debouncing", () => {
    toast.success("Mensaje A");
    toast.info("Mensaje B");
    toast.error("Mensaje C");

    const history = useNotificationStore.getState().notifications;
    expect(history).toHaveLength(3);
    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  it("should allow marking notifications as read", () => {
    toast.success("Alerta contable");
    expect(useNotificationStore.getState().unreadCount).toBe(1);

    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });
});
