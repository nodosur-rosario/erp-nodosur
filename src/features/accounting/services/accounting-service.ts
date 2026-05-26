"use server";

import { getSupabaseClient } from "@/core/api/supabase";
import { getActiveCuitCookie } from "@/core/company/company-cookies";

export interface AccountingAccount {
  code: string;
  name: string;
  parent_code: string | null;
  type: "activo" | "pasivo" | "patrimonio_neto" | "ingreso" | "egreso";
}

export interface AccountingEntry {
  id: number;
  transaction_id: string;
  account_code: string;
  debe: number;
  haber: number;
  accounting_accounts?: {
    name: string;
  };
}

export interface AccountingTransaction {
  id: string;
  date: string;
  description: string;
  canal?: string;
  accounting_entries?: AccountingEntry[];
}

/**
 * Fetch the complete Chart of Accounts ordered by hierarchical code.
 */
export async function getAccountingAccounts(): Promise<{
  data: AccountingAccount[];
  error: string | null;
}> {
  try {
    const cuit = await getActiveCuitCookie();
    const client = getSupabaseClient();
    let dbQuery = client.database.from("accounting_accounts").select("*");
    
    if (cuit) {
      dbQuery = dbQuery.or(`company_cuit.eq.${cuit},company_cuit.is.null`);
    } else {
      dbQuery = dbQuery.is("company_cuit", null);
    }

    const { data, error } = await dbQuery.order("code", { ascending: true });

    if (error) throw error;

    return { data: (data as AccountingAccount[]) || [], error: null };
  } catch (err: any) {
    console.error("Error in getAccountingAccounts:", err);
    return { data: [], error: err.message || "No se pudo obtener el plan de cuentas." };
  }
}

/**
 * Fetch all bookkeeping transactions unified with their ledger entries.
 */
export async function getAccountingTransactions(
  startDateISO?: string,
  endDateISO?: string
): Promise<{
  data: AccountingTransaction[];
  error: string | null;
}> {
  try {
    const cuit = await getActiveCuitCookie();
    if (!cuit) return { data: [], error: "No hay CUIT activo." };

    const client = getSupabaseClient();
    
    // Joint query using Postgrest sub-select syntax to fetch the entries and join with account name.
    let dbQuery = client.database
      .from("accounting_transactions")
      .select(`
        id,
        date,
        description,
        canal,
        accounting_entries (
          id,
          transaction_id,
          account_code,
          debe,
          haber,
          accounting_accounts (
            name
          )
        )
      `)
      .eq("company_cuit", cuit);

    if (startDateISO) {
      dbQuery = dbQuery.gte("date", startDateISO);
    }
    if (endDateISO) {
      dbQuery = dbQuery.lte("date", endDateISO);
    }

    const { data, error } = await dbQuery.order("date", { ascending: false });

    if (error) throw error;

    return { data: (data as unknown as AccountingTransaction[]) || [], error: null };
  } catch (err: any) {
    console.error("Error in getAccountingTransactions:", err);
    return { data: [], error: err.message || "No se pudieron obtener las transacciones." };
  }
}

/**
 * Create a manual accounting transaction with strict double-entry ledger validation.
 */
export async function createManualTransaction(
  description: string,
  date: string,
  entries: { account_code: string; debe: number; haber: number }[],
  companyCuit?: string,
  canal?: "oficial" | "interno"
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();
    const cuit = companyCuit || await getActiveCuitCookie();

    if (!cuit) {
      return { success: false, error: "No hay CUIT activo para registrar el asiento." };
    }

    if (!description.trim()) {
      return { success: false, error: "La descripción del asiento es obligatoria." };
    }

    if (!entries || entries.length < 2) {
      return { success: false, error: "Un asiento contable debe tener al menos dos líneas." };
    }

    // 1. Assert double-entry balance: Debe == Haber by construction
    const totalDebe = parseFloat(
      entries.reduce((sum, e) => sum + Number(e.debe || 0), 0).toFixed(2)
    );
    const totalHaber = parseFloat(
      entries.reduce((sum, e) => sum + Number(e.haber || 0), 0).toFixed(2)
    );

    const diff = Math.abs(totalDebe - totalHaber);
    if (diff > 0.01) {
      return {
        success: false,
        error: `El asiento contable no está balanceado. Diferencia de $${diff.toFixed(2)} (Total Debe: $${totalDebe.toFixed(2)}, Total Haber: $${totalHaber.toFixed(2)}).`,
      };
    }

    // Generate unique transaction header ID
    const txId = `TX-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 2. Insert header into database
    const { error: txErr } = await client.database
      .from("accounting_transactions")
      .insert([
        {
          id: txId,
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
          description: description.trim(),
          company_cuit: cuit,
          canal: canal || "oficial",
        },
      ]);

    if (txErr) throw new Error(`Error al insertar cabecera contable: ${txErr.message}`);

    // 3. Map detail entries
    const dbEntries = entries.map((e) => ({
      transaction_id: txId,
      account_code: e.account_code,
      debe: parseFloat(Number(e.debe || 0).toFixed(2)),
      haber: parseFloat(Number(e.haber || 0).toFixed(2)),
    }));

    // 4. Insert entries into database using required array-of-objects format
    const { error: entriesErr } = await client.database
      .from("accounting_entries")
      .insert(dbEntries);

    if (entriesErr) {
      // Compensating action: delete the orphaned header if entries insertion fails
      await client.database.from("accounting_transactions").delete().eq("id", txId);
      throw new Error(`Error al insertar asientos contables: ${entriesErr.message}`);
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Critical failure inside createManualTransaction:", err);
    return { success: false, error: err.message || "Error al registrar el asiento." };
  }
}

/**
 * Delete a manual or historical transaction cleanly.
 * This triggers recursive cascades in the DB for all corresponding entries.
 */
export async function deleteTransaction(
  transactionId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();

    const { error } = await client.database
      .from("accounting_transactions")
      .delete()
      .eq("id", transactionId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Error in deleteTransaction:", err);
    return { success: false, error: err.message || "No se pudo eliminar el asiento." };
  }
}
