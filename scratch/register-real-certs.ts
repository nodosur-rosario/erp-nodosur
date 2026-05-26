import { getSupabaseClient } from "../src/core/api/supabase";
import { encryptPrivateKey } from "../src/features/arca/services/arca-crypto";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Iniciando inyección física de certificados reales en Supabase...");

  try {
    const certPath = path.join(process.cwd(), ".cert", "nodosur.crt");
    const keyPath = path.join(process.cwd(), ".cert", "nodosur.key");

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`No se encontraron los certificados en .cert/. Rutas: \nCert: ${certPath}\nKey: ${keyPath}`);
    }

    const certContent = fs.readFileSync(certPath, "utf8").trim();
    const keyContent = fs.readFileSync(keyPath, "utf8").trim();

    console.log("🔒 Criptografía: Encriptando clave privada real RSA con AES-256-GCM...");
    const encryptedKey = encryptPrivateKey(keyContent);

    const client = getSupabaseClient();
    const companyCuit = "20371024094";

    console.log(`🗄️ Supabase: Actualizando arca_credentials para el CUIT ${companyCuit}...`);

    const { error } = await client.database
      .from("arca_credentials")
      .upsert({
        company_cuit: companyCuit,
        certificate: certContent,
        private_key: encryptedKey,
        environment: "homologation",
        punto_venta: 1,
        updated_at: new Date().toISOString()
      }, { onConflict: "company_cuit" });

    if (error) {
      throw error;
    }

    console.log("✅ ¡Certificados reales vinculados e inyectados con éxito en Supabase!");
    console.log("🎉 Tu ERP ahora está oficialmente conectado en modo Homologación Real con ARCA.");
  } catch (err: any) {
    console.error("❌ Error durante la inyección de certificados:", err.message || err);
    process.exit(1);
  }
}

main();
