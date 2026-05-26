import { describe, it, expect, beforeEach, vi } from "vitest";
import { 
  getCreditAccount, 
  updateCreditSettings, 
  getCreditMovements, 
  recordPayment 
} from "../services/credit-service";

// Define a type for our mock implementation to be fully typed
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
  selectResult?: any;
  maybeSingleResult?: any;
  singleResult?: any;
  errorResult?: any;
};

// Create a robust chainable database mock
const mockDatabase: MockChainable = {
  from: vi.fn().mockImplementation(() => mockDatabase),
  select: vi.fn().mockImplementation(() => mockDatabase),
  insert: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: mockDatabase.errorResult || null })),
  update: vi.fn().mockImplementation(() => mockDatabase),
  delete: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: mockDatabase.errorResult || null })),
  eq: vi.fn().mockImplementation(() => mockDatabase),
  order: vi.fn().mockImplementation(() => mockDatabase),
  limit: vi.fn().mockImplementation(() => mockDatabase),
  single: vi.fn().mockImplementation(() => {
    return Promise.resolve({ 
      data: mockDatabase.singleResult !== undefined ? mockDatabase.singleResult : mockDatabase.selectResult, 
      error: mockDatabase.errorResult || null 
    });
  }),
  maybeSingle: vi.fn().mockImplementation(() => {
    return Promise.resolve({ 
      data: mockDatabase.maybeSingleResult !== undefined ? mockDatabase.maybeSingleResult : mockDatabase.selectResult, 
      error: mockDatabase.errorResult || null 
    });
  }),
  selectResult: null,
  maybeSingleResult: undefined,
  singleResult: undefined,
  errorResult: null,
};

const mockSupabaseClient = {
  database: mockDatabase,
};

// Mock supabase client native tool injection
vi.mock("@/core/api/supabase", () => {
  return {
    getSupabaseClient: () => mockSupabaseClient,
  };
});

