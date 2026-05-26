-- Migration: Securización de Base de Datos (Multi-Tenant RLS) y Tablas de Caché ARCA / Remitos
-- Habilitada en Supabase Live el 24/05/2026

-- 1. Enable RLS on user_company_roles and credit tables
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_allocations ENABLE ROW LEVEL SECURITY;

-- 2. Drop insecure legacy policies
DROP POLICY IF EXISTS "Allow authenticated access" ON public.arca_credentials;
DROP POLICY IF EXISTS "Permitir ALL a anon y authenticated en customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customers;
DROP POLICY IF EXISTS "Permitir todo a anon y authenticated en allocations" ON public.customer_credit_allocations;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customer_credit_allocations;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customer_credit_accounts;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.customer_credit_movements;

-- 3. Create strict tenant-isolation policies
CREATE POLICY "tenant_arca_credentials_isolation" ON public.arca_credentials
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles
      WHERE user_company_roles.user_id = (auth.uid())::text
        AND user_company_roles.company_cuit = arca_credentials.company_cuit
    )
  );

CREATE POLICY "tenant_customers_isolation" ON public.customers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles
      WHERE user_company_roles.user_id = (auth.uid())::text
        AND user_company_roles.company_cuit = customers.company_cuit
    )
  );

CREATE POLICY "tenant_allocations_isolation" ON public.customer_credit_allocations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles
      WHERE user_company_roles.user_id = (auth.uid())::text
        AND user_company_roles.company_cuit = customer_credit_allocations.company_cuit
    )
  );

CREATE POLICY "tenant_credit_accounts_isolation" ON public.customer_credit_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles
      WHERE user_company_roles.user_id = (auth.uid())::text
        AND user_company_roles.company_cuit = customer_credit_accounts.company_cuit
    )
  );

CREATE POLICY "tenant_credit_movements_isolation" ON public.customer_credit_movements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles ucr
      JOIN public.customer_credit_accounts cca ON cca.company_cuit = ucr.company_cuit
      WHERE ucr.user_id = (auth.uid())::text
        AND cca.id = customer_credit_movements.credit_account_id
    )
  );

-- Policy to allow users to read their own company roles
DROP POLICY IF EXISTS "user_company_roles_read_own" ON public.user_company_roles;
CREATE POLICY "user_company_roles_read_own" ON public.user_company_roles
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()::text) = user_id));

-- Policy to allow users to insert their own role mappings
DROP POLICY IF EXISTS "user_company_roles_insert_own" ON public.user_company_roles;
CREATE POLICY "user_company_roles_insert_own" ON public.user_company_roles
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()::text) = user_id));

-- 4. Create arca_remitos table and set up policies
CREATE TABLE IF NOT EXISTS public.arca_remitos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_cuit text NOT NULL REFERENCES public.company_profile(cuit),
  numero       bigint,
  coe          text, -- Código de Operación Electrónico de ARCA
  cuit_dest    text NOT NULL,
  estado       text DEFAULT 'pendiente', -- pendiente | emitido | error
  payload_req  jsonb,
  payload_res  jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.arca_remitos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_remitos_isolation" ON public.arca_remitos;
CREATE POLICY "tenant_remitos_isolation" ON public.arca_remitos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles
      WHERE user_company_roles.user_id = (auth.uid())::text
        AND user_company_roles.company_cuit = arca_remitos.company_cuit
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON public.arca_remitos;
CREATE POLICY "project_admin_policy" ON public.arca_remitos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Create arca_padron_cache table and policies
CREATE TABLE IF NOT EXISTS public.arca_padron_cache (
  cuit           text PRIMARY KEY,
  razon_social   text,
  domicilio      text,
  estado_afip    text,
  categorias     jsonb,
  consultado_at  timestamptz DEFAULT now()
);

ALTER TABLE public.arca_padron_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_padron_cache_read" ON public.arca_padron_cache;
CREATE POLICY "authenticated_padron_cache_read" ON public.arca_padron_cache
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_padron_cache_write" ON public.arca_padron_cache;
CREATE POLICY "authenticated_padron_cache_write" ON public.arca_padron_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
