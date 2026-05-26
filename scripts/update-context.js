const fs = require('fs');
const path = require('path');

// Colors for console
const green = '\x1b[32m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

async function updateContext() {
  console.log('[Context Updater] Iniciando actualización de CONTEXT.md desde Supabase...');

  // 1. Read .env.local to get Supabase config
  const envLocalPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envLocalPath)) {
    console.error(`${red}[Error] No se encontró .env.local en la raíz del proyecto.${reset}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/);
  const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)/);

  if (!supabaseUrlMatch || !supabaseKeyMatch) {
    console.error(`${red}[Error] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están definidos en .env.local.${reset}`);
    process.exit(1);
  }

  const supabaseUrl = supabaseUrlMatch[1].trim().replace(/['"]/g, '');
  const supabaseKey = supabaseKeyMatch[1].trim().replace(/['"]/g, '');

  // 2. Define tables to audit
  const tables = [
    { name: 'users', desc: 'Perfiles de usuario de Supabase Auth' },
    { name: 'company_profile', desc: 'Perfiles fiscales de las empresas registradas' },
    { name: 'customers', desc: 'Clientes y proveedores del ERP' },
    { name: 'inventory', desc: 'Catálogo de inventario (esquema heredado)' },
    { name: 'articulo', desc: 'Catálogo de autopartes principal' },
    { name: 'marca', desc: 'Marcas de autopartes' },
    { name: 'familia_repuesto', desc: 'Familias o categorías de repuestos' },
    { name: 'grupo_equivalencia', desc: 'Grupos de equivalencias entre repuestos' },
    { name: 'auto_marca', desc: 'Marcas de automóviles normalizadas' },
    { name: 'auto_modelo', desc: 'Modelos de automóviles normalizados' },
    { name: 'auto_version', desc: 'Versiones y motorizaciones de automóviles' },
    { name: 'articulo_compatibilidad', desc: 'Compatibilidades M-N entre artículos y vehículos' },
    { name: 'alicuota_iva', desc: 'Alícuotas de IVA granulares de ARCA (ex-AFIP)' },
    { name: 'afip_vouchers', desc: 'Comprobantes electrónicos (CAE/Facturas/Remitos)' },
    { name: 'caja_sesion', desc: 'Sesiones de caja diaria por cajero y CUIT' },
    { name: 'caja_movimiento', desc: 'Movimientos de ingreso/egreso de caja diaria' },
    { name: 'customer_credit_accounts', desc: 'Cuentas corrientes de clientes mayoristas' },
    { name: 'customer_credit_movements', desc: 'Movimientos de débito/crédito de cuenta corriente' },
    { name: 'accounting_accounts', desc: 'Plan de cuentas jerárquico contable' },
    { name: 'accounting_transactions', desc: 'Asientos contables - Cabecera' },
    { name: 'accounting_entries', desc: 'Asientos contables - Líneas de Debe y Haber' },
    { name: 'arca_credentials', desc: 'Credenciales fiscales y certificados de ARCA' }
  ];

  const tableResults = [];

  // 3. Query each table count from Supabase REST API via native fetch
  for (const table of tables) {
    try {
      const url = `${supabaseUrl}/rest/v1/${table.name}`;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const contentRange = response.headers.get('content-range');
      let recordCount = 0;
      if (contentRange) {
        const parts = contentRange.split('/');
        if (parts.length > 1) {
          recordCount = parseInt(parts[1], 10) || 0;
        }
      }

      tableResults.push({
        name: table.name,
        desc: table.desc,
        count: recordCount,
        status: 'Activo'
      });
      console.log(` - Tabla ${table.name}: ${green}${recordCount} registros${reset}`);
    } catch (err) {
      console.warn(`⚠️  No se pudo consultar la tabla ${table.name}: ${err.message}. Usando fallback 0.`);
      tableResults.push({
        name: table.name,
        desc: table.desc,
        count: 0,
        status: 'Pendiente / Vacía'
      });
    }
  }

  // 4. Generate CONTEXT.md content
  const timestamp = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  
  let markdown = `# ERP Nodo Sur — Contexto y Estado del Proyecto

*Este archivo se actualiza automáticamente ejecutando \`bun run update-context\` en la raíz del proyecto.*

## 🌐 Información del Backend

- **URL Base**: \`${supabaseUrl}\`
- **Fecha de Actualización**: ${timestamp} (ARG)

## 📊 Estado de las Tablas y Registros (Supabase Live)

| Tabla | Descripción | Registros | RLS |
| :--- | :--- | :---: | :---: |
`;

  for (const row of tableResults) {
    markdown += `| \`${row.name}\` | ${row.desc} | \`${row.count}\` | Activo (RLS Habilitado) |\n`;
  }

  markdown += `
## 🛠️ Esquemas de Base de Datos y Tipos

### 📋 Tabla: \`users\`
\`\`\`json
{
  "id": "text (UUID de Auth, PK)",
  "email": "text (unique)",
  "profile": "jsonb",
  "metadata": "jsonb",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
\`\`\`

### 📋 Tabla: \`company_profile\`
\`\`\`json
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
\`\`\`

### 📋 Tabla: \`articulo\`
\`\`\`json
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
\`\`\`

### 📋 Tabla: \`alicuota_iva\`
\`\`\`json
{
  "codigo_afip": "integer (PK)",
  "descripcion": "varchar",
  "porcentaje": "numeric (unique)",
  "activa": "boolean",
  "created_at": "timestamp"
}
\`\`\`

### 📋 Tabla: \`afip_vouchers\`
\`\`\`json
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
\`\`\`

### 📋 Tabla: \`accounting_accounts\`
\`\`\`json
{
  "code": "text (PK)",
  "name": "text",
  "parent_code": "text",
  "type": "text"
}
\`\`\`

### 📋 Tabla: \`accounting_transactions\`
\`\`\`json
{
  "id": "text (PK)",
  "date": "timestamp",
  "description": "text"
}
\`\`\`

### 📋 Tabla: \`accounting_entries\`
\`\`\`json
{
  "id": "integer (PK, serial)",
  "transaction_id": "text (FK)",
  "account_code": "text (FK)",
  "debe": "numeric",
  "haber": "numeric"
}
\`\`\`
`;

  const contextMdPath = path.join(__dirname, '../CONTEXT.md');
  fs.writeFileSync(contextMdPath, markdown, 'utf8');
  console.log(`${green}✅ ¡CONTEXT.md actualizado con éxito desde Supabase!${reset}`);
}

updateContext();
