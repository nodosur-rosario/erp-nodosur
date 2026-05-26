import { create } from "zustand";

export interface CajaSession {
  id: string;
  cuit: string;
  user_id: string;
  estado: "abierta" | "cerrada";
  monto_inicial: number;
  monto_teorico: number;
  monto_real: number | null;
  diferencia: number | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  notas: string | null;
}

export interface CajaMovimiento {
  id: string;
  sesion_id: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  concepto: string;
  fecha: string;
  accounting_transaction_id: string | null;
  canal?: string;
}

interface CajaState {
  activeSession: CajaSession | null;
  movimientos: CajaMovimiento[];
  isLoading: boolean;

  setSession: (session: CajaSession | null) => void;
  setMovimientos: (movimientos: CajaMovimiento[]) => void;
  addMovimiento: (movimiento: CajaMovimiento) => void;
  clearSession: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useCajaStore = create<CajaState>((set) => ({
  activeSession: null,
  movimientos: [],
  isLoading: false,

  setSession: (session) => set({ activeSession: session }),
  setMovimientos: (movimientos) => set({ movimientos }),
  addMovimiento: (movimiento) =>
    set((state) => ({
      movimientos: [movimiento, ...state.movimientos],
      activeSession: state.activeSession
        ? {
            ...state.activeSession,
            monto_teorico:
              state.activeSession.monto_teorico +
              (movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto),
          }
        : null,
    })),
  clearSession: () => set({ activeSession: null, movimientos: [] }),
  setLoading: (isLoading) => set({ isLoading }),
}));
