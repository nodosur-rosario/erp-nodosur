import { describe, it, expect, beforeEach } from "vitest";
import { useSecretStore } from "../use-secret-store";

describe("Secret Zustand Store Tests (Caja Negra)", () => {
  beforeEach(() => {
    // Reset state before each test
    useSecretStore.getState().setShowCajaNegra(false);
  });

  it("should initialize with showCajaNegra as false", () => {
    const state = useSecretStore.getState();
    expect(state.showCajaNegra).toBe(false);
  });

  it("should toggle showCajaNegra state correctly", () => {
    const store = useSecretStore.getState();
    
    // Toggle once
    store.toggleCajaNegra();
    expect(useSecretStore.getState().showCajaNegra).toBe(true);

    // Toggle twice
    store.toggleCajaNegra();
    expect(useSecretStore.getState().showCajaNegra).toBe(false);
  });

  it("should set showCajaNegra value explicitly", () => {
    const store = useSecretStore.getState();
    
    store.setShowCajaNegra(true);
    expect(useSecretStore.getState().showCajaNegra).toBe(true);

    store.setShowCajaNegra(false);
    expect(useSecretStore.getState().showCajaNegra).toBe(false);
  });
});
