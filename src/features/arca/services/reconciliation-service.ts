"use server";

import { getSupabaseClient } from "@/core/api/supabase";
import { getActiveCuitCookie } from "@/core/company/company-cookies";

export interface IvaBreakdownItem {
  alicuota_id: number; // 5 = 21%, 4 = 10.5%, etc.
  base_imp: number;
  importe: number;
}

export interface ReconciliationComparisonRow {
  id: string;
  cae: string;
  type: string;
  client_cuit: string;
  client_name: string;
  erp_amount: number;
  afip_amount: number;
  status: "matched" | "mismatch_amount" | "missing_erp" | "missing_afip";
  date: string;
}

/**
 * Generates an official-looking CSV representation of the Libro IVA Ventas
 * complying with Argentinian fiscal reporting requirements.
 */
export async function generateLibroIvaVentasCsv(
  month: number,
  year: number
): Promise<{ csv: string; error: string | null }> {
  try {
    const cuit = await getActiveCuitCookie();
    if (!cuit) return { csv: "", error: "No hay CUIT activo para generar el Libro IVA." };

    const client = getSupabaseClient();
    
    // Calculate start and end bounds of the target month
    const startIso = new Date(year, month - 1, 1, 0, 0, 0).toISOString();
    const endIso = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const { data: vouchers, error: dbErr } = await client.database
      .from("arca_vouchers")
      .select("*")
      .eq("company_cuit", cuit)
      .eq("canal", "oficial")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true });

    if (dbErr) throw dbErr;

    if (!vouchers || vouchers.length === 0) {
      return { csv: "", error: "No se encontraron comprobantes emitidos en el período fiscal seleccionado." };
    }

    // Build the CSV headers in typical Argentinian accounting layout
    let csv = "Fecha,Tipo Comprobante,Punto Venta,Nro Comprobante,Doc Tipo,Doc Nro,Cliente,Neto Gravado ($),IVA Liquido ($),Exento ($),No Gravado ($),Percepciones IIBB ($),Total ($)\n";

    vouchers.forEach((v: any /* Fila de comprobante AFIP proveniente de base de datos */) => {
      const fecha = new Date(v.created_at).toLocaleDateString("es-AR");
      
      // Parse ID to retrieve Punto Venta and Number
      const parts = v.id.split("-");
      const ptoVtaStr = parts[0] ? parts[0].replace(/\D/g, "") : "1";
      const cbteNroStr = parts[1] ? parts[1].replace(/\D/g, "") : "0";

      // Parse tax columns (supporting newly migrated fields dynamically)
      const neto = Number(v.net_amount || 0).toFixed(2);
      const iva = Number(v.iva_amount || 0).toFixed(2);
      const exento = Number(v.imp_op_ex || 0).toFixed(2);
      const noGravado = Number(v.imp_tot_conc || 0).toFixed(2);
      const percepciones = Number(v.imp_trib || 0).toFixed(2);
      const total = Number(v.total_amount || 0).toFixed(2);

      // Clean client name of any commas to protect CSV format integrity
      const cleanedClient = v.client_name ? v.client_name.replace(/,/g, " ") : "Consumidor Final";
      const docTipoCode = v.doc_tipo || (v.client_cuit && v.client_cuit.length === 11 ? 80 : 99);

      csv += `${fecha},${v.type},${ptoVtaStr},${cbteNroStr},${docTipoCode},${v.client_cuit},${cleanedClient},${neto},${iva},${exento},${noGravado},${percepciones},${total}\n`;
    });

    return { csv, error: null };
  } catch (err: any) {
    console.error("Error generating Libro IVA Ventas CSV:", err);
    return { csv: "", error: err.message || "Failed to generate Libro IVA." };
  }
}

/**
 * Cross-references imported AFIP "Mis Comprobantes" data against afip_vouchers
 * to yield a strict audit semaphor comparison report.
 */
