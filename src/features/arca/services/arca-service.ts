import { getSupabaseClient } from "@/core/api/supabase";
import { decryptPrivateKey } from "./arca-crypto";
import { getAuthorizedTicket } from "./arca-ticket-service";
import * as soap from "soap";
import { retry, handleAll, ExponentialBackoff, circuitBreaker, ConsecutiveBreaker } from "cockatiel";

export interface InvoicePayload {
  tipo_cbte: number; // 1 = Factura A, 6 = Factura B, 11 = Factura C
  punto_venta?: number;
  doc_tipo: number; // 80 = CUIT, 96 = DNI, 99 = Consumidor Final
  doc_nro: string;
  imp_neto: number;
  imp_iva: number;
  imp_total: number;
  iva_alicuotas: Array<{
    id: number; // 5 = 21%, 4 = 10.5%, etc.
    base_imp: number;
    importe: number;
  }>;
  condicion_iva_receptor?: number; // 1 = RI, 5 = Consumidor Final, 6 = Monotributista, etc. (RG 5616)
}

export interface FiscalAuthorizationResult {
  success: boolean;
  cae: string;
  cae_vencimiento: string;
  cbte_nro: number;
  qr_url: string;
  error?: string;
}

const WSDL_WSFE_HOMO = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL";
const WSDL_WSFE_PROD = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL";

/**
 * Main Dynamic Fiscal Adapter. Resolves configuration per company CUIT
 * and routes to the local SOAP Simulator or real WSAA/WSFE network channels.
 */
