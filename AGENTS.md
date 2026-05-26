# AGENTS.md — ERP Nodo Sur (Beast-Driven-Development)

> Este archivo es leído por Gentleman Guardian Angel (GGA) para validar staged files antes de cada commit.
> También sirve como referencia de estándares para cualquier agente IA que trabaje en este proyecto.

## Proyecto

**ERP Nodo Sur** — Sistema de gestión para distribuidoras de autopartes argentinas.
Stack: Next.js 16 + React 19 + TypeScript + Bun + TailwindCSS v3.4 / Supabase (Postgres)
Backend: Supabase (Serverless nativo)

---

## Estándares de Código

### TypeScript / React

- Componentes en PascalCase; hooks en camelCase con prefijo `use`.
- Props tipadas con interfaces explícitas; prohibido `any` sin comentario justificado.
- Server Components por defecto en Next.js App Router; `"use client"` solo cuando sea estrictamente necesario (interactividad, hooks de estado).
- Imports de Supabase Client siempre desde el módulo cliente/servidor del proyecto (`@/utils/supabase`).
- Verificar `error` antes de operar `data` en toda llamada Supabase: `const { data, error } = await supabase.from('tabla').select(...)`.

### CSS / Tailwind

- **TailwindCSS v3.4 BLOQUEADO** — no migrar a v4 bajo ninguna circunstancia.
- No usar estilos inline para layout; todo con clases Tailwind.
- Variables de color del design system en `tailwind.config.ts`; no hardcodear colores hex en componentes.



### Base de Datos

- INSERT/UPDATE en Supabase: formato array de objetos al insertar → `supabase.from('tabla').insert([{ ... }])`.
- Filtro multi-empresa SIEMPRE presente en queries de `afip_vouchers` y `accounting_*`: `.eq('company_cuit', cuit)`.
- Asientos contables: SUM(debe) == SUM(haber) antes de cualquier INSERT en `accounting_entries`.

---

## Reglas de Negocio Críticas

- **AFIP / Facturación**: `afip_mode = edge_simulation` en desarrollo; no activar cert real sin aprobación explícita.
- **Items facturados**: una vez guardados en `afip_vouchers.items` (JSONB), son INMUTABLES. No editar histórico.
- **Stock**: descuento de `articulo.stock_actual` siempre atómico con la confirmación de venta.
- **Compatibilidades**: repuestos asociados a `auto_version` normalizado; nunca texto libre en campos de compatibilidad.
- **Equivalencias**: usar `grupo_equivalencia_id`; nunca relaciones M-N directas entre artículos.
- **Autenticación y Roles**: Los roles de usuario (`pending`, `vendedor`, `admin`) viven en una **columna plana dedicada `role` del tipo ENUM `user_role`** en la tabla `public.users` (NUNCA en el JSONB `profile`). Todo nuevo usuario registrado inicia por defecto con `role = 'pending'`. Al ingresar, se le debe mostrar un aviso de bloqueo en el Dashboard indicando: `"Usuario sin permisos, contacta con soporte"` junto con un botón que envíe un mensaje predefinido de WhatsApp de recordatorio al administrador (`+5493413192179`) para solicitar su escalado de rol manual en la base de datos Supabase.

---

## Testing

- **Strict TDD activo**: no mergear código sin tests que lo cubran.
- Frontend: `bun run test` (Vitest)
- Funciones de cálculo de IVA, descuentos y balance contable: DEBEN tener unit tests dedicados.

---

## Prohibiciones Absolutas

- ❌ `any` en TypeScript sin justificación en comentario
- ❌ Migrar TailwindCSS a v4
- ❌ Editar registros en `afip_vouchers.items` ya emitidos
- ❌ INSERT en `accounting_entries` con SUM(debe) ≠ SUM(haber)
- ❌ Queries sin filtro `company_cuit` en tablas multi-empresa
- ❌ `console.log` en código de producción (usar logger estructurado)
- ❌ Hardcodear URLs de API (usar variables de entorno)

---

## Recursos del Proyecto

- [Skill Catálogo](.agents/skills/erp-catalog/SKILL.md)
- [Skill Ventas](.agents/skills/erp-sales/SKILL.md)
- [Skill Contabilidad](.agents/skills/erp-accounting/SKILL.md)
- [Skill Arquitectura](.agents/skills/erp-architecture/SKILL.md)
- [Contexto del Proyecto](CONTEXT.md)
- [SDD Init](.atl/sdd-init.json)
