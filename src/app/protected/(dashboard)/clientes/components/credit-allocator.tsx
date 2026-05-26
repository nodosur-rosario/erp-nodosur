"use client";

import React, { useEffect, useState } from "react";
import { 
  Coins, 
  X, 
  Loader2, 
  AlertCircle, 
  Check, 
  HelpCircle, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { 
  getUnallocatedMovements, 
  createCreditAllocation, 
  AllocatedMovementRow 
} from "@/features/customers/services/credit-allocation-service";

interface Customer {
  id: string;
  cuit: string;
  razon_social: string;
}

interface CreditAccount {
  id: string;
  saldo_actual: number;
}

interface CreditAllocatorProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  creditAccount: CreditAccount;
  companyCuit: string;
  onSuccess: () => void;
}

export default function CreditAllocator({
  isOpen,
  onClose,
  customer,
  creditAccount,
  companyCuit,
  onSuccess,
}: CreditAllocatorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Lists from backend
  const [debits, setDebits] = useState<AllocatedMovementRow[]>([]);
  const [credits, setCredits] = useState<AllocatedMovementRow[]>([]);
  
  // Selected credit movement to distribute
  const [selectedCredit, setSelectedCredit] = useState<AllocatedMovementRow | null>(null);
  
  // Allocations mapping: debitMovementId -> input value string
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  // Fetch unallocated movements
  const loadData = async () => {
    if (!creditAccount?.id) return;
    setLoading(true);
    try {
      const res = await getUnallocatedMovements(creditAccount.id, companyCuit);
      if (res.error) {
        toast.error(res.error);
      } else {
        // Only show debits and credits that have remaining balances to allocate
        setDebits((res.debits || []).filter(d => d.remaining_amount > 0));
        
        const availableCredits = (res.credits || []).filter(c => c.remaining_amount > 0);
        setCredits(availableCredits);
        
        // Auto-select first credit movement if available
        if (availableCredits.length > 0) {
          setSelectedCredit(availableCredits[0]);
        } else {
          setSelectedCredit(null);
        }
      }
    } catch (err) {
      console.error("Error loading unallocated movements:", err);
      toast.error("Error al obtener los movimientos pendientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setAllocations({});
    }
  }, [isOpen, creditAccount?.id]);

  // Reset inputs when selected credit changes
  useEffect(() => {
    setAllocations({});
  }, [selectedCredit]);

  if (!isOpen) return null;

  // Math computations
  const totalCreditAvailable = selectedCredit ? selectedCredit.remaining_amount : 0;
  
  const totalAllocated = Object.entries(allocations).reduce((sum, [_, val]) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const remainingToDistribute = parseFloat((totalCreditAvailable - totalAllocated).toFixed(2));

  // Handler for allocating specifically
  const handleInputChange = (debitId: string, value: string, maxAllowed: number) => {
    // Sanitization: Allow empty, float, or positive numbers
    if (value === "") {
      setAllocations(prev => {
        const next = { ...prev };
        delete next[debitId];
        return next;
      });
      return;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;

    // Check against individual debit remaining limit
    if (parsed > maxAllowed) {
      toast.warning(`El monto supera la deuda de la factura ($${maxAllowed.toFixed(2)})`);
      return;
    }

    // Check against total selected credit available limit
    const currentAllocationsWithoutThis = Object.entries(allocations)
      .filter(([id]) => id !== debitId)
      .reduce((sum, [_, v]) => sum + (parseFloat(v) || 0), 0);

    if (currentAllocationsWithoutThis + parsed > totalCreditAvailable) {
      toast.warning(`El monto supera el saldo disponible del cobro ($${totalCreditAvailable.toFixed(2)})`);
      return;
    }

    setAllocations(prev => ({
      ...prev,
      [debitId]: value
    }));
  };

  const handleSave = async () => {
    if (!selectedCredit) {
      toast.warning("Seleccione un saldo a favor para distribuir.");
      return;
    }

    const itemsToSave = Object.entries(allocations)
      .map(([debitId, val]) => ({
        debitId,
        amount: parseFloat(val)
      }))
      .filter(item => !isNaN(item.amount) && item.amount > 0);

    if (itemsToSave.length === 0) {
      toast.warning("Ingrese al menos un monto de imputación mayor a cero.");
      return;
    }

    setSaving(true);
    let successCount = 0;
    let failedCount = 0;
    let lastError = "";

    try {
      // Execute sequentially for transactional safety and user feedback
      for (const item of itemsToSave) {
        const res = await createCreditAllocation(
          companyCuit,
          item.debitId,
          selectedCredit.id,
          item.amount
        );

        if (res.success) {
          successCount++;
        } else {
          failedCount++;
          lastError = res.error || "Error desconocido";
        }
      }

      if (successCount > 0) {
        toast.success(`Se aplicaron ${successCount} imputaciones con éxito.`);
        onSuccess();
        if (failedCount === 0) {
          onClose();
        } else {
          // Refresh list if some succeeded but others failed
          loadData();
          setAllocations({});
        }
      }

      if (failedCount > 0) {
        toast.error(`Fallaron ${failedCount} imputaciones. Error: ${lastError}`);
      }

    } catch (err: any) {
      console.error("Error in handleSave allocations:", err);
      toast.error(err.message || "Fallo en la comunicación con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in no-print">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Imputador de Créditos y Cobranzas
              </h3>
              <p className="text-[10px] text-zinc-400">
                Conciliación y saldo específico de Cuenta Corriente para <span className="text-white font-bold">{customer.razon_social}</span> (CUIT: {customer.cuit})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {loading ? (
          <div className="flex-1 py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-500 text-xs">Cargando facturas y saldos del cliente...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-[50vh]">
            
            {/* Left Column: Credit Selection */}
            <div className="w-full md:w-5/12 flex flex-col space-y-4 border-b md:border-b-0 md:border-r border-zinc-850 pb-4 md:pb-0 md:pr-6 overflow-y-auto">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. Seleccionar Saldo a Favor</span>
                </h4>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Elegí el cobro registrado o nota de crédito que querés imputar a facturas deudoras.
                </p>
              </div>

              {credits.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-zinc-850 rounded-xl text-center">
                  <AlertCircle className="w-8 h-8 text-zinc-700 mb-2" />
                  <h5 className="text-xs font-bold text-white mb-1">Sin saldos a favor</h5>
                  <p className="text-[9px] text-zinc-500 max-w-[200px] leading-relaxed">
                    Este cliente no posee recibos de cobro ni créditos con saldos libres disponibles para asignar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {credits.map((c) => {
                    const isSelected = selectedCredit?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCredit(c)}
                        className={`p-3.5 rounded-xl border cursor-pointer text-xs transition-all relative overflow-hidden group ${
                          isSelected
                            ? "bg-emerald-500/5 border-emerald-500/30 text-white"
                            : "bg-zinc-900/40 border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:text-white"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <p className="font-bold tracking-tight text-[11px] leading-normal">
                            {c.description}
                          </p>
                          <span className="font-mono font-black text-emerald-400">
                            ${c.remaining_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-zinc-500">
                          <span className="font-mono">
                            Original: ${c.amount.toLocaleString("es-AR")}
                          </span>
                          <span className="font-mono">
                            {new Date(c.created_at).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute right-0 top-0 w-1.5 h-full bg-emerald-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Debits Allocation */}
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span>2. Asignar a Facturas Deudoras</span>
                </h4>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Ingresá los montos específicos a pagar para cada comprobante adeudado.
                </p>
              </div>

              {!selectedCredit ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-850 rounded-xl text-center">
                  <HelpCircle className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-[10px] text-zinc-500 max-w-[200px]">
                    Seleccioná un saldo a favor en la columna izquierda para habilitar la distribución.
                  </p>
                </div>
              ) : debits.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-850 rounded-xl text-center">
                  <Check className="w-8 h-8 text-emerald-400 mb-2" />
                  <h5 className="text-xs font-bold text-white mb-1">Sin facturas adeudadas</h5>
                  <p className="text-[9px] text-zinc-500 max-w-[200px] leading-relaxed">
                    ¡Excelente! El cliente no tiene movimientos de débito pendientes de cobro en esta empresa.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                  {/* Allocation summary widget */}
                  <div className="p-3.5 rounded-xl border border-zinc-850 bg-zinc-950/60 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 block">Cobro Disponible</span>
                      <span className="font-black text-white">${totalCreditAvailable.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-650" />
                    <div className="space-y-1 text-center">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 block">A Imputar (Suma)</span>
                      <span className="font-black text-amber-400">${totalAllocated.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-650" />
                    <div className="space-y-1 text-right">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 block">Sobrante Libre</span>
                      <span className={`font-black ${remainingToDistribute > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                        ${remainingToDistribute.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Debits List scrollable */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                    {debits.map((d) => {
                      const value = allocations[d.id] || "";
                      return (
                        <div
                          key={d.id}
                          className="p-3 rounded-xl bg-zinc-900/20 border border-zinc-850 flex items-center justify-between gap-4 hover:border-zinc-800 transition"
                        >
                          <div className="space-y-1 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-[11px]">{d.description}</span>
                              <span className="text-[8px] font-mono rounded bg-zinc-800 px-1 py-0.5 text-zinc-500 uppercase">Debito</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                              <span>Total: ${d.amount.toLocaleString("es-AR")}</span>
                              <span>•</span>
                              <span>Deuda Remanente: <span className="font-bold text-red-400 font-mono">${d.remaining_amount.toLocaleString("es-AR")}</span></span>
                            </div>
                          </div>

                          {/* Allocation input */}
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 font-mono text-[10px]">$</span>
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => handleInputChange(d.id, e.target.value, d.remaining_amount)}
                              placeholder="0.00"
                              className="w-28 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-right text-xs text-white placeholder-zinc-850 focus:outline-none focus:border-amber-500/40 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const maxToSet = Math.min(d.remaining_amount, remainingToDistribute + (parseFloat(value) || 0));
                                handleInputChange(d.id, String(maxToSet), d.remaining_amount);
                              }}
                              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-[9px] font-bold text-amber-400 hover:text-amber-500 uppercase tracking-wider transition"
                              title="Asignar máximo posible"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-850">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-xs font-bold text-zinc-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedCredit || totalAllocated === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-xs font-black text-black transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:hover:scale-100 shadow-lg shadow-amber-500/10 hover:scale-[1.01] duration-150"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Confirmar Imputación</span>
          </button>
        </div>

      </div>
    </div>
  );
}
