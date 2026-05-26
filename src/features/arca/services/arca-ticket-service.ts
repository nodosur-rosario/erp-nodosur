import { getSupabaseClient } from "@/core/api/supabase";
import forge from "node-forge";
import { decryptPrivateKey } from "./arca-crypto";

export interface AuthorizedTicket {
  token: string;
  sign: string;
  expiredAt: string;
}

/**
 * Servicio de Autenticación y Autorización (WSAA) de ARCA con caché en Supabase.
 * Previene re-solicitudes constantes al WSAA que puedan causar bloqueos de IP.
 */
export async function getAuthorizedTicket(
  companyCuit: string,
  serviceName: string
): Promise<{ token: string; sign: string }> {
  const client = getSupabaseClient();

  try {
    // 1. Intentar recuperar ticket de la caché de base de datos
    const { data: ticket, error: selectErr } = await client.database
      .from("arca_access_tickets")
      .select("*")
      .eq("cuit", companyCuit)
      .eq("service", serviceName)
      .maybeSingle();

    if (selectErr) {
      console.warn("⚠️ Advertencia al buscar ticket en caché de base de datos:", selectErr);
    }

    const now = new Date();
    // Añadimos una holgura de 15 minutos para evitar expirar durante una transacción en curso
    const safetyBufferTime = new Date(now.getTime() + 15 * 60 * 1000);

    if (ticket && new Date(ticket.expired_at) > safetyBufferTime) {
      console.log(`[Caché WSAA] Reutilizando ticket existente para CUIT ${companyCuit} y servicio ${serviceName}`);
      return {
        token: ticket.token,
        sign: ticket.sign
      };
    }

    // 2. Recuperar credenciales de ARCA de la distribuidora
    const { data: creds, error: credErr } = await client.database
      .from("arca_credentials")
      .select("*")
      .eq("company_cuit", companyCuit)
      .maybeSingle();

    if (credErr) {
      console.warn("⚠️ Error al buscar credenciales fiscales:", credErr);
    }

    // 3. Decidir el entorno (Bypass simulador offline vs Conexión real homologación)
    const isSimulation = !creds || !creds.certificate || creds.environment === "simulation" || creds.certificate === "MOCK_SIMULATED_CERTIFICATE_PEM_BYPASS_MODE";

    let nuevoTicket: AuthorizedTicket;

    if (isSimulation) {
      console.log(`[WSAA ARCA] Generando ticket SIMULADO (bypass local) para CUIT ${companyCuit} y servicio ${serviceName}...`);
      nuevoTicket = generateSimulatedTicket(companyCuit);
    } else {
      console.log(`[WSAA ARCA] Solicitando nuevo ticket de acceso REAL (${creds.environment}) para CUIT ${companyCuit} y servicio ${serviceName}...`);
      
      // Desencriptar la clave privada local en caliente de forma segura
      const privateKeyPem = decryptPrivateKey(creds.private_key);
      const certificatePem = creds.certificate;
      const environment = creds.environment || "homologation";

      nuevoTicket = await requestRealTicketFromWSAA(
        companyCuit,
        serviceName,
        privateKeyPem,
        certificatePem,
        environment
      );
    }

    // 4. Persistir en base de datos de manera atómica para compartir entre múltiples Lambdas Serverless
    const { error: upsertErr } = await client.database
      .from("arca_access_tickets")
      .upsert({
        cuit: companyCuit,
        service: serviceName,
        token: nuevoTicket.token,
        sign: nuevoTicket.sign,
        expired_at: nuevoTicket.expiredAt,
        updated_at: now.toISOString()
      });

    if (upsertErr) {
      console.error("❌ Error al guardar el ticket de acceso en base de datos:", upsertErr);
    } else {
      console.log(`[Caché WSAA] Ticket de acceso guardado y sincronizado para CUIT ${companyCuit}`);
    }

    return {
      token: nuevoTicket.token,
      sign: nuevoTicket.sign
    };
  } catch (err: any) {
    console.error("❌ Falla crítica en el servicio de autenticación WSAA:", err);
    throw new Error(`Error en WSAA: ${err.message || "Falla al autenticar con ARCA."}`);
  }
}

