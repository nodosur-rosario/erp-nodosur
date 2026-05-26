import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAuthorizedTicket } from "../services/arca-ticket-service";
import { consultarPadron } from "../services/padron-service";

const mockDatabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  upsert: vi.fn()
};

const mockSupabaseClient = {
  database: mockDatabase
};

// Mock de Supabase API
vi.mock("@/core/api/supabase", () => {
  return {
    getSupabaseClient: () => mockSupabaseClient
  };
});

describe("ARCA WSAA and WSPUC (Padrón) Service Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WSAA Ticket Service Cache logic", () => {
    it("should return cached ticket if it exists and is not expired", async () => {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 4); // Válido por 4 horas más

      mockDatabase.maybeSingle.mockResolvedValueOnce({
        data: {
          cuit: "30717762210",
          service: "wsfe",
          token: "TOKEN_CACHE_123",
          sign: "SIGN_CACHE_123",
          expired_at: expirationDate.toISOString()
        },
        error: null
      });

      const ticket = await getAuthorizedTicket("30717762210", "wsfe");

      expect(ticket.token).toBe("TOKEN_CACHE_123");
      expect(ticket.sign).toBe("SIGN_CACHE_123");
      expect(mockDatabase.upsert).not.toHaveBeenCalled();
    });

    it("should request a new ticket and update cache if cached ticket has expired", async () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // Expirado hace 1 hora

      mockDatabase.maybeSingle.mockResolvedValueOnce({
        data: {
          cuit: "30717762210",
          service: "wsfe",
          token: "TOKEN_EXPIRED",
          sign: "SIGN_EXPIRED",
          expired_at: expiredDate.toISOString()
        },
        error: null
      });

      // Mock the secondary query to arca_credentials (fall back to simulation)
      mockDatabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      mockDatabase.upsert.mockResolvedValueOnce({ error: null });

      const ticket = await getAuthorizedTicket("30717762210", "wsfe");

      expect(ticket.token).toContain("TKT_ARCA_SIM_");
      expect(ticket.sign).toContain("SIGN_ARCA_SIM_");
      expect(mockDatabase.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("WSPUC Padron Service logic", () => {
    it("should successfully retrieve registered CUIT mock data", async () => {
      // Mock ticket caching to resolve immediately
      mockDatabase.maybeSingle.mockResolvedValueOnce({
        data: {
          cuit: "30717762210",
          service: "ws_sr_padron_a4",
          token: "TOK",
          sign: "SIG",
          expired_at: new Date(Date.now() + 1000 * 60 * 60).toISOString()
        },
        error: null
      });

      const result = await consultarPadron("20304050607", "30717762210");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.razonSocial).toBe("Distribuidora Repuestos Sur S.R.L.");
      expect(result.data?.condicionIva).toBe("Responsable Inscripto");
    });

    it("should generate consistent dynamic mock data for unknown CUITs", async () => {
      mockDatabase.maybeSingle.mockResolvedValueOnce({
        data: {
          cuit: "30717762210",
          service: "ws_sr_padron_a4",
          token: "TOK",
          sign: "SIG",
          expired_at: new Date(Date.now() + 1000 * 60 * 60).toISOString()
        },
        error: null
      });

      const result = await consultarPadron("99999999999", "30717762210");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.cuit).toBe("99999999999");
      expect(result.data?.razonSocial).toBeDefined();
      expect(typeof result.data?.razonSocial).toBe("string");
      expect(result.data?.razonSocial.length).toBeGreaterThan(0);
    });
  });
});
