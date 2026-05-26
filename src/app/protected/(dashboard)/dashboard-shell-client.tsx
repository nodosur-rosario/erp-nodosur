"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/core/notification/toast";
import { useNotificationStore } from "@/core/notification/notification-store";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Coins,
  Calculator,
  TrendingUp,
  Settings,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  X,
  User,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Truck,
  FileText,
  Bell,
  Trash2,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { CompanyProfile } from "@/core/company/company-store";
import { useCompanyStore } from "@/core/company/company-store";
import { selectCompanyAction, clearCompanyAction } from "@/core/company/company-actions";
import { useSecretStore } from "@/features/sales/store/use-secret-store";
import { DateRangeSelector } from "@/core/components/date-range-selector";

interface DashboardShellClientProps {
  children: React.ReactNode;
  activeCompany: CompanyProfile;
  companies: CompanyProfile[];
  userData: any;
}

export function DashboardShellClient({
  children,
  activeCompany,
  companies,
  userData,
}: DashboardShellClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [flashEffect, setFlashEffect] = useState<"green" | "red" | null>(null);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const targetNode = event.target as Node;
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(targetNode)
      ) {
        setNotificationsOpen(false);
      }
      if (
        companyRef.current &&
        !companyRef.current.contains(targetNode)
      ) {
        setCompanyDropdownOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(targetNode)
      ) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearNotification = useNotificationStore((state) => state.clearNotification);
  const clearAllNotifications = useNotificationStore((state) => state.clearAll);
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  const setCompanyStore = useCompanyStore((state) => state.setCompany);
  const clearCompanyStore = useCompanyStore((state) => state.clearCompany);

  // Sync server activeCompany to client-side Zustand store on load/change
  useEffect(() => {
    setCompanyStore(activeCompany);
  }, [activeCompany, setCompanyStore]);

  const toggleCajaNegra = useSecretStore((state) => state.toggleCajaNegra);
  const showCajaNegra = useSecretStore((state) => state.showCajaNegra);

  // Global Secret Keyboard Shortcut Listener for Caja Negra (Ctrl + Shift + H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        toggleCajaNegra();
        
        // Discreta notificación visual (totalmente segura y minimalista ante miradas ajenas)
        if (!showCajaNegra) {
          toast.success("📈 Vista contable: Consolidada", { visual: true });
          setFlashEffect("red"); // Red when blackbox is active
        } else {
          toast.info("📊 Vista contable: Estándar", { visual: true });
          setFlashEffect("green"); // Green when standard mode is active
        }

        // Remove the visual flash effect after animation duration
        setTimeout(() => {
          setFlashEffect(null);
        }, 1200);

        // Forzar recarga de Server Components para reflejar filtros de canal
        router.refresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCajaNegra, toggleCajaNegra, router]);

  const handleCompanyChange = async (company: CompanyProfile) => {
    if (company.cuit === activeCompany.cuit) return;
    setCompanyDropdownOpen(false);
    toast.info(`Cambiando de empresa a ${company.razon_social}...`);

    // Reset the Zustand Caja Negra state so it's not carried over to the new company
    useSecretStore.getState().setShowCajaNegra(false);

    const result = await selectCompanyAction(company);
    if (result.success) {
      setCompanyStore(company);
      toast.success(`Entorno cambiado: ${company.nombre_fantasia || company.razon_social}`);
      
      // Forzar un reload completo de la ventana para reiniciar Zustand y rehidratar todo el árbol de forma limpia.
      // Esto previene que se mezclen datos en memoria entre empresas y evita bugs de hidratación en Next.js.
      window.location.href = "/protected";
    } else {
      toast.error(result.error || "No se pudo cambiar de empresa.");
    }
  };

  const handleClearCompany = async () => {
    toast.info("Cerrando sesión de empresa...");
    const result = await clearCompanyAction();
    if (result.success) {
      clearCompanyStore();
      window.location.href = "/protected/onboarding";
    } else {
      toast.error("Error al salir del entorno.");
    }
  };

  const handleLogout = async () => {
    toast.info("Cerrando sesión del ERP...");
    
    // Clear the company cookie
    await clearCompanyAction();
    
    // Call the sign-out POST endpoint to clear auth cookies and sign out from InsForge
    const response = await fetch("/auth/sign-out", { method: "POST" });
    
    if (response.ok) {
      toast.success("Sesión finalizada.");
      window.location.href = "/auth/sign-in";
    } else {
      toast.error("Error al cerrar sesión.");
    }
  };

  const menuItems = [
    { name: "Inicio / Resumen", href: "/protected", icon: LayoutDashboard },
    { name: "Inventario", href: "/protected/inventario", icon: Package },
    { name: "Ventas", href: "/protected/ventas", icon: ShoppingCart },
    { name: "Facturas", href: "/protected/facturas", icon: FileText },
    { name: "Clientes", href: "/protected/clientes", icon: Users },
    { name: "Proveedores", href: "/protected/proveedores", icon: Truck },
    { name: "Caja Diaria", href: "/protected/caja", icon: Coins },
    { name: "Contabilidad", href: "/protected/contabilidad", icon: Calculator },
    { name: "Reportes", href: "/protected/reportes", icon: TrendingUp },
    { name: "Configuración", href: "/protected/configuracion", icon: Settings },
  ];

  // AFIP cert indicator
  const hasAfipCert = activeCompany.afip_mode !== null;

  const isPending = (userData?.role || userData?.profile?.role) === "pending";

  if (isPending) {
    const encodedMsg = encodeURIComponent(
      `Hola! Acabo de registrarme en el ERP Nodo Sur con el email ${userData?.email || ""}. ¿Podrías habilitar mi rol de acceso por favor?`
    );
    const whatsappUrl = `https://wa.me/5493413192179?text=${encodedMsg}`;

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background obsidian dark aesthetics */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
        
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-6 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold tracking-tight text-white">
              Usuario sin permisos
            </h1>
            <p className="text-sm text-zinc-400">
              Tu cuenta ({userData?.email}) se encuentra pendiente de autorización por parte de soporte.
            </p>
          </div>
          
          <div className="pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 font-extrabold text-sm transition-all duration-205 shadow-lg shadow-amber-500/10"
            >
              <span>Contactar con Soporte</span>
            </a>
          </div>

          <div className="border-t border-zinc-800/60 pt-4 mt-2">
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition flex items-center gap-1.5 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/60 border-b border-zinc-800/80 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <Link href="/protected" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
              ERP NODO SUR
            </span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 px-3 py-1 text-xs text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            CUIT: {activeCompany.cuit}
          </span>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Active Company Selector */}
          <div className="relative" ref={companyRef}>
            <button
              onClick={() => {
                setCompanyDropdownOpen(!companyDropdownOpen);
                setProfileDropdownOpen(false);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-xs font-semibold"
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate">
                {activeCompany.nombre_fantasia || activeCompany.razon_social}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {companyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-800 p-2 shadow-2xl space-y-1 animate-fade-in z-50">
                <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/60">
                  Seleccionar Empresa
                </div>
                {companies.map((company) => (
                  <button
                    key={company.cuit}
                    onClick={() => handleCompanyChange(company)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-0.5 hover:bg-zinc-800/60 transition-colors ${
                      company.cuit === activeCompany.cuit ? "bg-amber-500/10 text-amber-300 font-semibold" : "text-zinc-300"
                    }`}
                  >
                    <span className="text-sm truncate">{company.nombre_fantasia || company.razon_social}</span>
                    <span className="text-xs text-zinc-500 font-mono">CUIT: {company.cuit}</span>
                  </button>
                ))}
                <div className="border-t border-zinc-800/60 pt-1 mt-1">
                  <button
                    onClick={handleClearCompany}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-between"
                  >
                    <span>Cambiar de Entorno</span>
                    <Building2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Global Datetime Filter Selector */}
          <DateRangeSelector />
          
          {/* Bell Notifications Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setCompanyDropdownOpen(false);
                setProfileDropdownOpen(false);
              }}
              className="p-2 rounded-full bg-zinc-800/40 border border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-700 hover:text-white transition-all relative group"
              title="Notificaciones"
            >
              <Bell className={`w-4 h-4 text-zinc-400 transition-transform group-hover:scale-110 ${unreadCount > 0 ? "animate-wiggle text-amber-400" : ""}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 font-black text-[9px] flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-zinc-900/95 border border-zinc-800 p-2 shadow-2xl space-y-2 animate-fade-in z-50 backdrop-blur-md max-h-[480px] flex flex-col">
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    15% { transform: rotate(-15deg); }
                    30% { transform: rotate(10deg); }
                    45% { transform: rotate(-10deg); }
                    60% { transform: rotate(5deg); }
                    75% { transform: rotate(-5deg); }
                  }
                  .animate-wiggle {
                    animation: wiggle 1.2s ease-in-out infinite;
                    transform-origin: top center;
                  }
                `}} />
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      Notificaciones
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                        {unreadCount} nuevas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {notifications.length > 0 && (
                      <>
                        <button
                          onClick={markAllAsRead}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition"
                        >
                          Marcar leídas
                        </button>
                        <span className="text-zinc-700 text-xs">•</span>
                        <button
                          onClick={clearAllNotifications}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-350 transition"
                        >
                          Limpiar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Body - Notifications List */}
                <div className="overflow-y-auto flex-1 space-y-1.5 max-h-[350px] pr-1 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-zinc-800/40 border border-zinc-800/60 flex items-center justify-center mx-auto text-zinc-650">
                        <Bell className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-zinc-500 font-semibold">No tenés notificaciones.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const Icon =
                        notif.type === "success"
                          ? ShieldCheck
                          : notif.type === "error"
                          ? ShieldAlert
                          : notif.type === "warning"
                          ? AlertTriangle
                          : Info;

                      const typeColor =
                        notif.type === "success"
                          ? "bg-green-500/10 border-green-500/20 text-green-400"
                          : notif.type === "error"
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : notif.type === "warning"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-blue-500/10 border-blue-500/20 text-blue-400";

                      return (
                        <div
                          key={notif.id}
                          onClick={() => markAsRead(notif.id)}
                          className={`group/item text-left p-3 rounded-lg border transition-all cursor-pointer relative flex gap-3 ${
                            notif.read
                              ? "bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-800/20 text-zinc-400"
                              : "bg-[#16161c]/80 border-zinc-800 hover:border-zinc-700 text-zinc-100 shadow-md shadow-black/5"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${typeColor}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-1 pr-6">
                            <p className="text-xs font-semibold leading-relaxed break-words">{notif.message}</p>
                            <p className="text-[9px] font-mono text-zinc-500">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          
                          {/* Close individual action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notif.id);
                            }}
                            className="absolute top-2 right-2 p-1 rounded hover:bg-zinc-800 text-zinc-650 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setProfileDropdownOpen(!profileDropdownOpen);
                setCompanyDropdownOpen(false);
                setNotificationsOpen(false);
              }}
              className="p-2 rounded-full bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              <User className="w-4 h-4 text-zinc-300" />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 p-2 shadow-2xl animate-fade-in z-50">
                <div className="px-3 py-2 border-b border-zinc-800/60">
                  <p className="text-sm font-semibold text-white truncate">{userData?.email || "Usuario"}</p>
                  <p className="text-xs text-zinc-500 capitalize">Rol: {userData?.role || userData?.profile?.role || "Vendedor"}</p>
                </div>
                <div className="p-1 space-y-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-between"
                  >
                    <span>Cerrar Sesión</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (Collapsible Solid Obsidian Flat) */}
        <aside
          className={`hidden md:flex flex-col bg-[#0f0f13] border-r border-[#1e1e24] p-4 space-y-6 transition-all duration-300 ease-in-out shrink-0 ${
            collapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Sidebar Toggle Header */}
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "justify-between"
            } pb-2 border-b border-[#1e1e24]/60`}
          >
            {!collapsed && (
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Navegación
              </span>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-white transition-all duration-200"
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {collapsed ? (
                <ChevronsRight className="w-4 h-4 text-amber-500" />
              ) : (
                <ChevronsLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* AFIP Status Box */}
          <div
            className={`rounded-xl border border-[#1e1e24] bg-[#121217] p-3 space-y-3 transition-all duration-300 ${
              collapsed ? "items-center flex flex-col justify-center" : ""
            }`}
          >
            {collapsed ? (
              <div className="relative group">
                <div
                  className={`p-1.5 rounded-lg ${
                    hasAfipCert
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
                >
                  {hasAfipCert ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5" />
                  )}
                </div>
                {/* Micro Tooltip */}
                <div className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl z-50">
                  AFIP: {hasAfipCert ? "Habilitado" : "Simulación"}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Servicio AFIP
                  </span>
                  {hasAfipCert ? (
                    <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
                      <ShieldCheck className="w-3 h-3" /> Producción
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                      <ShieldAlert className="w-3 h-3" /> Desconectado
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white leading-tight">
                    {activeCompany.nombre_fantasia || activeCompany.razon_social}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    CUIT: {activeCompany.cuit}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1.5">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 group border ${
                    active
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 border-transparent"
                  } ${collapsed ? "justify-center p-3" : "px-3 py-2.5 gap-3"}`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 duration-200 ${
                      active ? "text-amber-400" : "text-zinc-400"
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Footer */}
          <div
            className={`border-t border-[#1e1e24]/80 pt-4 flex items-center justify-between text-xs text-zinc-500 ${
              collapsed ? "flex-col gap-3 justify-center" : ""
            }`}
          >
            {collapsed ? (
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-zinc-800 hover:text-red-400 transition-colors bg-zinc-900/50 border border-zinc-800"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <div className="absolute left-12 bottom-2 ml-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl z-50">
                  Cerrar Sesión ({userData?.email})
                </div>
              </div>
            ) : (
              <>
                <span className="truncate max-w-[140px]">{userData?.email}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Mobile Sidebar Modal overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Overlay background */}
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Sidebar drawer content */}
            <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-zinc-950 border-r border-zinc-800 p-4 space-y-8 animate-slide-in">
              <div className="flex justify-between items-center">
                <span className="text-lg font-black tracking-tight text-white">
                  MENÚ ERP
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 space-y-1">
                {menuItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all group ${
                        active
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 border border-transparent"
                      }`}
                    >
                      <item.icon
                        className={`w-4 h-4 ${
                          active ? "text-amber-400" : "text-zinc-400"
                        }`}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User Footer */}
              <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-between text-xs text-zinc-500">
                <span className="truncate">{userData?.email}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-red-400"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Work Area - Refactored to max-w-[1400px] for widescreen high-density tables */}
        <main className="flex-1 overflow-auto p-6 sm:p-8">
          <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>

      {/* Secret Keyboard Shortcut Screen Flash Ambient Effect */}
      {flashEffect && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes pulse-flash {
              0% { opacity: 1; transform: scale(1.015); }
              100% { opacity: 0; transform: scale(1); }
            }
            .animate-pulse-flash {
              animation: pulse-flash 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}} />
          <div
            className={`pointer-events-none fixed inset-0 z-[99999] animate-pulse-flash border-[6px] ${
              flashEffect === "green"
                ? "border-green-500/25 shadow-[inset_0_0_120px_rgba(34,197,94,0.35)]"
                : "border-red-500/30 shadow-[inset_0_0_120px_rgba(239,68,68,0.4)]"
            }`}
          />
        </>
      )}
    </div>
  );
}
