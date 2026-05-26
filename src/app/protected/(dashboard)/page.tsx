import Link from "next/link";
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Coins,
  ArrowUpRight,
  Sparkles,
  Building,
  CreditCard,
  History,
} from "lucide-react";
import { getCurrentUserDetails, getCurrentViewer } from "@/core/auth/auth-state";
import { getActiveCuitCookie } from "@/core/company/company-cookies";
import { fetchCompaniesAction } from "@/core/company/company-actions";
import { createSupabaseServerClient } from "@/core/api/supabase";

interface DashboardVoucher {
  total_amount: string | number;
  created_at: string;
}

interface DashboardArticle {
  stock_actual: number | null;
  stock_minimo: number | null;
}

export default async function DashboardPage() {
  const user = await getCurrentUserDetails();
  const viewer = await getCurrentViewer();
  const activeCuit = await getActiveCuitCookie();
  const companiesRes = await fetchCompaniesAction();
  const companies = companiesRes.success ? companiesRes.data : [];
  const activeCompany = companies.find((c) => c.cuit === activeCuit);

  const supabase = createSupabaseServerClient();

  // Consultas asíncronas concurrentes para obtener estadísticas en tiempo real
  const [vouchersRes, articlesRes, cajaRes] = await Promise.all([
    supabase.database
      .from("arca_vouchers")
      .select("total_amount, created_at")
      .eq("company_cuit", activeCuit ?? ""),
    supabase.database
      .from("articulo")
      .select("stock_actual, stock_minimo"),
    supabase.database
      .from("caja_sesion")
      .select("*")
      .eq("cuit", activeCuit ?? "")
      .eq("estado", "abierta")
      .maybeSingle(),
  ]);

  const vouchers = (vouchersRes.data as DashboardVoucher[]) || [];
  const articles = (articlesRes.data as DashboardArticle[]) || [];
  const cajaSesion = cajaRes.data;

  // 1. Facturación (Mes Actual) e historial
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();

  let currentMonthInvoiced = 0;
  let prevMonthInvoiced = 0;

  for (const v of vouchers) {
    const vDate = new Date(v.created_at);
    const isCurrentMonth = vDate.getFullYear() === currentYear && vDate.getMonth() === currentMonth;
    const isPrevMonth = vDate.getFullYear() === prevYear && vDate.getMonth() === prevMonth;
    const amount = typeof v.total_amount === "number" ? v.total_amount : parseFloat(String(v.total_amount)) || 0;

    if (isCurrentMonth) {
      currentMonthInvoiced += amount;
    } else if (isPrevMonth) {
      prevMonthInvoiced += amount;
    }
  }

  let changeText = "+0.0% vs mes anterior";
  if (prevMonthInvoiced > 0) {
    const percent = ((currentMonthInvoiced - prevMonthInvoiced) / prevMonthInvoiced) * 100;
    changeText = `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}% vs mes anterior`;
  } else if (currentMonthInvoiced > 0) {
    changeText = "+100.0% vs mes anterior";
  }

  const facturacionMesActual = `$${currentMonthInvoiced.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // 2. Ventas Registradas
  const totalTransactions = vouchers.length;
  const todayString = now.toDateString();
  const todayOps = vouchers.filter((v) => new Date(v.created_at).toDateString() === todayString).length;

  const ventasRegistradas = `${totalTransactions} ${totalTransactions === 1 ? "transacción" : "transacciones"}`;
  const ventasHoyText = `Hoy: ${todayOps} ${todayOps === 1 ? "operación" : "operaciones"}`;

  // 3. Items en Catálogo
  const totalArticles = articles.length;
  const lowStockArticles = articles.filter(
    (a) => (a.stock_actual ?? 0) <= (a.stock_minimo ?? 0)
  ).length;

  const itemsCatalogo = `${totalArticles} ${totalArticles === 1 ? "repuesto" : "repuestos"}`;
  const bajoStockText = `${lowStockArticles} bajo stock mínimo`;

  // 4. Caja Diaria Abierta
  const cajaMontoVal = typeof cajaSesion?.monto_teorico === "number"
    ? cajaSesion.monto_teorico
    : parseFloat(String(cajaSesion?.monto_teorico || 0)) || 0;

  const montoCaja = cajaSesion
    ? `$${cajaMontoVal.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "$0.00";
  const cajaEstadoText = cajaSesion ? (cajaSesion.notas || "Turno Abierto") : "Caja Cerrada";

  const stats = [
    {
      name: "Facturación (Mes Actual)",
      value: facturacionMesActual,
      change: changeText,
      icon: TrendingUp,
      color: "from-emerald-500/20 to-teal-500/10",
      textColor: "text-emerald-400",
    },
    {
      name: "Ventas Registradas",
      value: ventasRegistradas,
      change: ventasHoyText,
      icon: ShoppingCart,
      color: "from-amber-500/20 to-yellow-500/10",
      textColor: "text-amber-400",
    },
    {
      name: "Items en Catálogo",
      value: itemsCatalogo,
      change: bajoStockText,
      icon: Package,
      color: "from-blue-500/20 to-indigo-500/10",
      textColor: "text-blue-400",
    },
    {
      name: "Caja Diaria Abierta",
      value: montoCaja,
      change: cajaEstadoText,
      icon: Coins,
      color: "from-purple-500/20 to-pink-500/10",
      textColor: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
              <Sparkles className="w-3.5 h-3.5" /> Entorno Multi-Empresa Listo
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              ¡Bienvenido al ERP, <span className="text-amber-300 font-medium">{user?.email || viewer.email}</span>!
            </h1>
            <p className="text-zinc-400 max-w-2xl text-sm sm:text-base">
              Estás operando bajo el CUIT <span className="text-white font-mono font-semibold">{activeCuit}</span> de{" "}
              <span className="text-amber-300 font-semibold">{activeCompany?.nombre_fantasia || activeCompany?.razon_social}</span>. 
              Toda la facturación electrónica AFIP de esta sesión se vinculará a esta firma.
            </p>
          </div>

          <div className="flex gap-3 shrink-0">
            <Link
              href="/protected/configuracion"
              className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-xs font-bold transition-all text-zinc-300"
            >
              Configurar AFIP
            </Link>
            <Link
              href="/protected/ventas"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <span>Nueva Factura/Venta</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${stat.textColor === "text-amber-400" ? "from-amber-500 to-amber-600" : stat.textColor === "text-emerald-400" ? "from-emerald-500 to-teal-500" : stat.textColor === "text-blue-400" ? "from-blue-500 to-indigo-500" : "from-purple-500 to-pink-500"}`} />
            
            <div className="flex justify-between items-start pl-3">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {stat.name}
                </p>
                <p className="text-2xl font-extrabold text-white tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs text-zinc-400">
                  {stat.change}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} border border-zinc-800 ${stat.textColor}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Panels Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Quick Actions Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Accesos Directos</h2>
            <p className="text-xs text-zinc-400">Tareas operativas comunes del comercio</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Facturar Venta Mostrador",
                desc: "Emisión de tickets consumidor final y cuenta corriente.",
                href: "/protected/ventas",
                icon: ShoppingCart,
              },
              {
                title: "Carga de Stock Rápida",
                desc: "Ingreso de repuestos y actualización de costos/precios.",
                href: "/protected/inventario",
                icon: Package,
              },
              {
                title: "Arqueo de Caja y Gastos",
                desc: "Cierre diario, retiros de efectivo y egresos registrados.",
                href: "/protected/caja",
                icon: Coins,
              },
              {
                title: "Reportes de IVA Ventas",
                desc: "Descarga de archivos para contadora y balances.",
                href: "/protected/reportes",
                icon: TrendingUp,
              },
            ].map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group p-4 rounded-xl border border-zinc-800 hover:border-amber-500/50 bg-zinc-900/50 hover:bg-zinc-800/40 transition-all flex items-start gap-3 text-left"
              >
                <div className="p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/20 transition-all">
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal">
                    {action.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Company Settings Context & Quick Info */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Perfil Activo</h2>
            <p className="text-xs text-zinc-400">Detalles registrales AFIP</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
              <Building className="w-10 h-10 text-amber-400 p-2 bg-amber-500/10 rounded-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Razón Social</p>
                <p className="text-sm font-bold text-white truncate">{activeCompany?.razon_social}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
              <CreditCard className="w-10 h-10 text-blue-400 p-2 bg-blue-500/10 rounded-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Condición IVA</p>
                <p className="text-sm font-bold text-white truncate">{activeCompany?.condicion_iva}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-800">
              <History className="w-10 h-10 text-purple-400 p-2 bg-purple-500/10 rounded-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Punto de Venta</p>
                <p className="text-sm font-bold text-white truncate">
                  P.V. N° {activeCompany?.punto_venta ?? "0001"} ({activeCompany?.afip_mode === "produccion" ? "AFIP Producción" : "Simulado"})
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
