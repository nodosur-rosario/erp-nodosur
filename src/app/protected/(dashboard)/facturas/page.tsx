"use client";

import React, { useEffect, useState } from "react";
import { 
  FileText, 
  Search, 
  Printer, 
  Eye, 
  Calendar, 
  User, 
  FileCheck2, 
  Building, 
  X, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Download,
  AlertCircle,
  Upload,
  CheckCircle2
} from "lucide-react";
import { getSupabaseClient } from "@/core/api/supabase";
import { useCompanyStore } from "@/core/company/company-store";
import { toast } from "sonner";
import { useSecretStore } from "@/features/sales/store/use-secret-store";
import { useDateRangeStore } from "@/core/store/date-range-store";
import { arDateToUTCBounds } from "@/core/utils/timezone-utils";
import { generateLibroIvaVentas, reconcileAfip } from "@/features/arca/actions";
import type { ReconciliationComparisonRow } from "@/features/arca/actions";

interface VoucherItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  alicuota_iva: number;
  subtotal: number;
}

interface Voucher {
  id: string;
  type: string;
  company_cuit: string;
  client_cuit: string;
  client_name: string;
  net_amount: string | number;
  iva_amount: string | number;
  total_amount: string | number;
  cae: string;
  cae_vto: string;
  qr_link: string;
  items: VoucherItem[] | string | null;
  created_at: string;
  canal?: string;
}

