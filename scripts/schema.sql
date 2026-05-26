-- SCHEMA GENERATED AUTOMATICALLY FOR SUPABASE MIGRATION

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.marca (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre varchar NOT NULL,
    pais_origen varchar,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT marca_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.familia_repuesto (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre varchar NOT NULL,
    descripcion text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT familia_repuesto_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.grupo_equivalencia (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    descripcion varchar,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT grupo_equivalencia_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.auto_marca (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT auto_marca_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.company_profile (
    cuit text NOT NULL,
    razon_social text NOT NULL,
    nombre_fantasia text,
    condicion_iva text NOT NULL,
    ingresos_brutos text,
    inicio_actividades text,
    direccion text,
    punto_venta integer DEFAULT 1,
    afip_mode text DEFAULT 'edge_simulation'::text,
    afip_cert text,
    afip_key text,
    CONSTRAINT company_profile_pkey PRIMARY KEY (cuit)
);

CREATE TABLE IF NOT EXISTS public.customers (
    id text NOT NULL,
    cuit text NOT NULL,
    razon_social text NOT NULL,
    condicion_iva text NOT NULL,
    direccion text,
    email text,
    phone text,
    CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
    code text NOT NULL,
    name text NOT NULL,
    parent_code text,
    type text NOT NULL,
    CONSTRAINT accounting_accounts_pkey PRIMARY KEY (code)
);

CREATE TABLE IF NOT EXISTS public.accounting_transactions (
    id text NOT NULL,
    date timestamptz NOT NULL,
    description text NOT NULL,
    CONSTRAINT accounting_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL,
    email text,
    profile jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.caja_sesion (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cuit varchar NOT NULL,
    user_id varchar NOT NULL,
    estado varchar NOT NULL,
    monto_inicial numeric NOT NULL,
    monto_teorico numeric NOT NULL,
    monto_real numeric,
    diferencia numeric,
    fecha_apertura timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    fecha_cierre timestamptz,
    notas text,
    CONSTRAINT caja_sesion_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.arca_credentials (
    company_cuit text NOT NULL,
    private_key text NOT NULL,
    certificate text NOT NULL,
    punto_venta integer NOT NULL DEFAULT 1,
    environment text NOT NULL DEFAULT 'simulation'::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT arca_credentials_pkey PRIMARY KEY (company_cuit)
);

CREATE TABLE IF NOT EXISTS public.inventory (
    id text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    description text,
    cost_price numeric NOT NULL,
    sale_price numeric NOT NULL,
    iva_rate numeric NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    min_stock integer NOT NULL DEFAULT 0,
    CONSTRAINT inventory_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.afip_vouchers (
    id text NOT NULL,
    type text NOT NULL,
    client_cuit text NOT NULL,
    net_amount numeric NOT NULL,
    iva_amount numeric NOT NULL,
    total_amount numeric NOT NULL,
    cae text NOT NULL,
    cae_expiration text NOT NULL,
    qr_link text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    company_cuit text,
    client_name text,
    items jsonb,
    CONSTRAINT afip_vouchers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.articulo (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    codigo_fabricante varchar NOT NULL,
    codigo_barras varchar,
    descripcion text NOT NULL,
    marca_id uuid NOT NULL,
    familia_id uuid NOT NULL,
    grupo_equivalencia_id uuid,
    precio_costo numeric NOT NULL DEFAULT 0.00,
    precio_minorista numeric NOT NULL DEFAULT 0.00,
    precio_mayorista numeric NOT NULL DEFAULT 0.00,
    stock_actual integer NOT NULL DEFAULT 0,
    stock_minimo integer NOT NULL DEFAULT 5,
    ubicacion_deposito varchar,
    tsv_busqueda tsvector,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT articulo_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.auto_modelo (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    marca_id uuid NOT NULL,
    nombre varchar NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT auto_modelo_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_credit_accounts (
    id text NOT NULL,
    client_id text NOT NULL,
    company_cuit text NOT NULL,
    tiene_cuenta_corriente boolean NOT NULL DEFAULT false,
    limite_credito numeric NOT NULL DEFAULT 0.00,
    saldo_actual numeric NOT NULL DEFAULT 0.00,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT customer_credit_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id SERIAL,
    transaction_id text,
    account_code text,
    debe numeric NOT NULL DEFAULT 0.00,
    haber numeric NOT NULL DEFAULT 0.00,
    CONSTRAINT accounting_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.caja_movimiento (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sesion_id uuid NOT NULL,
    tipo varchar NOT NULL,
    monto numeric NOT NULL,
    concepto text NOT NULL,
    fecha timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    accounting_transaction_id varchar,
    CONSTRAINT caja_movimiento_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.auto_version (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    modelo_id uuid NOT NULL,
    motorizacion varchar NOT NULL,
    anio_desde integer NOT NULL,
    anio_hasta integer,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT auto_version_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_credit_movements (
    id text NOT NULL,
    credit_account_id text NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    description text NOT NULL,
    accounting_transaction_id text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT customer_credit_movements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.articulo_compatibilidad (
    articulo_id uuid NOT NULL,
    auto_version_id uuid NOT NULL,
    observaciones varchar,
    CONSTRAINT articulo_compatibilidad_pkey PRIMARY KEY (articulo_id, auto_version_id)
);


-- CONSTRAINTS (FOREIGN KEYS, UNIQUES, CHECKS)
ALTER TABLE public.articulo_compatibilidad DROP CONSTRAINT IF EXISTS articulo_compatibilidad_articulo_id_fkey;
ALTER TABLE public.articulo_compatibilidad ADD CONSTRAINT articulo_compatibilidad_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES articulo(id) ON DELETE CASCADE;
ALTER TABLE public.articulo_compatibilidad DROP CONSTRAINT IF EXISTS articulo_compatibilidad_auto_version_id_fkey;
ALTER TABLE public.articulo_compatibilidad ADD CONSTRAINT articulo_compatibilidad_auto_version_id_fkey FOREIGN KEY (auto_version_id) REFERENCES auto_version(id) ON DELETE CASCADE;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_sku_key;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_sku_key UNIQUE (sku);
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_transaction_id_fkey;
ALTER TABLE public.accounting_entries ADD CONSTRAINT accounting_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES accounting_transactions(id) ON DELETE CASCADE;
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_account_code_fkey;
ALTER TABLE public.accounting_entries ADD CONSTRAINT accounting_entries_account_code_fkey FOREIGN KEY (account_code) REFERENCES accounting_accounts(code);
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_cuit_key;
ALTER TABLE public.customers ADD CONSTRAINT customers_cuit_key UNIQUE (cuit);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.marca DROP CONSTRAINT IF EXISTS marca_nombre_key;
ALTER TABLE public.marca ADD CONSTRAINT marca_nombre_key UNIQUE (nombre);
ALTER TABLE public.familia_repuesto DROP CONSTRAINT IF EXISTS familia_repuesto_nombre_key;
ALTER TABLE public.familia_repuesto ADD CONSTRAINT familia_repuesto_nombre_key UNIQUE (nombre);
ALTER TABLE public.articulo DROP CONSTRAINT IF EXISTS uq_articulo_codigo_marca;
ALTER TABLE public.articulo ADD CONSTRAINT uq_articulo_codigo_marca UNIQUE (codigo_fabricante, marca_id);
ALTER TABLE public.articulo DROP CONSTRAINT IF EXISTS articulo_marca_id_fkey;
ALTER TABLE public.articulo ADD CONSTRAINT articulo_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES marca(id) ON DELETE RESTRICT;
ALTER TABLE public.articulo DROP CONSTRAINT IF EXISTS articulo_familia_id_fkey;
ALTER TABLE public.articulo ADD CONSTRAINT articulo_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familia_repuesto(id) ON DELETE RESTRICT;
ALTER TABLE public.articulo DROP CONSTRAINT IF EXISTS articulo_grupo_equivalencia_id_fkey;
ALTER TABLE public.articulo ADD CONSTRAINT articulo_grupo_equivalencia_id_fkey FOREIGN KEY (grupo_equivalencia_id) REFERENCES grupo_equivalencia(id) ON DELETE SET NULL;
ALTER TABLE public.auto_marca DROP CONSTRAINT IF EXISTS auto_marca_nombre_key;
ALTER TABLE public.auto_marca ADD CONSTRAINT auto_marca_nombre_key UNIQUE (nombre);
ALTER TABLE public.auto_modelo DROP CONSTRAINT IF EXISTS uq_modelo_marca;
ALTER TABLE public.auto_modelo ADD CONSTRAINT uq_modelo_marca UNIQUE (nombre, marca_id);
ALTER TABLE public.auto_modelo DROP CONSTRAINT IF EXISTS auto_modelo_marca_id_fkey;
ALTER TABLE public.auto_modelo ADD CONSTRAINT auto_modelo_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES auto_marca(id) ON DELETE CASCADE;
ALTER TABLE public.auto_version DROP CONSTRAINT IF EXISTS auto_version_modelo_id_fkey;
ALTER TABLE public.auto_version ADD CONSTRAINT auto_version_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES auto_modelo(id) ON DELETE CASCADE;
ALTER TABLE public.caja_sesion DROP CONSTRAINT IF EXISTS caja_sesion_estado_check;
ALTER TABLE public.caja_sesion ADD CONSTRAINT caja_sesion_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying])::text[])));
ALTER TABLE public.caja_sesion DROP CONSTRAINT IF EXISTS caja_sesion_monto_inicial_check;
ALTER TABLE public.caja_sesion ADD CONSTRAINT caja_sesion_monto_inicial_check CHECK ((monto_inicial >= (0)::numeric));
ALTER TABLE public.caja_movimiento DROP CONSTRAINT IF EXISTS caja_movimiento_tipo_check;
ALTER TABLE public.caja_movimiento ADD CONSTRAINT caja_movimiento_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ingreso'::character varying, 'egreso'::character varying])::text[])));
ALTER TABLE public.caja_movimiento DROP CONSTRAINT IF EXISTS caja_movimiento_monto_check;
ALTER TABLE public.caja_movimiento ADD CONSTRAINT caja_movimiento_monto_check CHECK ((monto > (0)::numeric));
ALTER TABLE public.caja_movimiento DROP CONSTRAINT IF EXISTS caja_movimiento_sesion_id_fkey;
ALTER TABLE public.caja_movimiento ADD CONSTRAINT caja_movimiento_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES caja_sesion(id) ON DELETE CASCADE;
ALTER TABLE public.customer_credit_accounts DROP CONSTRAINT IF EXISTS customer_credit_accounts_client_company_unique;
ALTER TABLE public.customer_credit_accounts ADD CONSTRAINT customer_credit_accounts_client_company_unique UNIQUE (client_id, company_cuit);
ALTER TABLE public.customer_credit_accounts DROP CONSTRAINT IF EXISTS customer_credit_accounts_client_id_fkey;
ALTER TABLE public.customer_credit_accounts ADD CONSTRAINT customer_credit_accounts_client_id_fkey FOREIGN KEY (client_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE public.customer_credit_movements DROP CONSTRAINT IF EXISTS customer_credit_movements_type_check;
ALTER TABLE public.customer_credit_movements ADD CONSTRAINT customer_credit_movements_type_check CHECK ((type = ANY (ARRAY['debito'::text, 'credito'::text])));
ALTER TABLE public.customer_credit_movements DROP CONSTRAINT IF EXISTS customer_credit_movements_credit_account_id_fkey;
ALTER TABLE public.customer_credit_movements ADD CONSTRAINT customer_credit_movements_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES customer_credit_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.customer_credit_movements DROP CONSTRAINT IF EXISTS customer_credit_movements_accounting_transaction_id_fkey;
ALTER TABLE public.customer_credit_movements ADD CONSTRAINT customer_credit_movements_accounting_transaction_id_fkey FOREIGN KEY (accounting_transaction_id) REFERENCES accounting_transactions(id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.marca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familia_repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_equivalencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_marca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_sesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arca_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afip_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulo_compatibilidad ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
DROP POLICY IF EXISTS "Allow authenticated access" ON public.afip_vouchers;
CREATE POLICY "Allow authenticated access" ON public.afip_vouchers FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.afip_vouchers;
CREATE POLICY "project_admin_policy" ON public.afip_vouchers FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.company_profile;
CREATE POLICY "Allow authenticated access" ON public.company_profile FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.company_profile;
CREATE POLICY "project_admin_policy" ON public.company_profile FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.inventory;
CREATE POLICY "Allow authenticated manage" ON public.inventory FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.inventory;
CREATE POLICY "Allow authenticated read" ON public.inventory FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.inventory;
CREATE POLICY "project_admin_policy" ON public.inventory FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customers;
CREATE POLICY "Allow authenticated access" ON public.customers FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.customers;
CREATE POLICY "project_admin_policy" ON public.customers FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.accounting_accounts;
CREATE POLICY "Allow authenticated access" ON public.accounting_accounts FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.accounting_accounts;
CREATE POLICY "project_admin_policy" ON public.accounting_accounts FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.accounting_entries;
CREATE POLICY "Allow authenticated access" ON public.accounting_entries FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.accounting_entries;
CREATE POLICY "project_admin_policy" ON public.accounting_entries FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.accounting_transactions;
CREATE POLICY "Allow authenticated access" ON public.accounting_transactions FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.accounting_transactions;
CREATE POLICY "project_admin_policy" ON public.accounting_transactions FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.auto_version;
CREATE POLICY "Allow authenticated manage" ON public.auto_version FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.auto_version;
CREATE POLICY "Allow authenticated read" ON public.auto_version FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.auto_version;
CREATE POLICY "project_admin_policy" ON public.auto_version FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.grupo_equivalencia;
CREATE POLICY "Allow authenticated manage" ON public.grupo_equivalencia FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.grupo_equivalencia;
CREATE POLICY "Allow authenticated read" ON public.grupo_equivalencia FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.grupo_equivalencia;
CREATE POLICY "project_admin_policy" ON public.grupo_equivalencia FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated read" ON public.users;
CREATE POLICY "Allow authenticated read" ON public.users FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated write own" ON public.users;
CREATE POLICY "Allow authenticated write own" ON public.users FOR ALL TO authenticated USING (((( SELECT auth.uid() AS uid))::text = id)) WITH CHECK (((( SELECT auth.uid() AS uid))::text = id));
DROP POLICY IF EXISTS "project_admin_policy" ON public.users;
CREATE POLICY "project_admin_policy" ON public.users FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.articulo;
CREATE POLICY "Allow authenticated manage" ON public.articulo FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.articulo;
CREATE POLICY "Allow authenticated read" ON public.articulo FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.articulo;
CREATE POLICY "project_admin_policy" ON public.articulo FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.familia_repuesto;
CREATE POLICY "Allow authenticated manage" ON public.familia_repuesto FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.familia_repuesto;
CREATE POLICY "Allow authenticated read" ON public.familia_repuesto FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.familia_repuesto;
CREATE POLICY "project_admin_policy" ON public.familia_repuesto FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.marca;
CREATE POLICY "Allow authenticated manage" ON public.marca FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.marca;
CREATE POLICY "Allow authenticated read" ON public.marca FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.marca;
CREATE POLICY "project_admin_policy" ON public.marca FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.auto_marca;
CREATE POLICY "Allow authenticated manage" ON public.auto_marca FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.auto_marca;
CREATE POLICY "Allow authenticated read" ON public.auto_marca FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.auto_marca;
CREATE POLICY "project_admin_policy" ON public.auto_marca FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.auto_modelo;
CREATE POLICY "Allow authenticated manage" ON public.auto_modelo FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.auto_modelo;
CREATE POLICY "Allow authenticated read" ON public.auto_modelo FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.auto_modelo;
CREATE POLICY "project_admin_policy" ON public.auto_modelo FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated manage" ON public.articulo_compatibilidad;
CREATE POLICY "Allow authenticated manage" ON public.articulo_compatibilidad FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "Allow authenticated read" ON public.articulo_compatibilidad;
CREATE POLICY "Allow authenticated read" ON public.articulo_compatibilidad FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.articulo_compatibilidad;
CREATE POLICY "project_admin_policy" ON public.articulo_compatibilidad FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.caja_movimiento;
CREATE POLICY "Allow authenticated access" ON public.caja_movimiento FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.caja_movimiento;
CREATE POLICY "project_admin_policy" ON public.caja_movimiento FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.caja_sesion;
CREATE POLICY "Allow authenticated access" ON public.caja_sesion FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.caja_sesion;
CREATE POLICY "project_admin_policy" ON public.caja_sesion FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customer_credit_accounts;
CREATE POLICY "Allow authenticated access" ON public.customer_credit_accounts FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.customer_credit_accounts;
CREATE POLICY "project_admin_policy" ON public.customer_credit_accounts FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.arca_credentials;
CREATE POLICY "Allow authenticated access" ON public.arca_credentials FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.arca_credentials;
CREATE POLICY "project_admin_policy" ON public.arca_credentials FOR ALL TO project_admin USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customer_credit_movements;
CREATE POLICY "Allow authenticated access" ON public.customer_credit_movements FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
DROP POLICY IF EXISTS "project_admin_policy" ON public.customer_credit_movements;
CREATE POLICY "project_admin_policy" ON public.customer_credit_movements FOR ALL TO project_admin USING (true) WITH CHECK (true);

-- INDEXES
DROP INDEX IF EXISTS public.idx_accounting_entries_account_code;
CREATE INDEX idx_accounting_entries_account_code ON public.accounting_entries USING btree (account_code);
DROP INDEX IF EXISTS public.idx_accounting_entries_transaction_id;
CREATE INDEX idx_accounting_entries_transaction_id ON public.accounting_entries USING btree (transaction_id);
DROP INDEX IF EXISTS public.idx_auto_version_modelo_id;
CREATE INDEX idx_auto_version_modelo_id ON public.auto_version USING btree (modelo_id);
DROP INDEX IF EXISTS public.idx_articulo_tsv;
CREATE INDEX idx_articulo_tsv ON public.articulo USING gin (tsv_busqueda);
DROP INDEX IF EXISTS public.idx_articulo_codigo_trgm;
CREATE INDEX idx_articulo_codigo_trgm ON public.articulo USING gin (codigo_fabricante gin_trgm_ops);
DROP INDEX IF EXISTS public.idx_articulo_descripcion_trgm;
CREATE INDEX idx_articulo_descripcion_trgm ON public.articulo USING gin (descripcion gin_trgm_ops);
DROP INDEX IF EXISTS public.idx_articulo_familia_id;
CREATE INDEX idx_articulo_familia_id ON public.articulo USING btree (familia_id);
DROP INDEX IF EXISTS public.idx_articulo_grupo_equivalencia_id;
CREATE INDEX idx_articulo_grupo_equivalencia_id ON public.articulo USING btree (grupo_equivalencia_id);
DROP INDEX IF EXISTS public.idx_articulo_compatibilidad_articulo_id;
CREATE INDEX idx_articulo_compatibilidad_articulo_id ON public.articulo_compatibilidad USING btree (articulo_id);
DROP INDEX IF EXISTS public.idx_caja_movimiento_sesion_id;
CREATE INDEX idx_caja_movimiento_sesion_id ON public.caja_movimiento USING btree (sesion_id);
DROP INDEX IF EXISTS public.idx_customer_credit_accounts_client_id;
CREATE INDEX idx_customer_credit_accounts_client_id ON public.customer_credit_accounts USING btree (client_id);
DROP INDEX IF EXISTS public.idx_customer_credit_movements_accounting_transaction_id;
CREATE INDEX idx_customer_credit_movements_accounting_transaction_id ON public.customer_credit_movements USING btree (accounting_transaction_id);
DROP INDEX IF EXISTS public.idx_customer_credit_movements_credit_account_id;
CREATE INDEX idx_customer_credit_movements_credit_account_id ON public.customer_credit_movements USING btree (credit_account_id);