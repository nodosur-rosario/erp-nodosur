# Especificación de Base de Datos: Catálogo e Inventario Autopartista (`sdd-database-spec`)

Este documento detalla la estructura física de la base de datos en Supabase, los índices, constraints, triggers y políticas para el módulo de catálogo e inventario.

## 1. Esquema Físico (Tablas Relacionadas)

### Tabla: `articulo`
Es la tabla core del inventario de repuestos.

| Campo | Tipo de Datos | Nullable | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | Identificador único del artículo. |
| `codigo_fabricante` | `character varying(100)` | NO | - | Código interno o de fabricante del repuesto. |
| `codigo_barras` | `character varying(100)` | YES | - | Código de barras para lector digital. |
| `descripcion` | `text` | NO | - | Detalle largo descriptivo del artículo. |
| `marca_id` | `uuid` | NO | - | Relación con la tabla `marca` (FK). |
| `familia_id` | `uuid` | NO | - | Relación con la tabla `familia_repuesto` (FK). |
| `grupo_equivalencia_id` | `uuid` | YES | - | Relación con la tabla `grupo_equivalencia` (FK) para evitar redundancias de PIM. |
| `precio_costo` | `numeric(12, 2)` | NO | `0.00` | Precio de compra original de costo. |
| `precio_minorista` | `numeric(12, 2)` | NO | `0.00` | Precio sugerido de venta minorista al público. |
| `precio_mayorista` | `numeric(12, 2)` | NO | `0.00` | Precio para talleres y compras en lote. |
| `stock_actual` | `integer` | NO | `0` | Cantidad física actual disponible en depósito. |
| `stock_minimo` | `integer` | NO | `5` | Umbral mínimo donde el stock se considera **Bajo** (alerta). |
| `ubicacion_deposito` | `character varying(100)` | YES | - | Ubicación de estantería o casillero. |
| `tsv_busqueda` | `tsvector` | YES | - | Vector precalculado de búsqueda difusa y de texto completo. |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` | Fecha de creación del registro. |

### Tabla: `marca`
| Campo | Tipo de Datos | Nullable | Valor por Defecto |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `nombre` | `character varying(100)` | NO | - |
| `pais_origen` | `character varying(50)` | YES | - |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

### Tabla: `familia_repuesto`
| Campo | Tipo de Datos | Nullable | Valor por Defecto |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `nombre` | `character varying(100)` | NO | - |
| `descripcion` | `text` | YES | - |
| `created_at` | `timestamp with time zone` | NO | `timezone('utc'::text, now())` |

---

## 2. Índices y Restricciones (Constraints)

- **Clave Primaria (`articulo_pkey`)**: Índice único sobre la columna `id`.
- **Combinación Única Fabricante/Marca (`uq_articulo_codigo_marca`)**: Restricción única B-Tree sobre `(codigo_fabricante, marca_id)` para asegurar que no se dupliquen repuestos del mismo fabricante para la misma marca.
- **Búsqueda Trigram (`idx_articulo_codigo_trgm` & `idx_articulo_descripcion_trgm`)**: Índices `GIN` utilizando la extensión `pg_trgm` sobre `codigo_fabricante` y `descripcion` para agilizar búsquedas difusas en caliente.
- **Vector FTS (`idx_articulo_tsv`)**: Índice `GIN` sobre el campo `tsv_busqueda` para consultas rápidas combinadas.

---

## 3. Disparadores y Funciones (Triggers)

### Trigger: `tg_sync_busqueda_articulo_before`
- **Timing**: `BEFORE INSERT OR UPDATE`
- **Función**: `fn_sincronizar_busqueda_articulo_before()`
- **Objetivo**: Actualiza automáticamente el vector `tsv_busqueda` antes de guardar o modificar el artículo concatenando código, descripción y marcas.

---

## 4. Esquema de Contabilidad, Caja y Alícuotas de IVA (ARCA)

### Tabla: `alicuota_iva`
Define las tasas de IVA oficiales del ERP Nodo Sur de forma granular.

| Campo | Tipo de Datos | Nullable | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `codigo_afip` | `integer` | NO | - | Código oficial de alícuota ante AFIP/ARCA (PK). |
| `descripcion` | `character varying` | NO | - | Detalle visual (ej. 'IVA 21%'). |
| `porcentaje` | `numeric` | NO | - | Porcentaje impositivo exacto (unique). |
| `activa` | `boolean` | NO | `true` | Habilita o deshabilita la tasa en el POS. |
| `created_at` | `timestamp` | NO | `now()` | Fecha de creación del registro. |

### Tabla: `accounting_accounts`
Plan de cuentas jerárquico contable de partida doble.

| Campo | Tipo de Datos | Nullable | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `code` | `text` | NO | - | Código contable jerárquico (PK, ej. '1.1.1.01'). |
| `name` | `text` | NO | - | Nombre descriptivo de la cuenta. |
| `parent_code` | `text` | YES | - | Relación recursiva de jerarquía (FK). |
| `type` | `text` | NO | - | Categoría contable: `asset`, `liability`, `equity`, `revenue`, `expense`. |

### Tabla: `accounting_transactions`
Cabeceras de asientos contables del Libro Diario.

| Campo | Tipo de Datos | Nullable | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `text` | NO | - | ID secuencial de transacción contable (PK). |
| `date` | `timestamp` | NO | - | Fecha de registro del asiento contable. |
| `description` | `text` | NO | - | Detalle descriptivo de la transacción. |

### Tabla: `accounting_entries`
Detalles de partidas y contrapartidas individuales (Debe y Haber).

| Campo | Tipo de Datos | Nullable | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `id` | `integer` | NO | `nextval(...)` | Identificador autoincremental de la línea (PK). |
| `transaction_id` | `text` | NO | - | Relación con la cabecera `accounting_transactions` (FK). |
| `account_code` | `text` | NO | - | Relación con `accounting_accounts` (FK). |
| `debe` | `numeric` | NO | `0.00` | Monto a debitar en la cuenta. |
| `haber` | `numeric` | NO | `0.00` | Monto a acreditar en la cuenta. |

---

## 5. Integridad de Partida Doble
Para asegurar la consistencia del Libro Diario, toda transacción insertada en `accounting_entries` debe cumplir rigurosamente:
$$\sum \text{debe} = \sum \text{haber}$$
Cualquier intento de inserción que rompa esta igualdad será rechazado de forma atómica en las reglas de negocio del ERP y disparará un rollback.