export default function FacturasPage() {
  const activeCompany = useCompanyStore((state) => state.currentCompany);
  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);
  const { startDate, endDate } = useDateRangeStore();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [hoveredVoucherId, setHoveredVoucherId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"history" | "reconciliation">("history");
  
  // Libro IVA states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatingIva, setGeneratingIva] = useState(false);

  // Reconciliation states
  const [reconciliationList, setReconciliationList] = useState<ReconciliationComparisonRow[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciledSummary, setReconciledSummary] = useState<{
    matched: number;
    mismatch: number;
    missingErp: number;
    missingAfip: number;
  } | null>(null);

  const handleExportLibroIva = async () => {
    setGeneratingIva(true);
    try {
      const res = await generateLibroIvaVentas(selectedMonth, selectedYear);
      if (res.error) {
        toast.error(res.error);
      } else if (res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `libro_iva_ventas_${selectedMonth.toString().padStart(2, "0")}_${selectedYear}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Libro IVA Ventas generado e importado exitosamente.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al exportar el Libro IVA.");
    } finally {
      setGeneratingIva(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReconciling(true);
    toast.info("Leyendo archivo CSV e iniciando cruces de datos contables...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await reconcileAfip(text);
        
        if (res.error) {
          toast.error(res.error);
        } else if (res.data) {
          setReconciliationList(res.data);
          
          const summary = res.data.reduce(
            (acc, row) => {
              if (row.status === "matched") acc.matched++;
              else if (row.status === "mismatch_amount") acc.mismatch++;
              else if (row.status === "missing_erp") acc.missingErp++;
              else if (row.status === "missing_afip") acc.missingAfip++;
              return acc;
            },
            { matched: 0, mismatch: 0, missingErp: 0, missingAfip: 0 }
          );
          
          setReconciledSummary(summary);
          toast.success(`Conciliación finalizada. ${summary.matched} conciliados correctamente.`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al conciliar los comprobantes del archivo CSV.");
      } finally {
        setIsReconciling(false);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  // Load vouchers from database
  const fetchVouchers = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const client = getSupabaseClient();
      
      // Calculate Argentina GMT-3 timezone bounds normalized to UTC
      const { startISO } = arDateToUTCBounds(startDate);
      const { endISO } = arDateToUTCBounds(endDate);

      let query = client.database
        .from("arca_vouchers")
        .select("*")
        .eq("company_cuit", activeCompany.cuit)
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      if (!showCajaNegra) {
        query = query.eq("canal", "oficial");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setVouchers((data as Voucher[]) || []);
    } catch (err: any) {
      console.error("Error loading vouchers:", err);
      toast.error("No se pudieron cargar los comprobantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [activeCompany, showCajaNegra, startDate, endDate]);

  // Filters and search logic
  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch = 
      v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.client_cuit.includes(searchQuery);
    
    const matchesType = filterType === "all" || v.type.toLowerCase().includes(filterType.toLowerCase());

    return matchesSearch && matchesType;
  });

  const handlePrint = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Helper to safely parse items
  const parseItems = (itemsField: any): VoucherItem[] => {
    if (!itemsField) return [];
    if (Array.isArray(itemsField)) return itemsField;
    try {
      if (typeof itemsField === "string") {
        return JSON.parse(itemsField);
      }
    } catch (e) {
      console.error("Error parsing voucher items:", e);
    }
    return [];
  };

  // Compute stats
  const totalInvoiced = filteredVouchers.reduce((acc, v) => acc + (parseFloat(String(v.total_amount)) || 0), 0);
  const countInvoices = filteredVouchers.length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-8 h-8 text-amber-400" />
            <span>Facturas y Comprobantes</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Historial de comprobantes autorizados ante AFIP, facturación electrónica y reportes fiscales.
          </p>
        </div>
        <button 
          onClick={fetchVouchers}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 self-start"
        >
          Sincronizar AFIP
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-zinc-800 pb-px gap-2">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "history"
              ? "border-amber-400 text-amber-400 font-extrabold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Historial de Comprobantes
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "reconciliation"
              ? "border-amber-400 text-amber-400 font-extrabold"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Conciliación e Impuestos (ARCA)
        </button>
      </div>

      {activeTab === "history" ? (
        <>
          {/* 2. Stats Section */}
          <div className="grid gap-6 sm:grid-cols-3">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Facturado ({activeCompany?.nombre_fantasia || "Empresa"})</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            ${totalInvoiced.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Total de comprobantes emitidos en el entorno.</p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cantidad Comprobantes</span>
            <FileCheck2 className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-white">{countInvoices} comprobantes</p>
          <p className="text-xs text-zinc-500 mt-1">Autorizados con código CAE vigente.</p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Punto de Venta activo</span>
            <Building className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-white">PV {activeCompany?.punto_venta || 1}</p>
          <p className="text-xs text-zinc-500 mt-1">Establecido en configuración fiscal.</p>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nro. Comprobante, CUIT, o Razón Social del cliente..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-850 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                filterType === "all"
                  ? "bg-zinc-800 border-zinc-700 text-white"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType("Factura A")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                filterType === "Factura A"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              Factura A
            </button>
            <button
              onClick={() => setFilterType("Factura B")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                filterType === "Factura B"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              Factura B
            </button>
            <button
              onClick={() => setFilterType("Factura C")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                filterType === "Factura C"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-900/50 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
              }`}
            >
              Factura C
            </button>
          </div>
        </div>
      </div>

      {/* 4. Content Area: Table or Empty State */}
      {loading ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm">Consultando comprobantes de venta...</p>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/10 p-16 text-center space-y-6 backdrop-blur-xl overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none">
            <div className="w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full animate-pulse" />
          </div>

          <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-amber-400 w-16 h-16 flex items-center justify-center mx-auto shadow-inner shadow-black">
            <FileText className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white">Historial de Facturación</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Aún no se han registrado comprobantes de venta en la base de datos para esta empresa. Podés emitir facturas electrónicas desde el punto de venta en el módulo **Ventas**.
            </p>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-1 text-xs text-zinc-500 font-mono">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Esperando comprobantes fiscales emitidos
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Nro. Comprobante</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4 text-right">Neto Gravado</th>
                  <th className="px-6 py-4 text-right">Impuesto IVA</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 text-xs text-zinc-300">
                {filteredVouchers.map((v) => (
                  <tr 
                    key={v.id} 
                    onClick={() => setSelectedVoucher(v)}
                    className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-450 font-mono">
                      {new Date(v.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      <div className="relative inline-block">
                        <span 
                          onMouseEnter={() => setHoveredVoucherId(v.id)}
                          onMouseLeave={() => setHoveredVoucherId(null)}
                          className="hover:text-amber-400 cursor-help transition duration-150"
                        >
                          {v.id}
                        </span>

                        {hoveredVoucherId === v.id && (
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-50 w-64 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/90 text-left backdrop-blur-md pointer-events-none animate-fade-in">
                            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-1.5 mb-2">
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Detalle Facturado</span>
                            </div>
                            
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                              {parseItems(v.items).length === 0 ? (
                                <p className="text-[10px] text-zinc-500 italic">Sin artículos detallados.</p>
                              ) : (
                                parseItems(v.items).map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-[10px] gap-2">
                                    <span className="text-zinc-400 font-medium leading-tight">
                                      <span className="text-amber-400 font-bold font-mono">{item.cantidad}x</span> {item.descripcion}
                                    </span>
                                    <span className="text-white font-mono shrink-0">${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="border-t border-zinc-850/60 pt-1.5 mt-2 flex justify-between items-center text-[10px] font-bold">
                              <span className="text-zinc-500 uppercase tracking-wider">Total</span>
                              <span className="text-amber-400 font-mono text-[11px]">${parseFloat(String(v.total_amount)).toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {v.canal === "interno" ? (
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {v.type}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          v.type.includes("Factura A") 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          {v.type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate">
                      <p className="font-semibold text-white">{v.client_name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">CUIT: {v.client_cuit}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-zinc-400">
                      ${parseFloat(String(v.net_amount)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-zinc-400">
                      ${parseFloat(String(v.iva_amount)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white font-mono">
                      ${parseFloat(String(v.total_amount)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVoucher(v);
                          }}
                          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                          title="Visualizar Comprobante"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(v);
                          }}
                          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                          title="Imprimir Factura A4"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  ) : (
        <div className="space-y-8 animate-fade-in">
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Card A: Libro IVA Ventas Export */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-md space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Libro IVA Ventas Digital</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Exportar la planilla fiscal mensual del período seleccionado lista para conciliar o subir al portal de ARCA.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Mes Fiscal</label>
                  <select
                    aria-label="Seleccionar mes"
                    title="Seleccionar mes"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    {Array.from({ length: 12 }, (_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {new Date(2026, idx, 1).toLocaleString("es-AR", { month: "long" }).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Año Fiscal</label>
                  <select
                    aria-label="Seleccionar año"
                    title="Seleccionar año"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleExportLibroIva}
                disabled={generatingIva}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-xs font-bold text-black flex items-center justify-center gap-1.5 transition-all"
              >
                {generatingIva ? (
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Generar Libro IVA Ventas CSV</span>
              </button>
            </div>

            {/* Card B: AFIP Mis Comprobantes Reconciliation */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-md space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Auditoría de Comprobantes AFIP</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Subir el archivo CSV oficial de &quot;Mis Comprobantes Emitidos&quot; de ARCA para auditar discrepancias con el ERP.
                </p>
              </div>

              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-800 hover:border-amber-500/40 rounded-2xl bg-zinc-950/40 cursor-pointer transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <p className="text-xs text-zinc-400 font-bold">Seleccionar archivo CSV de AFIP</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Arrastrar o hacer click</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCsvUpload} 
                    disabled={isReconciling} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 3. Reconciliation Summary Widgets */}
          {reconciledSummary && (
            <div className="grid gap-4 sm:grid-cols-4 animate-fade-in">
              <div className="p-4 rounded-xl border border-zinc-800 bg-emerald-500/5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Conciliados (Ok)</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{reconciledSummary.matched}</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-amber-500/5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Monto discrepante</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{reconciledSummary.mismatch}</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-red-500/5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-500">Faltante en ERP</p>
                <p className="text-2xl font-black text-red-400 mt-1">{reconciledSummary.missingErp}</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-blue-500/5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500">Faltante en AFIP</p>
                <p className="text-2xl font-black text-blue-400 mt-1">{reconciledSummary.missingAfip}</p>
              </div>
            </div>
          )}

          {/* 4. Reconciliation Details Table */}
          {reconciliationList.length > 0 && (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden backdrop-blur-xl animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-850 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Comprobante / CAE</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4 text-right">Monto ERP ($)</th>
                      <th className="px-6 py-4 text-right">Monto AFIP ($)</th>
                      <th className="px-6 py-4 text-center">Estado Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850/60 text-xs text-zinc-300">
                    {reconciliationList.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-zinc-450">{row.date}</td>
                        <td className="px-6 py-4 font-mono font-bold text-white">
                          <div>{row.id}</div>
                          <div className="text-[10px] text-zinc-500 font-normal">CAE: {row.cae}</div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-white">{row.client_name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">CUIT: {row.client_cuit}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold">
                          {row.erp_amount > 0 ? `$${row.erp_amount.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold">
                          {row.afip_amount > 0 ? `$${row.afip_amount.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {row.status === "matched" && (
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Conciliado (Ok)
                            </span>
                          )}
                          {row.status === "mismatch_amount" && (
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Importe discrepante
                            </span>
                          )}
                          {row.status === "missing_erp" && (
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold bg-red-500/10 text-red-450 border border-red-500/20">
                              Falta en ERP
                            </span>
                          )}
                          {row.status === "missing_afip" && (
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold bg-blue-500/10 text-blue-450 border border-blue-500/20">
                              Falta en AFIP
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Invoicing Details & A4 Printing Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto no-print animate-fade-in">
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Controls */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-white">Comprobante de Venta Electrónico</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir A4</span>
                </button>
                <button
                  aria-label="Cerrar vista previa"
                  title="Cerrar vista previa"
                  onClick={() => setSelectedVoucher(null)}
                  className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Simulated Official AFIP Invoice Structure */}
            <div id="invoice-print-area" className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 text-zinc-200 text-xs rounded-xl space-y-6 font-sans">
              
              {/* Header Box */}
              <div className="border border-zinc-700 grid grid-cols-1 md:grid-cols-2 relative">
                {/* Central Letter Indicator Block */}
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-px border-x border-b border-zinc-700 bg-zinc-950 text-white w-14 h-14 flex flex-col items-center justify-center z-10 font-sans">
                  <span className="text-2xl font-black">{selectedVoucher.type.includes("Factura A") ? "A" : selectedVoucher.type.includes("Factura B") ? "B" : "C"}</span>
                  <span className="text-[8px] font-bold text-zinc-500">COD. {selectedVoucher.type.includes("Factura A") ? "001" : selectedVoucher.type.includes("Factura B") ? "006" : "011"}</span>
                </div>

                {/* Left Header - Emisor Info */}
                <div className="p-4 space-y-2 border-b md:border-b-0 md:border-r border-zinc-700">
                  <h2 className="text-xl font-black text-white tracking-tight uppercase">
                    {activeCompany?.nombre_fantasia || activeCompany?.razon_social || "NODO SUR ERP"}
                  </h2>
                  <p className="font-bold text-zinc-300">{activeCompany?.razon_social}</p>
                  <p className="text-zinc-400">Dirección: {activeCompany?.direccion || "No especificada"}</p>
                  <p className="text-zinc-400">Condición IVA: <span className="font-bold">{activeCompany?.condicion_iva || "Responsable Inscripto"}</span></p>
                </div>

                {/* Right Header - Voucher Metadata */}
                <div className="p-4 space-y-2 text-left md:text-right flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">FACTURA</h3>
                    <p className="text-sm font-bold font-mono text-zinc-300">Nº {selectedVoucher.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-400 font-mono">Fecha: {new Date(selectedVoucher.created_at).toLocaleDateString("es-AR")}</p>
                    <p className="text-zinc-400 font-mono">CUIT Emisor: {selectedVoucher.company_cuit}</p>
                    {activeCompany?.ingresos_brutos && (
                      <p className="text-zinc-400 font-mono">Ingresos Brutos: {activeCompany.ingresos_brutos}</p>
                    )}
                    <p className="text-zinc-400 font-mono">Inicio de Actividades: {activeCompany?.inicio_actividades || "15/05/2026"}</p>
                  </div>
                </div>
              </div>

              {/* Customer Box */}
              <div className="border border-zinc-700 p-4 rounded-lg bg-zinc-950/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Datos del Cliente</p>
                  <p className="text-sm font-bold text-white">{selectedVoucher.client_name}</p>
                  <p className="text-zinc-400 font-mono">CUIT: {selectedVoucher.client_cuit}</p>
                </div>
                <div className="space-y-1 text-left md:text-right">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Condición Comercial</p>
                  <p className="text-zinc-300 font-semibold">Condición IVA: {selectedVoucher.type.includes("Factura A") ? "IVA Responsable Inscripto" : "Consumidor Final"}</p>
                  <p className="text-zinc-400">Condición Pago: Contado / Efectivo</p>
                </div>
              </div>

              {/* Items Grid */}
              <div className="border border-zinc-700 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-700 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-right">Cant.</th>
                      <th className="px-4 py-3 text-right">P. Unitario</th>
                      <th className="px-4 py-3 text-right">Alícuota IVA</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-xs text-zinc-300">
                    {parseItems(selectedVoucher.items).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{item.codigo}</td>
                        <td className="px-4 py-3 text-white font-semibold">{item.descripcion}</td>
                        <td className="px-4 py-3 text-right font-mono">{item.cantidad}</td>
                        <td className="px-4 py-3 text-right font-mono">${parseFloat(String(item.precio_unitario)).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-500">{item.alicuota_iva}%</td>
                        <td className="px-4 py-3 text-right font-mono text-white">${parseFloat(String(item.subtotal)).toFixed(2)}</td>
                      </tr>
                    ))}
                    {parseItems(selectedVoucher.items).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-zinc-500 italic">
                          Consumo general de servicios / productos autopartes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Liquidación Totals Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Left - AFIP Legal Legends */}
                <div className="space-y-2 text-zinc-500 text-[10px] italic leading-normal flex flex-col justify-end">
                  <p>
                    Comprobante autorizado electrónicamente mediante Web Service de AFIP según Resoluciones Generales vigentes.
                  </p>
                  <p className="font-bold font-mono not-italic text-amber-500/80">
                    ERP Nodo Sur — Entorno de Simulación Integrado AFIP v1.0
                  </p>
                </div>

                {/* Right - Financial Breakdown */}
                <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-950/40 space-y-2 text-right">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-semibold">Subtotal Neto Gravado:</span>
                    <span className="font-mono text-zinc-300 font-bold">${parseFloat(String(selectedVoucher.net_amount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-semibold">IVA Liquidado:</span>
                    <span className="font-mono text-zinc-300 font-bold">${parseFloat(String(selectedVoucher.iva_amount)).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-zinc-700 pt-2 flex justify-between items-center text-sm">
                    <span className="text-white font-extrabold uppercase">Importe Total:</span>
                    <span className="font-mono text-amber-400 font-black text-lg">
                      ${parseFloat(String(selectedVoucher.total_amount)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* AFIP Barcode, CAE, & QR Code Footer */}
              <div className="border-t-2 border-dashed border-zinc-700 pt-6 flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Simulated AFIP Logo and Barcode */}
                <div className="flex items-center gap-4">
                  <div className="bg-white text-black p-2 rounded font-black tracking-tighter text-base border border-zinc-300">
                    <span className="text-blue-700">A</span>
                    <span className="text-blue-500">F</span>
                    <span className="text-yellow-500">I</span>
                    <span className="text-blue-800">P</span>
                  </div>
                  <div className="space-y-1 font-mono text-[9px] text-zinc-500">
                    {/* Simulated barcode bars using blocks */}
                    <div className="text-zinc-400 font-black tracking-widest text-[14px] leading-none select-none">
                      ||||| | || |||| | | ||||| | || |||| | | ||||| ||
                    </div>
                    <div>3071776221001{selectedVoucher.id.replace(/\D/g, "")}3</div>
                  </div>
                </div>

                {/* QR Code (RG 4892) */}
                {selectedVoucher.qr_link && selectedVoucher.qr_link !== "—" && (
                  <div className="flex flex-col items-center gap-1 bg-white p-1.5 rounded border border-zinc-300 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(selectedVoucher.qr_link)}`} 
                      alt="Código QR Oficial AFIP"
                      className="w-16 h-16 object-contain"
                    />
                    <span className="text-[6px] font-black text-black uppercase tracking-wider font-mono">Comprobante Autorizado</span>
                  </div>
                )}

                {/* CAE and CAE Expiration */}
                <div className="text-center md:text-right space-y-1">
                  <p className="text-xs text-white font-bold font-mono">
                    CAE Nº: <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-amber-300 font-black tracking-widest">{selectedVoucher.cae}</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Fecha de Vto. CAE: {selectedVoucher.cae_vto}
                  </p>
                </div>
              </div>

            </div>

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
                  max-width: 100% !important;
                  background: white !important;
                  color: black !important;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-sizing: border-box;
                }
                /* Clean text and border colors for print output */
                #invoice-print-area h2, 
                #invoice-print-area h3, 
                #invoice-print-area span,
                #invoice-print-area p,
                #invoice-print-area td,
                #invoice-print-area th {
                  color: black !important;
                }
                #invoice-print-area .border, 
                #invoice-print-area border-b,
                #invoice-print-area border-x,
                #invoice-print-area border-t,
                #invoice-print-area border-dashed {
                  border-color: #333333 !important;
                }
                #invoice-print-area table {
                  border-collapse: collapse !important;
                }
                #invoice-print-area tr {
                  border-bottom: 1px solid #444444 !important;
                }
                #invoice-print-area .bg-zinc-950,
                #invoice-print-area .bg-zinc-950\\/20,
                #invoice-print-area .bg-zinc-950\\/40,
                #invoice-print-area .bg-zinc-900\\/40 {
                  background-color: #f3f4f6 !important;
                }
                #invoice-print-area .text-amber-400 {
                  color: black !important;
                  font-weight: bold !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

          </div>
        </div>
      )}
    </div>
  );
}
