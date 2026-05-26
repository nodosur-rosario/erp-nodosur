import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/core/api/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      cuit,
      tipo_cbte,
      punto_venta,
      doc_tipo,
      doc_nro,
      imp_neto,
      imp_iva,
      imp_total,
      iva_alicuotas
    } = body;
    
    if (!cuit || !tipo_cbte || !punto_venta || imp_total === undefined) {
      return NextResponse.json(
        { error: "Los campos cuit, tipo_cbte, punto_venta e imp_total son obligatorios." },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 1. Fetch existing voucher IDs for this CUIT and point of sale to dynamically parse the highest index.
    let typeStr = "Factura B";
    if (tipo_cbte === 1) {
      typeStr = "Factura A";
    } else if (tipo_cbte === 6) {
      typeStr = "Factura B";
    } else if (tipo_cbte === 11) {
      typeStr = "Factura C";
    }

    const { data: vouchers, error: dbErr } = await client.database
      .from("arca_vouchers")
      .select("id")
      .eq("company_cuit", cuit)
      .eq("type", typeStr)
      .ilike("id", `000${punto_venta}-%`);
      
    if (dbErr) {
      console.warn("Simulator: Failed to fetch prior voucher index. Starting from 1.", dbErr);
    }
    
    let nextCbteNro = 1;
    if (vouchers && vouchers.length > 0) {
      let maxNro = 0;
      for (const v of vouchers) {
        const parts = v.id.split("-");
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNro) {
          maxNro = num;
        }
      }
      nextCbteNro = maxNro + 1;
    }
    
    // 2. Generate a standard 14-digit fake CAE
    const now = new Date();
    const expiration = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days expiration
    
    const timestampSeed = Date.now().toString().slice(-4);
    const randomSeed = Math.floor(1000 + Math.random() * 9000).toString();
    const cae = `CAESIM${cuit}${tipo_cbte.toString().padStart(2, "0")}${timestampSeed}${randomSeed}`;
    
    // 3. Compile official AFIP QR JSON data model according to RG 4892
    const qrData = {
      ver: 1,
      fecha: now.toISOString().split("T")[0],
      cuit: Number(cuit),
      ptoVta: Number(punto_venta),
      tipoCmp: Number(tipo_cbte),
      nroCmp: nextCbteNro,
      importe: Number(imp_total.toFixed(2)),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: Number(doc_tipo || 99),
      nroDocRec: Number(doc_nro || 0),
      tipoCodAut: "A",
      codAut: cae
    };
    
    const qrDataBase64 = Buffer.from(JSON.stringify(qrData)).toString("base64");
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrDataBase64}`;
    
    return NextResponse.json({
      success: true,
      cae: cae,
      cae_vencimiento: expiration.toISOString(),
      cbte_nro: nextCbteNro,
      qr_url: qrUrl
    });
    
  } catch (err: any) {
    console.error("Error in WSFE simulator route:", err);
    return NextResponse.json(
      { error: err.message || "Falla en el simulador local de WSFE AFIP." },
      { status: 500 }
    );
  }
}
