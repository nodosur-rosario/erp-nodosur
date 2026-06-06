"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/core/api/supabase";
import { arDateToUTCBounds } from "@/core/utils/timezone-utils";

export interface VoucherItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  alicuota_iva: number;
  subtotal: number;
}

export interface Voucher {
  id: string;
  type: string;
  company_cuit: string;
  client_cuit: string;
  client_name: string;
  net_amount: string | number;
  iva_amount: string | number;
  total_amount: string | number;
  cae: string;
  cae_vto: string;
  qr_link: string;
  items: VoucherItem[] | string | null;
  created_at: string;
  canal?: string;
}

interface UseVouchersArgs {
  companyCuit?: string | null;
  startDate: string;
  endDate: string;
  showCajaNegra: boolean;
}

export function useGetVouchers({ companyCuit, startDate, endDate, showCajaNegra }: UseVouchersArgs) {
  return useQuery({
    queryKey: ["vouchers", companyCuit, startDate, endDate, showCajaNegra],
    queryFn: async (): Promise<Voucher[]> => {
      if (!companyCuit) return [];

      const client = getSupabaseClient();
      const { startISO } = arDateToUTCBounds(startDate);
      const { endISO } = arDateToUTCBounds(endDate);

      let query = client.database
        .from("arca_vouchers")
        .select("*")
        .eq("company_cuit", companyCuit)
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      if (!showCajaNegra) {
        query = query.eq("canal", "oficial");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data as Voucher[];
    },
    enabled: !!companyCuit,
  });
}
