"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useInventoryStore } from "@/features/inventory/store/use-inventory-store";
import { getSupabaseClient } from "@/core/api/supabase";
import { matchTaxonomyItem } from "@/features/inventory/utils/inventory-utils";

interface BulkImporterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MappingField {
  label: string;
  key: string;
  required: boolean;
}

export function BulkImporter({ isOpen, onClose }: BulkImporterProps) {
  const { brands, families, fetchArticles } = useInventoryStore();

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // target -> csv_header
  const [markupMargin, setMarkupMargin] = useState("35"); // Default 35% margin for sell prices

  const [detectedBrands, setDetectedBrands] = useState<{ rawName: string; matchId: string; confidence: number; action: "link" | "create" }[]>([]);
  const [detectedFamilies, setDetectedFamilies] = useState<{ rawName: string; matchId: string; confidence: number; action: "link" | "create" }[]>([]);

  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 2.5: Homologation, 3: Preview & Save
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseFields: MappingField[] = [
    { label: "Código Fabricante / SKU *", key: "codigo_fabricante", required: true },
    { label: "Descripción / Nombre *", key: "descripcion", required: true },
    { label: "Precio Costo ($) *", key: "precio_costo", required: true },
    { label: "Stock Actual", key: "stock_actual", required: false },
    { label: "Stock Mínimo / Alerta", key: "stock_minimo", required: false },
    { label: "Ubicación Depósito", key: "ubicacion_deposito", required: false },
    { label: "Código de Barras EAN", key: "codigo_barras", required: false },
  ];

  const fields: MappingField[] = [
    ...baseFields,
    { label: "Nombre de Marca *", key: "marca_nombre", required: true },
    { label: "Nombre de Rubro / Familia *", key: "familia_nombre", required: true }
  ];

  if (!isOpen) return null;

  // Handles drag & drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Autodetect file type and parse
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMessage("");

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    const isExcel = extension === "xlsx" || extension === "xls";

    if (isExcel) {
      // Parse Excel with SheetJS
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

          if (jsonRows.length < 2) {
            throw new Error("El archivo Excel no contiene suficientes filas de datos.");
          }

          const excelHeaders = jsonRows[0].map((h: any) => String(h).trim());
          const rows = jsonRows.slice(1).map((row: any[]) => row.map((cell: any) => String(cell).trim()));

          setHeaders(excelHeaders);
          setParsedRows(rows);
          autoMatchHeaders(excelHeaders);
          setStep(2);
        } catch (err: any) {
          setErrorMessage(err.message || "Error procesando el archivo Excel.");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      // Parse CSV as text
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (!text) return;

          const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
          if (lines.length < 2) {
            throw new Error("El archivo no contiene suficientes filas de datos.");
          }

          const firstLine = lines[0];
          const commaCount = (firstLine.match(/,/g) || []).length;
          const semiCount = (firstLine.match(/;/g) || []).length;
          const delimiter = semiCount > commaCount ? ";" : ",";

          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const csvHeaders = parseCSVLine(lines[0]);
          const rows = lines.slice(1).map((l) => parseCSVLine(l));

          setHeaders(csvHeaders);
          setParsedRows(rows);
          autoMatchHeaders(csvHeaders);
          setStep(2);
        } catch (err: any) {
          setErrorMessage(err.message || "Error procesando el archivo CSV.");
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  // Auto-match CSV/Excel headers to system fields
  const autoMatchHeaders = (fileHeaders: string[]) => {
    const initialMappings: Record<string, string> = {};
    fields.forEach((f) => {
      const matched = fileHeaders.find(
        (h) =>
          h.toLowerCase().includes(f.key.replace("_", " ")) ||
          h.toLowerCase().includes(f.label.toLowerCase().split(" ")[0])
      );
      if (matched) {
        initialMappings[f.key] = matched;
      }
    });
    setMappings(initialMappings);
  };

  // Convert mapped headers to target objects
  const getMappedItems = (resolvedBrandIds?: Record<string, string>, resolvedFamilyIds?: Record<string, string>) => {
    return parsedRows.map((row) => {
      const item: Record<string, any> = {};

      fields.forEach((f) => {
        const headerIndex = headers.indexOf(mappings[f.key]);
        const val = headerIndex !== -1 ? row[headerIndex] : "";

        // Clean value
        if (f.key === "precio_costo") {
          item[f.key] = parseFloat(val.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        } else if (f.key === "stock_actual") {
          item[f.key] = parseInt(val, 10) || 0;
        } else if (f.key === "stock_minimo") {
          item[f.key] = parseInt(val, 10) || 5;
        } else {
          item[f.key] = val || "";
        }
      });

      // Calculate markup prices
      const cost = item.precio_costo || 0;
      const margin = parseFloat(markupMargin) || 35;
      item.precio_minorista = cost * (1 + margin / 100);
      item.precio_mayorista = cost * (1 + (margin * 0.7) / 100); // 30% discount on margin for wholesale
      
      // Resolve Brand ID
      const rawBrand = item.marca_nombre;
      if (resolvedBrandIds && resolvedBrandIds[rawBrand]) {
        item.marca_id = resolvedBrandIds[rawBrand];
      } else {
        const match = detectedBrands.find(b => b.rawName === rawBrand);
        item.marca_id = match && match.action === "link" ? match.matchId : "";
      }

      // Resolve Family ID
      const rawFamily = item.familia_nombre;
      if (resolvedFamilyIds && resolvedFamilyIds[rawFamily]) {
        item.familia_id = resolvedFamilyIds[rawFamily];
      } else {
        const match = detectedFamilies.find(f => f.rawName === rawFamily);
        item.familia_id = match && match.action === "link" ? match.matchId : "";
      }

      if (item.stock_minimo === undefined || item.stock_minimo === null || item.stock_minimo === "") {
        item.stock_minimo = 5;
      }

      // Clean up temp mapping columns to avoid DB insertion errors
      delete item.marca_nombre;
      delete item.familia_nombre;

      return item;
    });
  };

  const validateMappingStep = (): boolean => {
    setErrorMessage("");

    for (const f of fields) {
      if (f.required && !mappings[f.key]) {
        setErrorMessage(`El campo obligatorio "${f.label}" debe estar mapeado a una columna del CSV.`);
        return false;
      }
    }

    return true;
  };

  const handleTransitionFromStep2 = () => {
    if (!validateMappingStep()) return;

    const rawBrandsSet = new Set<string>();
    const rawFamiliesSet = new Set<string>();

    parsedRows.forEach((row) => {
      const headerIndexMarca = headers.indexOf(mappings["marca_nombre"]);
      const valMarca = headerIndexMarca !== -1 ? row[headerIndexMarca]?.trim() : "";
      if (valMarca) rawBrandsSet.add(valMarca);

      const headerIndexFamilia = headers.indexOf(mappings["familia_nombre"]);
      const valFamilia = headerIndexFamilia !== -1 ? row[headerIndexFamilia]?.trim() : "";
      if (valFamilia) rawFamiliesSet.add(valFamilia);
    });

    const brandMatches = Array.from(rawBrandsSet).map((rawName) => {
      const { bestMatch, confidence } = matchTaxonomyItem(rawName, brands);
      return {
        rawName,
        matchId: bestMatch ? bestMatch.id : "",
        confidence,
        action: bestMatch ? ("link" as const) : ("create" as const),
      };
    });

    const familyMatches = Array.from(rawFamiliesSet).map((rawName) => {
      const { bestMatch, confidence } = matchTaxonomyItem(rawName, families);
      return {
        rawName,
        matchId: bestMatch ? bestMatch.id : "",
        confidence,
        action: bestMatch ? ("link" as const) : ("create" as const),
      };
    });

    setDetectedBrands(brandMatches);
    setDetectedFamilies(familyMatches);
    setStep(2.5);
  };

  const handleUpdateBrandMatch = (index: number, val: string) => {
    setDetectedBrands((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b;
        if (val === "create") {
          return { ...b, action: "create", matchId: "" };
        } else {
          return { ...b, action: "link", matchId: val };
        }
      })
    );
  };

  const handleUpdateFamilyMatch = (index: number, val: string) => {
    setDetectedFamilies((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        if (val === "create") {
          return { ...f, action: "create", matchId: "" };
        } else {
          return { ...f, action: "link", matchId: val };
        }
      })
    );
  };

  // Insert items in batches into database
  const handleImport = async () => {
    setIsProcessing(true);
    setErrorMessage("");
    setProgress(10);

    try {
      const client = getSupabaseClient();

      const resolvedBrandIds: Record<string, string> = {};
      const resolvedFamilyIds: Record<string, string> = {};

      // 1. Pre-populate existing linked brands/families
      detectedBrands.forEach((b) => {
        if (b.action === "link" && b.matchId) {
          resolvedBrandIds[b.rawName] = b.matchId;
        }
      });

      detectedFamilies.forEach((f) => {
        if (f.action === "link" && f.matchId) {
          resolvedFamilyIds[f.rawName] = f.matchId;
        }
      });

      setProgress(20);

      // 2. Perform atomic batch insertion of new brands
      const brandsToCreate = detectedBrands.filter((b) => b.action === "create").map((b) => b.rawName);
      if (brandsToCreate.length > 0) {
        const payload = brandsToCreate.map((name) => ({ nombre: name }));
        const { data, error } = await client.database
          .from("marca")
          .upsert(payload, { onConflict: "nombre" })
          .select("id, nombre");

        if (error) throw error;
        if (data) {
          data.forEach((b: any) => {
            resolvedBrandIds[b.nombre] = b.id;
          });
        }
      }

      setProgress(35);

      // 3. Perform atomic batch insertion of new families (rubros)
      const familiesToCreate = detectedFamilies.filter((f) => f.action === "create").map((f) => f.rawName);
      if (familiesToCreate.length > 0) {
        const payload = familiesToCreate.map((name) => ({ nombre: name }));
        const { data, error } = await client.database
          .from("familia_repuesto")
          .upsert(payload, { onConflict: "nombre" })
          .select("id, nombre");

        if (error) throw error;
        if (data) {
          data.forEach((f: any) => {
            resolvedFamilyIds[f.nombre] = f.id;
          });
        }
      }

      setProgress(50);

      // 4. Map final rows using newly obtained IDs
      const itemsToImport = getMappedItems(resolvedBrandIds, resolvedFamilyIds);
      
      // Filter out invalid items (must have SKU and description)
      const validItems = itemsToImport.filter(
        (item) => item.codigo_fabricante && item.descripcion
      );

      if (validItems.length === 0) {
        throw new Error("No hay registros válidos para importar. Verificá el mapeo.");
      }

      // Check if any item is missing brand or family ID (which is required by the DB)
      const missingTaxonomy = validItems.some(item => !item.marca_id || !item.familia_id);
      if (missingTaxonomy) {
        throw new Error("Hay registros con marcas o rubros sin resolver. Asegurá que todo esté homologado.");
      }

      setProgress(70);

      // 5. Perform resilient bulk upsert using composite unique index constraint
      const { error } = await client.database
        .from("articulo")
        .upsert(validItems, { onConflict: "codigo_fabricante,marca_id" });

      if (error) throw error;

      setProgress(100);
      
      // Trigger a store refetch for both metadata and articles to ensure local state has the new taxonomies & articles
      const { fetchMetadata } = useInventoryStore.getState();
      await Promise.all([fetchArticles(), fetchMetadata()]);
      onClose();
    } catch (err: any) {
      console.error("Bulk Import error:", err);
      setErrorMessage(err.message || "Error al subir registros a la base de datos.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Dialog container */}
      <div 
        className="relative z-10 w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold">Importación Masiva de Catálogo</h3>
            <p className="text-xs text-zinc-400">
              Cargá tu lista de precios en formato CSV para importar o actualizar stock al instante
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Wizard Steps */}
        <div 
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6"
          style={{ minHeight: 0 }}
        >
          {errorMessage && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl py-12 px-6 cursor-pointer bg-zinc-900/10 hover:bg-zinc-900/30 transition group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <div className="mb-4 rounded-full bg-zinc-900 p-4 border border-zinc-850 group-hover:border-amber-500/20 transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 group-hover:text-amber-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className="text-sm font-bold text-zinc-300">
                Arrastrá tu archivo CSV o Excel aquí, o hacé clic para buscar
              </span>
              <span className="text-xs text-zinc-500 mt-1">
                Soporta CSV (UTF-8, ANSI) y Excel (.xlsx, .xls)
              </span>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-6">

              {/* Price sell markup */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-500 block">
                    Margen de Venta Automático
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Se aplicará este porcentaje al costo importado para calcular el precio minorista
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={markupMargin}
                    onChange={(e) => setMarkupMargin(e.target.value)}
                    className="w-20 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-center text-emerald-400 font-mono font-bold"
                  />
                  <span className="text-xs text-zinc-400 font-bold">%</span>
                </div>
              </div>

              {/* Mapper */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                  Mapeo de Columnas de Excel / CSV
                </span>
                <div 
                  className="rounded-xl border border-zinc-800 bg-zinc-950"
                  style={{ maxHeight: "250px", overflowY: "auto" }}
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 uppercase font-bold">
                        <th className="px-4 py-3">Campo del Sistema</th>
                        <th className="px-4 py-3">Columna en tu CSV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {fields.map((f) => (
                        <tr key={f.key} className="hover:bg-zinc-900/20">
                          <td className="px-4 py-3 font-semibold text-zinc-300">
                            {f.label}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={mappings[f.key] || ""}
                              onChange={(e) =>
                                setMappings({ ...mappings, [f.key]: e.target.value })
                              }
                              className="w-full max-w-xs px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
                            >
                              <option value="">-- Ignorar campo --</option>
                              {headers.map((h, i) => (
                                <option key={`${i}-${h}`} value={h}>
                                  {h || `(Columna ${i + 1})`}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2.5: Taxonomy Matcher Dialog */}
          {step === 2.5 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="text-xs space-y-1">
                  <span className="font-bold text-amber-400 block">Homologación e Integridad de Catálogo</span>
                  <p className="text-zinc-400 leading-relaxed">
                    Hemos detectado marcas o rubros en tu archivo CSV que no coinciden exactamente con la base de datos.
                    Confirmá el mapeo sugerido o elegí la opción correcta para evitar duplicaciones indeseadas.
                  </p>
                </div>
              </div>

              {detectedBrands.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    Marcas en el CSV ({detectedBrands.length})
                  </span>
                  <div 
                    className="rounded-xl border border-zinc-800 bg-zinc-950"
                    style={{ maxHeight: "180px", overflowY: "auto" }}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 uppercase font-bold">
                          <th className="px-4 py-3">Nombre en CSV</th>
                          <th className="px-4 py-3">Resolución Sugerida</th>
                          <th className="px-4 py-3">Destino / Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {detectedBrands.map((b, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/20">
                            <td className="px-4 py-3 font-semibold text-zinc-300">{b.rawName}</td>
                            <td className="px-4 py-3">
                              {b.action === "link" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Coincidencia ({(b.confidence * 100).toFixed(0)}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Crear nueva marca
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={b.action === "create" ? "create" : b.matchId}
                                onChange={(e) => handleUpdateBrandMatch(idx, e.target.value)}
                                className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none w-full max-w-xs"
                              >
                                <option value="create">-- Crear marca &quot;{b.rawName}&quot; --</option>
                                {brands.map((brandItem) => (
                                  <option key={brandItem.id} value={brandItem.id}>
                                    Asociar a existente: {brandItem.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detectedFamilies.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    Rubros / Familias en el CSV ({detectedFamilies.length})
                  </span>
                  <div 
                    className="rounded-xl border border-zinc-800 bg-zinc-950"
                    style={{ maxHeight: "180px", overflowY: "auto" }}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 uppercase font-bold">
                          <th className="px-4 py-3">Nombre en CSV</th>
                          <th className="px-4 py-3">Resolución Sugerida</th>
                          <th className="px-4 py-3">Destino / Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {detectedFamilies.map((f, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/20">
                            <td className="px-4 py-3 font-semibold text-zinc-300">{f.rawName}</td>
                            <td className="px-4 py-3">
                              {f.action === "link" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Coincidencia ({(f.confidence * 100).toFixed(0)}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Crear nuevo rubro
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={f.action === "create" ? "create" : f.matchId}
                                onChange={(e) => handleUpdateFamilyMatch(idx, e.target.value)}
                                className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none w-full max-w-xs"
                              >
                                <option value="create">-- Crear rubro &quot;{f.rawName}&quot; --</option>
                                {families.map((familyItem) => (
                                  <option key={familyItem.id} value={familyItem.id}>
                                    Asociar a existente: {familyItem.nombre}
                                  </option>
                                ))}
                              </select>
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

          {/* STEP 3: Preview Items */}
          {step === 3 && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Vista Previa de Importación ({parsedRows.length} repuestos listos)
              </span>
              <div 
                className="rounded-xl border border-zinc-800 bg-zinc-950"
                style={{ maxHeight: "280px", overflowY: "auto" }}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 uppercase font-bold sticky top-0">
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Precio Venta ({markupMargin}%)</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {getMappedItems().slice(0, 50).map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/20 font-mono">
                        <td className="px-4 py-2 text-white font-bold">{item.codigo_fabricante || "N/D"}</td>
                        <td className="px-4 py-2 text-zinc-300 truncate max-w-xs">{item.descripcion || "SIN NOMBRE"}</td>
                        <td className="px-4 py-2 text-right text-zinc-400">${item.precio_costo.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-emerald-400 font-bold">${item.precio_minorista.toFixed(2)}</td>
                        <td className="px-4 py-2 text-center text-zinc-400">{item.stock_actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <span className="text-[10px] text-zinc-500 italic block text-right">
                  * Mostrando los primeros 50 registros de {parsedRows.length} totales.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-zinc-800 bg-zinc-950/80 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {isProcessing && (
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border border-amber-500 border-t-transparent" />
                <span className="text-xs text-zinc-400">Importando... ({progress}%)</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (step === 2.5) {
                    setStep(2);
                  } else if (step === 3) {
                    setStep(2.5);
                  } else {
                    setStep(step - 1);
                  }
                }}
                className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 hover:text-white"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl border border-zinc-850 bg-transparent text-xs font-bold text-zinc-500 hover:text-zinc-300"
            >
              Cerrar
            </button>
            {step === 2 && (
              <button
                type="button"
                onClick={handleTransitionFromStep2}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-black"
              >
                Continuar
              </button>
            )}
            {step === 2.5 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-black"
              >
                Vista Previa
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleImport}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-xs font-extrabold text-zinc-950 shadow-lg shadow-emerald-500/10 transition-all duration-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Procesar e Importar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