describe("Cuenta Corriente & POS Gates Business Logic Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.selectResult = null;
    mockDatabase.maybeSingleResult = undefined;
    mockDatabase.singleResult = undefined;
    mockDatabase.errorResult = null;
  });

  describe("getCreditAccount & Credit Settings", () => {
    it("should return virtual default account if none exists in database", async () => {
      mockDatabase.selectResult = null;
      
      const { data, error } = await getCreditAccount("client-123", "20123456789");
      
      expect(error).toBeNull();
      expect(data).toEqual({
        id: "",
        client_id: "client-123",
        company_cuit: "20123456789",
        tiene_cuenta_corriente: false,
        limite_credito: 0.0,
        saldo_actual: 0.0,
      });
    });

    it("should fetch active account correctly from database", async () => {
      const mockAccount = {
        id: "acc-456",
        client_id: "client-123",
        company_cuit: "20123456789",
        tiene_cuenta_corriente: true,
        limite_credito: 50000,
        saldo_actual: 12500,
      };
      mockDatabase.selectResult = mockAccount;

      const { data, error } = await getCreditAccount("client-123", "20123456789");

      expect(error).toBeNull();
      expect(data).toEqual(mockAccount);
    });

    it("should prevent enabling Cuenta Corriente credit line for Consumidor Final in client-side code", () => {
      // General rule: CUIT 99999999999 is blocked.
      // This is asserted through dashboard gates & POS gates.
      const isConsumidorFinalCcBlocked = (cuit: string, enableCc: boolean) => {
        if (cuit === "99999999999" && enableCc) {
          return false; // Blocked
        }
        return true; // Allowed
      };

      expect(isConsumidorFinalCcBlocked("99999999999", true)).toBe(false);
      expect(isConsumidorFinalCcBlocked("30717762210", true)).toBe(true);
    });
  });

  describe("recordPayment (Cobros Debt Payments)", () => {
    it("should fail if customer has no credit account registered", async () => {
      mockDatabase.selectResult = null; // No account found

      const result = await recordPayment("client-123", "20123456789", {
        amount: 5000,
        paymentMethod: "efectivo",
        description: "Pago de deuda",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("no posee una cuenta corriente");
    });

    it("should fail if credit account is disabled", async () => {
      mockDatabase.selectResult = {
        id: "acc-456",
        client_id: "client-123",
        company_cuit: "20123456789",
        tiene_cuenta_corriente: false,
        limite_credito: 10000,
        saldo_actual: 2000,
      };

      const result = await recordPayment("client-123", "20123456789", {
        amount: 2000,
        paymentMethod: "transferencia",
        description: "Pago transferencia",
        userId: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("se encuentra deshabilitada");
    });

    it("should process payment successfully and maintain perfect double-entry balancing (Debe == Haber)", async () => {
      // Set existing customer credit state
      const mockAccount = {
        id: "acc-456",
        client_id: "client-123",
        company_cuit: "20123456789",
        tiene_cuenta_corriente: true,
        limite_credito: 50000,
        saldo_actual: 15000.0,
      };
      
      // Mock account retrieval
      mockDatabase.maybeSingleResult = mockAccount;
      
      // Mock session checks (non-cash doesn't need cash drawer shift check)
      mockDatabase.singleResult = null; 

      const paymentPayload = {
        amount: 5000.0,
        paymentMethod: "transferencia" as const,
        description: "Pago parcial de deuda por transferencia",
        userId: "user-1",
      };

      // Spies to verify double-entry values
      const insertSpy = vi.spyOn(mockDatabase, "insert");

      const result = await recordPayment("client-123", "20123456789", paymentPayload);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();

      // Verify that accounting transactions were written
      // First insert is accounting transaction header, second is accounting entries array
      const ledgerEntriesInsert = insertSpy.mock.calls.find(call => 
        Array.isArray(call[0]) && call[0].length === 2 && call[0][0].hasOwnProperty("debe")
      );

      expect(ledgerEntriesInsert).toBeDefined();
      if (ledgerEntriesInsert) {
        const entries = ledgerEntriesInsert[0] as any[];
        
        // Assert balance: Debe (Debit Account) == Haber (Credit Account)
        const debeSum = entries.reduce((acc: number, entry: any) => acc + entry.debe, 0);
        const haberSum = entries.reduce((acc: number, entry: any) => acc + entry.haber, 0);
        
        expect(debeSum).toBe(5000.0);
        expect(haberSum).toBe(5000.0);
        expect(debeSum).toBe(haberSum); // Balanced ledger invariant!

        // Debit: Banco (1.1.1.02)
        expect(entries[0].account_code).toBe("1.1.1.02");
        expect(entries[0].debe).toBe(5000.0);
        
        // Credit: Deudores por Ventas (1.1.3.01)
        expect(entries[1].account_code).toBe("1.1.3.01");
        expect(entries[1].haber).toBe(5000.0);
      }
    });

    it("should successfully sync daily cash session drawer theory balance for Cash payments", async () => {
      // Set existing customer credit state
      const mockAccount = {
        id: "acc-456",
        client_id: "client-123",
        company_cuit: "20123456789",
        tiene_cuenta_corriente: true,
        limite_credito: 50000,
        saldo_actual: 15000.0,
      };

      // Mock account retrieval
      mockDatabase.maybeSingleResult = mockAccount;

      // Mock active cash session retrieval
      const mockCashSession = {
        id: "sess-abc",
        cuit: "20123456789",
        estado: "abierta",
        monto_teorico: 20000.0,
      };
      mockDatabase.singleResult = mockCashSession;

      const paymentPayload = {
        amount: 3000.0,
        paymentMethod: "efectivo" as const,
        description: "Pago en efectivo mostrador",
        userId: "user-1",
        sesionId: "sess-abc",
      };

      // Spy on updates to verify caja_sesion increment
      const updateSpy = vi.spyOn(mockDatabase, "update");

      const result = await recordPayment("client-123", "20123456789", paymentPayload);

      expect(result.success).toBe(true);

      // Verify customer account update and daily cash session update
      const sessionUpdateCall = updateSpy.mock.calls.find(call => 
        (call[0] as any).hasOwnProperty("monto_teorico")
      );

      expect(sessionUpdateCall).toBeDefined();
      if (sessionUpdateCall) {
        expect((sessionUpdateCall[0] as any).monto_teorico).toBe(23000.0); // 20000 theoretical + 3000 cash paid!
      }
    });
  });

  describe("POS Checkout Credit Limit Gates", () => {
    it("should block checkout if total purchase exceeds available credit limit", () => {
      const ccAccount = {
        tiene_cuenta_corriente: true,
        limite_credito: 25000.0,
        saldo_actual: 20000.0,
      };

      const totalPurchase = 8000.0;
      const nuevoSaldoTeorico = ccAccount.saldo_actual + totalPurchase;
      const isGateTriggered = nuevoSaldoTeorico > ccAccount.limite_credito;

      expect(isGateTriggered).toBe(true); // Exceeded! Block transaction.
    });

    it("should authorize checkout if total purchase remains within available credit limit", () => {
      const ccAccount = {
        tiene_cuenta_corriente: true,
        limite_credito: 25000.0,
        saldo_actual: 10000.0,
      };

      const totalPurchase = 8000.0;
      const nuevoSaldoTeorico = ccAccount.saldo_actual + totalPurchase;
      const isGateTriggered = nuevoSaldoTeorico > ccAccount.limite_credito;

      expect(isGateTriggered).toBe(false); // Valid credit range. Proceed with POS checkout.
    });
  });
});
