// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getEncryptionKey(): Buffer {
  const envKey = Deno.env.get("ARCA_ENCRYPTION_KEY");
  if (!envKey) {
    console.warn("⚠️ Warning: Deno env ARCA_ENCRYPTION_KEY is not defined. Using dev fallback.");
    return crypto.createHash("sha256").update("dev-fallback-secret-arca-key").digest();
  }
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  return crypto.createHash("sha256").update(envKey).digest();
}

function decryptPrivateKey(encryptedData: string): string {
  if (!encryptedData.includes(":")) {
    throw new Error("Invalid encrypted private key format: missing metadata separators.");
  }
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted private key format: corrupt block count.");
  }
  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function requestRealTicketFromWSAA(
  cuit: string,
  service: string,
  privateKeyPem: string,
  certificatePem: string,
  wsaaUrl: string
): Promise<{ token: string; sign: string; expiredAt: string }> {
  try {
    const uniqueId = Math.floor(Math.random() * 999999);
    const now = new Date();
    // AFIP temporal offset buffer (2 minutes offset safety)
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

    const derBytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const cmsBase64 = forge.util.encode64(derBytes);

    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

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
      throw new Error(`AFIP WSAA respondió HTTP ${response.status}: ${responseText}`);
    }

    const cmsReturnMatch = responseText.match(/<loginCmsReturn[^>]*>([\s\S]*?)<\/loginCmsReturn>/);
    if (!cmsReturnMatch || !cmsReturnMatch[1]) {
      throw new Error(`Respuesta WSAA inválida. Falta loginCmsReturn. Response: ${responseText}`);
    }

    const xmlDecoded = cmsReturnMatch[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");

    const tokenMatch = xmlDecoded.match(/<token>([^<]+)<\/token>/);
    const signMatch = xmlDecoded.match(/<sign>([^<]+)<\/sign>/);
    const expirationMatch = xmlDecoded.match(/<expirationTime>([^<]+)<\/expirationTime>/);

    if (!tokenMatch || !signMatch || !expirationMatch) {
      throw new Error(`Error al decodificar tokens en la respuesta: ${xmlDecoded}`);
    }

    return {
      token: tokenMatch[1].trim(),
      sign: signMatch[1].trim(),
      expiredAt: new Date(expirationMatch[1].trim()).toISOString()
    };
  } catch (err: any) {
    console.error("❌ Falla en requestRealTicketFromWSAA:", err);
    throw err;
  }
}

function getCbteTipoCode(typeStr: string): number {
  if (typeStr.includes("Factura A")) return 1;
  if (typeStr.includes("Factura B")) return 6;
  if (typeStr.includes("Factura C")) return 11;
  if (typeStr.includes("Nota de Crédito A")) return 3;
  if (typeStr.includes("Nota de Crédito B")) return 8;
  if (typeStr.includes("Nota de Crédito C")) return 13;
  return 6; // Default to Factura B
}

