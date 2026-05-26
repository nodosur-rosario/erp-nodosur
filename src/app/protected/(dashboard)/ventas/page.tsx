"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Sparkles,
  AlertCircle,
  Car,
  Check,
  TrendingUp,
  Users,
  FileText,
  FileCheck2,
  Building,
  Loader2,
  Coins,
  ChevronRight,
  Info,
  Building2,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  X,
  CreditCard,
  Wallet,
  Landmark,
  Handshake,
  ShieldAlert,
  CheckCircle2,
  Printer
} from "lucide-react";
import { toast } from "@/core/notification/toast";
import { useCompanyStore } from "@/core/company/company-store";
import { useSalesStore, CartItem } from "@/features/sales/store/use-sales-store";
import { getSupabaseClient } from "@/core/api/supabase";
import { ClientSelector } from "@/features/sales/components/client-selector";
import { getCreditAccount } from "@/features/customers/services/credit-service";
import { useRouter } from "next/navigation";
import { authorizeInvoice } from "@/features/arca/actions";
import { getAlicuotas, AlicuotaIva } from "@/features/accounting/services/alicuota-service";
import { roundCommercial } from "@/features/sales/utils/pricing-rules";

// Database Article interface
interface DbArticle {
  id: string;
  codigo_fabricante: string;
  codigo_barras: string | null;
  descripcion: string;
  marca_id: string;
  familia_id: string;
  precio_costo: string | number;
  precio_minorista: string | number;
  precio_mayorista: string | number;
  stock_actual: number;
  stock_minimo: number;
  ubicacion_deposito: string | null;
  marca: { nombre: string } | null;
  familia: { nombre: string } | null;
}

// Vehicle compatibility interface
interface Compatibility {
  observaciones: string | null;
  auto_version: {
    motorizacion: string;
    anio_desde: number;
    anio_hasta: number | null;
    auto_modelo: {
      nombre: string;
      auto_marca: {
        nombre: string;
      };
    };
  } | null;
}

