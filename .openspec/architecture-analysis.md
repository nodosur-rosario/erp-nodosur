# Análisis Arquitectónico y Puntos de Mejora - ERP Nodo Sur

**Fecha:** Junio 2026  
**Analista:** Antigravity (Senior Architect / Engram MCP)  
**Objetivo:** Evaluación integral de la lógica de *data-fetching*, manejo de estado local y renderizado de tablas en el ERP, con foco en escalabilidad.

---

## 1. Diagnóstico Actual (Status Quo)

Tras auditar la base de código (especialmente módulos críticos como `facturas/page.tsx`, `ventas/page.tsx` y el manejo de inventario), se identifican los siguientes patrones dominantes:

### Puntos Fuertes
- **Zustand para Estado Global:** Excelente decisión. El uso de `useCompanyStore`, `useSecretStore` y `useDateRangeStore` mantiene el estado global desacoplado y veloz.
- **Supabase Nativo:** La interacción directa mediante `supabase.from()` elimina capas intermedias innecesarias.
- **Componentización:** El código está bien segmentado en `features/` y `core/`.

### Puntos Flojos (Deuda Técnica Incipiente)
1. **Data Fetching Imperativo (`useEffect` + `useState`):** 
   - Actualmente, cada página declara sus propios estados `loading`, `error`, y `data`.
   - **Problema:** Mucho *boilerplate*. Si un usuario navega a otra página y vuelve, los datos se vuelven a pedir a la base de datos desde cero, generando tiempos de carga (spinners) innecesarios y consumo excesivo en Supabase.
   - **Riesgo:** *Race conditions* si el usuario cambia filtros rápidamente mientras las *promises* de `supabase.from()` siguen resolviendo.

2. **Falta de Caché Frontend:**
   - Supabase es rápido, pero hacer *round-trips* al servidor en cada renderizado de página afecta la percepción de velocidad (UX) y escala los costos de lectura a medida que crecen las sucursales y la data histórica.

3. **Renderizado de Tablas Manual:**
   - Las grillas de datos (facturas, stock, clientes) se construyen iterando arrays (`.map()`) de forma nativa.
   - **Problema:** La ordenación (*sorting*), filtrado múltiple y la paginación implican reescribir lógica compleja en cada componente. Además, ante miles de artículos en inventario, el DOM colapsará sin virtualización.

---

## 2. Evaluación de Nuevas Tecnologías

### 2.1 TanStack Query (React Query)
*¿Es necesario?* **Absolutamente SÍ.**
Como el ERP depende 100% de operaciones de red hacia Supabase (no hay una API propia en el medio, sino Serverless directo), TanStack Query actúa como el orquestador perfecto:
- **Caché Inteligente:** Si un usuario vuelve a "Facturas", ve la data instantáneamente desde la caché mientras React Query re-valida en segundo plano (*stale-while-revalidate*).
- **Mutaciones Optimistas:** Al emitir un comprobante o descontar stock, la UI puede reaccionar instantáneamente antes de que Supabase confirme, dando una sensación de extrema fluidez.
- **Integración con Supabase:** Se integra perfectamente agrupando las llamadas `supabase.from().select()`.
- **Veredicto:** **Recomendación CRÍTICA.** Reemplazar los `useEffect` de carga de datos por *Custom Hooks* (ej: `useInvoices`, `useInventory`).

### 2.2 TanStack Table
*¿Es necesario?* **Altamente Recomendable para el Core.**
- Un ERP es esencialmente "CRUDs y Tablas complejas".
- TanStack Table es *headless* (no impone estilos), lo que permite seguir usando Tailwind y la estética de Nodo Sur (`Deep Space`, `Midnight Blue`, etc.).
- Resuelve nativamente: Paginación, ordenamiento por columnas, filtrado global/por columna y selección de filas.
- **Veredicto:** **Recomendación FUERTE.** Empezar migrando las tablas más pesadas (Inventario/Catálogo) y las de mayor interacción (Facturas/Reconciliación AFIP).

### 2.3 Utilidades Recomendadas
- **`@supabase/ssr` (si no se usa plenamente):** Asegurar que las validaciones de sesión ocurran en el Servidor (Next.js Middleware/Server Components) antes de mandar al cliente.
- **Virtualización (`@tanstack/react-virtual`):** Crucial para el Catálogo Autopartista si se renderizan listas desplegables con miles de equivalencias.

---

## 3. Plan de Acción (Roadmap de Refactorización)

1. **Instalación:** Agregar `@tanstack/react-query` y `@tanstack/react-table`.
2. **Provider:** Envolver el `<AppRouter>` con el `QueryClientProvider` en el `layout.tsx` principal.
3. **Refactor Piloto (Módulo Facturas):**
   - Eliminar `useState` de `vouchers` y `loading`.
   - Crear el hook `useGetVouchers(company_cuit, dateRange)`.
   - Implementar TanStack Table para la grilla de comprobantes.
4. **Despliegue Progresivo:** Aplicar el mismo patrón al módulo de Ventas e Inventario.

> **Nota de Arquitectura:** Este refactor NO cambia la lógica de negocio ni las reglas de AFIP, solo cambia *cómo* el frontend solicita, retiene y muestra esa información, llevando el ERP a un estándar Enterprise.
