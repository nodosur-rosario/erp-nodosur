import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAccountingAccounts,
  getAccountingTransactions,
  createManualTransaction,
  deleteTransaction,
} from "../services/accounting-service";

// Definimos los tipos del mock de base de datos de InsForge
type MockChainable = {
  from: any;
  select: any;
  insert: any;
  update: any;
  delete: any;
  eq: any;
  order: any;
  limit: any;
  single: any;
  maybeSingle: any;
  or: any;
  is: any;
  then: any;
  selectResult?: any;
  errorResult?: any;
  insertErrorResult?: any;
  deleteErrorResult?: any;
};

// Crear mock de base de datos InsForge robusto y configurable
const mockDatabase: MockChainable = {
  from: vi.fn().mockImplementation(() => mockDatabase),
  select: vi.fn().mockImplementation(() => mockDatabase),
  insert: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      data: [],
      error: mockDatabase.insertErrorResult || mockDatabase.errorResult || null,
    });
  }),
  update: vi.fn().mockImplementation(() => mockDatabase),
  delete: vi.fn().mockImplementation(() => mockDatabase),
  eq: vi.fn().mockImplementation(() => mockDatabase),
  or: vi.fn().mockImplementation(() => mockDatabase),
  is: vi.fn().mockImplementation(() => mockDatabase),
  order: vi.fn().mockImplementation(() => mockDatabase),
  limit: vi.fn().mockImplementation(() => mockDatabase),
  single: vi.fn().mockImplementation(() => {
    return Promise.resolve({ 
      data: mockDatabase.selectResult, 
      error: mockDatabase.errorResult || null 
    });
  }),
  maybeSingle: vi.fn().mockImplementation(() => {
    return Promise.resolve({ 
      data: mockDatabase.selectResult, 
      error: mockDatabase.errorResult || null 
    });
  }),
  then: vi.fn().mockImplementation((onfulfilled) => {
    return Promise.resolve({
      data: mockDatabase.selectResult,
      error: mockDatabase.errorResult || null,
    }).then(onfulfilled);
  }),
  selectResult: null,
  errorResult: null,
  insertErrorResult: null,
  deleteErrorResult: null,
};

const mockSupabaseClient = {
  database: mockDatabase,
};

// Mockear el cliente Supabase
vi.mock("@/core/api/supabase", () => {
  return {
    getSupabaseClient: () => mockSupabaseClient,
  };
});

