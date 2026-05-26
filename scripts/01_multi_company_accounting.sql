-- MIGRATION: ADD MULTI-COMPANY ISOLATION TO ACCOUNTING MODULE
-- Path: scripts/01_multi_company_accounting.sql

-- 1. Add company_cuit to accounting_transactions
ALTER TABLE public.accounting_transactions 
ADD COLUMN IF NOT EXISTS company_cuit text;

-- 2. Add company_cuit to accounting_accounts
ALTER TABLE public.accounting_accounts 
ADD COLUMN IF NOT EXISTS company_cuit text;

-- 3. Add Foreign Key constraints
ALTER TABLE public.accounting_transactions 
DROP CONSTRAINT IF EXISTS fk_accounting_transactions_company;

ALTER TABLE public.accounting_transactions 
ADD CONSTRAINT fk_accounting_transactions_company 
FOREIGN KEY (company_cuit) 
REFERENCES public.company_profile(cuit) 
ON DELETE CASCADE;

ALTER TABLE public.accounting_accounts 
DROP CONSTRAINT IF EXISTS fk_accounting_accounts_company;

ALTER TABLE public.accounting_accounts 
ADD CONSTRAINT fk_accounting_accounts_company 
FOREIGN KEY (company_cuit) 
REFERENCES public.company_profile(cuit) 
ON DELETE CASCADE;

-- 4. Create Performance Indexes for multi-company isolation
DROP INDEX IF EXISTS public.idx_accounting_transactions_company_cuit;
CREATE INDEX idx_accounting_transactions_company_cuit 
ON public.accounting_transactions(company_cuit);

DROP INDEX IF EXISTS public.idx_accounting_accounts_company_cuit;
CREATE INDEX idx_accounting_accounts_company_cuit 
ON public.accounting_accounts(company_cuit);

-- 5. Redefine crear_asiento_venta to support p_company_cuit
CREATE OR REPLACE FUNCTION public.crear_asiento_venta(
    p_tx_id text, 
    p_concepto text, 
    p_cuenta_activo text, 
    p_total numeric, 
    p_revenue numeric, 
    p_iva numeric, 
    p_es_fiscal boolean, 
    p_canal text DEFAULT 'oficial'::text,
    p_company_cuit text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- 1. Insertar Cabecera Contable con el canal clasificado y el CUIT de la empresa
    INSERT INTO public.accounting_transactions (id, date, description, canal, company_cuit)
    VALUES (p_tx_id, now(), p_concepto, p_canal, p_company_cuit);

    -- 2. Insertar Línea de Activo (Debe)
    INSERT INTO public.accounting_entries (transaction_id, account_code, debe, haber)
    VALUES (p_tx_id, p_cuenta_activo, p_total, 0.00);

    -- 3. Insertar Línea de Ventas (Haber)
    INSERT INTO public.accounting_entries (transaction_id, account_code, debe, haber)
    VALUES (p_tx_id, '4.1.1.01', 0.00, p_revenue);

    -- 4. Insertar Línea de IVA (Haber) si corresponde
    IF p_es_fiscal AND p_iva > 0 THEN
        INSERT INTO public.accounting_entries (transaction_id, account_code, debe, haber)
        VALUES (p_tx_id, '2.1.3.01', 0.00, p_iva);
    END IF;
END;
$function$;
