"use server";

import { authorizeInvoice as authorizeInvoiceService, InvoicePayload, FiscalAuthorizationResult } from "./services/arca-service";
import { 
  generateLibroIvaVentasCsv as generateLibroIvaVentasCsvService,
  reconcileAfipCsv as reconcileAfipCsvService,
  ReconciliationComparisonRow
} from "./services/reconciliation-service";

export type { ReconciliationComparisonRow };


/**
 * Next.js Server Action wrapper for authorizeInvoice.
 * Bypasses webpack client-side bundling of server-only modules ('fs', 'soap', etc.).
 */
export async function authorizeInvoice(
  payload: InvoicePayload,
  companyCuit: string
): Promise<FiscalAuthorizationResult> {
  return authorizeInvoiceService(payload, companyCuit);
}

/**
 * Next.js Server Action wrapper to generate Libro IVA Ventas.
 */
export async function generateLibroIvaVentas(
  month: number,
  year: number
): Promise<{ csv: string; error: string | null }> {
  return generateLibroIvaVentasCsvService(month, year);
}

/**
 * Next.js Server Action wrapper to reconcile AFIP Mis Comprobantes CSV.
 */
export async function reconcileAfip(
  csvContent: string
): Promise<{ data: ReconciliationComparisonRow[]; error: string | null }> {
  return reconcileAfipCsvService(csvContent);
}