function formatInvoiceNumber(typeStr: string, ptoVta: number, nro: number): string {
  let prefix = "B";
  if (typeStr.includes("Factura A")) prefix = "A";
  else if (typeStr.includes("Factura B")) prefix = "B";
  else if (typeStr.includes("Factura C")) prefix = "C";
  else if (typeStr.includes("Nota de Crédito A")) prefix = "NC-A";
  else if (typeStr.includes("Nota de Crédito B")) prefix = "NC-B";
  else if (typeStr.includes("Nota de Crédito C")) prefix = "NC-C";
  
  const ptoVtaStr = ptoVta.toString().padStart(4, "0");
  const nroStr = nro.toString().padStart(8, "0");
  return `${prefix}-${ptoVtaStr}-${nroStr}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let record: any = null;
  let nextAttempts = 1;
  let supabase: any = null;
  let voucherId = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("[ARCA Edge Function] Received Webhook Payload:", JSON.stringify(body));

    record = body.record;
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: "No record found in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    voucherId = record.id;

    // --- ARCHITECTURAL ENHANCEMENT: FETCH FRESH VOUCHER FROM SOURCE OF TRUTH ---
    console.log(`[ARCA Edge Function] Fetching complete voucher record for id: ${voucherId}`);
    const { data: voucher, error: dbVoucherErr } = await supabase
      .from("arca_vouchers")
      .select("*")
      .eq("id", voucherId)
      .maybeSingle();

    if (dbVoucherErr || !voucher) {
      throw new Error(`No se pudo recuperar el comprobante ${voucherId} de la base de datos: ${dbVoucherErr?.message || "No encontrado"}`);
    }

    const { company_cuit: companyCuit, status, attempts } = voucher;

    if (status !== "pendiente_cae" && status !== "error_temporal") {
      return new Response(JSON.stringify({ message: "Voucher not in retryable status. Skipping." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    nextAttempts = (attempts || 0) + 1;

    // Fetch credentials
    const { data: creds, error: credsErr } = await supabase
      .from("arca_credentials")
      .select("*")
      .eq("company_cuit", companyCuit)
      .maybeSingle();

    if (credsErr) {
      throw credsErr;
    }

    const environment = creds?.environment || "simulation";
    console.log(`[ARCA Edge Function] Environment resolved: ${environment} for CUIT ${companyCuit}`);

    const ptoVta = voucher.punto_venta || creds?.punto_venta || 1;
    const typeStr = voucher.type || "Factura B";
    const cbteTipo = getCbteTipoCode(typeStr);

    let finalCae = "";
    let finalCaeVto = "";
    let finalQrLink = "";
    let finalInvoiceId = "";

    if (environment === "simulation" || !creds || !creds.certificate) {
      // --- SIMULATION MODE ---
      console.log(`[ARCA Edge Function] SIMULATION mode authorization for ${voucherId}`);
      
      const { data: vouchers, error: countErr } = await supabase
        .from("arca_vouchers")
        .select("id")
        .eq("company_cuit", companyCuit)
        .eq("type", typeStr)
        .ilike("id", `%-${ptoVta.toString().padStart(4, "0")}-%`);

      let nextCbteNro = 1;
      if (vouchers && vouchers.length > 0) {
        let maxNro = 0;
        for (const v of vouchers) {
          const parts = v.id.split("-");
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num) && num > maxNro) maxNro = num;
        }
        nextCbteNro = maxNro + 1;
      }

      const now = new Date();
      const expiration = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const timestampSeed = Date.now().toString().slice(-4);
      const randomSeed = Math.floor(1000 + Math.random() * 9000).toString();
      
      finalCae = `CAESIM${companyCuit}${timestampSeed}${randomSeed}`;
      finalCaeVto = expiration.toISOString().split("T")[0];
      finalInvoiceId = formatInvoiceNumber(typeStr, ptoVta, nextCbteNro);

      const qrData = {
        ver: 1,
        fecha: now.toISOString().split("T")[0],
        cuit: Number(companyCuit),
        ptoVta: Number(ptoVta),
        tipoCmp: voucher.doc_tipo === 80 ? 1 : 6,
        nroCmp: nextCbteNro,
        importe: Number(voucher.total_amount),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: Number(voucher.doc_tipo || 99),
        nroDocRec: Number(voucher.doc_nro || 0),
        tipoCodAut: "A",
        codAut: finalCae
      };

      const qrDataBase64 = btoa(JSON.stringify(qrData));
      finalQrLink = `https://www.afip.gob.ar/fe/qr/?p=${qrDataBase64}`;

      const { error: updateErr } = await supabase
        .from("arca_vouchers")
        .update({
          id: finalInvoiceId, // Update to final sequential number
          status: "autorizado",
          cae: finalCae,
          cae_vto: finalCaeVto,
          qr_link: finalQrLink,
          attempts: nextAttempts,
          error_details: null
        })
        .eq("id", voucherId);

      if (updateErr) {
        throw updateErr;
      }

      console.log(`[ARCA Edge Function] Simulation SUCCESS for ${voucherId} -> ${finalInvoiceId}`);
      return new Response(JSON.stringify({ success: true, cae: finalCae, id: finalInvoiceId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // --- REAL HOMOLOGATION / PRODUCTION MODE (WSFE SOAP) ---
      console.log(`[ARCA Edge Function] REAL WSFE Mode for ${voucherId}`);
      
      // 1. Get/Cache WSAA Ticket
      const { data: ticket, error: selectErr } = await supabase
        .from("arca_access_tickets")
        .select("*")
        .eq("cuit", companyCuit)
        .eq("service", "wsfe")
        .maybeSingle();

      const now = new Date();
      const safetyBufferTime = new Date(now.getTime() + 15 * 60 * 1000);

      let token = "";
      let sign = "";

      if (ticket && new Date(ticket.expired_at) > safetyBufferTime) {
        console.log(`[ARCA Edge Function] Reusing cached WSAA ticket for ${companyCuit}`);
        token = ticket.token;
        sign = ticket.sign;
      } else {
        console.log(`[ARCA Edge Function] Requesting new ticket from WSAA for ${companyCuit}`);
        const decryptedKey = decryptPrivateKey(creds.private_key);
        const wsaaUrl = environment === "production"
          ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
          : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

        const newTicket = await requestRealTicketFromWSAA(
          companyCuit,
          "wsfe",
          decryptedKey,
          creds.certificate,
          wsaaUrl
        );

        token = newTicket.token;
        sign = newTicket.sign;

        await supabase
          .from("arca_access_tickets")
          .upsert({
            cuit: companyCuit,
            service: "wsfe",
            token: token,
            sign: sign,
            expired_at: newTicket.expiredAt,
            updated_at: now.toISOString()
          });
      }

      const wsfeUrl = environment === "production"
        ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
        : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

      // 2. Fetch last sequential invoice number (FECompUltimoAutorizado)
      const ultimoSoapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${companyCuit}</Cuit>
      </Auth>
      <CbteTipo>${cbteTipo}</CbteTipo>
      <PtoVta>${ptoVta}</PtoVta>
    </FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

      const ultimoController = new AbortController();
      const ultimoTimeoutId = setTimeout(() => ultimoController.abort(), 15000);

      let ultimoResponse;
      try {
        ultimoResponse = await fetch(wsfeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            "SOAPAction": "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"
          },
          body: ultimoSoapEnvelope,
          signal: ultimoController.signal
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          throw new Error("AFIP_TIMEOUT: El servidor de AFIP no respondió a la consulta de correlatividad (FECompUltimoAutorizado) dentro de los 15 segundos.");
        }
        throw fetchErr;
      } finally {
        clearTimeout(ultimoTimeoutId);
      }

      const ultimoResponseText = await ultimoResponse.text();
      if (!ultimoResponse.ok) {
        throw new Error(`AFIP WSFE ultimo comp respondió HTTP ${ultimoResponse.status}: ${ultimoResponseText}`);
      }

      // Check general SOAP Errors for ultimo comp
      const ultErrorMatch = ultimoResponseText.match(/<Err>([\s\S]*?)<\/Err>/);
      if (ultErrorMatch) {
        const codeMatch = ultErrorMatch[1].match(/<Code>(\d+)<\/Code>/);
        const msgMatch = ultErrorMatch[1].match(/<Msg>([^<]+)<\/Msg>/);
        throw new Error(`AFIP Error al obtener secuencial: ${codeMatch?.[1] || ""} - ${msgMatch?.[1] || ""}`);
      }

      const cbteNroMatch = ultimoResponseText.match(/<CbteNro>(\d+)<\/CbteNro>/);
      if (!cbteNroMatch) {
        throw new Error("No se pudo extraer el CbteNro de la respuesta de correlatividad.");
      }

      const nextCbteNro = parseInt(cbteNroMatch[1], 10) + 1;
      console.log(`[ARCA Edge Function] Next sequential invoice number to authorize: ${nextCbteNro}`);

      // 3. Format Date and build IVA alícuotas
      const formatAfipDate = (d: Date) => d.toISOString().substring(0, 10).replace(/-/g, "");

      const ivaMap = new Map<number, { base_imp: number; importe: number }>();
      const items = typeof voucher.items === "string" ? JSON.parse(voucher.items) : voucher.items || [];
      
      items.forEach((item: any) => {
        const lineNeto = item.cantidad * item.precio_unitario;
        const lineIva = lineNeto * (item.alicuota_iva / 100);

        let alicuotaId = 5; // Default 21%
        if (item.alicuota_iva === 10.5) alicuotaId = 4;
        else if (item.alicuota_iva === 27) alicuotaId = 6;
        else if (item.alicuota_iva === 5) alicuotaId = 8;
        else if (item.alicuota_iva === 2.5) alicuotaId = 9;
        else if (item.alicuota_iva === 0) alicuotaId = 3;

        const existing = ivaMap.get(alicuotaId) || { base_imp: 0, importe: 0 };
        ivaMap.set(alicuotaId, {
          base_imp: existing.base_imp + lineNeto,
          importe: existing.importe + lineIva
        });
      });

      const ivaAlicuotas = Array.from(ivaMap.entries()).map(([id, val]) => ({
        id,
        base_imp: parseFloat(val.base_imp.toFixed(2)),
        importe: parseFloat(val.importe.toFixed(2))
      }));

      // Guard de Resiliencia Impositiva: Si ImpIVA es 0 pero hay Neto, AFIP exige obligatoriamente mandar el bloque de AlicIva con Id 3 (0%)
      if (ivaAlicuotas.length === 0 && Number(voucher.net_amount) > 0) {
        ivaAlicuotas.push({
          id: 3, // Código AFIP para alícuota 0%
          base_imp: parseFloat(Number(voucher.net_amount).toFixed(2)),
          importe: 0.00
        });
      }

      let ivaXml = "";
      if (ivaAlicuotas && ivaAlicuotas.length > 0) {
        ivaXml = `
        <Iva>
          ${ivaAlicuotas.map(al => `
            <AlicIva>
              <Id>${al.id}</Id>
              <BaseImp>${al.base_imp.toFixed(2)}</BaseImp>
              <Importe>${al.importe.toFixed(2)}</Importe>
            </AlicIva>
          `).join("")}
        </Iva>`;
      }

      // Explicitly format all floats/doubles to 2 decimal places (.toFixed(2)) to satisfy AFIP schema
      const impTotal = Number(voucher.total_amount).toFixed(2);
      const impNeto = Number(voucher.net_amount).toFixed(2);
      const impIva = Number(voucher.iva_amount).toFixed(2);
      const impTotConc = Number(voucher.imp_tot_conc || 0).toFixed(2);
      const impOpEx = Number(voucher.imp_op_ex || 0).toFixed(2);
      const impTrib = Number(voucher.imp_trib || 0).toFixed(2);

      let docTipo = voucher.doc_tipo || 99;
      // Default to 0 for DNI/CF if doc_nro is missing or null
      let docNro = voucher.doc_nro ? Number(voucher.doc_nro) : 0;

      // Guard de Resiliencia Impositiva: Factura A exige CUIT (80)
      if (cbteTipo === 1) {
        docTipo = 80;
        docNro = Number(voucher.client_cuit);
      }
      
      let condicionIvaReceptor = voucher.condicion_iva_receptor || 5;
      // Guard de Resiliencia Impositiva: Factura A exige Responsable Inscripto (1)
      if (cbteTipo === 1 && condicionIvaReceptor !== 1) {
        condicionIvaReceptor = 1;
      }

      // 4. Request CAE (FECAESolicitar)
      // Note: Removed namespaces from inner child tags to follow strict ASP.NET XML Deserialization
      const caeSoapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${companyCuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${ptoVta}</PtoVta>
          <CbteTipo>${cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${docNro}</DocNro>
            <CbteDesde>${nextCbteNro}</CbteDesde>
            <CbteHasta>${nextCbteNro}</CbteHasta>
            <CbteFch>${formatAfipDate(new Date())}</CbteFch>
            <ImpTotal>${impTotal}</ImpTotal>
            <ImpTotConc>${impTotConc}</ImpTotConc>
            <ImpNeto>${impNeto}</ImpNeto>
            <ImpOpEx>${impOpEx}</ImpOpEx>
            <ImpTrib>${impTrib}</ImpTrib>
            <ImpIVA>${impIva}</ImpIVA>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            <CondicionIVAReceptorId>${condicionIvaReceptor}</CondicionIVAReceptorId>
            ${ivaXml}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

      console.log("[ARCA Edge Function] Sending SOAP FECAESolicitar payload...");

      const caeController = new AbortController();
      const caeTimeoutId = setTimeout(() => caeController.abort(), 15000);

      let caeResponse;
      try {
        caeResponse = await fetch(wsfeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            "SOAPAction": "http://ar.gov.afip.dif.FEV1/FECAESolicitar"
          },
          body: caeSoapEnvelope,
          signal: caeController.signal
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          throw new Error("AFIP_TIMEOUT: El servidor de AFIP no respondió a la solicitud de autorización (FECAESolicitar) dentro de los 15 segundos.");
        }
        throw fetchErr;
      } finally {
        clearTimeout(caeTimeoutId);
      }

      const caeResponseText = await caeResponse.text();
      if (!caeResponse.ok) {
        throw new Error(`AFIP WSFE FECAESolicitar responded HTTP ${caeResponse.status}: ${caeResponseText}`);
      }

      // Check general AFIP SOAP Errors
      const caeErrorMatch = caeResponseText.match(/<Err>([\s\S]*?)<\/Err>/);
      if (caeErrorMatch) {
        const codeMatch = caeErrorMatch[1].match(/<Code>(\d+)<\/Code>/);
        const msgMatch = caeErrorMatch[1].match(/<Msg>([^<]+)<\/Msg>/);
        throw new Error(`AFIP Error General: ${codeMatch?.[1] || ""} - ${msgMatch?.[1] || ""}`);
      }

      // Check detail result (Resultado, CAE, CAEFchVto, Obs)
      const resultadoMatch = caeResponseText.match(/<Resultado>([AR])<\/Resultado>/);
      const caeMatch = caeResponseText.match(/<CAE>([^<]+)<\/CAE>/);
      const caeVtoMatch = caeResponseText.match(/<CAEFchVto>(\d{8})<\/CAEFchVto>/);
      const obsMatch = caeResponseText.match(/<Obs>([\s\S]*?)<\/Obs>/);

      const resultado = resultadoMatch ? resultadoMatch[1] : "R";

      if (resultado === "R" || !caeMatch) {
        let obsMsg = "Comprobante rechazado por validaciones de AFIP.";
        if (obsMatch) {
          const obsCode = obsMatch[1].match(/<Code>(\d+)<\/Code>/)?.[1] || "";
          const obsMsgTag = obsMatch[1].match(/<Msg>([^<]+)<\/Msg>/)?.[1] || "";
          obsMsg = `AFIP Rechazo ${obsCode}: ${obsMsgTag}`;
        }
        
        const errPayload = {
          code: "AFIP_REJECTED",
          message: obsMsg,
          timestamp: new Date().toISOString()
        };

        await supabase
          .from("arca_vouchers")
          .update({
            status: "rechazado_afip",
            attempts: nextAttempts,
            error_details: errPayload
          })
          .eq("id", voucherId);

        return new Response(JSON.stringify({ error: obsMsg }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // AFIP Accepted!
      const caeVal = caeMatch[1].trim();
      const expirationRaw = caeVtoMatch ? caeVtoMatch[1].trim() : "";
      
      let caeExpiration = "";
      if (expirationRaw && expirationRaw.length === 8) {
        caeExpiration = `${expirationRaw.substring(0, 4)}-${expirationRaw.substring(4, 6)}-${expirationRaw.substring(6, 8)}`;
      } else {
        caeExpiration = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      }

      finalInvoiceId = formatInvoiceNumber(typeStr, ptoVta, nextCbteNro);

      const qrData = {
        ver: 1,
        fecha: now.toISOString().split("T")[0],
        cuit: Number(companyCuit),
        ptoVta: Number(ptoVta),
        tipoCmp: voucher.doc_tipo === 80 ? 1 : 6,
        nroCmp: nextCbteNro,
        importe: Number(voucher.total_amount),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: Number(voucher.doc_tipo || 99),
        nroDocRec: Number(voucher.doc_nro || 0),
        tipoCodAut: "A",
        codAut: caeVal
      };

      const qrDataBase64 = btoa(JSON.stringify(qrData));
      finalQrLink = `https://www.afip.gob.ar/fe/qr/?p=${qrDataBase64}`;

      const { error: updateErr } = await supabase
        .from("arca_vouchers")
        .update({
          id: finalInvoiceId, // Update provisional PK to final official sequential serial
          status: "autorizado",
          cae: caeVal,
          cae_vto: caeExpiration,
          qr_link: finalQrLink,
          attempts: nextAttempts,
          error_details: null
        })
        .eq("id", voucherId);

      if (updateErr) {
        throw updateErr;
      }

      console.log(`[ARCA Edge Function] REAL WSFE SUCCESS for ${voucherId} -> ${finalInvoiceId}`);
      return new Response(JSON.stringify({ success: true, cae: caeVal, id: finalInvoiceId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    console.error("[ARCA Edge Function] Fatal process failure inside Deno runtime:", err);
    
    // Classify as error_temporal (contingency re-tryable)
    if (voucherId && supabase) {
      const errPayload = {
        code: err.code || "CONNECTION_TIMEOUT",
        message: err.message || "Falla temporal al conectar con los servidores de AFIP.",
        timestamp: new Date().toISOString()
      };

      try {
        await supabase
          .from("arca_vouchers")
          .update({
            status: "error_temporal",
            attempts: nextAttempts,
            error_details: errPayload
          })
          .eq("id", voucherId);
      } catch (dbErr) {
        console.error("[ARCA Edge Function] Double fault updating error status to DB:", dbErr);
      }
    }

    return new Response(JSON.stringify({ error: err.message || "Failed to process authorization" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
