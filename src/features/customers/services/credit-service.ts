import { getSupabaseClient } from "@/core/api/supabase";

export interface CreditAccount {
  id: string;
  client_id: string;
  company_cuit: string;
  tiene_cuenta_corriente: boolean;
  limite_credito: number;
  saldo_actual: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreditMovement {
  id: string;
  credit_account_id: string;
  type: "debito" | "credito";
  amount: number;
  description: string;
  accounting_transaction_id: string | null;
  created_at?: string;
}

/**
 * Fetch or initialize a credit account for a specific client and company CUIT.
 */
export async function getCreditAccount(
  clientId: string,
  companyCuit: string
): Promise<{ data: CreditAccount | null; error: string | null }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.database
      .from("customer_credit_accounts")
      .select("*")
      .eq("client_id", clientId)
      .eq("company_cuit", companyCuit)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // If it doesn't exist, we return a virtual object.
      // We will only insert it when it's explicitly enabled to prevent DB clutter.
      return {
        data: {
          id: "",
          client_id: clientId,
          company_cuit: companyCuit,
          tiene_cuenta_corriente: false,
          limite_credito: 0.0,
          saldo_actual: 0.0,
        },
        error: null,
      };
    }

    return {
      data: data as CreditAccount,
      error: null,
    };
  } catch (err: any) {
    console.error("Error in getCreditAccount:", err);
    return { data: null, error: err.message || "Failed to fetch credit account" };
  }
}

/**
 * Upsert credit settings for a client's credit account.
 */
export async function updateCreditSettings(
  clientId: string,
  companyCuit: string,
  settings: { tiene_cuenta_corriente: boolean; limite_credito: number }
): Promise<{ data: CreditAccount | null; error: string | null }> {
  try {
    const client = getSupabaseClient();
    
    // First, check if the account already exists
    const { data: existing, error: checkErr } = await client.database
      .from("customer_credit_accounts")
      .select("*")
      .eq("client_id", clientId)
      .eq("company_cuit", companyCuit)
      .maybeSingle();

    if (checkErr) throw checkErr;

    if (existing) {
      // Update
      const { data, error } = await client.database
        .from("customer_credit_accounts")
        .update({
          tiene_cuenta_corriente: settings.tiene_cuenta_corriente,
          limite_credito: settings.limite_credito,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return { data: data as CreditAccount, error: null };
    } else {
      // Insert
      const newAccount = {
        id: crypto.randomUUID(),
        client_id: clientId,
        company_cuit: companyCuit,
        tiene_cuenta_corriente: settings.tiene_cuenta_corriente,
        limite_credito: settings.limite_credito,
        saldo_actual: 0.0,
      };

      const { data, error } = await client.database
        .from("customer_credit_accounts")
        .insert([newAccount])
        .select()
        .single();

      if (error) throw error;
      return { data: data as CreditAccount, error: null };
    }
  } catch (err: any) {
    console.error("Error in updateCreditSettings:", err);
    return { data: null, error: err.message || "Failed to update credit settings" };
  }
}

/**
 * Fetch all credit movements for a given credit account.
 */
export async function getCreditMovements(
  creditAccountId: string
): Promise<{ data: CreditMovement[]; error: string | null }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.database
      .from("customer_credit_movements")
      .select("*")
      .eq("credit_account_id", creditAccountId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: (data as CreditMovement[]) || [], error: null };
  } catch (err: any) {
    console.error("Error in getCreditMovements:", err);
    return { data: [], error: err.message || "Failed to fetch credit movements" };
  }
}

/**
 * Record a customer debt payment (cobro) with transactional consistency,
 * double-entry accounting balance, and daily cash register sync.
 */