/**
 * Genera un ticket consistente de simulación local.
 */
function generateSimulatedTicket(cuit: string): AuthorizedTicket {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 11);
  return {
    token: `TKT_ARCA_SIM_${cuit}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    sign: `SIGN_ARCA_SIM_${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
    expiredAt: expiration.toISOString()
  };
}

/**
 * Conexión física SOAP + Criptografía CMS real contra el WSAA de ARCA.
 */
async function requestRealTicketFromWSAA(
  cuit: string,
  service: string,
  privateKeyPem: string,
  certificatePem: string,
  environment: string
): Promise<AuthorizedTicket> {
  const wsaaUrl = environment === "production"
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

  try {
    // 1. Crear el XML de TRA (Ticket de Requerimiento de Acceso)
    const uniqueId = Math.floor(Math.random() * 999999);
    const now = new Date();
    // AFIP requiere las marcas temporales en formato ISO 8601 (reducimos 2 minutos para evitar desincronizaciones de reloj)
    const genTime = new Date(now.getTime() - 2 * 60 * 1000);
    const expTime = new Date(now.getTime() + 10 * 60 * 60 * 1000);

    const formatAfipDate = (d: Date) => d.toISOString().substring(0, 19) + "Z";

    const traXml = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${formatAfipDate(genTime)}</generationTime>
    <expirationTime>${formatAfipDate(expTime)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

    // 2. Firmar digitalmente el TRA en formato CMS (PKCS#7) usando node-forge de forma nativa en JS
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(traXml, "utf8");
    
    const cert = forge.pki.certificateFromPem(certificatePem);
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime
        }
      ]
    });

    p7.sign();

    // Exportar el sobre criptográfico DER y codificar en Base64
    const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const cmsBase64 = forge.util.encode64(derBytes);

    // 3. Construir el sobre SOAP para el endpoint LoginCms
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

    // 4. Realizar petición POST nativa a los servidores de ARCA
    const response = await fetch(wsaaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "SOAPAction": ""
      },
      body: soapEnvelope
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`AFIP WSAA respondió con código de estado HTTP ${response.status}: ${responseText}`);
    }

    // 5. Parsear el XML devuelto por ARCA
    // AFIP encapsula el XML de respuesta codificado dentro del nodo <loginCmsReturn>
    const cmsReturnMatch = responseText.match(/<loginCmsReturn[^>]*>([\s\S]*?)<\/loginCmsReturn>/);
    if (!cmsReturnMatch || !cmsReturnMatch[1]) {
      throw new Error(`Respuesta inválida del WSAA de ARCA. No se encontró el nodo loginCmsReturn. Response: ${responseText}`);
    }

    // Decodificar entidades HTML (&lt; y &gt; a < y >)
    const xmlDecoded = cmsReturnMatch[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");

    // Extraer Token, Sign y ExpirationTime utilizando expresiones regulares robustas
    const tokenMatch = xmlDecoded.match(/<token>([^<]+)<\/token>/);
    const signMatch = xmlDecoded.match(/<sign>([^<]+)<\/sign>/);
    const expirationMatch = xmlDecoded.match(/<expirationTime>([^<]+)<\/expirationTime>/);

    if (!tokenMatch || !tokenMatch[1] || !signMatch || !signMatch[1] || !expirationMatch || !expirationMatch[1]) {
      throw new Error(`Error al decodificar credenciales dinámicas en la respuesta decodificada de ARCA: ${xmlDecoded}`);
    }

    console.log(`[WSAA ARCA] Nuevo Ticket de Acceso REAL obtenido de forma exitosa. Expiración: ${expirationMatch[1]}`);

    return {
      token: tokenMatch[1].trim(),
      sign: signMatch[1].trim(),
      expiredAt: new Date(expirationMatch[1].trim()).toISOString()
    };
  } catch (err: any) {
    console.error("❌ Error físico durante la autenticación real en el WSAA de ARCA:", err);
    throw new Error(`Falla en WSAA Criptográfico: ${err.message || err}`);
  }
}
