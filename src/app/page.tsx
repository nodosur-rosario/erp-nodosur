import Link from "next/link";
import { getCurrentViewer } from "@/core/auth/auth-state";
import { SiteShell } from "@/core/components/layout/site-shell";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { 
  Truck, 
  Boxes, 
  FileSpreadsheet, 
  ShieldCheck, 
  TrendingUp, 
  ArrowRight, 
  Building2, 
  Sparkles,
  MapPin,
  ClipboardList
} from "lucide-react";

export default async function Home() {
  const viewer = await getCurrentViewer();

  return (
    <SiteShell>
      {/* Top Navbar */}
      <header className="border-b border-[var(--border)] bg-[#09090b] px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-extrabold tracking-tight text-lg text-[var(--foreground)]">
                  NODO SUR
                </span>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/20">
                  ERP Logística
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                Sistema de Gestión Comercial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {viewer.isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Operador: <strong className="text-[var(--foreground)] font-semibold">{viewer.name || viewer.email}</strong></span>
                </div>
                <Link
                  href="/protected"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-amber-600 px-4 text-xs font-medium text-white transition-all hover:bg-amber-500 active:scale-[0.98]"
                >
                  Ingresar al Panel
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
                <div className="border-l border-[var(--border)] pl-4">
                  <LogoutButton />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/sign-in"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--foreground)] bg-[var(--foreground)] px-4 text-xs font-medium text-[var(--surface)] transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 bg-[#09090b] py-16 px-6 relative overflow-hidden">
        {/* Subtle Ambient Light Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.02),transparent_50%)] pointer-events-none" />
        
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Left Hero Column */}
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-500 shadow-sm">
                <Sparkles className="h-3 w-3" />
                <span>Distribución & Logística de Alto Rendimiento</span>
              </div>
              
              <h1 className="font-sans text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.05]">
                Control Industrial de Extremo a Extremo.
              </h1>
              
              <p className="text-base text-[var(--muted-foreground)] max-w-xl leading-relaxed">
                Diseñado para optimizar la cadena de distribución de repuestos, autopartes e insumos. 
                Trazabilidad total de despachos, control de stock de alta densidad, arqueos de caja en tiempo real y facturación AFIP integrada.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href={viewer.isAuthenticated ? "/protected" : "/auth/sign-in"}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-amber-600 px-6 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 hover:shadow-amber-500/10 active:scale-[0.98]"
                >
                  Ingresar al ERP
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="https://github.com"
                  target="_blank"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                >
                  Documentación Interna
                </Link>
              </div>

              {/* Bullet Features */}
              <div className="grid gap-4 sm:grid-cols-3 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-amber-500">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">AFIP WSFE v1</h4>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Facturación en Lote A y B</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-amber-500">
                    <Truck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Despachos</h4>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Hojas de Ruta Digitales</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-amber-500">
                    <Boxes className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Stock Crítico</h4>
                    <p className="text-[10px] text-[var(--muted-foreground)]">Reposición Inteligente</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Dashboard Mockup Column */}
            <div className="lg:col-span-5">
              <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl shadow-black/80 before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-white/[0.02] before:to-transparent before:pointer-events-none">
                <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                    <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
                  </div>
                  <span className="text-[10px] font-mono tracking-wider text-[var(--muted-foreground)] uppercase">
                    Consola de Monitoreo - Nodo Sur
                  </span>
                </div>

                {/* Simulated High Density Data Visuals */}
                <div className="space-y-4">
                  {/* Widget 1: Fleet/Logistics Status */}
                  <div className="rounded-lg border border-[var(--border)] bg-[#09090b] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Flota en Ruta</span>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500 uppercase">
                        2 Activos
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] font-mono text-[var(--muted-foreground)]">
                      <div className="flex justify-between border-b border-[var(--border)]/30 pb-1">
                        <span>Hoja Ruta #829 - Chofer: Gómez</span>
                        <span className="text-[var(--foreground)]">Entrega 8/12</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hoja Ruta #830 - Chofer: Altieri</span>
                        <span className="text-amber-500">En Tránsito</span>
                      </div>
                    </div>
                  </div>

                  {/* Widget 2: Inventory Capacity */}
                  <div className="rounded-lg border border-[var(--border)] bg-[#09090b] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">Capacidad Depósito</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--foreground)] tabular-nums">78.4%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" style={{ width: "78.4%" }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-amber-500/90 bg-amber-500/5 border border-amber-500/10 rounded px-2 py-1">
                      <span>⚠️ Alerta de Quiebre de Stock</span>
                      <span className="font-bold">12 Items</span>
                    </div>
                  </div>

                  {/* Widget 3: AFIP & CUIT selection */}
                  <div className="rounded-lg border border-[var(--border)] bg-[#09090b] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">CUIT Inquilinos Activos</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">Multiempresa</span>
                    </div>
                    <div className="space-y-1.5 text-[11px] font-mono text-[var(--muted-foreground)]">
                      <div className="flex justify-between items-center border-b border-[var(--border)]/30 pb-1">
                        <span>Distribuidora Norte SRL</span>
                        <span className="text-emerald-500 text-[10px]">✔ Cert. AFIP</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Repuestos Patagónicos SA</span>
                        <span className="text-emerald-500 text-[10px]">✔ Cert. AFIP</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Core Modules Grid */}
          <section className="mt-24 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Módulos Industriales Integrados</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Todo lo que tu distribuidora necesita para digitalizar operaciones y consolidar el control.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* Module 1 */}
              <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:border-amber-500/20 hover:bg-[var(--surface-muted)]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white uppercase tracking-wider">Logística y Despacho</h3>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Planificá hojas de ruta, asigná choferes a vehículos, controlá bultos por cliente y registrá el estado de entrega en tiempo real.
                </p>
              </div>

              {/* Module 2 */}
              <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:border-amber-500/20 hover:bg-[var(--surface-muted)]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                  <Boxes className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white uppercase tracking-wider">Stock y Depósitos</h3>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Inventario de repuestos con búsquedas instantáneas, códigos de barra, trazabilidad de ubicaciones y notificaciones de reposición.
                </p>
              </div>

              {/* Module 3 */}
              <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:border-amber-500/20 hover:bg-[var(--surface-muted)]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white uppercase tracking-wider">Facturación AFIP</h3>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Emisión electrónica de Facturas A y B con soporte multi-CUIT. Simulación exacta del flujo de comunicación AFIP.
                </p>
              </div>

              {/* Module 4 */}
              <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-300 hover:border-amber-500/20 hover:bg-[var(--surface-muted)]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white uppercase tracking-wider">Caja y Arqueo Diario</h3>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Rendición automática de cobranzas de transportistas, saldos de preventa, registro de egresos y reportes financieros directos.
                </p>
              </div>

            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[#09090b] px-6 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 sm:flex-row text-xs text-[var(--muted-foreground)] font-medium">
          <p>© 2026 ERP Nodo Sur. Todos los derechos reservados. Control y Trazabilidad en Distribución.</p>
          <div className="flex gap-6">
            <span className="hover:text-[var(--foreground)] transition-colors cursor-pointer">Soporte Técnico</span>
            <span className="hover:text-[var(--foreground)] transition-colors cursor-pointer">Políticas de Seguridad</span>
            <span className="hover:text-[var(--foreground)] transition-colors cursor-pointer">Términos del Servicio</span>
          </div>
        </div>
      </footer>
    </SiteShell>
  );
}

