import { create } from "zustand";
import { getSupabaseClient } from "@/core/api/supabase";

// Extracts a human-readable message from InsForge/Supabase error objects
// which don't serialize well with console.error (shows as `{}`)
function extractError(err: unknown): string {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, any>;
    return e.message || e.details || e.hint || e.code || JSON.stringify(err);
  }
  return String(err);
}

export interface Brand {
  id: string;
  nombre: string;
  pais_origen: string | null;
}

export interface Family {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Article {
  id: string;
  codigo_fabricante: string;
  codigo_barras: string | null;
  descripcion: string;
  marca_id: string;
  familia_id: string;
  grupo_equivalencia_id: string | null;
  precio_costo: string; // InsForge returns NUMERIC as string to maintain precision
  precio_minorista: string;
  precio_mayorista: string;
  stock_actual: number;
  stock_minimo: number;
  ubicacion_deposito: string | null;
  alicuota_iva: number;
  created_at: string;
  marca?: {
    id: string;
    nombre: string;
  } | null;
  familia?: {
    id: string;
    nombre: string;
  } | null;
}

interface InventoryState {
  // Data State
  articles: Article[];
  brands: Brand[];
  families: Family[];
  isLoading: boolean;

  // Search & Filter State
  searchQuery: string;
  selectedBrandId: string | null;
  selectedFamilyId: string | null;
  stockFilter: "all" | "normal" | "low" | "none";

  // Actions
  setSearchQuery: (query: string) => void;
  setBrandFilter: (id: string | null) => void;
  setFamilyFilter: (id: string | null) => void;
  setStockFilter: (status: "all" | "normal" | "low" | "none") => void;

  // API Actions
  fetchArticles: () => Promise<void>;
  fetchMetadata: () => Promise<void>;
  updateStock: (id: string, newStock: number) => Promise<void>;
  updateStockMinimo: (id: string, newMin: number) => Promise<void>;
  updateStockMinimoBulk: (ids: string[], newMin: number) => Promise<void>;
  
  // Taxonomy Metadata Admin Actions
  addBrand: (nombre: string, pais: string | null) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  addFamily: (nombre: string, descripcion: string | null) => Promise<void>;
  deleteFamily: (id: string) => Promise<void>;

  // Destructive Actions
  deleteAllArticles: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  articles: [],
  brands: [],
  families: [],
  isLoading: false,

  searchQuery: "",
  selectedBrandId: null,
  selectedFamilyId: null,
  stockFilter: "all",

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchArticles();
  },

  setBrandFilter: (id) => {
    set({ selectedBrandId: id });
    get().fetchArticles();
  },

  setFamilyFilter: (id) => {
    set({ selectedFamilyId: id });
    get().fetchArticles();
  },

  setStockFilter: (status) => {
    set({ stockFilter: status });
    get().fetchArticles();
  },

  fetchArticles: async () => {
    set({ isLoading: true });
    try {
      const client = getSupabaseClient();
      const { searchQuery, selectedBrandId, selectedFamilyId, stockFilter } = get();

      // Invoke the high-performance Postgres RPC for smart search
      const { data, error } = await client.database.rpc("buscar_articulos_inteligente", {
        query_text: searchQuery || "",
        brand_filter: selectedBrandId || null,
        family_filter: selectedFamilyId || null,
        stock_filter: stockFilter || "all"
      });

      if (error) throw error;

      set({ articles: (data as Article[]) || [] });
    } catch (err) {
      console.error("Error loading articles:", extractError(err));
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMetadata: async () => {
    try {
      const client = getSupabaseClient();

      // Load brands and families in parallel
      const [brandsRes, familiesRes] = await Promise.all([
        client.database.from("marca").select("*").order("nombre", { ascending: true }),
        client.database.from("familia_repuesto").select("*").order("nombre", { ascending: true }),
      ]);

      if (brandsRes.error) throw brandsRes.error;
      if (familiesRes.error) throw familiesRes.error;

      set({
        brands: (brandsRes.data as Brand[]) || [],
        families: (familiesRes.data as Family[]) || [],
      });
    } catch (err) {
      console.error("Error loading metadata:", extractError(err));
    }
  },

  updateStock: async (id, newStock) => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.database
        .from("articulo")
        .update({ stock_actual: newStock })
        .eq("id", id);

      if (error) throw error;

      // Update locally in Zustand state to avoid roundtrip refetch
      set((state) => ({
        articles: state.articles.map((art) =>
          art.id === id ? { ...art, stock_actual: newStock } : art
        ),
      }));
    } catch (err) {
      console.error("Error updating stock quantity:", extractError(err));
      throw err;
    }
  },

  updateStockMinimo: async (id, newMin) => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.database
        .from("articulo")
        .update({ stock_minimo: newMin })
        .eq("id", id);

      if (error) throw error;

      // Update locally in Zustand
      set((state) => ({
        articles: state.articles.map((art) =>
          art.id === id ? { ...art, stock_minimo: newMin } : art
        ),
      }));
    } catch (err) {
      console.error("Error updating minimum stock:", extractError(err));
      throw err;
    }
  },

  updateStockMinimoBulk: async (ids, newMin) => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.database
        .from("articulo")
        .update({ stock_minimo: newMin })
        .in("id", ids);

      if (error) throw error;

      // Update locally in Zustand for all matching items
      set((state) => ({
        articles: state.articles.map((art) =>
          ids.includes(art.id) ? { ...art, stock_minimo: newMin } : art
        ),
      }));
    } catch (err) {
      console.error("Error bulk updating minimum stock:", extractError(err));
      throw err;
    }
  },

  addBrand: async (nombre, pais) => {
    const client = getSupabaseClient();
    const { error } = await client.database
      .from("marca")
      .insert([{ nombre, pais_origen: pais }]);
    if (error) throw new Error(extractError(error));
    await get().fetchMetadata();
  },

  deleteBrand: async (id) => {
    const client = getSupabaseClient();
    const { error } = await client.database
      .from("marca")
      .delete()
      .eq("id", id);
    if (error) throw new Error(extractError(error));
    await get().fetchMetadata();
  },

  addFamily: async (nombre, descripcion) => {
    const client = getSupabaseClient();
    const { error } = await client.database
      .from("familia_repuesto")
      .insert([{ nombre, descripcion }]);
    if (error) throw new Error(extractError(error));
    await get().fetchMetadata();
  },

  deleteFamily: async (id) => {
    const client = getSupabaseClient();
    const { error } = await client.database
      .from("familia_repuesto")
      .delete()
      .eq("id", id);
    if (error) throw new Error(extractError(error));
    await get().fetchMetadata();
  },

  deleteAllArticles: async () => {
    try {
      const client = getSupabaseClient();
      // Delete all rows — neq with nil UUID matches every real row
      const { error } = await client.database
        .from("articulo")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw new Error(extractError(error));

      set({ articles: [] });
    } catch (err: any) {
      console.error("Error deleting all articles:", extractError(err));
      throw err;
    }
  },
}));
