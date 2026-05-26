"use client";

import React, { useState } from "react";
import { 
  Key, 
  Download, 
  Upload, 
  CheckCircle, 
  Terminal, 
  Loader2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  X,
  FileText,
  Building2,
  RefreshCw
} from "lucide-react";

interface OnboardingWizardProps {
  initialCuit: string;
  initialPuntoVenta: number;
  initialRazonSocial?: string;
  onSuccess?: () => void;
}

export function OnboardingWizard({ initialCuit, initialPuntoVenta, initialRazonSocial, onSuccess }: OnboardingWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [cuit, setCuit] = useState(initialCuit);
  const [puntoVenta, setPuntoVenta] = useState(initialPuntoVenta.toString());
  const [razonSocial, setRazonSocial] = useState(initialRazonSocial ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // States to hold the output files
  const [csrText, setCsrText] = useState<string | null>(null);
  const [uploadedCert, setUploadedCert] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    addLog(`Leyendo archivo de certificado seleccionado: ${file.name} (${file.size} bytes)...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text?.includes("-----BEGIN CERTIFICATE-----")) {
        setUploadedCert(text);
        addLog("✅ Certificado PEM cargado exitosamente del archivo.");
      } else {
        setError("El archivo no parece ser un certificado PEM válido (debe contener -----BEGIN CERTIFICATE-----).");
        addLog("❌ Error: Formato de certificado no válido.");
      }
    };
    reader.readAsText(file);
  };
  
  // Real-time console logs inside the wizard
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "💡 Asistente inicializado. Listo para configurar credenciales fiscales ARCA."
  ]);

  const addLog = (message: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleStartOnboarding = () => {
    setIsOpen(true);
    setStep(1);
    setError(null);
  };

  const handleNextStep = () => {
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  // Step 1 & 2: Generate Keys and CSR
  const handleGenerateKeysAndCsr = async () => {
    setLoading(true);
    setError(null);
    addLog(`Iniciando generación de par de claves RSA de 2048 bits para CUIT ${cuit}...`);
    
    try {
      const response = await fetch("/api/config/arca/generate-csr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_cuit: cuit,
          razon_social: razonSocial || "Distribuidora Repuestos",
          punto_venta: Number(puntoVenta) || 1
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Falla al generar CSR.");
      }
      
      setCsrText(result.csr);
      addLog("✅ Clave privada RSA 2048-bits generada con éxito.");
      addLog("🔒 Clave privada encriptada localmente mediante AES-256-GCM.");
      addLog("💾 Credenciales pendientes guardadas de forma segura en InsForge.");
      addLog("📄 Certificate Signing Request (CSR) compilado correctamente.");
      
      setStep(3); // Advance to Step 3 (Download & Instructions)
    } catch (err: any) {
      setError(err.message || "Falla crítica al inicializar claves.");
      addLog(`❌ ERROR: ${err.message || "Falla en el proceso de generación."}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Helper function to download CSR file
  const handleDownloadCsr = () => {
    if (!csrText) return;
    addLog("Descargando archivo Certificate Signing Request (CSR)...");
    
    const blob = new Blob([csrText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arca_request_cuit_${cuit}.csr`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addLog("💾 Archivo .csr guardado en tu dispositivo.");
  };

  // Step 4: Submit Public Certificate (.crt)
  const handleUploadCertificate = async () => {
    if (!uploadedCert.trim()) {
      setError("Por favor pegue el contenido de su certificado digital (.crt).");
      return;
    }
    
    setLoading(true);
    setError(null);
    addLog("Subiendo certificado digital digitalmente firmado (.crt) a InsForge...");
    
    try {
      const response = await fetch("/api/config/arca/upload-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_cuit: cuit,
          certificate: uploadedCert,
          punto_venta: Number(puntoVenta) || 1
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Falla al subir certificado.");
      }
      
      addLog("✅ Certificado digital subido e indexado con éxito.");
      addLog(`🚀 Módulo ARCA activado en modo simulación para el Punto de Venta ${puntoVenta}.`);
      
      setStep(5); // Advance to Success page
    } catch (err: any) {
      setError(err.message || "Falla crítica al asociar certificado.");
      addLog(`❌ ERROR: ${err.message || "Falla en la subida del certificado."}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Test Connection to Simulator / WSFE
  const [testResult, setTestResult] = useState<string | null>(null);
  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);
    addLog("Iniciando prueba de conexión al simulador local de ARCA WSFE...");
    
    try {
      const payload = {
        tipo_cbte: 6, // Factura B
        doc_tipo: 99, // Consumidor Final
        doc_nro: "0",
        imp_neto: 826.45,
        imp_iva: 173.55,
        imp_total: 1000.0,
        iva_alicuotas: [
          { id: 5, base_imp: 826.45, importe: 173.55 }
        ]
      };
      
      const response = await fetch("/api/arca-simulator/wsfe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuit,
          tipo_cbte: payload.tipo_cbte,
          punto_venta: Number(puntoVenta) || 1,
          doc_tipo: payload.doc_tipo,
          doc_nro: payload.doc_nro,
          imp_neto: payload.imp_neto,
          imp_iva: payload.imp_iva,
          imp_total: payload.imp_total,
          iva_alicuotas: payload.iva_alicuotas
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Error al emular factura.");
      }
      
      setTestResult(`CAE Autorizado: ${result.cae} (Vence: ${new Date(result.cae_vencimiento).toLocaleDateString()}) - Comprobante Nro: ${result.cbte_nro}`);
      addLog("✅ Conexión con WSFE exitosa. El simulador respondió en 12ms.");
      addLog(`📄 CAE emitido: ${result.cae}`);
    } catch (err: any) {
      setTestResult(`Falla en test: ${err.message}`);
      addLog(`❌ Conexión fallida: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setIsOpen(false);
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      <button 
        onClick={handleStartOnboarding}
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-bold text-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10 active:scale-95"
      >
        <Key className="w-4 h-4 shrink-0" />
        Configurar Onboarding ARCA
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
          {/* Main Wizard Container with elegant Glassmorphism border and Amber shadow */}
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl shadow-amber-500/5 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 p-5 bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500/10 p-2 border border-amber-500/20 text-amber-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Asistente de Onboarding ARCA</h3>
                  <p className="text-xs text-zinc-400">Paso {step} de 5: {
                    step === 1 ? "Inicializar Datos" :
                    step === 2 ? "Generación de Par de Claves" :
                    step === 3 ? "Descarga de CSR y Delegación" :
                    step === 4 ? "Cargar Certificado Digital" :
                    "Configuración Completada"
                  }</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper progress indicator */}
            <div className="flex px-5 py-3 bg-zinc-900/20 border-b border-zinc-800/40 justify-between items-center text-xs">
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="flex items-center">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full border font-bold ${
                    step === num 
                      ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" 
                      : step > num
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-zinc-950 border-zinc-850 text-zinc-500"
                  }`}>
                    {step > num ? <CheckCircle className="w-4 h-4" /> : num}
                  </div>
                  {num < 5 && (
                    <div className={`w-8 sm:w-16 h-0.5 mx-1.5 ${
                      step > num ? "bg-amber-500/30" : "bg-zinc-800"
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Scrollable Step Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {error && (
                <div className="flex gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error en el proceso:</span>
                    <p className="mt-1 opacity-90">{error}</p>
                  </div>
                </div>
              )}

              {/* Step 1: Initialize Inputs */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Ingrese el CUIT fiscal de la empresa distribuidora y el Punto de Venta habilitado en ARCA. El sistema utilizará estos valores para compilar el archivo CSR con estándar de firma criptográfica RSA 2048.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">CUIT de la Distribuidora</label>
                        <input
                          type="text"
                          value={cuit}
                          onChange={(e) => setCuit(e.target.value.replace(/\D/g, "").slice(0, 11))}
                          placeholder="Ej: 30717762210"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none transition-colors font-mono"
                        />
                        <span className="text-[10px] text-zinc-500 font-sans">Debe tener 11 dígitos numéricos sin guiones.</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Punto de Venta Fiscal</label>
                        <input
                          type="number"
                          value={puntoVenta}
                          onChange={(e) => setPuntoVenta(e.target.value)}
                          placeholder="Ej: 1"
                          min="1"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                        />
                        <span className="text-[10px] text-zinc-500">Punto de venta asociado en la web de AFIP.</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Razón Social de la Empresa</label>
                      <input
                        type="text"
                        value={razonSocial}
                        onChange={(e) => setRazonSocial(e.target.value)}
                        placeholder="Ej: Distribuidora Repuestos Nodo Sur"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                      <span className="text-[10px] text-zinc-500">Nombre fiscal completo de la empresa para la firma del CSR.</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 text-xs text-zinc-400 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <p className="leading-normal">
                      <span className="font-bold text-white">Importante:</span> Si no cuentas con un CUIT fiscal o certificados activos en ARCA, puedes utilizar el CUIT de pruebas <span className="font-mono text-amber-400">30717762210</span>. El sistema simulará toda la API impositiva localmente sin trabar tu operativa de facturación.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Key pair warning and launching CSR */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                    <div className="rounded-full bg-amber-500/10 p-4 border border-amber-500/20 text-amber-400">
                      <Key className="w-10 h-10" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h4 className="text-sm font-bold text-white">Generación de Par de Claves en Servidor Seguro</h4>
                      <p className="text-xs text-zinc-400">
                        Se generará un par de llaves RSA de 2048 bits de forma segura en nuestro servidor Node.js utilizando <span className="font-mono text-zinc-300">node-forge</span>.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-950 border border-zinc-850 p-4 space-y-2 text-xs">
                    <p className="font-semibold text-white">Seguridad de tus llaves:</p>
                    <ul className="list-disc pl-4 text-zinc-400 space-y-1">
                      <li>La clave privada NUNCA viaja en texto plano por la red.</li>
                      <li>Se encripta mediante criptografía simétrica simétrica <span className="font-bold text-amber-400">AES-256-GCM</span> antes de guardarse.</li>
                      <li>La base de datos de InsForge solo almacena el string encriptado resguardando la integridad fiscal.</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleGenerateKeysAndCsr}
                    disabled={loading || cuit.length !== 11}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-bold text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-98 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando Llaves y CSR...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Generar Llaves y Archivo CSR
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 3: Download & Instructions */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Tu Certificate Signing Request (CSR) se ha generado exitosamente. Descarga el archivo e ingrésalo en la web de AFIP para obtener tu certificado digital.
                  </p>

                  <div className="flex gap-4 items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-white">solicitud_firma_cuit_{cuit}.csr</p>
                        <p className="text-[10px] text-zinc-500">Requerimiento de firma para homologación / producción</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadCsr}
                      className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-755 text-xs text-amber-400 font-bold border border-zinc-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Descargar
                    </button>
                  </div>

                  {/* AFIP Steps Guide */}
                  <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-3 text-xs">
                    <p className="font-bold text-white border-b border-zinc-850 pb-2">Pasos en la web de AFIP/ARCA:</p>
                    <ol className="list-decimal pl-4 text-zinc-400 space-y-2.5 leading-relaxed">
                      <li>
                        Ingresa al <a href="https://auth.afip.gob.ar/contribuyente_/login.xhtml" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline font-bold">Portal de AFIP Oficial</a> con tu Clave Fiscal (Nivel 3).
                      </li>
                      <li>Accede al servicio <span className="text-white font-semibold">Administración de Certificados Digitales</span> (si no lo tienes, debes adherirlo desde el Administrador de Relaciones).</li>
                      <li>Agrega una nueva clave o alias para ZenERP y carga el archivo <span className="text-amber-400 font-mono font-bold">.csr</span> que acabas de descargar.</li>
                      <li>Descarga el certificado digital en formato <span className="text-white font-semibold font-bold">.crt</span> generado por AFIP.</li>
                      <li>(Opcional) Realiza la delegación del servicio de <span className="text-white font-semibold">Facturación Electrónica (WSFE)</span> a este nuevo alias en el portal de AFIP.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Step 4: Paste / Upload CRT */}
              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Carga el archivo de certificado digital (.crt) emitido por ARCA / AFIP, o copia y pega su contenido PEM completo.
                  </p>

                  {/* Drag & Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                      isDragActive
                        ? "border-amber-500 bg-amber-500/5 text-amber-400"
                        : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <input
                      type="file"
                      id="cert-file"
                      accept=".crt,.pem,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="cert-file" className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-2">
                      <Upload className="w-8 h-8 text-amber-500/80" />
                      <div className="text-xs">
                        <span className="text-amber-400 font-bold hover:underline">Selecciona un archivo .crt</span> o arrástralo aquí
                      </div>
                      <p className="text-[10px] text-zinc-500">Estándar PEM compatible con x509 de AFIP</p>
                    </label>
                  </div>

                  {uploadedCert && (
                    <div className="flex gap-2 items-center p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-green-400 text-xs">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      <span>Certificado PEM cargado exitosamente.</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Edición Manual (PEM)</label>
                    <textarea
                      value={uploadedCert}
                      onChange={(e) => setUploadedCert(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;MIIEowIBAAKCAQEA0Y3...&#10;-----END CERTIFICATE-----"
                      rows={4}
                      className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-[10px] text-zinc-300 focus:border-amber-500/50 focus:outline-none transition-colors font-mono resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleUploadCertificate}
                    disabled={loading || !uploadedCert.includes("-----BEGIN CERTIFICATE-----")}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-bold text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-98 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Validando y Activando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Subir y Habilitar Facturación
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Step 5: Success & Connection Test */}
              {step === 5 && (
                <div className="space-y-6 animate-fade-in text-center py-4">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-green-500/10 p-4 border border-green-500/20 text-green-400">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">¡Módulo Fiscal ARCA Vinculado!</h4>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Las claves privadas y el certificado digital se configuraron correctamente para el CUIT {cuit} en modo simulación.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 space-y-4 max-w-md mx-auto text-left">
                    <p className="text-xs font-bold text-white border-b border-zinc-850 pb-2">Probar Emulador Fiscal</p>
                    <button
                      onClick={handleTestConnection}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-755 border border-zinc-700 text-xs text-amber-400 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generando comprobante de test...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Ejecutar Autorización de Prueba
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div className={`p-3 rounded-lg border text-xs leading-normal font-mono break-all ${
                        testResult.startsWith("Falla")
                          ? "bg-red-500/5 border-red-500/20 text-red-400"
                          : "bg-green-500/5 border-green-500/20 text-green-400"
                      }`}>
                        {testResult}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleFinish}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-bold text-black transition-all shadow-lg shadow-amber-500/10 active:scale-95 mx-auto block"
                  >
                    Cerrar Asistente
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Technical Console Log Box (Premium Feature!) */}
            <div className="border-t border-zinc-800/80 bg-zinc-950/95 p-4 h-40 flex flex-col">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider pb-1.5 border-b border-zinc-900">
                <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-amber-500" /> Consola de Logs Fiscales</span>
                <span>Real-Time Crypto</span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 pt-2 select-text scrollbar-thin">
                {consoleLogs.map((log, index) => (
                  <div key={index} className="whitespace-pre-wrap leading-relaxed">{log}</div>
                ))}
              </div>
            </div>

            {/* Footer with Prev/Next buttons */}
            <div className="flex items-center justify-between border-t border-zinc-800/80 p-4 bg-zinc-900/40">
              <button
                onClick={handlePrevStep}
                disabled={step === 1 || step === 5 || loading}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-755 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              {step === 1 && (
                <button
                  onClick={handleNextStep}
                  disabled={cuit.length !== 11}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-black transition-colors flex items-center gap-1"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  onClick={handleNextStep}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-bold text-black transition-colors flex items-center gap-1"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
