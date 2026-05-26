-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounting_accounts (
  code text NOT NULL,
  name text NOT NULL,
  parent_code text,
  type text NOT NULL,
  company_cuit text,
  CONSTRAINT accounting_accounts_pkey PRIMARY KEY (code),
  CONSTRAINT fk_accounting_accounts_company FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.accounting_entries (
  transaction_id text,
  account_code text,
  debe numeric NOT NULL DEFAULT 0.00,
  haber numeric NOT NULL DEFAULT 0.00,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT accounting_entries_pkey PRIMARY KEY (id),
  CONSTRAINT accounting_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.accounting_transactions(id),
  CONSTRAINT accounting_entries_account_code_fkey FOREIGN KEY (account_code) REFERENCES public.accounting_accounts(code)
);
CREATE TABLE public.accounting_transactions (
  id text NOT NULL,
  date timestamp with time zone NOT NULL,
  description text NOT NULL,
  canal character varying DEFAULT 'oficial'::character varying,
  company_cuit text,
  CONSTRAINT accounting_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_accounting_transactions_company FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.alicuota_iva (
  codigo_afip integer NOT NULL,
  descripcion character varying NOT NULL,
  porcentaje numeric NOT NULL UNIQUE,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT alicuota_iva_pkey PRIMARY KEY (codigo_afip)
);
CREATE TABLE public.arca_access_tickets (
  cuit character varying NOT NULL,
  service character varying NOT NULL,
  token text NOT NULL,
  sign text NOT NULL,
  expired_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arca_access_tickets_pkey PRIMARY KEY (cuit, service)
);
CREATE TABLE public.arca_credentials (
  company_cuit text NOT NULL,
  private_key text NOT NULL,
  certificate text NOT NULL,
  punto_venta integer NOT NULL DEFAULT 1,
  environment text NOT NULL DEFAULT 'simulation'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arca_credentials_pkey PRIMARY KEY (company_cuit)
);
CREATE TABLE public.arca_padron_cache (
  cuit text NOT NULL,
  razon_social text,
  domicilio text,
  estado_afip text,
  categorias jsonb,
  consultado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arca_padron_cache_pkey PRIMARY KEY (cuit)
);
CREATE TABLE public.arca_remitos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_cuit text NOT NULL,
  numero bigint,
  coe text,
  cuit_dest text NOT NULL,
  estado text DEFAULT 'pendiente'::text,
  payload_req jsonb,
  payload_res jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT arca_remitos_pkey PRIMARY KEY (id),
  CONSTRAINT arca_remitos_company_cuit_fkey FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.arca_vouchers (
  id text NOT NULL,
  type text NOT NULL,
  client_cuit text NOT NULL,
  net_amount numeric NOT NULL,
  iva_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  cae text,
  cae_vto text,
  qr_link text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  company_cuit text,
  client_name text,
  items jsonb,
  canal character varying DEFAULT 'oficial'::character varying,
  iva_breakdown jsonb DEFAULT '[]'::jsonb,
  imp_op_ex numeric DEFAULT 0.00,
  imp_tot_conc numeric DEFAULT 0.00,
  imp_trib numeric DEFAULT 0.00,
  doc_tipo integer DEFAULT 99,
  doc_nro text,
  status text DEFAULT 'pendiente_cae'::text CHECK (status = ANY (ARRAY['pendiente_cae'::text, 'autorizado'::text, 'error_temporal'::text, 'rechazado_afip'::text])),
  error_details jsonb,
  attempts integer DEFAULT 0,
  CONSTRAINT arca_vouchers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.articulo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_fabricante character varying NOT NULL,
  codigo_barras character varying,
  descripcion text NOT NULL,
  marca_id uuid NOT NULL,
  familia_id uuid NOT NULL,
  grupo_equivalencia_id uuid,
  precio_costo numeric NOT NULL DEFAULT 0.00,
  precio_minorista numeric NOT NULL DEFAULT 0.00,
  precio_mayorista numeric NOT NULL DEFAULT 0.00,
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 5,
  ubicacion_deposito character varying,
  tsv_busqueda tsvector,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  sku text UNIQUE,
  alicuota_iva integer NOT NULL,
  company_cuit text NOT NULL,
  CONSTRAINT articulo_pkey PRIMARY KEY (id),
  CONSTRAINT articulo_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES public.marca(id),
  CONSTRAINT articulo_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES public.familia_repuesto(id),
  CONSTRAINT articulo_grupo_equivalencia_id_fkey FOREIGN KEY (grupo_equivalencia_id) REFERENCES public.grupo_equivalencia(id),
  CONSTRAINT articulo_alicuota_iva_fkey FOREIGN KEY (alicuota_iva) REFERENCES public.alicuota_iva(codigo_afip),
  CONSTRAINT articulo_company_cuit_fkey FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.articulo_compatibilidad (
  articulo_id uuid NOT NULL,
  auto_version_id uuid NOT NULL,
  observaciones character varying,
  CONSTRAINT articulo_compatibilidad_pkey PRIMARY KEY (articulo_id, auto_version_id),
  CONSTRAINT articulo_compatibilidad_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulo(id),
  CONSTRAINT articulo_compatibilidad_auto_version_id_fkey FOREIGN KEY (auto_version_id) REFERENCES public.auto_version(id)
);
CREATE TABLE public.auto_marca (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT auto_marca_pkey PRIMARY KEY (id)
);
CREATE TABLE public.auto_modelo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  marca_id uuid NOT NULL,
  nombre character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT auto_modelo_pkey PRIMARY KEY (id),
  CONSTRAINT auto_modelo_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES public.auto_marca(id)
);
CREATE TABLE public.auto_version (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  modelo_id uuid NOT NULL,
  motorizacion character varying NOT NULL,
  anio_desde integer NOT NULL,
  anio_hasta integer,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT auto_version_pkey PRIMARY KEY (id),
  CONSTRAINT auto_version_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES public.auto_modelo(id)
);
CREATE TABLE public.caja_movimiento (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['ingreso'::character varying::text, 'egreso'::character varying::text])),
  monto numeric NOT NULL CHECK (monto > 0::numeric),
  concepto text NOT NULL,
  fecha timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  accounting_transaction_id character varying,
  canal character varying DEFAULT 'oficial'::character varying,
  CONSTRAINT caja_movimiento_pkey PRIMARY KEY (id),
  CONSTRAINT caja_movimiento_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.caja_sesion(id)
);
CREATE TABLE public.caja_sesion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cuit character varying NOT NULL,
  user_id character varying NOT NULL,
  estado character varying NOT NULL CHECK (estado::text = ANY (ARRAY['abierta'::character varying::text, 'cerrada'::character varying::text])),
  monto_inicial numeric NOT NULL CHECK (monto_inicial >= 0::numeric),
  monto_teorico numeric NOT NULL,
  monto_real numeric,
  diferencia numeric,
  fecha_apertura timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  fecha_cierre timestamp with time zone,
  notas text,
  CONSTRAINT caja_sesion_pkey PRIMARY KEY (id)
);
CREATE TABLE public.company_profile (
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
  celular text,
  email text,
  CONSTRAINT company_profile_pkey PRIMARY KEY (cuit)
);
CREATE TABLE public.customer_credit_accounts (
  id text NOT NULL,
  client_id text NOT NULL,
  company_cuit text NOT NULL,
  tiene_cuenta_corriente boolean NOT NULL DEFAULT false,
  limite_credito numeric NOT NULL DEFAULT 0.00,
  saldo_actual numeric NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_credit_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT customer_credit_accounts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.customers(id)
);
CREATE TABLE public.customer_credit_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_cuit text NOT NULL,
  debit_movement_id text NOT NULL,
  credit_movement_id text NOT NULL,
  amount_allocated numeric NOT NULL CHECK (amount_allocated > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT customer_credit_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT fk_credit_allocations_company FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit),
  CONSTRAINT fk_allocations_debit FOREIGN KEY (debit_movement_id) REFERENCES public.customer_credit_movements(id),
  CONSTRAINT fk_allocations_credit FOREIGN KEY (credit_movement_id) REFERENCES public.customer_credit_movements(id)
);
CREATE TABLE public.customer_credit_movements (
  id text NOT NULL,
  credit_account_id text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['debito'::text, 'credito'::text])),
  amount numeric NOT NULL,
  description text NOT NULL,
  accounting_transaction_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_credit_movements_pkey PRIMARY KEY (id),
  CONSTRAINT customer_credit_movements_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.customer_credit_accounts(id),
  CONSTRAINT customer_credit_movements_accounting_transaction_id_fkey FOREIGN KEY (accounting_transaction_id) REFERENCES public.accounting_transactions(id)
);
CREATE TABLE public.customers (
  id text NOT NULL,
  cuit text NOT NULL,
  razon_social text NOT NULL,
  condicion_iva text NOT NULL,
  direccion text,
  email text,
  phone text,
  company_cuit text NOT NULL,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_company_cuit_fkey FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.familia_repuesto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT familia_repuesto_pkey PRIMARY KEY (id)
);
CREATE TABLE public.grupo_equivalencia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  descripcion character varying,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT grupo_equivalencia_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marca (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL UNIQUE,
  pais_origen character varying,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT marca_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_company_roles (
  user_id text NOT NULL,
  company_cuit text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::company_role,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_company_roles_pkey PRIMARY KEY (user_id, company_cuit),
  CONSTRAINT user_company_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_company_roles_company_cuit_fkey FOREIGN KEY (company_cuit) REFERENCES public.company_profile(cuit)
);
CREATE TABLE public.users (
  id text NOT NULL,
  email text UNIQUE,
  profile jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  role USER-DEFINED NOT NULL DEFAULT 'pending'::user_role,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);