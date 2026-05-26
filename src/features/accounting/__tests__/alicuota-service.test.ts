import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAlicuotas,
  upsertAlicuota,
  toggleAlicuotaActiva,
  deleteAlicuota,
  AlicuotaIva
} from "../services/alicuota-service";

type MockChainable = {
  from: any;
  select: any;
  insert: any;
  update: any;
  delete: any;
  eq: any;
  order: any;
  upsert: any;
  selectResult?: any;
  errorResult?: any;
  upsertErrorResult?: any;
  updateErrorResult?: any;
  deleteErrorResult?: any;
};

const mockDatabase: MockChainable = {
  from: vi.fn().mockImplementation(() => mockDatabase),
  select: vi.fn().mockImplementation(() => mockDatabase),
  insert: vi.fn().mockImplementation(() => mockDatabase),
  update: vi.fn().mockImplementation(() => mockDatabase),
  delete: vi.fn().mockImplementation(() => mockDatabase),
  upsert: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      error: mockDatabase.upsertErrorResult || mockDatabase.errorResult || null,
    });
  }),
  eq: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      error: mockDatabase.updateErrorResult || mockDatabase.deleteErrorResult || mockDatabase.errorResult || null,
    });
  }),
  order: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      data: mockDatabase.selectResult,
      error: mockDatabase.errorResult || null,
    });
  }),
  selectResult: null,
  errorResult: null,
  upsertErrorResult: null,
  updateErrorResult: null,
  deleteErrorResult: null,
};

const mockSupabaseClient = {
  database: mockDatabase,
};

vi.mock("@/core/api/supabase", () => {
  return {
    getSupabaseClient: () => mockSupabaseClient,
  };
});

describe("Módulo de Contabilidad - Alícuotas de IVA - Tests de Unidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.selectResult = null;
    mockDatabase.errorResult = null;
    mockDatabase.upsertErrorResult = null;
    mockDatabase.updateErrorResult = null;
    mockDatabase.deleteErrorResult = null;
  });

  describe("getAlicuotas", () => {
    it("debe retornar la lista de alícuotas ordenada por porcentaje", async () => {
      const mockRates = [
        { codigo_afip: 3, descripcion: "IVA 0%", porcentaje: 0.00, activa: true },
        { codigo_afip: 4, descripcion: "IVA 10.5%", porcentaje: 10.50, activa: true },
        { codigo_afip: 5, descripcion: "IVA 21%", porcentaje: 21.00, activa: true },
      ];

      mockDatabase.selectResult = mockRates;

      const { data, error } = await getAlicuotas();

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data[0].porcentaje).toBe(0);
      expect(data[2].descripcion).toBe("IVA 21%");
      expect(mockDatabase.from).toHaveBeenCalledWith("alicuota_iva");
      expect(mockDatabase.order).toHaveBeenCalledWith("porcentaje", { ascending: true });
    });

    it("debe retornar error si la consulta a la base de datos falla", async () => {
      mockDatabase.errorResult = { message: "Error al consultar base de datos" };

      const { data, error } = await getAlicuotas();

      expect(data).toHaveLength(0);
      expect(error).toContain("Error al consultar base de datos");
    });
  });

  describe("upsertAlicuota", () => {
    it("debe fallar si el código AFIP es negativo o indefinido", async () => {
      const item: AlicuotaIva = {
        codigo_afip: -1,
        descripcion: "IVA Invalido",
        porcentaje: 15.00,
        activa: true
      };

      const result = await upsertAlicuota(item);
      expect(result.success).toBe(false);
      expect(result.error).toContain("El código AFIP debe ser un número entero válido");
    });

    it("debe fallar si la descripción está vacía", async () => {
      const item: AlicuotaIva = {
        codigo_afip: 10,
        descripcion: "   ",
        porcentaje: 15.00,
        activa: true
      };

      const result = await upsertAlicuota(item);
      expect(result.success).toBe(false);
      expect(result.error).toContain("La descripción es obligatoria");
    });

    it("debe fallar si el porcentaje está fuera del rango [0, 100]", async () => {
      const item: AlicuotaIva = {
        codigo_afip: 10,
        descripcion: "IVA 120%",
        porcentaje: 120.00,
        activa: true
      };

      const result = await upsertAlicuota(item);
      expect(result.success).toBe(false);
      expect(result.error).toContain("El porcentaje debe ser un número entre 0 y 100");
    });

    it("debe insertar o actualizar exitosamente una alícuota válida", async () => {
      mockDatabase.upsert = vi.fn().mockResolvedValue({ error: null });

      const item: AlicuotaIva = {
        codigo_afip: 8,
        descripcion: "IVA 5%",
        porcentaje: 5.00,
        activa: true
      };

      const result = await upsertAlicuota(item);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockDatabase.from).toHaveBeenCalledWith("alicuota_iva");
      expect(mockDatabase.upsert).toHaveBeenCalledWith(
        [
          {
            codigo_afip: 8,
            descripcion: "IVA 5%",
            porcentaje: 5.00,
            activa: true,
          }
        ],
        { onConflict: "codigo_afip" }
      );
    });
  });

  describe("toggleAlicuotaActiva", () => {
    it("debe actualizar el estado activa de una alícuota por su código AFIP", async () => {
      mockDatabase.update = vi.fn().mockImplementation(() => mockDatabase);
      mockDatabase.eq = vi.fn().mockResolvedValue({ error: null });

      const result = await toggleAlicuotaActiva(5, false);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockDatabase.from).toHaveBeenCalledWith("alicuota_iva");
      expect(mockDatabase.update).toHaveBeenCalledWith({ activa: false });
      expect(mockDatabase.eq).toHaveBeenCalledWith("codigo_afip", 5);
    });
  });

  describe("deleteAlicuota", () => {
    it("debe eliminar una alícuota por su código AFIP", async () => {
      mockDatabase.delete = vi.fn().mockImplementation(() => mockDatabase);
      mockDatabase.eq = vi.fn().mockResolvedValue({ error: null });

      const result = await deleteAlicuota(6);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockDatabase.from).toHaveBeenCalledWith("alicuota_iva");
      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(mockDatabase.eq).toHaveBeenCalledWith("codigo_afip", 6);
    });
  });
});
