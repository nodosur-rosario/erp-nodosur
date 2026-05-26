"use server";

import { getSupabaseClient } from "@/core/api/supabase";

export interface CreditAllocation {
  id: string;
  company_cuit: string;
  debit_movement_id: string;
  credit_movement_id: string;
  amount_allocated: number;
  created_at: string;
}

export interface AllocatedMovementRow {
  id: string;
  credit_account_id: string;
  type: "debito" | "credito";
  amount: number;
  description: string;
  created_at: string;
  allocated_amount: number;
  remaining_amount: number;
}

/**
 * Fetches all allocations for a given company CUIT.
 */
export async function getCompanyAllocations(
  companyCuit: string
): Promise<{ data: CreditAllocation[]; error: string | null }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.database
      .from("customer_credit_allocations")
      .select("*")
      .eq("company_cuit", companyCuit);

    if (error) throw error;
    return { data: (data as CreditAllocation[]) || [], error: null };
  } catch (err: any) {
    console.error("Error in getCompanyAllocations:", err);
    return { data: [], error: err.message || "Failed to fetch allocations" };
  }
}

/**
 * Fetches active/pending debit and credit movements for a credit account,
 * computing their allocated and remaining balances.
 */
export async function getUnallocatedMovements(
  creditAccountId: string,
  companyCuit: string
): Promise<{
  debits: AllocatedMovementRow[];
  credits: AllocatedMovementRow[];
  error: string | null;
}> {
  try {
    const client = getSupabaseClient();

    // 1. Fetch all movements for the account
    const { data: movements, error: movErr } = await client.database
      .from("customer_credit_movements")
      .select("*")
      .eq("credit_account_id", creditAccountId)
      .order("created_at", { ascending: false });

    if (movErr) throw movErr;

    if (!movements || movements.length === 0) {
      return { debits: [], credits: [], error: null };
    }

    // 2. Fetch all allocations for this company CUIT
    const { data: allocations, error: allocErr } = await client.database
      .from("customer_credit_allocations")
      .select("*")
      .eq("company_cuit", companyCuit);

    if (allocErr) throw allocErr;

    const allocs = (allocations as CreditAllocation[]) || [];

    // Sum allocations by debit and credit movement IDs
    const debitAllocMap = new Map<string, number>();
    const creditAllocMap = new Map<string, number>();

    allocs.forEach((a) => {
      const debitId = a.debit_movement_id;
      const creditId = a.credit_movement_id;
      const amt = Number(a.amount_allocated);

      debitAllocMap.set(debitId, (debitAllocMap.get(debitId) || 0) + amt);
      creditAllocMap.set(creditId, (creditAllocMap.get(creditId) || 0) + amt);
    });

    const debits: AllocatedMovementRow[] = [];
    const credits: AllocatedMovementRow[] = [];

    movements.forEach((m: any /* Fila de movimiento de la base de datos Supabase */) => {
      const amt = Number(m.amount);
      if (m.type === "debito") {
        const allocated = debitAllocMap.get(m.id) || 0;
        const remaining = Math.max(0, parseFloat((amt - allocated).toFixed(2)));
        debits.push({
          id: m.id,
          credit_account_id: m.credit_account_id,
          type: "debito",
          amount: amt,
          description: m.description,
          created_at: m.created_at || "",
          allocated_amount: allocated,
          remaining_amount: remaining,
        });
      } else {
        const allocated = creditAllocMap.get(m.id) || 0;
        const remaining = Math.max(0, parseFloat((amt - allocated).toFixed(2)));
        credits.push({
          id: m.id,
          credit_account_id: m.credit_account_id,
          type: "credito",
          amount: amt,
          description: m.description,
          created_at: m.created_at || "",
          allocated_amount: allocated,
          remaining_amount: remaining,
        });
      }
    });

    return { debits, credits, error: null };
  } catch (err: any) {
    console.error("Error in getUnallocatedMovements:", err);
    return { debits: [], credits: [], error: err.message || "Failed to fetch and calculate unallocated movements" };
  }
}

/**
 * Atomically allocates a credit movement amount towards a debit movement debt.
 */
export async function createCreditAllocation(
  companyCuit: string,
  debitMovementId: string,
  creditMovementId: string,
  amountToAllocate: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();
    const cleanAmount = parseFloat(amountToAllocate.toFixed(2));

    if (cleanAmount <= 0) {
      return { success: false, error: "El monto a imputar debe ser mayor a cero." };
    }

    // 1. Fetch details of both movements to ensure they exist and have enough remaining balance
    const { data: debitMov, error: dErr } = await client.database
      .from("customer_credit_movements")
      .select("*")
      .eq("id", debitMovementId)
      .single();

    if (dErr || !debitMov) {
      return { success: false, error: "No se encontró el movimiento de débito (deuda)." };
    }

    const { data: creditMov, error: cErr } = await client.database
      .from("customer_credit_movements")
      .select("*")
      .eq("id", creditMovementId)
      .single();

    if (cErr || !creditMov) {
      return { success: false, error: "No se encontró el movimiento de crédito (cobro/saldo a favor)." };
    }

    if (debitMov.credit_account_id !== creditMov.credit_account_id) {
      return { success: false, error: "Los movimientos no pertenecen a la misma cuenta corriente." };
    }

    // 2. Fetch existing allocations to calculate remaining balances
    const { data: existingAllocs, error: allocsErr } = await client.database
      .from("customer_credit_allocations")
      .select("*")
      .eq("company_cuit", companyCuit);

    if (allocsErr) throw allocsErr;

    const allocs = (existingAllocs as CreditAllocation[]) || [];

    const totalDebitAllocated = allocs
      .filter((a) => a.debit_movement_id === debitMovementId)
      .reduce((sum, a) => sum + Number(a.amount_allocated), 0);

    const totalCreditAllocated = allocs
      .filter((a) => a.credit_movement_id === creditMovementId)
      .reduce((sum, a) => sum + Number(a.amount_allocated), 0);

    const remainingDebit = Math.max(0, parseFloat((Number(debitMov.amount) - totalDebitAllocated).toFixed(2)));
    const remainingCredit = Math.max(0, parseFloat((Number(creditMov.amount) - totalCreditAllocated).toFixed(2)));

    if (cleanAmount > remainingDebit) {
      return {
        success: false,
        error: `El monto a imputar ($${cleanAmount}) supera el saldo deudor remanente de la factura ($${remainingDebit}).`,
      };
    }

    if (cleanAmount > remainingCredit) {
      return {
        success: false,
        error: `El monto a imputar ($${cleanAmount}) supera el saldo a favor disponible del cobro ($${remainingCredit}).`,
      };
    }

    // 3. Perform insert into allocations
    const newAllocation = {
      id: crypto.randomUUID(),
      company_cuit: companyCuit,
      debit_movement_id: debitMovementId,
      credit_movement_id: creditMovementId,
      amount_allocated: cleanAmount,
    };

    const { error: insertErr } = await client.database
      .from("customer_credit_allocations")
      .insert([newAllocation]);

    if (insertErr) throw insertErr;

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Critical failure in createCreditAllocation:", err);
    return { success: false, error: err.message || "Failed to create credit allocation" };
  }
}