export default function VentasPage() {
  const router = useRouter();
  const activeCompany = useCompanyStore((state) => state.currentCompany);
  // Zustand optimized store selectors for high-density rendering performance
  const salesStore = {
    cart: useSalesStore((state) => state.cart),
    customers: useSalesStore((state) => state.customers),
    clientName: useSalesStore((state) => state.clientName),
    clientCuit: useSalesStore((state) => state.clientCuit),
    clientIvaCondition: useSalesStore((state) => state.clientIvaCondition),
    voucherType: useSalesStore((state) => state.voucherType),
    paymentMethod: useSalesStore((state) => state.paymentMethod),
    isSubmitting: useSalesStore((state) => state.isSubmitting),
    addItem: useSalesStore((state) => state.addItem),
    removeItem: useSalesStore((state) => state.removeItem),
    updateQuantity: useSalesStore((state) => state.updateQuantity),
    updateAlicuota: useSalesStore((state) => state.updateAlicuota),
    setClient: useSalesStore((state) => state.setClient),
    setVoucherType: useSalesStore((state) => state.setVoucherType),
    setPaymentMethod: useSalesStore((state) => state.setPaymentMethod),
    clearSales: useSalesStore((state) => state.clearSales),
    fetchCustomers: useSalesStore((state) => state.fetchCustomers),
  };

  // Component local states
  const [articles, setArticles] = useState<DbArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFamily, setSelectedFamily] = useState("all");
  const [families, setFamilies] = useState<string[]>([]);

  // Dynamic compatibility loading
  const [loadingCompat, setLoadingCompat] = useState<string | null>(null);
  const [compatData, setCompatData] = useState<{ [articleId: string]: Compatibility[] }>({});
  const [activeCompatArticle, setActiveCompatArticle] = useState<string | null>(null);
  const [hoveredArticleId, setHoveredArticleId] = useState<string | null>(null);

  // checkout AFIP status
  const [afipStatus, setAfipStatus] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<{ message: string; details?: string[] } | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ invoiceNumber: string; cae: string | null; clientName: string; totalAmount: number; items?: any[] } | null>(null);
  const [dbAlicuotas, setDbAlicuotas] = useState<AlicuotaIva[]>([]);
  const [isCajaOpen, setIsCajaOpen] = useState<boolean>(true);
  const [pendingVouchers, setPendingVouchers] = useState<any[]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [retryingVoucherId, setRetryingVoucherId] = useState<string | null>(null);

  // Load pending vouchers that have no CAE or errored
  const loadPendingVouchers = async () => {
    if (!activeCompany) return;
    setLoadingPending(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("arca_vouchers")
        .select("*")
        .eq("company_cuit", activeCompany.cuit)
        .in("status", ["pendiente_cae", "error_temporal", "rechazado_afip"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingVouchers(data || []);
    } catch (e) {
      console.error("Error loading pending vouchers:", e);
    } finally {
      setLoadingPending(false);
    }
  };

  // Subscribe to real-time changes of arca_vouchers table
  useEffect(() => {
    loadPendingVouchers();
  }, [activeCompany]);

  useEffect(() => {
    if (!activeCompany) return;
    
    const supabase = getSupabaseClient();
    if (!supabase.raw) return;

    const channel = supabase.raw
      .channel("arca-vouchers-pending-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "arca_vouchers",
          filter: `company_cuit=eq.${activeCompany.cuit}`
        },
        () => {
          loadPendingVouchers();
        }
      )
      .subscribe();

    return () => {
      supabase.raw.removeChannel(channel);
    };
  }, [activeCompany]);

  const handleManualRetry = async (voucher: any) => {
    setRetryingVoucherId(voucher.id);
    toast.info(`Iniciando reintento manual para comprobante ${voucher.id}...`);
    try {
      const supabase = getSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (supabase.raw as any)?.supabaseUrl || "";
      const functionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/autorizar-comprobante`;
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabase.raw?.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({
          record: {
            id: voucher.id,
            company_cuit: voucher.company_cuit,
            status: "pendiente_cae",
            attempts: voucher.attempts
          }
        })
      });

      if (!response.ok) {
        const errorText = `Error del servidor de base de datos (HTTP ${response.status})`;
        toast.error(errorText);
        setCheckoutError({
          message: "No se pudo conectar con la Edge Function de autorización.",
          details: [
            errorText,
            "Por favor, verificá que los servicios de Supabase estén en línea o reintentá en unos momentos."
          ]
        });
        return;
      }

      const result = await response.json();
      if (result.error) {
        toast.error(`Rechazo de AFIP: ${result.error}`);
        setCheckoutError({
          message: "El servidor de AFIP rechazó la autorización del comprobante.",
          details: [
            result.error,
            "Si el error se debe a datos incorrectos del cliente (DNI/CUIT/Condición IVA), podés descartar este comprobante provisorio de forma segura (restituyendo stock) y volver a emitir la venta con los datos correctos."
          ]
        });
        return;
      }

      toast.success("¡Solicitud de CAE reintentada! El resultado se reflejará en instantes.", { visual: true });
      loadPendingVouchers();
    } catch (err: any) {
      console.error("Error retrying manual authorization:", err);
      toast.error(`Falla al reintentar: ${err.message || err}`);
      setCheckoutError({
        message: "Ocurrió un error inesperado al procesar el reintento.",
        details: [
          err.message || err,
          "Consulte con soporte técnico si el problema persiste."
        ]
      });
    } finally {
      setRetryingVoucherId(null);
    }
  };

  const handleDiscardVoucher = async (voucherId: string) => {
    if (!window.confirm("¿Estás seguro de que querés descartar esta venta rechazada? Como no tiene CAE, no tiene ninguna validez fiscal y se eliminará permanentemente.")) return;
    
    try {
      const client = getSupabaseClient();
      const { error } = await client.database
        .from("arca_vouchers")
        .delete()
        .eq("id", voucherId);

      if (error) throw error;
      toast.success("Comprobante descartado y eliminado con éxito.", { visual: true });
      loadPendingVouchers();
    } catch (e: any) {
      toast.error(`Error al descartar: ${e.message || e}`);
    }
  };

  const handleShareWhatsApp = (voucher: any) => {
    const companyName = activeCompany?.nombre_fantasia || activeCompany?.razon_social || "";
    const message = `Hola ${voucher.client_name || "Cliente"}! Adjuntamos tu comprobante oficial de ${companyName}. Factura: ${voucher.id}. Podés consultar y descargar el QR oficial de AFIP en: ${voucher.qr_link || '—'}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleShareEmail = (voucher: any) => {
    const companyName = activeCompany?.nombre_fantasia || activeCompany?.razon_social || "";
    const subject = `Comprobante de compra oficial — ${voucher.id}`;
    const body = `Hola ${voucher.client_name || "Cliente"},\n\nAdjuntamos la constancia de su factura electrónica autorizada por AFIP.\n\nNúmero de comprobante: ${voucher.id}\nImporte Total: $${Number(voucher.total_amount).toFixed(2)}\nCódigo de Autorización CAE: ${voucher.cae || '—'}\n\nPuede visualizar el QR oficial en: ${voucher.qr_link || '—'}\n\nMuchas gracias por su confianza.\n${companyName}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  // Load articles from database
  const loadCatalog = async () => {
    setLoadingArticles(true);
    try {
      const client = getSupabaseClient();

      // Fetch articles with marca and familia relations
      const { data, error } = await client.database
        .from("articulo")
        .select(`
          *,
          marca:marca_id(nombre),
          familia:familia_id(nombre)
        `)
        .order("descripcion", { ascending: true });

      if (error) throw error;

      const loadedArticles = (data as any[]) || [];
      setArticles(loadedArticles);

      // Extract unique families for quick filter
      const famNames: string[] = Array.from(
        new Set(
          loadedArticles
            .map((art) => art.familia?.nombre)
            .filter((name): name is string => !!name)
        )
      );
      setFamilies(famNames);
    } catch (err: any) {
      console.error("Error loading catalog:", err);
      toast.error("No se pudo cargar el catálogo de repuestos.");
    } finally {
      setLoadingArticles(false);
    }
  };

  const loadAlicuotas = async () => {
    try {
      const res = await getAlicuotas();
      if (!res.error && res.data) {
        // Guardar sólo las alícuotas que estén activas
        setDbAlicuotas(res.data.filter(a => a.activa));
      }
    } catch (err) {
      console.error("Error loading active alicuotas:", err);
    }
  };

  const checkCajaSession = async () => {
    if (!activeCompany) return;
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("caja_sesion")
        .select("id")
        .eq("cuit", activeCompany.cuit)
        .eq("estado", "abierta")
        .maybeSingle();

      if (!error) {
        setIsCajaOpen(!!data);
      }
    } catch (err) {
      console.error("Error checking daily cash session:", err);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadAlicuotas();
    checkCajaSession();
    // Initialize default client
    salesStore.clearSales();
  }, [activeCompany]);

  // Handle hotkey F9 to confirm invoice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [salesStore.cart, salesStore.clientCuit, salesStore.clientName, activeCompany]);

  // Handle hotkeys Esc or Space to close checkout success modal and auto-focus search input
  useEffect(() => {
    if (!checkoutSuccess) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        setCheckoutSuccess(null);
        setTimeout(() => {
          const searchInput = document.getElementById("catalog-search-input");
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [checkoutSuccess]);

  // Suscripción Realtime para actualizar en caliente cuando AFIP otorgue el CAE
  useEffect(() => {
    if (!checkoutSuccess || checkoutSuccess.cae !== null) return;

    const supabase = getSupabaseClient();
    if (!supabase.raw) {
      console.warn("[Realtime AFIP] Raw Supabase client is not available. Realtime updates disabled.");
      return;
    }
    
    console.log(`[Realtime AFIP] Subscribing to updates for provisional invoice ${checkoutSuccess.invoiceNumber}...`);

    const channel = supabase.raw
      .channel("arca-voucher-cae-listener")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arca_vouchers",
        },
        (payload: any) => {
          console.log("[Realtime AFIP] Event received:", payload);
          const oldRecord = payload.old;
          const newRecord = payload.new;
          
          if (oldRecord && oldRecord.id === checkoutSuccess.invoiceNumber) {
            if (newRecord.status === "autorizado") {
              toast.success(`¡Comprobante Oficial Autorizado! Nº: ${newRecord.id}`, { visual: true });
              
              // Soft confirmation audio ping
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 tone
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
              } catch (e) {}

              setCheckoutSuccess({
                invoiceNumber: newRecord.id,
                cae: newRecord.cae,
                clientName: newRecord.client_name || checkoutSuccess.clientName,
                totalAmount: Number(newRecord.total_amount) || checkoutSuccess.totalAmount,
                items: checkoutSuccess.items
              });
            } else if (newRecord.status === "rechazado_afip" || newRecord.status === "error_temporal") {
              const errorMsg = newRecord.error_details?.message || "Rechazo de AFIP o falla de conexión temporal.";
              
              toast.error(`Error en AFIP: ${errorMsg}`);
              
              // Soft error alert audio ping
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = "sawtooth";
                oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // A3 low pitch
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.3);
              } catch (e) {}

              setCheckoutError({
                message: newRecord.status === "rechazado_afip" 
                  ? "El servidor de AFIP rechazó la emisión del comprobante oficial."
                  : "Ocurrió una falla de conexión temporal con los servidores de AFIP.",
                details: [
                  errorMsg,
                  "Tu stock, contabilidad y balances de caja han sido revertidos automáticamente por seguridad."
                ]
              });
              setCheckoutSuccess(null); // Close the provisional success modal
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.raw.removeChannel(channel);
    };
  }, [checkoutSuccess]);

  // Load compatibility on demand
  const handleLoadCompatibility = async (articleId: string) => {
    if (compatData[articleId]) {
      setActiveCompatArticle(articleId);
      return;
    }
    setLoadingCompat(articleId);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("articulo_compatibilidad")
        .select(`
          observaciones,
          auto_version:auto_version_id (
            motorizacion,
            anio_desde,
            anio_hasta,
            auto_modelo:modelo_id (
              nombre,
              auto_marca:marca_id (
                nombre
              )
            )
          )
        `)
        .eq("articulo_id", articleId);

      if (error) throw error;

      setCompatData(prev => ({ ...prev, [articleId]: (data as any[]) || [] }));
      setActiveCompatArticle(articleId);
    } catch (err) {
      console.error("Error loading compatibility data:", err);
      toast.error("No se pudieron cargar las compatibilidades.");
    } finally {
      setLoadingCompat(null);
    }
  };

  // Cart financial math computations
  const calculateCartTotals = () => {
    let subtotalNeto = 0;
    let totalIva = 0;
    let rawTotalAmount = 0;

    const isFiscal = salesStore.voucherType !== "Ticket Interno B";

    salesStore.cart.forEach((item) => {
      const lineNeto = item.cantidad * item.precio_unitario;
      const appliedRate = isFiscal ? item.alicuota_iva : 0;
      const lineIva = lineNeto * (appliedRate / 100);
      const lineTotal = lineNeto + lineIva;

      subtotalNeto += lineNeto;
      totalIva += lineIva;
      rawTotalAmount += lineTotal;
    });

    // Para comprobantes fiscales, sumamos el neto y el IVA con precisión de centavos para evitar rechazos de AFIP.
    // Para comprobantes internos (Ticket B), aplicamos redondeo comercial a múltiplos de 10 pesos.
    const totalAmount = isFiscal
      ? parseFloat((subtotalNeto + totalIva).toFixed(2))
      : roundCommercial(rawTotalAmount, 10);

    return {
      subtotalNeto,
      totalIva,
      totalAmount
    };
  };

  const { subtotalNeto, totalIva, totalAmount } = calculateCartTotals();

  // Checkout process with stock decrements and official AFIP auth simulations
  const handleCheckout = async () => {
    if (!activeCompany) {
      toast.error("Debe iniciar sesión en una empresa (CUIT) para facturar.");
      return;
    }
    if (salesStore.cart.length === 0) {
      toast.error("El carrito está vacío. Cargue artículos antes de cobrar.");
      return;
    }
    if (!salesStore.clientCuit || salesStore.clientCuit.trim().length < 6) {
      toast.error("Seleccione un cliente válido.");
      return;
    }
    if (!salesStore.clientName || salesStore.clientName.trim().length === 0) {
      toast.error("Seleccione un cliente válido.");
      return;
    }

    const cleanedCuit = salesStore.clientCuit.trim();
    const isFiscal = salesStore.voucherType !== "Ticket Interno B";

    // --- AFIP/ARCA PREVENTIVE VALIDATION GATE (RG 4444) ---
    if (isFiscal) {
      const isConsumidorFinal = cleanedCuit === "99999999999" || salesStore.clientName.toLowerCase().includes("consumidor final");

      if (isConsumidorFinal) {
        // Validación de límites de AFIP para Consumidor Final sin identificar
        if (salesStore.paymentMethod === "efectivo" && totalAmount > 191104) {
          toast.error("AFIP exige identificar al cliente (DNI/CUIT) para compras en efectivo mayores a $191.104. Por favor, selecciona un cliente identificado.");
          return;
        }
        if ((salesStore.paymentMethod === "tarjeta" || salesStore.paymentMethod === "transferencia") && totalAmount > 382208) {
          toast.error("AFIP exige identificar al cliente (DNI/CUIT) para compras con tarjeta/transferencia mayores a $382.208. Por favor, selecciona un cliente identificado.");
          return;
        }
      }

      // Validación estricta para Factura A
      if (salesStore.voucherType === "Factura A") {
        if (isConsumidorFinal) {
          toast.error("La Factura A exige un cliente Responsable Inscripto identificado con CUIT. No es válida para Consumidor Final.");
          return;
        }
        if (!/^\d{11}$/.test(cleanedCuit)) {
          toast.error("La Factura A exige un CUIT válido de 11 dígitos numéricos.");
          return;
        }
        if (salesStore.clientIvaCondition !== "Responsable Inscripto") {
          toast.error("La Factura A solo se puede emitir a clientes con condición de IVA 'Responsable Inscripto'.");
          return;
        }
      }
    }

    // Gate 1: Prevent Cuenta Corriente for Consumidor Final
    if (salesStore.paymentMethod === "cuenta_corriente" && cleanedCuit === "99999999999") {
      toast.error("La opción de Cuenta Corriente no está disponible para Consumidor Final.");
      return;
    }

    const client = getSupabaseClient();

    // Gate 2: Validate active Cash Drawer shift for Cash sales
    let openSession: any = null;
    if (salesStore.paymentMethod === "efectivo") {
      setAfipStatus("Verificando estado de la Caja Diaria...");

      const { data: sessionData, error: sessionErr } = await client.database
        .from("caja_sesion")
        .select("*")
        .eq("cuit", activeCompany.cuit)
        .eq("estado", "abierta")
        .maybeSingle();

      if (sessionErr) {
        toast.error(`Error al validar la caja diaria: ${sessionErr.message}`);
        setAfipStatus(null);
        return;
      }

      if (!sessionData) {
        toast.error("Debe abrir la Caja Diaria para este CUIT antes de registrar ventas en Efectivo.");
        setAfipStatus(null);
        return;
      }
      openSession = sessionData;
    }

    // Gate 3: Cuenta Corriente (Credit Limit & Enable checks)
    let ccAccount: any = null;
    if (salesStore.paymentMethod === "cuenta_corriente") {
      setAfipStatus("Verificando Cuenta Corriente del cliente...");
      let dbCustomer = salesStore.customers.find(c => c.cuit === salesStore.clientCuit);
      if (!dbCustomer) {
        // Fallback: try to fetch directly from DB to handle fresh registrations
        const { data: fetchedCust, error: custFetchErr } = await client.database
          .from("customers")
          .select("*")
          .eq("cuit", salesStore.clientCuit)
          .maybeSingle();

        if (custFetchErr || !fetchedCust) {
          toast.error("El cliente seleccionado no existe en la base de datos o no es válido para Cuenta Corriente.");
          setAfipStatus(null);
          return;
        }
        dbCustomer = fetchedCust;
      }

      const { data: accData, error: ccErr } = await getCreditAccount(dbCustomer.id, activeCompany.cuit);
      if (ccErr || !accData) {
        toast.error(`Error al verificar la Cuenta Corriente: ${ccErr || "No se encontró la cuenta."}`);
        setAfipStatus(null);
        return;
      }

      if (!accData.tiene_cuenta_corriente) {
        toast.error("La Cuenta Corriente de este cliente no está habilitada.");
        setAfipStatus(null);
        return;
      }

      const nuevoSaldoTeorico = Number(accData.saldo_actual) + totalAmount;
      if (nuevoSaldoTeorico > Number(accData.limite_credito)) {
        const disponible = Number(accData.limite_credito) - Number(accData.saldo_actual);
        toast.error(`Límite de crédito excedido. Disponible: $${disponible.toFixed(2)}. Total compra: $${totalAmount.toFixed(2)}.`);
        setAfipStatus(null);
        return;
      }

      ccAccount = accData;
    }

    setAfipStatus("Estableciendo conexión segura con el sistema...");

    try {
      const totalVal = parseFloat(totalAmount.toFixed(2));
      let formattedInvoiceNumber = "";
      let caeNumber: string | null = "";
      let formattedExpDate: string | null = "";
      let qrLink: string | null = "";
      let voucherStatus = "autorizado";

      const isFiscal = salesStore.voucherType !== "Ticket Interno B";

      if (isFiscal) {
        setAfipStatus("Generando comprobante provisorio...");
        // Compilar alícuotas del IVA detalladas agrupando por tasa
        const ivaMap = new Map<number, { base_imp: number; importe: number }>();
        salesStore.cart.forEach((item) => {
          const lineNeto = item.cantidad * item.precio_unitario;
          const lineIva = lineNeto * (item.alicuota_iva / 100);

          // Buscar el código AFIP real en dbAlicuotas o usar un fallback
          const alMatch = dbAlicuotas.find(a => a.porcentaje === item.alicuota_iva);
          const alicuotaId = alMatch ? alMatch.codigo_afip : (item.alicuota_iva === 10.5 ? 4 : 5);

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

        // Calcular los totales finales a partir de las alícuotas redondeadas para garantizar igualdad estricta (RG AFIP)
        const finalNeto = ivaAlicuotas.reduce((sum, al) => sum + al.base_imp, 0);
        const finalIva = ivaAlicuotas.reduce((sum, al) => sum + al.importe, 0);
        const finalTotal = parseFloat((finalNeto + finalIva).toFixed(2));

        const ptoVta = activeCompany.punto_venta || 1;
        const timestamp = Date.now();
        
        // Generar un número de comprobante provisorio inmediato con prefijo PROV
        formattedInvoiceNumber = `PROV-000${ptoVta}-${timestamp}`;
        caeNumber = null;
        formattedExpDate = null;
        qrLink = null;
        voucherStatus = "pendiente_cae";
      } else {
        setAfipStatus("Generando comprobante interno...");
        // Consultar cuántos comprobantes B internos ya existen para este CUIT en arca_vouchers
        const { data: existingTickets, error: ticketErr } = await client.database
          .from("arca_vouchers")
          .select("id")
          .eq("company_cuit", activeCompany.cuit)
          .eq("type", "Ticket Interno B");

        if (ticketErr) throw ticketErr;

        const nextNum = (existingTickets?.length || 0) + 1;
        const puntoVentaStr = "9999"; // Punto de venta independiente de Caja B
        const nextNumStr = nextNum.toString().padStart(8, "0");
        formattedInvoiceNumber = `B-${puntoVentaStr}-${nextNumStr}`;
        caeNumber = "NO_FISCAL";
        formattedExpDate = "—";
        qrLink = "—";
        voucherStatus = "autorizado";
      }

      // Step 2: Atomic Decrement of Stock in database via robust transaction
      setAfipStatus("Actualizando existencias físicas en inventario (lote)...");

      const itemsPayload = salesStore.cart.map(item => ({ 
        id: item.id, 
        cantidad: item.cantidad 
      }));

      const { error: stockErr } = await client.database
        .rpc("decrementar_stock_lote", { p_items: itemsPayload });

      if (stockErr) throw stockErr;

      // Step 3: Insert Voucher into afip_vouchers database table
      setAfipStatus(isFiscal ? "Guardando registro inmutable fiscal..." : "Guardando comprobante interno...");
      const canalVal = isFiscal ? "oficial" : "interno";

      // Compute doc_tipo and doc_nro based on voucherType and client credentials to prevent AFIP rejection (RG AFIP standards)
      let docTipo = 99; // Default: Consumidor Final / Sin Identificar
      let docNro = "0";

      if (salesStore.voucherType === "Factura A") {
        docTipo = 80; // CUIT is legally mandatory for Factura A
        docNro = cleanedCuit;
      } else {
        // Factura B / C or Ticket Interno
        if (cleanedCuit.length === 11 && /^\d+$/.test(cleanedCuit) && cleanedCuit !== "99999999999") {
          docTipo = 80; // CUIT
          docNro = cleanedCuit;
        } else if ((cleanedCuit.length === 7 || cleanedCuit.length === 8) && /^\d+$/.test(cleanedCuit)) {
          docTipo = 96; // DNI
          docNro = cleanedCuit;
        } else if (cleanedCuit !== "99999999999" && cleanedCuit.length >= 6 && /^\d+$/.test(cleanedCuit)) {
          docTipo = 96; // Standard/non-standard DNI
          docNro = cleanedCuit;
        } else {
          docTipo = 99; // Consumidor Final (anonymous/unidentified)
          docNro = "0";
        }
      }

      let condicionIvaReceptor = 5; // Default: Consumidor Final
      const rawIvaCondition = salesStore.clientIvaCondition || "";
      if (rawIvaCondition.toLowerCase().includes("inscripto")) {
        condicionIvaReceptor = 1;
      } else if (rawIvaCondition.toLowerCase().includes("monotributo")) {
        condicionIvaReceptor = 4;
      } else if (rawIvaCondition.toLowerCase().includes("exento")) {
        condicionIvaReceptor = 3;
      }

      const newVoucher = {
        id: formattedInvoiceNumber,
        type: salesStore.voucherType,
        company_cuit: activeCompany.cuit,
        client_cuit: cleanedCuit,
        client_name: salesStore.clientName.trim(),
        doc_tipo: docTipo,
        doc_nro: docNro,
        condicion_iva_receptor: condicionIvaReceptor,
        net_amount: parseFloat(subtotalNeto.toFixed(2)),
        iva_amount: isFiscal ? parseFloat(totalIva.toFixed(2)) : 0.00,
        total_amount: parseFloat(totalAmount.toFixed(2)),
        cae: caeNumber,
        cae_vto: formattedExpDate,
        qr_link: qrLink,
        items: JSON.stringify(salesStore.cart),
        canal: canalVal,
        status: voucherStatus
      };

      const { error: voucherErr } = await client.database
        .from("arca_vouchers")
        .upsert([newVoucher]);

      if (voucherErr) throw voucherErr;

      // Resilient Post-Fiscal Ledger and Accounts updates (fault-tolerant Saga pattern)
      try {
        // Step 4: Automate Double-Entry Ledger Bookings
        setAfipStatus("Registrando asiento contable de venta...");

        const txId = `TX-VENTA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const conceptoVenta = `${salesStore.voucherType} — Comprobante: ${formattedInvoiceNumber} — Cliente: ${salesStore.clientName.trim()}`;

        let cuentaActivo = "1.1.1.01"; // Cash (Caja General)
        if (salesStore.paymentMethod === "tarjeta" || salesStore.paymentMethod === "transferencia") {
          cuentaActivo = "1.1.1.02"; // Bank account
        } else if (salesStore.paymentMethod === "cuenta_corriente") {
          cuentaActivo = "1.1.3.01"; // Receivable
        }

        const ivaVal = isFiscal ? parseFloat(totalIva.toFixed(2)) : 0;
        const revenueVal = parseFloat((totalVal - ivaVal).toFixed(2));

        // Guard: Assert double-entry balance
        const debeTotal = totalVal;
        const haberTotal = parseFloat((revenueVal + ivaVal).toFixed(2));
        if (Math.abs(debeTotal - haberTotal) > 0.05) {
          throw new Error(`Inconsistencia contable detectada: Debe (${debeTotal}) no coincide con Haber (${haberTotal}).`);
        }

        // Call Postgres RPC to insert transaction and entries atomically
        const { error: rpcErr } = await client.database
          .rpc("crear_asiento_venta", {
            p_tx_id: txId,
            p_concepto: conceptoVenta,
            p_cuenta_activo: cuentaActivo,
            p_total: totalVal,
            p_revenue: revenueVal,
            p_iva: ivaVal,
            p_es_fiscal: isFiscal && ivaVal > 0,
            p_canal: isFiscal ? "oficial" : "interno",
            p_company_cuit: activeCompany.cuit
          });

        if (rpcErr) throw new Error(`No se pudo registrar el asiento contable: ${rpcErr.message}`);

        // Step 5: Daily Cash movement updates
        if (salesStore.paymentMethod === "efectivo" && openSession) {
          setAfipStatus("Registrando movimiento en Caja Diaria...");

          // Log movement
          const { error: movErr } = await client.database
            .from("caja_movimiento")
            .insert([{
              sesion_id: openSession.id,
              tipo: "ingreso",
              monto: totalVal,
              concepto: conceptoVenta,
              accounting_transaction_id: txId,
              canal: isFiscal ? "oficial" : "interno"
            }]);

          if (movErr) throw new Error(`No se pudo registrar el movimiento de caja: ${movErr.message}`);

          // Update theoretical drawer balance ONLY for official sales
          if (isFiscal) {
            const nuevoTeorico = parseFloat((Number(openSession.monto_teorico) + totalVal).toFixed(2));
            const { error: sesionUpdateErr } = await client.database
              .from("caja_sesion")
              .update({ monto_teorico: nuevoTeorico })
              .eq("id", openSession.id);

            if (sesionUpdateErr) throw new Error(`No se pudo actualizar el balance de caja: ${sesionUpdateErr.message}`);
          }
        }

        // Step 6: Customer Credit Account updates for Cuenta Corriente sales
        if (salesStore.paymentMethod === "cuenta_corriente" && ccAccount) {
          setAfipStatus("Actualizando Cuenta Corriente del cliente...");
          const nuevoSaldo = parseFloat((Number(ccAccount.saldo_actual) + totalVal).toFixed(2));

          const { error: ccUpdateErr } = await client.database
            .from("customer_credit_accounts")
            .update({
              saldo_actual: nuevoSaldo,
              updated_at: new Date().toISOString()
            })
            .eq("id", ccAccount.id);

          if (ccUpdateErr) throw new Error(`No se pudo actualizar el saldo de la Cuenta Corriente: ${ccUpdateErr.message}`);

          // Log debit movement
          const { error: movementErr } = await client.database
            .from("customer_credit_movements")
            .insert([
              {
                id: crypto.randomUUID(),
                credit_account_id: ccAccount.id,
                type: "debito",
                amount: totalVal,
                description: `Compra POS — Factura ${formattedInvoiceNumber}`,
                accounting_transaction_id: txId,
              }
            ]);

          if (movementErr) throw new Error(`No se pudo registrar el historial de la Cuenta Corriente: ${movementErr.message}`);
        }
      } catch (ledgerErr: any) {
        console.error("Non-blocking failure during post-fiscal ledger updates:", ledgerErr);
        toast.warning(`Comprobante fiscal emitido con éxito, pero ocurrió un problema al registrar la contabilidad automáticamente: ${ledgerErr.message || ledgerErr}. Registre el asiento manual de ser necesario.`);
      }

      // Successful completion
      if (isFiscal) {
        toast.success(`Venta registrada con éxito. Comprobante provisorio: ${formattedInvoiceNumber} (CAE en trámite)`, { visual: true });
      } else {
        toast.success(`Comprobante interno ${formattedInvoiceNumber} generado con éxito.`, { visual: true });
      }

      // Instead of redirecting, populate the checkoutSuccess state for our premium overlay modal!
      setCheckoutSuccess({
        invoiceNumber: formattedInvoiceNumber,
        cae: caeNumber,
        clientName: salesStore.clientName || "Consumidor Final",
        totalAmount: totalVal,
        items: [...salesStore.cart]
      });

      // Clean up sales state
      salesStore.clearSales();

      // Reload catalog to reflect new stock levels
      loadCatalog();
    } catch (err: any) {
      // Usar console.warn diagnóstica para evitar disparar el dev overlay intrusivo de Next.js
      console.warn("AFIP Invoice Authorization Rejected (Handled Gracefully):", err?.message || err);
      
      const errMsg = err?.message || "";
      let details: string[] = [];
      
      if (errMsg.includes(";")) {
        // AFIP suele encadenar errores separados por punto y coma (ej. "10015 - ...; 10243 - ...")
        details = errMsg.split(";").map((d: string) => d.trim()).filter((d: string) => d.length > 0);
      } else if (errMsg.includes("AFIP Rechazó la factura:") || errMsg.includes("ARCA rechazó la factura:")) {
        details = [errMsg];
      } else {
        details = [errMsg || "Consulte soporte de base de datos o verifique su conexión."];
      }
      
      setCheckoutError({
        message: "El servidor de AFIP rechazó la emisión del comprobante debido a inconsistencias en los datos fiscales del cliente o del comprobante.",
        details
      });
    } finally {
      setAfipStatus(null);
    }
  };

  // Pre-tokenizar el catálogo en minúsculas para búsquedas veloces de alta densidad O(1)
  const preindexedArticles = React.useMemo(() => {
    return articles.map((art) => {
      const searchToken = [
        art.codigo_fabricante || "",
        art.descripcion || "",
        art.marca?.nombre || "",
        art.codigo_barras || ""
      ].join(" ").toLowerCase();

      return {
        ...art,
        searchToken
      };
    });
  }, [articles]);

  // React 18 Deferred value para priorizar la fluidez del teclado (60 FPS) sobre el filtrado
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  // Filter and search logic for the catalog items list using preindexed cache and deferred query
  const filteredArticles = React.useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    let results = preindexedArticles;

    if (query) {
      // Búsqueda instantánea O(1) de subcadenas pre-calculadas en minúscula
      results = results.filter((art) => art.searchToken.includes(query));
    }

    if (selectedFamily !== "all") {
      results = results.filter((art) => art.familia?.nombre === selectedFamily);
    }

    return results;
  }, [preindexedArticles, deferredSearchQuery, selectedFamily]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <ShoppingCart className="w-8 h-8 text-amber-400" />
            <span>Facturación de Ventas (Punto de Venta)</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Terminal POS rápida de alta densidad para mostrador. Búsqueda inteligente de repuestos, stock atómico y AFIP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pendingVouchers.length > 0 && (
            <button
              onClick={() => setShowPendingPanel(true)}
              className={`flex items-center gap-2 border px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.01] ${
                retryingVoucherId 
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.2)]" 
                  : loadingPending
                  ? "bg-zinc-900 border-zinc-800 text-zinc-400 cursor-wait"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50"
              }`}
              title="Ver comprobantes pendientes de CAE o con error fiscal"
              disabled={!!loadingPending}
            >
              {retryingVoucherId ? (
                // Active authorization request (making a real request to AFIP)
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : loadingPending ? (
                // Actively loading pending vouchers list from Postgres
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
              ) : (
                // Static / Idle warning alert state: Pulsing premium notification dot + AlertCircle
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                </div>
              )}

              <span>
                {retryingVoucherId 
                  ? "Autorizando en ARCA..." 
                  : loadingPending
                  ? "Sincronizando..." 
                  : `${pendingVouchers.length} Pendiente${pendingVouchers.length === 1 ? "" : "s"} CAE`}
              </span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-mono text-zinc-400">
            <Building className="w-4 h-4 text-amber-400" />
            <span>Empresa: {activeCompany?.nombre_fantasia || activeCompany?.razon_social}</span>
            <span className="text-zinc-600">|</span>
            <span>Punto de Venta: {activeCompany?.punto_venta || 1}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Double-Panel Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ==================== LEFT PANEL (60%): PRODUCT SEARCH & CATALOG ==================== */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-5 space-y-4 backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span>Buscador de Repuestos y Catálogo</span>
            </h2>

            {/* Catalog search bar and filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="catalog-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por Descripción, Código de Fabricante o Marca..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-850 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-zinc-800 text-zinc-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/40 transition-colors cursor-pointer shrink-0"
              >
                <option value="all">Todas las Familias</option>
                {families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Articles Catalog List Header Stats */}
            {!loadingArticles && filteredArticles.length > 0 && (
              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono font-bold px-1.5 pb-1 select-none">
                <span>ARTÍCULOS HALLADOS: {filteredArticles.length}</span>
                {filteredArticles.length > 40 && (
                  <span className="text-amber-500/80 animate-pulse font-extrabold">MOSTRANDO TOP 40 MÁS RELEVANTES</span>
                )}
              </div>
            )}

            {/* Articles Catalog List */}
            {loadingArticles ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs text-zinc-500">Cargando catálogo del mostrador...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-zinc-800 rounded-xl space-y-2">
                <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-zinc-400">No se encontraron artículos</p>
                <p className="text-xs text-zinc-500">Probá modificando el término de búsqueda o la familia.</p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredArticles.slice(0, 40).map((art) => {
                  const isInCart = salesStore.cart.find((i) => i.id === art.id);
                  const isLowStock = art.stock_actual <= art.stock_minimo;

                  return (
                    <div
                      key={art.id}
                      className={`p-4 rounded-xl border transition-all duration-200 relative group bg-zinc-950/40 hover:bg-zinc-900/30 ${isInCart
                        ? "border-amber-500/30 shadow-md shadow-amber-500/5 bg-zinc-900/20"
                        : "border-zinc-850 hover:border-zinc-800"
                        }`}
                    >
                      {/* Aura subtle gradient */}
                      <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />

                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                        {/* Article Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
                              {art.codigo_fabricante}
                            </span>
                            {art.marca && (
                              <span className="text-[10px] font-semibold bg-amber-500/5 text-amber-400 px-2 py-0.5 rounded border border-amber-500/10">
                                {art.marca.nombre}
                              </span>
                            )}
                            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest font-mono">
                              {art.familia?.nombre || "Autoparte"}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white tracking-wide leading-snug">
                            {art.descripcion}
                          </h3>

                          <div className="flex items-center gap-4 pt-1 flex-wrap">
                            {/* Stock Badge */}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${art.stock_actual === 0
                              ? "text-red-500"
                              : isLowStock
                                ? "text-yellow-500 animate-pulse"
                                : "text-emerald-500"
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${art.stock_actual === 0
                                ? "bg-red-500"
                                : isLowStock
                                  ? "bg-yellow-500"
                                  : "bg-emerald-500"
                                }`} />
                              Stock: {art.stock_actual} unidades
                            </span>

                            {art.ubicacion_deposito && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Locación: {art.ubicacion_deposito}
                              </span>
                            )}

                            {/* Popover de compatibilidad de vehículos — click-only */}
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hoveredArticleId === art.id) {
                                    setHoveredArticleId(null);
                                  } else {
                                    setHoveredArticleId(art.id);
                                    handleLoadCompatibility(art.id);
                                  }
                                }}
                                className={`flex items-center justify-center p-1 rounded-lg border transition duration-200 ${hoveredArticleId === art.id
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                  : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400"
                                  }`}
                                title="Ver vehículos compatibles"
                              >
                                {loadingCompat === art.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                ) : (
                                  <Car className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {hoveredArticleId === art.id && (
                                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[100] w-72 p-4 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/85 backdrop-blur-md animate-fade-in text-left">
                                  <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2 mb-2">
                                    <Car className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">Compatibilidad de Vehículos</span>
                                  </div>

                                  {loadingCompat === art.id ? (
                                    <div className="py-6 text-center space-y-2">
                                      <Loader2 className="w-5 h-5 animate-spin text-amber-500 mx-auto" />
                                      <p className="text-[9px] text-zinc-500 font-mono">Buscando motorizaciones...</p>
                                    </div>
                                  ) : !compatData[art.id] || compatData[art.id].length === 0 ? (
                                    <p className="text-[10px] text-zinc-500 italic py-1 text-center">
                                      Compatibilidad general / universal.
                                    </p>
                                  ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                      {compatData[art.id].map((compat, idx) => {
                                        const version = compat.auto_version;
                                        if (!version) return null;
                                        return (
                                          <div
                                            key={idx}
                                            className="p-2 rounded-lg bg-zinc-900 border border-zinc-850/80 text-[10px] space-y-0.5"
                                          >
                                            <div className="flex justify-between items-start gap-1">
                                              <span className="font-bold text-white leading-tight">
                                                {version.auto_modelo?.auto_marca?.nombre} {version.auto_modelo?.nombre}
                                              </span>
                                              <span className="text-[8px] bg-zinc-800 border border-zinc-700 px-1 py-0.2 rounded font-mono text-zinc-400 font-bold shrink-0">
                                                {version.anio_desde} - {version.anio_hasta || "Act"}
                                              </span>
                                            </div>
                                            <p className="text-zinc-400 font-mono text-[9px]">
                                              Motor: {version.motorizacion}
                                            </p>
                                            {compat.observaciones && (
                                              <p className="text-amber-500/80 italic font-mono text-[8px] leading-tight pt-0.5">
                                                Nota: {compat.observaciones}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Prices & Add Buttons */}
                        <div className="flex flex-col xs:flex-row sm:flex-col gap-2 justify-center shrink-0">
                          {/* Retail Price Button */}
                          <button
                            onClick={() => salesStore.addItem(art as any, "minorista")}
                            disabled={art.stock_actual === 0}
                            className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition-all flex items-center justify-between sm:justify-start gap-3 duration-250 hover:scale-[1.02]"
                          >
                            <div className="text-left">
                              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">P. Minorista</p>
                              <p className="text-xs font-black text-white font-mono">${parseFloat(String(art.precio_minorista)).toFixed(2)}</p>
                            </div>
                            <div className="p-1 rounded-lg bg-zinc-950 text-zinc-400 hover:text-white">
                              <Plus className="w-3 h-3" />
                            </div>
                          </button>

                          {/* Wholesale Price Button */}
                          <button
                            onClick={() => salesStore.addItem(art as any, "mayorista")}
                            disabled={art.stock_actual === 0}
                            className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition-all flex items-center justify-between sm:justify-start gap-3 duration-250 hover:scale-[1.02]"
                          >
                            <div className="text-left">
                              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">P. Mayorista (Taller)</p>
                              <p className="text-xs font-black text-amber-400 font-mono">${parseFloat(String(art.precio_mayorista)).toFixed(2)}</p>
                            </div>
                            <div className="p-1 rounded-lg bg-zinc-950 text-zinc-400 hover:text-white">
                              <Plus className="w-3 h-3" />
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT PANEL (40%): SHOPPING BASKET & AFIP CHECKOUT ==================== */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 p-5 space-y-6 backdrop-blur-xl">

            {/* Customer Information Block */}
            <ClientSelector />

            {/* Cart Items List */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between border-b border-zinc-850 pb-2">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span>Detalle de Compra</span>
                </span>
                <span className="text-[10px] bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded font-mono font-bold">
                  {salesStore.cart.length} repuestos
                </span>
              </h2>

              {salesStore.cart.length === 0 ? (
                <div className="py-12 text-center text-zinc-600 italic text-xs border border-dashed border-zinc-850 rounded-xl bg-zinc-950/10 space-y-1">
                  <p>El carrito de mostrador está vacío.</p>
                  <p className="text-[10px] text-zinc-500">Agregue artículos desde el catálogo de la izquierda.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                  {salesStore.cart.map((item) => (
                    <div
                      key={`${item.id}-${item.precio_tipo}`}
                      className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 space-y-0.5 max-w-[50%] xs:max-w-[60%]">
                        <p className="font-bold text-white truncate">{item.descripcion}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono text-zinc-500 font-extrabold uppercase">
                            COD: {item.codigo_fabricante}
                          </span>
                          <span className={`text-[8px] font-extrabold px-1 rounded uppercase font-mono tracking-widest ${item.precio_tipo === "mayorista"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-zinc-800 text-zinc-400"
                            }`}>
                            {item.precio_tipo}
                          </span>
                          {/* Selector de IVA Dinámico para ventas fiscales */}
                          {salesStore.voucherType !== "Ticket Interno B" && dbAlicuotas.length > 0 && (
                            <select
                              value={item.alicuota_iva}
                              onChange={(e) => salesStore.updateAlicuota(item.id, parseFloat(e.target.value))}
                              className="text-[9px] bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-zinc-400 focus:outline-none focus:border-amber-500/30 cursor-pointer font-mono font-bold"
                            >
                              {dbAlicuotas.map((al) => (
                                <option key={al.codigo_afip} value={al.porcentaje}>
                                  {al.descripcion}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Quantity Editor Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => salesStore.updateQuantity(item.id, item.cantidad - 1)}
                          className="p-1 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => salesStore.updateQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-10 text-center font-mono font-bold text-white bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 focus:outline-none focus:border-amber-500/30 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => salesStore.updateQuantity(item.id, item.cantidad + 1)}
                          className="p-1 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Subtotal and remove */}
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <p className="font-black text-white font-mono">
                            ${(
                              item.cantidad *
                              item.precio_unitario *
                              (salesStore.voucherType !== "Ticket Interno B" ? (1 + item.alicuota_iva / 100) : 1)
                            ).toFixed(2)}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono">
                            ${item.precio_unitario.toFixed(2)} neto c/u
                          </p>
                        </div>
                        <button
                          onClick={() => salesStore.removeItem(item.id)}
                          className="p-1.5 rounded-lg text-zinc-650 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Quitar repuesto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals and checkout */}
            <div className="space-y-4 pt-4 border-t border-zinc-850">

              {/* Selector de Medios de Pago */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>Medio de Pago</span>
                  </h3>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-mono font-bold uppercase">
                    Seleccionado: {salesStore.paymentMethod.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Botón Efectivo */}
                  <button
                    type="button"
                    onClick={() => salesStore.setPaymentMethod("efectivo")}
                    className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95 cursor-pointer ${salesStore.paymentMethod === "efectivo"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-300"
                      }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Efectivo</span>
                  </button>

                  {/* Botón Tarjeta */}
                  <button
                    type="button"
                    onClick={() => salesStore.setPaymentMethod("tarjeta")}
                    className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95 cursor-pointer ${salesStore.paymentMethod === "tarjeta"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-300"
                      }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Tarjeta</span>
                  </button>

                  {/* Botón Transferencia */}
                  <button
                    type="button"
                    onClick={() => salesStore.setPaymentMethod("transferencia")}
                    className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95 cursor-pointer ${salesStore.paymentMethod === "transferencia"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-300"
                      }`}
                  >
                    <Landmark className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Transferencia</span>
                  </button>

                  {/* Botón Cuenta Corriente */}
                  <button
                    type="button"
                    disabled={salesStore.clientCuit === "99999999999"}
                    onClick={() => salesStore.setPaymentMethod("cuenta_corriente")}
                    className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 relative ${salesStore.clientCuit === "99999999999"
                      ? "border-zinc-900 bg-zinc-950/20 text-zinc-650 opacity-40 cursor-not-allowed"
                      : salesStore.paymentMethod === "cuenta_corriente"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:scale-[1.01] active:scale-95 cursor-pointer"
                        : "border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-300 hover:scale-[1.01] active:scale-95 cursor-pointer"
                      }`}
                    title={
                      salesStore.clientCuit === "99999999999"
                        ? "La cuenta corriente requiere un cliente identificado, no disponible para Consumidor Final."
                        : "Venta cargada al saldo de cuenta del cliente."
                    }
                  >
                    <Handshake className="w-4 h-4" />
                    <span className="text-[10px] font-bold">Cuenta Corriente</span>
                    {salesStore.clientCuit === "99999999999" && (
                      <span className="absolute bottom-1 text-[7px] text-red-500/80 font-semibold uppercase tracking-tight scale-90">
                        No disp. p/ CF
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-850 bg-zinc-950 p-4 space-y-2.5 font-sans">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Subtotal Neto (Discriminado):</span>
                  <span className="font-mono text-zinc-300 font-bold">${subtotalNeto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Impuesto IVA Liquidado (21% / 10.5%):</span>
                  <span className="font-mono text-zinc-300 font-bold">${totalIva.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-zinc-850 pt-2.5 flex justify-between items-center text-sm">
                  <span className="text-white font-extrabold uppercase tracking-wide">Importe Total:</span>
                  <span className="font-mono text-amber-400 font-black text-xl">
                    ${totalAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {salesStore.paymentMethod === "efectivo" && !isCajaOpen && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2 flex items-start gap-2.5 animate-pulse">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-extrabold text-amber-300 uppercase tracking-wider text-[9px]">Caja Diaria Cerrada</p>
                    <p className="text-zinc-400 font-medium leading-relaxed text-[11px]">
                      Tenés que abrir la Caja Diaria para este CUIT antes de registrar ventas en <span className="text-white font-bold">Efectivo</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/protected/caja")}
                      className="mt-1 text-[10px] font-black text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 transition cursor-pointer"
                    >
                      Abrir Caja Diaria desde el panel <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Checkout F9 Button */}
              <button
                onClick={handleCheckout}
                disabled={salesStore.cart.length === 0 || (salesStore.paymentMethod === "efectivo" && !isCajaOpen)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-black text-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 hover:scale-[1.01] active:scale-95 duration-200 disabled:opacity-40 disabled:hover:scale-100 disabled:pointer-events-none"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>AUTORIZAR Y EMITIR COMPROBANTE (F9)</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* 3. Vehicles Compatibility Floating Overlay/Modal */}
      {activeCompatArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">

            {/* Header info */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Compatibilidad del Repuesto</span>
              </div>
              <button
                onClick={() => setActiveCompatArticle(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Article Detail */}
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 text-xs">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Artículo
              </p>
              <p className="font-extrabold text-white">
                {articles.find(a => a.id === activeCompatArticle)?.descripcion}
              </p>
              <p className="text-[10px] text-amber-400 font-mono">
                Código: {articles.find(a => a.id === activeCompatArticle)?.codigo_fabricante}
              </p>
            </div>

            {/* Compatibility list */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Modelos Autorizados</h4>

              <div className="max-h-[35vh] overflow-y-auto pr-1 space-y-2">
                {compatData[activeCompatArticle]?.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-zinc-900 text-xs text-zinc-500 rounded-xl italic">
                    Este repuesto está catalogado para compatibilidad general / universal.
                  </div>
                ) : (
                  compatData[activeCompatArticle]?.map((compat, idx) => {
                    const version = compat.auto_version;
                    if (!version) return null;

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-850/80 flex items-start justify-between gap-3 text-xs transition hover:bg-zinc-900"
                      >
                        <div>
                          <p className="font-bold text-white">
                            {version.auto_modelo?.auto_marca?.nombre} {version.auto_modelo?.nombre}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            Motorización: <span className="text-zinc-300 font-semibold">{version.motorizacion}</span>
                          </p>
                          {compat.observaciones && (
                            <p className="text-[10px] text-amber-500/80 italic mt-1 font-mono">
                              Nota: {compat.observaciones}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block text-[9px] bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded font-mono font-bold text-zinc-400">
                            Años: {version.anio_desde} — {version.anio_hasta || "Actual"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Close button */}
            <div className="pt-2 text-right">
              <button
                onClick={() => setActiveCompatArticle(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. AFIP Simulating Authorized Loader Overlay */}
      {afipStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-sm text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              {/* Outer amber glow */}
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/10 animate-ping" />
              {/* Spinning loader */}
              <Loader2 className="w-20 h-20 text-amber-400 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-tight text-white uppercase">
                Autorizando Comprobante
              </h3>
              <p className="text-xs text-zinc-400 font-mono h-4">
                {afipStatus}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-850 px-3.5 py-1.5 text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Conexión Encriptada SSL AFIP
            </div>
          </div>
        </div>
      )}

      {/* 5. Graceful AFIP Rejection Dialog (Crimson Overlay) */}
      {checkoutError && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/20 bg-zinc-900 shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Header: Glowing Crimson */}
            <div className="bg-gradient-to-r from-red-950/40 to-zinc-900 px-6 py-5 border-b border-red-950/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                  Rechazo de Autorización Fiscal
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Servicio de Facturación ARCA (AFIP)
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-300 font-semibold leading-relaxed text-left">
                {checkoutError.message}
              </p>

              {checkoutError.details && checkoutError.details.length > 0 && (
                <div className="space-y-2 text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Detalle Técnico de Rechazo:
                  </span>
                  <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
                    {checkoutError.details.map((detail, idx) => {
                      // Extract code if present (e.g. "10015 - ...")
                      const codeMatch = detail.match(/^(\d+)\s*-\s*(.*)$/);
                      const code = codeMatch ? codeMatch[1] : null;
                      const text = codeMatch ? codeMatch[2] : detail;

                      return (
                        <div key={idx} className="p-3.5 rounded-xl border border-red-500/10 bg-red-500/[0.02] flex gap-3 text-left">
                          {code && (
                            <div className="h-fit rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-red-400 shrink-0">
                              Cód. {code}
                            </div>
                          )}
                          <p className="text-xs text-zinc-400 font-medium leading-relaxed break-words flex-1">
                            {text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => {
                  const rawText = checkoutError.details?.join("\n") || checkoutError.message;
                  navigator.clipboard.writeText(rawText);
                  toast.success("Detalles del error copiados al portapapeles", { visual: true });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-[11px] font-bold text-zinc-400 hover:text-white transition"
              >
                Copiar Detalles
              </button>

              <button
                onClick={() => setCheckoutError(null)}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-zinc-950 font-black text-xs transition shadow-lg shadow-red-500/10"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. Premium Checkout Success Dialog (Amber/Green Glow Overlay) */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in no-print">
          <div className={`w-full max-w-md rounded-2xl border bg-[#0f0f13] shadow-2xl overflow-hidden animate-scale-up ${
            checkoutSuccess.cae === null 
              ? "border-amber-500/20 shadow-amber-500/[0.01]" 
              : "border-green-500/20 shadow-green-500/[0.02]"
          }`}>
            
            {/* Header: Pulsing Banner */}
            <div className={`bg-gradient-to-r px-6 py-5 border-b flex items-center gap-3 ${
              checkoutSuccess.cae === null
                ? "from-amber-950/30 to-zinc-950 border-amber-950/20"
                : "from-green-950/30 to-zinc-950 border-green-950/20"
            }`}>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                checkoutSuccess.cae === null
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-green-500/10 border-green-500/20 text-green-400"
              }`}>
                {checkoutSuccess.cae === null ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 animate-pulse" />
                )}
              </div>
              <div className="text-left">
                <h3 className={`text-sm font-black uppercase tracking-wider ${
                  checkoutSuccess.cae === null ? "text-amber-400" : "text-green-400"
                }`}>
                  {checkoutSuccess.cae === null ? "CAE en Trámite" : "Comprobante Autorizado"}
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  {checkoutSuccess.cae === null 
                    ? "ARCA (AFIP) — Procesando en segundo plano" 
                    : "ARCA (AFIP) — Autorización Exitosa"}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-left">
              <div className="rounded-xl bg-zinc-900/40 border border-zinc-850 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Comprobante:</span>
                  <span className="text-zinc-300 font-bold font-mono">{checkoutSuccess.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Cliente:</span>
                  <span className="text-zinc-300 font-bold truncate max-w-[200px]">{checkoutSuccess.clientName}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-zinc-800/60 pt-3">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px]">Total de Venta:</span>
                  <span className="text-amber-400 font-black text-sm">
                    ${checkoutSuccess.totalAmount.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {checkoutSuccess.cae === null ? (
                <div className="p-3.5 rounded-xl bg-amber-500/[0.02] border border-amber-500/10 flex gap-3 text-left">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                    La venta ya se registró en inventario y contabilidad. El comprobante se está autorizando con AFIP en segundo plano. Podés imprimir el ticket provisorio para el cliente.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-zinc-900/20 border border-zinc-850 space-y-1 font-mono">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">CAE AFIP Otorgado:</span>
                  <span className="text-xs text-zinc-300 font-bold tracking-widest">{checkoutSuccess.cae}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800/60 bg-zinc-900/40 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-705 text-[11px] font-bold text-zinc-300 hover:text-white transition"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Imprimir Ticket</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCheckoutSuccess(null);
                    setTimeout(() => {
                      const searchInput = document.getElementById("catalog-search-input");
                      if (searchInput) searchInput.focus();
                    }, 100);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition shadow-lg ${
                    checkoutSuccess.cae === null
                      ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 shadow-amber-500/10"
                      : "bg-green-500 hover:bg-green-600 active:bg-green-700 text-zinc-950 shadow-green-500/10"
                  }`}
                >
                  Nueva Venta (Esc)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Printable Ticket Area (Hidden from UI, visible only in print media) */}
      {checkoutSuccess && (
        <div id="invoice-print-area" className="hidden font-mono text-black p-4 space-y-4">
          <div className="text-center border-b border-dashed border-black pb-3">
            <h2 className="text-base font-extrabold uppercase tracking-tight">
              {activeCompany?.nombre_fantasia || activeCompany?.razon_social}
            </h2>
            <p className="text-[10px]">{activeCompany?.razon_social}</p>
            <p className="text-[9px]">CUIT: {activeCompany?.cuit}</p>
            <p className="text-[9px]">Punto de Venta: {activeCompany?.punto_venta || 1}</p>
            <p className="text-[9px]">Dirección: {activeCompany?.direccion || "No especificada"}</p>
          </div>

          <div className="text-[10px] space-y-1">
            <p className="font-bold">COMPROBANTE: {checkoutSuccess.invoiceNumber}</p>
            <p>Fecha: {new Date().toLocaleDateString("es-AR")} {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p>Cliente: {checkoutSuccess.clientName}</p>
          </div>

          <div className="border-t border-b border-dashed border-black py-2 my-2 text-[10px] space-y-1.5">
            <div className="grid grid-cols-12 font-bold border-b border-black pb-1">
              <span className="col-span-2">Cant</span>
              <span className="col-span-7">Detalle</span>
              <span className="col-span-3 text-right">Subt.</span>
            </div>
            {checkoutSuccess.items && checkoutSuccess.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 text-[9px] gap-0.5">
                <span className="col-span-2 font-bold">{item.cantidad}x</span>
                <span className="col-span-7 truncate">{item.descripcion}</span>
                <span className="col-span-3 text-right">${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="text-right text-[10px] space-y-1">
            <p className="font-black text-xs">TOTAL: ${checkoutSuccess.totalAmount.toFixed(2)}</p>
          </div>

          <div className="text-center border-t border-dashed border-black pt-3 mt-4 text-[9px] space-y-1.5">
            {checkoutSuccess.cae === null ? (
              <div className="border border-black p-2 rounded">
                <p className="font-bold uppercase">*** CAE EN TRÁMITE ***</p>
                <p className="text-[8px]">Comprobante provisorio sujeto a autorización fiscal. Guarde este ticket como constancia de compra.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-bold font-mono">CAE: {checkoutSuccess.cae}</p>
                <p>¡Gracias por su compra!</p>
              </div>
            )}
            <p className="text-[8px] text-zinc-500">Sistema Nodo Sur ERP</p>
          </div>
        </div>
      )}

      {/* 7. Premium Lateral Slide-over Panel (Pendientes de CAE) */}
      {showPendingPanel && (
        <div className="fixed inset-0 z-[105] flex justify-end no-print animate-fade-in">
          {/* Backdrop */}
          <div 
            onClick={() => setShowPendingPanel(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-[#0e0e12] border-l border-zinc-800 shadow-2xl h-full flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
              <div className="flex items-center gap-2">
                <Loader2 className={`w-5 h-5 text-amber-400 ${loadingPending ? "animate-spin" : ""}`} />
                <div className="text-left">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Comprobantes sin CAE
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {pendingVouchers.length} Comprobante{pendingVouchers.length === 1 ? "" : "s"} Pendiente{pendingVouchers.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPendingPanel(false)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {loadingPending && pendingVouchers.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-zinc-500 text-xs">Cargando pendientes...</p>
                </div>
              ) : pendingVouchers.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-green-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-bold text-white">¡Al día!</p>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      No hay comprobantes pendientes de CAE ni errores fiscales pendientes en este momento.
                    </p>
                  </div>
                </div>
              ) : (
                pendingVouchers.map((voucher) => {
                  let statusBadge = null;
                  if (voucher.status === "pendiente_cae") {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        Pendiente
                      </span>
                    );
                  } else if (voucher.status === "error_temporal") {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Error de Red
                      </span>
                    );
                  } else if (voucher.status === "rechazado_afip") {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        Rechazado AFIP
                      </span>
                    );
                  }

                  const dateStr = new Date(voucher.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <div 
                      key={voucher.id}
                      className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-3 hover:border-zinc-800 transition-all text-xs"
                    >
                      {/* Top metadata */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5 text-left">
                          <p className="font-bold font-mono text-white text-xs">{voucher.id}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{dateStr}</p>
                        </div>
                        {statusBadge}
                      </div>

                      {/* Client info */}
                      <div className="grid grid-cols-2 gap-2 border-t border-b border-zinc-900/60 py-2">
                        <div className="text-left">
                          <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Cliente:</span>
                          <span className="text-zinc-300 font-semibold truncate block max-w-[160px]">{voucher.client_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Importe:</span>
                          <span className="text-amber-400 font-bold">${Number(voucher.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Error details if errored */}
                      {voucher.error_details && (
                        <div className="p-3 rounded-lg bg-red-500/[0.01] border border-red-500/10 space-y-1.5 text-left font-mono">
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-red-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Detalle Técnico AFIP (Intento {voucher.attempts}):</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed break-words font-medium">
                            {voucher.error_details.message || voucher.error_details.msg || JSON.stringify(voucher.error_details)}
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 justify-end pt-1">
                        {voucher.status === "rechazado_afip" && (
                          <button
                            onClick={() => handleDiscardVoucher(voucher.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-950 bg-red-950/20 hover:bg-red-900/40 text-[10px] font-bold text-red-400 hover:text-red-300 transition"
                            title="Descartar y eliminar comprobante rechazado sin validez fiscal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Descartar</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCheckoutSuccess({
                              invoiceNumber: voucher.id,
                              cae: null,
                              clientName: voucher.client_name,
                              totalAmount: Number(voucher.total_amount),
                              items: voucher.items ? (typeof voucher.items === 'string' ? JSON.parse(voucher.items) : voucher.items) : []
                            });
                            // Trigger window print shortly after opening success modal
                            setTimeout(() => {
                              window.print();
                            }, 300);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-white transition"
                          title="Imprimir Ticket Provisorio"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Imprimir</span>
                        </button>

                        <button
                          onClick={() => handleManualRetry(voucher)}
                          disabled={retryingVoucherId === voucher.id}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold text-[10px] transition ${
                            retryingVoucherId === voucher.id
                              ? "bg-zinc-800 border border-zinc-700 text-zinc-500 cursor-not-allowed"
                              : "bg-amber-500 hover:bg-amber-600 text-zinc-950 hover:scale-[1.01]"
                          }`}
                        >
                          {retryingVoucherId === voucher.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5" />
                          )}
                          <span>Solicitar CAE</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between shrink-0">
              <button
                onClick={loadPendingVouchers}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1.5"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loadingPending ? "animate-spin text-amber-500" : ""}`} />
                <span>Actualizar Lista</span>
              </button>
              <button
                onClick={() => setShowPendingPanel(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Override Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible;
          }
          #invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 80mm !important; /* Thermal roll width */
            background: white !important;
            color: black !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box;
            font-family: monospace !important;
          }
          #invoice-print-area h2, 
          #invoice-print-area span,
          #invoice-print-area p,
          #invoice-print-area div {
            color: black !important;
          }
          #invoice-print-area .border-black,
          #invoice-print-area .border-t,
          #invoice-print-area .border-b {
            border-color: black !important;
          }
        }
      `}} />

    </div>
  );
}
