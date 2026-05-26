# Especificación Técnica: Filtro de Rango de Fechas Persistente GMT-3 Argentina

Este documento define la especificación técnica, diseño de base de datos, algoritmos de conversión de zona horaria y arquitectura de persistencia para el sistema de **Filtro de Rango de Fechas Persistente** configurado para la **República Argentina (GMT-3)**.

---

## 1. Justificación y Objetivos

En sistemas ERP y contables multiempresa, los informes financieros (Libro Diario, Libro IVA, balances de cuentas corrientes) deben ser consistentes e inmunes a los desfases del huso horario local de la máquina del cliente o del servidor cloud (que suele estar en UTC). 

### Objetivos:
1.  **Uniformidad Horaria:** Garantizar que todas las fechas ingresadas en la UI se interpreten bajo la zona horaria oficial `America/Argentina/Buenos_Aires` (UTC-3 constante, sin horario de verano DST desde 2009).
2.  **Persistencia del Filtro:** Evitar que el usuario tenga que re-seleccionar las fechas cada vez que cambia de página (por ejemplo, de *Facturas* a *Contabilidad*).
3.  **Búsqueda Eficiente en Base de Datos (Server-Side):** Convertir rangos de días completos ingresados por el usuario (`DD/MM/YYYY`) en marcas de tiempo UTC ISO exactas para optimizar búsquedas por índices en Postgres.

---

## 2. Conversión Matemática y Utilitarios de Zona Horaria (GMT-3)

Para evitar inflar el bundle de la aplicación con librerías externas (como Moment.js o Luxon), utilizaremos la API estándar de JavaScript `Intl.DateTimeFormat`.

### Reglas de Conversión Contable:
*   Un día en Argentina comienza a las **`00:00:00.000`** local y termina a las **`23:59:59.999`** local.
*   Dado que Argentina es constantemente **UTC-3**, el desfase es siempre de +3 horas para llegar a UTC:
    *   `00:00:00` en Argentina equivale a las **`03:00:00`** UTC del mismo día.
    *   `23:59:59` en Argentina equivale a las **`02:59:59`** UTC del día siguiente.

### Algoritmo de Traducción `DD/MM/YYYY` a ISO UTC Bounds:
1.  Tomar la cadena ingresada por el usuario (ej: `"24/05/2026"`).
2.  Descomponer en Día: `24`, Mes: `05` (base 1), Año: `2026`.
3.  Para el límite inferior (Start):
    *   Crear la fecha local a las `00:00:00.000` en zona `America/Argentina/Buenos_Aires`.
    *   Generar su ISO string UTC: `"2026-05-24T03:00:00.000Z"`.
4.  Para el límite superior (End):
    *   Crear la fecha local a las `23:59:59.999` en zona `America/Argentina/Buenos_Aires`.
    *   Generar su ISO string UTC: `"2026-05-25T02:59:59.999Z"`.
5.  Estas dos cadenas ISO son las que se inyectan en las queries de Supabase:
    ```typescript
    query.gte("created_at", startISO).lte("created_at", endISO)
    ```

---

## 3. Arquitectura del Store Global Persistente (`useDateRangeStore`)

Utilizaremos **Zustand** con el middleware de persistencia en `localStorage`.

### Contrato de Estado (Types):

```typescript
export type QuickSelectOption = "este-mes" | "mes-anterior" | "ultimos-3-meses" | "personalizado";

export interface DateRangeState {
  startDate: string;      // Formato DD/MM/YYYY
  endDate: string;        // Formato DD/MM/YYYY
  quickSelect: QuickSelectOption;
  
  // Acciones
  setQuickSelect: (option: QuickSelectOption) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  resetToDefaults: () => void;
}
```

### Rangos Predeterminados (Cálculo Dinámico en GMT-3):
1.  **Este Mes:** Desde el primer día del mes actual a las `00:00:00` (hora AR) hasta el día de hoy a las `23:59:59` (hora AR).
2.  **Mes Anterior:** Desde el primer día del mes anterior (00:00:00 AR) hasta el último día del mes anterior (23:59:59 AR).
3.  **Últimos 3 Meses:** Desde 90 días atrás a las 00:00:00 AR hasta hoy a las 23:59:59 AR.

---

## 4. UI: Selector de Rango Obsidian Glassmorphism

El selector se ubica en el header global de la aplicación (al lado del panel de notificaciones) para asegurar que el contexto temporal esté siempre visible y editable.

### Especificaciones de Diseño de Interfaz:
*   **Gatillo (Trigger):** Botón oscuro y minimalista (`bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs font-semibold`) que muestra el rango activo (ej: `"Rango: 01/05/2026 - 24/05/2026"`).
*   **Panel Desplegable (Popover):** Con estética glassmorphism (`bg-zinc-950/95 backdrop-blur-md border border-zinc-850 p-4 rounded-2xl shadow-2xl`):
    *   **Grid de Selección Rápida:** Botones planos para *"Este mes"*, *"Mes anterior"* y *"Últimos 3 meses"* que marcan su estado activo con un sutil anillo ámbar.
    *   **Sección Personalizada:** Inputs numéricos formateados con máscara `dia/mes/año` (`DD/MM/YYYY`) con calendarios nativos o popups de selección directa.
    *   **Botón de Aplicar:** Con transición rápida para confirmar el cambio.

---

## 5. Integración con Base de Datos y APIs

Al cambiar el rango en el selector global, se notifica de forma reactiva a las páginas activas.

### Facturas (`arca_vouchers`)
El componente `FacturasPage` escucha el store:
```typescript
const { startDate, endDate } = useDateRangeStore();

useEffect(() => {
  // Traducir a UTC y disparar fetch
  const { startISO, endISO } = convertARDateToUTCBounds(startDate, endDate);
  fetchVouchers(startISO, endISO);
}, [startDate, endDate, activeCompany]);
```

### Contabilidad (`accounting_transactions`)
El Libro Diario filtra los asientos contables utilizando la misma lógica:
```typescript
// En accounting-service.ts
export async function getAccountingTransactionsFiltered(startDateISO: string, endDateISO: string) {
  return await client.database
    .from("accounting_transactions")
    .select(...)
    .gte("date", startDateISO)
    .lte("date", endDateISO);
}
```
