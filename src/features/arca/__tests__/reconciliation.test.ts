import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateLibroIvaVentasCsv, reconcileAfipCsv } from "../services/reconciliation-service";

const mockDatabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn(),
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

// Mock active CUIT cookie
vi.mock("@/core/company/company-cookies", () => {
  return {
    getActiveCuitCookie: vi.fn().mockResolvedValue("20371024094")
  };
});

describe("ARCA Sales and Account Reconciliation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateLibroIvaVentasCsv logic", () => {
    it("should return error if CUIT is missing", async () => {
      const { getActiveCuitCookie } = await import("@/core/company/company-cookies");
      vi.mocked(getActiveCuitCookie).mockResolvedValueOnce(null as any);

      const res = await generateLibroIvaVentasCsv(5, 2026);
      expect(res.error).toBe("No hay CUIT activo para generar el Libro IVA.");
      expect(res.csv).toBe("");
    });

    it("should generate a valid formatted CSV if vouchers exist", async () => {
      const mockVouchers = [
        {
          id: "0001-00000005",
          type: "Factura A",
          company_cuit: "20371024094",
          client_cuit: "30500000001",
          client_name: "Test Client S.A.",
          net_amount: 1000.0,
          iva_amount: 210.0,
          total_amount: 1210.0,
          created_at: "2026-05-15T12:00:00.000Z",
          imp_op_ex: 0.00,
          imp_tot_conc: 0.00,
          imp_trib: 0.00,
          doc_tipo: 80,
          canal: "oficial"
        }
      ];

      mockDatabase.order.mockResolvedValueOnce({
        data: mockVouchers,
        error: null
      });

      const res = await generateLibroIvaVentasCsv(5, 2026);
      expect(res.error).toBeNull();
      expect(res.csv).toContain("Fecha,Tipo Comprobante,Punto Venta,Nro Comprobante,Doc Tipo,Doc Nro");
      expect(res.csv).toContain("Test Client S.A.");
      expect(res.csv).toContain("1000.00,210.00,0.00,0.00,0.00,1210.00");
    });

    it("should return descriptive message if no vouchers are found", async () => {
      mockDatabase.order.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const res = await generateLibroIvaVentasCsv(5, 2026);
      expect(res.error).toBe("No se encontraron comprobantes emitidos en el período fiscal seleccionado.");
      expect(res.csv).toBe("");
    });
  });

  describe("reconcileAfipCsv logic", () => {
    it("should return error if CSV content is empty", async () => {
      const res = await reconcileAfipCsv("");
      expect(res.error).toBe("El archivo cargado está vacío.");
    });

    it("should cross-reference correct CAE and status match", async () => {
      const erpVouchers = [
        {
          id: "0001-00000001",
          type: "Factura A",
          company_cuit: "20371024094",
          client_cuit: "30500000001",
          client_name: "Test Client S.A.",
          total_amount: 1210.0,
          cae: "12345678901234",
          created_at: "2026-05-15T12:00:00.000Z",
          canal: "oficial"
        }
      ];

      // Mock local DB call inside reconcileAfipCsv
      mockDatabase.order.mockResolvedValueOnce({
        data: erpVouchers,
        error: null
      });


      const csvContent = 
        "Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Receptor,Nombre Receptor,Imp. Total,CAE\n" +
        "15/05/2026,Factura A,1,1,30500000001,Test Client S.A.,1210.00,12345678901234\n";

      const res = await reconcileAfipCsv(csvContent);
      expect(res.error).toBeNull();
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe("matched");
      expect(res.data[0].erp_amount).toBe(1210.0);
      expect(res.data[0].afip_amount).toBe(1210.0);
    });

    it("should flag mismatch amount when ERP and AFIP totals diverge", async () => {
      const erpVouchers = [
        {
          id: "0001-00000002",
          type: "Factura A",
          company_cuit: "20371024094",
          client_cuit: "30500000001",
          client_name: "Test Client S.A.",
          total_amount: 1500.0, // ERP says $1500
          cae: "12345678901235",
          created_at: "2026-05-15T12:00:00.000Z",
          canal: "oficial"
        }
      ];

      mockDatabase.order.mockResolvedValueOnce({
        data: erpVouchers,
        error: null
      });


      const csvContent = 
        "Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Receptor,Nombre Receptor,Imp. Total,CAE\n" +
        "15/05/2026,Factura A,1,2,30500000001,Test Client S.A.,1450.00,12345678901235\n"; // AFIP says $1450

      const res = await reconcileAfipCsv(csvContent);
      expect(res.error).toBeNull();
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe("mismatch_amount");
      expect(res.data[0].erp_amount).toBe(1500.0);
      expect(res.data[0].afip_amount).toBe(1450.0);
    });

    it("should flag missing_erp if AFIP voucher doesn't exist locally", async () => {
      mockDatabase.order.mockResolvedValueOnce({
        data: [], // Local ERP has no vouchers
        error: null
      });


      const csvContent = 
        "Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Receptor,Nombre Receptor,Imp. Total,CAE\n" +
        "15/05/2026,Factura A,1,10,30500000001,Unknown Client S.A.,2000.00,77777777777777\n";

      const res = await reconcileAfipCsv(csvContent);
      expect(res.error).toBeNull();
      // It should have 1 item which is missing in ERP
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe("missing_erp");
      expect(res.data[0].afip_amount).toBe(2000.0);
      expect(res.data[0].erp_amount).toBe(0.0);
      expect(res.data[0].cae).toBe("77777777777777");
    });

    it("should flag missing_afip if local ERP voucher was not found in AFIP file", async () => {
      const erpVouchers = [
        {
          id: "0001-00000099",
          type: "Factura A",
          company_cuit: "20371024094",
          client_cuit: "30500000001",
          client_name: "Unreported ERP Client",
          total_amount: 3000.0,
          cae: "99999999999999",
          created_at: "2026-05-15T12:00:00.000Z",
          canal: "oficial"
        }
      ];

      mockDatabase.order.mockResolvedValueOnce({
        data: erpVouchers,
        error: null
      });


      // CSV has no matching rows
      const csvContent = 
        "Fecha,Tipo,Punto de Venta,Número Desde,Nro. Doc. Receptor,Nombre Receptor,Imp. Total,CAE\n";

      const res = await reconcileAfipCsv(csvContent);
      expect(res.error).toBeNull();
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe("missing_afip");
      expect(res.data[0].erp_amount).toBe(3000.0);
      expect(res.data[0].afip_amount).toBe(0.0);
    });
  });
});
