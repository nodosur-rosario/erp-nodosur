import { NextRequest, NextResponse } from "next/server";
import { consultarPadron } from "@/features/arca/services/padron-service";

/**
 * Route Handler Next.js (Server-side) para la consulta del Padrón de ARCA.
 * Expone de forma segura la llamada evitando filtraciones criptográficas al cliente.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cuit: string }> }
) {
  try {
    const { cuit } = await params;
    const { searchParams } = new URL(request.url);
    const companyCuit = searchParams.get("companyCuit") || "";

    if (!cuit || cuit.length !== 11 || !/^\d+$/.test(cuit)) {
      return NextResponse.json(
        { success: false, error: "El CUIT debe tener exactamente 11 dígitos numéricos." },
        { status: 400 }
      );
    }

    if (!companyCuit) {
      return NextResponse.json(
        { success: false, error: "Falta el CUIT de la distribuidora consultante (companyCuit)." },
        { status: 400 }
      );
    }

    const result = await consultarPadron(cuit, companyCuit);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("❌ Falla crítica en route handler de padrón ARCA:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Falla interna del servidor fiscal." },
      { status: 500 }
    );
  }
}
