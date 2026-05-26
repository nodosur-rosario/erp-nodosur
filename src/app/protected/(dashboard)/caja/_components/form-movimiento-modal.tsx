"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { addManualMovimiento } from "@/features/caja/caja-actions";
import { useCajaStore } from "@/features/caja/caja-store";
import type { CajaMovimiento } from "@/features/caja/caja-store";

interface FormMovimientoModalProps {
  sesionId: string;
  onClose: () => void;
}

const CUENTAS_CONTRAPARTE = [
  { code: "5.1.1.05", label: "Gastos Generales / Librería / Varios" },
  { code: "5.1.1.02", label: "Fletes, Envíos y Logística" },
  { code: "2.1.1.01", label: "Proveedores Comerciales" },
  { code: "4.1.1.01", label: "Ventas de Repuestos / Autopartes" },
  { code: "1.1.1.02", label: "Banco Cta. Cte. / Depósito" },
];

export function FormMovimientoModal({ sesionId, onClose }: FormMovimientoModalProps) {
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [cuentaContraparte, setCuentaContraparte] = useState("5.1.1.05");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addMov = useCajaStore((s) => s.addMovimiento);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorMonto = parseFloat(monto);

    if (isNaN(valorMonto) || valorMonto <= 0) {
      setErrorMsg("El monto debe ser un número positivo mayor a 0.");
      return;
    }
    if (!concepto.trim()) {
      setErrorMsg("Ingresá un concepto válido.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await addManualMovimiento(sesionId, tipo, valorMonto, concepto, cuentaContraparte);

    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.data) {
      const nuevoMov: CajaMovimiento = {
        id: res.data.movimiento_id || crypto.randomUUID(),
        sesion_id: sesionId,
        tipo,
        monto: valorMonto,
        concepto,
        fecha: new Date().toISOString(),
        accounting_transaction_id: res.data.transaction_id ?? null,
      };
      addMov(nuevoMov);
      onClose();
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900 w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-100">
            Registrar Movimiento Manual
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none transition-colors">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tipo selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipo("egreso")}
                className={`py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                  tipo === "egreso"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" /> Egreso
              </button>
              <button
                type="button"
                onClick={() => setTipo("ingreso")}
                className={`py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                  tipo === "ingreso"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Ingreso
              </button>
            </div>
          </div>

          {/* Monto & Concepto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Importe ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 text-sm font-mono tabular-nums transition-colors"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Concepto / Motivo
              </label>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Pago de flete urgente"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
                required
              />
            </div>
          </div>

          {/* Cuenta Contraparte */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Cuenta Contable de Contraparte
            </label>
            <select
              value={cuentaContraparte}
              onChange={(e) => setCuentaContraparte(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/50 text-sm transition-colors cursor-pointer"
            >
              {CUENTAS_CONTRAPARTE.map((c) => (
                <option key={c.code} value={c.code}>
                  [{c.code}] {c.label}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3">
              {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10"
            >
              {isSubmitting ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                "Registrar Asiento"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
