# Schema Audit — ERP ARCA / Supabase

## Problemas críticos (bloquean multi-tenant)

### 1. `customers` sin `company_cuit`
Tabla global. Cualquier empresa puede ver clientes de otra.
```sql
alter table public.customers
  add column company_cuit text not null references public.company_profile(cuit);
create index on public.customers(company_cuit);
```

### 2. Sin tabla `user_company_roles`
No existe vínculo usuario → empresa. Imposible resolver tenant desde sesión.
```sql
create type company_role as enum ('owner', 'admin', 'vendedor', 'contador', 'viewer');

create table public.user_company_roles (
  user_id      text not null references public.users(id) on delete cascade,
  company_cuit text not null references public.company_profile(cuit) on delete cascade,
  role         company_role not null default 'viewer',
  created_at   timestamptz default now(),
  primary key  (user_id, company_cuit)
);
create index on public.user_company_roles(company_cuit);
```

### 3. RLS ausente en tablas sensibles
Ninguna tabla tiene policies. Datos fiscales y contables expuestos.
```sql
-- Helper: resuelve el CUIT de la empresa desde el JWT
create or replace function auth.company_cuit()
returns text language sql stable as $$
  select (auth.jwt() ->> 'company_cuit')
$$;

-- Aplicar en: arca_vouchers, accounting_transactions, accounting_entries,
-- caja_sesion, caja_movimiento, customer_credit_accounts, customer_credit_movements
alter table public.afip_vouchers enable row level security;
create policy "tenant_isolation" on public.afip_vouchers
  for all using (company_cuit = auth.company_cuit());
-- replicar mismo patrón en el resto
```

---

## Problemas mejorables (no bloquean, escalan mal)

### 4. `articulo` e `inventory` solapados
Dos tablas de productos con campos duplicados (`stock`, `precio`/`sale_price`, `iva`).
Acción: agregar columnas faltantes a `articulo`, migrar datos, dropear `inventory`.
```sql
alter table public.articulo
  add column sku          text unique,
  add column alicuota_iva integer references public.alicuota_iva(codigo_afip),
  add column company_cuit text references public.company_profile(cuit);
-- luego: INSERT INTO articulo SELECT ... FROM inventory; DROP TABLE inventory;
```

### 5. Nomenclatura `afip_` vs `arca_` inconsistente
`afip_vouchers` convive con `arca_credentials` y `arca_access_tickets`.
```sql
alter table public.afip_vouchers rename to arca_vouchers;
alter table public.arca_vouchers rename column cae_expiration to cae_vto;
```

### 6. PKs heterogéneas sin criterio
- `accounting_entries`: `integer` + `nextval` → migrar a `uuid`
- `customers`, `inventory`: `text` como PK → aceptable si es clave natural, documentar intención
- Regla a aplicar: entidades de negocio = `uuid default gen_random_uuid()`

---

## Lo que está bien — no tocar

| Tabla | Por qué está bien |
|---|---|
| `arca_access_tickets` | PK compuesta `(cuit, service)`, caché de tokens correcto |
| `caja_sesion` / `caja_movimiento` | `CHECK constraints` en tipo y monto, relación bien modelada |
| `accounting_transactions` + `accounting_entries` | Doble entrada correcta, campo `canal` para oficial/negro |
| `alicuota_iva` | Tabla de referencia con `codigo_afip` como PK natural |
| `articulo_compatibilidad` | PK compuesta correcta `(articulo_id, auto_version_id)` |

---

## Orden de ejecución recomendado

```
1. user_company_roles          ← sin esto nada de lo demás funciona
2. customers.company_cuit      ← dato crítico para aislamiento
3. RLS en todas las tablas     ← antes de cualquier deploy productivo
4. unificar articulo+inventory ← requiere migración de datos
5. renombrar afip_ → arca_     ← breaking change, coordinar con código
6. normalizar PKs              ← último, mayor riesgo de regresión
```

---

## Contexto del proyecto

- Stack: Next.js 15.5 · TypeScript · Supabase · node-soap
- Servicios ARCA: WSFE, WSREM, WS_SR_PADRON_A4
- Estrategia multi-tenant futura: schema-per-tenant via función `create_tenant()`
- Auth: Supabase Auth con `company_cuit` en JWT claims del usuario
- Runtime: Node.js obligatorio (no Edge) por uso de node-soap y node-forge
