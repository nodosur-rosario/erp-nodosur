## Table `accounting_accounts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `parent_code` | `text` |  Nullable |
| `type` | `text` |  |
| `company_cuit` | `text` |  Nullable |

## Table `accounting_entries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `transaction_id` | `text` |  Nullable |
| `account_code` | `text` |  Nullable |
| `debe` | `numeric` |  |
| `haber` | `numeric` |  |
| `id` | `uuid` | Primary |

## Table `accounting_transactions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `date` | `timestamptz` |  |
| `description` | `text` |  |
| `canal` | `varchar` |  Nullable |
| `company_cuit` | `text` |  Nullable |

## Table `alicuota_iva`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `codigo_afip` | `int4` | Primary |
| `descripcion` | `varchar` |  |
| `porcentaje` | `numeric` |  Unique |
| `activa` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `arca_access_tickets`

Tabla de caché para persistencia temporal (12hs) de credenciales dinámicas WSAA (Token y Sign) por CUIT y servicio.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `cuit` | `varchar` | Primary |
| `service` | `varchar` | Primary |
| `token` | `text` |  |
| `sign` | `text` |  |
| `expired_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  Nullable |

## Table `arca_credentials`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `company_cuit` | `text` | Primary |
| `private_key` | `text` |  |
| `certificate` | `text` |  |
| `punto_venta` | `int4` |  |
| `environment` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `arca_padron_cache`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `cuit` | `text` | Primary |
| `razon_social` | `text` |  Nullable |
| `domicilio` | `text` |  Nullable |
| `estado_afip` | `text` |  Nullable |
| `categorias` | `jsonb` |  Nullable |
| `consultado_at` | `timestamptz` |  Nullable |

## Table `arca_remitos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_cuit` | `text` |  |
| `numero` | `int8` |  Nullable |
| `coe` | `text` |  Nullable |
| `cuit_dest` | `text` |  |
| `estado` | `text` |  Nullable |
| `payload_req` | `jsonb` |  Nullable |
| `payload_res` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `arca_vouchers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `type` | `text` |  |
| `client_cuit` | `text` |  |
| `net_amount` | `numeric` |  |
| `iva_amount` | `numeric` |  |
| `total_amount` | `numeric` |  |
| `cae` | `text` |  Nullable |
| `cae_vto` | `text` |  Nullable |
| `qr_link` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `company_cuit` | `text` |  Nullable |
| `client_name` | `text` |  Nullable |
| `items` | `jsonb` |  Nullable |
| `canal` | `varchar` |  Nullable |
| `iva_breakdown` | `jsonb` |  Nullable |
| `imp_op_ex` | `numeric` |  Nullable |
| `imp_tot_conc` | `numeric` |  Nullable |
| `imp_trib` | `numeric` |  Nullable |
| `doc_tipo` | `int4` |  Nullable |
| `doc_nro` | `text` |  Nullable |
| `status` | `text` |  Nullable |
| `error_details` | `jsonb` |  Nullable |
| `attempts` | `int4` |  Nullable |

## Table `articulo`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `codigo_fabricante` | `varchar` |  |
| `codigo_barras` | `varchar` |  Nullable |
| `descripcion` | `text` |  |
| `marca_id` | `uuid` |  |
| `familia_id` | `uuid` |  |
| `grupo_equivalencia_id` | `uuid` |  Nullable |
| `precio_costo` | `numeric` |  |
| `precio_minorista` | `numeric` |  |
| `precio_mayorista` | `numeric` |  |
| `stock_actual` | `int4` |  |
| `stock_minimo` | `int4` |  |
| `ubicacion_deposito` | `varchar` |  Nullable |
| `tsv_busqueda` | `tsvector` |  Nullable |
| `created_at` | `timestamptz` |  |
| `sku` | `text` |  Nullable Unique |
| `alicuota_iva` | `int4` |  |
| `company_cuit` | `text` |  |

## Table `articulo_compatibilidad`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `articulo_id` | `uuid` | Primary |
| `auto_version_id` | `uuid` | Primary |
| `observaciones` | `varchar` |  Nullable |

## Table `auto_marca`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `varchar` |  Unique |
| `created_at` | `timestamptz` |  |

## Table `auto_modelo`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `marca_id` | `uuid` |  |
| `nombre` | `varchar` |  |
| `created_at` | `timestamptz` |  |

## Table `auto_version`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `modelo_id` | `uuid` |  |
| `motorizacion` | `varchar` |  |
| `anio_desde` | `int4` |  |
| `anio_hasta` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `caja_movimiento`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `sesion_id` | `uuid` |  |
| `tipo` | `varchar` |  |
| `monto` | `numeric` |  |
| `concepto` | `text` |  |
| `fecha` | `timestamptz` |  |
| `accounting_transaction_id` | `varchar` |  Nullable |
| `canal` | `varchar` |  Nullable |

## Table `caja_sesion`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `cuit` | `varchar` |  |
| `user_id` | `varchar` |  |
| `estado` | `varchar` |  |
| `monto_inicial` | `numeric` |  |
| `monto_teorico` | `numeric` |  |
| `monto_real` | `numeric` |  Nullable |
| `diferencia` | `numeric` |  Nullable |
| `fecha_apertura` | `timestamptz` |  |
| `fecha_cierre` | `timestamptz` |  Nullable |
| `notas` | `text` |  Nullable |

## Table `company_profile`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `cuit` | `text` | Primary |
| `razon_social` | `text` |  |
| `nombre_fantasia` | `text` |  Nullable |
| `condicion_iva` | `text` |  |
| `ingresos_brutos` | `text` |  Nullable |
| `inicio_actividades` | `text` |  Nullable |
| `direccion` | `text` |  Nullable |
| `punto_venta` | `int4` |  Nullable |
| `afip_mode` | `text` |  Nullable |
| `afip_cert` | `text` |  Nullable |
| `afip_key` | `text` |  Nullable |
| `celular` | `text` |  Nullable |
| `email` | `text` |  Nullable |

## Table `customer_credit_accounts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `client_id` | `text` |  |
| `company_cuit` | `text` |  |
| `tiene_cuenta_corriente` | `bool` |  |
| `limite_credito` | `numeric` |  |
| `saldo_actual` | `numeric` |  |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `customer_credit_allocations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_cuit` | `text` |  |
| `debit_movement_id` | `text` |  |
| `credit_movement_id` | `text` |  |
| `amount_allocated` | `numeric` |  |
| `created_at` | `timestamptz` |  |

## Table `customer_credit_movements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `credit_account_id` | `text` |  |
| `type` | `text` |  |
| `amount` | `numeric` |  |
| `description` | `text` |  |
| `accounting_transaction_id` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `customers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `cuit` | `text` |  |
| `razon_social` | `text` |  |
| `condicion_iva` | `text` |  |
| `direccion` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `company_cuit` | `text` |  |

## Table `familia_repuesto`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `varchar` |  Unique |
| `descripcion` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `grupo_equivalencia`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `descripcion` | `varchar` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `marca`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `varchar` |  Unique |
| `pais_origen` | `varchar` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `user_company_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `text` | Primary |
| `company_cuit` | `text` | Primary |
| `role` | `company_role` |  |
| `created_at` | `timestamptz` |  Nullable |

## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `email` | `text` |  Nullable Unique |
| `profile` | `jsonb` |  Nullable |
| `metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `role` | `user_role` |  |

