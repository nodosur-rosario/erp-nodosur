# Storytelling: Evolución del ERP Nodo Sur

*Este documento ha sido redactado para brindar a futuros agentes de IA y desarrolladores un entendimiento profundo sobre el camino evolutivo, las decisiones arquitectónicas y la maduración técnica del ERP Nodo Sur.*

---

## 🚀 El Origen: Un Sistema para Autopartistas Argentinas
El **ERP Nodo Sur** nació con el propósito de resolver las problemáticas complejas del comercio de distribución y venta de autopartes en Argentina. Desde el principio, la arquitectura fue concebida con un principio fundamental: **robustez extrema y velocidad**.

El stack técnico base se definió sobre:
*   **Frontend / Core:** Next.js 16, React 19, TypeScript y Bun.
*   **Base de Datos / Backend:** Supabase (Postgres) Serverless nativo.
*   **Estilos:** TailwindCSS v3.4 con un design system plano y oscuro, evitando la migración a Tailwind v4 por razones de estabilidad corporativa.

---

## 📈 La Evolución Técnica: Hitos de Ingeniería

### Hito 1: Securización de Datos Multitenant (RLS Riguroso)
En sistemas multiempresa, la filtración de datos fiscales es inaceptable.
*   **El Problema:** La base de datos Supabase compartía registros y dependía únicamente de filtros del lado del cliente.
*   **La Solución:** Implementamos políticas estrictas de **Row Level Security (RLS)** en Supabase. Creamos un mapeo dinámico en la tabla `user_company_roles`. A partir de ese momento, cada consulta sobre tablas multiempresa (como `arca_credentials`, `customers`, `customer_credit_accounts`, `accounting_transactions`) quedó blindada directamente en Postgres, forzando la validación del CUIT corporativo del usuario activo.

### Hito 2: Integración Fiscal ARCA/AFIP y Caché de Tickets WSAA
El ERP se conecta de manera directa con los WebServices de ARCA (ex-AFIP) para emitir facturas y remitos electrónicos.
*   **El Problema:** Consultar el WebService de Autenticación de AFIP (WSAA) por cada factura ralentizaba el POS y consumía recursos innecesarios, además de poder bloquear credenciales por exceso de peticiones.
*   **La Solución:** Desarrollamos un adaptador de firma criptográfica X.509 y un **sistema de caché de tickets de acceso**. Los tokens WSAA ahora se persisten en Supabase y se reutilizan de forma segura durante su ventana de validez de 12 horas. Además, implementamos un entorno de **Edge Simulation** local de alto rendimiento que simula de forma exacta el comportamiento físico del WSAA y WSFE de AFIP para desarrollo sin necesidad de credenciales reales de producción.

### Hito 3: Garantía de Partida Doble en Asientos Contables
La consistencia del módulo contable no se puede delegar únicamente al frontend.
*   **El Problema:** Las llamadas asíncronas podían insertar líneas en el Libro Diario quedando desbalanceadas si una inserción fallaba a mitad de camino, rompiendo el principio contable fundamental de partida doble.
*   **La Solución:** Escribimos un **trigger diferido en Postgres (`trg_validar_balance_asiento`)** que se dispara al finalizar toda transacción de inserción. Si la suma del Debe no es exactamente igual a la suma del Haber (`SUM(debe) == SUM(haber)`) para un asiento, la base de datos aborta y realiza un rollback atómico completo de la transacción.

### Hito 4: Sistema de Notificaciones Anti-Acumulación (Anti-Stacking UX)
Con el ERP operando a gran velocidad, los avisos en pantalla comenzaron a molestar a los cajeros.
*   **El Problema:** Al presionar atajos rápidamente o dispararse eventos en cascada, las notificaciones emergentes (toasts) se apilaban tapando la pantalla, arruinando la ergonomía de venta.
*   **La Solución:** Diseñamos un **Middleware de Debounce Temporal de 2 segundos** en un wrapper de Sonner personalizado. Si un mensaje con la misma categoría de gravedad se intenta disparar múltiples veces dentro de esta ventana deslizante, el sistema lo bloquea visualmente. Todo esto está coordinado con un **Store unificado en Zustand** que guarda el historial de hasta 50 notificaciones en una campana con animaciones de vibración interactiva (`animate-wiggle`) en el header del panel.

### Hito 5: Captura Elegante de Errores Fiscales y Supresión de Overlays
En el entorno de desarrollo y pruebas, los errores simulados de AFIP hacían colapsar Next.js.
*   **El Problema:** Cuando AFIP rechazaba una factura (por ejemplo, por CUIT inexistente o inconsistencia de alícuotas), el sistema arrojaba un error que Next.js interpretaba como un colapso crítico, tapando toda la pantalla con un overlay rojo de consola en modo de desarrollo.
*   **La Solución:** Refactorizamos el bloque `catch` del checkout del POS. Reemplazamos `console.error` con un `console.warn` diagnóstico, silenciando de raíz el overlay invasivo de Next.js. En su lugar, el POS captura los códigos del rechazo (como `10015` y `10243`), los separa y los expone en un **Modal de Depuración Fiscal Carmesí** extremadamente premium y minimalista, con la opción de copiar la traza al portapapeles.

### Hito 6: Filosofía de "Despacho Silencioso" y Efectos de Atajo Ambientales
Para llevar la experiencia de usuario a niveles de clase mundial:
*   **El Problema:** A pesar del debouncer, el surgimiento continuo de globos flotantes de éxito ("Cliente guardado", "Fila seleccionada") seguía interrumpiendo visualmente.
*   **La Solución:** Dividimos las notificaciones en dos flujos. Las de éxito e información ahora se despachan de forma **totalmente silenciosa**: se guardan directamente en la campana de historial y suman al badge del header sin arrojar popups en pantalla. Solo los errores críticos se muestran visualmente, utilizando un Toaster personalizado en `layout.tsx` con un diseño de glassmorphism oscuro extremadamente minimalista.
*   **Destello de Atajo:** Al pulsar el atajo secreto global `Ctrl + Shift + H` para ocultar o revelar la "caja negra" (ticket interno/consolidada), la pantalla entera emite un **efecto de destello ambiental** a través de un borde de color y una sombra interior difusa de 1.2 segundos: **rojo carmesí** cuando se activa el cobro por ticket interno (caja negra habilitada) y **verde esmeralda** al regresar a la facturación oficial (caja negra deshabilitada).

---

## 🛠️ Convenciones Críticas para Mantener

1.  **Strict TDD:** Ningún código core de contabilidad, cálculo de IVA o autenticación puede ser mergeado sin su prueba unitaria asociada. El suite se corre con `bun run test` (Vitest) y mantiene **93 pruebas verdes**.
2.  **Multitenancy Forzado:** Toda query a tablas contables, de facturación o cuentas corrientes debe filtrar estrictamente por el CUIT de la empresa activa (`company_cuit`) mediante políticas de RLS en Postgres o validaciones locales.
3.  **Huso Horario Uniforme:** Todo control de fechas y reportes del ERP debe alinearse estrictamente al huso horario de la **República Argentina (GMT-3 constant, America/Argentina/Buenos_Aires)**.
4.  **No dependencias innecesarias:** Mantener el bundle liviano utilizando las APIs nativas del lenguaje (`Intl` en lugar de Moment.js).