export async function authorizeInvoice(
  payload: InvoicePayload,
  companyCuit: string
): Promise<FiscalAuthorizationResult> {
  try {
    const client = getSupabaseClient();
    
    // 1. Fetch company credentials
    const { data: creds, error: dbErr } = await client.database
      .from("arca_credentials")
      .select("*")
      .eq("company_cuit", companyCuit)
      .maybeSingle();
      
    if (dbErr) throw dbErr;
    
    if (!creds || !creds.certificate) {
      return {
        success: false,
        cae: "",
        cae_vencimiento: "",
        cbte_nro: 0,
        qr_url: "",
        error: "El módulo fiscal de ARCA no se encuentra configurado para esta distribuidora."
      };
    }
    
    const ptoVta = payload.punto_venta || creds.punto_venta || 1;
    const environment = creds.environment || "simulation";
    
    // 2. Dynamic Route Resolution
    if (environment === "simulation") {
      // Route directly to our lightning-fast local WSFE simulation API
      const requestPayload = {
        cuit: companyCuit,
        tipo_cbte: payload.tipo_cbte,
        punto_venta: ptoVta,
        doc_tipo: payload.doc_tipo,
        doc_nro: payload.doc_nro,
        imp_neto: payload.imp_neto,
        imp_iva: payload.imp_iva,
        imp_total: payload.imp_total,
        iva_alicuotas: payload.iva_alicuotas
      };
      
      // Determine the absolute or relative API host safely
      const apiHost = typeof window !== "undefined" 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        
      const response = await fetch(`${apiHost}/api/arca-simulator/wsfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });
      
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Falla en el simulador local de facturas.");
      }
      
      const result = await response.json();
      return {
        success: true,
        cae: result.cae,
        cae_vencimiento: result.cae_vencimiento,
        cbte_nro: result.cbte_nro,
        qr_url: result.qr_url
      };
    } else {
      // REAL Homologation or Production Mode
      console.log(`[WSFE ARCA] Iniciando flujo de facturación física (${environment}) para CUIT Emisor ${companyCuit}...`);
      
      // 1. WSAA Authentication Caching & Ticket Lookup para el servicio 'wsfe'
      const ticket = await getAuthorizedTicket(companyCuit, "wsfe");
      const wsdlUrl = environment === "production" ? WSDL_WSFE_PROD : WSDL_WSFE_HOMO;
      
      // 2. Crear cliente SOAP de WSFE con resiliencia y caché singleton
      const soapClient = await getCachedSoapClient(wsdlUrl);
      
      // 3. Consultar correlatividad con FECompUltimoAutorizado para evitar colisiones
      const ultimoParams = {
        Auth: {
          Token: ticket.token,
          Sign: ticket.sign,
          Cuit: companyCuit
        },
        CbteTipo: payload.tipo_cbte,
        PtoVta: ptoVta
      };
      
      console.log(`[WSFE ARCA] Consultando último número de comprobante para Pto Vta ${ptoVta} y Tipo ${payload.tipo_cbte}...`);
      
      const ultimoResult = await soapRetryPolicy.execute(() =>
        new Promise<any>((resolve, reject) => {
          soapClient.FECompUltimoAutorizado(ultimoParams, (err: any, res: any) => {
            if (err) reject(err);
            else resolve(res);
          });
        })
      );
      
      if (!ultimoResult || !ultimoResult.FECompUltimoAutorizadoResult) {
        throw new Error("La respuesta de ARCA al consultar último comprobante es nula.");
      }
      
      const ultimoRes = ultimoResult.FECompUltimoAutorizadoResult;
      if (ultimoRes.Errors && ultimoRes.Errors.Err) {
        const errors = Array.isArray(ultimoRes.Errors.Err) ? ultimoRes.Errors.Err : [ultimoRes.Errors.Err];
        throw new Error(`AFIP Error al obtener secuencial: ${errors.map((e: any) => `${e.Code} - ${e.Msg}`).join("; ")}`);
      }
      
      const nextCbteNro = (ultimoRes.CbteNro || 0) + 1;
      console.log(`[WSFE ARCA] Siguiente número correlativo oficial de AFIP a autorizar: ${nextCbteNro}`);
      
      // 4. Formatear fechas y alícuotas para FECAESolicitar
      const formatAfipDate = (d: Date) => d.toISOString().substring(0, 10).replace(/-/g, ""); // YYYYMMDD
      
      const caeParams = {
        Auth: {
          Token: ticket.token,
          Sign: ticket.sign,
          Cuit: companyCuit
        },
        FeCAEReq: {
          FeCabReq: {
            CantReg: 1,
            PtoVta: ptoVta,
            CbteTipo: payload.tipo_cbte
          },
          FeDetReq: {
            FECAEDetRequest: [
              {
                Concepto: 1, // 1 = Productos
                DocTipo: payload.doc_tipo,
                DocNro: payload.doc_nro,
                CbteDesde: nextCbteNro,
                CbteHasta: nextCbteNro,
                CbteFch: formatAfipDate(new Date()),
                ImpTotal: payload.imp_total,
                ImpTotConc: 0, // Importe no gravado
                ImpNeto: payload.imp_neto,
                ImpOpEx: 0, // Importe exento
                ImpTrib: 0, // Importe de tributos/percepciones
                ImpIVA: payload.imp_iva,
                MonId: "PES", // Pesos Argentinos
                MonCotiz: 1,
                CondicionIVAReceptorId: payload.condicion_iva_receptor || 5, // Condición frente al IVA del receptor (RG 5616)
                Iva: payload.iva_alicuotas && payload.iva_alicuotas.length > 0 ? {
                  AlicIva: payload.iva_alicuotas.map(al => ({
                    Id: al.id,
                    BaseImp: al.base_imp,
                    Importe: al.importe
                  }))
                } : null
              }
            ]
          }
        }
      };
      
      console.log(`[WSFE ARCA] Solicitando CAE para comprobante Nº ${nextCbteNro}...`);
      
      const caeResult = await soapRetryPolicy.execute(() =>
        new Promise<any>((resolve, reject) => {
          soapClient.FECAESolicitar(caeParams, (err: any, res: any) => {
            if (err) reject(err);
            else resolve(res);
          });
        })
      );
      
      if (!caeResult || !caeResult.FECAESolicitarResult) {
        throw new Error("La respuesta de ARCA al solicitar el CAE es nula.");
      }
      
      const solicitudResult = caeResult.FECAESolicitarResult;
      
      // Control de errores de nivel general de AFIP
      if (solicitudResult.Errors && solicitudResult.Errors.Err) {
        const errors = Array.isArray(solicitudResult.Errors.Err) ? solicitudResult.Errors.Err : [solicitudResult.Errors.Err];
        throw new Error(`AFIP Error: ${errors.map((e: any) => `${e.Code} - ${e.Msg}`).join("; ")}`);
      }
      
      const detResult = solicitudResult.FeDetResp?.FECAEDetResponse?.[0];
      
      if (!detResult || detResult.Resultado === "R") {
        const obsMsg = detResult?.Observaciones?.Obs
          ? (Array.isArray(detResult.Observaciones.Obs) 
              ? detResult.Observaciones.Obs 
              : [detResult.Observaciones.Obs]
            ).map((o: any) => `${o.Code} - ${o.Msg}`).join("; ")
          : "Comprobante rechazado sin observaciones adicionales.";
        throw new Error(`AFIP Rechazó la factura: ${obsMsg}`);
      }
      
      const cae = detResult.CAE;
      const caeExpirationRaw = detResult.CAEFchVto; // Formato YYYYMMDD
      
      // Formatear fecha de vencimiento a ISO 8601
      let caeExpiration = "";
      if (caeExpirationRaw && caeExpirationRaw.length === 8) {
        caeExpiration = `${caeExpirationRaw.substring(0, 4)}-${caeExpirationRaw.substring(4, 6)}-${caeExpirationRaw.substring(6, 8)}T23:59:59Z`;
      } else {
        caeExpiration = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      // 5. Compilar modelo de datos QR Oficial de AFIP (RG 4892)
      const qrData = {
        ver: 1,
        fecha: new Date().toISOString().split("T")[0],
        cuit: Number(companyCuit),
        ptoVta: Number(ptoVta),
        tipoCmp: Number(payload.tipo_cbte),
        nroCmp: nextCbteNro,
        importe: Number(payload.imp_total.toFixed(2)),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: Number(payload.doc_tipo || 99),
        nroDocRec: Number(payload.doc_nro || 0),
        tipoCodAut: "A",
        codAut: cae
      };
      
      const qrDataBase64 = Buffer.from(JSON.stringify(qrData)).toString("base64");
      const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrDataBase64}`;
      
      console.log(`[WSFE ARCA] Facturación exitosa en Homologación. CAE: ${cae}, Nro: ${nextCbteNro}`);
      
      return {
        success: true,
        cae: cae,
        cae_vencimiento: caeExpiration,
        cbte_nro: nextCbteNro,
        qr_url: qrUrl
      };
    }
  } catch (err: any) {
    console.error("Critical failure inside ARCA authorizeInvoice service:", err);
    return {
      success: false,
      cae: "",
      cae_vencimiento: "",
      cbte_nro: 0,
      qr_url: "",
      error: err.message || "Failed to authorize fiscal invoice."
    };
  }
}

const soapClientsCache = new Map<string, any>();

// Resilient SOAP client loader with backoff retry
export const soapRetryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({ initialDelay: 1000, maxDelay: 5000 })
});

export const soapCircuitBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 15000,
  breaker: new ConsecutiveBreaker(5),
});

export async function getCachedSoapClient(wsdlUrl: string): Promise<any> {
  if (soapClientsCache.has(wsdlUrl)) {
    return soapClientsCache.get(wsdlUrl);
  }
  
  const client = await soapRetryPolicy.execute(() =>
    soapCircuitBreaker.execute(() => createSoapClientAsync(wsdlUrl))
  );
  
  soapClientsCache.set(wsdlUrl, client);
  return client;
}

/**
 * Encapsulador asincrónico para inicialización de clientes SOAP.
 */
function createSoapClientAsync(wsdlUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    soap.createClient(wsdlUrl, (err, client) => {
      if (err) reject(err);
      else resolve(client);
    });
  });
}
