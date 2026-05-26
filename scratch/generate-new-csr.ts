import forge from "node-forge";
import fs from "fs";
import path from "path";

async function main() {
  console.log("⚡ Iniciando generación de nueva Clave Privada y CSR para ARCA...");

  try {
    const certDir = path.join(process.cwd(), ".cert");
    const backupDir = path.join(certDir, "backup_" + Date.now());

    // 1. Crear directorio de backup si existen certificados previos
    if (fs.existsSync(certDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Creado directorio de respaldo en: ${backupDir}`);

      const files = ["nodosur.key", "nodosur.crt", "arca_request_cuit_20371024094.csr"];
      for (const file of files) {
        const filePath = path.join(certDir, file);
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, path.join(backupDir, file));
          console.log(`💾 Respaldado: ${file} -> ${backupDir}`);
        }
      }
    } else {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // 2. Generar un nuevo par de claves RSA de 2048 bits de forma asíncrona (más rápido y sin bloquear el hilo)
    console.log("🔑 Generando nuevo par de claves RSA de 2048 bits (puede tardar unos segundos)...");
    
    const keys = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
        if (err) reject(err);
        else resolve(keypair);
      });
    });

    // 3. Crear el CSR (Certificate Signing Request) compatible con AFIP / ARCA
    console.log("📝 Construyendo el CSR con la identidad fiscal (CUIT 20371024094)...");
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    
    // El DN debe tener Common Name (CN), Organización (O), País (C) y el CUIT en el serialNumber o serialName
    csr.setSubject([
      {
        name: "commonName",
        value: "nodosur_nuevo"
      },
      {
        name: "organizationName",
        value: "Nodo Sur Autopartes"
      },
      {
        name: "countryName",
        value: "AR"
      },
      {
        name: "serialNumber",
        value: "CUIT 20371024094"
      }
    ]);

    // Firmar el CSR con la clave privada usando SHA-256
    console.log("✍️ Firmando digitalmente el CSR...");
    csr.sign(keys.privateKey, forge.md.sha256.create());

    // 4. Exportar a PEM
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    // Guardar los nuevos archivos
    const keyPath = path.join(certDir, "nodosur.key");
    const csrPath = path.join(certDir, "arca_request_cuit_20371024094.csr");

    fs.writeFileSync(keyPath, privateKeyPem, "utf8");
    fs.writeFileSync(csrPath, csrPem, "utf8");

    console.log("\n=======================================================");
    console.log("✅ ¡NUEVAS CLAVES Y CSR GENERADOS CON ÉXITO!");
    console.log("=======================================================");
    console.log(`🔑 Clave privada guardada en: ${keyPath}`);
    console.log(`📝 CSR guardado en: ${csrPath}`);
    console.log("\n👇 Copiá el bloque de texto de abajo completo para pegarlo en AFIP:");
    console.log("-------------------------------------------------------");
    console.log(csrPem);
    console.log("-------------------------------------------------------");
    console.log("\n💡 Pasos a seguir:");
    console.log("1. Entrá a AFIP WSASS Autoservicio (Homologación).");
    console.log("2. Hacé clic en 'Nuevo Certificado' en el menú de la izquierda.");
    console.log("3. Ingresá el alias 'nodo_nuevo' (o el que quieras) y pegá el bloque del CSR de arriba.");
    console.log("4. Hacé clic en 'Generar Certificado' y descargá el archivo .crt.");
    console.log("5. Reemplazá el contenido de tu archivo '.cert/nodosur.crt' local con el certificado que descargaste.");
    console.log("6. Corré: bun run scratch/register-real-certs.ts para inyectarlo en tu base de datos Supabase.");
    console.log("7. ¡Listo! El WSAA te dará un Ticket de Acceso nuevo al instante bypassando el bloqueo.");
    console.log("=======================================================\n");

  } catch (err: any) {
    console.error("❌ Error generando las claves y CSR:", err.message || err);
    process.exit(1);
  }
}

main();
