"use client";

import { useState } from "react";
import { Plus, ArrowDownRight } from "lucide-react";
import { MetricasTarjetas } from "./metricas-tarjetas";
import { FormMovimientoModal } from "./form-movimiento-modal";
import { FormCierreModal } from "./form-cierre-modal";
import type { CajaSession, CajaMovimiento } from "@/features/caja/caja-store";
import { useSecretStore } from "@/features/sales/store/use-secret-store";

interface CajaAbiertaViewProps {
  session: CajaSession;
  movimientos: CajaMovimiento[];
}

export function CajaAbiertaView({ session, movimientos }: CajaAbiertaViewProps) {
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTipo, setFilterTipo] = useState<"todos" | "ingreso" | "egreso">("todos");

  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);

  const movimientosVisibles = movimientos.filter((m) => {
    if (!showCajaNegra && m.canal === "interno") return false;
    return true;
  });

  const movimientosFiltrados = movimientosVisibles.filter((m) => {
    const matchSearch =
      m.concepto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.accounting_transaction_id && m.accounting_transaction_id.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchTipo = filterTipo === "todos" || m.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const montoInicial = Number(session.monto_inicial);
  const totalIngresos = movimientosVisibles
    .filter((m) => m.tipo === "ingreso")
    .reduce((sum, m) => sum + Number(m.monto), 0);
  const totalEgresos = movimientosVisibles
    .filter((m) => m.tipo === "egreso")
    .reduce((sum, m) => sum + Number(m.monto), 0);
  const currentMontoTeorico = montoInicial + totalIngresos - totalEgresos;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Caja Diaria</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">
            Abierta el{" "}
            {new Date(session.fecha_apertura).toLocaleDateString("es-AR")} a las{" "}
            {new Date(session.fecha_apertura).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0 self-start">
          <button
            onClick={() => setShowMovimientoModal(true)}
            className="px-4 py-2.5 rounded-xl border border-zinc-850 hover:bg-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-300 transition-all flex items-center gap-1.5"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
          <button
            onClick={() => setShowCierreModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Cerrar Caja y Arqueo</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <MetricasTarjetas session={session} movimientos={movimientosVisibles} />

      {/* Movements table */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden backdrop-blur-xl">
        {/* Filters header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800/60 px-6 py-4 gap-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Historial de Movimientos
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por concepto o TX..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 w-full md:w-64 transition-colors"
            />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as "todos" | "ingreso" | "egreso")}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-[10px] uppercase font-bold text-zinc-500 px-6 py-3.5 tracking-wider">Hora</th>
                <th className="text-[10px] uppercase font-bold text-zinc-500 px-6 py-3.5 tracking-wider">Concepto</th>
                <th className="text-[10px] uppercase font-bold text-zinc-500 px-6 py-3.5 tracking-wider font-mono">TX Contable</th>
                <th className="text-[10px] uppercase font-bold text-zinc-500 px-6 py-3.5 tracking-wider text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-xs text-zinc-500 py-12">
                    No hay movimientos registrados en esta sesión.
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="text-xs text-zinc-400 px-6 py-4 font-mono tabular-nums">
                      {new Date(m.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs
                    </td>
                    <td className="text-xs text-zinc-200 px-6 py-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        {m.canal === "interno" && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 animate-pulse" 
                            title="Caja Negra (Canal Interno)" 
                          />
                        )}
                        <span>{m.concepto}</span>
                      </div>
                    </td>
                    <td className="text-xs text-zinc-500 px-6 py-4 font-mono">{m.accounting_transaction_id || "—"}</td>
                    <td
                      className={`text-xs px-6 py-4 font-mono font-bold text-right tabular-nums ${
                        m.tipo === "ingreso" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "+" : "-"}$
                      {Number(m.monto).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showMovimientoModal && (
        <FormMovimientoModal sesionId={session.id} onClose={() => setShowMovimientoModal(false)} />
      )}
      {showCierreModal && (
        <FormCierreModal sesionId={session.id} montoTeorico={currentMontoTeorico} onClose={() => setShowCierreModal(false)} />
      )}
    </div>
  );
}
