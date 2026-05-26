# ERP Nodo Sur — Contexto y Estado del Proyecto

*Este archivo se actualiza automáticamente ejecutando `bun run update-context` en la raíz del proyecto.*

## 🌐 Información del Backend

- **URL Base**: `https://xrmhsluabxlrdfgqajwj.supabase.co`
- **Fecha de Actualización**: 24/5/2026, 09:11:09 (ARG)

## 📊 Estado de las Tablas y Registros (Supabase Live)

| Tabla | Descripción | Registros | RLS |
| :--- | :--- | :---: | :---: |
| `users` | Perfiles de usuario de Supabase Auth | `0` | Activo (RLS Habilitado) |
| `company_profile` | Perfiles fiscales de las empresas registradas | `0` | Activo (RLS Habilitado) |
| `customers` | Clientes y proveedores del ERP | `0` | Activo (RLS Habilitado) |
| `inventory` | Catálogo de inventario (esquema heredado) | `0` | Activo (RLS Habilitado) |
| `articulo` | Catálogo de autopartes principal | `0` | Activo (RLS Habilitado) |
| `marca` | Marcas de autopartes | `0` | Activo (RLS Habilitado) |
| `familia_repuesto` | Familias o categorías de repuestos | `0` | Activo (RLS Habilitado) |
| `grupo_equivalencia` | Grupos de equivalencias entre repuestos | `0` | Activo (RLS Habilitado) |
| `auto_marca` | Marcas de automóviles normalizadas | `0` | Activo (RLS Habilitado) |
| `auto_modelo` | Modelos de automóviles normalizados | `0` | Activo (RLS Habilitado) |
| `auto_version` | Versiones y motorizaciones de automóviles | `0` | Activo (RLS Habilitado) |
| `articulo_compatibilidad` | Compatibilidades M-N entre artículos y vehículos | `0` | Activo (RLS Habilitado) |
| `alicuota_iva` | Alícuotas de IVA granulares de ARCA (ex-AFIP) | `0` | Activo (RLS Habilitado) |
| `afip_vouchers` | Comprobantes electrónicos (CAE/Facturas/Remitos) | `0` | Activo (RLS Habilitado) |
| `caja_sesion` | Sesiones de caja diaria por cajero y CUIT | `0` | Activo (RLS Habilitado) |
| `caja_movimiento` | Movimientos de ingreso/egreso de caja diaria | `0` | Activo (RLS Habilitado) |
| `customer_credit_accounts` | Cuentas corrientes de clientes mayoristas | `0` | Activo (RLS Habilitado) |
| `customer_credit_movements` | Movimientos de débito/crédito de cuenta corriente | `0` | Activo (RLS Habilitado) |
| `accounting_accounts` | Plan de cuentas jerárquico contable | `0` | Activo (RLS Habilitado) |
| `accounting_transactions` | Asientos contables - Cabecera | `0` | Activo (RLS Habilitado) |
| `accounting_entries` | Asientos contables - Líneas de Debe y Haber | `0` | Activo (RLS Habilitado) |
| `arca_credentials` | Credenciales fiscales y certificados de ARCA | `0` | Activo (RLS Habilitado) |

## 🛠️ Esquemas de Base de Datos y Tipos

### 📋 Tabla: `users`
```json
{
  "id": "text (UUID de Auth, PK)",
  "email": "text (unique)",
  "profile": "jsonb",
  "metadata": "jsonb",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### 📋 Tabla: `company_profile`
```json
{
  "cuit": "text (PK)",
  "razon_social": "text",
  "nombre_fantasia": "text",
  "condicion_iva": "text",
  "ingresos_brutos": "text",
  "inicio_actividades": "text",
  "direccion": "text",
  "punto_venta": "integer",
  "afip_mode": "text",
  "celular": "text",
  "email": "text"
}
```

### 📋 Tabla: `articulo`
```json
{
  "id": "uuid (PK)",
  "codigo_fabricante": "varchar",
  "codigo_barras": "varchar",
  "descripcion": "text",
  "marca_id": "uuid (FK)",
  "familia_id": "uuid (FK)",
  "grupo_equivalencia_id": "uuid (FK)",
  "precio_costo": "numeric",
  "precio_minorista": "numeric",
  "precio_mayorista": "numeric",
  "stock_actual": "integer",
  "stock_minimo": "integer",
  "ubicacion_deposito": "varchar",
  "created_at": "timestamp"
}
```

### 📋 Tabla: `alicuota_iva`
```json
{
  "codigo_afip": "integer (PK)",
  "descripcion": "varchar",
  "porcentaje": "numeric (unique)",
  "activa": "boolean",
  "created_at": "timestamp"
}
```

### 📋 Tabla: `afip_vouchers`
```json
{
  "id": "text (PK)",
  "company_cuit": "text",
  "type": "text",
  "client_cuit": "text",
  "client_name": "text",
  "net_amount": "numeric",
  "iva_amount": "numeric",
  "total_amount": "numeric",
  "cae": "text",
  "cae_expiration": "text",
  "qr_link": "text",
  "items": "jsonb (inmutable)",
  "created_at": "timestamp"
}
```

### 📋 Tabla: `accounting_accounts`
```json
{
  "code": "text (PK)",
  "name": "text",
  "parent_code": "text",
  "type": "text"
}
```

### 📋 Tabla: `accounting_transactions`
```json
{
  "id": "text (PK)",
  "date": "timestamp",
  "description": "text"
}
```

### 📋 Tabla: `accounting_entries`
```json
{
  "id": "integer (PK, serial)",
  "transaction_id": "text (FK)",
  "account_code": "text (FK)",
  "debe": "numeric",
  "haber": "numeric"
}
```