export async function reconcileAfipCsv(
  csvContent: string
): Promise<{ data: ReconciliationComparisonRow[]; error: string | null }> {
  try {
    const cuit = await getActiveCuitCookie();
    if (!cuit) return { data: [], error: "No hay CUIT activo para conciliar." };

    if (!csvContent || csvContent.trim() === "") {
      return { data: [], error: "El archivo cargado está vacío." };
    }

    const client = getSupabaseClient();

    // 1. Fetch all local vouchers for this company to cross-reference dynamically
    const { data: erpVouchers, error: dbErr } = await client.database
      .from("arca_vouchers")
      .select("*")
      .eq("company_cuit", cuit)
      .eq("canal", "oficial")
      .order("created_at", { ascending: true });


    if (dbErr) throw dbErr;

    const erpMapByCae = new Map<string, any>();
    const erpMapById = new Map<string, any>();

    (erpVouchers || []).forEach((v: any /* Fila de comprobante AFIP proveniente de base de datos */) => {
      if (v.cae) erpMapByCae.set(v.cae.trim(), v);
      erpMapById.set(v.id.trim(), v);
    });

    // 2. Parse the CSV rows
    // Supported columns: Fecha, Tipo, Punto de Venta, Número Desde, Nro. Doc. Receptor, Nombre Receptor, Imp. Total, CAE
    const lines = csvContent.split("\n");
    const comparisonRows: ReconciliationComparisonRow[] = [];
    const matchedErpIds = new Set<string>();

    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "") continue;

      // Handle CSV headers
      if (i === 0 || line.toLowerCase().includes("fecha") || line.toLowerCase().includes("cae")) {
        headers = line.split(",").map(h => h.trim().toLowerCase().replace(/['"]+/g, ""));
        continue;
      }

      const cols = line.split(",").map(c => c.trim().replace(/['"]+/g, ""));
      if (cols.length < 5) continue;

      // Map dynamic header indices safely
      const getVal = (possibleHeaders: string[], fallbackIdx: number) => {
        const found = headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));
        return found !== -1 ? cols[found] : cols[fallbackIdx];
      };

      const dateStr = getVal(["fecha"], 0);
      const typeStr = getVal(["tipo", "comprobante"], 1);
      const ptoVta = getVal(["punto", "vta"], 2);
      const nro = getVal(["número", "nro", "numero"], 3);
      const receptorDoc = getVal(["doc", "documento", "cuit", "cuim"], 4);
      const receptorName = getVal(["nombre", "razon", "receptor"], 5);
      const totalStr = getVal(["total", "importe"], 6);
      const caeStr = getVal(["cae"], 7);

      if (!caeStr) continue;

      const afipTotal = parseFloat(totalStr || "0") || 0;
      const cleanCae = caeStr.trim();

      // Formulate theoretical ID match e.g. 0001-00000005
      const formattedPtoVta = ptoVta ? ptoVta.padStart(4, "0") : "0001";
      const formattedNro = nro ? nro.padStart(8, "0") : "00000000";
      const erpIdMatch = `000${Number(formattedPtoVta)}-${formattedNro}`;

      // Cross check against local maps
      const matchedVoucher = erpMapByCae.get(cleanCae) || erpMapById.get(erpIdMatch);

      if (matchedVoucher) {
        matchedErpIds.add(matchedVoucher.id);
        const erpTotal = Number(matchedVoucher.total_amount);
        const diff = Math.abs(erpTotal - afipTotal);
        
        comparisonRows.push({
          id: matchedVoucher.id,
          cae: cleanCae,
          type: matchedVoucher.type,
          client_cuit: matchedVoucher.client_cuit,
          client_name: matchedVoucher.client_name,
          erp_amount: erpTotal,
          afip_amount: afipTotal,
          status: diff < 0.05 ? "matched" : "mismatch_amount",
          date: dateStr || new Date(matchedVoucher.created_at).toLocaleDateString("es-AR")
        });
      } else {
        // Missing in local ERP (exists on AFIP but not locally)
        comparisonRows.push({
          id: erpIdMatch,
          cae: cleanCae,
          type: typeStr || "Factura",
          client_cuit: receptorDoc || "99999999999",
          client_name: receptorName || "Consumidor Final",
          erp_amount: 0,
          afip_amount: afipTotal,
          status: "missing_erp",
          date: dateStr || "—"
        });
      }
    }

    // 3. Find vouchers that exist in ERP but are missing in AFIP imported records
    (erpVouchers || []).forEach((v: any /* Fila de comprobante AFIP proveniente de base de datos */) => {
      if (!matchedErpIds.has(v.id)) {
        comparisonRows.push({
          id: v.id,
          cae: v.cae || "—",
          type: v.type,
          client_cuit: v.client_cuit,
          client_name: v.client_name,
          erp_amount: Number(v.total_amount),
          afip_amount: 0,
          status: "missing_afip",
          date: new Date(v.created_at).toLocaleDateString("es-AR")
        });
      }
    });

    return { data: comparisonRows, error: null };
  } catch (err: any) {
    console.error("Error in reconcileAfipCsv:", err);
    return { data: [], error: err.message || "Failed to reconcile AFIP CSV data." };
  }
}
