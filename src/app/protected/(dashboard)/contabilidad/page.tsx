"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  BookOpen,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
  Percent
} from "lucide-react";
import { toast } from "sonner";
import {
  getAccountingAccounts,
  getAccountingTransactions,
  createManualTransaction,
  deleteTransaction,
  AccountingAccount,
  AccountingTransaction
} from "@/features/accounting/services/accounting-service";
import { useSecretStore } from "@/features/sales/store/use-secret-store";
import { useCompanyStore } from "@/core/company/company-store";
import { useDateRangeStore } from "@/core/store/date-range-store";
import { arDateToUTCBounds } from "@/core/utils/timezone-utils";
import {
  getAlicuotas,
  upsertAlicuota,
  toggleAlicuotaActiva,
  deleteAlicuota,
  type AlicuotaIva
} from "@/features/accounting/services/alicuota-service";

export default function ContabilidadPage() {
  const activeCompany = useCompanyStore((state) => state.currentCompany);
  const { startDate, endDate } = useDateRangeStore();
  const [activeTab, setActiveTab] = useState<"ledger" | "coa" | "manual" | "alicuotas">("ledger");
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [alicuotas, setAlicuotas] = useState<AlicuotaIva[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingAlicuotas, setLoadingAlicuotas] = useState(false);
  
  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);
  
  // Export modal and choices state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [includeCajaNegraInExport, setIncludeCajaNegraInExport] = useState(showCajaNegra);

  // Sync checkbox state when user toggles secret keyboard shortcut
  useEffect(() => {
    setIncludeCajaNegraInExport(showCajaNegra);
  }, [showCajaNegra]);
  
  // Search / Filters
  const [coaSearch, setCoaSearch] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Modal / Form state for Alicuotas
  const [isAlicuotaModalOpen, setIsAlicuotaModalOpen] = useState(false);
  const [editingAlicuota, setEditingAlicuota] = useState<AlicuotaIva | null>(null);
  const [formCodigoAfip, setFormCodigoAfip] = useState<string>("");
  const [formDescripcion, setFormDescripcion] = useState<string>("");
  const [formPorcentaje, setFormPorcentaje] = useState<string>("");
  const [formActiva, setFormActiva] = useState<boolean>(true);

  // Form State for Manual Transaction
  const [manualDescription, setManualDescription] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualEntries, setManualEntries] = useState<
    { account_code: string; debe: string; haber: string }[]
  >([
    { account_code: "", debe: "", haber: "" },
    { account_code: "", debe: "", haber: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Accounts
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const res = await getAccountingAccounts();
    if (res.error) {
      toast.error(`Error al cargar plan de cuentas: ${res.error}`);
    } else {
      setAccounts(res.data);
    }
    setLoadingAccounts(false);
  };

  // Fetch Transactions
  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const { startISO } = arDateToUTCBounds(startDate);
      const { endISO } = arDateToUTCBounds(endDate);
      const res = await getAccountingTransactions(startISO, endISO);
      if (res.error) {
        toast.error(`Error al cargar el Libro Diario: ${res.error}`);
      } else {
        setTransactions(res.data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Ocurrió un error al calcular los límites de fechas en Argentina.");
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fetch Alicuotas
  const loadAlicuotas = async () => {
    setLoadingAlicuotas(true);
    const res = await getAlicuotas();
    if (res.error) {
      toast.error(`Error al cargar alícuotas: ${res.error}`);
    } else {
      setAlicuotas(res.data);
    }
    setLoadingAlicuotas(false);
  };

  useEffect(() => {
    loadAccounts();
    loadAlicuotas();
  }, [activeCompany]);

  useEffect(() => {
    loadTransactions();
  }, [activeCompany, startDate, endDate]);

  // Filter transactions by canal if showCajaNegra is false
  const transactionsVisibles = transactions.filter((tx) => {
    if (!showCajaNegra && tx.canal === "interno") return false;
    return true;
  });

  // Compute stats for Ledger Summary
  const totalDebeGlobal = transactionsVisibles.reduce((sum, tx) => {
    const txSum = tx.accounting_entries?.reduce((s, e) => s + Number(e.debe || 0), 0) || 0;
    return sum + txSum;
  }, 0);

  const totalHaberGlobal = transactionsVisibles.reduce((sum, tx) => {
    const txSum = tx.accounting_entries?.reduce((s, e) => s + Number(e.haber || 0), 0) || 0;
    return sum + txSum;
  }, 0);

  const totalDiffGlobal = Math.abs(totalDebeGlobal - totalHaberGlobal);

  // Filter accounts
  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.code.includes(coaSearch) ||
      acc.name.toLowerCase().includes(coaSearch.toLowerCase())
  );

  // Filter transactions
  const filteredTransactions = transactionsVisibles.filter(
    (tx) =>
      tx.id.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      tx.description.toLowerCase().includes(ledgerSearch.toLowerCase())
  );

  // Toggle transaction expansion
  const toggleTxExpanded = (id: string) => {
    setExpandedTxId(expandedTxId === id ? null : id);
  };

  // Handle entries for manual form
  const addEntryRow = () => {
    setManualEntries([...manualEntries, { account_code: "", debe: "", haber: "" }]);
  };

  const removeEntryRow = (index: number) => {
    if (manualEntries.length <= 2) {
      toast.error("Un asiento contable debe tener al menos dos líneas.");
      return;
    }
    setManualEntries(manualEntries.filter((_, i) => i !== index));
  };

  const updateEntryRow = (
    index: number,
    field: "account_code" | "debe" | "haber",
    value: string
  ) => {
    const updated = [...manualEntries];
    
    if (field === "account_code") {
      updated[index].account_code = value;
    } else if (field === "debe") {
      updated[index].debe = value;
      // If debit is loaded, clear credit to preserve ledger row hygiene
      if (value !== "") updated[index].haber = "";
    } else if (field === "haber") {
      updated[index].haber = value;
      // If credit is loaded, clear debit
      if (value !== "") updated[index].debe = "";
    }

    setManualEntries(updated);
  };

  // Live balance calculations for manual form
  const formTotalDebe = manualEntries.reduce((sum, e) => sum + parseFloat(e.debe || "0"), 0);
  const formTotalHaber = manualEntries.reduce((sum, e) => sum + parseFloat(e.haber || "0"), 0);
  const formDifference = Math.abs(formTotalDebe - formTotalHaber);
  const isFormBalanced = formDifference < 0.01 && formTotalDebe > 0;

  // Handle submit manual transaction
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescription.trim()) {
      toast.error("La descripción del asiento es obligatoria.");
      return;
    }

    // Verify all rows have an account
    const invalidRow = manualEntries.some((e) => !e.account_code);
    if (invalidRow) {
      toast.error("Todas las líneas de asiento deben tener una cuenta contable seleccionada.");
      return;
    }

    // Verify all rows have either a debit or credit greater than 0
    const zeroRow = manualEntries.some(
      (e) => !parseFloat(e.debe || "0") && !parseFloat(e.haber || "0")
    );
    if (zeroRow) {
      toast.error("Todas las líneas deben contener un importe en el Debe o en el Haber.");
      return;
    }

    if (!isFormBalanced) {
      toast.error("El asiento contable no está balanceado.");
      return;
    }

    setIsSubmitting(true);
    const parsedEntries = manualEntries.map((e) => ({
      account_code: e.account_code,
      debe: parseFloat(e.debe || "0"),
      haber: parseFloat(e.haber || "0")
    }));

    const res = await createManualTransaction(
      manualDescription, 
      manualDate, 
      parsedEntries,
      activeCompany?.cuit,
      showCajaNegra ? "interno" : "oficial"
    );

    if (res.success) {
      toast.success("Asiento contable manual registrado correctamente.");
      setManualDescription("");
      setManualEntries([
        { account_code: "", debe: "", haber: "" },
        { account_code: "", debe: "", haber: "" }
      ]);
      loadTransactions();
      setActiveTab("ledger");
    } else {
      toast.error(`Error al registrar asiento: ${res.error}`);
    }
    setIsSubmitting(false);
  };

  // Handle delete transaction
  const handleDeleteTx = async (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este asiento contable permanentemente?")) {
      const res = await deleteTransaction(id);
      if (res.success) {
        toast.success("Asiento contable eliminado con éxito.");
        loadTransactions();
      } else {
        toast.error(`No se pudo eliminar el asiento: ${res.error}`);
      }
    }
  };

  // Handle export ledger to Excel with stylized HTML templates
  const handleExportLedgerToExcel = () => {
    try {
      // 1. Filter transactions according to export options and text search
      const filteredForExport = transactions.filter((tx) => {
        // Caja Negra exclusion
        if (!includeCajaNegraInExport && tx.canal === "interno") return false;
        
        // Search term matching
        const matchSearch =
          tx.id.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
          tx.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
          tx.accounting_entries?.some(
            (e) =>
              e.account_code.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
              e.accounting_accounts?.name.toLowerCase().includes(ledgerSearch.toLowerCase())
          );
        return matchSearch || !ledgerSearch;
      });

      if (filteredForExport.length === 0) {
        toast.error("No hay transacciones para exportar con los filtros seleccionados.");
        return;
      }

      // 2. Build stylized XML/HTML content for Excel
      const timestamp = new Date().toLocaleDateString("es-AR");
      const filenameSuffix = includeCajaNegraInExport ? "Diario General (Consolidado)" : "Diario General (Estándar)";
      
      let tableRows = "";
      filteredForExport.forEach((tx) => {
        const dateStr = new Date(tx.date).toLocaleDateString("es-AR");
        const subdiarioLabel = tx.canal === "interno" ? "Diario Auxiliar" : "Diario General";

        tx.accounting_entries?.forEach((entry, idx) => {
          const debeVal = Number(entry.debe) > 0 
            ? `$ ${Number(entry.debe).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` 
            : "—";
          const haberVal = Number(entry.haber) > 0 
            ? `$ ${Number(entry.haber).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` 
            : "—";
          
          // Only show transaction headers on the first line of each transaction for cleaner visual hygiene
          const showTxHeader = idx === 0;

          tableRows += `
            <tr style="height: 32px;">
              <td style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; color: #4b5563; white-space: nowrap; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top;">${dateStr}</td>
              <td style="font-family: 'Consolas', 'Courier New', monospace; font-size: 10px; font-weight: bold; background-color: #f8fafc; color: #334155; white-space: nowrap; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top;">${showTxHeader ? tx.id : ""}</td>
              <td style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: ${showTxHeader ? "bold" : "normal"}; color: #1e293b; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top; text-align: left;">${showTxHeader ? tx.description : ""}</td>
              <td style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; font-style: italic; color: ${tx.canal === "interno" ? "#7e22ce" : "#475569"}; font-weight: 500; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top; white-space: nowrap;">
                ${showTxHeader ? subdiarioLabel : ""}
              </td>
              <td style="font-family: 'Consolas', 'Courier New', monospace; text-align: center; color: #4b5563; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top;">${entry.account_code}</td>
              <td style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top; text-align: left;">${entry.accounting_accounts?.name || "Cuenta"}</td>
              <td style="font-family: 'Consolas', 'Courier New', monospace; text-align: right; font-weight: bold; color: #0f172a; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top; ${Number(entry.debe) === 0 ? "color: #94a3b8; font-weight: normal;" : ""}">${debeVal}</td>
              <td style="font-family: 'Consolas', 'Courier New', monospace; text-align: right; font-weight: bold; color: #0f172a; padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: top; ${Number(entry.haber) === 0 ? "color: #94a3b8; font-weight: normal;" : ""}">${haberVal}</td>
            </tr>
          `;
        });
      });

      const excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Libro Diario</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
            .title { font-size: 16px; font-weight: bold; color: #0f172a; }
            .metadata { font-size: 11px; color: #475569; padding-bottom: 15px; }
            table { border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; }
            th { background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; border: 1px solid #0f172a; text-align: center; padding: 12px 10px; }
          </style>
        </head>
        <body>
          <div class="title">ERP NODO SUR — Libro Diario Contable</div>
          <div class="metadata">
            <strong>Empresa CUIT:</strong> ${activeCompany?.cuit || "—"} | 
            <strong>Razón Social:</strong> ${activeCompany?.razon_social || "—"}<br/>
            <strong>Reporte contable:</strong> ${filenameSuffix} | 
            <strong>Fecha de generación:</strong> ${timestamp}
          </div>
          <table>
            <thead>
              <tr style="height: 35px;">
                <th style="width: 100px;">Fecha</th>
                <th style="width: 230px;">Asiento ID</th>
                <th style="width: 400px;">Concepto / Glosa</th>
                <th style="width: 140px;">Libro Diario</th>
                <th style="width: 110px;">Cuenta Código</th>
                <th style="width: 250px;">Cuenta Contable</th>
                <th style="width: 130px;">Debe</th>
                <th style="width: 130px;">Haber</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // 3. Generate secure download file using Excel Mime Type
      const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const fileSuffix = includeCajaNegraInExport ? "_consolidado_B" : "_oficial_A";
      const dateFile = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `libro_diario_${dateFile}${fileSuffix}.xls`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExportModalOpen(false);
      toast.success("Libro Diario exportado exitosamente a Excel con formato premium.");
    } catch (err) {
      console.error("Error al exportar Libro Diario:", err);
      toast.error("Hubo un problema al generar el archivo de exportación.");
    }
  };

  // Handle Alicuotas Form Submit
  const handleSubmitAlicuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCodigoAfip === "" || isNaN(Number(formCodigoAfip))) {
      toast.error("El código AFIP debe ser un número entero válido.");
      return;
    }
    if (!formDescripcion.trim()) {
      toast.error("La descripción es obligatoria.");
      return;
    }
    if (formPorcentaje === "" || isNaN(Number(formPorcentaje))) {
      toast.error("El porcentaje debe ser un número entre 0 y 100.");
      return;
    }

    const payload: AlicuotaIva = {
      codigo_afip: parseInt(formCodigoAfip),
      descripcion: formDescripcion.trim(),
      porcentaje: parseFloat(formPorcentaje),
      activa: formActiva,
    };

    const res = await upsertAlicuota(payload);
    if (res.success) {
      toast.success(editingAlicuota ? "Alícuota modificada con éxito." : "Alícuota creada con éxito.");
      setIsAlicuotaModalOpen(false);
      loadAlicuotas();
    } else {
      toast.error(`Error al guardar alícuota: ${res.error}`);
    }
  };

  // Open modal for editing
  const openEditAlicuota = (alicuota: AlicuotaIva) => {
    setEditingAlicuota(alicuota);
    setFormCodigoAfip(alicuota.codigo_afip.toString());
    setFormDescripcion(alicuota.descripcion);
    setFormPorcentaje(alicuota.porcentaje.toString());
    setFormActiva(alicuota.activa);
    setIsAlicuotaModalOpen(true);
  };

  // Open modal for new alicuota
  const openNewAlicuota = () => {
    setEditingAlicuota(null);
    setFormCodigoAfip("");
    setFormDescripcion("");
    setFormPorcentaje("");
    setFormActiva(true);
    setIsAlicuotaModalOpen(true);
  };

  // Toggle active status
  const handleToggleAlicuota = async (codigoAfip: number, currentStatus: boolean) => {
    const res = await toggleAlicuotaActiva(codigoAfip, !currentStatus);
    if (res.success) {
      toast.success("Estado de la alícuota actualizado con éxito.");
      loadAlicuotas();
    } else {
      toast.error(`Error al cambiar estado: ${res.error}`);
    }
  };

  // Delete custom tax rate
  const handleDeleteAlicuota = async (codigoAfip: number) => {
    if (confirm("¿Está seguro de que desea eliminar esta alícuota?")) {
      const res = await deleteAlicuota(codigoAfip);
      if (res.success) {
        toast.success("Alícuota eliminada con éxito.");
        loadAlicuotas();
      } else {
        toast.error(`No se pudo eliminar: ${res.error}`);
      }
    }
  };

  // Helper function to resolve indentation class based on account code depth
  const getCoaIndentation = (code: string) => {
    const dotsCount = (code.match(/\./g) || []).length;
    if (dotsCount === 0) return "pl-3 font-extrabold text-white text-lg py-4 bg-zinc-900/50 border-b border-zinc-800/80 rounded-xl mt-4 first:mt-0";
    if (dotsCount === 1) return "pl-8 font-bold text-zinc-100 text-base py-3 mt-2";
    if (dotsCount === 2) return "pl-14 font-semibold text-zinc-300 text-sm py-2.5 mt-1";
    return "pl-22 text-zinc-400 text-sm py-2 opacity-95 border-l-2 border-amber-500/30 ml-8";
  };

  // Resolve visual color badge for account types
  const getAccountTypeStyles = (type: string) => {
    switch (type) {
      case "activo":
        return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
      case "pasivo":
        return "bg-rose-500/10 border-rose-500/25 text-rose-400";
      case "patrimonio_neto":
        return "bg-purple-500/10 border-purple-500/25 text-purple-400";
      case "ingreso":
        return "bg-blue-500/10 border-blue-500/25 text-blue-400";
      case "egreso":
        return "bg-amber-500/10 border-amber-500/25 text-amber-400";
      default:
        return "bg-zinc-500/10 border-zinc-500/25 text-zinc-400";
    }
  };

  // Helper to translate account types to Spanish
  const translateAccountType = (type: string) => {
    switch (type) {
      case "activo":
        return "Activo";
      case "pasivo":
        return "Pasivo";
      case "patrimonio_neto":
        return "Patrimonio Neto";
      case "ingreso":
        return "Ingreso";
      case "egreso":
        return "Egreso / Gasto";
      default:
        return type;
    }
  };

  // Resolve transaction status properties
  const getTransactionStatus = (tx: AccountingTransaction) => {
    const lines = tx.accounting_entries || [];
    if (lines.length === 0) {
      return { label: "Incompleto", color: "bg-red-500/10 border-red-500/20 text-red-400" };
    }
    const dSum = lines.reduce((s, e) => s + Number(e.debe || 0), 0);
    const hSum = lines.reduce((s, e) => s + Number(e.haber || 0), 0);
    const difference = Math.abs(dSum - hSum);
    
    if (difference > 0.05) {
      return { label: "Desbalanceado", color: "bg-orange-500/10 border-orange-500/20 text-orange-400" };
    }
    return { label: "Balanceado", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
            Contabilidad y Finanzas
          </h1>
          <p className="text-sm text-zinc-400">Plan de cuentas unificado, Libro Diario balanceado y asientos manuales</p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "ledger"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Libro Diario
          </button>
          <button
            onClick={() => setActiveTab("coa")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "coa"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Plan de Cuentas
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "manual"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Asiento
          </button>
          <button
            onClick={() => setActiveTab("alicuotas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "alicuotas"
                ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            Alícuotas de IVA
          </button>
        </div>
      </div>

      {/* Main content conditional view */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          {/* LEDGER OVERVIEW SUMMARY CARDS */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md">
              <div className="text-zinc-400 text-xs font-semibold">Total Débito Acumulado (Debe)</div>
              <div className="text-xl font-black text-white mt-1">
                ${totalDebeGlobal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md">
              <div className="text-zinc-400 text-xs font-semibold">Total Crédito Acumulado (Haber)</div>
              <div className="text-xl font-black text-white mt-1">
                ${totalHaberGlobal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/20 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="text-zinc-400 text-xs font-semibold">Consistencia Contable (Diferencia)</div>
                <div className={`text-xl font-black mt-1 flex items-center gap-1.5 ${totalDiffGlobal < 0.05 ? "text-emerald-400" : "text-amber-500"}`}>
                  ${totalDiffGlobal.toFixed(2)}
                  {totalDiffGlobal < 0.05 && <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />}
                </div>
              </div>
            </div>
          </div>

          {/* LEDGER FILTER SEARCH BAR */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar asientos por ID, concepto o cuenta..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/30 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-zinc-800 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 font-bold text-xs shrink-0 hover:scale-[1.01]"
              title="Exportar Libro Diario"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={() => { loadTransactions(); loadAccounts(); }}
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white transition-all flex items-center justify-center shrink-0"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTransactions ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </div>

          {/* BOOKKEEPING TRANSACTIONS LIST */}
          <div className="space-y-4">
            {loadingTransactions && transactions.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">Cargando Libro Diario...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 p-12 text-center text-zinc-500 text-sm">
                No se encontraron asientos contables registrados.
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const status = getTransactionStatus(tx);
                const isExpanded = expandedTxId === tx.id;
                
                // Summarize total debt and credit for this transaction
                const txDebe = tx.accounting_entries?.reduce((s, e) => s + Number(e.debe || 0), 0) || 0;
                const txHaber = tx.accounting_entries?.reduce((s, e) => s + Number(e.haber || 0), 0) || 0;

                return (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 overflow-hidden hover:border-zinc-700/60 transition-all"
                  >
                    {/* Header Row clickable */}
                    <div
                      onClick={() => toggleTxExpanded(tx.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/10 select-none"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xxs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                            {tx.id}
                          </span>
                          {tx.canal === "interno" && (
                            <span className="text-xxs px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 font-bold">
                              Caja Negra
                            </span>
                          )}
                          <span className={`text-xxs px-2 py-0.5 rounded-full border ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white leading-snug">{tx.description}</h4>
                      </div>

                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="flex gap-4 text-xxs font-mono text-zinc-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            {new Date(tx.date).toLocaleDateString("es-AR")}
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500">Monto:</span> ${txDebe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Trash button to delete transaction */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTx(tx.id);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar asiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Entries Panel */}
                    {isExpanded && (
                      <div className="border-t border-zinc-900 bg-zinc-900/10 px-4 py-3">
                        {!tx.accounting_entries || tx.accounting_entries.length === 0 ? (
                          <div className="text-center py-4 text-xs text-red-400 flex items-center justify-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Este asiento está vacío. No posee líneas contables de Debe ni Haber.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xxs font-mono text-zinc-300">
                              <thead>
                                <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-wider text-xxs">
                                  <th className="pb-2 font-semibold">Código</th>
                                  <th className="pb-2 font-semibold">Cuenta Contable</th>
                                  <th className="pb-2 font-semibold text-right pr-4">Debe</th>
                                  <th className="pb-2 font-semibold text-right">Haber</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tx.accounting_entries.map((entry) => (
                                  <tr key={entry.id} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/5">
                                    <td className="py-2.5 text-zinc-400">{entry.account_code}</td>
                                    <td className="py-2.5 text-white font-medium">
                                      {entry.accounting_accounts?.name || "Cuenta no especificada"}
                                    </td>
                                    <td className="py-2.5 text-right text-emerald-400 pr-4 font-medium">
                                      {Number(entry.debe) > 0
                                        ? `$${Number(entry.debe).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                                        : "—"}
                                    </td>
                                    <td className="py-2.5 text-right text-amber-500 font-medium">
                                      {Number(entry.haber) > 0
                                        ? `$${Number(entry.haber).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="border-t border-zinc-800 font-bold bg-zinc-900/20">
                                  <td colSpan={2} className="py-2.5 text-right text-white uppercase tracking-wider pr-4">
                                    Totales:
                                  </td>
                                  <td className="py-2.5 text-right text-emerald-400 pr-4">
                                    ${txDebe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 text-right text-amber-500">
                                    ${txHaber.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "coa" && (
        <div className="space-y-6">
          {/* EDUCATIONAL GLOSSARY CARD */}
          <div className="p-6 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/40 via-zinc-950/20 to-zinc-900/10 backdrop-blur-xl space-y-4">
            <h3 className="text-base font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              ¿Qué es y cómo funciona el Plan de Cuentas?
            </h3>
            <p className="text-sm text-zinc-200 leading-relaxed">
              El <strong>Plan de Cuentas</strong> es la estructura organizativa y jerárquica de la contabilidad de tu empresa. Define cómo se agrupan los hechos económicos para generar los reportes contables oficiales.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 pt-2">
              <div className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 space-y-1.5 hover:bg-emerald-500/10 transition-all duration-300">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Activos</span>
                <span className="text-xs text-zinc-400 leading-relaxed block">Bienes, derechos y recursos económicos de la empresa (Caja, Bancos, Mercaderías, Autos).</span>
              </div>
              <div className="p-4 rounded-xl border border-rose-500/15 bg-rose-500/5 space-y-1.5 hover:bg-rose-500/10 transition-all duration-300">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">Pasivos</span>
                <span className="text-xs text-zinc-400 leading-relaxed block">Obligaciones y deudas de la empresa con terceros (Proveedores, Impuestos a pagar).</span>
              </div>
              <div className="p-4 rounded-xl border border-purple-500/15 bg-purple-500/5 space-y-1.5 hover:bg-purple-500/10 transition-all duration-300">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">Patrimonio Neto</span>
                <span className="text-xs text-zinc-400 leading-relaxed block">Aporte de los socios y los resultados acumulados de ejercicios anteriores.</span>
              </div>
              <div className="p-4 rounded-xl border border-blue-500/15 bg-blue-500/5 space-y-1.5 hover:bg-blue-500/10 transition-all duration-300">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Ingresos</span>
                <span className="text-xs text-zinc-400 leading-relaxed block">Entradas de dinero generadas por la actividad comercial (Venta de repuestos).</span>
              </div>
              <div className="p-4 rounded-xl border border-amber-500/15 bg-amber-500/5 space-y-1.5 hover:bg-amber-500/10 transition-all duration-300">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Egresos / Gastos</span>
                <span className="text-xs text-zinc-400 leading-relaxed block">Costo de mercadería vendida y gastos operativos (Servicios, Alquileres, Sueldos).</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-300 leading-relaxed flex items-start gap-2.5">
              <span className="text-amber-500 font-extrabold block mt-0.5 text-sm">ℹ️ Nota sobre Cuentas Imputables:</span>
              <span>
                Las cuentas marcadas como <strong>Imputables</strong> son aquellas de último nivel (hojas del árbol jerárquico). Solo en estas cuentas se pueden registrar movimientos en el Libro Diario o Asientos Manuales. Las cuentas superiores son de agrupación y acumulación de saldos.
              </span>
            </div>
          </div>

          {/* SEARCH BAR FOR COA */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar cuentas por código o nombre (Ej: 1.1.1.01)..."
              value={coaSearch}
              onChange={(e) => setCoaSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/30 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* COA LIST (TREE STRUCTURE STYLE) */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/20 p-4 max-h-[600px] overflow-y-auto space-y-1.5 select-none scrollbar-thin">
            {loadingAccounts && accounts.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">Cargando Plan de Cuentas...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No se encontraron cuentas contables.</div>
            ) : (
              filteredAccounts.map((acc) => {
                const styles = getAccountTypeStyles(acc.type);
                const dotsCount = (acc.code.match(/\./g) || []).length;
                const isLeaf = dotsCount >= 3;

                return (
                  <div
                    key={acc.code}
                    className={`flex items-center justify-between gap-4 transition-all py-1 px-3 rounded-lg hover:bg-zinc-900/20 ${getCoaIndentation(
                      acc.code
                    )}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-500 tracking-wider font-semibold text-xs">
                        {acc.code}
                      </span>
                      <span className="font-semibold text-sm tracking-wide">{acc.name}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-md font-extrabold uppercase tracking-wider border ${styles}`}>
                        {translateAccountType(acc.type)}
                      </span>
                      {isLeaf && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-400 font-bold">
                          Imputable
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "manual" && (
        <form onSubmit={handleSubmitManual} className="space-y-6">
          {/* HEADER INPUTS FOR FORM */}
          <div className="grid gap-6 md:grid-cols-3 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-xl">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Concepto del Asiento</label>
              <input
                type="text"
                placeholder="Ej: Pago de servicio de luz mensual sucursal norte"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500 transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Fecha Contable</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-white text-sm focus:outline-none focus:border-amber-500 transition-all font-mono"
                required
              />
            </div>
          </div>

          {/* DYNAMIC ENTRIES LINES FORM GRID */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Líneas de Asiento (Partida Doble)</h3>
              <button
                type="button"
                onClick={addEntryRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-amber-500" />
                Añadir Línea
              </button>
            </div>

            <div className="space-y-3">
              {manualEntries.map((entry, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row gap-3 p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/20 items-end md:items-center justify-between"
                >
                  {/* Account Selector */}
                  <div className="w-full md:flex-1 space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                      Línea {index + 1}: Cuenta Contable
                    </label>
                    <select
                      value={entry.account_code}
                      onChange={(e) => updateEntryRow(index, "account_code", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 text-xs focus:outline-none focus:border-amber-500 transition-all"
                      required
                    >
                      <option value="" disabled>Seleccione cuenta imputable...</option>
                      {accounts
                        // Show all accounts or prioritize leaves
                        .map((acc) => (
                          <option key={acc.code} value={acc.code} className="bg-zinc-950 py-1 font-mono">
                            {acc.code} — {acc.name} ({acc.type.toUpperCase()})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Debe */}
                  <div className="w-full md:w-36 space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wide">Debe ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={entry.debe}
                      onChange={(e) => updateEntryRow(index, "debe", e.target.value)}
                      disabled={entry.haber !== ""}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-emerald-400 placeholder-zinc-650 text-xs focus:outline-none focus:border-emerald-500 transition-all text-right font-mono"
                    />
                  </div>

                  {/* Haber */}
                  <div className="w-full md:w-36 space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-amber-550 uppercase tracking-wide">Haber ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={entry.haber}
                      onChange={(e) => updateEntryRow(index, "haber", e.target.value)}
                      disabled={entry.debe !== ""}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-amber-500 placeholder-zinc-650 text-xs focus:outline-none focus:border-amber-550 transition-all text-right font-mono"
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => removeEntryRow(index)}
                    className="p-2 rounded-xl text-zinc-550 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent md:mt-5"
                    title="Eliminar fila"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM FORM BALANCING RUNNING TOTALS MONITOR */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 gap-4">
            <div className="flex flex-wrap gap-6 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Total Debe:</span>{" "}
                <span className="text-emerald-400 font-bold">${formTotalDebe.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Total Haber:</span>{" "}
                <span className="text-amber-500 font-bold">${formTotalHaber.toFixed(2)}</span>
              </div>
              <div className="border-l border-zinc-800 pl-6">
                <span className="text-zinc-550">Diferencia:</span>{" "}
                <span className={`font-bold ${formDifference < 0.01 ? "text-emerald-400" : "text-amber-500"}`}>
                  ${formDifference.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
              {formTotalDebe > 0 && (
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                  isFormBalanced
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                }`}>
                  {isFormBalanced ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Balanceado
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Desbalanceado
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!isFormBalanced || isSubmitting}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isFormBalanced && !isSubmitting
                    ? "bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20 hover:scale-[1.02]"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
                }`}
              >
                {isSubmitting ? "Registrando..." : "Registrar Asiento Manual"}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === "alicuotas" && (
        <div className="space-y-6">
          {/* HEADER OPTIONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-zinc-400 text-sm">
              Lista de alícuotas configuradas en el sistema para la facturación fiscal.
            </div>
            <button
              onClick={openNewAlicuota}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/10 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Nueva Alícuota
            </button>
          </div>

          {/* ALICUOTAS TABLE */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/20 overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/10 text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-4">Código AFIP</th>
                    <th className="p-4">Descripción</th>
                    <th className="p-4">Porcentaje</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAlicuotas && alicuotas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        Cargando alícuotas...
                      </td>
                    </tr>
                  ) : alicuotas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        No hay alícuotas registradas en la base de datos.
                      </td>
                    </tr>
                  ) : (
                    alicuotas.map((rate) => (
                      <tr
                        key={rate.codigo_afip}
                        className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-900/10 transition-all"
                      >
                        <td className="p-4 font-mono text-zinc-400 text-xs">
                          {rate.codigo_afip}
                        </td>
                        <td className="p-4 font-semibold text-white">
                          {rate.descripcion}
                        </td>
                        <td className="p-4 font-mono text-white text-xs">
                          {rate.porcentaje}%
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleAlicuota(rate.codigo_afip, rate.activa)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                              rate.activa
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-zinc-800 border-zinc-700 text-zinc-500"
                            }`}
                          >
                            {rate.activa ? "Activa" : "Inactiva"}
                          </button>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditAlicuota(rate)}
                              className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition-all"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteAlicuota(rate.codigo_afip)}
                              className="p-2 rounded-lg border border-zinc-850 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 hover:border-rose-500/10 transition-all"
                              title="Eliminar alícuota"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC MODAL FOR ALICUOTA FORM */}
      {isAlicuotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-scale-up space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-base font-extrabold text-white">
                {editingAlicuota ? "Editar Alícuota" : "Nueva Alícuota"}
              </h3>
              <button
                onClick={() => setIsAlicuotaModalOpen(false)}
                className="text-zinc-550 hover:text-white transition-all text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAlicuota} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Código AFIP
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  disabled={editingAlicuota !== null}
                  value={formCodigoAfip}
                  onChange={(e) => setFormCodigoAfip(e.target.value)}
                  placeholder="Ej: 5 (para 21%)"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Descripción
                </label>
                <input
                  type="text"
                  required
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Ej: IVA 21%"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-white placeholder-zinc-650 text-xs focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Porcentaje (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={formPorcentaje}
                  onChange={(e) => setFormPorcentaje(e.target.value)}
                  placeholder="Ej: 21"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b border-zinc-900/50">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Habilitar alícuota en POS
                </span>
                <button
                  type="button"
                  onClick={() => setFormActiva(!formActiva)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    formActiva
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}
                >
                  {formActiva ? "Activa" : "Inactiva"}
                </button>
              </div>

              <div className="flex items-center gap-3 pt-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAlicuotaModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/15"
                >
                  {editingAlicuota ? "Guardar Cambios" : "Crear Alícuota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EXPORT OPTIONS MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-scale-up space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-extrabold text-white">
                  Exportar Libro Diario
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-zinc-550 hover:text-white transition-all text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed text-left">
                Vas a exportar los asientos contables registrados del Libro Diario a un archivo de planilla de cálculo compatible con **Microsoft Excel, Google Sheets y LibreOffice**.
              </p>

              {/* Indicator of Search filter active */}
              {ledgerSearch && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400 leading-normal flex items-start gap-2">
                  <span className="font-extrabold block shrink-0">⚠️ Filtro Activo:</span>
                  <span className="text-left">
                    El reporte exportará únicamente las transacciones que coincidan con la búsqueda actual: <strong>&quot;{ledgerSearch}&quot;</strong>.
                  </span>
                </div>
              )}
            </div>

            {/* Checkbox selector */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 text-left">
                  <label className="text-xs font-extrabold text-zinc-200 block uppercase tracking-wider">
                    Subdiario Auxiliar
                  </label>
                  <span className="text-[10px] text-zinc-500 block">
                    Incluir asientos del Diario Auxiliar (gestión de preventa)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIncludeCajaNegraInExport(!includeCajaNegraInExport)}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
                    includeCajaNegraInExport
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400 font-extrabold"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}
                >
                  {includeCajaNegraInExport ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
                      <span>Incluido</span>
                    </>
                  ) : (
                    <span>Excluido</span>
                  )}
                </button>
              </div>

              {/* Warning/Attention notification depending on choice */}
              {includeCajaNegraInExport ? (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-[10px] text-purple-300 leading-normal text-left">
                  <span className="font-bold uppercase tracking-wider block mb-1">📢 Atención — Reporte Consolidado (General + Auxiliar):</span>
                  El archivo final contendrá transacciones contables del Diario General y del Subdiario Auxiliar. **No utilices este reporte consolidado para presentaciones fiscales ante entes recaudadores**.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[10px] text-emerald-400 leading-normal text-left">
                  <span className="font-bold uppercase tracking-wider block mb-1">✅ Reporte Estándar (Diario General):</span>
                  El archivo final contiene únicamente los asientos contables del Diario General estándar. Este reporte ha sido sanitizado y es apto para conciliaciones contables legales.
                </div>
              )}
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-3 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleExportLedgerToExcel}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/10 hover:scale-[1.02]"
              >
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