describe("Módulo de Contabilidad - Tests de Unidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.selectResult = null;
    mockDatabase.errorResult = null;
    mockDatabase.insertErrorResult = null;
    mockDatabase.deleteErrorResult = null;
  });

  describe("getAccountingAccounts", () => {
    it("debe retornar el plan de cuentas ordenado jerárquicamente de manera exitosa", async () => {
      const mockAccounts = [
        { code: "1", name: "Activo", parent_code: null, type: "activo" },
        { code: "1.1", name: "Activo Corriente", parent_code: "1", type: "activo" },
        { code: "1.1.1.01", name: "Caja General", parent_code: "1.1", type: "activo" },
      ];

      mockDatabase.selectResult = mockAccounts;
      // Para queries normales sin .single(), devolvemos el selectResult mockeado simulando la resolución de la promesa
      mockDatabase.order = vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: mockAccounts, error: null });
      });

      const { data, error } = await getAccountingAccounts();

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data[0].code).toBe("1");
      expect(data[2].name).toBe("Caja General");
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_accounts");
    });

    it("debe retornar error amigablemente si la consulta a la base de datos falla", async () => {
      mockDatabase.order = vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: null, error: { message: "Database connection failed" } });
      });

      const { data, error } = await getAccountingAccounts();

      expect(data).toHaveLength(0);
      expect(error).toContain("Database connection failed");
    });
  });

  describe("getAccountingTransactions (Libro Diario)", () => {
    it("debe retornar la lista de transacciones con sus respectivos asientos detallados", async () => {
      const mockTransactions = [
        {
          id: "TX-1",
          date: "2026-05-21T12:00:00Z",
          description: "Venta POS Efectivo",
          accounting_entries: [
            { id: 10, transaction_id: "TX-1", account_code: "1.1.1.01", debe: 1210, haber: 0, accounting_accounts: { name: "Caja General" } },
            { id: 11, transaction_id: "TX-1", account_code: "4.1.1.01", debe: 0, haber: 1000, accounting_accounts: { name: "Ventas" } },
            { id: 12, transaction_id: "TX-1", account_code: "2.1.3.01", debe: 0, haber: 210, accounting_accounts: { name: "IVA Débito Fiscal" } },
          ],
        },
      ];

      mockDatabase.order = vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: mockTransactions, error: null });
      });

      const { data, error } = await getAccountingTransactions();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].description).toBe("Venta POS Efectivo");
      expect(data[0].accounting_entries).toHaveLength(3);
      expect(data[0].accounting_entries?.[0].debe).toBe(1210);
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_transactions");
    });
  });

  describe("createManualTransaction (Asiento Manual)", () => {
    it("debe fallar si la descripción está vacía", async () => {
      const result = await createManualTransaction("", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 100, haber: 0 },
        { account_code: "4.1.1.01", debe: 0, haber: 100 },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("La descripción del asiento es obligatoria");
    });

    it("debe fallar si el asiento tiene menos de dos líneas", async () => {
      const result = await createManualTransaction("Ajuste", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 100, haber: 0 },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("debe tener al menos dos líneas");
    });

    it("debe fallar si el asiento está desbalanceado (Partida Doble fallida)", async () => {
      const result = await createManualTransaction("Asiento Desbalanceado", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 100, haber: 0 },
        { account_code: "4.1.1.01", debe: 0, haber: 95 }, // $5 de diferencia
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("no está balanceado. Diferencia de $5.00");
    });

    it("debe registrar exitosamente un asiento balanceado", async () => {
      // Configuramos mock para inserción exitosa
      mockDatabase.insert = vi.fn().mockResolvedValue({ error: null });

      const result = await createManualTransaction("Asiento Balanceado", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 1500.5, haber: 0 },
        { account_code: "4.1.1.01", debe: 0, haber: 1500.5 },
      ]);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_transactions");
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_entries");
    });

    it("debe realizar una acción de compensación (borrar cabecera) si falla la inserción de las líneas detalladas", async () => {
      // Simulamos que la inserción de la cabecera (accounting_transactions) sale bien,
      // pero la inserción de los detalles (accounting_entries) falla.
      let calls = 0;
      mockDatabase.insert = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          // Primer insert: cabecera
          return Promise.resolve({ error: null });
        } else {
          // Segundo insert: asientos detallados
          return Promise.resolve({ error: { message: "Error de clave foránea" } });
        }
      });

      // Mock para la acción de compensación delete()
      mockDatabase.eq = vi.fn().mockImplementation(() => {
        return Promise.resolve({ error: null });
      });

      const result = await createManualTransaction("Asiento con Detalle Fallido", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 500, haber: 0 },
        { account_code: "4.1.1.01", debe: 0, haber: 500 },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Error al insertar asientos contables: Error de clave foránea");
      // Debe haber llamado a borrar la cabecera huérfana
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_transactions");
      expect(mockDatabase.delete).toHaveBeenCalled();
    });

    it("debe fallar y propagar el error si el trigger de base de datos Postgres rechaza un asiento desbalanceado", async () => {
      // Simulamos que la inserción de la cabecera sale bien, pero la inserción de los detalles falla por la restricción de balance de Postgres
      let calls = 0;
      mockDatabase.insert = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          return Promise.resolve({ error: null });
        } else {
          return Promise.resolve({
            error: {
              message: "new row violates deferred trigger balance constraint trg_validar_balance_asiento"
            }
          });
        }
      });

      // Mock para la acción de compensación delete()
      mockDatabase.eq = vi.fn().mockImplementation(() => {
        return Promise.resolve({ error: null });
      });

      const result = await createManualTransaction("Asiento Rechazado por DB", "2026-05-21", [
        { account_code: "1.1.1.01", debe: 500, haber: 0 },
        { account_code: "4.1.1.01", debe: 0, haber: 500 },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("violates deferred trigger balance constraint");
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_transactions");
      expect(mockDatabase.delete).toHaveBeenCalled();
    });
  });

  describe("deleteTransaction", () => {
    it("debe eliminar una transacción contable por su ID exitosamente", async () => {
      mockDatabase.delete = vi.fn().mockImplementation(() => mockDatabase);
      mockDatabase.eq = vi.fn().mockResolvedValue({ error: null });

      const result = await deleteTransaction("TX-MANUAL-12345");

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockDatabase.from).toHaveBeenCalledWith("accounting_transactions");
      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(mockDatabase.eq).toHaveBeenCalledWith("id", "TX-MANUAL-12345");
    });

    it("debe propagar el error si falla el borrado", async () => {
      mockDatabase.delete = vi.fn().mockImplementation(() => mockDatabase);
      mockDatabase.eq = vi.fn().mockResolvedValue({ error: { message: "No se puede borrar por restricción de FK" } });

      const result = await deleteTransaction("TX-MANUAL-12345");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No se puede borrar por restricción de FK");
    });
  });
});