export async function recordPayment(
  clientId: string,
  companyCuit: string,
  payment: {
    amount: number;
    paymentMethod: "efectivo" | "tarjeta" | "transferencia";
    description: string;
    userId: string;
    sesionId?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();
    
    // 1. Fetch current credit account state
    const { data: account, error: accErr } = await client.database
      .from("customer_credit_accounts")
      .select("*")
      .eq("client_id", clientId)
      .eq("company_cuit", companyCuit)
      .maybeSingle();

    if (accErr) throw accErr;
    if (!account) {
      return { success: false, error: "El cliente no posee una cuenta corriente registrada." };
    }

    if (!account.tiene_cuenta_corriente) {
      return { success: false, error: "La cuenta corriente del cliente se encuentra deshabilitada." };
    }

    const currentBalance = parseFloat(account.saldo_actual || "0");
    const amountToPay = parseFloat(payment.amount.toFixed(2));
    
    if (amountToPay <= 0) {
      return { success: false, error: "El monto del pago debe ser mayor a cero." };
    }

    // 2. Calculate new balance
    const nuevoSaldo = parseFloat((currentBalance - amountToPay).toFixed(2));

    // 3. Double-entry validation: Debe == Haber by construction
    // Debe: Activo (1.1.1.01 Caja or 1.1.1.02 Banco)
    // Haber: Activo - Deudores por Ventas (1.1.3.01)
    const txId = `TX-COBRO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const decripAsiento = `Cobro de Cuenta Corriente — Cliente ID: ${clientId} — Ref: ${payment.description}`;
    
    const cuentaActivo = payment.paymentMethod === "efectivo" ? "1.1.1.01" : "1.1.1.02";
    const cuentaCredito = "1.1.3.01"; // Deudores por Ventas

    // 4. Create accounting transaction header
    const { error: txErr } = await client.database
      .from("accounting_transactions")
      .insert([
        {
          id: txId,
          date: new Date().toISOString(),
          description: decripAsiento,
          company_cuit: companyCuit,
        },
      ]);

    if (txErr) throw new Error(`Failed to create accounting transaction header: ${txErr.message}`);

    // 5. Create accounting entries
    const entries = [
      {
        transaction_id: txId,
        account_code: cuentaActivo,
        debe: amountToPay,
        haber: 0.0,
      },
      {
        transaction_id: txId,
        account_code: cuentaCredito,
        debe: 0.0,
        haber: amountToPay,
      },
    ];

    const { error: entriesErr } = await client.database
      .from("accounting_entries")
      .insert(entries);

    if (entriesErr) throw new Error(`Failed to create double-entry ledger bookings: ${entriesErr.message}`);

    // 6. Daily Cash Drawer Sync (If Cash and session active)
    if (payment.paymentMethod === "efectivo" && payment.sesionId) {
      // Log cash drawer movement
      const { error: movErr } = await client.database
        .from("caja_movimiento")
        .insert([
          {
            sesion_id: payment.sesionId,
            tipo: "ingreso",
            monto: amountToPay,
            concepto: decripAsiento,
            accounting_transaction_id: txId,
          },
        ]);

      if (movErr) throw new Error(`Failed to register cash drawer movement: ${movErr.message}`);

      // Fetch active session to get theoretical balance securely
      const { data: currentSession, error: sessFetchErr } = await client.database
        .from("caja_sesion")
        .select("*")
        .eq("id", payment.sesionId)
        .single();

      if (sessFetchErr) throw new Error(`Failed to verify active cash session: ${sessFetchErr.message}`);

      const nuevoTeorico = parseFloat((Number(currentSession.monto_teorico) + amountToPay).toFixed(2));
      
      // Update drawer balance
      const { error: sesionUpdateErr } = await client.database
        .from("caja_sesion")
        .update({ monto_teorico: nuevoTeorico })
        .eq("id", payment.sesionId);

      if (sesionUpdateErr) throw new Error(`Failed to update daily cash session balance: ${sesionUpdateErr.message}`);
    }

    // 7. Update Customer Credit Account Balance
    const { error: balanceErr } = await client.database
      .from("customer_credit_accounts")
      .update({
        saldo_actual: nuevoSaldo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (balanceErr) throw new Error(`Failed to update customer credit balance: ${balanceErr.message}`);

    // 8. Log Credit Movement
    const { error: movementErr } = await client.database
      .from("customer_credit_movements")
      .insert([
        {
          id: crypto.randomUUID(),
          credit_account_id: account.id,
          type: "credito",
          amount: amountToPay,
          description: payment.description,
          accounting_transaction_id: txId,
        },
      ]);

    if (movementErr) throw new Error(`Failed to write credit movement history: ${movementErr.message}`);

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Critical failure during CC recordPayment transaction:", err);
    return { success: false, error: err.message || "Failed to record payment" };
  }
}
