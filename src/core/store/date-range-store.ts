import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getQuickSelectBounds } from "../utils/timezone-utils";

export type QuickSelectOption = "este-mes" | "mes-anterior" | "ultimos-3-meses" | "personalizado";

export interface DateRangeState {
  startDate: string;      // Formato DD/MM/YYYY
  endDate: string;        // Formato DD/MM/YYYY
  quickSelect: QuickSelectOption;
  
  // Acciones
  setQuickSelect: (option: QuickSelectOption) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  resetStore: () => void;
}

// Valores iniciales por defecto basados en "este-mes" en hora de Argentina
const getDefaultBounds = () => {
  try {
    return getQuickSelectBounds("este-mes");
  } catch {
    // Fallback seguro en caso de SSR o fallas de formateo iniciales
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = pad(now.getDate());
    const m = pad(now.getMonth() + 1);
    const y = now.getFullYear();
    return {
      startDate: `01/${m}/${y}`,
      endDate: `${d}/${m}/${y}`,
    };
  }
};

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      startDate: getDefaultBounds().startDate,
      endDate: getDefaultBounds().endDate,
      quickSelect: "este-mes",

      setQuickSelect: (option) => {
        if (option === "personalizado") {
          set({ quickSelect: "personalizado" });
          return;
        }
        
        const bounds = getQuickSelectBounds(option);
        set({
          startDate: bounds.startDate,
          endDate: bounds.endDate,
          quickSelect: option,
        });
      },

      setCustomRange: (start, end) => {
        set({
          startDate: start,
          endDate: end,
          quickSelect: "personalizado",
        });
      },

      resetStore: () => {
        const bounds = getDefaultBounds();
        set({
          startDate: bounds.startDate,
          endDate: bounds.endDate,
          quickSelect: "este-mes",
        });
      },
    }),
    {
      name: "nodosur-date-range", // Nombre de la clave en localStorage
    }
  )
);
