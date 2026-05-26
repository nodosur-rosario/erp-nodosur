"use server";

import { getSupabaseClient } from "@/core/api/supabase";

export interface AlicuotaIva {
  codigo_afip: number;
  descripcion: string;
  porcentaje: number;
  activa: boolean;
  created_at?: string;
}


function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Error desconocido";
}

/**
 * Fetch all tax rates (alícuotas) ordered by percentage.
 */
export async function getAlicuotas(): Promise<{
  data: AlicuotaIva[];
  error: string | null;
}> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.database
      .from("alicuota_iva")
      .select("*")
      .order("porcentaje", { ascending: true });

    if (error) throw error;

    return { data: (data as AlicuotaIva[]) || [], error: null };
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    console.error("Error in getAlicuotas:", err);
    return { data: [], error: errorMsg || "No se pudieron obtener las alícuotas." };
  }
}

/**
 * Create or update a tax rate.
 */
export async function upsertAlicuota(
  alicuota: AlicuotaIva
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();
    
    if (alicuota.codigo_afip === undefined || alicuota.codigo_afip < 0) {
      return { success: false, error: "El código AFIP debe ser un número entero válido." };
    }

    if (!alicuota.descripcion.trim()) {
      return { success: false, error: "La descripción es obligatoria." };
    }

    if (alicuota.porcentaje === undefined || alicuota.porcentaje < 0 || alicuota.porcentaje > 100) {
      return { success: false, error: "El porcentaje debe ser un número entre 0 y 100." };
    }

    const payload = {
      codigo_afip: alicuota.codigo_afip,
      descripcion: alicuota.descripcion.trim(),
      porcentaje: Number(alicuota.porcentaje),
      activa: alicuota.activa ?? true,
    };

    // Upsert using the Supabase array syntax standard in AGENTS.md
    const { error } = await client.database
      .from("alicuota_iva")
      .upsert([payload], { onConflict: "codigo_afip" });

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    console.error("Critical failure in upsertAlicuota:", err);
    return { success: false, error: errorMsg || "No se pudo guardar la alícuota." };
  }
}

/**
 * Toggle active status of a tax rate.
 */
export async function toggleAlicuotaActiva(
  codigoAfip: number,
  activa: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();
    
    const { error } = await client.database
      .from("alicuota_iva")
      .update({ activa })
      .eq("codigo_afip", codigoAfip);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    console.error("Error in toggleAlicuotaActiva:", err);
    return { success: false, error: errorMsg || "No se pudo actualizar el estado de la alícuota." };
  }
}

/**
 * Delete a custom tax rate.
 */
export async function deleteAlicuota(
  codigoAfip: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = getSupabaseClient();

    const { error } = await client.database
      .from("alicuota_iva")
      .delete()
      .eq("codigo_afip", codigoAfip);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    console.error("Error in deleteAlicuota:", err);
    return { success: false, error: errorMsg || "No se pudo eliminar la alícuota." };
  }
}
