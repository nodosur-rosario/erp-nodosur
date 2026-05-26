"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown, Check, AlertCircle } from "lucide-react";
import { useDateRangeStore, QuickSelectOption } from "../store/date-range-store";

export function DateRangeSelector() {
  const { startDate, endDate, quickSelect, setQuickSelect, setCustomRange } = useDateRangeStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local inputs state for custom range selection
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync store date changes back to local inputs
  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate]);

  // Click outside to close dropdown ref handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setErrorMsg(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickSelect = (option: QuickSelectOption) => {
    if (option === "personalizado") {
      setQuickSelect("personalizado");
      return;
    }
    setQuickSelect(option);
    setErrorMsg(null);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    // Basic format validation: DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!dateRegex.test(localStart) || !dateRegex.test(localEnd)) {
      setErrorMsg("Formato inválido. Use dia/mes/año (DD/MM/YYYY)");
      return;
    }

    // Date range consistency validation
    const parseDate = (str: string) => {
      const parts = str.split("/");
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    };

    const dStart = parseDate(localStart);
    const dEnd = parseDate(localEnd);

    if (dStart > dEnd) {
      setErrorMsg("La fecha de inicio no puede ser posterior al fin.");
      return;
    }

    setErrorMsg(null);
    setCustomRange(localStart, localEnd);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button: Glassmorphic Dark Obsidian */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all text-xs font-bold text-zinc-300"
      >
        <Calendar className="w-3.5 h-3.5 text-amber-400" />
        <span>{startDate} - {endDate}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Panel: Premium Solid Obsidian Card (Zero Bleed) */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-72 rounded-2xl bg-[#0f0f13] border border-zinc-800 p-4 shadow-2xl shadow-black/80 animate-fade-in z-[150] space-y-4">
          <div className="flex flex-col space-y-1 text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
              Período de Búsqueda
            </span>
            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
              Filtro persistente para facturas, contabilidad y reportes (GMT-3).
            </p>
          </div>

          {/* Quick Option Grid */}
          <div className="grid grid-cols-1 gap-2">
            {[
              { key: "este-mes", label: "Este mes" },
              { key: "mes-anterior", label: "Mes anterior" },
              { key: "ultimos-3-meses", label: "Últimos 3 meses" },
            ].map((option) => {
              const active = quickSelect === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => handleQuickSelect(option.key as QuickSelectOption)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all border ${
                    active
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-md shadow-amber-500/[0.02]"
                      : "bg-zinc-900/30 text-zinc-400 border-zinc-850 hover:bg-zinc-900/70 hover:text-zinc-200"
                  }`}
                >
                  <span>{option.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-zinc-800/80 my-2" />

          {/* Custom Date Form (DD/MM/YYYY) */}
          <div className="space-y-3">
            <button
              onClick={() => handleQuickSelect("personalizado")}
              className={`w-full text-left text-[10px] font-black uppercase tracking-wider transition-colors ${
                quickSelect === "personalizado" ? "text-amber-400" : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              Rango Personalizado:
            </button>

            {quickSelect === "personalizado" && (
              <div className="flex flex-col gap-4 animate-slide-in">
                <div className="grid grid-cols-2 gap-2.5 text-left">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Desde</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={localStart}
                      onChange={(e) => setLocalStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Hasta</label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={localEnd}
                      onChange={(e) => setLocalEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2 items-center text-left text-[10px] text-red-400 font-semibold leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleApplyCustom}
                  className="w-full mt-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 font-black text-xs transition shadow-lg shadow-amber-500/10"
                >
                  Aplicar Rango
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
