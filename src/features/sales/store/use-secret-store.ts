import { create } from "zustand";

interface SecretState {
  showCajaNegra: boolean;
  toggleCajaNegra: () => void;
  setShowCajaNegra: (value: boolean) => void;
}

export const useSecretStore = create<SecretState>((set) => ({
  showCajaNegra: false,
  toggleCajaNegra: () => set((state) => ({ showCajaNegra: !state.showCajaNegra })),
  setShowCajaNegra: (value) => set({ showCajaNegra: value }),
}));
