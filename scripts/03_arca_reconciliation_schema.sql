-- MIGRATION: ADVANCED SALES & ACCOUNT RECONCILIATION SCHEMA
-- Path: scripts/03_arca_reconciliation_schema.sql

-- 1. Ampliar public.afip_vouchers para soportar Libro IVA Ventas y validaciones RG 5616
ALTER TABLE public.afip_vouchers 
ADD COLUMN IF NOT EXISTS iva_breakdown jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS imp_op_ex numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS imp_tot_conc numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS imp_trib numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS doc_tipo integer DEFAULT 99,
ADD COLUMN IF NOT EXISTS doc_nro text;

-- Crear índices de rendimiento en afip_vouchers para optimizar reportes impositivos
DROP INDEX IF EXISTS public.idx_afip_vouchers_company_cuit;
CREATE INDEX idx_afip_vouchers_company_cuit ON public.afip_vouchers(company_cuit);

DROP INDEX IF EXISTS public.idx_afip_vouchers_doc_nro;
CREATE INDEX idx_afip_vouchers_doc_nro ON public.afip_vouchers(doc_nro);

-- 2. Crear tabla relacional customer_credit_allocations para imputación de cuentas corrientes
CREATE TABLE IF NOT EXISTS public.customer_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_cuit text NOT NULL,
  debit_movement_id text NOT NULL,
  credit_movement_id text NOT NULL,
  amount_allocated numeric NOT NULL CHECK (amount_allocated > 0),
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Restricción de clave foránea a company_profile
  CONSTRAINT fk_credit_allocations_company FOREIGN KEY (company_cuit) 
    REFERENCES public.company_profile(cuit) ON DELETE CASCADE,
    
  -- Restricciones de clave foránea a customer_credit_movements (tipo TEXT)
  CONSTRAINT fk_allocations_debit FOREIGN KEY (debit_movement_id) 
    REFERENCES public.customer_credit_movements(id) ON DELETE CASCADE,
    
  CONSTRAINT fk_allocations_credit FOREIGN KEY (credit_movement_id) 
    REFERENCES public.customer_credit_movements(id) ON DELETE CASCADE
);

-- Crear índices de rendimiento para imputación y búsquedas rápidas
DROP INDEX IF EXISTS public.idx_credit_allocations_company_cuit;
CREATE INDEX idx_credit_allocations_company_cuit ON public.customer_credit_allocations(company_cuit);

DROP INDEX IF EXISTS public.idx_credit_allocations_debit;
CREATE INDEX idx_credit_allocations_debit ON public.customer_credit_allocations(debit_movement_id);

DROP INDEX IF EXISTS public.idx_credit_allocations_credit;
CREATE INDEX idx_credit_allocations_credit ON public.customer_credit_allocations(credit_movement_id);

-- 3. Habilitar RLS y políticas de acceso
ALTER TABLE public.customer_credit_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a anon y authenticated en allocations" ON public.customer_credit_allocations;
CREATE POLICY "Permitir todo a anon y authenticated en allocations" 
ON public.customer_credit_allocations 
FOR ALL 
USING (true) 
WITH CHECK (true);
