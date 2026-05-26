"use client";

import React, { useState, useEffect } from "react";
import { useInventoryStore } from "@/features/inventory/store/use-inventory-store";
import { FitmentSelector, VehicleFitment } from "./fitment-selector";
import { getSupabaseClient } from "@/core/api/supabase";

interface AddPartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  articleId?: string | null; // If provided, we are in EDIT mode
}

export function AddPartDrawer({ isOpen, onClose, articleId }: AddPartDrawerProps) {
  const { brands, families, fetchArticles } = useInventoryStore();

  const [codigoFabricante, setCodigoFabricante] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [familiaId, setFamiliaId] = useState("");
  const [precioCosto, setPrecioCosto] = useState("0");
  const [precioMinorista, setPrecioMinorista] = useState("0");
  const [precioMayorista, setPrecioMayorista] = useState("0");
  const [stockActual, setStockActual] = useState("0");
  const [stockMinimo, setStockMinimo] = useState("5");
  const [ubicacionDeposito, setUbicacionDeposito] = useState("");

  const [selectedFitments, setSelectedFitments] = useState<VehicleFitment[]>([]);
  const [desiredMargin, setDesiredMargin] = useState("35"); // 35% default margin

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load article details in Edit Mode
  useEffect(() => {
    if (!isOpen) return;

    if (!articleId) {
      // Clear form for NEW article
      setCodigoFabricante("");
      setCodigoBarras("");
      setDescripcion("");
      setMarcaId(brands[0]?.id || "");
      setFamiliaId(families[0]?.id || "");
      setPrecioCosto("0");
      setPrecioMinorista("0");
      setPrecioMayorista("0");
      setStockActual("0");
      setStockMinimo("5");
      setUbicacionDeposito("");
      setSelectedFitments([]);
      setDesiredMargin("35");
      setErrorMessage("");
      return;
    }

    const loadArticleDetails = async () => {
      try {
        const client = getSupabaseClient();

        // 1. Fetch main article fields
        const { data: artData, error: artErr } = await client.database
          .from("articulo")
          .select("*")
          .eq("id", articleId)
          .single();

        if (artErr) throw artErr;

        if (artData) {
          setCodigoFabricante(artData.codigo_fabricante);
          setCodigoBarras(artData.codigo_barras || "");
          setDescripcion(artData.descripcion);
          setMarcaId(artData.marca_id);
          setFamiliaId(artData.familia_id);
          setPrecioCosto(artData.precio_costo);
          setPrecioMinorista(artData.precio_minorista);
          setPrecioMayorista(artData.precio_mayorista);
          setStockActual(artData.stock_actual.toString());
          setStockMinimo(artData.stock_minimo.toString());
          setUbicacionDeposito(artData.ubicacion_deposito || "");

          // Calculate initial margin
          const cost = parseFloat(artData.precio_costo) || 0;
          const sell = parseFloat(artData.precio_minorista) || 0;
          if (cost > 0) {
            setDesiredMargin(((sell - cost) / cost * 100).toFixed(0));
          }
        }

        // 2. Fetch vehicle compatibilities
        const { data: compData, error: compErr } = await client.database
          .from("articulo_compatibilidad")
          .select("auto_version_id")
          .eq("articulo_id", articleId);

        if (compErr) throw compErr;

        if (compData && compData.length > 0) {
          const versionIds = compData.map((c: any) => c.auto_version_id);

          // Get version fields
          const { data: verData, error: verErr } = await client.database
            .from("auto_version")
            .select("id, motorizacion, anio_desde, anio_hasta, auto_modelo(nombre, auto_marca(nombre))")
            .in("id", versionIds);

          if (verErr) throw verErr;

          if (verData) {
            const mappedFitments: VehicleFitment[] = verData.map((v: any) => ({
              id: v.id,
              marca: v.auto_modelo?.auto_marca?.nombre || "",
              modelo: v.auto_modelo?.nombre || "",
              motorizacion: v.motorizacion,
              anioDesde: v.anio_desde,
              anioHasta: v.anio_hasta || undefined,
            }));
            setSelectedFitments(mappedFitments);
          }
        } else {
          setSelectedFitments([]);
        }
      } catch (err) {
        console.error("Error loading article details for edit:", err);
      }
    };

    loadArticleDetails();
  }, [isOpen, articleId, brands, families]);

  // Recalculate price minorista when cost or margin changes
  const handleCostChange = (val: string) => {
    setPrecioCosto(val);
    const cost = parseFloat(val) || 0;
    const margin = parseFloat(desiredMargin) || 0;
    setPrecioMinorista((cost * (1 + margin / 100)).toFixed(2));
  };

  const handleMarginChange = (val: string) => {
    setDesiredMargin(val);
    const cost = parseFloat(precioCosto) || 0;
    const margin = parseFloat(val) || 0;
    setPrecioMinorista((cost * (1 + margin / 100)).toFixed(2));
  };

  // Reverse calculate margin when price minorista is updated manually
  const handleSellChange = (val: string) => {
    setPrecioMinorista(val);
    const cost = parseFloat(precioCosto) || 0;
    const sell = parseFloat(val) || 0;
    if (cost > 0) {
      setDesiredMargin(((sell - cost) / cost * 100).toFixed(0));
    }
  };

  // Submit Drawer Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoFabricante || !descripcion || !marcaId || !familiaId) {
      setErrorMessage("SKU, Descripción, Marca y Rubro son campos obligatorios.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const client = getSupabaseClient();

      // Read the active company CUIT from cookie (required by RLS policies)
      const cuitMatch = document.cookie.match(/(^|;)\s*erp_active_cuit\s*=\s*([^;]+)/);
      const companyCuit = cuitMatch ? decodeURIComponent(cuitMatch[2]) : null;
      if (!companyCuit) {
        setErrorMessage("No se pudo determinar el CUIT activo. Intentá recargar la página.");
        return;
      }

      const articlePayload = {
        codigo_fabricante: codigoFabricante,
        codigo_barras: codigoBarras || null,
        descripcion,
        marca_id: marcaId,
        familia_id: familiaId,
        precio_costo: parseFloat(precioCosto) || 0,
        precio_minorista: parseFloat(precioMinorista) || 0,
        precio_mayorista: parseFloat(precioMayorista) || 0,
        stock_actual: parseInt(stockActual, 10) || 0,
        stock_minimo: parseInt(stockMinimo, 10) || 5,
        ubicacion_deposito: ubicacionDeposito || null,
        company_cuit: companyCuit,
      };

      let finalArticleId = articleId;

      if (articleId) {
        // Edit Mode
        const { error } = await client.database
          .from("articulo")
          .update(articlePayload)
          .eq("id", articleId);

        if (error) throw error;
      } else {
        // Create Mode
        const { data, error } = await client.database
          .from("articulo")
          .insert(articlePayload)
          .select("id")
          .single();

        if (error) throw error;
        finalArticleId = (data as any)?.id;
      }

      // Sync vehicle compatibilities
      if (finalArticleId) {
        // First delete old relations if editing
        if (articleId) {
          const { error: delErr } = await client.database
            .from("articulo_compatibilidad")
            .delete()
            .eq("articulo_id", finalArticleId);

          if (delErr) throw delErr;
        }

        // Insert new relations
        if (selectedFitments.length > 0) {
          const { error: insErr } = await client.database
            .from("articulo_compatibilidad")
            .insert(
              selectedFitments.map((fit) => ({
                articulo_id: finalArticleId,
                auto_version_id: fit.id,
              }))
            );

          if (insErr) throw insErr;
        }
      }

      await fetchArticles();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error guardando los datos del repuesto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
      />

      {/* Drawer Body */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-zinc-950 border-l border-zinc-800 text-white shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold">
              {articleId ? "Ficha de Repuesto" : "Nuevo Repuesto Autopartista"}
            </h2>
            <p className="text-xs text-zinc-400">
              {articleId ? "Editá los detalles del catálogo y compatibilidades" : "Cargá un nuevo artículo al catálogo del ERP"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorMessage && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Row 1: Code and barcodes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Código Fabricante / SKU *</label>
              <input
                type="text"
                required
                value={codigoFabricante}
                onChange={(e) => setCodigoFabricante(e.target.value.toUpperCase())}
                placeholder="E.g. H-4001, 344401"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Código EAN / Barras</label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Código de barras EAN-13"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40"
              />
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase">Descripción del Artículo *</label>
            <input
              type="text"
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="E.g. Pastillas de Freno Delanteras"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40"
            />
          </div>

          {/* Row 3: Brand and Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Marca Repuesto *</label>
              <select
                value={marcaId}
                onChange={(e) => setMarcaId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40 text-zinc-300"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Rubro / Familia *</label>
              <select
                value={familiaId}
                onChange={(e) => setFamiliaId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40 text-zinc-300"
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Stocks and Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Stock Inicial</label>
              <input
                type="number"
                min="0"
                value={stockActual}
                onChange={(e) => setStockActual(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Stock Mínimo Alerta</label>
              <input
                type="number"
                min="1"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase">Ubicación Depósito</label>
              <input
                type="text"
                value={ubicacionDeposito}
                onChange={(e) => setUbicacionDeposito(e.target.value)}
                placeholder="E.g. Estante A-23"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-amber-500/40"
              />
            </div>
          </div>

          {/* Row 5: Costs & Dynamic Sell Margins */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
            <div className="border-b border-zinc-800/80 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                Estructura de Precios y Rentabilidad
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Precio Costo ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioCosto}
                  onChange={(e) => handleCostChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-850 text-sm focus:outline-none focus:border-amber-500/40 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Margen Deseado (%)</label>
                <input
                  type="number"
                  value={desiredMargin}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-850 text-sm focus:outline-none focus:border-amber-500/40 font-mono text-emerald-400"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">P. Venta Minorista ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioMinorista}
                  onChange={(e) => handleSellChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-850 text-sm focus:outline-none focus:border-amber-500/40 font-mono text-white font-bold"
                />
              </div>
            </div>
          </div>

          {/* Row 6: Vehicle Fitment Selector component */}
          <FitmentSelector
            selectedFitments={selectedFitments}
            onChange={setSelectedFitments}
          />
        </form>

        {/* Drawer Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 bg-zinc-950/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-xs font-extrabold text-black transition shadow-lg shadow-amber-500/5 disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border border-black border-t-transparent" />
                <span>Guardando...</span>
              </span>
            ) : articleId ? (
              "Actualizar Ficha"
            ) : (
              "Registrar Repuesto"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
