"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient, createSupabaseServerClient } from "@/core/api/supabase";
import { setActiveCuitCookie, clearActiveCuitCookie } from "@/core/company/company-cookies";
import type { CompanyProfile } from "@/core/company/company-store";
import { encryptPrivateKey } from "@/features/arca/services/arca-crypto";
import { getCurrentUserDetails } from "@/core/auth/auth-state";
import { getAccessToken } from "@/core/auth/auth-cookies";

export async function fetchCompaniesAction(): Promise<{ success: true; data: CompanyProfile[] } | { success: false; error: string }> {
  try {
    const supabase = getSupabaseServerClient();
    const user = await getCurrentUserDetails();
    if (!user) {
      return { success: true, data: [] };
    }

    // Fetch user's company roles to determine which tenants they have access to
    const { data: roles, error: rolesErr } = await supabase.database
      .from("user_company_roles")
      .select("company_cuit")
      .eq("user_id", user.id);

    if (rolesErr) {
      return { success: false, error: rolesErr.message ?? "Error al verificar roles de la empresa." };
    }

    if (!roles || roles.length === 0) {
      return { success: true, data: [] };
    }

    const cuits = roles.map((r: any) => r.company_cuit);

    const { data, error } = await supabase.database
      .from("company_profile")
      .select("*")
      .in("cuit", cuits);

    if (error) {
      return { success: false, error: error.message ?? "Error al cargar las empresas." };
    }

    return { success: true, data: (data ?? []) as CompanyProfile[] };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Ocurrió un error inesperado." };
  }
}

export async function selectCompanyAction(company: CompanyProfile): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await setActiveCuitCookie(company.cuit);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Error al seleccionar la empresa." };
  }
}

export async function clearCompanyAction(): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await clearActiveCuitCookie();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Error al limpiar la selección." };
  }
}

export async function createCompanyAction(company: CompanyProfile): Promise<{ success: true; data: CompanyProfile } | { success: false; error: string }> {
  try {
    const user = await getCurrentUserDetails();
    if (!user) {
      return { success: false, error: "Usuario no autenticado." };
    }

    // Instanciar cliente autenticado explícitamente pasando el token para evitar pérdida de contexto/cookies de Next.js en Server Actions asíncronas
    const accessToken = await getAccessToken();
    const supabase = accessToken
      ? createSupabaseServerClient({ accessToken })
      : getSupabaseServerClient();

    const { data, error } = await supabase.database
      .from("company_profile")
      .insert([
        {
          cuit: company.cuit,
          razon_social: company.razon_social,
          nombre_fantasia: company.nombre_fantasia || null,
          condicion_iva: company.condicion_iva,
          ingresos_brutos: company.ingresos_brutos || null,
          inicio_actividades: company.inicio_actividades || null,
          direccion: company.direccion || null,
          punto_venta: Number(company.punto_venta) || 1,
          afip_mode: company.afip_mode || "edge_simulation",
          celular: company.celular || null,
          email: company.email || null,
        }
      ])
      .select();

    if (error) {
      return { success: false, error: error.message ?? "Error al crear la empresa." };
    }

    // Link the user with the newly created company as 'owner'
    const { error: roleErr } = await supabase.database
      .from("user_company_roles")
      .insert([
        {
          user_id: user.id,
          company_cuit: company.cuit,
          role: "owner"
        }
      ]);

    if (roleErr) {
      console.error("Error creating user_company_role:", roleErr);
      return { success: false, error: roleErr.message ?? "Empresa creada pero falló la asignación del rol de propietario." };
    }

    const createdCompany = (data && data[0]) as CompanyProfile;
    revalidatePath("/", "layout");
    return { success: true, data: createdCompany };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Ocurrió un error inesperado al registrar la empresa." };
  }
}

export async function updateCompanyAction(company: Partial<CompanyProfile> & { cuit: string }): Promise<{ success: true; data: CompanyProfile } | { success: false; error: string }> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.database
      .from("company_profile")
      .update({
        razon_social: company.razon_social,
        nombre_fantasia: company.nombre_fantasia || null,
        condicion_iva: company.condicion_iva,
        ingresos_brutos: company.ingresos_brutos || null,
        inicio_actividades: company.inicio_actividades || null,
        direccion: company.direccion || null,
        punto_venta: company.punto_venta !== undefined ? Number(company.punto_venta) : undefined,
        afip_mode: company.afip_mode,
        celular: company.celular !== undefined ? company.celular || null : undefined,
        email: company.email !== undefined ? company.email || null : undefined,
      })
      .eq("cuit", company.cuit)
      .select();

    if (error) {
      return { success: false, error: error.message ?? "Error al actualizar la empresa." };
    }

    const updatedCompany = (data && data[0]) as CompanyProfile;
    revalidatePath("/", "layout");
    return { success: true, data: updatedCompany };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Ocurrió un error inesperado al actualizar la empresa." };
  }
}

export async function activateArcaBypassAction(cuit: string, puntoVenta: number): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = getSupabaseServerClient();
    
    // 1. Encrypt mock private key
    const mockPrivateKeyPem = "MOCK_PRIVATE_KEY_FOR_LOCAL_SIMULATION_BYPASS_MODE";
    const encryptedMockKey = encryptPrivateKey(mockPrivateKeyPem);
    
    // 2. Upsert arca_credentials
    const { data: existing, error: checkErr } = await supabase.database
      .from("arca_credentials")
      .select("*")
      .eq("company_cuit", cuit)
      .maybeSingle();
      
    if (checkErr) throw checkErr;
    
    if (existing) {
      const { error: updateErr } = await supabase.database
        .from("arca_credentials")
        .update({
          private_key: encryptedMockKey,
          certificate: "MOCK_SIMULATED_CERTIFICATE_PEM_BYPASS_MODE",
          punto_venta: Number(puntoVenta) || 1,
          environment: "simulation",
          updated_at: new Date().toISOString()
        })
        .eq("company_cuit", cuit);
        
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.database
        .from("arca_credentials")
        .insert([
          {
            company_cuit: cuit,
            private_key: encryptedMockKey,
            certificate: "MOCK_SIMULATED_CERTIFICATE_PEM_BYPASS_MODE",
            punto_venta: Number(puntoVenta) || 1,
            environment: "simulation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
        
      if (insertErr) throw insertErr;
    }
    
    // 3. Update afip_mode = "edge_simulation" in company_profile
    const { error: compErr } = await supabase.database
      .from("company_profile")
      .update({
        afip_mode: "edge_simulation"
      })
      .eq("cuit", cuit);
      
    if (compErr) throw compErr;

    
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Error al activar simulación local de ARCA." };
  }
}

