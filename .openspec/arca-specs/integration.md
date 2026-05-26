# SPEC — ERP + ARCA Integration
**Stack:** Next.js 15.5 · TypeScript · Supabase · node-soap

---

## 1. Contexto del Proyecto

Sistema ERP a medida que integra los WebServices de **ARCA (ex-AFIP)** para facturación electrónica, remitos y consulta de padrón. La arquitectura corre sobre Next.js 15.5 con App Router, usando Supabase como base de datos serverless y un gateway interno para abstraer la complejidad SOAP.

---

## 2. Servicios ARCA a Integrar

| Servicio | WSDL Homologación | WSDL Producción | Uso |
|---|---|---|---|
| **WSAA** | `wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL` | `wsaa.afip.gov.ar/ws/services/LoginCms?WSDL` | Autenticación (Token + Sign) |
| **WSFE v1** | `wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL` | `servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL` | Facturas A, B, C, M |
| **WSREM** | `wswhomo.afip.gov.ar/wsRem/service?WSDL` | `servicios1.afip.gov.ar/wsRem/service?WSDL` | Remitos electrónicos |
| **Padrón A4** | `awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA4?WSDL` | `aws.afip.gov.ar/sr-padron/webservices/personaServiceA4?WSDL` | Consulta contribuyentes |

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────┐
│              Next.js 15.5 App Router            │
│                                                 │
│  Server Components  ──► Supabase (read)         │
│  Server Actions     ──► lib/arca/* ──► SOAP     │
│  Route Handlers     ──► lib/arca/* ──► SOAP     │
│                                                 │
│  lib/arca/                                      │
│    wsaa.ts   → Token WSAA cacheado en Supabase  │
│    wsfe.ts   → Facturas electrónicas            │
│    wsrem.ts  → Remitos electrónicos             │
│    padron.ts → Consulta de CUIT                 │
└──────────────────────┬──────────────────────────┘
                       │ SOAP/XML
               ┌───────▼──────┐
               │     ARCA     │
               │  WSAA / WSFE │
               │  WSREM / PAD │
               └──────────────┘
```

---

## 4. Estructura de Carpetas

```
arca-erp/
├── app/
│   ├── (erp)/
│   │   ├── facturas/
│   │   │   ├── page.tsx              # Server Component — lista
│   │   │   ├── nueva/page.tsx        # Client Component — formulario
│   │   │   └── [id]/page.tsx         # Server Component — detalle
│   │   ├── remitos/
│   │   │   └── page.tsx
│   │   └── clientes/
│   │       └── page.tsx
│   ├── api/
│   │   └── arca/
│   │       ├── wsfe/route.ts         # POST /api/arca/wsfe
│   │       ├── wsrem/route.ts        # POST /api/arca/wsrem
│   │       └── padron/[cuit]/route.ts # GET /api/arca/padron/:cuit
│   └── actions/
│       ├── factura.actions.ts        # 'use server'
│       └── padron.actions.ts
│
├── lib/
│   ├── arca/
│   │   ├── wsaa.ts                   # Autenticación WSAA
│   │   ├── wsfe.ts                   # WSFE cliente + tipos
│   │   ├── wsrem.ts                  # WSREM cliente + tipos
│   │   └── padron.ts                 # Padrón cliente + tipos
│   └── supabase/
│       ├── server.ts                 # createServerClient (SSR)
│       └── client.ts                 # createBrowserClient
│
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
│
└── .env.local
```

---

## 5. Variables de Entorno

```bash
# ARCA / AFIP
ARCA_CUIT=20123456789
ARCA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
ARCA_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
NODE_ENV=development   # cambiar a production para endpoints reales

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> Los certificados deben obtenerse desde el portal ARCA → "Administración de Certificados Digitales". Generar CSR con openssl, subir, descargar `.crt`.

---

## 6. Schema de Base de Datos (Supabase)

```sql
-- Tokens WSAA (caché 12hs)
create table arca_tokens (
  servicio    text primary key,        -- 'wsfe', 'wsrem', 'ws_sr_padron_a4'
  token       text not null,
  sign        text not null,
  expira_en   timestamptz not null,
  updated_at  timestamptz default now()
);

-- Facturas emitidas
create table facturas (
  id           uuid primary key default gen_random_uuid(),
  punto_venta  int not null,
  tipo         int not null,           -- 1=A, 6=B, 11=C
  numero       bigint not null,
  cae          text,
  cae_vto      date,
  cuit_cliente text,
  importe      numeric(12,2),
  importe_neto numeric(12,2),
  importe_iva  numeric(12,2),
  estado       text default 'pendiente', -- pendiente | emitida | error
  payload_req  jsonb,                  -- request enviado
  payload_res  jsonb,                  -- respuesta ARCA
  created_at   timestamptz default now(),
  unique(punto_venta, tipo, numero)
);

-- Remitos emitidos
create table remitos (
  id          uuid primary key default gen_random_uuid(),
  numero      bigint,
  coe         text,                    -- Código de operación
  cuit_dest   text,
  estado      text default 'pendiente',
  payload_res jsonb,
  created_at  timestamptz default now()
);

-- Caché padrón
create table padron_cache (
  cuit        text primary key,
  razon_social text,
  domicilio   text,
  estado_afip text,
  categorias  jsonb,
  consultado_at timestamptz default now()
);

-- RLS: solo service role puede escribir tokens
alter table arca_tokens enable row level security;
alter table facturas enable row level security;
alter table remitos enable row level security;
alter table padron_cache enable row level security;
```

---

## 7. Flujo de Autenticación WSAA

```
1. Construir TRA (XML):
   <loginTicketRequest>
     <header>
       <uniqueId>epoch_seconds</uniqueId>
       <generationTime>ahora - 60s</generationTime>
       <expirationTime>ahora + 60s</expirationTime>
     </header>
     <service>wsfe</service>
   </loginTicketRequest>

2. Firmar TRA con certificado X.509 (PKCS#7 / CMS)
   → Usar node-forge: forge.pkcs7.createSignedData()
   → Encodear en Base64

3. Llamar WSAA: loginCms({ in0: cms_base64 })
   → Recibir: Token + Sign + ExpirationTime

4. Cachear en Supabase tabla arca_tokens
   → Reutilizar mientras expira_en > now()
   → Token válido por 12 horas
```

---

## 8. Dependencias del Proyecto

```json
{
  "dependencies": {
    "next": "^15.5.0",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "node-soap": "^1.x",
    "node-forge": "^1.x",
    "xmlbuilder2": "^3.x",
    "zod": "^3.x",
    "cockatiel": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x"
  }
}
```

---

## 9. Reglas de Negocio WSFE

| Campo | Valores posibles |
|---|---|
| `CbteTipo` | 1=Factura A, 6=Factura B, 11=Factura C, 51=Factura M |
| `Concepto` | 1=Productos, 2=Servicios, 3=Productos y Servicios |
| `DocTipo` | 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final |
| `MonId` | PES=Pesos, DOL=Dólar |
| `AlicIva.Id` | 3=0%, 4=10.5%, 5=21% |

- Consumidor Final (`DocTipo=99`): `DocNro=0`, solo Facturas B/C
- Fecha de comprobante: formato `YYYYMMDD`
- `ImpTotal = ImpNeto + ImpIVA + ImpTrib`

---

## 10. Restricciones de Runtime Next.js

> ⚠️ **CRÍTICO**: `node-soap` y `node-forge` requieren **Node.js runtime**.
> NUNCA agregar `export const runtime = 'edge'` en archivos que importen de `lib/arca/`.

```typescript
// ✅ Correcto — no declarar runtime (default = nodejs)
export async function POST(req: Request) { ... }

// ❌ Incorrecto — rompe node-soap
export const runtime = 'edge';
export async function POST(req: Request) { ... }
```

---

## 11. Convenciones de Código

- **Early return** en validaciones antes de llamar ARCA
- **Zod** para validar todos los inputs en Server Actions y Route Handlers
- **cockatiel** para retry con backoff exponencial en llamadas SOAP
- `params` en Next.js 15.5 es **Promise** → siempre `await params`
- Server Components fetchean Supabase directamente (sin pasar por API interna)
- Clientes SOAP son **singletons** (una sola instancia por proceso)
- Tokens WSAA cacheados en Supabase, nunca en memoria volátil
- Certificados ARCA en variables de entorno, nunca en el repositorio

---

## 12. Checklist de Setup

- [ ] Crear proyecto Supabase y correr migración `001_initial.sql`
- [ ] Generar CSR con openssl y obtener certificado en portal ARCA
- [ ] Habilitar servicios WSFE, WSREM, WS_SR_PADRON_A4 en ARCA
- [ ] Configurar `.env.local` con todas las variables
- [ ] Probar en homologación antes de apuntar a producción
- [ ] Configurar RLS en Supabase para producción
- [ ] Verificar que ningún route handler use `runtime = 'edge'`
