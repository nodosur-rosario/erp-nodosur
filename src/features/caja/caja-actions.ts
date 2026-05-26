"use server";

import { getSupabaseServerClient } from "@/core/api/supabase";
import { getActiveCuitCookie } from "@/core/company/company-cookies";
import { revalidatePath } from "next/cache";

/**
 * Fetch the currently open cash session for the active CUIT.
 */
export async function getActiveSession() {
  const cuit = await getActiveCuitCookie();
  if (!cuit) return { data: null, error: "No hay CUIT activo." };

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.database
    .from("caja_sesion")
    .select("*")
    .eq("cuit", cuit)
    .eq("estado", "abierta")
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Fetch all movements for a given session, most recent first.
 */
export async function getMovimientosBySession(sesionId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.database
    .from("caja_movimiento")
    .select("*")
    .eq("sesion_id", sesionId)
    .order("fecha", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * Open a new daily cash session for the active CUIT.
 */
export async function openCaja(userId: string, montoInicial: number, notas?: string) {
  const cuit = await getActiveCuitCookie();
  if (!cuit) return { data: null, error: "No hay CUIT activo." };

  // Guard: prevent double-open
  const existing = await getActiveSession();
  if (existing.data) {
    return { data: null, error: "Ya existe una sesión de caja activa para este CUIT." };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.database
    .from("caja_sesion")
    .insert([
      {
        cuit,
        user_id: userId,
        monto_inicial: montoInicial,
        monto_teorico: montoInicial,
        estado: "abierta",
        notas: notas || null,
      },
    ])
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/protected/caja");
  return { data, error: null };
}

/**
 * Register a manual cash movement (income or expense) with atomic double-entry bookkeeping via RPC.
 */
export async function addManualMovimiento(
  sesionId: string,
  tipo: "ingreso" | "egreso",
  monto: number,
  concepto: string,
  cuentaContraparte: string,
) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.database.rpc("registrar_movimiento_caja", {
    p_sesion_id: sesionId,
    p_tipo: tipo,
    p_monto: monto,
    p_concepto: concepto,
    p_cuenta_contraparte: cuentaContraparte,
  });

  if (error) return { data: null, error: error.message };

  revalidatePath("/protected/caja");
  return { data, error: null };
}

/**
 * Close the daily cash session: compute discrepancies and generate adjustment entries.
 */
export async function closeCaja(sesionId: string, montoReal: number, notas?: string) {
  const supabase = getSupabaseServerClient();

  // 1. Fetch the live session to get the theoretical balance
  const { data: sesion, error: fetchErr } = await supabase.database
    .from("caja_sesion")
    .select("*")
    .eq("id", sesionId)
    .single();

  if (fetchErr || !sesion) {
    return { data: null, error: "No se pudo encontrar la sesión de caja." };
  }

  if (sesion.estado === "cerrada") {
    return { data: null, error: "La sesión ya se encuentra cerrada." };
  }

  const montoTeorico = Number(sesion.monto_teorico);
  const diferencia = montoReal - montoTeorico;

  // 2. If there's a discrepancy, create an adjustment accounting entry
  if (diferencia !== 0) {
    const isFaltante = diferencia < 0;
    const montoAjuste = Math.abs(diferencia);
    const cuentaCaja = "1.1.1.01";
    const cuentaAjuste = isFaltante ? "5.1.2.01" : "4.2.1.01";
    const conceptoAjuste = isFaltante
      ? `Ajuste por Faltante de Caja — Sesión ${sesionId.substring(0, 8)}`
      : `Ajuste por Sobrante de Caja — Sesión ${sesionId.substring(0, 8)}`;

    const transactionId = `TX-AJUSTE-${Date.now()}-${sesionId.substring(0, 8)}`;

    // SUM(debe) === SUM(haber) guaranteed by construction
    const { error: txErr } = await supabase.database
      .from("accounting_transactions")
      .insert([{ 
        id: transactionId, 
        date: new Date().toISOString(), 
        description: conceptoAjuste,
        company_cuit: sesion.cuit
      }]);

    if (txErr) return { data: null, error: `Error creando transacción de ajuste: ${txErr.message}` };

    const entries = isFaltante
      ? [
          { transaction_id: transactionId, account_code: cuentaAjuste, debe: montoAjuste, haber: 0.0 },
          { transaction_id: transactionId, account_code: cuentaCaja, debe: 0.0, haber: montoAjuste },
        ]
      : [
          { transaction_id: transactionId, account_code: cuentaCaja, debe: montoAjuste, haber: 0.0 },
          { transaction_id: transactionId, account_code: cuentaAjuste, debe: 0.0, haber: montoAjuste },
        ];

    const { error: entryErr } = await supabase.database.from("accounting_entries").insert(entries);

    if (entryErr) return { data: null, error: `Error creando asientos de ajuste: ${entryErr.message}` };
  }

  // 3. Close the session
  const closingNotas = notas
    ? `${sesion.notas || ""} | Cierre: ${notas}`.trim()
    : sesion.notas;

  const { data: updated, error: updateErr } = await supabase.database
    .from("caja_sesion")
    .update({
      fecha_cierre: new Date().toISOString(),
      monto_real: montoReal,
      diferencia,
      estado: "cerrada",
      notas: closingNotas,
    })
    .eq("id", sesionId)
    .select()
    .single();

  if (updateErr) return { data: null, error: updateErr.message };


  revalidatePath("/protected/caja");
  return { data: updated, error: null };
}
