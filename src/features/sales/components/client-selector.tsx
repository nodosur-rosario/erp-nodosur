"use client";

import { useEffect, useState } from "react";
import { User, Building2, ChevronDown, Check, UserPlus, Loader2, Sparkles, MapPin } from "lucide-react";
import { useSalesStore } from "../store/use-sales-store";
import { useSecretStore } from "../store/use-secret-store";
import { useCompanyStore } from "@/core/company/company-store";
import { toast } from "sonner";
import { getSupabaseClient } from "@/core/api/supabase";

// Generador de UUIDv4 compatible con contextos no seguros (HTTP / IP local)
function generateUUID() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback RFC 4122 para entornos HTTP fuera de localhost
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ClientSelector() {
  const salesStore = useSalesStore();
  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);
  const activeCompany = useCompanyStore((state) => state.currentCompany);
  const [isOpen, setIsOpen] = useState(false);
  const [dniInput, setDniInput] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerAddress, setRegisterAddress] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // States for ARCA WSPUC Padrón API Integration
  const [loadingArca, setLoadingArca] = useState(false);
  const [arcaCustomer, setArcaCustomer] = useState<any>(null);

  useEffect(() => {
    salesStore.fetchCustomers();
  }, []);

  // Automatically adjust registration form if input changes
  useEffect(() => {
    if (!dniInput.trim()) {
      setShowRegisterForm(false);
      setRegisterName("");
      setRegisterAddress("");
    }
  }, [dniInput]);

  // Automatically query ARCA WSPUC (Padrón) if input has 11 digits (CUIT) and doesn't exist locally
  useEffect(() => {
    const queryCuit = dniInput.trim();
    if (queryCuit.length === 11 && /^\d+$/.test(queryCuit)) {
      const alreadyExists = salesStore.customers.some(c => c.cuit === queryCuit);
      if (alreadyExists) {
        setArcaCustomer(null);
        return;
      }

      const fetchArcaData = async () => {
        setLoadingArca(true);
        setArcaCustomer(null);
        try {
          const companyCuit = activeCompany?.cuit || "30717762210";
          const res = await fetch(`/api/arca/padron/${queryCuit}?companyCuit=${companyCuit}`);
          const result = await res.json();
          if (result.success && result.data) {
            setArcaCustomer(result.data);
            toast.success("Contribuyente localizado en el Padrón de ARCA");
          } else {
            toast.error(result.error || "No se pudo localizar el CUIT en ARCA.");
          }
        } catch (err) {
          console.error("Error al consultar padrón ARCA:", err);
          toast.error("Error de conexión con el padrón fiscal.");
        } finally {
          setLoadingArca(false);
        }
      };

      fetchArcaData();
    } else {
      setArcaCustomer(null);
    }
  }, [dniInput, salesStore.customers, activeCompany]);

  const handleSelectArcaCustomer = async () => {
    if (!arcaCustomer || !activeCompany) return;
    setIsRegistering(true);
    try {
      const client = getSupabaseClient();
      const newCustomer = {
        id: generateUUID(),
        cuit: arcaCustomer.cuit,
        razon_social: arcaCustomer.razonSocial,
        condicion_iva: arcaCustomer.condicionIva,
        direccion: arcaCustomer.direccion || null,
        email: null,
        phone: null,
        company_cuit: activeCompany.cuit
      };

      const { error } = await client.database
        .from("customers")
        .insert([newCustomer]);

      if (error) throw error;

      toast.success(`Cliente "${newCustomer.razon_social}" registrado y vinculado con éxito.`);
      
      salesStore.setClient(newCustomer.cuit, newCustomer.razon_social, newCustomer.condicion_iva);
      
      // Auto-set the correct voucher type in POS based on fiscal IVA condition (RG 5003/2021)
      if (newCustomer.condicion_iva === "Responsable Inscripto" || newCustomer.condicion_iva === "Monotributista") {
        salesStore.setVoucherType("Factura A");
      } else {
        salesStore.setVoucherType("Factura B");
      }

      await salesStore.fetchCustomers();
      setDniInput("");
      setArcaCustomer(null);
    } catch (err: any) {
      console.error("Error al registrar cliente desde padrón ARCA:", err);
      toast.error(`Error al registrar cliente: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSelectFinalConsumer = () => {
    // If DNI is provided, append it to the name or keep it in the CUIT field
    const cuitOrDni = dniInput.trim() ? dniInput.trim() : "99999999999";
    salesStore.setClient(cuitOrDni, "Consumidor Final", "Consumidor Final");
    setIsOpen(false);
  };

  // customer type is casted as any due to InsForge dynamic schema type
  const handleSelectCustomer = (customer: any) => {
    salesStore.setClient(customer.cuit, customer.razon_social, customer.condicion_iva);
    setDniInput(""); // Clear DNI input
    setIsOpen(false);
  };

  const handleRegisterCustomer = async () => {
    if (!dniInput.trim()) {
      toast.error("El DNI no puede estar vacío.");
      return;
    }
    if (!registerName.trim()) {
      toast.error("El nombre es requerido.");
      return;
    }

    if (!activeCompany) {
      toast.error("Debe tener una empresa activa.");
      return;
    }

    setIsRegistering(true);
    try {
      const client = getSupabaseClient();
      const newCustomer = {
        id: generateUUID(),
        cuit: dniInput.trim(),
        razon_social: registerName.trim(),
        condicion_iva: "Consumidor Final",
        direccion: registerAddress.trim() || null,
        email: null,
        phone: null,
        company_cuit: activeCompany.cuit
      };

      const { error } = await client.database
        .from("customers")
        .insert([newCustomer]);

      if (error) throw error;

      toast.success(`Cliente "${newCustomer.razon_social}" registrado con éxito.`);
      
      // Auto-select the newly created customer in store
      salesStore.setClient(newCustomer.cuit, newCustomer.razon_social, newCustomer.condicion_iva);
      
      // Refresh the customer dropdown list
      await salesStore.fetchCustomers();
      
      // Clear forms
      setShowRegisterForm(false);
      setRegisterName("");
      setRegisterAddress("");
      setDniInput("");
    } catch (err: any) {
      console.error("Error registering customer:", err);
      toast.error(`Error al registrar cliente: ${err.message || "Verifique duplicación de DNI/CUIT"}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const isFinalConsumer = salesStore.clientName === "Consumidor Final";

  // Check if entered DNI matches a customer that already exists in the database
  const existingCustomer = salesStore.customers.find(
    (c) => c.cuit === dniInput.trim()
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 border-b border-zinc-850 pb-2">
        <User className="w-4 h-4 text-amber-500" />
        <span>Datos del Cliente & Factura</span>
      </h2>

      <div className="grid gap-3">
        {/* Customer Selector */}
        <div className="space-y-1 relative">
          <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Seleccionar Cliente</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex flex-col items-start px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-850 text-xs text-white hover:border-amber-500/40 transition-colors gap-1"
            >
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-medium truncate">
                    {isFinalConsumer ? "Consumidor Final" : `${salesStore.clientName} (CUIT: ${salesStore.clientCuit})`}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              
              {/* Dynamic DocTipo label so salesperson instantly knows AFIP compliance */}
              <div className="text-[8px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-1 mt-0.5 select-none">
                {(() => {
                  const cuitVal = salesStore.clientCuit.trim();
                  if (cuitVal === "99999999999") {
                    return <span className="text-zinc-500">TIPO DOC: 99 (Consumidor Final / Sin Identificar)</span>;
                  } else if (cuitVal.length === 11 && /^\d+$/.test(cuitVal)) {
                    return <span className="text-amber-400">TIPO DOC: 80 (CUIT) — Nro: {cuitVal}</span>;
                  } else if (cuitVal.length >= 6 && cuitVal.length <= 8 && /^\d+$/.test(cuitVal)) {
                    return <span className="text-emerald-400">TIPO DOC: 96 (DNI) — Nro: {cuitVal}</span>;
                  } else {
                    return <span className="text-yellow-400 font-black">TIPO DOC: 96 (DNI) — Nro: {cuitVal}</span>;
                  }
                })()}
              </div>
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden p-1 custom-scrollbar">
                <button
                  onClick={handleSelectFinalConsumer}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                    isFinalConsumer ? "bg-amber-500/10 text-amber-400" : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <div>
                    <span className="font-bold">Consumidor Final (Sin Datos)</span>
                    <span className="block text-[8px] text-zinc-500 font-mono">TIPO DOC: 99 (Consumidor Final)</span>
                  </div>
                  {isFinalConsumer && <Check className="w-3 h-3" />}
                </button>
                
                {salesStore.customers.length > 0 && (
                  <div className="px-2 py-1.5 mt-1 border-t border-zinc-850">
                    <span className="text-[9px] font-bold uppercase text-zinc-600 tracking-widest">Clientes Frecuentes</span>
                  </div>
                )}
                
                {salesStore.customers.map((c) => {
                  const docTypeLabel = c.cuit.length === 11 ? "TIPO DOC: 80 (CUIT)" : "TIPO DOC: 96 (DNI)";
                  return (
                    <button
                      key={c.id || c.cuit}
                      onClick={() => handleSelectCustomer(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                        salesStore.clientCuit === c.cuit && !isFinalConsumer ? "bg-amber-500/10 text-amber-400" : "text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <div>
                        <span className="block font-bold">{c.razon_social}</span>
                        <span className="block text-[9px] text-zinc-500 font-mono">CUIT/DNI: {c.cuit} | {c.condicion_iva}</span>
                        <span className="block text-[8px] text-zinc-500 font-mono font-extrabold text-amber-500/80">{docTypeLabel}</span>
                      </div>
                      {salesStore.clientCuit === c.cuit && !isFinalConsumer && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
             {/* DNI / CUIT Field for Final Consumers (Optional) */}
        {isFinalConsumer && (
          <div className="space-y-3 animate-fade-in">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest flex items-center justify-between">
                <span>DNI o CUIT (Autocompletar ARCA)</span>
                <span className="text-[8px] text-amber-500/70 lowercase">obligatorio &gt; $344k</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={dniInput}
                  onChange={(e) => {
                    setDniInput(e.target.value.replace(/\D/g, "").slice(0, 11));
                    const val = e.target.value.trim() || "99999999999";
                    salesStore.setClient(val, "Consumidor Final", "Consumidor Final");
                  }}
                  placeholder="ej. 20371024094 o DNI"
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-zinc-950 border border-zinc-850 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 font-mono"
                />
                {loadingArca && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* WSPUC ARCA Interactive Autocomplete Card */}
            {arcaCustomer && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 animate-fade-in shadow-lg shadow-amber-500/5 relative overflow-hidden">
                <div className="absolute -right-3 -top-3 opacity-10 text-amber-400">
                  <Sparkles className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-[8px] font-extrabold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25 tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" /> Padrón de ARCA / AFIP
                  </span>
                  <p className="font-bold text-white text-xs leading-tight pt-1">{arcaCustomer.razonSocial}</p>
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1 pt-0.5">
                    <Building2 className="w-3 h-3 text-zinc-500" />
                    CUIT: <span className="font-mono text-zinc-300">{arcaCustomer.cuit}</span> | <span className="font-semibold text-amber-500/90">{arcaCustomer.condicionIva}</span>
                  </p>
                  {arcaCustomer.direccion && (
                    <p className="text-[10px] text-zinc-500 flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-zinc-650 mt-0.5 shrink-0" />
                      <span className="truncate">{arcaCustomer.direccion}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSelectArcaCustomer}
                  disabled={isRegistering}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow shadow-amber-500/10 active:scale-97 transition-all"
                >
                  {isRegistering ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Registrar y Vincular en POS</span>
                </button>
              </div>
            )}

            {/* DNI Interactive Context Box */}
            {dniInput.trim().length >= 6 && dniInput.trim().length < 11 && (
              <div className="p-3.5 rounded-xl border border-zinc-850 bg-zinc-900/20 space-y-2.5 animate-fade-in">
                {existingCustomer ? (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold uppercase text-emerald-500 tracking-wider">Cliente Existente</span>
                      <p className="font-bold text-white leading-tight">{existingCustomer.razon_social}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer(existingCustomer)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-extrabold text-[10px] transition-colors uppercase tracking-wider"
                    >
                      Seleccionar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!showRegisterForm ? (
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-zinc-400 text-[10px]">Este DNI no figura como cliente frecuente.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRegisterName("");
                            setRegisterAddress("");
                            setShowRegisterForm(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 font-extrabold text-[10px] transition-colors flex items-center gap-1.5 uppercase tracking-wider shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Registrar</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 animate-fade-in border-t border-zinc-850/60 pt-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Nombre / Razón Social</label>
                          <input
                            type="text"
                            value={registerName}
                            onChange={(e) => setRegisterName(e.target.value)}
                            placeholder="ej. Juan Pérez"
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-amber-500/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Dirección (Opcional)</label>
                          <input
                            type="text"
                            value={registerAddress}
                            onChange={(e) => setRegisterAddress(e.target.value)}
                            placeholder="ej. Av. Pellegrini 1500"
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-amber-500/40"
                          />
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setShowRegisterForm(false)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 font-bold text-[10px] transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleRegisterCustomer}
                            disabled={isRegistering || !registerName.trim()}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 disabled:opacity-40 text-black font-extrabold text-[10px] transition-all flex items-center gap-1.5 uppercase tracking-wider"
                          >
                            {isRegistering ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Voucher Indicator */}
        <div className="space-y-1 pt-1 border-t border-zinc-900/60 mt-1">
          <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Tipo de Comprobante</label>
          <div className="grid grid-cols-2 gap-2">
            {(() => {
              const availableVouchers = ["Factura A", "Factura B", "Factura C"];
              if (showCajaNegra) {
                availableVouchers.push("Ticket Interno B");
              }
              return availableVouchers.map((type) => {
                // AFIP Fiscal Rules: Auto-disable illegal selections
                let isDisabled = false;
                const isCForExento = salesStore.clientIvaCondition === "Consumidor Final" || salesStore.clientIvaCondition === "Exento";
                const isRIorMono = salesStore.clientIvaCondition === "Responsable Inscripto" || salesStore.clientIvaCondition === "Monotributista";

                if (type === "Factura A") {
                  isDisabled = isCForExento; // Anonymous/Exentos can't receive Factura A
                } else if (type === "Factura B" || type === "Factura C") {
                  isDisabled = isRIorMono; // Registered tax payers MUST receive Factura A
                }

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => salesStore.setVoucherType(type as any)}
                    className={`py-2 text-xs font-extrabold rounded-xl border transition ${
                      isDisabled
                        ? "bg-zinc-950/20 border-zinc-900/60 text-zinc-700 cursor-not-allowed opacity-30"
                        : salesStore.voucherType === type
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold shadow shadow-amber-500/5"
                        : "bg-zinc-950 border-zinc-850 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                    title={
                      isDisabled
                        ? `No permitido por AFIP para clientes con condición: ${salesStore.clientIvaCondition}`
                        : `Emitir comprobante tipo ${type}`
                    }
                  >
                    {type}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
