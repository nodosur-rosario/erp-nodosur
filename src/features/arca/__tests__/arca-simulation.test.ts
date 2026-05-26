import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { authorizeInvoice } from "../services/arca-service";

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

// Mock supabase client
vi.mock("@/core/api/supabase", () => {
  return {
    getSupabaseClient: () => mockSupabaseClient,
  };
});

// Mock node-forge cryptographical tools to isolate unit tests completely and silently
vi.mock("node-forge", () => {
  const mockCert = {
    subject: { getField: () => ({ value: "30717762210" }) }
  };
  const mockPrivateKey = {};
  
  const mockPkcs7 = {
    content: null,
    addCertificate: vi.fn(),
    addSigner: vi.fn(),
    sign: vi.fn(),
    toAsn1: vi.fn().mockReturnValue({
      getBytes: vi.fn().mockReturnValue("mock-der-bytes")
    })
  };

  return {
    default: {
      pki: {
        certificateFromPem: vi.fn().mockReturnValue(mockCert),
        privateKeyFromPem: vi.fn().mockReturnValue(mockPrivateKey),
        oids: {
          sha256: "2.16.840.1.101.3.4.2.1",
          contentType: "1.2.840.113549.1.9.3",
          data: "1.2.840.113549.1.7.1",
          messageDigest: "1.2.840.113549.1.9.4",
          signingTime: "1.2.840.113549.1.9.5"
        }
      },
      pkcs7: {
        createSignedData: vi.fn().mockReturnValue(mockPkcs7)
      },
      asn1: {
        toDer: vi.fn().mockReturnValue({
          getBytes: vi.fn().mockReturnValue("mock-der-bytes")
        })
      },
      util: {
        createBuffer: vi.fn().mockReturnValue({
          getBytes: vi.fn().mockReturnValue("mock-bytes")
        }),
        encode64: vi.fn().mockReturnValue("mock-cms-base64-encoded")
      }
    }
  };
});

describe("ARCA Fiscal Simulation and Adapter Service Tests", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase.selectResult = null;
    mockDatabase.maybeSingleResult = undefined;
    mockDatabase.singleResult = undefined;
    mockDatabase.errorResult = null;
    
    // Stub global fetch
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    // Restore fetch
    vi.unstubAllGlobals();
  });

  it("should fail gracefully if ARCA credentials are not configured in the database", async () => {
    // No credentials in db
    mockDatabase.maybeSingleResult = null;

    const payload = {
      tipo_cbte: 1, // Factura A
      doc_tipo: 80, // CUIT
      doc_nro: "20123456789",
      imp_neto: 1000.0,
      imp_iva: 210.0,
      imp_total: 1210.0,
      iva_alicuotas: [
        { id: 5, base_imp: 1000.0, importe: 210.0 }
      ]
    };

    const result = await authorizeInvoice(payload, "30717762210");

    expect(result.success).toBe(false);
    expect(result.cae).toBe("");
    expect(result.error).toContain("no se encuentra configurado");
  });

  it("should successfully authorize invoice via local simulation route when environment is 'simulation'", async () => {
    // Setup credentials in DB with simulation mode
    mockDatabase.maybeSingleResult = {
      id: "cred-123",
      company_cuit: "30717762210",
      certificate: "-----BEGIN CERTIFICATE-----\nMOCKCERT\n-----END CERTIFICATE-----",
      punto_venta: 2,
      environment: "simulation",
      private_key: "mockencryptedkey:tag:ciphertext"
    };

    // Mock fetch simulator endpoint response
    const mockSimulationResponse = {
      success: true,
      cae: "CAESIM307177622100199991234",
      cae_vencimiento: "2026-06-05T00:00:00.000Z",
      cbte_nro: 15,
      qr_url: "https://www.afip.gob.ar/fe/qr/?p=eyV..."
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSimulationResponse
    });

    const payload = {
      tipo_cbte: 1, // Factura A
      doc_tipo: 80, // CUIT
      doc_nro: "20123456789",
      imp_neto: 1000.0,
      imp_iva: 210.0,
      imp_total: 1210.0,
      iva_alicuotas: [
        { id: 5, base_imp: 1000.0, importe: 210.0 }
      ]
    };

    const result = await authorizeInvoice(payload, "30717762210");

    expect(result.success).toBe(true);
    expect(result.cae).toBe("CAESIM307177622100199991234");
    expect(result.cae_vencimiento).toBe("2026-06-05T00:00:00.000Z");
    expect(result.cbte_nro).toBe(15);
    expect(result.qr_url).toBe("https://www.afip.gob.ar/fe/qr/?p=eyV...");
    expect(result.error).toBeUndefined();

    // Verify fetch call parameters
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchUrl).toContain("/api/arca-simulator/wsfe");
    expect(fetchOptions.method).toBe("POST");
    
    const body = JSON.parse(fetchOptions.body);
    expect(body.cuit).toBe("30717762210");
    expect(body.tipo_cbte).toBe(1);
    expect(body.punto_venta).toBe(2); // Resolved from credentials
    expect(body.imp_total).toBe(1210.0);
  });

  it("should fail and block when environment is 'production' or 'homologation' with invalid certificate credentials", async () => {
    // Setup credentials in DB with real production environment
    mockDatabase.maybeSingleResult = {
      id: "cred-123",
      company_cuit: "30717762210",
      certificate: "-----BEGIN CERTIFICATE-----\nMOCKCERT\n-----END CERTIFICATE-----",
      punto_venta: 2,
      environment: "production",
      // Seed dummy encrypted key that decryptPrivateKey doesn't crash on (has fallback for test environments if needed, or we mock decryptPrivateKey)
      private_key: "0123456789abcdef0123456789abcdef:0123456789abcdef:0123456789abcdef"
    };

    // Mock cryptography helper to bypass real decryption complexity for production test
    vi.mock("../services/arca-crypto", () => {
      return {
        encryptPrivateKey: (key: string) => "encrypted",
        decryptPrivateKey: (encrypted: string) => "decrypted-key"
      };
    });

    // Mock fetch for WSAA login ticket request to fail realistically with HTTP 500
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Simulated WSAA physical connection failure for test"
    });

    const payload = {
      tipo_cbte: 1, // Factura A
      doc_tipo: 80, // CUIT
      doc_nro: "20123456789",
      imp_neto: 1000.0,
      imp_iva: 210.0,
      imp_total: 1210.0,
      iva_alicuotas: [
        { id: 5, base_imp: 1000.0, importe: 210.0 }
      ]
    };

    const result = await authorizeInvoice(payload, "30717762210");

    expect(result.success).toBe(false);
    expect(result.cae).toBe("");
    expect(result.error).toContain("Falla en WSAA");
  });
});
