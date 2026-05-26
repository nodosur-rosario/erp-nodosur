"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Download, 
  RefreshCw, 
  BarChart2, 
  Loader2, 
  DollarSign, 
  AlertCircle,
  FileText,
  UserCheck,
  Search,
  ShoppingCart,
  ShieldCheck,
  Calendar,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import { useCompanyStore } from "@/core/company/company-store";
import { useDateRangeStore } from "@/core/store/date-range-store";
import { useSecretStore } from "@/features/sales/store/use-secret-store";
import { getSupabaseClient } from "@/core/api/supabase";
import { toast } from "@/core/notification/toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

interface SalesRecord {
  fecha: string;
  company_cuit: string;
  canal: string;
  cantidad_ventas: number;
  total_neto: number;
  total_iva: number;
  total_facturado: number;
}

interface ChartDay {
  date: string;
  formattedDate: string;
  total: number;
  net: number;
  tax: number;
  count: number;
}

interface RecentVoucher {
  id: string;
  client_name: string;
  type: string;
  total_amount: number;
  created_at: string;
  status: string;
  canal: string;
}

const parseToISODate = (ddMMyyyy: string) => {
  const parts = ddMMyyyy.split("/");
  if (parts.length !== 3) return ddMMyyyy;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const getDatesInRange = (startStr: string, endStr: string) => {
  const dates = [];
  const start = new Date(parseToISODate(startStr) + "T00:00:00");
  const end = new Date(parseToISODate(endStr) + "T00:00:00");
  
  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export default function ReportesPage() {
  const activeCompany = useCompanyStore((state) => state.currentCompany);
  const currentCuit = useCompanyStore((state) => state.currentCuit);
  const { startDate, endDate } = useDateRangeStore();
  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [ccAccounts, setCcAccounts] = useState<any[]>([]);
  const [rankingList, setRankingList] = useState<any[]>([]);
  const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([]);
  
  // Interactive Chart Suite controls
  const [chartType, setChartType] = useState<"area" | "linea" | "barras">("area");
  const [chartMetric, setChartMetric] = useState<"total" | "net" | "count">("total");
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  // Search Filters
  const [ccSearch, setCcSearch] = useState("");
  const [rankingSearch, setRankingSearch] = useState("");
  
  // KPI Totals
  const [kpis, setKpis] = useState({
    totalFacturado: 0,
    totalNeto: 0,
    totalIva: 0,
    cantidadVentas: 0
  });

  const loadReportData = async () => {
    if (!currentCuit) return;
    setLoading(true);
    try {
      const client = getSupabaseClient();
      
      // 1. Fetch Sales Vouchers (Materialized View)
      let queryBuilder = client.database
        .from("mv_ventas_diarias")
        .select("*")
        .eq("company_cuit", currentCuit)
        .gte("fecha", parseToISODate(startDate))
        .lte("fecha", parseToISODate(endDate));

      if (showCajaNegra) {
        queryBuilder = queryBuilder.eq("canal", "oficial");
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      const rawRows: SalesRecord[] = data || [];
      setRecords(rawRows);

      // 2. Fetch Cuentas Corrientes Accounts
      const { data: ccData, error: ccErr } = await client.database
        .from("customer_credit_accounts")
        .select(`
          saldo_actual,
          limite_credito,
          tiene_cuenta_corriente,
          customers (
            razon_social,
            cuit,
            phone
          )
        `)
        .eq("company_cuit", currentCuit);

      if (!ccErr && ccData) {
        setCcAccounts(ccData);
      }

      // 3. Process Sales KPIs
      let facturado = 0;
      let neto = 0;
      let iva = 0;
      let cantidad = 0;

      rawRows.forEach((r) => {
        facturado += Number(r.total_facturado);
        neto += Number(r.total_neto);
        iva += Number(r.total_iva);
        cantidad += Number(r.cantidad_ventas);
      });

      setKpis({
        totalFacturado: facturado,
        totalNeto: neto,
        totalIva: iva,
        cantidadVentas: cantidad
      });

      // 4. Process Sales Daily Timeline
      const dateRangeList = getDatesInRange(startDate, endDate);
      const timeline: ChartDay[] = dateRangeList.map((dateStr) => {
        const matchingEntries = rawRows.filter((r) => r.fecha === dateStr);
        let dayTotal = 0;
        let dayNet = 0;
        let dayTax = 0;
        let dayCount = 0;

        matchingEntries.forEach((entry) => {
          dayTotal += Number(entry.total_facturado);
          dayNet += Number(entry.total_neto);
          dayTax += Number(entry.total_iva);
          dayCount += Number(entry.cantidad_ventas);
        });

        const dateObj = new Date(dateStr + "T00:00:00");
        const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

        return {
          date: dateStr,
          formattedDate,
          total: dayTotal,
          net: dayNet,
          tax: dayTax,
          count: dayCount
        };
      });

      setChartData(timeline);

      // 5. Aggregate dynamic "Ranking de Repuestos" using arca_vouchers
      let vouchersQuery = client.database
        .from("arca_vouchers")
        .select("items, canal")
        .eq("company_cuit", currentCuit)
        .gte("created_at", parseToISODate(startDate) + "T00:00:00")
        .lte("created_at", parseToISODate(endDate) + "T23:59:59");
        
      if (showCajaNegra) {
        vouchersQuery = vouchersQuery.eq("canal", "oficial");
      }

      const { data: vouchers, error: vouchersErr } = await vouchersQuery;
      
      if (!vouchersErr && vouchers) {
        const rankingMap: Record<string, { 
          codigo: string; 
          descripcion: string; 
          cantidad: number; 
          totalNeto: number;
        }> = {};
        
        vouchers.forEach((row: any) => {
          try {
            const itemsList = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
            if (Array.isArray(itemsList)) {
              itemsList.forEach((item: any) => {
                const artId = item.id;
                if (!artId) return;
                if (!rankingMap[artId]) {
                  rankingMap[artId] = {
                    codigo: item.codigo_fabricante || "S/D",
                    descripcion: item.descripcion || "Artículo sin descripción",
                    cantidad: 0,
                    totalNeto: 0
                  };
                }
                rankingMap[artId].cantidad += Number(item.cantidad || 0);
                rankingMap[artId].totalNeto += Number(item.cantidad || 0) * Number(item.precio_unitario || 0);
              });
            }
          } catch (e) {}
        });

        const sortedRanking = Object.values(rankingMap).sort((a, b) => b.cantidad - a.cantidad);
        setRankingList(sortedRanking);
      }

      // 6. Fetch 5 Recent Vouchers for high-density live list
      let recentQuery = client.database
        .from("arca_vouchers")
        .select("id, client_name, type, total_amount, created_at, status, canal")
        .eq("company_cuit", currentCuit)
        .order("created_at", { ascending: false })
        .limit(5);

      if (showCajaNegra) {
        recentQuery = recentQuery.eq("canal", "oficial");
      }

      const { data: recData, error: recErr } = await recentQuery;
      if (!recErr && recData) {
        setRecentVouchers(recData);
      }
    } catch (err: any) {
      console.error("Error loading report data:", err);
      toast.error("No se pudieron cargar los datos del reporte.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [currentCuit, startDate, endDate, showCajaNegra]);

  const handleRefreshData = async () => {
    setRefreshing(true);
    toast.info("Refrescando base analítica...");
    try {
      const client = getSupabaseClient();
      const { error } = await client.database.rpc("refresh_mv_ventas_diarias");
      if (error) throw error;
      
      toast.success("¡Base analítica actualizada con éxito!");
      await loadReportData();
    } catch (err: any) {
      console.error("Error refreshing materialized view:", err);
      toast.error("Error al actualizar la base analítica de reportes.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadIvaExcel = async () => {
    if (!activeCompany) return;
    try {
      toast.info("Generando Libro de IVA Ventas Digital...");
      const client = getSupabaseClient();
      
      let queryBuilder = client.database
        .from("arca_vouchers")
        .select("id, type, created_at, client_cuit, client_name, net_amount, iva_amount, total_amount, status, canal")
        .eq("company_cuit", activeCompany.cuit)
        .gte("created_at", parseToISODate(startDate) + "T00:00:00")
        .lte("created_at", parseToISODate(endDate) + "T23:59:59");
        
      if (showCajaNegra) {
        queryBuilder = queryBuilder.eq("canal", "oficial");
      }
      
      const { data: rows, error } = await queryBuilder;
      if (error) throw error;
      if (!rows || rows.length === 0) {
        toast.warning("No hay comprobantes registrados en el período seleccionado.");
        return;
      }
      
      const formattedRows = rows.map((r: any) => ({
        "Comprobante Nº": r.id,
        "Tipo": r.type,
        "Fecha Emisión": new Date(r.created_at).toLocaleDateString("es-AR"),
        "Doc. Cliente": r.client_cuit,
        "Razón Social Cliente": r.client_name,
        "Importe Neto ($)": Number(r.net_amount),
        "IVA ($)": Number(r.iva_amount),
        "Importe Total ($)": Number(r.total_amount),
        "Estado AFIP": r.status,
        "Canal": r.canal,
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "IVA Ventas");
      
      XLSX.writeFile(workbook, `IVA_Ventas_${activeCompany.cuit}_${startDate.replace(/\//g, "-")}_a_${endDate.replace(/\//g, "-")}.xlsx`);
      toast.success("Libro de IVA digital Excel exportado.");
    } catch (err) {
      console.error("Error exporting Excel:", err);
      toast.error("No se pudo generar el archivo de exportación.");
    }
  };

  const handleDownloadCuentasCorrientesExcel = async () => {
    if (!activeCompany) return;
    try {
      toast.info("Generando reporte de Cuentas Corrientes...");
      const client = getSupabaseClient();
      const { data: rows, error } = await client.database
        .from("customer_credit_accounts")
        .select(`
          saldo_actual,
          limite_credito,
          tiene_cuenta_corriente,
          customers (
            razon_social,
            cuit,
            phone
          )
        `)
        .eq("company_cuit", activeCompany.cuit);
        
      if (error) throw error;
      if (!rows || rows.length === 0) {
        toast.warning("No se encontraron cuentas corrientes activas.");
        return;
      }
      
      const formattedRows = rows.map((r: any) => ({
        "Cliente": r.customers?.razon_social || "Sin nombre",
        "CUIT": r.customers?.cuit || "Sin CUIT",
        "Teléfono": r.customers?.phone || "—",
        "Saldo Actual ($)": Number(r.saldo_actual),
        "Límite de Crédito ($)": Number(r.limite_credito),
        "Habilitada": r.tiene_cuenta_corriente ? "SÍ" : "NO",
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Saldos CC");
      
      XLSX.writeFile(workbook, `Saldos_CuentasCorrientes_${activeCompany.cuit}.xlsx`);
      toast.success("Saldos de Cuentas Corrientes descargados.");
    } catch (err) {
      console.error("Error exporting CC Excel:", err);
      toast.error("No se pudo generar el reporte de cuentas corrientes.");
    }
  };

  const handleDownloadRankingExcel = async () => {
    if (!activeCompany) return;
    try {
      toast.info("Generando Ranking de Repuestos...");
      const formattedRows = rankingList.map((r, idx) => ({
        "Puesto": idx + 1,
        "Código Fabricante": r.codigo,
        "Descripción Repuesto": r.descripcion,
        "Cantidad Vendida": r.cantidad,
        "Total Neto Facturado ($)": Number(r.totalNeto.toFixed(2)),
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ranking");
      
      XLSX.writeFile(workbook, `Ranking_Repuestos_${activeCompany.cuit}_${startDate.replace(/\//g, "-")}_a_${endDate.replace(/\//g, "-")}.xlsx`);
      toast.success("Ranking de Repuestos Excel descargado.");
    } catch (err) {
      console.error("Error exporting ranking Excel:", err);
      toast.error("No se pudo generar el reporte de ranking.");
    }
  };

  // ----------------------------------------------------
  // Dynamic Charting SVG Math (SaaS Minimalist Overhaul)
  // ----------------------------------------------------
  const getMetricVal = (d: ChartDay) => {
    if (chartMetric === "net") return d.net;
    if (chartMetric === "count") return d.count;
    return d.total;
  };

  const activeMaxVal = Math.max(...chartData.map((d) => getMetricVal(d)), 0);
  const chartMax = activeMaxVal === 0 ? (chartMetric === "count" ? 10 : 1000) : activeMaxVal;
  
  const paddingLeft = 30;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 25;
  
  const chartWidth = 600;
  const chartHeight = 135; 

  const points = chartData.map((d, i) => {
    const val = getMetricVal(d);
    const x = paddingLeft + (chartData.length > 1 ? (i / (chartData.length - 1)) * (chartWidth - paddingLeft - paddingRight) : (chartWidth - paddingLeft - paddingRight) / 2);
    const y = chartHeight - paddingBottom - (val / chartMax) * (chartHeight - paddingTop - paddingBottom);
    return { x, y, val, data: d };
  });

  const lineD = points.length > 0 
    ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}` 
    : "";

  const areaD = points.length > 0 
    ? `${lineD} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z` 
    : "";

  const barWidth = chartData.length > 0
    ? Math.min(6, Math.max(2.5, ((chartWidth - paddingLeft - paddingRight) / chartData.length) * 0.35))
    : 6;

  // Local Search Filters
  const filteredCcAccounts = ccAccounts.filter((acc) => {
    const query = ccSearch.toLowerCase().trim();
    if (!query) return true;
    const clientName = acc.customers?.razon_social?.toLowerCase() || "";
    const clientCuit = acc.customers?.cuit || "";
    return clientName.includes(query) || clientCuit.includes(query);
  });

  const filteredRankingList = rankingList.filter((item) => {
    const query = rankingSearch.toLowerCase().trim();
    if (!query) return true;
    const desc = item.descripcion.toLowerCase();
    const code = item.codigo.toLowerCase();
    return desc.includes(query) || code.includes(query);
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Reportes y Estadísticas
          </h1>
          <p className="text-xs text-zinc-500 mt-1.5 font-medium leading-relaxed">
            Consola contable unificada. Auditoría en caliente, análisis de IVA ventas y saldos pendientes.
          </p>
        </div>
        
        <button 
          onClick={handleRefreshData}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-xs font-bold text-zinc-350 hover:text-white transition-all flex items-center gap-1.5 shrink-0 self-start disabled:opacity-50 hover:scale-[1.015]"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{refreshing ? "Sincronizando..." : "Actualizar Datos"}</span>
        </button>
      </div>

      {/* Secret Blackbox Active Alert */}
      {showCajaNegra && (
        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-2.5 items-center text-xs text-amber-400 font-semibold animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Filtro de Caja Negra activo: Mostrando únicamente transacciones de canal Oficial.</span>
        </div>
      )}

      {/* Reusable Shadcn Tabs Navigation */}
      <Tabs defaultValue="ventas" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900/80 pb-2 gap-4">
          <TabsList className="bg-zinc-950/80 border border-zinc-900 p-0.5 rounded-xl flex flex-wrap shrink-0">
            <TabsTrigger value="ventas" className="px-4 py-2 text-[11px]">Ventas y Facturación</TabsTrigger>
            <TabsTrigger value="cuentas_corrientes" className="px-4 py-2 text-[11px]">Cuentas Corrientes</TabsTrigger>
            <TabsTrigger value="ranking" className="px-4 py-2 text-[11px]">Ranking de Repuestos</TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: PREMIUM SALES DASHBOARD                       */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="ventas" className="space-y-6 pt-4">
          
          {/* KPI Cards Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border border-zinc-900 bg-zinc-950/10 p-5 animate-pulse space-y-3.5">
                  <div className="h-3 bg-zinc-900 rounded w-1/2" />
                  <div className="h-6 bg-zinc-900 rounded w-1/3" />
                </div>
              ))
            ) : (
              <>
                <div className="p-5 rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 hover:border-zinc-700/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all flex flex-col justify-between h-28 relative group">
                  <div className="absolute -inset-px bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-2xl" />
                  <div className="flex items-center justify-between select-none">
                    <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[9px]">Total Facturado</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight font-sans">
                    ${kpis.totalFacturado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 hover:border-zinc-700/60 transition-all flex flex-col justify-between h-28">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[9px]">Base Imponible</span>
                    <div className="w-7 h-7 rounded-lg bg-zinc-800/40 border border-zinc-800/60 flex items-center justify-center text-zinc-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-white leading-none">
                    ${kpis.totalNeto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 hover:border-zinc-700/60 transition-all flex flex-col justify-between h-28">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[9px]">Débito Fiscal IVA</span>
                    <div className="w-7 h-7 rounded-lg bg-zinc-800/40 border border-zinc-800/60 flex items-center justify-center text-zinc-400">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-white leading-none">
                    ${kpis.totalIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 hover:border-zinc-700/60 transition-all flex flex-col justify-between h-28">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-zinc-500 font-extrabold uppercase tracking-wider text-[9px]">Comprobantes</span>
                    <div className="w-7 h-7 rounded-lg bg-zinc-800/40 border border-zinc-800/60 flex items-center justify-center text-zinc-400">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-white leading-none">
                    {kpis.cantidadVentas} {kpis.cantidadVentas === 1 ? "venta" : "ventas"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Premium Apple/Stripe-Style Analytics Chart */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/20 p-6 space-y-6 relative overflow-hidden backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white tracking-tight">Evolución Cronológica</h3>
                <p className="text-[10px] text-zinc-500 font-medium">Historial consolidado de ventas diarias (GMT-3)</p>
              </div>

              {/* Chart controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Metrics */}
                <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-900 p-0.5 text-zinc-500 text-[9px] font-black uppercase tracking-wider">
                  {[
                    { key: "total", label: "Facturado" },
                    { key: "net", label: "Neto" },
                    { key: "count", label: "Volumen" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setChartMetric(m.key as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        chartMetric === m.key 
                          ? "bg-zinc-900 text-white shadow border border-zinc-800/40 font-bold" 
                          : "hover:text-zinc-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Shapes */}
                <div className="inline-flex rounded-xl bg-zinc-950 border border-zinc-900 p-0.5 text-zinc-500 text-[9px] font-black uppercase tracking-wider">
                  {[
                    { key: "area", label: "Área" },
                    { key: "barras", label: "Barras" },
                    { key: "linea", label: "Línea" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setChartType(t.key as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        chartType === t.key 
                          ? "bg-zinc-900 text-white shadow border border-zinc-800/40 font-bold" 
                          : "hover:text-zinc-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="h-[135px] flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
              </div>
            ) : chartData.length === 0 || kpis.totalFacturado === 0 ? (
              <div className="h-[135px] flex flex-col items-center justify-center border border-dashed border-zinc-900 rounded-2xl space-y-2">
                <BarChart2 className="w-8 h-8 text-zinc-800" />
                <p className="text-xs font-semibold text-zinc-550">Sin registros de venta en el rango establecido.</p>
              </div>
            ) : (
              <div className="relative">
                {/* SVG Sparkline Chart */}
                <svg 
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                  className="w-full h-auto max-h-[160px] select-none overflow-visible"
                >
                  <defs>
                    <linearGradient id="chart-area-grad-stripe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* 3 Extremely Faint Horizontal Gridlines for spatial depth */}
                  {[0.33, 0.66, 1.0].map((ratio, idx) => {
                    const gridY = paddingTop + (1 - ratio) * (chartHeight - paddingTop - paddingBottom);
                    return (
                      <line 
                        key={idx}
                        x1={paddingLeft} 
                        y1={gridY} 
                        x2={chartWidth - paddingRight} 
                        y2={gridY} 
                        stroke="#141418" 
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Baseline */}
                  <line 
                    x1={paddingLeft} 
                    y1={chartHeight - paddingBottom} 
                    x2={chartWidth - paddingRight} 
                    y2={chartHeight - paddingBottom} 
                    stroke="#1c1c24" 
                    strokeWidth="1"
                  />

                  {/* Dynamic SVG Plot Render */}
                  {chartType === "area" && areaD && (
                    <path d={areaD} fill="url(#chart-area-grad-stripe)" className="transition-all duration-350" />
                  )}

                  {(chartType === "area" || chartType === "linea") && lineD && (
                    <path d={lineD} fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeLinecap="round" className="transition-all duration-350" />
                  )}

                  {chartType === "barras" && points.map((p, idx) => (
                    <rect
                      key={idx}
                      x={p.x - barWidth / 2}
                      y={p.y}
                      width={barWidth}
                      height={Math.max(1, chartHeight - paddingBottom - p.y)}
                      fill="#f59e0b"
                      opacity="0.8"
                      rx="1"
                      className="transition-all duration-300 hover:fill-amber-400 cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}

                  {/* Stripe-style: NO dots on the whole line, only a pulsing node on the hovered date */}
                  {chartType !== "barras" && points.map((p, idx) => (
                    <g key={idx}>
                      {/* Invisible wider hover area */}
                      <rect 
                        x={p.x - 8} 
                        y={paddingTop} 
                        width="16" 
                        height={chartHeight - paddingTop - paddingBottom} 
                        fill="transparent" 
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  ))}

                  {/* Render thin vertical guideline on hover */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.x}
                      y1={paddingTop}
                      x2={hoveredPoint.x}
                      y2={chartHeight - paddingBottom}
                      stroke="#27272a"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      className="animate-fade-in"
                    />
                  )}

                  {/* Render pulsing highlighted dot ONLY for the hovered point */}
                  {hoveredPoint && chartType !== "barras" && (
                    <g className="animate-fade-in">
                      {/* Large outer pulsing glow */}
                      <circle 
                        cx={hoveredPoint.x} 
                        cy={hoveredPoint.y} 
                        r="7" 
                        fill="#f59e0b" 
                        opacity="0.25"
                      />
                      {/* Solid inner node */}
                      <circle 
                        cx={hoveredPoint.x} 
                        cy={hoveredPoint.y} 
                        r="3" 
                        fill="#f59e0b" 
                      />
                    </g>
                  )}

                  {/* Faint start/end timeline date labels */}
                  {points.length > 0 && (
                    <>
                      <text 
                        x={points[0].x} 
                        y={chartHeight - 8} 
                        fill="#3f3f46" 
                        fontSize="8" 
                        fontFamily="monospace"
                        textAnchor="start"
                      >
                        {points[0].data.formattedDate}
                      </text>
                      <text 
                        x={points[points.length - 1].x} 
                        y={chartHeight - 8} 
                        fill="#3f3f46" 
                        fontSize="8" 
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {points[points.length - 1].data.formattedDate}
                      </text>
                    </>
                  )}
                </svg>

                {/* Floating Glassmorphic Micro Tooltip */}
                {hoveredPoint && (
                  <div 
                    className="absolute bg-zinc-950/85 border border-zinc-800/60 px-3.5 py-2.5 rounded-xl text-left shadow-[0_12px_24px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md z-50 pointer-events-none animate-fade-in text-[10px] space-y-0.5"
                    style={{
                      left: `${((hoveredPoint.x - paddingLeft) / (chartWidth - paddingLeft - paddingRight)) * 100}%`,
                      transform: "translate(-50%, -100%)",
                      top: `${hoveredPoint.y - 12}px`
                    }}
                  >
                    <p className="font-black text-zinc-500 tracking-wider uppercase text-[8px]">{new Date(hoveredPoint.data.date + "T00:00:00").toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}</p>
                    <div className="font-black text-white font-mono text-[11px]">
                      {chartMetric === "count" 
                        ? `${hoveredPoint.val} ventas`
                        : `$${hoveredPoint.val.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Double-Column Section: Real Live Recent Vouchers Table (Replacements for placeholders) */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-start">
            
            {/* Recent Vouchers List (Real operational data) */}
            <div className="lg:col-span-8 rounded-2xl border border-zinc-900 bg-zinc-950/15 p-5 space-y-4 backdrop-blur-xl">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white">Últimos Comprobantes Emitidos</h4>
                  <p className="text-[10px] text-zinc-550">Registro en caliente de las 5 operaciones más recientes en el canal.</p>
                </div>
                <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider bg-green-500/10 border border-green-500/15 px-2 py-0.5 text-green-400 rounded">
                  En línea
                </span>
              </div>

              {loading ? (
                <div className="h-[180px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                </div>
              ) : recentVouchers.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-10">No se encontraron comprobantes recientes.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr className="text-zinc-500 font-bold uppercase tracking-wider text-[8px] border-b border-zinc-900 select-none pb-2">
                        <th className="py-2.5 pr-2">Comprobante</th>
                        <th className="py-2.5">Cliente</th>
                        <th className="py-2.5">Tipo</th>
                        <th className="py-2.5 text-right">Importe</th>
                        <th className="py-2.5 text-center">Estado AFIP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40">
                      {recentVouchers.map((v, idx) => {
                        const isAutorizado = v.status === "autorizado";
                        return (
                          <tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
                            <td className="py-2.5 pr-2 font-mono font-bold text-[11px] text-zinc-350">{v.id}</td>
                            <td className="py-2.5 text-white max-w-[140px] truncate">{v.client_name}</td>
                            <td className="py-2.5 text-zinc-500 text-[10px]">{v.type}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-zinc-350 text-[11px]">
                              ${v.total_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                                isAutorizado ? "bg-green-500/10 text-green-400 border border-green-500/15" : "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                              }`}>
                                {isAutorizado ? "Autorizado" : "Pendiente"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Action Export Card (Highly polished) */}
            <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-950/15 p-5 space-y-4 flex flex-col justify-between h-[278px]">
              <div className="space-y-2">
                <span className="inline-block rounded bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-500">
                  AFIP / Fiscal
                </span>
                <h4 className="text-base font-bold text-white tracking-tight">Libro de IVA Ventas Digital</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Exportación de libro analítico contable. Contiene base imponible e impuestos discriminados listos para importar.
                </p>
              </div>

              <button 
                onClick={handleDownloadIvaExcel}
                className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Descargar Excel
              </button>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 2: DETAILED CLIENT CREDIT BALANCES               */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="cuentas_corrientes" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-zinc-950 border border-zinc-900 p-3 rounded-xl">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550" />
              <input
                type="text"
                placeholder="Buscar cliente por nombre o CUIT..."
                value={ccSearch}
                onChange={(e) => setCcSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900/40 border border-zinc-850 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>
            
            <button 
              onClick={handleDownloadCuentasCorrientesExcel}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Saldos
            </button>
          </div>

          {loading ? (
            <div className="h-[150px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : filteredCcAccounts.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-900 rounded-xl space-y-2">
              <AlertCircle className="w-8 h-8 text-zinc-750 mx-auto" />
              <p className="text-xs font-semibold text-zinc-400">Sin cuentas corrientes coincidentes</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/10">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-500 font-bold uppercase tracking-wider text-[8px] border-b border-zinc-900 select-none">
                    <th className="p-3">Razón Social Cliente</th>
                    <th className="p-3">CUIT</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Habilitación CC</th>
                    <th className="p-3 text-right">Límite Crédito</th>
                    <th className="p-3 text-right">Saldo Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 font-medium">
                  {filteredCcAccounts.map((acc, idx) => {
                    const deudor = Number(acc.saldo_actual) > 0;
                    return (
                      <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="p-3 text-white font-semibold">{acc.customers?.razon_social || "Sin Nombre"}</td>
                        <td className="p-3 text-zinc-400 font-mono text-[11px]">{acc.customers?.cuit || "Sin CUIT"}</td>
                        <td className="p-3 text-zinc-400">{acc.customers?.phone || "—"}</td>
                        <td className="p-3">
                          <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                            acc.tiene_cuenta_corriente ? "bg-green-500/10 text-green-400 border border-green-500/15" : "bg-red-500/10 text-red-400 border border-red-500/15"
                          }`}>
                            {acc.tiene_cuenta_corriente ? "Habilitado" : "Bloqueado"}
                          </span>
                        </td>
                        <td className="p-3 text-right text-zinc-300 font-mono text-[11px]">
                          ${Number(acc.limite_credito).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right font-mono text-[11px] font-bold ${deudor ? "text-red-400" : "text-green-400"}`}>
                          ${Number(acc.saldo_actual).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 3: ANALYTICAL PARTS ROTATION RANKING             */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="ranking" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-zinc-950 border border-zinc-900 p-3 rounded-xl">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550" />
              <input
                type="text"
                placeholder="Filtrar repuesto por código o descripción..."
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900/40 border border-zinc-850 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>
            
            <button 
              onClick={handleDownloadRankingExcel}
              disabled={filteredRankingList.length === 0}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Descargar Ranking Excel
            </button>
          </div>

          {loading ? (
            <div className="h-[150px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : filteredRankingList.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-zinc-900 rounded-xl space-y-2">
              <AlertCircle className="w-8 h-8 text-zinc-750 mx-auto" />
              <p className="text-xs font-semibold text-zinc-400">Sin unidades vendidas</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/10">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-500 font-bold uppercase tracking-wider text-[8px] border-b border-zinc-900 select-none">
                    <th className="p-3 w-16 text-center">Puesto</th>
                    <th className="p-3 w-32">Código Fabricante</th>
                    <th className="p-3">Descripción Repuesto</th>
                    <th className="p-3 text-center w-24">Unidades</th>
                    <th className="p-3 text-right w-36">Total Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 font-medium">
                  {filteredRankingList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="p-3 font-black text-amber-500 font-mono text-center">
                        #{idx + 1}
                      </td>
                      <td className="p-3 text-white font-semibold font-mono text-[11px]">{item.codigo}</td>
                      <td className="p-3 text-zinc-400">{item.descripcion}</td>
                      <td className="p-3 text-center font-bold text-white font-mono bg-zinc-900/10">
                        {item.cantidad}
                      </td>
                      <td className="p-3 text-right text-zinc-300 font-mono text-[11px]">
                        ${Number(item.totalNeto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
