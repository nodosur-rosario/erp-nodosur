# Especificación Técnica: Integración Avanzada de Web Services ARCA / AFIP
Este documento define los estándares arquitectónicos, flujos criptográficos y casos de uso para la vinculación real con la Agencia de Recaudación y Control Aduanero (ARCA, ex AFIP) en el entorno de Homologación utilizando el CUIT del desarrollador.

---

## 1. Testing con CUIT Personal en Homologación (Desarrollo)

El ambiente de homologación (sandbox) de ARCA permite la total libertad de pruebas utilizando un CUIT/CUIL personal, sin ningún tipo de costo impositivo ni validez jurídica sobre los comprobantes emitidos.

### Acreditación y Validación de Entorno
* **CUIT de Testing Activo**: `20371024094`
* **Par de Claves**:
  * Clave Privada: `.cert/nodosur.key` (RSA 2048 bits) - **IGNORADO EN GIT**
  * Certificado X.509: `.cert/nodosur.crt` (Firmado por la autoridad fiscal de homologación) - **IGNORADO EN GIT**
* **Endpoint de Autenticación (WSAA Homologación)**:
  `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`
* **Validación de CAE**: Los comprobantes emitidos obtendrán un CAE real de pruebas y código de barras/código QR emulado o del servidor fiscal de homologación, pero no tienen validez legal.

---

## 2. Estándares de Seguridad de Credenciales

Siguiendo las mejores prácticas de la arquitectura Cloud y Serverless (Next.js en Vercel / Supabase), implementamos un esquema híbrido de seguridad para credenciales fiscales:

### A. Desarrollo Local (Aislamiento de Git)
* Se prohíbe terminantemente cometer archivos `.key`, `.crt`, `.pem` o `.csr` al control de versiones Git. La carpeta `.cert/` y los formatos correspondientes están bloqueados en el `.gitignore`.
* En entornos locales de desarrollo, las variables se inyectan mediante el archivo `.env.local`:
  ```bash
  ARCA_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpk...\n-----END RSA PRIVATE KEY-----"
  ARCA_CERTIFICATE="-----BEGIN CERTIFICATE-----\nMIIFnT...\n-----END CERTIFICATE-----"
  ```

### B. Producción / Multi-empresa (Almacenamiento Seguro Híbrido)
* Para soportar un ERP multi-empresa colocalizado, las credenciales no pueden vivir en variables de entorno globales.
* **Modelo Híbrido**: 
  1. Guardar las credenciales cifradas con AES-256-GCM en la tabla `arca_credentials` del backend Supabase.
  2. *(Opcional)* Almacenar los archivos certificados binarios en un **Bucket privado de Supabase Storage** con políticas de seguridad RLS ultra-estrictas que solo permitan el acceso mediante el rol del servidor de la distribuidora (`service_role` o validación por CUIT de la empresa en RLS).

---

## 3. Arquitectura de Caché de Tickets de Acceso (WSAA)
El Ticket de Acceso (TA) otorgado por el WSAA (Token y Sign) tiene una validez fija de 12 horas. Solicitar un ticket por cada factura emitida es un antipatrón grave: **ARCA bloquea IPs si detecta solicitudes redundantes en cortos periodos de tiempo**.

En entornos Serverless/Edge (Next.js), las variables globales en memoria RAM se pierden cuando las lambdas se apagan (Cold Starts). Por lo tanto, la caché debe persistirse en base de datos.

### Esquema de Base de Datos: `arca_access_tickets`
Crearemos una tabla para almacenar y compartir el ticket entre múltiples instancias Serverless de la API:

```sql
CREATE TABLE public.arca_access_tickets (
  cuit VARCHAR(11) PRIMARY KEY,
  service VARCHAR(20) NOT NULL, -- ej: 'wsfe', 'ws_sr_padron_a4'
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  expired_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_cuit_service UNIQUE (cuit, service)
);

-- Políticas RLS: Solo lectura/escritura interna del sistema (Service Role) o Admin
ALTER TABLE public.arca_access_tickets ENABLE ROW LEVEL SECURITY;
```

### Algoritmo de Consumo del WSAA con Caché
```mermaid
graph TD
    A[Requerimiento de Factura / Padrón] --> B{¿Existe ticket en arca_access_tickets?}
    B -->|Sí| C{¿expired_at > hora_actual + 15 min?}
    B -->|No| D[Llamar WSAA ARCA con openssl/CMS]
    C -->|Sí| E[Usar Token y Sign de Caché]
    C -->|No| D
    D --> F[Guardar nuevo Token y Sign en arca_access_tickets]
    F --> E
```

---

## 4. Mapa de Web Services Clave para ERP Autopartista

Para que un ERP de repuestos de alta densidad se destaque y ofrezca una experiencia premium, la facturación es solo el principio. Proponemos integrar tres Web Services esenciales de ARCA:

### WS 1: WSFE v1 — Facturación Electrónica (Núcleo)
* **Objetivo**: Emisión automatizada en mostrador.
* **Seguridad**: Inmutabilidad absoluta del JSONB en base de datos. Una vez obtenido el CAE, los ítems de `afip_vouchers.items` quedan congelados.

### WS 2: WSPUC — Padrón Único de Contribuyentes (UX de Alta Velocidad)
* **Objetivo**: Autocompletado instantáneo de clientes/proveedores en el POS.
* **Problema**: El cajero pierde tiempo tipeando Razón Social, Dirección, Condición de IVA y CUIT, cometiendo errores tipográficos graves que invalidan la Factura A.
* **Solución**: El cajero ingresa únicamente el CUIT y el ERP consulta al servicio `ws_sr_padron_a4` o `ws_sr_padron_a5` en tiempo real.
* **Endpoint Homologación**: `https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA4`

### WS 3: WSRG — Mis Comprobantes / Conciliación de Compras
* **Objetivo**: Automatizar la auditoría de compras.
* **Solución**: El ERP se conecta diariamente de forma silenciosa mediante un Cron al servicio de recepción de comprobantes de ARCA, descarga todas las facturas tipo A/B/C emitidas por terceros hacia el CUIT de la distribuidora y las contrasta contra el Libro Diario de Compras del ERP.

---

## 5. Tipado Estricto de Datos
Para blindar el código frontend y backend contra errores tipográficos en el manejo de esquemas SOAP crípticos de ARCA, se define un archivo de firma en `src/features/arca/types/afip.ts` que normalice las propiedades:

```typescript
export interface AFIPInvoiceRequest {
  CantReg: number;
  CbteTipo: number;  // 1 = Factura A, 6 = Factura B, etc.
  PtoVta: number;
  Concepto: number;  // 1 = Productos, 2 = Servicios, 3 = Mixto
  DocTipo: number;   // 80 = CUIT, 99 = Consumidor Final
  DocNro: number;
  ImpNeto: number;
  ImpIVA: number;
  ImpTotal: number;
}
```
