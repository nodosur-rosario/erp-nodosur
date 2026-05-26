"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  CreditCard,
  History,
  Sparkles,
  X,
  Edit3,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  ChevronDown,
  Eye,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  Check,
  Coins,
  Landmark,
} from "lucide-react";
import { getSupabaseClient } from "@/core/api/supabase";
import { useCompanyStore } from "@/core/company/company-store";
import { toast } from "sonner";
import {
  getCreditAccount,
  updateCreditSettings,
  getCreditMovements,
  recordPayment,
  CreditAccount,
  CreditMovement,
} from "@/features/customers/services/credit-service";
import CreditAllocator from "./components/credit-allocator";

// Generador de UUIDv4 compatible con contextos no seguros (HTTP / IP local)
function generateUUID() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- Types ----------
interface Customer {
  id: string;
  cuit: string;
  razon_social: string;
  condicion_iva: string;
  direccion: string | null;
  email: string | null;
  phone: string | null;
}

interface VoucherSummary {
  id: string;
  type: string;
  total_amount: string | number;
  created_at: string;
}

const IVA_CONDITIONS = [
  "Consumidor Final",
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
] as const;

// ---------- Component ----------
export default function ClientesPage() {
  const activeCompany = useCompanyStore((state) => state.currentCompany);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIva, setFilterIva] = useState("all");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    cuit: "",
    razon_social: "",
    condicion_iva: "Consumidor Final",
    direccion: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [loadingArca, setLoadingArca] = useState(false);

  // Automatically query ARCA WSPUC (Padrón) if input has 11 digits (CUIT) and we are creating a new customer
  useEffect(() => {
    const queryCuit = formData.cuit.trim().replace(/\D/g, "");
    if (queryCuit.length === 11 && /^\d+$/.test(queryCuit) && !editingCustomer && showModal) {
      const fetchArcaData = async () => {
        setLoadingArca(true);
        try {
          const companyCuit = activeCompany?.cuit || "20371024094";
          const res = await fetch(`/api/arca/padron/${queryCuit}?companyCuit=${companyCuit}`);
          const result = await res.json();
          if (result.success && result.data) {
            setFormData((prev) => ({
              ...prev,
              razon_social: result.data.razonSocial,
              condicion_iva: result.data.condicionIva,
              direccion: result.data.direccion || prev.direccion,
            }));
            toast.success("Contribuyente localizado y autocompletado desde ARCA / AFIP.");
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
    }
  }, [formData.cuit, editingCustomer, showModal, activeCompany]);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Customer detail / purchase history
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerVouchers, setCustomerVouchers] = useState<VoucherSummary[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  // Credit Account states
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [creditMovements, setCreditMovements] = useState<CreditMovement[]>([]);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [activeTab, setActiveTab] = useState<"purchases" | "credit">("purchases");
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Credit settings form state
  const [ccEnabled, setCcEnabled] = useState(false);
  const [ccLimit, setCcLimit] = useState("0");

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "transferencia">("efectivo");
  const [paymentDesc, setPaymentDesc] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [activeCashSession, setActiveCashSession] = useState<any | null>(null);
  const [showAllocationModal, setShowAllocationModal] = useState(false);


  // ---------- Data Fetching ----------
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("customers")
        .select("*")
        .order("razon_social", { ascending: true });

      if (error) throw error;
      setCustomers((data as Customer[]) || []);
    } catch (err: any) {
      console.error("Error loading customers:", err);
      toast.error("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  };

  const checkActiveCashSession = async () => {
    if (!activeCompany) return;
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("caja_sesion")
        .select("*")
        .eq("cuit", activeCompany.cuit)
        .eq("estado", "abierta")
        .maybeSingle();

      if (!error && data) {
        setActiveCashSession(data);
      } else {
        setActiveCashSession(null);
      }
    } catch (err) {
      console.error("Error checking active cash session:", err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    checkActiveCashSession();
  }, [activeCompany]);

  // ---------- Fetch Credit Account and Movements ----------
  const fetchCustomerCreditData = async (clientId: string) => {
    if (!activeCompany) return;
    setLoadingCredit(true);
    try {
      const { data: account, error: accErr } = await getCreditAccount(
        clientId,
        activeCompany.cuit
      );
      if (accErr) throw new Error(accErr);

      if (account) {
        setCreditAccount(account);
        setCcEnabled(account.tiene_cuenta_corriente);
        setCcLimit(String(account.limite_credito));

        if (account.id) {
          const { data: movements, error: movErr } = await getCreditMovements(
            account.id
          );
          if (movErr) throw new Error(movErr);
          setCreditMovements(movements);
        } else {
          setCreditMovements([]);
        }
      }
    } catch (err: any) {
      console.error("Error loading credit data:", err);
      toast.error("No se pudo cargar la cuenta corriente del cliente.");
    } finally {
      setLoadingCredit(false);
    }
  };

  // ---------- Fetch Purchase History ----------
  const fetchCustomerVouchers = async (cuit: string) => {
    if (!activeCompany) return;
    setLoadingVouchers(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.database
        .from("arca_vouchers")
        .select("id, type, total_amount, created_at")
        .eq("client_cuit", cuit)
        .eq("company_cuit", activeCompany.cuit)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setCustomerVouchers((data as VoucherSummary[]) || []);
    } catch (err: any) {
      console.error("Error loading vouchers:", err);
      toast.error("No se pudo cargar el historial de compras.");
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      setCustomerVouchers([]);
      setCreditAccount(null);
      setCreditMovements([]);
      setActiveTab("purchases");
      return;
    }
    setSelectedCustomer(customer);
    fetchCustomerVouchers(customer.cuit);
    fetchCustomerCreditData(customer.id);
  };

  // ---------- Filters & Search ----------
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.cuit.includes(searchQuery) ||
        c.razon_social.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));
      const matchesIva =
        filterIva === "all" || c.condicion_iva === filterIva;
      return matchesSearch && matchesIva;
    });
  }, [customers, searchQuery, filterIva]);

  // ---------- Stats ----------
  const countRI = customers.filter(
    (c) => c.condicion_iva === "Responsable Inscripto"
  ).length;

  // ---------- CRUD ----------
  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      cuit: "",
      razon_social: "",
      condicion_iva: "Consumidor Final",
      direccion: "",
      email: "",
      phone: "",
    });
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      cuit: customer.cuit,
      razon_social: customer.razon_social,
      condicion_iva: customer.condicion_iva,
      direccion: customer.direccion || "",
      email: customer.email || "",
      phone: customer.phone || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.cuit || formData.cuit.trim().length < 6) {
      toast.warning("El CUIT debe tener al menos 6 caracteres.");
      return;
    }
    if (!formData.razon_social || formData.razon_social.trim().length === 0) {
      toast.warning("La Razón Social es obligatoria.");
      return;
    }
    if (!activeCompany) {
      toast.error("Debe tener una empresa activa para registrar clientes.");
      return;
    }

    setSaving(true);
    try {
      const client = getSupabaseClient();
      const payload = {
        cuit: formData.cuit.trim(),
        razon_social: formData.razon_social.trim(),
        condicion_iva: formData.condicion_iva,
        direccion: formData.direccion.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        company_cuit: activeCompany.cuit, // <-- REQUERIDO PARA POLÍTICAS DE RLS
      };

      if (editingCustomer) {
        // Update existing
        const { error } = await client.database
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);
        if (error) throw error;
        toast.success(`Cliente "${payload.razon_social}" actualizado.`);
      } else {
        // Insert new
        const newCustomer = { id: generateUUID(), ...payload };
        const { error } = await client.database
          .from("customers")
          .insert([newCustomer]);
        if (error) throw error;
        toast.success(`Cliente "${payload.razon_social}" registrado.`);
      }

      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      console.error("Error saving customer:", err);
      toast.error(
        `Error al guardar: ${err.message || "Verifique duplicación de CUIT."}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.database
        .from("customers")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Cliente eliminado.");
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
        setCustomerVouchers([]);
      }
      setDeletingId(null);
      fetchCustomers();
    } catch (err: any) {
      console.error("Error deleting customer:", err);
      toast.error(`No se pudo eliminar: ${err.message}`);
    }
  };

  // ---------- Credit & Cobros Operations ----------
  const handleUpdateCreditSettings = async () => {
    if (!selectedCustomer || !activeCompany) return;
    
    // Absolute block: CC credit for generic Consumidor Final
    if (selectedCustomer.cuit === "99999999999" && ccEnabled) {
      toast.error("No se permite habilitar cuenta corriente para el Consumidor Final genérico.");
      setCcEnabled(false);
      return;
    }

    const parsedLimit = parseFloat(ccLimit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      toast.warning("El límite de crédito debe ser un número válido mayor o igual a cero.");
      return;
    }

    setUpdatingSettings(true);
    try {
      const { data, error } = await updateCreditSettings(
        selectedCustomer.id,
        activeCompany.cuit,
        {
          tiene_cuenta_corriente: ccEnabled,
          limite_credito: parsedLimit,
        }
      );

      if (error) throw new Error(error);
      
      toast.success("Configuración de cuenta corriente guardada con éxito.");
      if (data) {
        setCreditAccount(data);
        if (data.id) {
          const { data: movements } = await getCreditMovements(data.id);
          setCreditMovements(movements);
        }
      }
    } catch (err: any) {
      console.error("Error saving credit settings:", err);
      toast.error(`No se pudo actualizar la configuración: ${err.message}`);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleRecordCobro = async () => {
    if (!selectedCustomer || !activeCompany || !creditAccount) return;
    
    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.warning("Ingrese un monto válido y mayor a cero.");
      return;
    }

    const currentBalance = parseFloat(String(creditAccount.saldo_actual));
    if (parsedAmount > currentBalance) {
      toast.warning(`El monto ingresado excede el saldo deudor actual de $${currentBalance.toLocaleString("es-AR")}.`);
      return;
    }

    if (paymentMethod === "efectivo" && !activeCashSession) {
      toast.error("Debe abrir la caja diaria para poder registrar cobros en efectivo.");
      return;
    }

    setRecordingPayment(true);
    try {
      const { success, error } = await recordPayment(
        selectedCustomer.id,
        activeCompany.cuit,
        {
          amount: parsedAmount,
          paymentMethod,
          description: paymentDesc.trim() || "Cobro a cuenta corriente",
          userId: "1234-5678-user", // Simulated user session ID
          sesionId: activeCashSession?.id,
        }
      );

      if (!success) throw new Error(error || "Fallo en la transacción");

      toast.success(`Cobro de $${parsedAmount.toLocaleString("es-AR")} registrado con éxito.`);
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentDesc("");
      
      // Refresh credit details
      await fetchCustomerCreditData(selectedCustomer.id);
      // Refresh cash session theoretical amount if cash was used
      if (paymentMethod === "efectivo") {
        await checkActiveCashSession();
      }
    } catch (err: any) {
      console.error("Error processing cobro:", err);
      toast.error(`Error al procesar el cobro: ${err.message}`);
    } finally {
      setRecordingPayment(false);
    }
  };

  // ---------- Render ----------
  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-8 h-8 text-amber-400" />
            <span>Gestión de Clientes</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Administración centralizada de cuentas de clientes, condición
            fiscal y seguimiento de historial de compras.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10 self-start hover:scale-[1.02] duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente (F2)</span>
        </button>
      </div>

      {/* 2. Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Cartera Activa
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-white">
            {customers.length} Clientes
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Registrados en base de datos fiscal.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Responsables Inscriptos
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {countRI} Clientes RI
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Facturan con discriminación de IVA (Factura A).
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Total en Cartera
            </span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-white">
            {customers.length - countRI} Otros
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Consumidores Finales, Monotributistas y Exentos.
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por CUIT, Razón Social o Email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-850 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setFilterIva("all")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                filterIva === "all"
                  ? "bg-zinc-800 border-zinc-700 text-white"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              Todos
            </button>
            {IVA_CONDITIONS.map((cond) => (
              <button
                key={cond}
                onClick={() => setFilterIva(cond)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                  filterIva === cond
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
                }`}
              >
                {cond}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Content Area */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm">Cargando cartera de clientes...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/10 p-16 text-center space-y-6 backdrop-blur-xl overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
            <div className="w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full animate-pulse" />
          </div>
          <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-amber-400 w-16 h-16 flex items-center justify-center mx-auto shadow-inner shadow-black">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white">
              {customers.length === 0
                ? "Sin clientes registrados"
                : "Sin resultados"}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {customers.length === 0
                ? "Aún no hay clientes en la base de datos. Podés registrarlos manualmente desde aquí o al facturar desde el módulo Ventas."
                : "No se encontraron clientes que coincidan con los filtros aplicados."}
            </p>
          </div>
          {customers.length === 0 && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Cliente</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Customers Table */}
          <div
            className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden backdrop-blur-xl ${
              selectedCustomer ? "lg:col-span-7" : "lg:col-span-12"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="px-5 py-4">CUIT</th>
                    <th className="px-5 py-4">Razón Social</th>
                    <th className="px-5 py-4">Condición IVA</th>
                    <th className="px-5 py-4 hidden xl:table-cell">Contacto</th>
                    <th className="px-5 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 text-xs text-zinc-300">
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`cursor-pointer transition-colors ${
                        selectedCustomer?.id === c.id
                          ? "bg-amber-500/5 border-l-2 border-l-amber-500"
                          : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-white whitespace-nowrap">
                        {c.cuit}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{c.razon_social}</p>
                        {c.direccion && (
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {c.direccion}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            c.condicion_iva === "Responsable Inscripto"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : c.condicion_iva === "Monotributista"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : c.condicion_iva === "Exento"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {c.condicion_iva}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden xl:table-cell">
                        <div className="space-y-0.5">
                          {c.email && (
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {c.email}
                            </p>
                          )}
                          {c.phone && (
                            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </p>
                          )}
                          {!c.email && !c.phone && (
                            <p className="text-[10px] text-zinc-500 italic">
                              Sin datos de contacto
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCustomer(c);
                            }}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                            title="Ver historial de compras"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(c);
                            }}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-all"
                            title="Editar cliente"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(c.id);
                            }}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all"
                            title="Eliminar cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Detail / Purchase History Panel */}
          {selectedCustomer && (
            <div className="lg:col-span-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/10 backdrop-blur-xl p-5 space-y-5 animate-fade-in">
              {/* Customer header */}
              <div className="flex items-start justify-between border-b border-zinc-850 pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-white">
                    {selectedCustomer.razon_social}
                  </h3>
                  <p className="text-[10px] font-mono text-zinc-400">
                    CUIT: {selectedCustomer.cuit}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      selectedCustomer.condicion_iva === "Responsable Inscripto"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {selectedCustomer.condicion_iva}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerVouchers([]);
                    setCreditAccount(null);
                    setCreditMovements([]);
                    setActiveTab("purchases");
                  }}
                  className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Datos de Contacto
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {selectedCustomer.direccion && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{selectedCustomer.direccion}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {!selectedCustomer.direccion &&
                    !selectedCustomer.email &&
                    !selectedCustomer.phone && (
                      <p className="text-[10px] text-zinc-500 italic">
                        Sin datos de contacto registrados.
                      </p>
                    )}
                </div>
              </div>

              {/* TAB SELECTOR */}
              <div className="flex border-b border-zinc-800/80">
                <button
                  onClick={() => setActiveTab("purchases")}
                  className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${
                    activeTab === "purchases"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-zinc-500 hover:text-white"
                  }`}
                >
                  Historial Compras
                </button>
                <button
                  onClick={() => setActiveTab("credit")}
                  className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${
                    activeTab === "credit"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-zinc-500 hover:text-white"
                  }`}
                >
                  Cuenta Corriente
                </button>
              </div>

              {/* TAB CONTENT: PURCHASES */}
              {activeTab === "purchases" && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Historial de Compras
                  </h4>

                  {loadingVouchers ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin mx-auto" />
                      <p className="text-[10px] text-zinc-500 mt-2">
                        Cargando historial...
                      </p>
                    </div>
                  ) : customerVouchers.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-zinc-850 rounded-xl">
                      <FileText className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                      <p className="text-[10px] text-zinc-500">
                        Este cliente no tiene comprobantes emitidos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {customerVouchers.map((v) => (
                        <div
                          key={v.id}
                          className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <p className="font-mono font-bold text-white text-[11px]">
                              {v.id}
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  v.type.includes("Factura A")
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {v.type}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(v.created_at).toLocaleDateString(
                                  "es-AR",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-white">
                            $
                            {parseFloat(String(v.total_amount)).toLocaleString(
                              "es-AR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {customerVouchers.length > 0 && (
                    <div className="border-t border-zinc-850 pt-3 flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                        Total Facturado ({customerVouchers.length} comp.)
                      </span>
                      <span className="font-mono font-black text-amber-400">
                        $
                        {customerVouchers
                          .reduce(
                            (sum, v) =>
                              sum + (parseFloat(String(v.total_amount)) || 0),
                            0
                          )
                          .toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: CREDIT ACCOUNT */}
              {activeTab === "credit" && (
                <div className="space-y-4">
                  {loadingCredit ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                      <p className="text-[10px] text-zinc-500 mt-2">
                        Cargando estado financiero...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Configuration Section */}
                      <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-amber-500" />
                            Habilitar Cuenta Corriente
                          </span>
                          <button
                            type="button"
                            onClick={() => setCcEnabled(!ccEnabled)}
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            {ccEnabled ? (
                              <ToggleRight className="w-8 h-8 text-amber-500" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-zinc-650" />
                            )}
                          </button>
                        </div>
                        
                        {ccEnabled && (
                          <div className="space-y-2 pt-1 border-t border-zinc-900">
                            <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                              Límite de Crédito ($)
                            </label>
                            <input
                              type="number"
                              value={ccLimit}
                              onChange={(e) => setCcLimit(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/40 font-mono"
                            />
                          </div>
                        )}

                        <button
                          onClick={handleUpdateCreditSettings}
                          disabled={updatingSettings}
                          className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-[10px] font-extrabold uppercase tracking-wider text-zinc-350 hover:text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {updatingSettings ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>Guardar Parámetros CC</span>
                        </button>
                      </div>

                      {/* Financial Status Dashboard */}
                      {creditAccount && creditAccount.tiene_cuenta_corriente && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            Estado de Cuenta (CUIT: {activeCompany?.cuit})
                          </h4>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {/* Saldo Deudor */}
                            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center relative overflow-hidden">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500 block mb-1">
                                Saldo Deudor
                              </span>
                              <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                                ${parseFloat(String(creditAccount.saldo_actual)).toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            {/* Límite de Crédito */}
                            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/20 text-center">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                                Límite Total
                              </span>
                              <span className="font-mono font-bold text-white text-xs sm:text-sm">
                                ${parseFloat(String(creditAccount.limite_credito)).toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            {/* Disponible */}
                            {(() => {
                              const limite = parseFloat(String(creditAccount.limite_credito));
                              const saldo = parseFloat(String(creditAccount.saldo_actual));
                              const disponible = Math.max(0, limite - saldo);
                              return (
                                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500 block mb-1">
                                    Disponible
                                  </span>
                                  <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm">
                                    ${disponible.toLocaleString("es-AR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quick Payment Button */}
                          <div className="space-y-2">
                            {parseFloat(String(creditAccount.saldo_actual)) > 0 && (
                              <button
                                onClick={() => {
                                  setPaymentAmount(String(creditAccount.saldo_actual));
                                  setPaymentDesc(`Cobro parcial/total - ${selectedCustomer.razon_social}`);
                                  setShowPaymentModal(true);
                                }}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-xs font-black text-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 hover:scale-[1.01]"
                              >
                                <Coins className="w-4 h-4" />
                                <span>Registrar Cobro de Deuda</span>
                              </button>
                            )}

                            <button
                              onClick={() => setShowAllocationModal(true)}
                              className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-lg hover:scale-[1.01]"
                            >
                              <Coins className="w-4 h-4 text-emerald-400" />
                              <span>Imputar Saldos / Conciliar Cuenta</span>
                            </button>
                          </div>


                          {/* Cash Drawer Status Alert */}
                          {!activeCashSession && (
                            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-400 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <div>
                                <span className="font-bold">Caja Diaria Cerrada:</span> Cobros en Efectivo deshabilitados. Solo podrá recibir transferencias o tarjetas.
                              </div>
                            </div>
                          )}

                          {/* Movements Grid */}
                          <div className="space-y-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block">
                              Movimientos de Cuenta Corriente
                            </span>
                            
                            {creditMovements.length === 0 ? (
                              <div className="py-6 text-center border border-dashed border-zinc-850 rounded-xl">
                                <History className="w-5 h-5 text-zinc-650 mx-auto mb-1.5" />
                                <p className="text-[10px] text-zinc-500">
                                  No se registran compras ni pagos históricos.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                                {creditMovements.map((mov) => (
                                  <div
                                    key={mov.id}
                                    className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 flex items-center justify-between text-xs transition hover:border-zinc-800"
                                  >
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-white text-[11px]">
                                        {mov.description}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-bold ${
                                            mov.type === "debito"
                                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                          }`}
                                        >
                                          {mov.type === "debito" ? "COMPRA POS (DÉBITO)" : "COBRO (CRÉDITO)"}
                                        </span>
                                        {mov.created_at && (
                                          <span className="text-[9px] text-zinc-500 font-mono">
                                            {new Date(mov.created_at).toLocaleDateString("es-AR", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit"
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={`font-mono font-black text-xs ${
                                        mov.type === "debito" ? "text-red-400" : "text-emerald-400"
                                      }`}
                                    >
                                      {mov.type === "debito" ? "-" : "+"}
                                      $
                                      {parseFloat(String(mov.amount)).toLocaleString("es-AR", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Not Active Warning */}
                      {creditAccount && !creditAccount.tiene_cuenta_corriente && (
                        <div className="py-10 text-center border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20">
                          <Wallet className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                          <h5 className="text-xs font-bold text-white">
                            Cuenta Corriente Desactivada
                          </h5>
                          <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                            Active la cuenta y asigne un límite de crédito para permitir compras financiadas a este cliente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-white">
                  {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                    CUIT *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={formData.cuit}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cuit: e.target.value.replace(/\D/g, "").slice(0, 11),
                        }))
                      }
                      placeholder="30123456789"
                      disabled={!!editingCustomer}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-amber-500/40 font-mono disabled:opacity-50"
                    />
                    {loadingArca && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                    Condición IVA *
                  </label>
                  <select
                    value={formData.condicion_iva}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        condicion_iva: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/40 cursor-pointer"
                  >
                    {IVA_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                  Razón Social *
                </label>
                <input
                  type="text"
                  value={formData.razon_social}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      razon_social: e.target.value,
                    }))
                  }
                  placeholder="Nombre o Razón Social del cliente"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                  Dirección
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        direccion: e.target.value,
                      }))
                    }
                    placeholder="Calle 123, Ciudad"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="correo@ejemplo.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="+54 9 11 1234-5678"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-850">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {editingCustomer ? "Guardar Cambios" : "Registrar Cliente"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4 text-center">
            <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20 w-14 h-14 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                Confirmar Eliminación
              </h3>
              <p className="text-xs text-zinc-400">
                ¿Estás seguro de eliminar este cliente? Los comprobantes
                emitidos a su nombre se conservarán en el historial de
                facturas.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-extrabold text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Record Payment (Cobro) Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-white">
                  Registrar Cobro de Deuda
                </span>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-left">
                <p className="text-zinc-400">Cliente a Cobrar:</p>
                <p className="font-extrabold text-white">{selectedCustomer?.razon_social}</p>
                <p className="font-mono text-zinc-500 text-[10px]">CUIT: {selectedCustomer?.cuit}</p>
                <div className="mt-2 flex justify-between items-center pt-2 border-t border-zinc-850">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">Saldo Deudor Actual:</span>
                  <span className="font-mono font-black text-amber-400">
                    ${parseFloat(String(creditAccount?.saldo_actual || 0)).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                    Monto a Cobrar ($) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(creditAccount?.saldo_actual || 0))}
                    className="text-[9px] font-bold text-amber-400 hover:text-amber-500 transition-colors uppercase"
                  >
                    Copiar Saldo Total
                  </button>
                </div>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/40 font-mono"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                  Medio de Pago *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("efectivo")}
                    disabled={!activeCashSession}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === "efectivo"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
                    } disabled:opacity-30`}
                    title={!activeCashSession ? "Abra la caja para habilitar efectivo" : ""}
                  >
                    <Coins className="w-4 h-4 mx-auto" />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transferencia")}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === "transferencia"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
                    }`}
                  >
                    <Landmark className="w-4 h-4 mx-auto" />
                    <span>Transf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("tarjeta")}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === "tarjeta"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mx-auto" />
                    <span>Tarjeta</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">
                  Descripción / Referencia
                </label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Ej: Pago parcial factura 123"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/40"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-850">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecordCobro}
                disabled={recordingPayment}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-xs font-black text-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg shadow-amber-500/10"
              >
                {recordingPayment ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Coins className="w-3.5 h-3.5" />
                )}
                <span>Registrar Cobro</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 8. Credit Allocation Modal */}
      {showAllocationModal && selectedCustomer && creditAccount && (
        <CreditAllocator
          isOpen={showAllocationModal}
          onClose={() => setShowAllocationModal(false)}
          customer={selectedCustomer}
          creditAccount={creditAccount}
          companyCuit={activeCompany?.cuit || "20371024094"}
          onSuccess={() => {
            fetchCustomerCreditData(selectedCustomer.id);
          }}
        />
      )}
    </div>

  );
}
