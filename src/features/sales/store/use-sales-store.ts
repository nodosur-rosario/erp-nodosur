import { create } from "zustand";

export interface CartItem {
  id: string;
  codigo_fabricante: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_tipo: "minorista" | "mayorista";
  alicuota_iva: number; // 21.0 o 10.5
}

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "cuenta_corriente";

interface SalesState {
  cart: CartItem[];
  customers: any[]; // List of available customers fetched from DB
  clientName: string;
  clientCuit: string;
  clientIvaCondition: string; // "Responsable Inscripto" | "Consumidor Final" | "Monotributista"
  voucherType: "Factura A" | "Factura B" | "Factura C" | "Ticket Interno B";
  paymentMethod: PaymentMethod;
  isSubmitting: boolean;
  
  addItem: (item: { id: string; codigo_fabricante: string; descripcion: string; precio_minorista: number; precio_mayorista: number; familia_id?: string }, precioTipo?: "minorista" | "mayorista") => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateAlicuota: (itemId: string, alicuota: number) => void;
  setClient: (cuit: string, name: string, condition: string) => void;
  setVoucherType: (type: "Factura A" | "Factura B" | "Factura C" | "Ticket Interno B") => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearSales: () => void;
  fetchCustomers: () => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  cart: [],
  customers: [],
  clientName: "Consumidor Final",
  clientCuit: "99999999999",
  clientIvaCondition: "Consumidor Final",
  voucherType: "Factura B",
  paymentMethod: "efectivo",
  isSubmitting: false,

  addItem: (item, precioTipo = "minorista") =>
    set((state) => {
      const existing = state.cart.find((i) => i.id === item.id);
      const precio_unitario = precioTipo === "minorista" ? item.precio_minorista : item.precio_mayorista;
      
      // Intentamos deducir si es una alícuota diferenciada (10.5%) por familia. 
      // Por defecto en autopartes en Argentina la alícuota general es del 21%.
      const alicuota_iva = 21.0;

      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.id === item.id
              ? { ...i, cantidad: i.cantidad + 1, precio_unitario, precio_tipo: precioTipo }
              : i
          ),
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            id: item.id,
            codigo_fabricante: item.codigo_fabricante,
            descripcion: item.descripcion,
            cantidad: 1,
            precio_unitario,
            precio_tipo: precioTipo,
            alicuota_iva,
          },
        ],
      };
    }),

  removeItem: (itemId) =>
    set((state) => ({
      cart: state.cart.filter((i) => i.id !== itemId),
    })),

  updateQuantity: (itemId, quantity) =>
    set((state) => ({
      cart: state.cart.map((i) =>
        i.id === itemId ? { ...i, cantidad: Math.max(1, quantity) } : i
      ),
    })),

  updateAlicuota: (itemId, alicuota) =>
    set((state) => ({
      cart: state.cart.map((i) =>
        i.id === itemId ? { ...i, alicuota_iva: alicuota } : i
      ),
    })),

  setClient: (cuit, name, condition) =>
    set((state) => {
      // Auto-selección lógica de tipo de comprobante basada en la condición tributaria frente al IVA (RG 5003/2021)
      let voucherType: "Factura A" | "Factura B" | "Factura C" | "Ticket Interno B" = "Factura B";
      if (condition === "Responsable Inscripto" || condition === "Monotributista") {
        voucherType = "Factura A"; // Los monotributistas reciben Factura A desde julio 2021
      } else {
        voucherType = "Factura B"; // Consumidor Final y Exento reciben Factura B
      }
      
      return {
        clientCuit: cuit || "99999999999",
        clientName: name || "Consumidor Final",
        clientIvaCondition: condition || "Consumidor Final",
        voucherType,
      };
    }),

  setVoucherType: (type) =>
    set(() => ({
      voucherType: type,
    })),

  setPaymentMethod: (method) =>
    set(() => ({
      paymentMethod: method,
    })),

  clearSales: () =>
    set(() => ({
      cart: [],
      clientName: "Consumidor Final",
      clientCuit: "99999999999",
      clientIvaCondition: "Consumidor Final",
      voucherType: "Factura B",
      paymentMethod: "efectivo",
      isSubmitting: false,
    })),

  fetchCustomers: async () => {
    try {
      const { getSupabaseClient } = await import("@/core/api/supabase");
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("customers")
        .select("*")
        .order("razon_social", { ascending: true });

      if (!error && data) {
        set({ customers: data });
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  },
}));
